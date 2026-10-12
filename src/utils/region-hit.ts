export type LonLat = { lng: number; lat: number }

export type RegionType = "disaster" | "generic"

export type Region = {
  id: string
  type: RegionType
  ring: Array<[number, number]>
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number }
  updatedAt: number
}

export type RegionIndex = {
  list: Region[]
  version: number
  updatedAt: number
}

export function computeBbox(ring: Array<[number, number]>) {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of ring) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      continue
    }
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  }
  if (!Number.isFinite(minLng)) {
    minLng = 0
    minLat = 0
    maxLng = 0
    maxLat = 0
  }
  return { minLng, minLat, maxLng, maxLat }
}

export function pointInRing(point: LonLat, ring: Array<[number, number]>) {
  const x = point.lng
  const y = point.lat
  if (!Number.isFinite(x) || !Number.isFinite(y) || ring.length < 3) {
    return false
  }

  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]

    const intersect =
      (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) {
      inside = !inside
    }
  }
  return inside
}

export function hitTestRegions(index: RegionIndex, point: LonLat) {
  for (let i = 0; i < index.list.length; i++) {
    const r = index.list[i]
    const b = r.bbox
    if (point.lng < b.minLng || point.lng > b.maxLng || point.lat < b.minLat || point.lat > b.maxLat) {
      continue
    }
    if (pointInRing(point, r.ring)) {
      return r
    }
  }
  return null
}

export function buildRegionIndex(regions: Array<Omit<Region, "bbox">>) {
  const list: Region[] = regions.map((r) => ({ ...r, bbox: computeBbox(r.ring) }))
  list.sort((a, b) => b.updatedAt - a.updatedAt)
  return { list, version: Date.now(), updatedAt: Date.now() } satisfies RegionIndex
}

export function normalizeRing(input: any): Array<[number, number]> {
  if (!Array.isArray(input)) {
    return []
  }
  const out: Array<[number, number]> = []
  for (const p of input) {
    if (!Array.isArray(p) || p.length < 2) {
      continue
    }
    const lng = Number(p[0])
    const lat = Number(p[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      continue
    }
    out.push([lng, lat])
  }
  return out
}
