import { area, bbox, bboxClip, coordEach, distance, featureCollection, isolines, lineString, point, pointOnFeature, polygon } from "@turf/turf"
import { validVectorGeometry } from "./geometry-validation"
import type { Feature, FeatureCollection, Geometry, GeometryCollection } from "geojson"
import { analyzeEarthquakeDataset, parseEarthquakeGeoJson, type GeoBounds } from "./earthquake-analysis"
import { EARTHQUAKE_COLORS, earthquakeLegend, INTENSITY_COLORS } from "./earthquake-palette"
import { templateMapping } from "./template-map"
import { classBreaks, legendNumber } from "./render-style"
import { mapTemplatePalettes, sampleTemplatePalette } from "./template-palettes"
import type { LegendEntry } from "./display-model"
import { assessmentContracts, isAssessmentKind, renderAssessmentProduct } from "./assessment-products"

export type TemplateContract = { name: string; fields: string[]; geometry: string; analysisOnly?: true; automatic?: "admin" | "rgb"; metadata?: Record<string, unknown> }
export const TEMPLATE_CONTRACTS: Record<string, TemplateContract> = {
  ...assessmentContracts,
  choropleth: { name: "分级设色", fields: ["value"], geometry: "Polygon", automatic: "admin" },
  "unique-value": { name: "唯一值分类", fields: ["category"], geometry: "Point / LineString / Polygon", automatic: "admin" },
  "graduated-symbol": { name: "分级符号", fields: ["value"], geometry: "Point / Polygon", automatic: "admin" },
  "proportional-symbol": { name: "比例符号", fields: ["value"], geometry: "Point / Polygon", automatic: "admin" },
  "point-heat": { name: "点热力", fields: ["value"], geometry: "Point / Polygon", automatic: "admin" },
  "raster-ramp": { name: "栅格色带", fields: ["value"], geometry: "规则 Point 采样网格", automatic: "rgb" },
  "raster-threshold": { name: "栅格阈值", fields: ["value"], geometry: "规则 Point 采样网格", automatic: "rgb" },
  contour: { name: "等值线", fields: ["value"], geometry: "规则 Point 网格", automatic: "rgb" },
  trajectory: { name: "轨迹回放", fields: ["observedAt", "track_id"], geometry: "Point", metadata: { timeZone: "ISO 8601 with offset" } },
  "flow-direction": { name: "流向", fields: ["flow_rate"], geometry: "LineString（坐标顺序为流向）", metadata: { unit: "m³/s" } },
  "risk-overlay": { name: "风险叠加", fields: ["hazard_index", "exposure_index", "vulnerability_index"], geometry: "Point / Polygon", metadata: { riskModel: "relative-screening-v1" } },
  "time-compare": { name: "时序对比", fields: ["before", "after"], geometry: "Point / Polygon", metadata: { unit: "", beforeTime: "", afterTime: "" } },
  "chart-linkage": { name: "图表联动", fields: ["value"], geometry: "Point / Polygon", automatic: "admin" },
  "anomaly-composite": { name: "异常综合", fields: ["thermal_index", "deformation_index", "seismic_index"], geometry: "Point / Polygon", metadata: { weights: [1, 1, 1], model: "", normalization: "各输入已归一化到 0–1" } },
  "thermal-infrared": { name: "地表温度基线异常", fields: ["lst_k", "baseline_mean_k", "baseline_sd_k", "baseline_count", "quality_flag"], geometry: "Point", metadata: { temperatureUnit: "K", baselinePeriod: "" } },
  "post-quake-risk": { name: "地震灾害风险指数", fields: ["risk_index"], geometry: "Point / Polygon", metadata: { model: "已评估风险成果的模型与版本" } },
  "swarm-trajectory": { name: "地震序列时空分布", fields: ["observedAt", "track_id", "magnitude", "depth_km"], geometry: "Point", metadata: { depthUnit: "km", magnitudeType: "" } },
  "insar-deformation": { name: "InSAR 视线向形变", fields: ["los_mm", "coherence"], geometry: "Point", metadata: { losUnit: "mm", losConvention: "toward_positive", acquisitionPair: "" } },
  "instrumental-intensity": { name: "仪器烈度初判", fields: ["pga_ms2", "pgv_ms"], geometry: "Point", analysisOnly: true, metadata: { intensityStandard: "GB/T 17742-2020" } },
  "intensity-distribution": { name: "烈度评定成果", fields: ["intensity"], geometry: "Point / Polygon", metadata: { intensityStandard: "GB/T 17742-2020", assessment: "评定机构或模型版本" } },
  "secondary-hazard": { name: "次生灾害调查成果", fields: ["hazard_type", "severity"], geometry: "Point / Polygon" },
  "building-resilience": { name: "建筑物地震易损性", fields: ["vulnerability_index"], geometry: "Polygon", metadata: { model: "脆弱性评估方法与版本" } },
  "population-exposure": { name: "人口与资产暴露", fields: ["population", "intensity"], geometry: "Polygon", metadata: { populationUnit: "人", assessment: "人口统计与烈度成果来源" } },
  "emergency-command": { name: "救灾资源与通行状态", fields: ["resource_type", "status"], geometry: "Point / LineString", metadata: { statusValues: "available / blocked / unknown" } }
}

