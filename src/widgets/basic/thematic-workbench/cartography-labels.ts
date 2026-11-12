import { geojsonRbush, distance, point, pointOnFeature, bboxPolygon, lineString, booleanIntersects, booleanPointInPolygon } from "@turf/turf"
import type { Feature, Position } from "geojson"
import { dbtFeatureSymbol, intensityLabel, type DbtLayer } from "./dbt116-standard"

export type LabelBox = { x: number; y: number; w: number; h: number; symbol?: boolean }
export type LabelCandidate = { id: string; text: string; x: number; y: number; w: number; h: number; priority: number; radius?: number; generalizable?: boolean; repeatKey?: string; maxOffset?: number }
export type LabelPlacement = LabelCandidate & { box: LabelBox; leader?: [number, number, number, number] }
export type GeographicLabel = { id: string; text: string; position: Position; size: number; bold: boolean; priority: number; radius: number; generalizable?: boolean; repeatKey?: string; maxOffset?: number; color?: string }
export type LabelEventContext = { magnitude: number; longitude: number; latitude: number }

export function cartographyLabel(layer: DbtLayer, feature: Feature, anchor: Position, id: string, event?: LabelEventContext): GeographicLabel | null {
  let text = String(feature.properties?.label || feature.properties?.name || "").trim()
  const basegeo = feature.properties?.cartographySchema === "china-basegeo-250k.gb13923.v1"
  if (basegeo && layer.role === "transport") { text = String(feature.properties?.RN || "").trim() }
  if (basegeo && layer.role === "boundary" && /LineString$/.test(feature.geometry.type)) { return null }
  if (layer.role === "intensity") { text = intensityLabel(Number(feature.properties?.intensity)) }
  if (layer.role === "pga") { text = `${feature.properties?.pga ?? "?"} gₙ · ${feature.properties?.designIntensity ?? "?"}度` }
  if (layer.role === "distance" && feature.geometry.type === "LineString") { const c = feature.geometry.coordinates; text = `${text} ${distance(point(c[0]), point(c[c.length - 1])).toFixed(1)} km` }
  if (["history", "aftershock"].includes(layer.role)) { text = `${feature.properties?.occurredAt || ""} ${feature.properties?.magnitude || "?"}级 ${text}` }
  if (!text) { return null }
  const kind = dbtFeatureSymbol(layer, feature)
  const seats = ["dbt-capital", "dbt-province-seat", "dbt-city-seat", "dbt-county-seat", "dbt-town-seat", "dbt-village"]
  const rank = seats.indexOf(kind || "")
  const primary = ["intensity", "target", "geohazard", "rescue-area", "fault", "capacity", "population", "economy", "building", "pga"].includes(layer.role)
  let size = primary ? 20 : 18
  if (layer.role === "event") { size = 24 }
  if (rank >= 0) { size = [20, 19, 18, 17, 16, 15][rank] }
  let priority = ({ event: 1000, intensity: 900, target: 800, geohazard: 780, "rescue-area": 780, fault: 760, capacity: 740, population: 700, economy: 700, building: 700, pga: 700 } as Record<string, number>)[layer.role] || 300
  if (rank >= 0) { priority = 600 - rank * 50 }
  if (basegeo && layer.role === "boundary") { size = 22; priority = 540 }
  if (basegeo && layer.role === "settlement") { size = 18; priority = 220 }
  if (basegeo && layer.role === "water") { size = 18; priority = 240 }
  if (basegeo && layer.role === "transport") { size = 18; priority = 260 }
  // Draft 9.5 prioritizes thematic features within 50 km for magnitude >= 6.5.
  if (primary && event && event.magnitude >= 6.5 && distance(point(anchor), point([event.longitude, event.latitude])) <= 50) { priority += 80 }
  const color = basegeo ? ({ water: "#4c7f98", transport: "#776852", boundary: "#615967" } as Record<string, string>)[layer.role] || "#657078" : "#20262d"
  return { id, text, position: [...anchor], size, color, bold: ["event", "intensity", "target", "geohazard", "rescue-area"].includes(layer.role) || (basegeo && layer.role === "boundary"), priority, radius: !feature.properties?.annotationOnly && (/Point$/.test(feature.geometry.type) || feature.properties?.thematicMode === "total") ? Math.max(12, Number(feature.properties?.thematicRadius) || 0) : 0, ...(basegeo ? { generalizable: layer.role !== "boundary", repeatKey: `${layer.role === "boundary" || layer.role === "settlement" ? "place" : layer.role}:${text}`, maxOffset: 12 } : {}) }
}
export function layerGeographicLabels(layer: DbtLayer, event?: LabelEventContext) {
  return layer.data.features.flatMap((feature, index) => {
    let anchor = feature.geometry.type === "Point" ? feature.geometry.coordinates : pointOnFeature(feature).geometry.coordinates
    if (Array.isArray(feature.properties?.__labelAnchor)) { anchor = feature.properties.__labelAnchor }
    const label = cartographyLabel(layer, feature, anchor, `${layer.id}:${index}`, event)
    return label ? [label] : []
  })
}
export function placeCartographyLabels(labels: LabelCandidate[], frame: LabelBox, obstacles: LabelBox[] = [], maxOffset = 80, maximumCandidates = 2000) {
  const tree = geojsonRbush()
  const bounds = (r: LabelBox, padding = 2): [number, number, number, number] => [r.x - padding, r.y - padding, r.x + r.w + padding, r.y + r.h + padding]
  const insert = (box: LabelBox, symbol = false, padding = 2) => { const feature = bboxPolygon(bounds(box, padding)); feature.properties = { symbol }; tree.insert(feature) }
  obstacles.forEach(box => insert(box, box.symbol))
  const ordered = [...labels].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  // Reserve every source point symbol before placing any labels, not just symbols already drawn.
  for (const label of ordered) { if (label.radius) { insert({ x: label.x - label.radius, y: label.y - label.radius, w: label.radius * 2, h: label.radius * 2 }, true) } }
  const placed: LabelPlacement[] = []; const skipped: Array<{ id: string; text: string; reason: "outside" | "crowded" | "oversize" | "limit" | "generalized" | "duplicate" }> = []
  const named = new Set<string>(); let baseCount = 0
  const baseBudget = Math.max(4, Math.floor(frame.w * frame.h / 14000))
  let processed = 0
  for (const label of ordered) {
    const { x, y, w, h } = label
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > frame.w - 6 || h > frame.h - 6) { skipped.push({ id: label.id, text: label.text, reason: "oversize" }); continue }
    if (x < frame.x || y < frame.y || x > frame.x + frame.w || y > frame.y + frame.h) { skipped.push({ id: label.id, text: label.text, reason: "outside" }); continue }
    if (label.repeatKey && named.has(label.repeatKey)) { skipped.push({ id: label.id, text: label.text, reason: "duplicate" }); continue }
    if (label.generalizable && baseCount >= baseBudget) { skipped.push({ id: label.id, text: label.text, reason: "generalized" }); continue }
    if (processed++ >= maximumCandidates) { skipped.push({ id: label.id, text: label.text, reason: "limit" }); continue }
    const offsetLimit = label.maxOffset ?? maxOffset
    const offsets = [...new Set([Math.max(6, (label.radius || 0) + 6), 12, 32, 48, offsetLimit])].filter(n => n <= offsetLimit)
    let selected: LabelBox | undefined
    for (const offset of offsets) {
      const candidates = [[offset, -h / 2], [-w - offset, -h / 2], [-w / 2, -h - offset], [-w / 2, offset], [offset, -h - offset], [offset, offset], [-w - offset, -h - offset], [-w - offset, offset]]
      selected = candidates.map(([dx, dy]) => ({ x: x + dx, y: y + dy, w, h })).find(box => {
        if (box.x < frame.x + 3 || box.y < frame.y + 3 || box.x + w > frame.x + frame.w - 3 || box.y + h > frame.y + frame.h - 3) { return false }
        const area = bboxPolygon(bounds(box))
        if (tree.search(area).features.some(feature => booleanIntersects(area, feature))) { return false }
        const edge = [Math.max(box.x, Math.min(x, box.x + w)), Math.max(box.y, Math.min(y, box.y + h))]
        if (Math.hypot(x - edge[0], y - edge[1]) <= 30) { return true }
        const leader = lineString([[x, y], edge])
        return !tree.search(leader).features.some(feature => {
          if (feature.geometry.type === "Polygon" && feature.properties?.symbol && booleanPointInPolygon([x, y], feature.geometry)) { return false }
          return booleanIntersects(leader, feature)
        })
      })
      if (selected) { break }
    }
    if (!selected) { skipped.push({ id: label.id, text: label.text, reason: label.generalizable ? "generalized" : "crowded" }); continue }
    const edgeX = Math.max(selected.x, Math.min(x, selected.x + w)); const edgeY = Math.max(selected.y, Math.min(y, selected.y + h))
    const leader: LabelPlacement["leader"] = Math.hypot(x - edgeX, y - edgeY) > 30 ? [x, y, edgeX, edgeY] : undefined
    insert(selected, false, label.generalizable ? 8 : 3)
    if (leader) { tree.insert(lineString([[leader[0], leader[1]], [leader[2], leader[3]]])) }
    placed.push({ ...label, box: selected, leader })
    if (label.repeatKey) { named.add(label.repeatKey) }
    if (label.generalizable) { baseCount++ }
  }
  return { placed, skipped }
}
