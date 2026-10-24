import type { GeoBounds } from "./earthquake-analysis"

export type Quality = "low" | "medium" | "high"
export type QualityMode = "auto" | Quality
export type EffectKind = "columns" | "heat" | "trajectory" | "scan" | "extrusion"
export type DisplayPoint = { lon: number; lat: number; value: number; color: string; label: string; band: string; time?: number; track?: string }
export type DisplayPolygon = { rings: number[][][]; value: number; color: string; label: string; band: string; category?: string }
export type LegendEntry = { label: string; color: string }
export type EffectSettings = {
  enabled: boolean; quality: QualityMode; effects: EffectKind[]; opacity: number
  lighting: boolean; shadows: boolean; blend: "overlay" | "replace"
  height: number; labels: boolean; speed: number; density: number; tail: number
}

export const QUALITY_LABELS: Record<Quality, string> = { low: "低", medium: "中", high: "高" }
export const QUALITY_PRESETS = {
  low: { resolution: 0.65, segments: 6, particles: 24, shadows: false },
  medium: { resolution: 0.85, segments: 12, particles: 60, shadows: false },
  high: { resolution: 1, segments: 20, particles: 120, shadows: true }
} as const

export function defaultEffectSettings(): EffectSettings {
  return { enabled: false, quality: "auto", effects: ["columns"], opacity: 0.85, lighting: true, shadows: false, blend: "overlay", height: 1, labels: false, speed: 1, density: 40, tail: 0.2 }
}

export function initialQuality(pixels: number, effects: number): Quality {
  return pixels >= 7_000_000 || effects >= 3 ? "medium" : "high"
}

// Three consecutive measured low-FPS windows trigger one step; no automatic upgrade oscillation.
export function evaluateQuality(current: Quality, fps: number, slowWindows: number, valid = true) {
  if (!valid || !Number.isFinite(fps)) { return { quality: current, slowWindows: 0, changed: false } }
  const count = fps < 25 ? slowWindows + 1 : 0
  if (count < 3 || current === "low") { return { quality: current, slowWindows: count, changed: false } }
  return { quality: (current === "high" ? "medium" : "low") as Quality, slowWindows: 0, changed: true }
}

export function inBounds(point: { lon: number; lat: number }, bounds: GeoBounds) {
  return Number.isFinite(point.lon) && Number.isFinite(point.lat) && point.lon >= bounds.west && point.lon <= bounds.east && point.lat >= bounds.south && point.lat <= bounds.north
}

export function orderedTracks(points: DisplayPoint[]) {
  const groups = new Map<string, DisplayPoint[]>()
  for (const point of points) {
    if (!Number.isFinite(point.time)) { continue }
    const key = point.track || "default"
    const group = groups.get(key) || []
    group.push(point)
    groups.set(key, group)
  }
  return Array.from(groups.values()).map((group) => group.sort((a, b) => a.time! - b.time!))
    .filter((group) => group.length > 1 && group.some((point) => point.time !== group[0].time))
}

export function uniqueLegend(points: DisplayPoint[]): LegendEntry[] {
  const entries = new Map<string, string>()
  for (const point of points) { entries.set(point.band, point.color) }
  return Array.from(entries, ([label, color]) => ({ label, color }))
}

export function scanTargets(points: DisplayPoint[]) {
  const finite = points.filter(point => Number.isFinite(point.value))
  const bands = new Set(finite.map(point => point.band))
  if (["热异常", "背景范围", "偏冷"].some(band => bands.has(band))) { return finite.filter(point => point.band === "热异常") }
  if (["常规", "关注", "优先核查"].some(band => bands.has(band))) { return finite.filter(point => point.band === "优先核查") }
  if (["LOS 正向", "LOS 负向", "低于阈值"].some(band => bands.has(band))) { return finite.filter(point => point.band === "LOS 正向" || point.band === "LOS 负向") }
  const maximum = Math.max(0, ...finite.map(point => Math.abs(point.value)))
  return finite.filter(point => maximum > 0 && Math.abs(point.value) >= maximum * 0.8)
}

export function niceScale(metersPerPixel: number, maxPixels = 140) {
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) { return null }
  const raw = metersPerPixel * maxPixels
  const power = 10 ** Math.floor(Math.log10(raw))
  const meters = ([5, 2, 1].find((step) => step * power <= raw) || 1) * power
  return { meters, pixels: meters / metersPerPixel, label: meters >= 1000 ? `${meters / 1000} km` : `${meters} m` }
}
