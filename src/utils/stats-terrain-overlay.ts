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

function pointKey(point: StatsLonLat) {
  return `${point[0].toFixed(10)},${point[1].toFixed(10)}`
}

function edgeKey(a: StatsLonLat, b: StatsLonLat) {
  const ak = pointKey(a)
  const bk = pointKey(b)
  return ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`
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

function buildBoundary(cells: StatsAnalysisCell[]) {
  const edges = new Map<string, StatsBoundaryEdge>()
  const counts = new Map<string, number>()
  cells.forEach((cell) => {
    const sw: StatsLonLat = [cell.west, cell.south]
    const se: StatsLonLat = [cell.east, cell.south]
    const ne: StatsLonLat = [cell.east, cell.north]
    const nw: StatsLonLat = [cell.west, cell.north]
    ;([[sw, se], [se, ne], [ne, nw], [nw, sw]] as StatsBoundaryEdge[]).forEach((edge) => {
      const key = edgeKey(edge[0], edge[1])
      counts.set(key, (counts.get(key) || 0) + 1)
      edges.set(key, edge)
    })
  })
  const boundaryEdges = Array.from(edges.entries()).filter(([key]) => counts.get(key) === 1).map(([, edge]) => edge)
  const remaining = [...boundaryEdges]
  const outlines: StatsLonLatRing[] = []
  while (remaining.length) {
    const first = remaining.shift()!
    const outline: StatsLonLatRing = [first[0], first[1]]
    while (!pointsEqual(outline[outline.length - 1], outline[0])) {
      const current = outline[outline.length - 1]
      const index = remaining.findIndex((edge) => pointsEqual(edge[0], current) || pointsEqual(edge[1], current))
      if (index < 0) {
        break
      }
      const [edge] = remaining.splice(index, 1)
      outline.push(pointsEqual(edge[0], current) ? edge[1] : edge[0])
    }
    if (outline.length >= 4 && pointsEqual(outline[0], outline[outline.length - 1])) {
      outline.pop()
      outlines.push(normalizeRing(outline))
    }
  }
  outlines.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)))
  return { boundaryEdges, outlines }
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
    if (cols >= rows) cols -= 1
    else rows -= 1
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
  const { boundaryEdges, outlines } = buildBoundary(cells)
  if (!outlines.length) {
    return null
  }
  const serialized = sourceRing.map(([lng, lat]) => `${lng.toFixed(8)},${lat.toFixed(8)}`).join("|")
  return { hash: hashText(serialized), sourceRing, cells, outlines, boundaryEdges, bbox }
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
  return corners.every(([lng, lat]) => outlines.some((outline) => pointInRing({ lng, lat }, outline)))
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
