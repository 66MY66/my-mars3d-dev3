export type StatsLonLat = [number, number]
export type StatsLonLatRing = StatsLonLat[]

export type StatsAnalysisCell = {
  id: string
  west: number
  south: number
  east: number
  north: number
  center: { lng: number; lat: number }
}

export type StatsBoundaryEdge = [StatsLonLat, StatsLonLat]

export type StatsAnalysisRegion = {
  hash: string
  sourceRing: StatsLonLatRing
  cells: StatsAnalysisCell[]
  outlines: StatsLonLatRing[]
  boundaryEdges: StatsBoundaryEdge[]
  bbox: [number, number, number, number]
}

export type StatsAnalysisRegionOptions = {
  targetCells?: number
  maxCells?: number
  edgeCoverageThreshold?: number
}

export type StatsColumnAnchor = {
  id: string
  cellId: string
  lng: number
  lat: number
  footprintMeters: number
}

const EPSILON = 1e-10
const STATS_ELEVATION_PALETTE: Array<[number, number, number]> = [
  [43, 54, 111],
  [87, 67, 143],
  [139, 78, 157],
  [190, 91, 166],
  [226, 125, 177],
  [247, 184, 207]
]

export type StatsElevationDomain = { min: number; max: number }

export function getStatsElevationDomain(heights: number[]): StatsElevationDomain {
  const finite = heights.map(Number).filter(Number.isFinite)
  if (!finite.length) {
    return { min: 0, max: 0 }
  }
  return { min: Math.min(...finite), max: Math.max(...finite) }
}

export function mapStatsElevationColor(height: number, domain: StatsElevationDomain): [number, number, number, number] {
  const span = domain.max - domain.min
  const normalized = span > EPSILON
    ? Math.max(0, Math.min(1, (Number(height) - domain.min) / span))
    : 0.5
  const scaled = normalized * (STATS_ELEVATION_PALETTE.length - 1)
  const lowerIndex = Math.floor(scaled)
  const upperIndex = Math.min(STATS_ELEVATION_PALETTE.length - 1, lowerIndex + 1)
  const mix = scaled - lowerIndex
  const lower = STATS_ELEVATION_PALETTE[lowerIndex]
  const upper = STATS_ELEVATION_PALETTE[upperIndex]
  return [
    Math.round(lower[0] + (upper[0] - lower[0]) * mix),
    Math.round(lower[1] + (upper[1] - lower[1]) * mix),
    Math.round(lower[2] + (upper[2] - lower[2]) * mix),
    232
  ]
}

function pointsEqual(a: StatsLonLat, b: StatsLonLat) {
  return Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON
}

function signedArea(ring: StatsLonLatRing) {
  let area = 0
  for (let i = 0; i < ring.length; i++) {
    const current = ring[i]
    const next = ring[(i + 1) % ring.length]
    area += current[0] * next[1] - next[0] * current[1]
  }
  return area / 2
}

function normalizeRing(ring: StatsLonLatRing): StatsLonLatRing {
  const cleaned = ring
    .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map(([lng, lat]) => [Number(lng), Number(lat)] as StatsLonLat)
  if (cleaned.length > 1 && pointsEqual(cleaned[0], cleaned[cleaned.length - 1])) {
    cleaned.pop()
  }
  if (cleaned.length < 3) {
    return []
  }
  if (signedArea(cleaned) < 0) {
    cleaned.reverse()
  }
  let start = 0
  for (let i = 1; i < cleaned.length; i++) {
    if (cleaned[i][0] < cleaned[start][0] || (cleaned[i][0] === cleaned[start][0] && cleaned[i][1] < cleaned[start][1])) {
      start = i
    }
  }
  return [...cleaned.slice(start), ...cleaned.slice(0, start)]
}

function pointInRing(point: { lng: number; lat: number }, ring: StatsLonLatRing) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > point.lat) !== (yj > point.lat) && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + Number.EPSILON) + xi) {
      inside = !inside
    }
  }
  return inside
}

function pointInOrOnRing(point: { lng: number; lat: number }, ring: StatsLonLatRing) {
  const onBoundary = ring.some((current, index) => {
    const next = ring[(index + 1) % ring.length]
    const cross = (point.lat - current[1]) * (next[0] - current[0]) - (point.lng - current[0]) * (next[1] - current[1])
    if (Math.abs(cross) > EPSILON) {
      return false
    }
    return point.lng >= Math.min(current[0], next[0]) - EPSILON &&
      point.lng <= Math.max(current[0], next[0]) + EPSILON &&
      point.lat >= Math.min(current[1], next[1]) - EPSILON &&
      point.lat <= Math.max(current[1], next[1]) + EPSILON
  })
  return onBoundary || pointInRing(point, ring)
}

