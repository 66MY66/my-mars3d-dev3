import type { DbtLayer } from "./dbt116-standard"
import { businessNumber, readBusinessDocument, type BusinessMapResult, type MapDataSource } from "./business-map-data"
import { renderTemplateDocument, type TemplateDocument, type TemplateOptions } from "./template-renderer"
import type { GeoBounds } from "./earthquake-analysis"
import { area } from "@turf/turf"

export type ExpressionPresentation = { kind: string; options: TemplateOptions; fingerprint: string }

export function backendTemplateSources(layers: DbtLayer[], inputIds?: ReadonlySet<string>): MapDataSource[] {
  return layers.filter(layer => layer.onlineSource && layer.enabled !== false && (!inputIds || inputIds.has(layer.id))).map(layer => {
    if (layer.raster) { return { id: layer.id, name: layer.name, issue: "栅格请使用栅格表达；不能将影像像素作为矢量指标" } }
    try { const document = readBusinessDocument(layer.data, layer.name, { maxFeatures: 2000, maxVertices: 250000 }); document.metadata.onlineLayerId = layer.id; return { id: layer.id, name: layer.name, document } } catch (error) {
      return { id: layer.id, name: layer.name, issue: error instanceof Error ? error.message : "要素不可读取" }
    }
  })
}

export function bindExpressionFields(document: TemplateDocument, options: TemplateOptions): TemplateDocument {
  const family = (type: string) => ({ Point: "point", MultiPoint: "point", LineString: "line", MultiLineString: "line", Polygon: "polygon", MultiPolygon: "polygon" }[type])
  const input = document.features.filter(feature => !options.geometryFilter || family(feature.geometry.type) === options.geometryFilter)
  const mapping = Object.entries(options.fieldMapping || {})
  for (const [target, source] of mapping) {
    if (!source || input.some(feature => !Object.prototype.hasOwnProperty.call(feature.properties, source))) { throw new Error(`指标 ${target} 未绑定有效源字段：${source || "未选择"}`) }
  }
  const conversions = new Map<string, number>()
  const numeric = (key: string, value: unknown) => {
    const number = businessNumber(value)
    if (typeof value !== "string" || number === null) { return value }
    conversions.set(key, (conversions.get(key) || 0) + 1)
    return number
  }
  const features = input.map((feature, index) => {
    const properties = { ...feature.properties }
    for (const [target, source] of mapping) { properties[target] = ["observedAt", "track_id", "hazard_type", "resource_type", "status"].includes(target) ? feature.properties[source] : numeric(target, feature.properties[source]) }
    if (options.field && options.unit !== "类别") { properties[options.field] = numeric(options.field, properties[options.field]) }
    if (options.normalization) {
      if (options.normalization.kind !== "area-density" || !options.field || !/Polygon$/.test(feature.geometry.type)) { throw new Error("面积标准化需要真实统计区面和总量指标") }
      const originalArea = document.metadata.sourceAreaKm2ById?.[String(feature.properties.sourceFeatureId ?? feature.id ?? index)] ?? area(feature) / 1_000_000
      const value = businessNumber(properties[options.field])
      if (!Number.isFinite(originalArea) || originalArea <= 0 || value === null || value < 0) { throw new Error("原统计区面积或总量无效，不能计算密度") }
      properties[options.field] = value / originalArea
    }
    return { ...feature, properties }
  })
  return {
    ...document,
    metadata: { ...document.metadata, ...(options.unit?.trim() ? { unit: options.unit.trim() } : {}), numericTextConversions: Object.fromEntries(conversions) },
    features
  }
}

export function replayExpression(document: TemplateDocument, bounds: GeoBounds, expression: ExpressionPresentation) {
  if (!expression || typeof expression.kind !== "string" || !expression.options || !/^[a-f0-9]{64}$/.test(expression.fingerprint)) { throw new Error("表达方法记录不完整，请重新应用模板") }
  return renderTemplateDocument(expression.kind, bindExpressionFields(document, expression.options), bounds, expression.options)
}

export function expressionLayer(layer: DbtLayer, result: BusinessMapResult): DbtLayer {
  if (!layer.onlineSource) { throw new Error("表达方法缺少后端来源绑定") }
  return {
    ...layer,
    unit: result.scene.unit,
    legend: result.scene.legend,
    onlineSource: {
      ...layer.onlineSource,
      rendering: {
        ...layer.onlineSource.rendering,
        engine: result.scene.heat ? "Mars3D.HeatLayer" : "Mars3D.GraphicLayer",
        kind: result.scene.kind,
        parameters: { ...Object.fromEntries(Object.entries(layer.onlineSource.rendering?.parameters || {}).filter(([key]) => !["inputOnly", "expression"].includes(key))), expression: { kind: result.scene.kind, options: result.options, fingerprint: result.fingerprint } satisfies ExpressionPresentation }
      }
    }
  }
}
