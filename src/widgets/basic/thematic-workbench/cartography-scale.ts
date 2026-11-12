import type { DbtBounds } from "./dbt116-standard"

export function cartographyScale(bounds: DbtBounds, crs: string, mapWidth = 1076, maximumWidth = 240) {
  if (!["EPSG:4326", "EPSG:4490", "EPSG:4024"].includes(crs)) { return null }
  const latitude = (bounds.north + bounds.south) / 2
  const phi = latitude * Math.PI / 180
  let inverseFlattening = crs === "EPSG:4490" ? 298.257222101 : 298.257223563
  if (crs === "EPSG:4024") { inverseFlattening = 298.3 }
  const f = 1 / inverseFlattening
  const semiMajorKm = crs === "EPSG:4024" ? 6378.245 : 6378.137
  const parallelKm = semiMajorKm / Math.sqrt(1 - f * (2 - f) * Math.sin(phi) ** 2) * Math.cos(phi) * (bounds.east - bounds.west) * Math.PI / 180
  if (!(parallelKm > 0) || !(mapWidth > 0)) { return null }
  const candidates = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000]
  const stepKm = candidates.filter(step => step * 2 / parallelKm * mapWidth <= maximumWidth).at(-1)
  if (stepKm) { return { latitude, stepKm, segments: 2, width: stepKm * 2 / parallelKm * mapWidth, parallelKm } }
  return 5 / parallelKm * mapWidth <= maximumWidth ? { latitude, stepKm: 5, segments: 1, width: 5 / parallelKm * mapWidth, parallelKm } : null
}
