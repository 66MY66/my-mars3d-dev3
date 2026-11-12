import { area, bboxClip, booleanIntersects, bboxPolygon, intersect, featureCollection } from "@turf/turf"
import { dbtTemplates } from "./dbt116-standard"
import { TEMPLATE_CONTRACTS, type TemplateDocument } from "./template-renderer"
import type { RemoteItem } from "./remote-cartography-source"
import type { RectInfo } from "./map"
import { backendResultKind } from "./backend-result-layers"
import { matchesSupplementalAsset, type SupplementalAdapter } from "./supplemental-cartography"
import { remoteLayerAssets } from "./remote-cartography-source"
import { eventParametersAsset } from "./backend-event-parameters"
import { assessmentContracts, isAssessmentKind } from "./assessment-products"
import { productDefinition } from "./product-definitions"

export type SourceAdapter = "assessment-product" | "business-vector" | "population" | "economy" | "imagery" | "rate" | "lst" | "event-parameters" | "hazard-reference" | "fault-reference" | "thermal-background" | "insar-background" | "thermal-anomaly" | "result-layer" | SupplementalAdapter
export type WorkflowRequirement = { key: string; label: string; role: string; group: "required" | "topic" | "optional"; adapter?: SourceAdapter; note: string }
export type WorkflowStatus = "pending" | "loading" | "empty" | "failed" | "unverified"
const requirement = (key: string, label: string, role: string, group: WorkflowRequirement["group"], note: string, adapter?: SourceAdapter): WorkflowRequirement => ({ key, label, role, group, note, adapter })
const population = requirement("population", "人口分布", "population", "topic", "数值栅格或统计单元人口；单位、年份及总量／密度口径须核验", "population")
const economy = requirement("economy", "经济分布", "economy", "topic", "GDP 等经济指标；不是资产价值或经济损失", "economy")
const imagery = requirement("imagery", "遥感影像", "imagery", "topic", "需要采集时间、空间分辨率及地理定位；影像不是损毁评估成果", "imagery")
const targets = ["医院", "学校", "水库", "桥梁", "危险源"].map((name, i) => requirement(`target-${i}`, `${name}分布`, "target", "topic", "真实几何、名称、类别、稳定标识和数据日期"))
const intensity = requirement("intensity", "烈度评估分区", "intensity", "required", "按后台实际几何加载；评估方法、来源单位、版本和适用用途在审核中核对", "assessment-intensity")
const event = requirement("event", "地震事件参数", "event", "required", "后台条目提供的随包震情参数；缺正式事件号、审核与主震级类型时不补造", "event-parameters")
const lst = requirement("lst", "Landsat 地表温度", "imagery", "topic", "后台原值网格与真实位置；单位未确认，无多期基线，不认定热异常", "lst")
const bases = [
  requirement("boundary", "行政区面", "boundary", "required", "I48/H48 县级面及 PAC；原图年份未注明，正式比例尺和版本仍需核验", "admin-area"),
  requirement("border-line", "国界省界与行政界线", "boundary", "optional", "国界省界汇编线或图幅界线，不能替代可统计的行政区面", "border-line"),
  requirement("settlement", "居民地名称", "settlement", "required", "使用后台 NAME/GNID 注记点，不推断行政驻地等级", "settlement-name"),
  requirement("settlement-area", "居民地面", "settlement", "optional", "真实居民地块，不是建筑损毁成果", "settlement-area"),
  requirement("water", "河流", "water", "required", "I48/H48 真实水系线", "water-line"),
  requirement("water-area", "水面", "water", "optional", "I48/H48 真实水系面", "water-area"),
  requirement("transport", "公路", "transport", "required", "公路名称、编号与等级，不代表通行或损毁状态", "road-line"),
  requirement("rail", "铁路", "transport", "optional", "真实铁路线路，源资料未提供受损或运行状态", "rail-line"),
  requirement("dem", "地形", "dem", "required", "地理定位明确的 DEM 或地形产品")
]
const standardTopics: Record<string, WorkflowRequirement[]> = {
  T30101000: [requirement("distance", "城市或交通设施距离", "distance", "optional", "由已叠加的真实震中与居民地或交通几何计算，不是必须另行交付的后台文件")],
  T30102000: [population, economy, requirement("building", "房屋建筑分布", "building", "topic", "建筑物真实轮廓、分类及来源")],
  T30103000: targets,
  T30201000: [requirement("fault", "活动断层线", "fault", "required", "全国汇编活动断层线，不是九寨沟专项调查", "active-faults"), requirement("fault-reference", "断裂带范围参考", "fault", "optional", "仅参考，不计为活动断层线", "fault-reference")],
  T30202000: [requirement("capacity", "防震减灾能力成果", "capacity", "topic", "能力评估、避难场所、物资等正式业务成果")],
  T30203000: [imagery, population, ...targets, requirement("building", "建筑损毁成果", "building", "topic", "已评估损毁类别及真实建筑轮廓"), requirement("geohazard", "已核查次生灾害", "geohazard", "topic", "灾害类别、核查状态与评估等级"), requirement("hazard-reference", "待核查隐患参考", "geohazard", "optional", "仅参考，不计为已确认灾害", "hazard-reference")]
}

