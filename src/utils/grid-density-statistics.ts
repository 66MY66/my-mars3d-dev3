import { area, featureCollection, intersect, polygon } from "@turf/turf"
import { fromUrl } from "geotiff"

export type GridDensityDataset = "population" | "gdp"
type Ring = Array<[number, number]>

export const GRID_CELL_COVERAGE_THRESHOLD = 0.4
export const GRID_DENSITY_MAX_CELLS = 60_000

type DensityBin = { label: string; min: number; max: number }

export const GRID_DENSITY_SOURCES: Record<GridDensityDataset, {
  dataUrl: string
  visualTileUrl: string
  nodata: number
  bins: DensityBin[]
}> = {
  population: {
    dataUrl: "/api/rs-products/rs-products/spatial/china-2020/pop2020_people_cog.tif",
    visualTileUrl: "/api/titiler/collections/spatial-thematic/items/SP-china-pop2020/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=visual&resampling=nearest",
    nodata: -9999,
    bins: [
      { label: "0", min: 0, max: 0 }, { label: "1–20", min: 1, max: 20 }, { label: "21–50", min: 21, max: 50 },
      { label: "51–100", min: 51, max: 100 }, { label: "101–200", min: 101, max: 200 }, { label: "201–500", min: 201, max: 500 },
      { label: "501–1,000", min: 501, max: 1000 }, { label: "1,001–2,000", min: 1001, max: 2000 },
      { label: "2,001–5,000", min: 2001, max: 5000 }, { label: "5,001–10,000", min: 5001, max: 10000 },
      { label: "≥10,001", min: 10001, max: Infinity }
    ]
  },
  gdp: {
    dataUrl: "/api/rs-products/rs-products/spatial/china-2020/gdp2020_value_cog.tif",
    visualTileUrl: "/api/titiler/collections/spatial-thematic/items/SP-china-gdp2020/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=visual&resampling=nearest",
    nodata: -9999,
    bins: [
      { label: "0", min: 0, max: 0 }, { label: "1–100", min: 1, max: 100 }, { label: "101–500", min: 101, max: 500 },
      { label: "501–1,000", min: 501, max: 1000 }, { label: "1,001–2,500", min: 1001, max: 2500 },
      { label: "2,501–5,000", min: 2501, max: 5000 }, { label: "5,001–10,000", min: 5001, max: 10000 },
      { label: "10,001–25,000", min: 10001, max: 25000 }, { label: "25,001–50,000", min: 25001, max: 50000 },
      { label: "50,001–100,000", min: 50001, max: 100000 }, { label: "≥100,001", min: 100001, max: Infinity }
    ]
  }
}

export type GridRasterWindow = {
  west: number
  north: number
  pixelWidth: number
  pixelHeight: number
  width: number
  height: number
  values: ArrayLike<number>
  rowOffset?: number
  columnOffset?: number
}

export type SelectedDensityCell = {
  row: number
  column: number
  value: number
  coverage: number
  areaKm2: number
  total: number
  west: number
  south: number
  east: number
  north: number
}

export type GridDensityStatisticsResult = {
  dataset: GridDensityDataset
  candidateCellCount: number
  selectedCellCount: number
  nodataCellCount: number
  selectedAreaKm2: number
  total: number
  meanDensity: number
  minDensity: number
  maxDensity: number
  selectedCells: SelectedDensityCell[]
  rows: Array<Record<string, number | string>>
}

function closeRing(ring: Ring): Ring {
  if (!ring.length) { return [] }
  const result = ring.slice()
  const first = result[0]
  const last = result[result.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) { result.push([first[0], first[1]]) }
  return result
}

function cellCoverageAndArea(ringFeature: any, west: number, south: number, east: number, north: number) {
  const cell = polygon([[[west, south], [east, south], [east, north], [west, north], [west, south]]])
  const cellArea = area(cell)
  const overlap = intersect(featureCollection([ringFeature, cell]))
  return { coverage: overlap && cellArea > 0 ? Math.min(1, area(overlap) / cellArea) : 0, areaKm2: cellArea / 1_000_000 }
}

