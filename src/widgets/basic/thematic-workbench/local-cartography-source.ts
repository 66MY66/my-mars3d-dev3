import { emptyDbtDocument, readDbtDocument, type DbtBounds, type DbtDocument } from "./dbt116-standard"
import type { TemplateDocument } from "./template-renderer"
import type { SourceReferenceGrid } from "./source-reference-grid"

export type LocalSource = {
  id: string; name: string; kind: "raw-grid" | "imagery" | "thermal"; role: string; crs: string
  source: string; sourceSha256: string; url: string; sha256: string; bounds: DbtBounds
  notice: string; processing: string; unit: string; observedAt?: string; bandOrder?: number[]
  nativeForecastUrl?: string; nativeForecastSha256?: string
  inputFiles?: Array<{ path: string; sha256: string }>
}
export type NativeForecast = { date: string; stepHour: number; validDate: number; validTime: number; gridType: string; radiusMetres: number; unit: string; sourceFile: string; sourceSha256: string; points: Array<{ lon: number; lat: number; value: number }> }
export type ThermalFrame = { id: string; date: string; passName: string; utcHour: number; forecastStep: number; observationFile: string; observationSha256: string; points: Array<{ lon: number; lat: number; observedC: number; forecastC: number; differenceC: number }> }
const base = import.meta.env.BASE_URL
export async function localCatalog(signal?: AbortSignal): Promise<LocalSource[]> {
  const response = await fetch(`${base}data/local-cartography/catalog.json`, { signal })
  if (!response.ok) { throw new Error("本地制图数据目录不可用，请运行 prepare-local-cartography.py") }
  const catalog = await response.json()
  if (catalog.version !== 1 || !Array.isArray(catalog.sources)) { throw new Error("本地数据目录结构无效") }
  return catalog.sources
}
export async function verifiedLocalBytes(source: LocalSource, signal?: AbortSignal) {
  const response = await fetch(`${base}${source.url}`, { signal })
  if (!response.ok) { throw new Error("数据文件读取失败") }
  const bytes = await response.arrayBuffer()
  const hash = await crypto.subtle.digest("SHA-256", bytes)
  const actual = Array.from(new Uint8Array(hash), v => v.toString(16).padStart(2, "0")).join("")
  signal?.throwIfAborted()
  if (actual !== source.sha256) { throw new Error("数据文件指纹与目录不一致，请重新生成目录") }
  return bytes
}
export function sourcePixelWindow(bounds: DbtBounds, width: number, height: number, extent: DbtBounds, limit = 1_000_000) {
  if (![extent.west, extent.east, extent.south, extent.north].every(Number.isFinite) || extent.west >= extent.east || extent.south >= extent.north) { throw new Error("裁切范围无效") }
  const dx = (bounds.east - bounds.west) / width; const dy = (bounds.north - bounds.south) / height
  const window = [Math.max(0, Math.floor((extent.west - bounds.west) / dx)), Math.max(0, Math.floor((bounds.north - extent.north) / dy)), Math.min(width, Math.ceil((extent.east - bounds.west) / dx)), Math.min(height, Math.ceil((bounds.north - extent.south) / dy))]
  const w = window[2] - window[0]; const h = window[3] - window[1]
  if (w <= 0 || h <= 0) { throw new Error("选区与该数据没有交集，不会拉伸或搬移数据填满图幅") }
  if (w * h > limit) { throw new Error("选区像元过多，请缩小范围；不会自动降低数值精度") }
  return { window, width: w, height: h, bounds: { west: bounds.west + window[0] * dx, east: bounds.west + window[2] * dx, north: bounds.north - window[1] * dy, south: bounds.north - window[3] * dy } }
}
export async function localReferenceDocument(source: LocalSource, extent: DbtBounds, signal?: AbortSignal): Promise<DbtDocument> {
  if (source.kind === "thermal") { throw new Error("温度时次应接入分析表达，不冒充地震应急专题") }
  const { fromArrayBuffer } = await import("geotiff")
  const tiff = await fromArrayBuffer(await verifiedLocalBytes(source, signal))
  const image = await tiff.getImage(0)
  const code = Number(image.getGeoKeys()?.GeographicTypeGeoKey)
  if (`EPSG:${code}` !== source.crs) { throw new Error("实际 GeoTIFF 坐标与目录不一致") }
  const [west, south, east, north] = image.getBoundingBox()
  const crop = sourcePixelWindow({ west, south, east, north }, image.getWidth(), image.getHeight(), extent, source.kind === "imagery" ? 4_000_000 : 1_000_000)
  const doc = emptyDbtDocument()
  doc.crs = source.crs; doc.usage = "reference"
  doc.reference = { title: `${source.name} · 数据参考图`, bounds: crop.bounds, notice: source.notice }
  doc.description = `${source.processing}\n${source.notice}`; doc.createdAt = new Date().toISOString()
  let instance = source.id === "gdp2020" ? "03" : "01"
  if (source.kind === "imagery") { instance = "02" }
  doc.classification = { instance, spatial: "6" }
  const layer: DbtDocument["layers"][number] = {
 id: source.id,
name: source.name,
role: source.role,
authority: "",
publishedAt: source.observedAt || "",
source: source.source,
    crs: source.crs,
security: "",
scale: 1000000,
data: { type: "FeatureCollection", features: [] },
    coverage: crop.bounds,
crsEvidence: source.processing,
    sourceReference: { catalogId: source.id, originalSha256: source.sourceSha256, productSha256: source.sha256, processing: source.processing, notice: source.notice } 
}
  if (source.kind === "raw-grid") {
    const values = await image.readRasters({ window: crop.window, samples: [0], interleave: true, signal })
    const nodata = image.getGDALNoData()
    if (!Array.from(values as ArrayLike<number>).some(v => Number.isFinite(v) && v !== nodata)) { throw new Error("选区只有 NoData，没有有效原始数值") }
    layer.sourceGrid = { width: crop.width, height: crop.height, bounds: crop.bounds, values: Array.from(values as ArrayLike<number>, v => v === nodata ? null : v), unit: source.unit, crs: "EPSG:4024", sourceWindow: crop.window } as SourceReferenceGrid
  } else {
    const samples = source.bandOrder!.map(band => band - 1)
    const channels = await image.readRasters({ window: crop.window, samples, signal })
    const canvas = document.createElement("canvas"); canvas.width = crop.width; canvas.height = crop.height
    const context = canvas.getContext("2d")!; const pixels = context.createImageData(crop.width, crop.height)
    for (let channel = 0; channel < 3; channel++) {
      const values = channels[channel] as ArrayLike<number>
      const sorted = Array.from(values).filter(v => v > 0).sort((a, b) => a - b)
      const low = sorted[Math.floor(sorted.length * 0.02)] || 0; const high = sorted[Math.floor(sorted.length * 0.98)] || 1
      for (let i = 0; i < values.length; i++) { pixels.data[i * 4 + channel] = Math.round(255 * Math.max(0, Math.min(1, (values[i] - low) / (high - low || 1)))); if (values[i]) { pixels.data[i * 4 + 3] = 255 } }
    }
    context.putImageData(pixels, 0, 0)
    layer.raster = { image: canvas.toDataURL("image/png"), bounds: crop.bounds, rendering: "imagery", radiometry: source.processing }
    layer.legend = [{ color: "#87979b", label: `${source.id === "gf2-mss1" ? "MSS1 R/G/B=3/2/1" : "PAN1 灰度"} 影像覆盖` }]
    layer.colorStandard = "原始 DN 百分位拉伸显示，图例表示影像覆盖而非地物分类"
  }
  signal?.throwIfAborted(); doc.layers = [layer]
  return readDbtDocument(doc)
}
export function thermalDocument(source: LocalSource, frame: ThermalFrame, metric: "observedC" | "forecastC" | "differenceC"): TemplateDocument {
  const features = frame.points.map((p, i) => ({ type: "Feature" as const, id: i, geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] }, properties: { value: p[metric], before: p.observedC, after: p.forecastC, name: `${p.lon}°E ${p.lat}°N`, time: frame.date } }))
  return {
 type: "FeatureCollection",
features,
metadata: {
 source: `${source.source} · ${frame.date} ${frame.passName} UTC ${frame.utcHour}h · ${source.notice}`,
crs: source.crs,
    usage: "reference",
referenceOnly: true,
sourceSha256: source.sourceSha256,
observationSha256: frame.observationSha256,
    unit: "°C",
valueField: "value",
    observedAt: new Date(Date.parse(`${frame.date}T00:00:00Z`) + frame.utcHour * 3600000).toISOString(),
gridStep: 1,
    gridDefinition: { west: 128.5, north: 34.5, width: 4, height: 4, dx: 1, dy: 1, missing: "omit" },
    sourceBounds: source.bounds,
processing: source.processing,
metric,
forecastStep: frame.forecastStep 
} 
}
}
