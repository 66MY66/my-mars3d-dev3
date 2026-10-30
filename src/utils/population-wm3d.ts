export type PopulationColor = [number, number, number]

export type PopulationGridCell = {
  row: number
  column: number
  west: number
  east: number
  north: number
  south: number
  heightCode: number
  color: PopulationColor
}

export type PopulationWm3d = {
  version: number
  width: number
  height: number
  west: number
  north: number
  step: number
  cells: PopulationGridCell[]
}

type LonLat = [number, number]

const WM3D_HEADER_BYTES = 34
export const POPULATION_COLUMNS_MAX_DISTANCE = 50000

export function parsePopulationWm3d(buffer: ArrayBuffer): PopulationWm3d {
  if (buffer.byteLength < WM3D_HEADER_BYTES) {
    throw new Error("WM3D 人口数据文件不完整")
  }
  const view = new DataView(buffer)
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
  if (magic !== "WM3D") {
    throw new Error("不是有效的 WM3D 人口数据")
  }
  const version = view.getUint16(4, true)
  const width = view.getUint16(6, true)
  const height = view.getUint16(8, true)
  const west = view.getFloat64(10, true)
  const north = view.getFloat64(18, true)
  const step = view.getFloat64(26, true)
  const count = width * height
  const expectedBytes = WM3D_HEADER_BYTES + count * 5
  if (!width || !height || !Number.isFinite(west) || !Number.isFinite(north) || !Number.isFinite(step) || step <= 0 || buffer.byteLength < expectedBytes) {
    throw new Error("WM3D 人口数据头或数据长度无效")
  }
  const heights = new Uint16Array(buffer, WM3D_HEADER_BYTES, count)
  const colors = new Uint8Array(buffer, WM3D_HEADER_BYTES + count * 2, count * 3)
  const cells: PopulationGridCell[] = []
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const index = row * width + column
      const heightCode = heights[index]
      if (!heightCode) {
        continue
      }
      const cellWest = west + column * step
      const cellNorth = north - row * step
      cells.push({
        row,
        column,
        west: cellWest,
        east: cellWest + step,
        north: cellNorth,
        south: cellNorth - step,
        heightCode,
        color: [colors[index * 3], colors[index * 3 + 1], colors[index * 3 + 2]]
      })
    }
  }
  return { version, width, height, west, north, step, cells }
}

function clipPolygon(points: LonLat[], axis: 0 | 1, boundary: number, keepGreater: boolean) {
  const result: LonLat[] = []
  if (!points.length) {
    return result
  }
  const inside = (point: LonLat) => keepGreater ? point[axis] >= boundary : point[axis] <= boundary
  const intersection = (start: LonLat, end: LonLat): LonLat => {
    const denominator = end[axis] - start[axis]
    const ratio = denominator === 0 ? 0 : (boundary - start[axis]) / denominator
    return axis === 0
      ? [boundary, start[1] + (end[1] - start[1]) * ratio]
      : [start[0] + (end[0] - start[0]) * ratio, boundary]
  }
  let start = points[points.length - 1]
  for (const end of points) {
    const startInside = inside(start)
    const endInside = inside(end)
    if (endInside) {
      if (!startInside) { result.push(intersection(start, end)) }
      result.push(end)
    } else if (startInside) {
      result.push(intersection(start, end))
    }
    start = end
  }
  return result
}

function polygonArea(points: LonLat[]) {
  if (points.length < 3) { return 0 }
  let twiceArea = 0
  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length]
    twiceArea += points[index][0] * next[1] - next[0] * points[index][1]
  }
  return Math.abs(twiceArea) / 2
}

export function getPopulationCellCoverage(cell: PopulationGridCell, ring: LonLat[]) {
  let clipped = ring.slice()
  clipped = clipPolygon(clipped, 0, cell.west, true)
  clipped = clipPolygon(clipped, 0, cell.east, false)
  clipped = clipPolygon(clipped, 1, cell.south, true)
  clipped = clipPolygon(clipped, 1, cell.north, false)
  return Math.min(1, polygonArea(clipped) / ((cell.east - cell.west) * (cell.north - cell.south)))
}

export function selectPopulationCells(data: PopulationWm3d, ring: LonLat[]) {
  if (ring.length < 3) { return [] }
  const longitudes = ring.map((point) => point[0])
  const latitudes = ring.map((point) => point[1])
  const bbox = [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)]
  return data.cells.filter((cell) => {
    if (cell.east <= bbox[0] || cell.west >= bbox[2] || cell.north <= bbox[1] || cell.south >= bbox[3]) { return false }
    return getPopulationCellCoverage(cell, ring) > 1e-12
  })
}

export function populationColumnHeightSourceUnits(heightCode: number) {
  const ratio = Math.max(0, Math.min(1, (heightCode - 1) / 65534))
  return 0.35 + ratio * 14
}

export function buildPopulationVisualCell(cell: PopulationGridCell) {
  const gap = (cell.east - cell.west) * 0.8
  return {
    west: cell.west,
    east: cell.west + gap,
    north: cell.north,
    south: cell.north - gap,
    height: populationColumnHeightSourceUnits(cell.heightCode),
    color: cell.color
  }
}
