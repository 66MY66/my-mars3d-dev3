import axios from "axios"
import { area as turfArea, buffer as turfBuffer, difference as turfDifference, featureCollection, lineString, point, polygon } from "@turf/turf"
import { computeAreaM2, computePerimeterM, type RingLonLat } from "@/utils/disaster-metrics"
import { pointInRing } from "@/utils/region-hit"

export type PolygonAnalysisTarget = { type: "polygon"; ring: RingLonLat; source?: string; sourceId?: string }

export type AnalysisTarget =
  | { type: "point"; coordinates: [number, number]; source?: string; sourceId?: string }
  | { type: "polyline"; coordinates: RingLonLat; source?: string; sourceId?: string }
  | PolygonAnalysisTarget

export type BufferRequest = {
  target: AnalysisTarget
  mode?: "single" | "multi"
  radiusKm?: number
  coreKm?: number
  transitionKm?: number
  edgeKm?: number
  opacity?: number
  radiusM?: number
  distancesM?: number[]
  enabledRingIndexes?: number[]
  smooth?: number
}

export type OverlayRequest = {
  target: PolygonAnalysisTarget
  targetLayer: "mock-admin" | "mock-hazard-area"
  operation: "intersect" | "union" | "difference"
}

export type NeighborRequest = {
  target: PolygonAnalysisTarget
  dataset: "hazard-point"
  radiusM: number
  limit: number
  render?: "heat+point" | "heat" | "point"
  heatRadius?: number
}

export type AnalysisResult = {
  geojson: any
  summary: Record<string, any>
}

function joinUrl(base: string, path: string) {
  const b = base.endsWith("/") ? base : `${base}/`
  const p = path.startsWith("/") ? path.slice(1) : path
  return `${b}${p}`
}

function isMockEnabled() {
  const apiLocal = String((process.env.API_LOCAL as any) ?? "")
  return apiLocal === "1"
}

function clampNumber(n: any, fallback = 0) {
  const v = Number(n)
  return Number.isFinite(v) ? v : fallback
}

function bboxOfRing(ring: RingLonLat) {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  ring.forEach(([lng, lat]) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return
    }
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  })
  if (!Number.isFinite(minLng)) {
    return { minLng: 0, minLat: 0, maxLng: 0, maxLat: 0 }
  }
  return { minLng, minLat, maxLng, maxLat }
}

function metersToDegLat(m: number) {
  return m / 111_320
}

function metersToDegLng(m: number, latDeg: number) {
  const lat = (latDeg * Math.PI) / 180
  return m / (111_320 * Math.max(0.1, Math.cos(lat)))
}

function centroidOfRing(ring: RingLonLat) {
  let sumLng = 0
  let sumLat = 0
  let cnt = 0
  ring.forEach(([lng, lat]) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return
    }
    sumLng += lng
    sumLat += lat
    cnt++
  })
  if (cnt === 0) {
    return { lng: 0, lat: 0 }
  }
  return { lng: sumLng / cnt, lat: sumLat / cnt }
}

function circleRing(center: { lng: number; lat: number }, radiusM: number, steps = 64): RingLonLat {
  const dLat = metersToDegLat(radiusM)
  const dLng = metersToDegLng(radiusM, center.lat)
  const out: RingLonLat = []
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const lng = center.lng + Math.cos(a) * dLng
    const lat = center.lat + Math.sin(a) * dLat
    out.push([lng, lat])
  }
  return out
}

function reverseRing(ring: RingLonLat): RingLonLat {
  return [...ring].reverse()
}

function bboxPolygonRing(b: { minLng: number; minLat: number; maxLng: number; maxLat: number }): RingLonLat {
  return [
    [b.minLng, b.minLat],
    [b.maxLng, b.minLat],
    [b.maxLng, b.maxLat],
    [b.minLng, b.maxLat]
  ]
}

function normalizeRadiusM(radiusM: any) {
  return Math.max(0, clampNumber(radiusM, 0))
}

function makePolygonFeature(rings: RingLonLat | RingLonLat[], props: Record<string, any> = {}) {
  const coordinates = Array.isArray((rings as any)?.[0]?.[0]) ? (rings as RingLonLat[]) : ([rings] as RingLonLat[])
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates },
    properties: props
  }
}

function makeFeatureCollection(features: any[]) {
  return { type: "FeatureCollection", features }
}

