import { snapRect, type Rect2D } from "./cartography-layout"
import { cartographySymbolDefinitions, type CartographySymbolKind } from "./template-icon-registry"
import { STANDARD_SHEET, STANDARD_SLOTS, standardChartSlots } from "./cartography-standard-layout"

export const PAGE = STANDARD_SHEET
export type CompositionKind = "map" | "title" | "legend" | "scale" | "north" | "time" | "source" | "text" | "chart" | "symbol" | "image" | "description" | "agency"
export type CompositionRaster = { image: string; label: string; detail: string; legend: Array<{ label: string; color: string }>; width?: number; height?: number }
export type CompositionItem = Rect2D & {
  id: string; kind: CompositionKind; label: string; text: string; chartType?: string
  fontSize: number; color: string; align: "left" | "center" | "right"; font: "sans" | "serif"; positioned?: boolean
  rotation: number; background: "transparent" | "white" | "dark"; linkedId?: string
  symbolKind?: CartographySymbolKind; opacity?: number
  raster?: CompositionRaster
  frameColor?: string; ruleColor?: string; legendFlow?: "rows" | "columns"; templateKind?: string
  standardPart?: string
  hidden?: boolean
  safeMargin?: number
}

export function compositionMargin(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(20, Math.min(80, value)) : PAGE.margin
}

export function normalizeRotation(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? ((number % 360) + 360) % 360 : 0
}
export function rotationBounds(rect: Rect2D, rotation: number): Rect2D {
  const radians = normalizeRotation(rotation) * Math.PI / 180
  const cos = Math.abs(Math.cos(radians)); const sin = Math.abs(Math.sin(radians))
  const w = rect.w * cos + rect.h * sin; const h = rect.w * sin + rect.h * cos
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h }
}
export function constrainItem(rect: Rect2D & { rotation?: number; kind?: CompositionKind }, targets: Rect2D[] = [], snap = false, margin = PAGE.margin): Rect2D {
  margin = compositionMargin(margin)
  const minW = rect.kind === "symbol" ? 22 : 80; const minH = rect.kind === "symbol" ? 22 : 44
  const safe = { x: Number(rect.x) || 0, y: Number(rect.y) || 0, w: Math.max(minW, Number(rect.w) || minW), h: Math.max(minH, Number(rect.h) || minH) }
  if (normalizeRotation(rect.rotation)) {
    const bounds = rotationBounds(safe, rect.rotation!)
    const scale = Math.min(1, (PAGE.width - margin * 2) / bounds.w, (PAGE.height - margin * 2) / bounds.h)
    const scaled = { ...safe, w: safe.w * scale, h: safe.h * scale }
    const rotated = rotationBounds(scaled, rect.rotation!)
    const snapped = snapRect(rotated, PAGE.width, PAGE.height, targets, snap ? 20 : 0, margin)
    return { ...scaled, x: Math.abs(snapped.x - rotated.x) < 1e-9 ? scaled.x : scaled.x + snapped.x - rotated.x, y: Math.abs(snapped.y - rotated.y) < 1e-9 ? scaled.y : scaled.y + snapped.y - rotated.y }
  }
  return snapRect(safe, PAGE.width, PAGE.height, targets, snap ? 20 : 0, margin)
}

export function containImage(rect: Rect2D, width: number, height: number): Rect2D {
  const ratio = Math.min(rect.w / Math.max(1, width), rect.h / Math.max(1, height))
  const w = width * ratio; const h = height * ratio
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h }
}