type SupportedGeometry = Exclude<Geometry, GeometryCollection>
export type TemplateDocument = FeatureCollection<SupportedGeometry, Record<string, any>> & { metadata: Record<string, any> }
export type TemplateFeature = Feature<SupportedGeometry, Record<string, any>>
export type TemplateScene = {
  kind: string; features: TemplateFeature[]; legend: LegendEntry[]; source: string; unit: string; time: string; note: string
  annotations?: Array<{ position: number[]; label: string; symbolKind?: string }>
  rows: Array<{ id: string; label: string; value: number; color: string; category?: string; sourceFeatureId?: string }>
  heat?: Array<{ lng: number; lat: number; value: number }>
  heatColors?: string[]
}
export type TemplateOptions = { field?: string; method?: "natural" | "equal" | "quantile"; count?: number; palette?: string; threshold?: number; coherence?: number; progress?: number; compare?: "difference" | "before" | "after"; exposure?: "population" | "asset_value"; fieldMapping?: Record<string, string>; unit?: string; radius?: number; normalization?: { kind: "area-density" }; geometryFilter?: "point" | "line" | "polygon"; categoryLabels?: Record<string, string>; categoryColors?: Record<string, string> }
const allowedGeometry = ["Point", "LineString", "MultiLineString", "Polygon", "MultiPolygon"]

function categoryColor(category: string) {
  let hash = 2166136261
  for (const char of category) { hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0 }
  const h = hash % 360 / 60; const c = 0.58; const x = c * (1 - Math.abs(h % 2 - 1)); const m = 0.16
  const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h)]
  return "#" + rgb.map(value => Math.round((value + m) * 255).toString(16).padStart(2, "0")).join("")
}

export function readTemplateDocument(input: unknown, filename = "", limits = { maxFeatures: 2000, maxVertices: 40000 }): TemplateDocument {
  if (!Number.isInteger(limits.maxFeatures) || limits.maxFeatures < 1 || limits.maxFeatures > 2000 || !Number.isInteger(limits.maxVertices) || limits.maxVertices < 1 || limits.maxVertices > 250000) { throw new Error("矢量读取限额无效") }
  const raw = input as TemplateDocument
  if (raw?.type !== "FeatureCollection" || !Array.isArray(raw.features) || !raw.features.length || raw.features.length > limits.maxFeatures) { throw new Error(`需要包含 1–${limits.maxFeatures} 个要素的 GeoJSON FeatureCollection`) }
  let vertices = 0
  raw.features.forEach((feature, index) => {
    if (feature?.type !== "Feature" || !allowedGeometry.includes(feature.geometry?.type) || !feature.properties || typeof feature.properties !== "object") { throw new Error(`第 ${index + 1} 个要素的几何或属性无效`) }
    coordEach(feature, coord => {
      vertices++
      if (!Number.isFinite(coord[0]) || !Number.isFinite(coord[1]) || Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90) { throw new Error("坐标必须为 WGS84 经纬度") }
    })
    if (vertices > limits.maxVertices) { throw new Error(`顶点超过 ${limits.maxVertices}，请缩小范围或由后端分幅`) }
    if (!validVectorGeometry(feature)) { throw new Error(`第 ${index + 1} 个要素的几何拓扑无效`) }
  })
  return { ...raw, metadata: { source: filename, ...raw.metadata } }
}

