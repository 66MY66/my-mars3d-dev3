import type { ThematicTemplate } from "../dataset-repository/types/eoapi-types"
import { dbtTemplates, type DbtTemplateId } from "./dbt116-standard"
import { dbtRoleNames } from "./dbt-cartography-rules"
import { productDefinition } from "./product-definitions"

export type TemplatePurpose = "all" | "emergency" | "analysis" | "expression" | "deferred"
type EmergencyCatalogEntry = ThematicTemplate & {
  emergencyId: DbtTemplateId
  dataTypes: Array<"vector" | "tabular" | "raster">
  components: string[]
  keywords: string[]
}

export const emergencyCatalog: EmergencyCatalogEntry[] = dbtTemplates.map(item => ({
  templateId: `emergency:${item.id}`,
  emergencyId: item.id,
  templateVersion: "1.0",
  name: item.name,
  description: item.summary,
  category: "应急响应专题",
  parameters: [],
  createdAt: 0,
  dataTypes: item.roles.some(role => role === "imagery") ? ["vector", "tabular", "raster"] : ["vector", "tabular"],
  components: item.roles.map(role => dbtRoleNames[role] || role),
  keywords: [item.id, "应急响应", "DB/T 101-2024", "DB/T 116-2026", item.clause, ...item.roles.map(role => dbtRoleNames[role] || role)]
}))

export function getEmergencyCatalogEntry(template: Pick<ThematicTemplate, "templateId">) {
  return emergencyCatalog.find(item => item.templateId === template.templateId)
}

export function mergeWorkbenchTemplateCatalog(analysis: ThematicTemplate[]): ThematicTemplate[] {
  // Reserve emergency identities for the locally defined topic and validation contracts.
  return [...emergencyCatalog, ...analysis.filter(item => !item.templateId.startsWith("emergency:"))]
}

export function getTemplatePurpose(template: Pick<ThematicTemplate, "templateId">): Exclude<TemplatePurpose, "all"> {
  if (getEmergencyCatalogEntry(template)) { return "emergency" }
  const profile = productProfiles[template.templateId]
  if (profile?.tier === "deferred") { return "deferred" }
  return expressionIds.has(template.templateId) ? "expression" : "analysis"
}

export const catalogTiers = [
  { id: "emergency", label: "应急概况与快速评估" },
  { id: "remote", label: "遥感观测与灾情对比" },
  { id: "damage", label: "震害与损失评估" },
  { id: "assessment", label: "暴露、易损性与风险" },
  { id: "business", label: "救灾保障" },
  { id: "expression", label: "制图表达方法" },
  { id: "auxiliary", label: "项目辅助方法 · 非行业产品分类" },
  { id: "deferred", label: "扩展预留 · 非本期制作范围" }
] as const
type CatalogTier = typeof catalogTiers[number]["id"]
type ProductProfile = { tier: CatalogTier; code?: string; standardName?: string; note: string }
const productProfiles: Record<string, ProductProfile> = {
  earthquake_thermal_infrared: { tier: "remote", code: "T10803000", standardName: "卫星红外异常观测数据产品专题图", note: "参照红外异常产品分类；当前方法为LST时间基线Z分数，亮温、LST和单景空间背景不可混用。" },
  earthquake_insar_deformation: { tier: "remote", code: "T10805000", standardName: "星载合成孔径雷达干涉（InSAR）测量形变专题图", note: "参照InSAR测量形变分类；当前输入为LOS形变量mm，不能将速率mm/年或相位直接代入。" },
  earthquake_post_quake_risk: { tier: "assessment", code: "T20303000", standardName: "地震灾害风险评估专题图", note: "显示既有模型风险指数；分类归属不代表模型通过验收，也不等于伤亡或经济损失。" },
  earthquake_building_resilience: { tier: "assessment", code: "T20302000", standardName: "地震易损性评估专题图", note: "显示建筑易损性指数，不是减灾能力、抗震设防或建筑安全鉴定。" },
  earthquake_population_exposure: { tier: "assessment", note: "人口和资产分别统计；暴露量不是伤亡、GDP或经济损失，没有套用行业实例代码。" },
  earthquake_emergency_command: { tier: "business", note: "资源分布与通行状态显示，不是完整的应急指挥、路线规划或通达性评估。" },
  earthquake_anomaly_composite: { tier: "auxiliary", note: "项目自定义加权指标法；权重、归一化及阈值不是行业规范值，不输出预测概率。" },
  standard_risk_overlay: { tier: "auxiliary", note: "危险性、暴露与易损性指数乘积仅作相对筛查，不是正式损失评估模型或行业产品模板。" },
  earthquake_swarm_trajectory: { tier: "deferred", code: "T10103000", standardName: "地震事件专题图", note: "地震序列扩展；按时间连接的事件不代表破裂或传播路径，非本期遥感与损失评估制作范围。" },
  earthquake_intensity_distribution: { tier: "deferred", note: "烈度调查/评定成果扩展；须先明确仪器、快速评估、遥感评估或综合评定来源，不能统一套一个产品代码。应急图仍使用其对应快速评估等震线。" },
  earthquake_secondary_hazard: { tier: "deferred", note: "实际次生灾害调查扩展；灾害足迹、潜在危险性与易发性不得混用，地质灾害与火灾不能共用同一地质灾害产品代码。" }
}
const expressionIds = new Set(["choropleth", "unique_value", "graduated_symbol", "point_heat", "raster_ramp", "raster_threshold", "contour", "trajectory_replay", "flow_direction", "time_compare", "chart_linkage"].map(id => `standard_${id}`))
export function templateTier(template: Pick<ThematicTemplate, "templateId">): typeof catalogTiers[number]["id"] {
  if (getEmergencyCatalogEntry(template)) { return "emergency" }
  if (expressionIds.has(template.templateId)) { return "expression" }
  const product = productDefinition(template.templateId)
  if (product) { return product.group }
  return productProfiles[template.templateId]?.tier || "auxiliary"
}