export function createCompositionItem(kind: CompositionKind, text = "", chartType?: string): CompositionItem {
  const layouts: Record<CompositionKind, Rect2D> = {
    description: STANDARD_SLOTS.description,
    agency: STANDARD_SLOTS.agency,
    map: STANDARD_SLOTS.map,
title: { x: 40, y: 40, w: 1520, h: 64 },
    legend: { x: 1200, y: 120, w: 360, h: 210 },
north: { x: 1060, y: 140, w: 100, h: 120 },
    scale: { x: 60, y: 890, w: 280, h: 70 },
time: { x: 40, y: 988, w: 600, h: 60 },
    source: { x: 650, y: 988, w: 910, h: 60 },
text: { x: 60, y: 800, w: 420, h: 72 },
    chart: { x: 1200, y: 350, w: 360, h: 290 },
    symbol: { x: 562, y: 502, w: 96, h: 96 },
    image: { x: 820, y: 650, w: 340, h: 240 }
  }
  const labels: Record<CompositionKind, string> = { map: "主图", title: "标题", legend: "图例", north: "指北针", scale: "比例尺", time: "时间", source: "来源", text: "文本", chart: "图表", symbol: "图标", image: "副图", description: "内容说明", agency: "制图单位" }
  return { id: `${kind}-${crypto.randomUUID()}`, kind, label: labels[kind], text, chartType, ...(STANDARD_SLOTS[kind as keyof typeof STANDARD_SLOTS] || layouts[kind]), fontSize: kind === "title" ? 36 : 21, color: "#222222", align: kind === "title" ? "center" : "left", font: "sans", rotation: 0, background: "transparent" }
}

