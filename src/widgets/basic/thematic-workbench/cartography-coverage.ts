import type { DbtBounds, DbtLayer } from "./dbt116-standard"
import { validBounds } from "./dbt-cartography-rules"

export function needsCoverageCheck(layer: DbtLayer): boolean {
  const metadata = (layer.data as { metadata?: Record<string, unknown> }).metadata
  // An event/intensity/fault bbox is a feature envelope, not a promise of continuous coverage.
  if (["event", "intensity", "fault", "target", "geohazard", "history", "aftershock", "distance"].includes(layer.role)) { return false }
  return !!(layer.raster || layer.grid || layer.sourceGrid || metadata?.sourceCoverages || metadata?.coverageModel === "complete-domain")
}

export function coverageGaps(scope: DbtBounds, coverages: DbtBounds[]): DbtBounds[] {
  const valid = coverages.filter(validBounds)
  const xs = [...new Set([scope.west, scope.east, ...valid.flatMap(c => [c.west, c.east]).filter(x => x > scope.west && x < scope.east)])].sort((a, b) => a - b)
  const ys = [...new Set([scope.south, scope.north, ...valid.flatMap(c => [c.south, c.north]).filter(y => y > scope.south && y < scope.north)])].sort((a, b) => a - b)
  const gaps: DbtBounds[] = []
  for (let i = 1; i < xs.length; i++) {
    for (let j = 1; j < ys.length; j++) {
      const west = xs[i - 1]; const east = xs[i]; const south = ys[j - 1]; const north = ys[j]
      const x = (west + east) / 2; const y = (south + north) / 2
      if (!valid.some(c => c.west <= x && c.east >= x && c.south <= y && c.north >= y)) { gaps.push({ west, south, east, north }) }
    }
  }
  return gaps
}

export function layerCoverageGaps(layer: DbtLayer, scope: DbtBounds): DbtBounds[] {
  const metadata = (layer.data as { metadata?: Record<string, unknown> }).metadata
  const parts = metadata?.sourceCoverages
  let coverages = layer.coverage ? [layer.coverage] : []
  if (Array.isArray(parts)) { coverages = parts.filter((value): value is DbtBounds => !!value && typeof value === "object" && validBounds(value as DbtBounds)) }
  return coverages.length ? coverageGaps(scope, coverages) : []
}