function intersectBbox(a: any, b: any) {
  const minLng = Math.max(a.minLng, b.minLng)
  const minLat = Math.max(a.minLat, b.minLat)
  const maxLng = Math.min(a.maxLng, b.maxLng)
  const maxLat = Math.min(a.maxLat, b.maxLat)
  if (minLng >= maxLng || minLat >= maxLat) {
    return null
  }
  return { minLng, minLat, maxLng, maxLat }
}

function unionBbox(a: any, b: any) {
  return {
    minLng: Math.min(a.minLng, b.minLng),
    minLat: Math.min(a.minLat, b.minLat),
    maxLng: Math.max(a.maxLng, b.maxLng),
    maxLat: Math.max(a.maxLat, b.maxLat)
  }
}

function differenceBbox(a: any, b: any) {
  const inter = intersectBbox(a, b)
  if (!inter) {
    return a
  }
  return {
    minLng: a.minLng,
    minLat: a.minLat,
    maxLng: inter.minLng,
    maxLat: a.maxLat
  }
}

function randomInRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function mockHazardPointsInPolygon(ring: RingLonLat, limit: number) {
  const b = bboxOfRing(ring)
  const points: any[] = []
  let guard = 0
  while (points.length < limit && guard < limit * 50) {
    guard++
    const lng = randomInRange(b.minLng, b.maxLng)
    const lat = randomInRange(b.minLat, b.maxLat)
    if (!pointInRing({ lng, lat }, ring)) {
      continue
    }
    const level = 1 + Math.floor(Math.random() * 3)
    let value = 0.33
    if (level === 2) {
      value = 0.66
    } else if (level === 3) {
      value = 1.0
    }
    points.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: { dataset: "hazard-point", level, value, name: `隐患点${points.length + 1}` }
    })
  }
  return points
}

export async function runBufferAnalysis(req: BufferRequest): Promise<AnalysisResult> {
  if (!isMockEnabled()) {
    const base = (process.env.API_BASE as string) || "/v1/"
    const url = joinUrl(base, "analysis/buffer")
    const res = await axios.post(url, req, { timeout: 60_000 })
    return res.data as AnalysisResult
  }

  const smooth = Math.max(8, Math.min(128, Math.round(clampNumber(req.smooth, 64))))
  const mode = req.mode === "single" ? "single" : "multi"
  const opacity = Math.max(0.05, Math.min(0.95, clampNumber(req.opacity, 70) / 100))
  const sourceFeature = (() => {
    if (req.target.type === "point") {
      return point(req.target.coordinates)
    }
    if (req.target.type === "polyline") {
      return lineString(req.target.coordinates)
    }
    const ring = [...req.target.ring]
    if (ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
      ring.push([...ring[0]] as [number, number])
    }
    return polygon([ring])
  })()
  const makeBufferedFeature = (distanceM: number, properties: Record<string, any>) => {
    const feature = turfBuffer(sourceFeature, distanceM, { units: "meters", steps: Math.max(8, Math.round(smooth / 4)) })
    if (!feature) {
      throw new Error("无法生成缓冲区，请检查目标几何")
    }
    feature.properties = { ...feature.properties, ...properties }
    return feature
  }

  if (mode === "single") {
    const radiusM = Math.max(0, clampNumber(req.radiusM, clampNumber(req.radiusKm, 50) * 1000))
    const feature = makeBufferedFeature(radiusM, { analysis: "buffer", mode, radiusM, distanceM: radiusM, opacity })
    const areaM2 = turfArea(feature)
    return {
      geojson: featureCollection([feature]),
      summary: {
        mode,
        sourceType: req.target.type,
        radiusM,
        radiusKm: radiusM / 1000,
        areaM2,
        totalAreaM2: areaM2,
        ringStats: [{ level: "core", distanceM: radiusM, rangeM: [0, radiusM], areaM2 }]
      }
    }
  }

  const fallbackDistances = [req.coreKm, req.transitionKm, req.edgeKm]
    .map((value, index) => Math.max(0, clampNumber(value, [50, 100, 150][index]) * 1000))
  const distancesM = [...new Set((req.distancesM?.length ? req.distancesM : fallbackDistances)
    .map((value) => Math.max(0, Number(value) || 0))
    .filter((value) => value > 0))].sort((a, b) => a - b)
  const enabled = new Set(Array.isArray(req.enabledRingIndexes) ? req.enabledRingIndexes : distancesM.map((_, index) => index))
  const levelNames = ["core", "transition", "edge"]
  const selected = distancesM.map((distanceM, index) => ({ distanceM, index })).filter(({ index }) => enabled.has(index))
  const selectedBuffers = selected.map(({ distanceM }) => makeBufferedFeature(distanceM, {}))
  const zones = selected.map(({ distanceM, index }, selectedIndex) => {
    const outer = selectedBuffers[selectedIndex]
    const zone = selectedIndex === 0 ? outer : turfDifference(featureCollection([outer, selectedBuffers[selectedIndex - 1]])) || outer
    zone.properties = {
      analysis: "buffer",
      mode,
      level: levelNames[Math.min(index, levelNames.length - 1)],
      distanceM,
      rangeM: [selectedIndex === 0 ? 0 : selected[selectedIndex - 1].distanceM, distanceM],
      opacity
    }
    return zone
  })
  const totalAreaM2 = selectedBuffers.length ? turfArea(selectedBuffers[selectedBuffers.length - 1]) : 0
  const ringStats = selected.map(({ distanceM, index }, selectedIndex) => ({
    level: levelNames[Math.min(index, levelNames.length - 1)],
    distanceM,
    rangeM: [selectedIndex === 0 ? 0 : selected[selectedIndex - 1].distanceM, distanceM],
    areaM2: turfArea(zones[selectedIndex])
  }))
  const features = [...zones].reverse()
  return {
    geojson: featureCollection(features),
    summary: { mode, sourceType: req.target.type, distancesM: selected.map(({ distanceM }) => distanceM), ringStats, opacity, totalAreaM2 }
  }
}

