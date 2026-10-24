import { ckmeans, quantileSorted } from "simple-statistics"
import type { DisplayPoint, LegendEntry } from "./display-model"

export type RenderStyle = {
  mode: "source" | "classified" | "unique" | "raster"
  method: "equal" | "quantile" | "natural"; count: number; min: number; max: number
  low: string; high: string; opacity: number; nodata: number | null
  size: number; outlineWidth: number; outlineColor: string; labels: boolean
}
export function defaultRenderStyle(): RenderStyle {
  return { mode: "source", method: "equal", count: 5, min: 0, max: 255, low: "#1d91a5", high: "#e8c547", opacity: 0.9, nodata: null, size: 10, outlineWidth: 1.5, outlineColor: "#ffffff", labels: false }
}
export function interpolateColor(low: string, high: string, fraction: number) {
  const t = Math.max(0, Math.min(1, fraction))
  return "#" + [1, 3, 5].map((offset) => {
    const a = parseInt(low.slice(offset, offset + 2), 16)
    const b = parseInt(high.slice(offset, offset + 2), 16)
    return Math.round(a + (b - a) * t).toString(16).padStart(2, "0")
  }).join("")
}
export function classBreaks(values: number[], method: RenderStyle["method"], count: number) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  return sortedClassBreaks(sorted, method, count)
}
function sortedClassBreaks(sorted: number[], method: RenderStyle["method"], count: number) {
  if (!sorted.length) { return [] }
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  if (min === max) { return [max] }
  const n = Math.max(2, Math.min(9, Math.round(count), new Set(sorted).size))
  if (method === "natural") {
    // A deterministic quantile sample keeps classification interactive for large pixel arrays.
    const sample = sorted.length > 2048 ? Array.from({ length: 2048 }, (_, i) => sorted[Math.floor(i * (sorted.length - 1) / 2047)]) : sorted
    return ckmeans(sample, Math.min(n, new Set(sample).size)).map((cluster) => cluster[cluster.length - 1])
  }
  return Array.from({ length: n }, (_, i) => method === "quantile" ? quantileSorted(sorted, (i + 1) / n) : min + (max - min) * (i + 1) / n)
}
export function buildColorMapping(values: number[], style: RenderStyle): { legend: LegendEntry[]; color: (value: number) => string | null } {
  return createStyleMapper(values)(style)
}

// Snapshot/sort once per source; recoloring and opacity edits reuse classification.
export function createStyleMapper(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  let cachedKey = ""
  let breaks: number[] = []
  let valid: number[] = []
  let unique: number[] = []
  let previousNodata: number | null | undefined
  return (style: RenderStyle): { legend: LegendEntry[]; color: (value: number) => string | null } => {
  if (previousNodata !== style.nodata) {
    previousNodata = style.nodata
    valid = sorted.filter(value => value !== style.nodata)
    unique = [...new Set(valid)]
    cachedKey = ""
  }
  if (!valid.length) { return { legend: [], color: () => null } }
  if (style.mode === "raster" && (!Number.isFinite(style.min) || !Number.isFinite(style.max) || style.min >= style.max)) { throw new Error("映射下限必须小于上限，且必须为有限数值") }
  if (style.mode === "unique" && unique.length > 24) { throw new Error(`当前有 ${unique.length} 个唯一值，超出 24 类；请选择分级或栅格渲染`) }
  const minimum = unique[0]
  const key = `${style.mode}:${style.method}:${style.count}`
  if (key !== cachedKey) {
    if (style.mode === "raster") { breaks = [] } else { breaks = style.mode === "unique" ? unique : [...new Set(sortedClassBreaks(valid, style.method, style.count))] }
    cachedKey = key
  }
  const colors = breaks.map((_, i) => interpolateColor(style.low, style.high, i / Math.max(1, breaks.length - 1)))
  const currentBreaks = breaks
  const { mode, nodata, min, max, low, high } = style
  const color = (value: number) => {
    if (!Number.isFinite(value) || value === nodata) { return null }
    if (mode === "raster") { return interpolateColor(low, high, (value - min) / (max - min)) }
    const index = currentBreaks.findIndex((end) => value <= end)
    return colors[index === -1 ? colors.length - 1 : index]
  }
  const legend = style.mode === "raster"
    ? [style.min, (style.min + style.max) / 2, style.max].map((value) => ({ label: value.toFixed(2), color: color(value)! }))
    : breaks.map((end, i) => ({ label: style.mode === "unique" ? String(end) : `${i === 0 ? "[" : "("}${(i === 0 ? minimum : breaks[i - 1]).toFixed(2)}, ${end.toFixed(2)}]`, color: interpolateColor(style.low, style.high, i / Math.max(1, breaks.length - 1)) }))
  return { legend, color }
  }
}

export function stylePoints(points: DisplayPoint[], style: RenderStyle) {
  if (style.mode === "source") { return points }
  if (style.mode === "unique") {
    const groups = [...new Set(points.map((point) => point.band))].sort()
    return points.map((point) => ({ ...point, color: interpolateColor(style.low, style.high, groups.indexOf(point.band) / Math.max(1, groups.length - 1)) }))
  }
  const mapping = buildColorMapping(points.map((point) => point.value), style)
  return points.map((point) => ({ ...point, color: mapping.color(point.value) || "#00000000" }))
}