function number(properties: Record<string, any>, field: string, min = -Infinity, max = Infinity) {
  const value = properties[field]
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) { throw new Error(`${field} 必须为 ${min === -Infinity ? "有效" : `${min}–${max}`}数值`) }
  return value
}
function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) { throw new Error(`缺少 ${label}`) }
  return value.trim()
}
function date(value: unknown, label: string) {
  const text = required(value, label)
  const result = Date.parse(text)
  if (!Number.isFinite(result) || !/(Z|[+-]\d{2}:?\d{2})$/.test(text)) { throw new Error(`${label} 必须为带时区的 ISO 8601 时间`) }
  return result
}
function clip(feature: TemplateFeature, bounds: GeoBounds): TemplateFeature | null {
  const box = bbox(feature)
  if (box[0] > bounds.east || box[2] < bounds.west || box[1] > bounds.north || box[3] < bounds.south) { return null }
  if (feature.geometry.type === "Point") { return feature }
  const clipped = bboxClip(feature as any, [bounds.west, bounds.south, bounds.east, bounds.north]) as TemplateFeature
  // bboxClip retains empty MultiPolygon parts whose bounding boxes intersect the selection.
  const geometry = clipped.geometry
  if (geometry.type === "MultiPolygon") {
    geometry.coordinates = geometry.coordinates.filter(rings => rings[0]?.length >= 4 && area(polygon(rings)) > 0)
  } else if (geometry.type === "Polygon" && (!geometry.coordinates[0]?.length || area(clipped) === 0)) { return null }
  return clipped.geometry.coordinates.length ? clipped : null
}
function paint(feature: TemplateFeature, value: number, color: string, id: string, size = 14, label = ""): TemplateFeature {
  return { ...feature, properties: { ...feature.properties, symbolKind: undefined, opacity: undefined, rasterCell: false, templateId: id, value, color, pixelSize: size, width: 3, name: label || String(feature.properties.name || id) } }
}