export function workflowRequirements(id: string): WorkflowRequirement[] {
  if (id === "imagery-comparison") { return [requirement("imagery-before", "灾前影像", "imagery", "required", "同一事件前的可比RGB影像，需配准、分辨率和处理级别依据", "imagery"), requirement("imagery-after", "灾后影像", "imagery", "required", "事件后的同配准、同指标RGB影像；影像差异不自动认定为震害", "imagery")] }
  if (isAssessmentKind(id)) { return [requirement("assessment", assessmentContracts[id].name, "business", "required", productDefinition(id)!.boundary, "assessment-product"), { ...event, group: "optional" }, ...bases.filter(entry => ["boundary", "settlement", "water", "transport"].includes(entry.key)).map(entry => ({ ...entry, group: "optional" as const }))] }
  if (standardTopics[id]) { return [event, intensity, ...standardTopics[id], ...bases] }
  if (id === "intensity-distribution") { return [intensity, requirement("fault", "活动断层线", "fault", "optional", "全国汇编活动断层线", "active-faults"), ...bases.map(entry => ({ ...entry, group: "optional" as const }))] }
  if (["raster-ramp", "raster-threshold"].includes(id)) {
    return [{ ...population, group: "topic" }, { ...economy, group: "topic" }, lst]
  }
  if (id === "contour") { return [requirement("contour", "等值线成果", "business", "required", "读取真实规则采样点及数值字段后生成等值线；不从底图截图推算数值", "business-vector")] }
  if (id === "insar-deformation") {
    return [requirement("los", "LOS 位移与相干性", "imagery", "required", "位移 mm、正负方向、相干性及成像对", "business-vector"), requirement("rate", "形变速率参考", "imagery", "optional", "速率原值参考；不执行 LOS 位移阈值分析", "rate"), requirement("background", "形变背景网格", "imagery", "optional", "后台均值、标准差与样本数；不冒充累计 LOS 位移", "insar-background"), requirement("result-layer", "已汇交背景图层", "imagery", "optional", "读取真实汇交后的网格，保留来源与指标", "result-layer")]
  }
  if (id === "thermal-infrared") {
    return [{ ...lst, group: "optional" }, requirement("thermal", "历史基线与异常判定依据", "imagery", "required", "多期地表温度、质量标识、基线时段、样本与标准差；单幅 LST 不替代历史基线", "business-vector"), { ...imagery, group: "optional" }, requirement("background", "亮温背景网格", "imagery", "optional", "后台实际背景指标；样本不足不能称为充分历史基线", "thermal-background"), requirement("anomaly", "后台热异常要素", "imagery", "optional", "异常指数不是地震烈度，不生成缺失的灾损事实", "thermal-anomaly")]
  }
  if (id === "secondary-hazard") { return [requirement("hazard", "已确认次生灾害", "geohazard", "required", "灾害类型、等级、核查状态与成果来源"), requirement("hazard-reference", "待核查隐患参考", "geohazard", "optional", "不推断缺失的灾害等级", "hazard-reference")] }
  const contract = TEMPLATE_CONTRACTS[id]
  return [requirement("business", contract?.name ? `${contract.name}业务数据` : "专题业务数据", "business", "required", contract ? `${contract.geometry}；必需字段：${contract.fields.join("、")}；需来源、单位及数据时间` : "待配置专题数据契约", "business-vector"), ...(["choropleth", "unique-value", "population-exposure"].includes(id) ? bases.filter(entry => ["boundary", "settlement"].includes(entry.key)).map(entry => ({ ...entry, group: "optional" as const })) : [])]
}

