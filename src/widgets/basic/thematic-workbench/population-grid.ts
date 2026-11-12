export type PopulationBounds = { west: number; south: number; east: number; north: number }
export type PopulationGrid = {
  version: 1; width: number; height: number; bounds: PopulationBounds; crs: "EPSG:4326" | "EPSG:4490"
  metric: "people-per-cell" | "people-per-km2"; values: Array<number | null>
  sourceFile: string; sourceSha256: string; sourceWidth: number; sourceHeight: number; sourceWindow: number[]
}
export const POPULATION_BREAKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
export const POPULATION_COLORS = ["#e5f5d9", "#c7e9ad", "#a1d76a", "#78c850", "#4eb53d", "#27984a", "#158061", "#177d83", "#277b9c", "#326e99", "#235279"]
export const POPULATION_NODATA = "#d9dee5"
export function validatePopulationGrid(grid: PopulationGrid): void {
  if (grid?.version !== 1 || !Number.isInteger(grid.width) || !Number.isInteger(grid.height) || grid.width < 1 || grid.height < 1 || grid.width * grid.height > 1_000_000 || !Array.isArray(grid.values) || grid.values.length !== grid.width * grid.height) { throw new Error("人口栅格尺寸无效或超过 100 万原始像元，请先裁切") }
  const b = grid.bounds
  if (!b || ![b.west, b.east, b.south, b.north].every(Number.isFinite) || b.west >= b.east || b.south >= b.north || b.west < -180 || b.east > 180 || b.south < -90 || b.north > 90) { throw new Error("人口栅格地理范围无效") }
  if (!["EPSG:4326", "EPSG:4490"].includes(grid.crs) || !["people-per-cell", "people-per-km2"].includes(grid.metric)) { throw new Error("人口栅格坐标或指标单位未明确，不自动猜测") }
  if (!/^[a-f0-9]{64}$/.test(grid.sourceSha256) || !grid.sourceFile || !Number.isInteger(grid.sourceWidth) || !Number.isInteger(grid.sourceHeight) || !Array.isArray(grid.sourceWindow) || grid.sourceWindow.length !== 4) { throw new Error("人口栅格缺少原始文件指纹或像元窗口") }
  const [x0, y0, x1, y1] = grid.sourceWindow
  if (![x0, y0, x1, y1].every(Number.isInteger) || x0 < 0 || y0 < 0 || x1 > grid.sourceWidth || y1 > grid.sourceHeight || x1 - x0 !== grid.width || y1 - y0 !== grid.height) { throw new Error("人口栅格窗口与源尺寸不一致") }
  if (grid.values.some(value => value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0))) { throw new Error("人口栅格只能含非负数值及明确的 NoData（null）") }
}
export function populationRowArea(grid: PopulationGrid, row: number): number {
  const dy = (grid.bounds.north - grid.bounds.south) / grid.height
  const north = grid.bounds.north - row * dy
  const radians = Math.PI / 180
  const f = 1 / (grid.crs === "EPSG:4490" ? 298.257222101 : 298.257223563)
  const e2 = f * (2 - f); const e = Math.sqrt(e2)
  const integral = (latitude: number) => {
    const s = Math.sin(latitude * radians)
    return s / (2 * (1 - e2 * s * s)) + Math.atanh(e * s) / (2 * e)
  }
  return 6378.137 ** 2 * (1 - e2) * (grid.bounds.east - grid.bounds.west) / grid.width * radians * (integral(north) - integral(north - dy))
}
export function populationDensity(grid: PopulationGrid, index: number): number | null {
  const value = grid.values[index]
  if (value === null) { return null }
  return grid.metric === "people-per-km2" ? value : value / populationRowArea(grid, Math.floor(index / grid.width))
}
export function populationColor(density: number | null): string {
  if (density === null) { return POPULATION_NODATA }
  if (density === 0) { return "#ffffff" }
  const index = POPULATION_BREAKS.findIndex(end => density <= end)
  return POPULATION_COLORS[index < 0 ? POPULATION_BREAKS.length : index]
}
export function populationLegend() {
  return [
    ...POPULATION_COLORS.map((color, i) => {
      if (i === 0) { return { color, label: ">0–20 人/km²" } }
      if (i === POPULATION_BREAKS.length) { return { color, label: ">20,000 人/km²" } }
      return { color, label: `>${POPULATION_BREAKS[i - 1].toLocaleString("en-US")}–${POPULATION_BREAKS[i].toLocaleString("en-US")} 人/km²` }
    }).reverse(),
    { label: "0 人/km²", color: "#ffffff" },
    { label: "NoData（缺测，非零人口）", color: POPULATION_NODATA }
  ]
}
export function populationSummary(grid: PopulationGrid, bounds: PopulationBounds = grid.bounds) {
  let total = 0; let areaKm2 = 0; let missing = 0; let valid = 0; let zero = 0
  const dx = (grid.bounds.east - grid.bounds.west) / grid.width
  const dy = (grid.bounds.north - grid.bounds.south) / grid.height
  for (let row = 0; row < grid.height; row++) {
    const lat = grid.bounds.north - (row + 0.5) * dy
    if (lat < bounds.south || lat > bounds.north) { continue }
    const km2 = populationRowArea(grid, row)
    for (let col = 0; col < grid.width; col++) {
      const lon = grid.bounds.west + (col + 0.5) * dx
      if (lon < bounds.west || lon > bounds.east) { continue }
      const value = grid.values[row * grid.width + col]
      if (value === null) { missing++; continue }
      valid++; if (!value) { zero++ }
      areaKm2 += km2; total += grid.metric === "people-per-cell" ? value : value * km2
    }
  }
  return { total: valid ? total : null, density: valid && areaKm2 ? total / areaKm2 : null, areaKm2, valid, missing, zero }
}