export function computeGridDensityStatistics(input: { dataset: GridDensityDataset; ring: Ring; raster: GridRasterWindow }): GridDensityStatisticsResult {
  const { dataset, raster } = input
  const source = GRID_DENSITY_SOURCES[dataset]
  const ringFeature = polygon([closeRing(input.ring)])
  const selectedCells: SelectedDensityCell[] = []
  let nodataCellCount = 0

  for (let row = 0; row < raster.height; row++) {
    const north = raster.north - row * raster.pixelHeight
    const south = north - raster.pixelHeight
    for (let column = 0; column < raster.width; column++) {
      const west = raster.west + column * raster.pixelWidth
      const east = west + raster.pixelWidth
      const { coverage, areaKm2 } = cellCoverageAndArea(ringFeature, west, south, east, north)
      if (coverage + 1e-9 < GRID_CELL_COVERAGE_THRESHOLD) { continue }
      const value = Number(raster.values[row * raster.width + column])
      if (!Number.isFinite(value) || value <= source.nodata) {
        nodataCellCount++
        continue
      }
      selectedCells.push({
        row: row + (raster.rowOffset || 0),
column: column + (raster.columnOffset || 0),
value,
coverage,
areaKm2,
total: value * areaKm2,
        west,
south,
east,
north
      })
    }
  }

  const total = selectedCells.reduce((sum, cell) => sum + cell.total, 0)
  const selectedAreaKm2 = selectedCells.reduce((sum, cell) => sum + cell.areaKm2, 0)
  const values = selectedCells.map((cell) => cell.value)
  const rows = source.bins.map((bin) => {
    const cells = selectedCells.filter((cell) => cell.value >= bin.min && cell.value <= bin.max)
    return {
      区间: bin.label,
      格网数: cells.length,
      面积: cells.reduce((sum, cell) => sum + cell.areaKm2, 0),
      总量: cells.reduce((sum, cell) => sum + cell.total, 0),
      平均密度: cells.length ? cells.reduce((sum, cell) => sum + cell.value, 0) / cells.length : 0
    }
  })
  return {
    dataset,
    candidateCellCount: raster.width * raster.height,
    selectedCellCount: selectedCells.length,
    nodataCellCount,
    selectedAreaKm2,
    total,
    meanDensity: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
    minDensity: values.length ? Math.min(...values) : 0,
    maxDensity: values.length ? Math.max(...values) : 0,
    selectedCells,
    rows
  }
}

export async function loadGridDensityStatistics(dataset: GridDensityDataset, ring: Ring, signal?: AbortSignal) {
  const source = GRID_DENSITY_SOURCES[dataset]
  const tiff = await fromUrl(source.dataUrl, { signal } as any)
  const image = await tiff.getImage()
  const [originX, originY] = image.getOrigin()
  const [resolutionX, resolutionYRaw] = image.getResolution()
  const resolutionY = Math.abs(resolutionYRaw)
  const width = image.getWidth()
  const height = image.getHeight()
  const lngs = ring.map((point) => point[0])
  const lats = ring.map((point) => point[1])
  const minColumn = Math.max(0, Math.floor((Math.min(...lngs) - originX) / resolutionX))
  const maxColumn = Math.min(width, Math.ceil((Math.max(...lngs) - originX) / resolutionX))
  const minRow = Math.max(0, Math.floor((originY - Math.max(...lats)) / resolutionY))
  const maxRow = Math.min(height, Math.ceil((originY - Math.min(...lats)) / resolutionY))
  const windowWidth = Math.max(0, maxColumn - minColumn)
  const windowHeight = Math.max(0, maxRow - minRow)
  if (!windowWidth || !windowHeight) { return computeGridDensityStatistics({ dataset, ring, raster: { west: 0, north: 0, pixelWidth: resolutionX, pixelHeight: resolutionY, width: 0, height: 0, values: [] } }) }
  if (windowWidth * windowHeight > GRID_DENSITY_MAX_CELLS) { throw new Error("绘制范围过大，请缩小范围后重试") }
  const rasters = await image.readRasters({ window: [minColumn, minRow, maxColumn, maxRow], interleave: true, signal } as any)
  return computeGridDensityStatistics({
    dataset,
    ring,
    raster: {
      west: originX + minColumn * resolutionX,
      north: originY - minRow * resolutionY,
      pixelWidth: resolutionX,
      pixelHeight: resolutionY,
      width: windowWidth,
      height: windowHeight,
      values: rasters as any,
      rowOffset: minRow,
      columnOffset: minColumn
    }
  })
}
