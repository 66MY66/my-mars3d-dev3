import type { EChartsOption } from "echarts"
import { readTemplateDocument, TEMPLATE_CONTRACTS, type TemplateDocument, type TemplateOptions, type TemplateScene } from "./template-renderer"
import type { GeoBounds } from "./earthquake-analysis"
import { assessmentSourceIssue, isAssessmentKind } from "./assessment-products"

export type MapDataSource = { id: string; name: string; document?: TemplateDocument; issue?: string }
export type BusinessMapResult = {
  fingerprint: string; bounds: GeoBounds; document: TemplateDocument; scene: TemplateScene; options: TemplateOptions
}

export function readBusinessDocument(raw: unknown, name = "", limits?: { maxFeatures: number; maxVertices: number }): TemplateDocument {
  const data = readTemplateDocument(JSON.parse(JSON.stringify(raw)), name, limits)
  const metadata = data.metadata
  if (metadata.usage === "test" || metadata.originalSampleBounds || metadata.extentMode === "selection" ||
      (!(metadata.collection && metadata.itemId) && /合成|模拟|虚构|synthetic|test.fixture|RGB.*(亮度|采样)/i.test(String(metadata.source || "")))) {
    throw new Error("合成测试或截图像素数据不能用于业务模板；请使用有真实坐标和指标的数据")
  }
  const crs = metadata.crs || (data as any).crs?.properties?.name || "CRS84"
  if (!["CRS84", "EPSG:4326", "EPSG:4490", "urn:ogc:def:crs:OGC:1.3:CRS84"].includes(crs)) {
    throw new Error(`不支持直接使用 ${crs} 坐标；请先完成有依据的坐标转换`)
  }
  if (!String(metadata.source || "").trim()) { throw new Error("缺少数据来源") }
  data.metadata = { ...metadata, crs }
  data.features = data.features.map((feature, index) => ({
    ...feature, properties: { ...feature.properties, sourceFeatureId: String(feature.id ?? feature.properties.sourceFeatureId ?? index) }
  }))
  return data
}

// Read source GeoJSON, never a rendered bitmap, a generated result, or hand-drawn graphics.
export function collectMapDataSources(layers: any[]): MapDataSource[] {
  const sources: MapDataSource[] = []
  const visited = new Set<unknown>()
  function visit(layer: any) {
    if (!layer || visited.has(layer) || layer.show === false) { return }
    visited.add(layer)
    if (String(layer.id || "").startsWith("thematic-workbench-")) { return }
    if (Array.isArray(layer.layers)) { layer.layers.forEach(visit); return }
    const options = layer.options || {}
    const type = String(layer.type || options.type || "").toLowerCase()
    if (type.includes("group")) { return }
    const entry: MapDataSource = { id: String(layer.id), name: String(layer.name || options.name || layer.id) }
    try {
      let raw = options.data
      if (raw?.type !== "FeatureCollection" && type.includes("geojson") && typeof layer.toGeoJSON === "function") { raw = layer.toGeoJSON() }
      if (raw?.type !== "FeatureCollection") {
        if (/xyz|wms|wmts|tile|image|raster|stac|geojson/.test(type)) { sources.push({ ...entry, issue: "当前图层没有可读取的要素属性；影像瓦片不能代替业务指标" }) }
        return
      }
      const metadata = { source: options.url || entry.name, ...(options.metadata || {}), ...(raw.metadata || {}) }
      if (/gcj|bd09/i.test(String(options.chinaCRS || metadata.crs || ""))) { throw new Error("偏移坐标图层需先核验坐标转换，不能直接套用") }
      entry.document = readBusinessDocument({ ...raw, metadata }, entry.name)
      sources.push(entry)
    } catch (error) { sources.push({ ...entry, issue: error instanceof Error ? error.message : "图层数据不可用" }) }
  }
  layers.forEach(visit)
  return sources
}

