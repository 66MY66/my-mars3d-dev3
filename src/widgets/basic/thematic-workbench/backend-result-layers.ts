import type { RemoteItem } from "./remote-cartography-source"
import type { TemplateDocument } from "./template-renderer"
import { buildColorMapping, classBreaks, defaultRenderStyle } from "./render-style"
import { sampleTemplatePalette } from "./template-palettes"

export type BackgroundDisplay = "grid" | "fill"
export function isBackgroundResult(item: RemoteItem) { return ["thermal-background", "insar-background"].includes(backendResultKind(item) || "") }

export function backendResultKind(item: RemoteItem) {
  const field = item.properties["background:field_type"]
  if (["thermal-background", "thematic-map"].includes(item.collection) && ["thermal", "insar"].includes(field)) { return field === "thermal" ? "thermal-background" : "insar-background" }
  if (item.collection === "thermal-anomaly" && item.properties["result:type"] === "thermal_anomaly") { return "thermal-anomaly" }
  return null
}
export function backendResultFields(item: RemoteItem) {
  const kind = backendResultKind(item)
  if (!kind) { return [] }
  if (kind === "thermal-anomaly") { return [{ key: "alice", label: "后台异常指数", unit: "无量纲" }, { key: "max_bt", label: "后台最高亮温", unit: "原始值" }] }
  return [{ key: "mean", label: "背景均值", unit: "原始值" }, { key: "std", label: "背景标准差", unit: "原始值" }, { key: "count", label: "参与样本数", unit: "景" }, { key: "latest", label: "最近观测值", unit: "原始值" }]
}
export function presentBackendResult(item: RemoteItem, document: TemplateDocument, field: string, display: BackgroundDisplay = "grid") {
  const descriptor = backendResultFields(item).find(entry => entry.key === field)
  if (!descriptor) { throw new Error("后台成果未声明此显示指标") }
  const values = document.features.map(feature => feature.properties[field])
  if (!values.length || values.some(value => typeof value !== "number" || !Number.isFinite(value))) { throw new Error(`后台成果缺少有效的 ${field}，不会补零或替换业务字段`) }
  if (field === "count" && values.some(value => !Number.isInteger(value) || value < 0)) { throw new Error("后台样本数无效") }
  const background = isBackgroundResult(item)
  const outlineOnly = background && display !== "fill"
  const signed = backendResultKind(item) === "insar-background" && ["mean", "latest"].includes(field)
  const extent = Math.max(...values.map(Math.abs))
  const limit = extent || 1
  const mapping = buildColorMapping(values, { ...defaultRenderStyle(), mode: "classified", method: "equal", count: 5, low: background ? "#e5eef0" : "#fff7bc", high: background ? "#526f7b" : "#b10026" })
  const color = signed ? (value: number) => sampleTemplatePalette(["#2166ac", "#f7f7f7", "#b2182b"], (value + limit) / (2 * limit)) : mapping.color
  const minimum = Math.min(...values)
  const breaks = [...new Set(classBreaks(values, "equal", 5))]
  const boundaries = [minimum, ...breaks]
  const precision = Array.from({ length: 11 }, (_, i) => i + 6).find(digits => new Set(boundaries.map(value => value.toPrecision(digits))).size === new Set(boundaries).size) || 17
  const format = (value: number) => String(Number(value.toPrecision(precision)))
  const filledLegend = signed
    ? [...new Set([-extent, 0, extent])].map(value => ({ label: `${descriptor.label} ${format(value)} ${descriptor.unit}`, color: color(value)! }))
    : breaks.map((end, i) => ({ label: `${descriptor.label} ${minimum === end && breaks.length === 1 ? format(end) : `${i === 0 ? "[" : "("}${format(i === 0 ? minimum : breaks[i - 1])}, ${format(end)}]`} ${descriptor.unit}`, color: color(end)! }))
  const legend = outlineOnly ? [{ label: `${descriptor.label} · 原始网格读数（${descriptor.unit}）`, color: "#425b66", shape: "line" as const }] : filledLegend
  const gridSize = item.properties["background:grid_size_deg"]
  const samples = item.properties["background:samples"]
  const insufficient = background && (samples === 1 || document.features.every(feature => feature.properties.count === 1 && feature.properties.std === 0))
  const note = background ? [typeof gridSize === "number" ? `原始网格 ${gridSize}°` : "原始统计网格", `选区 ${values.length} 格`, typeof samples === "number" ? `${samples} 景样本` : "样本数以源属性为准", insufficient ? "单景背景，不能计算时间基线异常" : "背景原值参考，不是本产品异常结论", "单位未声明时不换算温度"].join("；") : "后台提供的异常要素；物理指标与判定方法以源数据为准"
  const presentation = background ? { kind: backendResultKind(item), display: outlineOnly ? "grid" : "fill", field, note } : undefined
  const styled: TemplateDocument = { ...document, metadata: { ...document.metadata, ...(presentation ? { backendResultPresentation: presentation } : {}) }, features: document.features.map((feature, index) => ({ ...feature, properties: { ...feature.properties, color: outlineOnly ? "#425b66" : color(values[index]), label: outlineOnly ? format(values[index]) : "" } })) }
  return { document: styled, legend, label: descriptor.label, unit: descriptor.unit, note, display: outlineOnly ? "grid" : "fill", symbol: { styleOptions: { fill: !outlineOnly, outline: true, outlineWidth: outlineOnly ? 1.5 : 1, outlineColor: "#425b66", clampToGround: true }, callback: (attr: Record<string, any>) => ({ color: attr.color }) } }
}
