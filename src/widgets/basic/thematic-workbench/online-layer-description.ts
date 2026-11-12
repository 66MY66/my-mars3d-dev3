import type { DbtLayer } from "./dbt116-standard"
import type { TemplateDocument } from "./template-renderer"
import { dbtRoleNames } from "./dbt-cartography-rules"
export function onlyBaseLayers(layers: DbtLayer[]) {
  const visible = layers.filter(layer => layer.enabled !== false && (layer.opacity ?? 1) > 0)
  return visible.length > 0 && visible.every(layer => ["boundary", "settlement", "water", "transport", "dem", "land"].includes(layer.role))
}
export function onlineProofTitle(topic: string, layers: DbtLayer[], eventName = "") {
  if (onlyBaseLayers(layers)) { return "基础地理参考图 · 在线数据校样" }
  return `${eventName ? `${eventName} · ` : ""}${topic} · 在线数据校样`
}

export function onlineLayerDescription(layers: DbtLayer[]) {
  const summaries = new Map<string, string>()
  for (const layer of layers) {
    const id = layer.onlineSource?.itemId || layer.id
    if (layer.role === "event") { summaries.set("event-parameters", "震情来自后台随包参数，非审核目录事件，主震级类型未注明。"); continue }
    if (id === "SP-landsat-lst-20260216") { summaries.set(id, "Landsat LST：2026-02-16至04-15资料时段；9×9粗网格，单位待核验，无多期基线。"); continue }
    if (id === "SP-swchina-basegeo-250k") { summaries.set(id, "基础地理1:25万，成图年份待确认。") } else if (id === "SP-jiuzhaigou2017-intensity") { summaries.set(id, "九寨沟烈度评估（2017-08-08）；方法、来源单位和版本待核验。") } else if (id === "SP-china-active-faults") { summaries.set(id, "断层为全国汇编 v0.4.0，非专项调查。") } else if (id === "SP-china-province-border") { summaries.set(id, "国界省界为汇编参考线。") } else { summaries.set(id, `${layer.name}：${layer.publishedAt || "时点待提供"}；指标口径待核验。`) }
  }
  const quality = layers.some(layer => (layer.data as TemplateDocument).metadata?.rejectedCount > 0) ? "部分退化或无效几何未绘制。" : ""
  const assessment = layers.some(layer => (layer.data as TemplateDocument).metadata?.assessmentWarning) ? "该时次含多个同级评估面，方案分组待提供。" : ""
  return [onlyBaseLayers(layers) ? "当前仅含基础地理，未叠加地震事件与专题成果。" : "", ...summaries.values(), quality, assessment, "参考校样，非正式应急成果。"].filter(Boolean).join(" ")
}

export function onlineMapDescription(layers: DbtLayer[]) {
  const visible = layers.filter(layer => layer.enabled !== false && (layer.opacity ?? 1) > 0)
  if (!visible.length) { return "当前尚未叠加专题图层。" }
  const baseRoles = ["boundary", "settlement", "water", "transport", "dem", "land"]
  const themes = [...new Set(visible.filter(layer => !baseRoles.includes(layer.role)).map(layer => dbtRoleNames[layer.role] || layer.name))]
  if (visible.some(layer => baseRoles.includes(layer.role))) { themes.push("基础地理") }
  return [
    `${themes.join("、")}，按当前选区绘制。`,
    visible.some(layer => ["population", "economy"].includes(layer.role)) ? "数值保留后台指标，不据此推算总量或损失。" : "",
    visible.some(layer => (layer.data as TemplateDocument).metadata?.rejectedCount > 0) ? "存在未绘制的源几何。" : "",
    visible.some(layer => (layer.data as TemplateDocument).metadata?.assessmentWarning) ? "同级多方案评估面未合并。" : "",
    "来源、版本与使用限制见随图来源记录。"
  ].filter(Boolean).join("")
}