export function businessNumber(value: unknown): number | null {
  if (typeof value === "number") { return Number.isFinite(value) ? value : null }
  if (typeof value !== "string" || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) { return null }
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
export function availableFields(document: TemplateDocument | null, categorical = false, numericText = false): string[] {
  if (!document) { return [] }
  return [...new Set(document.features.flatMap(f => Object.keys(f.properties)))].filter((key): key is string =>
    key !== "sourceFeatureId" && document.features.every(f => {
      const value = (f.properties as Record<string, unknown>)[String(key)]
      if (categorical) { return ["string", "number", "boolean"].includes(typeof value) && String(value).trim() !== "" && (typeof value !== "number" || Number.isFinite(value)) }
      return numericText ? businessNumber(value) !== null : typeof value === "number" && Number.isFinite(value)
    }))
}
export function defaultBusinessField(document: TemplateDocument | null, kind: string) {
  const fields = availableFields(document, kind === "unique-value", true)
  const explicit = document?.metadata.valueField || (kind === "unique-value" ? "category" : "value")
  if (fields.includes(explicit)) { return explicit }
  const metrics = fields.filter(key => !/^(id|adcode|code|pac|gnid|fid|objectid|longitude|latitude|lon|lat)$/i.test(key))
  return metrics.length === 1 ? metrics[0] : ""
}
export function templateSourceIssue(document: TemplateDocument, kind: string, exposure?: string): string {
  if (isAssessmentKind(kind)) { return assessmentSourceIssue(document, kind) }
  const contract = TEMPLATE_CONTRACTS[kind]
  if (!contract) { return "未知模板" }
  const types = document.features.map(f => f.geometry.type)
  const is = (...allowed: string[]) => types.every(type => allowed.includes(type))
  if (["choropleth", "unique-value", "building-resilience", "population-exposure"].includes(kind) && !is("Polygon", "MultiPolygon")) { return "需要面要素" }
  if (["raster-ramp", "raster-threshold", "contour", "thermal-infrared", "insar-deformation", "instrumental-intensity", "trajectory", "swarm-trajectory"].includes(kind) && !is("Point")) { return "需要带指标的点要素或规则采样网格" }
  if (["graduated-symbol", "proportional-symbol", "point-heat", "chart-linkage", "risk-overlay", "post-quake-risk", "time-compare", "anomaly-composite", "intensity-distribution", "secondary-hazard"].includes(kind) && !is("Point", "Polygon", "MultiPolygon")) { return "需要点或面要素" }
  if (kind === "flow-direction" && !is("LineString", "MultiLineString")) { return "需要带方向的线要素" }
  if (kind === "emergency-command" && !is("Point", "LineString", "MultiLineString")) { return "需要资源点或路线" }
  if (contract.automatic) { return availableFields(document, kind === "unique-value").length ? "" : "缺少可用指标字段" }
  const fields = kind === "population-exposure" ? [exposure || (availableFields(document).includes("population") ? "population" : "asset_value"), "intensity"] : contract.fields
  const missing = fields.filter(key => document.features.some(f => f.properties[key] === undefined || f.properties[key] === null))
  return missing.length ? `缺少字段：${missing.join("、")}` : ""
}

export async function businessResult(document: TemplateDocument, scene: TemplateScene, bounds: GeoBounds, options: TemplateOptions): Promise<BusinessMapResult> {
  const snapshot = JSON.parse(JSON.stringify({ document, scene, bounds, options }))
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(snapshot)))
  return { ...snapshot, fingerprint: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("") }
}

export function businessChartOption(result: BusinessMapResult, type: string): EChartsOption {
  const scene = result.scene
  const categorical = ["unique-value", "secondary-hazard", "emergency-command", "building-damage", "road-damage", "geological-disaster", "remote-intensity", "extreme-zone"].includes(scene.kind)
  const counts = categorical
    ? scene.legend.map(entry => ({ name: entry.label, value: scene.rows.filter(row => row.category === entry.label).length, itemStyle: { color: entry.color } })).filter(row => row.value)
    : numericCounts(scene)
  const rows = scene.rows.slice(0, 30)
  const grouped = type === "population-distribution" || categorical
  const data = grouped ? counts : rows.map(row => ({ name: row.label, value: row.value, itemStyle: { color: row.color } }))
  const groupTitle = categorical ? "已绘制要素分类计数" : `已绘制要素指标分段计数（${scene.unit}）`
  const title = grouped ? groupTitle : `已绘制要素指标（${scene.unit}）`
  return {
    animation: false,
backgroundColor: "transparent",
textStyle: { color: "#24343c", fontSize: 12 },
    title: { text: title, subtext: !grouped && scene.rows.length > 30 ? `前 30 项 / 共 ${scene.rows.length} 项` : `共 ${scene.rows.length} 项`, left: 8, top: 6, textStyle: { fontSize: 13, color: "#24343c" } },
    tooltip: { trigger: "item", renderMode: "richText" },
    ...(type === "population-distribution"
      ? { series: [{ type: "pie" as const, radius: ["20%", "55%"], center: ["50%", "60%"], label: { fontSize: 10 }, data }] }
      : { grid: { top: 70, bottom: 36, left: 12, right: 16, containLabel: true }, xAxis: { type: "value" as const }, yAxis: { type: "category" as const, data: data.map(row => row.name), axisLabel: { width: 90, overflow: "truncate" as const } }, series: [{ type: "bar" as const, data }] })
  }
}

function numericCounts(scene: TemplateScene) {
  if (!scene.rows.length) { return [] }
  const values = scene.rows.map(row => row.value)
  const min = Math.min(...values); const max = Math.max(...values)
  const colors = ["#247b9c", "#35a69c", "#76864f", "#b5763f", "#b94d59"]
  if (min === max) { return [{ name: String(min), value: values.length, itemStyle: { color: colors[0] } }] }
  const bins = colors.map((color, i) => ({ name: `${i ? "(" : "["}${Number((min + (max - min) * i / 5).toPrecision(6))}, ${Number((min + (max - min) * (i + 1) / 5).toPrecision(6))}]`, value: 0, itemStyle: { color } }))
  for (const value of values) { bins[Math.max(0, Math.min(4, Math.ceil((value - min) / (max - min) * 5) - 1))].value++ }
  return bins.filter(bin => bin.value)
}
