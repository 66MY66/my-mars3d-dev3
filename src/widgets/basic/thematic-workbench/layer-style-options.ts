import type { DbtLayer } from "./dbt116-standard"
import { inspectJsonContent, recommendExpression } from "./content-routing"
import type { TemplateDocument } from "./template-renderer"
import { basegeoSchema, fallbackNames, vectorPaint } from "./cartography-vector-style"
import { dbtSymbolDefinitions, type DbtSymbolKind } from "./dbt116-symbols"

export const layerExpressionMethods = [
  { value: "unique-value", label: "分类符号" },
  { value: "choropleth", label: "分级颜色" },
  { value: "graduated-symbol", label: "分级大小" },
  { value: "proportional-symbol", label: "比例大小" }
] as const

export function layerStyleOptions(layer: DbtLayer) {
  if (layer.raster || !layer.onlineSource) { return [] }
  const metadata = { ...(layer.data as TemplateDocument).metadata, source: layer.source }
  const profile = inspectJsonContent({ ...layer.data, metadata })
  return layerExpressionMethods.flatMap(method => {
    const recommendation = recommendExpression(profile, method.value)
    return recommendation ? [{ ...method, recommendation, fields: profile.groups.find(group => group.geometry === recommendation.geometry)!.fields, metrics: profile.groups.find(group => group.geometry === recommendation.geometry)!.metrics }] : []
  })
}

export function layerStyleDocument(layer: DbtLayer): TemplateDocument {
  const original = (layer.data as TemplateDocument).metadata
  const metadata: Record<string, any> = { ...original, onlineLayerId: layer.id, collection: layer.onlineSource?.collection, itemId: layer.onlineSource?.itemId, source: layer.source, observedAt: original?.observedAt || layer.publishedAt }
  const categoryLabels = { ...metadata.categoryLabels }; const categoryColors = { ...metadata.categoryColors }
  for (const feature of layer.data.features) {
    const p = feature.properties
    if (p?.cartographySchema !== basegeoSchema || p.GB == null) { continue }
    const definition = dbtSymbolDefinitions[p.cartographyKind as DbtSymbolKind]
    const label = definition?.shortLabel || fallbackNames[p.cartographyFallback]
    if (!label) { continue }
    const code = String(p.GB); const paint = vectorPaint(p.cartographyKind, p.cartographyFallback)
    categoryLabels[code] = `${label}（${code}）`; categoryColors[code] = paint.fill || paint.color
  }
  return { ...layer.data, metadata: { ...metadata, categoryLabels, categoryColors } } as TemplateDocument
}