export function renderTemplateDocument(kind: string, document: TemplateDocument, bounds: GeoBounds, options: TemplateOptions = {}): TemplateScene {
  const contract = TEMPLATE_CONTRACTS[kind]
  if (!contract) { throw new Error("模板类型无效") }
  if (!(bounds.east > bounds.west && bounds.north > bounds.south)) { throw new Error("框选范围无效") }
  if (options.count !== undefined && (!Number.isInteger(options.count) || options.count < 2 || options.count > 9)) { throw new Error("分级数量须为 2–9 的整数") }
  const metadata = document.metadata || {}
  const source = required(metadata.source, "metadata.source 数据来源")
  if (!contract.automatic) { date(metadata.observedAt, "metadata.observedAt 观测时间") }
  const scoped = document.features.map((feature, index) => {
    const geometry = ["graduated-symbol", "proportional-symbol", "point-heat"].includes(kind) ? pointOnFeature(feature).geometry : feature.geometry
    return clip({ ...feature, geometry, properties: { ...feature.properties, templateId: String(index) } }, bounds)
  }).filter(Boolean) as TemplateFeature[]
  if (!scoped.length && !["trajectory", "swarm-trajectory"].includes(kind)) { throw new Error("框选范围内没有匹配数据") }
  if (isAssessmentKind(kind)) { return renderAssessmentProduct(kind, { ...document, features: scoped }, bounds, options, renderTemplateDocument) }
  const scene: TemplateScene = { kind, features: [], rows: [], legend: [], source, unit: metadata.unit || options.field || "value", time: metadata.observedAt || "", note: "" }
  if (options.normalization) { scene.note = "密度 = 原统计区总量 / 原统计区面积（km²）；使用完整原区面积，不按框选面积分摊总量。" }
  const event = metadata.event
  if (event?.coordinates) {
    const p = event.coordinates
    if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) { throw new Error("震中坐标无效") }
    if (p[0] >= bounds.west && p[0] <= bounds.east && p[1] >= bounds.south && p[1] <= bounds.north) {
      scene.annotations = [{ position: p.slice(0, 2), label: required(event.name, "震中名称"), symbolKind: "dbt-current-epicenter" }]
    }
  }
  const values: number[] = []
  let features = scoped
  const field = options.field || "value"
  const risk = ["risk-overlay", "post-quake-risk", "building-resilience"].includes(kind)
  if (["thermal-infrared", "insar-deformation", "instrumental-intensity"].includes(kind)) {
    const dataset = parseEarthquakeGeoJson({ ...document, features: scoped })
    const operation = { "thermal-infrared": "thermal", "insar-deformation": "deformation", "instrumental-intensity": "intensity" } as const
    const result = analyzeEarthquakeDataset(dataset, operation[kind], bounds, { thermalZ: options.threshold ?? 2, coherenceMin: options.coherence ?? 0.4, deformationMm: options.threshold ?? 20 })
    scene.features = result.points.map((p, i) => paint(point([p.lon, p.lat]), p.value, p.color, String(i), 16, p.label))
    scene.legend = earthquakeLegend(result.palette); scene.unit = result.unit; scene.note = `${result.method}；${result.caution}；剔除 ${result.excludedCount} 个无效点`
    return finish(scene)
  }
  if (["trajectory", "swarm-trajectory"].includes(kind)) {
    const groups = new Map<string, Array<{ feature: TemplateFeature; time: number }>>()
    for (const feature of document.features) {
      if (feature.geometry.type !== "Point") { throw new Error("轨迹需要 Point 要素") }
      const track = required(feature.properties.track_id, "track_id")
      const entry = { feature, time: date(feature.properties.observedAt, "observedAt") }
      groups.set(track, [...groups.get(track) || [], entry])
    }
    const allTimes = [...groups.values()].flat().map(entry => entry.time)
    const cutoff = Math.min(...allTimes) + (Math.max(...allTimes) - Math.min(...allTimes)) * Math.max(0, Math.min(1, (options.progress ?? 100) / 100))
    if (kind === "swarm-trajectory" && metadata.depthUnit !== "km") { throw new Error("depthUnit 必须为 km") }
    if (kind === "swarm-trajectory") { required(metadata.magnitudeType, "magnitudeType 震级标度") }
    for (const [track, group] of groups) {
      group.sort((a, b) => a.time - b.time)
      if (group.some((item, i) => i > 0 && item.time === group[i - 1].time)) { throw new Error(`${track} 存在重复时刻，请核查轨迹`) }
      const active = group.filter(item => item.time <= cutoff)
      for (let i = 0; i < active.length; i++) {
        const current = active[i].feature
        let value = i ? distance(active[i - 1].feature as any, current as any, { units: "kilometers" }) * 1000 / ((active[i].time - active[i - 1].time) / 1000) : 0
        let size = 12
        if (kind === "swarm-trajectory") { value = number(current.properties, "depth_km", 0, 800); size = 8 + (number(current.properties, "magnitude", -2, 10) + 2) * 3 }
        const color = sampleTemplatePalette(["#65d9eb", "#ee654f"], kind === "swarm-trajectory" ? value / 100 : i / Math.max(1, group.length - 1))
        const visible = clip(current, bounds)
        if (visible) { scene.features.push(paint(visible, value, color, `${track}-${i}`, size, `${track} · ${new Date(active[i].time).toISOString()}`)) }
        if (i) {
          const segment = clip(lineString([(active[i - 1].feature.geometry as any).coordinates, (current.geometry as any).coordinates]), bounds)
          if (segment) { scene.features.push({ ...paint(segment, value, color, `${track}-line-${i}`), properties: { ...paint(segment, value, color, `${track}-line-${i}`).properties, arrow: true } }) }
        }
      }
    }
    scene.unit = kind === "swarm-trajectory" ? "km" : "m/s"
    scene.legend = [{ label: kind === "swarm-trajectory" ? "浅源 → 深源（0–100 km；超出取端点色）" : "轨迹时间：早 → 晚", color: "#65d9eb" }, { label: "轨迹方向", color: "#ee654f" }]
    scene.note = kind === "swarm-trajectory" ? "按声明的震群编号与发震时间连线；点径表示震级，不代表传播或预测路径。" : "按 track_id 分组、observedAt 排序；速度由相邻观测距离与时间差计算。"
    return finish(scene)
  }
  if (kind === "time-compare") {
    if (date(metadata.beforeTime, "beforeTime") >= date(metadata.afterTime, "afterTime")) { throw new Error("后期时间必须晚于前期") }
    required(metadata.unit, "两期共同 unit")
    scene.note = "同一要素两期数值对比；差值 = 后期 − 前期，不是底图伪造的变化。"
  }
  if (kind === "anomaly-composite") {
    required(metadata.model, "model 模型与版本"); required(metadata.normalization, "normalization 归一化说明")
    if (!Array.isArray(metadata.weights) || metadata.weights.length !== 3 || metadata.weights.some((v: unknown) => typeof v !== "number" || !Number.isFinite(v) || v < 0) || metadata.weights.reduce((a: number, b: number) => a + b, 0) <= 0) { throw new Error("weights 须为热、形变、地震活动性三个非负权重，且总和大于 0") }
    scene.note = "已归一化指标按声明权重求加权均值；异常指数不等于地震发生概率。"
  }
  if (kind === "risk-overlay" && metadata.riskModel !== "relative-screening-v1") { throw new Error("riskModel 须为 relative-screening-v1") }
  if (["post-quake-risk", "building-resilience"].includes(kind)) { required(metadata.model, "model 评估方法与版本"); scene.note = "渲染导入的评估成果，不从影像推断风险或房屋抗震能力。" }
  if (kind === "intensity-distribution") {
    if (metadata.intensityStandard !== "GB/T 17742-2020") { throw new Error("请声明 intensityStandard=GB/T 17742-2020") }
    required(metadata.assessment, "assessment 烈度成果来源"); scene.unit = "度"; scene.note = "渲染已评定的 VI–XI 度成果，不根据底图生成等震线。"
  }
  if (kind === "population-exposure") {
    const economic = options.exposure === "asset_value"
    if (!economic && metadata.populationUnit !== "人") { throw new Error("populationUnit 必须为 人") }
    required(metadata.assessment, "assessment 暴露与烈度成果来源")
    features = features.filter(feature => number(feature.properties, "intensity", 1, 12) >= (options.threshold ?? 6))
    scene.unit = economic ? required(metadata.assetUnit, "assetUnit 资产统计单位") : "人"
    scene.note = economic ? "选中受影响分区的完整资产价值；暴露量不等于经济损失，不按裁切面积分摊。" : "选中受影响分区的完整人口数，不按裁切面积推算人数或经济损失。"
  }
  if (kind === "flow-direction") { required(metadata.unit, "flow_rate 单位 unit") }
  const categories = new Map<string, string>()
  for (const feature of features) {
    const p = feature.properties
    let value: number
    if (["secondary-hazard", "emergency-command", "unique-value"].includes(kind)) {
      const key = { "secondary-hazard": "hazard_type", "emergency-command": "status" }[kind] || field
      const category = String(p[key] ?? "").trim()
      if (!category) { throw new Error(`缺少 ${key}`) }
      const colors: Record<string, string> = { 滑坡: "#ef9946", 崩塌: "#b17752", 泥石流: "#bc6b48", 堰塞湖: "#339adb", 火灾: "#e34848", available: "#39bad5", blocked: "#ed644e", unknown: "#a3a8b2" }
      if (kind === "emergency-command") {
        required(p.resource_type, "resource_type")
        if (!["available", "blocked", "unknown"].includes(category)) { throw new Error("status 须为 available / blocked / unknown") }
        if (!["Point", "LineString", "MultiLineString"].includes(feature.geometry.type)) { throw new Error("应急资源须为点或路线") }
      }
      value = kind === "secondary-hazard" ? number(p, "severity", 1, 3) : 1
      if (!categories.has(category)) { categories.set(category, options.categoryColors?.[category] || metadata.categoryColors?.[category] || colors[category] || categoryColor(category)) }
      if (categories.size > 24) { throw new Error("类别超过 24，请先筛选数据") }
      const painted = paint(feature, value, categories.get(category)!, p.templateId, 10 + value * 5, `${p.name || p.resource_type || category} · ${category}`)
      painted.properties.renderedCategory = category
      if (feature.geometry.type === "Point" && kind === "emergency-command") {
        painted.properties.symbolKind = { 医院: "dbt-medical", 学校: "dbt-school", 避难场所: "dbt-refuge", 机场: "dbt-airport" }[p.resource_type as string]
      }
      if (feature.geometry.type === "Point" && kind === "secondary-hazard" && ["滑坡", "崩塌", "泥石流"].includes(category)) { painted.properties.symbolKind = "dbt-geohazard" }
      scene.features.push(painted)
      continue
    }
    if (kind === "risk-overlay") {
      value = number(p, "hazard_index", 0, 1) * number(p, "exposure_index", 0, 1) * number(p, "vulnerability_index", 0, 1)
      scene.unit = "0–1"; scene.note = "R = 危险性 × 暴露 × 脆弱性；相对筛查指数，不是伤亡概率。"
    } else if (kind === "post-quake-risk") {
      value = number(p, "risk_index", 0, 1); scene.unit = "0–1"
    } else if (kind === "building-resilience") {
      if (!["Polygon", "MultiPolygon"].includes(feature.geometry.type)) { throw new Error("建筑物地震易损性需要真实建筑面") }
      value = number(p, "vulnerability_index", 0, 1); scene.unit = "脆弱性 0–1"
    } else if (kind === "population-exposure") {
      value = number(p, options.exposure || "population", 0)
      if (!["Polygon", "MultiPolygon"].includes(feature.geometry.type)) { throw new Error("暴露统计需要分区或网格面") }
    } else if (kind === "anomaly-composite") {
      const weights = metadata.weights as number[]
      value = ["thermal_index", "deformation_index", "seismic_index"].reduce((sum, name, index) => sum + number(p, name, 0, 1) * weights[index], 0) / weights.reduce((a, b) => a + b, 0)
      scene.unit = "0–1"
    } else if (kind === "intensity-distribution") {
      value = number(p, "intensity", 6, 11)
      if (!Number.isInteger(value)) { throw new Error("intensity 必须为 VI–XI 对应的整数 6–11") }
    } else if (kind === "time-compare") {
      const before = number(p, "before"); const after = number(p, "after")
      value = after - before
      if (options.compare === "before") { value = before }
      if (options.compare === "after") { value = after }
    } else if (kind === "flow-direction") {
      if (!["LineString", "MultiLineString"].includes(feature.geometry.type)) { throw new Error("流向需要有方向的 LineString") }
      value = number(p, "flow_rate", 0)
    } else { value = number(p, field) }
    values.push(value)
  }
  if (categories.size) { scene.legend = [...categories].sort(([a], [b]) => a.localeCompare(b, "zh-CN", { numeric: true })).map(([label, color]) => ({ label: options.categoryLabels?.[label] || metadata.categoryLabels?.[label] || (/^\d+$/.test(label) ? `分类代码 ${label}` : label), color })); scene.unit = "类别"; return finish(scene) }
  if (!values.length) { throw new Error("框选范围和阈值条件内没有有效要素") }
  const mapping = templateMapping(values, options.palette || "sequential-blue", options.method || "natural", options.count ?? 5, "classified")
  const colors = risk ? [EARTHQUAKE_COLORS.risk.low, EARTHQUAKE_COLORS.risk.medium, EARTHQUAKE_COLORS.risk.high] : ["#61d0e5", "#2379b5", "#ef794f"]
  const max = Math.max(...values); const min = Math.min(...values)
  const symbolBreaks = [...new Set(classBreaks(values, options.method || "natural", options.count ?? 5))]
  const symbolSizes = symbolBreaks.map((_, index) => 10 + 30 * index / Math.max(1, symbolBreaks.length - 1))
  const symbolColor = "#2379b5"
  scene.legend = mapping.legend
  if (kind === "graduated-symbol") {
    scene.legend = symbolBreaks.map((end, index) => ({ label: `${index ? "(" : "["}${legendNumber(index ? symbolBreaks[index - 1] : min)}, ${legendNumber(end)}] ${scene.unit}`, color: symbolColor, radius: symbolSizes[index] / 2, shape: "point" }))
    scene.note = "同一级使用相同圆径；面要素以区内代表点表示，不代表实测站点或地理影响半径。"
  }
  if (kind === "proportional-symbol") {
    if (max <= 0) { throw new Error("比例符号需要至少一个正值，零值不绘制圆") }
    scene.legend = [max / 4, max / 2, max].map(value => ({ label: `${legendNumber(value)} ${scene.unit}`, value, color: symbolColor, radius: 20 * Math.sqrt(value / max), shape: "point" }))
    scene.note = "圆面积与数值成正比，零值不绘制圆；面要素使用区内代表点，不代表实测站点。"
  }
  const rampColors = mapTemplatePalettes[options.palette || "terrain"] || mapTemplatePalettes.terrain
  if (kind === "raster-ramp") {
    scene.legend = Array.from({ length: 5 }, (_, i) => ({ label: (min + (max - min) * i / 4).toFixed(2), color: sampleTemplatePalette(rampColors, i / 4) }))
  }
  if (risk) { scene.legend = [{ label: "常规 · <0.0833", color: colors[0] }, { label: "关注 · 0.0833–0.25", color: colors[1] }, { label: "优先核查 · ≥0.25", color: colors[2] }] }
  if (kind === "intensity-distribution") {
    scene.legend = [...new Set(values)].sort((a, b) => b - a).map(value => ({ label: `${Object.keys(INTENSITY_COLORS)[value - 6]}度（${value}度）`, color: Object.values(INTENSITY_COLORS)[value - 6] }))
  }
  if (kind === "time-compare") {
    const label = { difference: "差值", before: "前期", after: "后期" }[options.compare || "difference"]
    scene.legend = [{ label: `${label} · ${min.toFixed(2)} ${scene.unit}`, color: "#2166ac" }, { label: `0 ${scene.unit}`, color: "#f7f7f7" }, { label: `${max.toFixed(2)} ${scene.unit}`, color: "#b2182b" }]
  }
  scene.features = features.map((feature, index) => {
    const value = values[index]
    let color = mapping.color(value) || colors[0]
    if (kind === "raster-ramp") { color = sampleTemplatePalette(rampColors, (value - min) / Math.max(max - min, 1e-9)) }
    if (risk) { color = colors[0]; if (value >= 0.25 / 3) { color = colors[1] }; if (value >= 0.25) { color = colors[2] } }
    if (kind === "intensity-distribution") { color = Object.values(INTENSITY_COLORS)[value - 6] }
    if (kind === "time-compare") { color = sampleTemplatePalette(["#2166ac", "#f7f7f7", "#b2182b"], 0.5 + value / (2 * Math.max(Math.abs(min), Math.abs(max), 1e-9))) }
    let geometry = feature
    if (["graduated-symbol", "proportional-symbol", "point-heat"].includes(kind)) {
      if (value < 0) { throw new Error("比例符号和热力权重不能为负数") }
      geometry = { ...feature, geometry: pointOnFeature(feature).geometry }
    }
    const level = symbolBreaks.findIndex(end => value <= end)
    let size = 14
    if (kind === "graduated-symbol") { size = symbolSizes[level < 0 ? symbolSizes.length - 1 : level] }
    if (kind === "proportional-symbol") { size = 40 * Math.sqrt(value / max) }
    if (["graduated-symbol", "proportional-symbol"].includes(kind)) { color = symbolColor }
    const result = paint(geometry, value, color, feature.properties.templateId, size)
    if (kind === "intensity-distribution") {
      result.properties.opacity = 0.25
      const g = feature.geometry
      const ring = g.type === "Polygon" ? g.coordinates[0] : undefined
      const position = ring ? ring[Math.floor((ring.length - 1) * 0.15)] : pointOnFeature(feature).geometry.coordinates
      ;(scene.annotations ||= []).push({ position, label: `${Object.keys(INTENSITY_COLORS)[value - 6]}度（${value}度）` })
    }
    if (kind === "flow-direction") { result.properties.arrow = true; result.properties.width = 2 + 6 * value / Math.max(1, max) }
    return result
  })
  if (["raster-ramp", "raster-threshold"].includes(kind)) {
    const coordinates: number[][] = document.features.map(f => {
      if (f.geometry.type !== "Point") { throw new Error("栅格模板需要完整规则 Point 网格") }
      return f.geometry.coordinates as number[]
    })
    const xs = [...new Set(coordinates.map(c => c[0]))].sort((a, b) => a - b); const ys = [...new Set(coordinates.map(c => c[1]))].sort((a, b) => a - b)
    const regular = (axis: number[]) => axis.length >= 2 && axis.every((v, i) => !i || Math.abs(v - axis[i - 1] - (axis[1] - axis[0])) < 1e-7)
    const grid = metadata.gridDefinition
    if (grid) {
      if (![grid.west, grid.north, grid.dx, grid.dy].every(Number.isFinite) || grid.dx <= 0 || grid.dy <= 0 || !Number.isInteger(grid.width) || !Number.isInteger(grid.height) || grid.width < 1 || grid.height < 1 || grid.width * grid.height > 2000 || grid.missing !== "omit") { throw new Error("显式规则网格定义无效") }
      const seen = new Set<string>()
      for (const [x, y] of coordinates) {
        const col = (x - grid.west) / grid.dx - 0.5; const row = (grid.north - y) / grid.dy - 0.5
        const key = `${Math.round(col)},${Math.round(row)}`
        if (Math.abs(col - Math.round(col)) > 1e-7 || Math.abs(row - Math.round(row)) > 1e-7 || col < 0 || row < 0 || col >= grid.width || row >= grid.height || seen.has(key)) { throw new Error("数据坐标不在声明网格的像元中心，或存在重复像元") }
        seen.add(key)
      }
    } else if (!regular(xs) || !regular(ys) || xs.length * ys.length !== coordinates.length || new Set(coordinates.map(c => `${c[0]},${c[1]}`)).size !== coordinates.length) { throw new Error("栅格模板需要完整规则 Point 网格") }
    const dx = (grid ? grid.dx : xs[1] - xs[0]) / 2; const dy = (grid ? grid.dy : ys[1] - ys[0]) / 2
    scene.features = scene.features.map(f => {
      const [x, y] = (f.geometry as GeoJSON.Point).coordinates
      const left = Math.max(bounds.west, x - dx); const right = Math.min(bounds.east, x + dx); const bottom = Math.max(bounds.south, y - dy); const top = Math.min(bounds.north, y + dy)
      return polygon([[[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]]], { ...f.properties, rasterCell: true })
    })
    if (grid) {
      const known = new Set(coordinates.map(c => `${c[0]},${c[1]}`))
      for (let row = 0; row < grid.height; row++) {
        for (let col = 0; col < grid.width; col++) {
          const x = grid.west + (col + 0.5) * grid.dx; const y = grid.north - (row + 0.5) * grid.dy
          if (known.has(`${x},${y}`)) { continue }
          const left = Math.max(bounds.west, x - dx); const right = Math.min(bounds.east, x + dx); const bottom = Math.max(bounds.south, y - dy); const top = Math.min(bounds.north, y + dy)
          if (left >= right || bottom >= top) { continue }
          scene.features.push(polygon([[[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]]], { color: "#d9dee5", noData: true, rasterCell: true, value: null, name: "NoData（缺测）" }))
        }
      }
      if (coordinates.length < grid.width * grid.height) { scene.legend.push({ label: "NoData（缺测，非零值）", color: "#d9dee5" }) }
    }
    scene.note = "导入规则采样网格，按声明单位渲染；未执行遥感物理反演。"
    if (metadata.referenceOnly) { scene.note += " 参考数据；预报与观测非严格同时，不作为地震异常或预报误差检验。缺测不补零、不插值。" }
  }
  if (kind === "point-heat") {
    scene.heat = scene.features.map(feature => ({ lng: (feature.geometry as any).coordinates[0], lat: (feature.geometry as any).coordinates[1], value: feature.properties.value }))
    if (!scene.heat.some(p => p.value > 0)) { throw new Error("没有正值热力权重") }
    scene.heatColors = mapTemplatePalettes[options.palette || "heat"] || mapTemplatePalettes.heat
    scene.legend = scene.heatColors.map((color, index) => ({ label: `${["低", "较低", "中", "较高", "高"][index]} · 加权热力`, color }))
    scene.note = "heatmap.js 加权核热力；点位沿用输入坐标，核半径为显示像素，不是物理影响半径。"
  }
  if (kind === "contour") {
    if (scene.features.some(f => f.geometry.type !== "Point")) { throw new Error("等值线需要完整规则 Point 网格") }
    const coordinates = scene.features.map(f => (f.geometry as GeoJSON.Point).coordinates)
    const xs = [...new Set(coordinates.map(c => c[0]))].sort((a, b) => a - b)
    const ys = [...new Set(coordinates.map(c => c[1]))].sort((a, b) => a - b)
    const pairs = new Set(coordinates.map(c => `${c[0]},${c[1]}`))
    const regular = (axis: number[]) => axis.length >= 2 && axis.every((value, index) => !index || Math.abs(value - axis[index - 1] - (axis[1] - axis[0])) < 1e-7)
    if (xs.length * ys.length !== pairs.size || pairs.size !== scene.features.length || !regular(xs) || !regular(ys)) { throw new Error("等值线需要完整规则 Point 网格；请导入带真实指标的采样数据") }
    const levels = Array.from({ length: options.count ?? 5 }, (_, index) => min + (max - min) * (index + 1) / ((options.count ?? 5) + 1))
    const lines = isolines(featureCollection(scene.features) as any, levels, { zProperty: "value" })
    scene.features = lines.features.filter(f => f.geometry.coordinates.some(line => line.length > 1)).map((f, i) => paint(f, Number(f.properties?.value), sampleTemplatePalette(["#cfe8ff", "#12639a"], i / Math.max(1, levels.length - 1)), String(i)))
    for (const feature of scene.features) {
      const line = (feature.geometry as GeoJSON.MultiLineString).coordinates.find(line => line.length > 5)
      if (line) { (scene.annotations ||= []).push({ position: line[Math.floor(line.length / 2)], label: `${feature.properties.value.toFixed(0)} ${scene.unit}` }) }
    }
    scene.legend = levels.map((value, i) => ({ label: `${value.toFixed(2)} ${scene.unit}`, color: sampleTemplatePalette(["#cfe8ff", "#12639a"], i / Math.max(1, levels.length - 1)) }))
  }
  return finish(scene)
}

function finish(scene: TemplateScene) {
  if (!scene.features.length) { throw new Error("当前范围或时间位置没有可渲染要素") }
  scene.rows = scene.features.filter(f => !f.properties.noData && (scene.kind === "flow-direction" || !f.properties.arrow)).map(f => ({ id: f.properties.templateId, label: f.properties.name, value: f.properties.value, color: f.properties.color, category: f.properties.renderedCategory, sourceFeatureId: f.properties.sourceFeatureId }))
  return scene
}

export function rgbGridDocument(data: Uint8ClampedArray, width: number, height: number, bounds: GeoBounds): TemplateDocument {
  const features: TemplateFeature[] = []
  const columns = 32; const rows = 24
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const px = Math.round(x / (columns - 1) * (width - 1)); const py = Math.round(y / (rows - 1) * (height - 1)); const index = (py * width + px) * 4
      const value = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722
      features.push(point([bounds.west + x / (columns - 1) * (bounds.east - bounds.west), bounds.north - y / (rows - 1) * (bounds.north - bounds.south)], { value }))
    }
  }
  return { ...featureCollection(features), metadata: { source: "框选底图 RGB 亮度采样（非高程、温度或灾害指标）", unit: "RGB 亮度" } }
}
