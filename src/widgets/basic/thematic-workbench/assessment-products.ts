import type { TemplateDocument, TemplateOptions, TemplateScene } from "./template-renderer"
import type { ContentProfile, ContentRecommendation } from "./content-routing"
import type { RectInfo } from "./map"
import { sampleTemplatePalette } from "./template-palettes"

export const assessmentContracts = {
  "building-damage": { name: "建筑物破坏评估专题图", geometry: "Polygon / MultiPolygon", fields: ["building_id", "damage_grade"], metadata: { productType: "building-damage", eventId: "", assessment: "", gradeDefinition: [] } },
  "road-damage": { name: "公路震害专题图", geometry: "LineString / MultiLineString", fields: ["road_id", "damage_grade"], metadata: { productType: "road-damage", eventId: "", assessment: "", gradeDefinition: [] } },
  "geological-disaster": { name: "地震地质灾害专题图", geometry: "Point / Polygon / MultiPolygon", fields: ["hazard_id", "hazard_type", "status"], metadata: { productType: "geological-disaster", eventId: "", assessment: "" } },
  "remote-intensity": { name: "遥感评估地震烈度专题图", geometry: "Polygon / MultiPolygon", fields: ["zone_id", "intensity"], metadata: { productType: "remote-intensity", eventId: "", assessment: "", assessmentMethod: "remote-sensing" } },
  "extreme-zone": { name: "地震极灾区范围专题图", geometry: "Polygon / MultiPolygon", fields: ["zone_id"], metadata: { productType: "extreme-zone", eventId: "", assessment: "", delineationCriteria: "" } },
  "direct-loss": { name: "地震直接经济损失评估专题图", geometry: "Polygon / MultiPolygon", fields: ["region_id", "loss_value"], metadata: { productType: "direct-loss", eventId: "", assessment: "", currencyUnit: "", priceBaseYear: "", lossScope: "direct" } }
}
export type AssessmentKind = keyof typeof assessmentContracts
export function isAssessmentKind(kind: string): kind is AssessmentKind { return Object.prototype.hasOwnProperty.call(assessmentContracts, kind) }
const hazards: Record<string, { label: string; color: string }> = {
  landslide: { label: "滑坡", color: "#d77b24" },
collapse: { label: "崩塌", color: "#a55e40" },
  "debris-flow": { label: "泥石流", color: "#ad4c64" },
"dammed-lake": { label: "堰塞湖", color: "#2485b7" }
}
const hazardCode = (value: unknown) => ({ 滑坡: "landslide", 崩塌: "collapse", 泥石流: "debris-flow", 堰塞湖: "dammed-lake" }[String(value)] || String(value))
const text = (value: unknown) => typeof value === "string" && !!value.trim()
const time = (value: unknown) => text(value) && /(Z|[+-]\d{2}:\d{2})$/.test(String(value)) && Number.isFinite(Date.parse(String(value)))
type Grade = { value: string | number; label: string; order: number; color?: string }
function grades(value: unknown): Grade[] {
  if (!Array.isArray(value) || !value.length || value.length > 12 || value.some(row => !row || !["string", "number"].includes(typeof row.value) || !String(row.value).trim() || !text(row.label) || !Number.isFinite(row.order) || (row.color !== undefined && !/^#[\da-f]{6}$/i.test(row.color))) || new Set(value.map(row => String(row.value))).size !== value.length || new Set(value.map(row => row.order)).size !== value.length) { throw new Error("gradeDefinition 需要来源明确、编码和顺序唯一的等级字典（value、label、order，可选color）") }
  return [...value].sort((a, b) => a.order - b.order)
}

function metadataIssue(kind: AssessmentKind, metadata: Record<string, any>) {
  if (metadata.productType && metadata.productType !== kind) { return `成果声明为${metadata.productType}，不能改名代用为${kind}` }
  if (!text(metadata.eventId) || !text(metadata.assessment) || !time(metadata.observedAt)) { return "需事件标识eventId、评估依据assessment及带时区的成果时间observedAt" }
  if (kind === "building-damage" || kind === "road-damage") { try { grades(metadata.gradeDefinition) } catch (error) { return (error as Error).message } }
  if (kind === "remote-intensity" && metadata.assessmentMethod !== "remote-sensing") { return "需声明assessmentMethod=remote-sensing，其他烈度成果不能改名代用" }
  if (kind === "extreme-zone" && !text(metadata.delineationCriteria)) { return "缺少极灾区判定依据delineationCriteria" }
  if (kind === "direct-loss" && (metadata.lossScope !== "direct" || !/^(CNY|元|万元|亿元|人民币元|人民币万元|人民币亿元)$/.test(metadata.currencyUnit) || !Number.isInteger(metadata.priceBaseYear) || metadata.priceBaseYear < 1900 || metadata.priceBaseYear > 2100)) { return "需直接损失范围lossScope=direct、币值单位currencyUnit及整数价格基准年priceBaseYear" }
  return ""
}
export function assessmentSourceIssue(document: TemplateDocument, kind: AssessmentKind) {
  const issue = metadataIssue(kind, document.metadata || {})
  if (issue) { return issue }
  const contract = assessmentContracts[kind]; const ids = new Set<string>()
  const dictionary = kind === "building-damage" || kind === "road-damage" ? grades(document.metadata.gradeDefinition) : []
  for (const feature of document.features) {
    if (!contract.geometry.split(" / ").includes(feature.geometry.type)) { return `${contract.name}需要${contract.geometry}真实几何` }
    const p = feature.properties
    const missing = contract.fields.filter(field => p[field] === undefined || p[field] === null || String(p[field]).trim() === "")
    if (missing.length) { return `缺少${missing.join("、")}` }
    const id = String(p[contract.fields[0]])
    if (ids.has(id)) { return `稳定标识${id}重复，需合并同一对象后统计` }; ids.add(id)
    if (dictionary.length && !dictionary.some(grade => String(grade.value) === String(p.damage_grade))) { return `破坏等级${p.damage_grade}不在来源等级字典内，不能按完好处理` }
    if (kind === "geological-disaster" && (!hazards[hazardCode(p.hazard_type)] || !["confirmed", "已核查", "已确认"].includes(p.status))) { return "仅接纳已核查的滑坡、崩塌、泥石流或堰塞湖；隐患与其他灾种仍可作为参考资料" }
    if (kind === "remote-intensity" && (!Number.isInteger(p.intensity) || p.intensity < 1 || p.intensity > 12)) { return "intensity须为1–12整数烈度，不接受异常指数" }
    if (kind === "direct-loss" && (typeof p.loss_value !== "number" || !Number.isFinite(p.loss_value) || p.loss_value < 0)) { return "loss_value须为非负损失金额，未知值不能作零" }
  }
  return document.features.length ? "" : "选区内没有符合此产品的成果要素"
}

export function recommendAssessment(profile: ContentProfile, kind: AssessmentKind): ContentRecommendation | null {
  if (profile.kind !== "vector" || metadataIssue(kind, profile.metadata)) { return null }
  const contract = assessmentContracts[kind]
  const group = profile.groups.find(group => contract.geometry.toLowerCase().includes(group.geometry) && contract.fields.every(key => group.fields.some(field => field.key === key && field.present === group.count)))
  if (!group) { return null }
  const gradeValues = kind === "building-damage" || kind === "road-damage" ? grades(profile.metadata.gradeDefinition).map(row => String(row.value)) : []
  if (gradeValues.length && group.fields.find(field => field.key === "damage_grade")!.values.some(value => !gradeValues.includes(String(value)))) { return null }
  if (kind === "geological-disaster" && (group.fields.find(field => field.key === "hazard_type")!.values.some(value => !hazards[hazardCode(value)]) || group.fields.find(field => field.key === "status")!.values.some(value => !["confirmed", "已核查", "已确认"].includes(String(value))))) { return null }
  const numeric = group.fields.find(field => field.key === (kind === "direct-loss" ? "loss_value" : "intensity"))
  if (kind === "direct-loss" && (!numeric || numeric.numeric !== group.count || numeric.minimum! < 0)) { return null }
  if (kind === "remote-intensity" && (!numeric || numeric.integers !== group.count || numeric.minimum! < 1 || numeric.maximum! > 12)) { return null }
  return { geometry: group.geometry, label: contract.name, score: 100, fieldMapping: Object.fromEntries(contract.fields.map(key => [key, key])), evidence: ["已读取成果类型、事件关联、业务字段和评估依据", "匹配不代表业务审核通过"] }
}

export function renderAssessmentProduct(kind: AssessmentKind, document: TemplateDocument, bounds: RectInfo, options: TemplateOptions, render: (kind: string, document: TemplateDocument, bounds: RectInfo, options: TemplateOptions) => TemplateScene): TemplateScene {
  const issue = assessmentSourceIssue(document, kind)
  if (issue) { throw new Error(issue) }
  const metadata = document.metadata
  let result: TemplateScene
  if (kind === "direct-loss") {
    result = render("proportional-symbol", { ...document, metadata: { ...metadata, unit: metadata.currencyUnit } }, bounds, { field: "loss_value", palette: options.palette || "exposure" })
    result.note = `已有直接经济损失评估；${metadata.priceBaseYear}年价格；符号面积与金额成正比。显示相交原统计区金额，不按裁切面积分摊，不输出本选区损失总额。`
  } else {
    const dictionary = kind === "building-damage" || kind === "road-damage" ? grades(metadata.gradeDefinition) : []
    const colors: Record<string, string> = {}; const labels: Record<string, string> = {}
    dictionary.forEach((grade, i) => { const key = String(grade.value); labels[key] = grade.label; colors[key] = grade.color || sampleTemplatePalette(["#fff4cc", "#f1a340", "#b2182b"], i / Math.max(1, dictionary.length - 1)) })
    if (kind === "geological-disaster") { Object.entries(hazards).forEach(([key, row]) => { labels[key] = row.label; colors[key] = row.color }) }
    if (kind === "remote-intensity") { Array.from({ length: 12 }, (_, i) => i + 1).forEach(value => { labels[String(value)] = `${value}度`; colors[String(value)] = metadata.categoryColors?.[value] || sampleTemplatePalette(["#ffffcc", "#fd8d3c", "#bd0026"], (value - 1) / 11) }) }
    if (kind === "extreme-zone") { labels.extreme = "评估极灾区范围"; colors.extreme = "#b91c3b" }
    const field = { "building-damage": "damage_grade", "road-damage": "damage_grade", "geological-disaster": "hazard_type", "remote-intensity": "intensity", "extreme-zone": "__assessment_category" }[kind]
    const prepared = {
 ...document,
features: document.features.map(feature => {
      let value = feature.properties[field]
      if (kind === "extreme-zone") { value = "extreme" }
      if (kind === "geological-disaster") { value = hazardCode(value) }
      return { ...feature, properties: { ...feature.properties, [field]: value } }
    })
}
    result = render("unique-value", prepared, bounds, { field, categoryLabels: labels, categoryColors: colors })
    result.rows = result.rows.map(row => ({ ...row, category: labels[row.category || ""] || row.category }))
    if (dictionary.length) { result.legend.sort((a, b) => dictionary.findIndex(row => row.label === a.label) - dictionary.findIndex(row => row.label === b.label)) }
    if (kind === "remote-intensity") { result.legend.sort((a, b) => Number.parseInt(a.label) - Number.parseInt(b.label)); result.unit = "度" }
    if (kind === "extreme-zone") { result.features.forEach(feature => { feature.properties.opacity = 0.12; feature.properties.width = 3 }) }
    result.note = "仅表示已核查地质灾害；项目灾种配色不代表行业图式认证。"
    if (dictionary.length) { result.note = "等级含义与顺序来自成果字典；缺少来源颜色时采用项目顺序色带，不宣称为规范色表。" }
    if (kind === "remote-intensity") { result.note = "已有遥感烈度评估分区；采用来源颜色或项目等级色带，不宣称为规范色表。" }
    if (kind === "extreme-zone") { result.note = `范围依据：${metadata.delineationCriteria}` }
  }
  return { ...result, kind, source: metadata.source, time: metadata.observedAt, note: `${result.note} 事件：${metadata.eventId}；评估依据：${metadata.assessment}` }
}