export function isProductTemplate(template: Pick<ThematicTemplate, "templateId">) {
  return !["expression", "auxiliary", "deferred"].includes(templateTier(template))
}

export function productCatalog(catalog: ThematicTemplate[]) { return catalog.filter(isProductTemplate) }
export function templateProfessionalIdentity(template: Pick<ThematicTemplate, "templateId">) {
  const emergency = getEmergencyCatalogEntry(template)
  if (emergency) { return { badge: "应急产品", code: emergency.emergencyId, status: "DB/T 101-2024 分类 · DB/T 116-2026 提前采用 · 待图件校核", note: emergency.description || "" } }
  const profile = productProfiles[template.templateId]
  const product = productDefinition(template.templateId)
  if (product && !profile) { return { badge: product.group === "damage" ? "评估产品" : "遥感产品", code: "", status: `${product.standards.join(" · ")} · 待图件与业务校核`, note: product.boundary } }
  if (profile) {
    let badge = "成果表达"
    if (profile.tier === "deferred") { badge = "扩展预留" }
    if (profile.tier === "auxiliary") { badge = "辅助方法" }
    return { badge, code: profile.code || "", status: profile.standardName ? `参照分类：${profile.standardName} · 非合规认证` : `${badge} · 非行业标准模板`, note: profile.note }
  }
  if (expressionIds.has(template.templateId)) { return { badge: "表达方法", code: "", status: "制图表达方法 · 不单独代表行业产品", note: "实际配色、单位、统计口径与图式随所表达的产品及数据确定。" } }
  return { badge: "辅助方法", code: "", status: "项目辅助方法 · 未作为行业标准产品审定", note: "须核对数据含义、方法依据及业务适用性。" }
}
const methods: Record<string, string[]> = {
  T30101000: ["unique_value", "graduated_symbol"],
T30102000: ["choropleth", "graduated_symbol", "raster_ramp", "chart_linkage"],
  T30103000: ["unique_value", "graduated_symbol"],
T30201000: ["unique_value"],
T30202000: ["unique_value", "graduated_symbol", "chart_linkage"],
T30203000: ["unique_value", "choropleth", "time_compare", "chart_linkage"],
  earthquake_anomaly_composite: ["choropleth", "raster_ramp", "time_compare"],
earthquake_thermal_infrared: ["raster_ramp", "raster_threshold", "time_compare"],
  earthquake_post_quake_risk: ["choropleth", "raster_ramp", "chart_linkage"],
earthquake_swarm_trajectory: ["graduated_symbol", "time_compare"],
  earthquake_insar_deformation: ["raster_ramp", "contour", "time_compare"],
earthquake_intensity_distribution: ["unique_value"],
  earthquake_secondary_hazard: ["unique_value", "graduated_symbol"],
earthquake_building_resilience: ["choropleth", "unique_value"],
  earthquake_population_exposure: ["graduated_symbol", "choropleth", "chart_linkage"],
earthquake_emergency_command: ["unique_value"]
}
export function productExpressionIds(product: Pick<ThematicTemplate, "templateId">) {
  const id = getEmergencyCatalogEntry(product)?.emergencyId || product.templateId
  return (methods[id] || []).map(key => `standard_${key}`)
}
export function matchesCatalogProduct(template: Pick<ThematicTemplate, "templateId">, productId: string, catalog: ThematicTemplate[]) {
  if (!productId || productId === "all") { return true }
  if (template.templateId === productId) { return true }
  const product = catalog.find(entry => entry.templateId === productId)
  return !!product && productExpressionIds(product).includes(template.templateId)
}
export function groupTemplateCatalog(catalog: ThematicTemplate[]) {
  return catalogTiers.map(tier => ({ ...tier, items: catalog.filter(template => templateTier(template) === tier.id) })).filter(group => group.items.length)
}