export function workflowRequiresCore(id: string) { return !standardTopics[id] && workflowRequirements(id).some(entry => entry.group === "required") }
export function workflowName(id: string) { return productDefinition(id)?.name || dbtTemplates.find(t => t.id === id)?.name || TEMPLATE_CONTRACTS[id]?.name || "专题制图" }
export function workflowCollection(adapter: SourceAdapter) {
  if (["business-vector", "assessment-product"].includes(adapter)) { return "*" }
  return ({ population: "spatial-thematic", economy: "spatial-thematic", imagery: "fy3-mersi-l1", rate: "insar-deformation", "hazard-reference": "geohazard-spot", "fault-reference": "spatial-thematic", "thermal-background": "thermal-background", "insar-background": "thermal-background", "thermal-anomaly": "thermal-anomaly", "result-layer": "thematic-map" } as Partial<Record<SourceAdapter, string>>)[adapter] || "spatial-thematic"
}
export function workflowAssets(item: RemoteItem, adapter: SourceAdapter, bounds?: RectInfo | null) {
  if (adapter === "event-parameters") { return eventParametersAsset(item) }
  const assets = remoteLayerAssets(item)
  if (["business-vector", "assessment-product"].includes(adapter)) { return assets.filter(asset => asset.kind === "vector") }
  return ["assessment-intensity", "active-faults", "admin-area", "border-line", "settlement-name", "settlement-area", "water-line", "water-area", "road-line", "rail-line"].includes(adapter) ? assets.filter(asset => matchesSupplementalAsset(item, asset.key, adapter, bounds)) : assets
}
export function productionItem(item: RemoteItem) {
  // Availability is not formal approval. Never infer validity from a catalog name.
  return item.type === "Feature" && !!item.id && !!item.collection && !!item.assets && !!item.properties
}
export function matchesWorkflowItem(item: RemoteItem, adapter: SourceAdapter) {
  if (!productionItem(item) || (!["business-vector", "assessment-product"].includes(adapter) && item.collection !== workflowCollection(adapter))) { return false }
  const declared = item.properties["cartography:role"]
  if (adapter === "population") { return declared === "population" || /^SP-(china|luding)-pop2020$/.test(item.id) }
  if (adapter === "economy") { return declared === "economy" || /^SP-(china|luding)-gdp2020$/.test(item.id) }
  if (adapter === "lst") { return item.id === "SP-landsat-lst-20260216" }
  if (adapter === "fault-reference") { return item.id === "SP-fault_zones_shp" }
  if (["thermal-background", "insar-background", "thermal-anomaly"].includes(adapter)) { return backendResultKind(item) === adapter }
  if (adapter === "result-layer") { return backendResultKind(item) === "insar-background" && /geojson|geo\+json/.test(item.assets.data?.type || "") }
  return workflowAssets(item, adapter).length > 0
}
export function intersectBounds(a: RectInfo, b: RectInfo): RectInfo | null {
  const bounds = { west: Math.max(a.west, b.west), south: Math.max(a.south, b.south), east: Math.min(a.east, b.east), north: Math.min(a.north, b.north) }
  return bounds.west < bounds.east && bounds.south < bounds.north ? bounds : null
}
export function containsBounds(outer: RectInfo, inner: RectInfo) { return outer.west <= inner.west && outer.south <= inner.south && outer.east >= inner.east && outer.north >= inner.north }
export function scopeFingerprint(bounds: RectInfo | null) { return bounds ? [bounds.west, bounds.south, bounds.east, bounds.north].map(v => v.toFixed(8)).join(",") : "" }

export function clipWorkflowVector(document: TemplateDocument, bounds: RectInfo): TemplateDocument {
  const extent: [number, number, number, number] = [bounds.west, bounds.south, bounds.east, bounds.north]
  const area = bboxPolygon(extent)
  const identified = document.features.map((feature, index) => ({ ...feature, properties: { ...feature.properties, sourceFeatureId: feature.properties.sourceFeatureId ?? feature.id ?? index } }))
  const features = identified.filter(f => booleanIntersects(f, area)).flatMap(feature => {
    if (/Polygon$/.test(feature.geometry.type)) {
      const clipped = intersect(featureCollection([feature as any, area]))
      return clipped ? [{ ...feature, geometry: clipped.geometry } as typeof feature] : []
    }
    const clipped = feature.geometry.type === "Point" ? feature : bboxClip(feature as any, extent) as typeof feature
    return clipped.geometry.coordinates.length ? [clipped] : []
  })
  return { ...document, metadata: { ...document.metadata, sourceAreaKm2ById: document.metadata.sourceAreaKm2ById || sourceAreas(document) }, features }
}
function sourceAreas(document: TemplateDocument) { return Object.fromEntries(document.features.flatMap((feature, index) => /Polygon$/.test(feature.geometry.type) ? [[String(feature.properties.sourceFeatureId ?? feature.id ?? index), area(feature) / 1_000_000]] : [])) }

export function workflowMissing(id: string, loaded: string[]) {
  const requirements = workflowRequirements(id)
  const missing = requirements.filter(r => r.group === "required" && !loaded.includes(r.key)).map(r => r.label)
  const choices = requirements.filter(r => r.group === "topic")
  if (choices.length && !choices.some(r => loaded.includes(r.key))) { missing.push(`至少一类专题数据：${choices.map(r => r.label).join("／")}`) }
  return missing
}