export function readCompositionRaster(raw: unknown): CompositionRaster | null {
  if (!raw || typeof raw !== "object") { return null }
  const value = raw as Partial<CompositionRaster>
  if (typeof value.image !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value.image) || value.image.length > 5_000_000 || typeof value.label !== "string") { return null }
  const dimensions = Number.isFinite(value.width) && Number.isFinite(value.height) && value.width! > 0 && value.height! > 0 ? { width: value.width, height: value.height } : {}
  return { image: value.image, ...dimensions, label: value.label.slice(0, 80), detail: typeof value.detail === "string" ? value.detail.slice(0, 1000) : "", legend: Array.isArray(value.legend) ? value.legend.filter(entry => entry && typeof entry.label === "string" && /^#[\da-f]{6}$/i.test(entry.color)).slice(0, 20).map(entry => ({ label: entry.label.slice(0, 80), color: entry.color })) : [] }
}

export function useCompositionRaster(items: CompositionItem[], raster: CompositionRaster, role: "main" | "inset"): CompositionItem[] {
  const snapshot = readCompositionRaster(raster)
  if (!snapshot) { return items }
  if (role === "main") {
    return items.map(item => item.kind === "map" ? { ...item, label: `主图 · ${snapshot.label}`, raster: snapshot } : item)
  }
  if (items.length >= 60) { return items }
  const item = createCompositionItem("image")
  const offset = items.filter(entry => entry.kind === "image").length % 5 * 24
  return [...items, { ...item, ...constrainItem({ ...item, x: item.x - offset, y: item.y - offset }), label: `副图 · ${snapshot.label}`, raster: snapshot, background: "white", positioned: true }]
}

export function restoreComposition(raw: unknown): CompositionItem[] | null {
  if (!Array.isArray(raw) || raw.length > 60 || raw.filter(item => item?.kind === "map").length !== 1) { return null }
  const kinds = ["map", "title", "legend", "scale", "north", "time", "source", "text", "chart", "symbol", "image", "description", "agency"]
  const ids = new Set<string>()
  for (const item of raw) {
    if (!item || !kinds.includes(item.kind) || typeof item.id !== "string" || ids.has(item.id)) { return null }
    if (item.kind === "symbol" && !Object.prototype.hasOwnProperty.call(cartographySymbolDefinitions, item.symbolKind)) { return null }
    if ((item.raster || item.kind === "image") && !readCompositionRaster(item.raster)) { return null }
    ids.add(item.id)
  }
  const margin = compositionMargin(raw.find(item => item.kind === "map")?.safeMargin)
  return raw.map(item => ({
    ...createCompositionItem(item.kind),
    ...(item.positioned ? { positioned: true } : {}),
id: item.id,
    ...(item.standardPart && !normalizeRotation(item.rotation) && [item.x, item.y, item.w, item.h].every(Number.isFinite) && item.x >= 0 && item.y >= 0 && item.w > 0 && item.h > 0 && item.x + item.w <= PAGE.width && item.y + item.h <= PAGE.height
      ? { x: item.x, y: item.y, w: item.w, h: item.h }
: constrainItem(item, [], false, margin)),
    ...(item.kind === "map" && typeof item.safeMargin === "number" ? { safeMargin: margin } : {}),
    ...(item.kind !== "map" && item.hidden === true ? { hidden: true } : {}),
    text: typeof item.text === "string" ? item.text.slice(0, 1000) : "",
label: typeof item.label === "string" ? item.label.slice(0, 80) : item.kind,
    chartType: typeof item.chartType === "string" ? item.chartType : undefined,
    linkedId: typeof item.linkedId === "string" ? item.linkedId : undefined,
    ...(item.raster ? { raster: readCompositionRaster(item.raster)! } : {}),
    frameColor: /^#[\da-f]{6}$/i.test(item.frameColor) ? item.frameColor : undefined,
    ruleColor: /^#[\da-f]{6}$/i.test(item.ruleColor) ? item.ruleColor : undefined,
    ...(["rows", "columns"].includes(item.legendFlow) ? { legendFlow: item.legendFlow } : {}),
    templateKind: typeof item.templateKind === "string" ? item.templateKind.slice(0, 80) : undefined,
    standardPart: typeof item.standardPart === "string" ? item.standardPart.slice(0, 30) : undefined,
    ...(item.kind === "symbol" ? { symbolKind: item.symbolKind, opacity: Number.isFinite(Number(item.opacity)) ? Math.max(0, Math.min(1, Number(item.opacity))) : 1 } : {}),
    rotation: item.kind === "map" ? 0 : normalizeRotation(item.rotation),
    background: ["white", "dark", "transparent"].includes(item.background) ? item.background : createCompositionItem(item.kind).background,
    fontSize: Math.max(12, Math.min(64, Number(item.fontSize) || 19)),
color: /^#[\da-f]{6}$/i.test(item.color) ? item.color : "#24343c",
    align: item.align === "center" || item.align === "right" ? item.align : "left",
font: item.font === "serif" ? "serif" : "sans"
  }))
}

export type LinkedCompositionChart = { id: string; type: string; name: string }
export function reconcileCharts(items: CompositionItem[], charts: LinkedCompositionChart[], restore = false): CompositionItem[] {
  const remaining = items.filter(item => item.kind === "chart")
  const previousSlots = standardChartSlots(remaining.length)
  const automatic = new Set(remaining.filter((item, i) => ["x", "y", "w", "h"].every(key => Math.abs(item[key as keyof Rect2D] - previousSlots[i][key as keyof Rect2D]) < 1)).map(item => item.id))
  const linked = charts.map((chart, index) => {
    let match = remaining.findIndex(item => item.linkedId === chart.id)
    if (match < 0 && restore) { match = remaining.findIndex(item => item.chartType === chart.type) }
    const item = match >= 0 ? remaining.splice(match, 1)[0] : createCompositionItem("chart", "", chart.type)
    if (match < 0 || !item.positioned || automatic.has(item.id)) {
      Object.assign(item, standardChartSlots(charts.length)[index], { positioned: true })
    }
    return { ...item, linkedId: chart.id, chartType: chart.type, label: chart.name }
  })
  const byId = new Map(linked.map(item => [item.id, item]))
  // Keep the existing stacking order and geometry; only new chart IDs are appended.
  const result = items.flatMap(item => {
    if (item.kind === "legend" && item.x === STANDARD_SLOTS.legend.x && item.y === STANDARD_SLOTS.legend.y && [176, STANDARD_SLOTS.legend.h].includes(item.h)) {
      return [{ ...item, h: charts.length ? 176 : STANDARD_SLOTS.legend.h }]
    }
    if (item.kind !== "chart") { return [item] }
    return byId.has(item.id) ? [byId.get(item.id)!] : []
  })
  return [...result, ...linked.filter(item => !items.some(previous => previous.id === item.id))]
}
