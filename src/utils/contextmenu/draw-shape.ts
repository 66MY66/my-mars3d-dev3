export type LngLat = { lng: number; lat: number }

export type ShapeBaseline = {
  a: LngLat
  b: LngLat
  scaleLng: number
  scaleLat: number
  perpX: number
  perpY: number
  length: number
}

const MIN_BASELINE_METERS = 1
export const MIN_PULL_METERS = 5

export function createShapeBaseline(a: LngLat, b: LngLat): ShapeBaseline | null {
  const scaleLat = 110540
  const scaleLng = 111320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  const x = (b.lng - a.lng) * scaleLng
  const y = (b.lat - a.lat) * scaleLat
  const length = Math.hypot(x, y)
  if (!Number.isFinite(length) || length < MIN_BASELINE_METERS || scaleLng === 0) {
    return null
  }
  return { a, b, scaleLng, scaleLat, perpX: -y / length, perpY: x / length, length }
}

export function signedOffsetMeters(baseline: ShapeBaseline, point: LngLat): number {
  const x = (point.lng - baseline.a.lng) * baseline.scaleLng
  const y = (point.lat - baseline.a.lat) * baseline.scaleLat
  return x * baseline.perpX + y * baseline.perpY
}

export function baselineParameter(baseline: ShapeBaseline, point: LngLat): number {
  const x = (point.lng - baseline.a.lng) * baseline.scaleLng
  const y = (point.lat - baseline.a.lat) * baseline.scaleLat
  return (x * baseline.perpY - y * baseline.perpX) / baseline.length
}

export function pointOnBaseline(baseline: ShapeBaseline, t: number): LngLat {
  const clamped = Math.min(1, Math.max(0, t))
  const alongX = baseline.perpY
  const alongY = -baseline.perpX
  const meters = clamped * baseline.length
  return {
    lng: baseline.a.lng + (alongX * meters) / baseline.scaleLng,
    lat: baseline.a.lat + (alongY * meters) / baseline.scaleLat
  }
}

export function acceptPulledPoint(baseline: ShapeBaseline, existing: LngLat[], candidate: LngLat): { ok: true; point: LngLat } | { ok: false; reason: string } {
  const side = signedOffsetMeters(baseline, candidate)
  if (!Number.isFinite(side) || Math.abs(side) < MIN_PULL_METERS) {
    return { ok: false, reason: "请把点拉到线的一侧，不能停在线上" }
  }
  if (existing.length >= 2) {
    return { ok: false, reason: "两侧都已拉出，双击完成绘制" }
  }
  if (existing.length === 1 && Math.sign(signedOffsetMeters(baseline, existing[0])) === Math.sign(side)) {
    return { ok: false, reason: "第二个点请拉到线的另一侧" }
  }
  return { ok: true, point: candidate }
}

/** 一个拉出点构成三角形；两侧各一个点构成四边形。底边端点保留，拉出点不与底边共线。 */
export function shapeVertices(baseline: ShapeBaseline, pulls: LngLat[]): LngLat[] {
  if (pulls.length === 1) {
    return [baseline.a, pulls[0], baseline.b]
  }
  return [baseline.a, pulls[0], baseline.b, pulls[1]]
}