export async function runOverlayAnalysis(req: OverlayRequest): Promise<AnalysisResult> {
  if (!isMockEnabled()) {
    const base = (process.env.API_BASE as string) || "/v1/"
    const url = joinUrl(base, "analysis/overlay")
    const res = await axios.post(url, req, { timeout: 60_000 })
    return res.data as AnalysisResult
  }

  const a = bboxOfRing(req.target.ring)
  const c = centroidOfRing(req.target.ring)
  const shiftLng = (a.maxLng - a.minLng) * 0.25
  const shiftLat = (a.maxLat - a.minLat) * 0.25
  const b = req.targetLayer === "mock-admin"
    ? { minLng: c.lng - shiftLng, minLat: c.lat - shiftLat, maxLng: c.lng + shiftLng, maxLat: c.lat + shiftLat }
    : { minLng: c.lng, minLat: c.lat, maxLng: c.lng + shiftLng * 1.4, maxLat: c.lat + shiftLat * 1.2 }

  let r: any = null
  if (req.operation === "intersect") {
    r = intersectBbox(a, b)
  } else if (req.operation === "union") {
    r = unionBbox(a, b)
  } else {
    r = differenceBbox(a, b)
  }

  const features: any[] = [
    makePolygonFeature(bboxPolygonRing(a), { role: "A", analysis: "overlay" }),
    makePolygonFeature(bboxPolygonRing(b), { role: "B", analysis: "overlay", targetLayer: req.targetLayer })
  ]
  if (r && r.maxLng > r.minLng && r.maxLat > r.minLat) {
    const ring = bboxPolygonRing(r)
    const areaM2 = computeAreaM2(ring)
    const perimeterM = computePerimeterM(ring)
    features.push(makePolygonFeature(ring, { role: "Result", operation: req.operation }))
    return { geojson: makeFeatureCollection(features), summary: { operation: req.operation, areaM2, perimeterM } }
  }
  return { geojson: makeFeatureCollection(features), summary: { operation: req.operation, empty: true } }
}

export async function runNeighborAnalysis(req: NeighborRequest): Promise<AnalysisResult> {
  if (!isMockEnabled()) {
    const base = (process.env.API_BASE as string) || "/v1/"
    const url = joinUrl(base, "analysis/neighbor")
    const res = await axios.post(url, req, { timeout: 60_000 })
    return res.data as AnalysisResult
  }

  const radiusM = normalizeRadiusM(req.radiusM)
  const center = centroidOfRing(req.target.ring)
  const neighborRing = circleRing(center, radiusM, 64)
  const points = mockHazardPointsInPolygon(neighborRing, Math.max(1, Math.min(1000, Math.round(req.limit))))
  const areaM2 = computeAreaM2(neighborRing)
  const perimeterM = computePerimeterM(neighborRing)

  const render = req.render || "heat+point"
  const heatRadius = Math.max(5, Math.min(80, Math.round(clampNumber(req.heatRadius, 28))))
  const features = [makePolygonFeature(neighborRing, { analysis: "neighbor", dataset: req.dataset, radiusM, render, heatRadius }), ...points]
  return { geojson: makeFeatureCollection(features), summary: { dataset: req.dataset, radiusM, count: points.length, areaM2, perimeterM, render, heatRadius } }
}
