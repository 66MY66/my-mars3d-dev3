import { validatePopulationGrid, type PopulationBounds, type PopulationGrid } from "./population-grid"

export async function readPopulationGeoTiff(buffer: ArrayBuffer, fileName: string, metric: PopulationGrid["metric"], extent?: PopulationBounds): Promise<PopulationGrid> {
  const { fromArrayBuffer } = await import("geotiff")
  const tiff = await fromArrayBuffer(buffer)
  const image = await tiff.getImage(0)
  if (image.getSamplesPerPixel() !== 1 || ![0, 1].includes(image.fileDirectory.getValue("PhotometricInterpretation") as number)) { throw new Error("人口数据须为单波段数值 GeoTIFF，不能使用 RGB、调色板图片或截图") }
  const keys = image.getGeoKeys()
  const code = keys?.GeographicTypeGeoKey
  if (keys?.GTModelTypeGeoKey !== 2 || ![4326, 4490].includes(Number(code))) { throw new Error("仅直接读取明确的 EPSG:4326/4490 地理坐标栅格；投影或未知基准须先经有依据的转换，不能改写标签") }
  const matrix = image.fileDirectory.getValue("ModelTransformation") as number[] | undefined
  if (matrix && (matrix[1] || matrix[4] || matrix[0] <= 0 || matrix[5] >= 0)) { throw new Error("旋转或翻转栅格须先进行有依据的地理校正") }
  const origin = image.getOrigin(); const resolution = image.getResolution()
  if (!(resolution[0] > 0 && resolution[1] < 0)) { throw new Error("人口栅格需为北向上的地理坐标网格") }
  const pointPixel = keys?.GTRasterTypeGeoKey === 2
  const west = origin[0] - (pointPixel ? resolution[0] / 2 : 0)
  const north = origin[1] - (pointPixel ? resolution[1] / 2 : 0)
  const sourceWidth = image.getWidth(); const sourceHeight = image.getHeight()
  const dx = resolution[0]; const dy = -resolution[1]
  const window = extent ? [Math.max(0, Math.floor((extent.west - west) / dx)), Math.max(0, Math.floor((north - extent.north) / dy)), Math.min(sourceWidth, Math.ceil((extent.east - west) / dx)), Math.min(sourceHeight, Math.ceil((north - extent.south) / dy))] : [0, 0, sourceWidth, sourceHeight]
  const width = window[2] - window[0]; const height = window[3] - window[1]
  if (width <= 0 || height <= 0) { throw new Error("框选范围内没有人口栅格覆盖") }
  if (width * height > 1_000_000) { throw new Error("范围内超过 100 万原始像元，请先框选较小范围或提供裁切子集；不会降采样伪造精度") }
  const rasters = await image.readRasters({ window, samples: [0], interleave: true })
  const noData = image.getGDALNoData()
  const values = Array.from(rasters as ArrayLike<number>, value => {
    if (value === noData || (Number.isNaN(value) && Number.isNaN(noData))) { return null }
    if (!Number.isFinite(value)) { throw new Error("栅格包含未声明为 NoData 的非有限值，不自动当作缺测") }
    return Number(value)
  })
  const hash = await crypto.subtle.digest("SHA-256", buffer)
  const sourceSha256 = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")
  const grid: PopulationGrid = { version: 1, width, height, crs: `EPSG:${code}` as PopulationGrid["crs"], metric, values, sourceFile: fileName, sourceSha256, sourceWidth, sourceHeight, sourceWindow: window, bounds: { west: west + window[0] * dx, east: west + window[2] * dx, north: north - window[1] * dy, south: north - window[3] * dy } }
  validatePopulationGrid(grid)
  return grid
}
