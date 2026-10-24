export const SCALE_PRESETS = [50000, 100000, 250000] as const
export type ScaleDenominator = typeof SCALE_PRESETS[number]
export const SCALE_REQUIRED_MESSAGE = "请选择出图比例尺：1:5 万、1:10 万或 1:25 万"
export const SNAP_DISTANCE = 20
export const SAFE_MARGIN = 24
export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right"
export type AdornmentKey = "title" | "legend" | "scale" | "north" | "time" | "source"
export const ADORNMENT_KEYS: AdornmentKey[] = ["title", "legend", "scale", "north", "time", "source"]
export const ADORNMENT_LABELS: Record<AdornmentKey, string> = { title: "标题", legend: "图例", scale: "比例尺", north: "指北针", time: "时间", source: "来源" }
export const CORNERS: Array<{ value: Corner; label: string }> = [{ value: "top-left", label: "左上" }, { value: "top-right", label: "右上" }, { value: "bottom-left", label: "左下" }, { value: "bottom-right", label: "右下" }]
export type ElementStyle = { font: "sans" | "serif"; fontSize: number; color: string; align: "left" | "center" | "right"; corner: Corner }
export type AdornmentSettings = {
  enabled?: Partial<Record<AdornmentKey | "text" | "image", boolean>>; text?: string; image?: string
  title: string; source: string; time: string; legendTitle: string
  fontSize: number; color: string; align: "left" | "center" | "right"; font: string
  scaleDenominator: ScaleDenominator | null; safeMargin: number; elements: Record<AdornmentKey, ElementStyle>
}
export type AdornmentMetrics = { metersPerPixel: number; selectionWidth: number; northAngle: number }
export type CartographySnapshot = {
  effects?: Record<string, unknown>; renderStyle?: Record<string, unknown>
  version: 1; settings: AdornmentSettings; legend: Array<{ label: string; color: string }>; metrics: AdornmentMetrics | null
  symbols: Array<{ kind: string; family: string; lon: number; lat: number; style: { size: number; rotation: number; opacity: number; color: string } }>
}

export function validScale(value: unknown): value is ScaleDenominator { return SCALE_PRESETS.includes(value as ScaleDenominator) }
export function defaultAdornmentSettings(): AdornmentSettings {
  const positions: Record<AdornmentKey, Corner> = { title: "top-left", legend: "top-right", scale: "bottom-left", north: "top-right", time: "bottom-right", source: "bottom-right" }
  return {
    enabled: { title: true, legend: true, scale: true, north: true, time: true, source: true, text: false, image: false },
text: "",
image: "",
 title: "",
source: "",
time: new Date().toISOString(),
legendTitle: "图例",
fontSize: 18,
color: "#18242e",
align: "center",
font: "sans",
scaleDenominator: null,
safeMargin: SAFE_MARGIN,
    elements: Object.fromEntries(ADORNMENT_KEYS.map(key => [key, { font: "sans", fontSize: key === "title" ? 28 : 18, color: "#18242e", align: "left", corner: positions[key] }])) as Record<AdornmentKey, ElementStyle> 
}
}

export function normalizePreferences(raw: unknown): AdornmentSettings {
  const result = defaultAdornmentSettings()
  if (!raw || typeof raw !== "object") { return result }
  const input = raw as Partial<AdornmentSettings>
  result.scaleDenominator = validScale(input.scaleDenominator) ? input.scaleDenominator : null
  result.safeMargin = Math.max(20, Math.min(80, Number(input.safeMargin) || SAFE_MARGIN))
  for (const key of [...ADORNMENT_KEYS, "text", "image"] as const) { if (typeof input.enabled?.[key] === "boolean") { result.enabled![key] = input.enabled[key] } }
  for (const key of ADORNMENT_KEYS) {
    const item = input.elements?.[key]
    if (!item) { continue }
    result.elements[key] = {
      font: item.font === "serif" ? "serif" : "sans",
fontSize: Math.max(14, Math.min(36, Number(item.fontSize) || 18)),
      color: /^#[\da-f]{6}$/i.test(item.color) ? item.color : "#18242e",
      align: item.align === "right" || item.align === "center" ? item.align : "left",
      corner: CORNERS.some(corner => corner.value === item.corner) ? item.corner : result.elements[key].corner
    }
  }
  return result
}

export type Point2D = { x: number; y: number }
export type Rect2D = Point2D & { w: number; h: number }
function nearestDelta(values: number[], threshold: number) { return values.filter(value => Math.abs(value) <= threshold).sort((a, b) => Math.abs(a) - Math.abs(b))[0] ?? 0 }
export function snapRect(rect: Rect2D, width: number, height: number, targets: Rect2D[], threshold = SNAP_DISTANCE, margin = SAFE_MARGIN): Rect2D {
  const w = Math.min(rect.w, width - margin * 2)
  const h = Math.min(rect.h, height - margin * 2)
  const xs = [margin, width - margin, ...targets.flatMap(item => [item.x, item.x + item.w])]
  const ys = [margin, height - margin, ...targets.flatMap(item => [item.y, item.y + item.h])]
  const x = rect.x + nearestDelta(xs.flatMap(edge => [edge - rect.x, edge - rect.x - w]), threshold)
  const y = rect.y + nearestDelta(ys.flatMap(edge => [edge - rect.y, edge - rect.y - h]), threshold)
  return { x: Math.max(margin, Math.min(width - margin - w, x)), y: Math.max(margin, Math.min(height - margin - h, y)), w, h }
}

export function snapToFeatures(point: Point2D, points: Point2D[], segments: Array<[Point2D, Point2D]>, threshold = SNAP_DISTANCE) {
  let best = point
  let distance = threshold + Number.EPSILON
  const visit = (candidate: Point2D) => {
    const next = Math.hypot(candidate.x - point.x, candidate.y - point.y)
    if (next <= threshold && (best === point || next < distance)) { distance = next; best = candidate }
  }
  points.forEach(visit)
  for (const [a, b] of segments) {
    const dx = b.x - a.x; const dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
    visit({ x: a.x + dx * t, y: a.y + dy * t })
  }
  return { ...best, snapped: best !== point }
}