function getBbox(ring: StatsLonLatRing): [number, number, number, number] {
  const lngs = ring.map((point) => point[0])
  const lats = ring.map((point) => point[1])
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

function hashText(text: string) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function cellCoverage(west: number, south: number, east: number, north: number, ring: StatsLonLatRing) {
  let hits = 0
  const samples = 5
  for (let row = 0; row < samples; row++) {
    for (let col = 0; col < samples; col++) {
      const lng = west + ((col + 0.5) / samples) * (east - west)
      const lat = south + ((row + 0.5) / samples) * (north - south)
      if (pointInRing({ lng, lat }, ring)) {
        hits += 1
      }
    }
  }
  return hits / (samples * samples)
}

export function buildStatsAnalysisRegion(
  inputRing: StatsLonLatRing,
  options: StatsAnalysisRegionOptions = {}
): StatsAnalysisRegion | null {
  const sourceRing = normalizeRing(inputRing)
  if (sourceRing.length < 3) {
    return null
  }
  const bbox = getBbox(sourceRing)
  const width = bbox[2] - bbox[0]
  const height = bbox[3] - bbox[1]
  if (width <= 0 || height <= 0) {
    return null
  }
  const targetCells = Math.max(16, Math.floor(options.targetCells || 196))
  const maxCells = Math.max(targetCells, Math.floor(options.maxCells || 1000))
  const aspect = Math.max(0.2, Math.min(5, width / height))
  let cols = Math.max(2, Math.round(Math.sqrt(targetCells * aspect)))
  let rows = Math.max(2, Math.round(targetCells / cols))
  while (cols * rows > maxCells) {
    if (cols >= rows) {
      cols -= 1
    } else {
      rows -= 1
    }
  }
  const cellWidth = width / cols
  const cellHeight = height / rows
  const threshold = Math.max(0.1, Math.min(0.9, options.edgeCoverageThreshold ?? 0.36))
  const cells: StatsAnalysisCell[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const west = bbox[0] + col * cellWidth
      const south = bbox[1] + row * cellHeight
      const east = west + cellWidth
      const north = south + cellHeight
      const center = { lng: (west + east) / 2, lat: (south + north) / 2 }
      const coverage = cellCoverage(west, south, east, north, sourceRing)
      if (coverage < threshold && !pointInRing(center, sourceRing)) {
        continue
      }
      cells.push({ id: `${row}:${col}`, west, south, east, north, center })
    }
  }
  if (!cells.length) {
    return null
  }
  const serialized = sourceRing.map(([lng, lat]) => `${lng.toFixed(8)},${lat.toFixed(8)}`).join("|")
  const hash = hashText(serialized)
  const boundaryEdges = sourceRing.map((point, index) => [point, sourceRing[(index + 1) % sourceRing.length]] as StatsBoundaryEdge)
  const outlines = [sourceRing]
  return { hash, sourceRing, cells, outlines, boundaryEdges, bbox }
}

function footprintCorners(anchor: { lng: number; lat: number }, sideMeters: number): StatsLonLatRing {
  const metersPerDegreeLat = 111_320
  const metersPerDegreeLng = Math.max(1, metersPerDegreeLat * Math.cos((anchor.lat * Math.PI) / 180))
  const halfLng = sideMeters / 2 / metersPerDegreeLng
  const halfLat = sideMeters / 2 / metersPerDegreeLat
  return [
    [anchor.lng - halfLng, anchor.lat - halfLat],
    [anchor.lng + halfLng, anchor.lat - halfLat],
    [anchor.lng + halfLng, anchor.lat + halfLat],
    [anchor.lng - halfLng, anchor.lat + halfLat]
  ]
}

export function isFootprintInsideRegion(
  anchor: { lng: number; lat: number },
  sideMeters: number,
  outlines: StatsLonLatRing[]
) {
  if (!(sideMeters > 0) || !outlines.length) {
    return false
  }
  const corners = footprintCorners(anchor, sideMeters)
  return corners.every(([lng, lat]) => outlines.some((outline) => pointInOrOnRing({ lng, lat }, outline)))
}

export function buildStatsColumnAnchors(
  region: StatsAnalysisRegion,
  count: number,
  footprintMeters: number
): StatsColumnAnchor[] {
  if (!region || count <= 0 || footprintMeters <= 0) {
    return []
  }
  const candidates = [...region.cells]
    .filter((cell) => isFootprintInsideRegion(cell.center, footprintMeters, region.outlines))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  const selected: StatsColumnAnchor[] = []
  const latScale = 111_320
  for (const cell of candidates) {
    if (selected.length >= Math.floor(count)) {
      break
    }
    const lngScale = Math.max(1, latScale * Math.cos((cell.center.lat * Math.PI) / 180))
    const collides = selected.some((anchor) => {
      const dx = (anchor.lng - cell.center.lng) * lngScale
      const dy = (anchor.lat - cell.center.lat) * latScale
      return Math.hypot(dx, dy) + 1e-6 < footprintMeters
    })
    if (!collides) {
      selected.push({
        id: `${region.hash}:${cell.id}`,
        cellId: cell.id,
        lng: cell.center.lng,
        lat: cell.center.lat,
        footprintMeters
      })
    }
  }
  return selected
}

export function assignStatsRowsToAnchors(rowKeys: string[], anchors: StatsColumnAnchor[]) {
  const assignments = new Map<string, StatsColumnAnchor>()
  const keys = Array.from(new Set(rowKeys.map((key) => String(key)))).sort((a, b) => a.localeCompare(b, "zh-CN"))
  keys.slice(0, anchors.length).forEach((key, index) => assignments.set(key, anchors[index]))
  return assignments
}
