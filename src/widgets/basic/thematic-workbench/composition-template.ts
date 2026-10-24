import { createCompositionItem, readCompositionRaster, useCompositionRaster, type CompositionItem, type CompositionRaster } from "./composition-model"
import { applyTemplateLayout } from "./composition-layout"

export type CompositionTemplateText = { title: string; legendTitle: string; time: string; source: string; kind?: string; description?: string; agency?: string }

export function applyCompositionTemplate(items: CompositionItem[], raster: CompositionRaster, text: CompositionTemplateText): CompositionItem[] {
  if (!readCompositionRaster(raster)) { return items }
  const kinds = ["title", "legend", "scale", "north", "time", "source", "description", "agency"] as const
  const missing = kinds.filter(kind => !items.some(item => item.kind === kind))
  if (!items.some(item => item.kind === "map") || items.length + missing.length > 60) { return items }
  const date = new Date(text.time)
  const content = { title: text.title, legend: text.legendTitle, time: Number.isNaN(date.getTime()) ? text.time : date.toLocaleString(), source: text.source, description: text.description || "内容说明待填写", agency: text.agency || "制图单位待填写" }
  const next = useCompositionRaster(items, raster, "main").map(item => Object.prototype.hasOwnProperty.call(content, item.kind)
    ? { ...item, text: content[item.kind as keyof typeof content] }
: item)
  for (const kind of missing) { next.push(createCompositionItem(kind, content[kind as keyof typeof content] || "")) }
  return text.kind ? applyTemplateLayout(next, text.kind) : next
}
