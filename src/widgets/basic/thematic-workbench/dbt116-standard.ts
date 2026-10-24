import { bbox, booleanValid, destination, point, featureCollection } from "@turf/turf"
import type { Feature, FeatureCollection, Geometry, Position } from "geojson"
import { dbtSymbolDefinitions, type DbtSymbolKind } from "./dbt116-symbols"
import { baseRequirements, clipLand, containedInBounds, coversBounds, dbtBaseRoles, dbtMapCode, dbtRegion, dbtRoleNames, fitDbtBounds, insideBounds, intensityBands, validBounds } from "./dbt-cartography-rules"

export const DBT_STANDARD = "地震应急响应专题图制作要求（2025-05-05报批稿）"
export const DBT_CLASSIFICATION = "DB/T 101-2024"
export const dbtTemplates = [
  { id: "T30101000", name: "基本情况专题图", clause: "7.1.1 / 9.3.1", roles: ["distance", "station"], summary: "震中位置、周边行政区、灾害或交通分布" },
  { id: "T30102000", name: "社会经济分布专题图", clause: "7.1.2 / 9.3.2", roles: ["population", "building", "economy"], summary: "人口、房屋建筑或经济分布" },
  { id: "T30103000", name: "重点关注目标分布专题图", clause: "7.1.3 / 9.3.3", roles: ["target"], summary: "医院、学校、桥梁、水库或危险源的数量、分布与影响" },
  { id: "T30201000", name: "快速评估地震影响范围专题图", clause: "7.1.4 / 9.3.4", roles: ["fault"], summary: "最高烈度、影响面积、长短轴、分区面积与人口" },
  { id: "T30202000", name: "快速评估地震灾区防震减灾能力专题图", clause: "7.1.5 / 9.3.5", roles: ["pga", "refuge", "supplies", "capacity"], summary: "减灾能力、建筑抗震设防、避难场所或物资储备" },
  { id: "T30203000", name: "快速评估地震重灾区救灾相关信息专题图", clause: "7.1.6 / 9.3.6", roles: ["imagery", "building", "target", "population", "rescue-area", "geohazard"], summary: "重灾区行政区、地势、救灾目标、道路与次生灾害" }
] as const
export type DbtTemplateId = typeof dbtTemplates[number]["id"]
export type DbtBounds = { west: number; south: number; east: number; north: number }
export type DbtLayer = {
  id: string; name: string; role: string; authority: string; publishedAt: string; source: string
  crs: string; security: string; scale: number; data: FeatureCollection
  color?: string; colorStandard?: string; parameterEvidence?: string
  unit?: string; enabled?: boolean; coverage?: DbtBounds; coverageEvidence?: string; crsEvidence?: string
  legend?: Array<{ label: string; color: string; value?: number }>
  raster?: { image: string; bounds: DbtBounds; rendering: "hillshade" | "imagery" | "classified"; radiometry: string }
}
export type DbtDocument = {
  version: 1; crs: string; usage?: "test" | "operational"
  event: { time: string; place: string; magnitude: number; magnitudeType: string; longitude: number; latitude: number; authority: string; bulletin: string }
  region: { zone: "R1" | "R2" | "R3"; province: string; prefecture: string; evidence: string; offshore?: boolean }
  agency: string; createdAt: string; description: string; layers: DbtLayer[]
  classification?: { instance: string; spatial: string }
  assessment?: Record<string, number>
  crsEvidence?: string
}
export type DbtIssue = { clause: string; message: string; severity: "error" | "review" | "warning" }
export const dbtReviewClauses = [
  { clause: "4.1 / 4.2 / 4.6 / 4.7", label: "震级与烈度用法、台网正式震情、行业数据来源、现势性及非涉密性已核验" },
  { clause: "4.9 / 5", label: "坐标确为 CGCS2000 地理坐标（不是改写 CRS 标签），制图分区与实际震中位置一致" },
  { clause: "7 / 8", label: "专题及底图要素完整；界线重合、飞地隶属、分区等级、影像匀光及境外要素已复核" },
  { clause: "9.3 / 9.5", label: "内容说明符合该类别要求，注记内容、层级、遮挡及影像描边已逐项核查" },
  { clause: "10.1", label: "最终图件的数据权威性、现势性、内容完整性、表达合理性已检查" }
]
export function emptyDbtDocument(): DbtDocument {
  return { version: 1, crs: "EPSG:4490", classification: { instance: "00", spatial: "6" }, crsEvidence: "", event: { time: "", place: "", magnitude: 0, magnitudeType: "", longitude: 0, latitude: 0, authority: "", bulletin: "" }, region: { zone: "R2", province: "", prefecture: "", evidence: "" }, agency: "", createdAt: "", description: "", layers: [] }
}
function validDate(value: unknown) { return typeof value === "string" && !!value.trim() && Number.isFinite(Date.parse(value)) }
function nonempty(value: unknown): value is string { return typeof value === "string" && !!value.trim() }
const geometryDepths: Record<string, number> = { Point: 0, MultiPoint: 1, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3 }
function coordinatesValid(value: unknown, depth: number): boolean {
  if (!Array.isArray(value)) { return false }
  if (depth) { return value.length > 0 && value.every(item => coordinatesValid(item, depth - 1)) }
  return value.length >= 2 && value.every(Number.isFinite) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90
}
export function readDbtDocument(raw: unknown): DbtDocument {
  if (!raw || typeof raw !== "object") { throw new Error("需要标准制图数据包 JSON") }
  const doc = raw as DbtDocument
  if (doc.version !== 1 || !doc.event || !doc.region || !Array.isArray(doc.layers) || doc.layers.length > 60) { throw new Error("数据包结构无效：需要 version、event、region、layers") }
  const strings = [doc.crs, doc.agency, doc.createdAt, doc.description, doc.event.time, doc.event.place, doc.event.magnitudeType, doc.event.authority, doc.event.bulletin, doc.region.zone, doc.region.province, doc.region.prefecture, doc.region.evidence]
  if (strings.some(value => typeof value !== "string") || (doc.usage !== undefined && !["test", "operational"].includes(doc.usage))) { throw new Error("制图元数据字段类型无效") }
  if (![doc.event.longitude, doc.event.latitude, doc.event.magnitude].every(Number.isFinite) || Math.abs(doc.event.longitude) > 180 || Math.abs(doc.event.latitude) > 90) { throw new Error("地震参数或经纬度无效") }
  if (doc.classification && (typeof doc.classification.instance !== "string" || typeof doc.classification.spatial !== "string")) { throw new Error("分类编码字段类型无效") }
  if (doc.assessment && Object.values(doc.assessment).some(value => !Number.isFinite(value))) { throw new Error("评估统计必须为有限数值") }
  if (doc.crsEvidence !== undefined && typeof doc.crsEvidence !== "string") { throw new Error("坐标依据字段类型无效") }
  if (doc.region.offshore !== undefined && typeof doc.region.offshore !== "boolean") { throw new Error("近海属性必须为布尔值") }
  const ids = new Set<string>()
  let count = 0
  for (const layer of doc.layers) {
    if (!layer || [layer.id, layer.name, layer.role, layer.authority, layer.publishedAt, layer.source, layer.crs, layer.security].some(value => typeof value !== "string")) { throw new Error("图层元数据字段类型无效") }
    if (!nonempty(layer.id) || ids.has(layer.id) || layer.data?.type !== "FeatureCollection" || !Array.isArray(layer.data.features)) { throw new Error("图层 ID 重复或缺少 GeoJSON FeatureCollection") }
    ids.add(layer.id)
    if (!Object.hasOwn(dbtRoleNames, layer.role)) { throw new Error(`${layer.id} 使用了未知图层角色`) }
    if ([layer.unit, layer.crsEvidence, layer.coverageEvidence, layer.colorStandard, layer.parameterEvidence].some(value => value !== undefined && typeof value !== "string")) { throw new Error(`${layer.id} 图层说明字段类型无效`) }
    if (layer.enabled !== undefined && typeof layer.enabled !== "boolean") { throw new Error(`${layer.id} 图层显示状态无效`) }
    if (layer.coverage && !validBounds(layer.coverage)) { throw new Error(`${layer.id} 数据覆盖范围无效`) }
    if (layer.raster && (!validBounds(layer.raster.bounds) || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(layer.raster.image) || !["hillshade", "imagery", "classified"].includes(layer.raster.rendering))) { throw new Error(`${layer.id} 栅格必须为带地理范围的内嵌 PNG/JPG`) }
    if (layer.raster && typeof layer.raster.radiometry !== "string") { throw new Error(`${layer.id} 栅格处理说明字段类型无效`) }
    if (layer.legend && (!Array.isArray(layer.legend) || layer.legend.length > 30 || layer.legend.some(row => !nonempty(row.label) || !/^#[\da-f]{6}$/i.test(row.color)))) { throw new Error(`${layer.id} 图例无效`) }
    for (const feature of layer.data.features) {
      const geometry = feature?.geometry
      if (feature?.type !== "Feature" || !geometry || !(geometry.type in geometryDepths) || !coordinatesValid((geometry as { coordinates?: unknown }).coordinates, geometryDepths[geometry.type])) { throw new Error(`${layer.id} 存在无效几何；坐标顺序须为经度、纬度`) }
      if (JSON.stringify(geometry).length > 2_000_000 || ++count > 20000) { throw new Error("单个几何或要素数超过交互制图限制") }
      if (!feature.properties || typeof feature.properties !== "object" || !booleanValid(feature)) { throw new Error(`${layer.id} 几何拓扑或要素属性无效`) }
      if (feature.properties?.symbol && !Object.hasOwn(dbtSymbolDefinitions, feature.properties.symbol)) { throw new Error(`${layer.id} 含未收录的标准符号`) }
    }
  }
  return JSON.parse(JSON.stringify(doc)) as DbtDocument
}
export function intensityLabel(value: number) {
  const roman = ["", "Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ", "Ⅺ", "Ⅻ"]
  return Number.isInteger(value) && value >= 1 && value <= 12 ? `${roman[value]}度(${value}度)` : ""
}
export function intensityThreshold(doc: DbtDocument, id: DbtTemplateId) {
  if (id === "T30203000") { return 8 }
  if (id.startsWith("T302") || doc.event.magnitude >= 6.5) { return 6 }
  const maximum = Math.max(0, ...intensityFeatures(doc).map(feature => Number(feature.properties?.intensity) || 0))
  return Math.min(5, maximum)
}
export function intensityFeatures(doc: DbtDocument) {
  return doc.layers.filter(layer => layer.role === "intensity").flatMap(layer => layer.data.features)
    .filter(feature => ["Polygon", "MultiPolygon"].includes(feature.geometry.type) && !!intensityLabel(Number(feature.properties?.intensity)))
}
export function standardBounds(doc: DbtDocument, id: DbtTemplateId): DbtBounds | null {
  const threshold = intensityThreshold(doc, id)
  const features = clipLand(intensityFeatures(doc).filter(feature => Number(feature.properties?.intensity) >= threshold), doc)
  if (!features.length || !threshold || Math.abs(doc.event.latitude) > 80) { return null }
  const [west, south, east, north] = bbox(featureCollection(features))
  // Buffer every bounding edge geodesically by 10 km, then center the rectangle on the epicenter.
  const corners = [[west, south], [west, north], [east, south], [east, north]]
  const expanded = corners.flatMap(p => [0, 90, 180, 270].map(bearing => destination(point(p), 10, bearing).geometry.coordinates))
  const dx = Math.max(...expanded.map(p => Math.abs(p[0] - doc.event.longitude)))
  const dy = Math.max(...expanded.map(p => Math.abs(p[1] - doc.event.latitude)))
  if (dx > 30 || dy > 30) { return null }
  const result = fitDbtBounds({ west: doc.event.longitude - dx, east: doc.event.longitude + dx, south: doc.event.latitude - dy, north: doc.event.latitude + dy })
  return validBounds(result) ? result : null
}
export function dbtTitle(doc: DbtDocument, id: DbtTemplateId) {
  const date = doc.event.time ? doc.event.time.slice(0, 10) : "[发震日期]"
  return `${date} ${doc.event.place || "[震中地名]"} ${doc.event.magnitude || "[震级]"}级地震 ${dbtTemplates.find(item => item.id === id)!.name}`
}
export function dbtFeatureSymbol(layer: DbtLayer, feature: Feature): DbtSymbolKind | undefined {
  if (Object.hasOwn(dbtSymbolDefinitions, feature.properties?.symbol || "")) { return feature.properties!.symbol as DbtSymbolKind }
  const roles: Record<string, DbtSymbolKind> = { station: "dbt-station", history: "dbt-historical-epicenter", aftershock: "dbt-aftershock", fault: "dbt-fault", intensity: "dbt-isoseismal", pga: "dbt-pga", refuge: "dbt-refuge", "rescue-area": "dbt-rescue-area", geohazard: "dbt-geohazard" }
  return roles[layer.role]
}
export function dbtVisibleLayers(doc: DbtDocument, id: DbtTemplateId) {
  const base = ["boundary", "settlement", "water", "transport", "dem", "intensity"]
  const roles = [...base, ...dbtTemplates.find(item => item.id === id)!.roles] as string[]
  if (id === "T30101000") { roles.push("history") }
  if (id === "T30203000") { roles.push("aftershock", "fault", "imagery") }
  return doc.layers.filter(layer => layer.enabled !== false && roles.includes(layer.role))
}
export function dbtScopedLayers(doc: DbtDocument, id: DbtTemplateId) {
  const bounds = standardBounds(doc, id)
  return dbtVisibleLayers(doc, id).map(layer => {
    let features = layer.data.features
    if (layer.role === "intensity") { features = clipLand(features.filter(f => Number(f.properties?.intensity) >= intensityThreshold(doc, id)), doc) }
    if (layer.role === "history") { features = features.filter(f => Math.abs(Number(f.properties?.magnitude) - doc.event.magnitude) <= 0.5) }
    if (bounds) { features = features.filter(f => insideBounds(f, bounds)) }
    return { ...layer, data: { ...layer.data, features } }
  })
}
export function inspectDbtDocument(doc: DbtDocument | null, id: DbtTemplateId): DbtIssue[] {
  if (!doc) { return [{ clause: "4.6 / 4.9", severity: "error", message: "尚未导入权威 CGCS2000 标准制图数据包" }] }
  const issues: DbtIssue[] = []
  const error = (clause: string, message: string) => issues.push({ clause, message, severity: "error" })
  if (doc.usage !== "operational") { error("4.6 / 10.1", "当前为测试/未声明用途的数据，只能导出带测试标识的校样，禁止正式出图") }
  if (doc.crs !== "EPSG:4490" || doc.layers.some(layer => layer.crs !== "EPSG:4490")) { error("4.9", "图件及所有图层必须为 CGCS2000 地理坐标 EPSG:4490；不接受直接截图或改写标签") }
  if (!nonempty(doc.crsEvidence)) { error("4.9", "缺少 CGCS2000 数据原始坐标或转换成果依据") }
  try { dbtMapCode(id, doc.classification?.instance, doc.classification?.spatial) } catch (err) { error("DB/T 101 第5章", (err as Error).message) }
  if (!validDate(doc.event.time) || !nonempty(doc.event.place) || doc.event.magnitude <= 0 || doc.event.magnitude > 10 || !nonempty(doc.event.magnitudeType)) { error("4.1 / 9.1", "发震时间、震中地名、震级及震级类型不完整") }
  if (!/中国地震台网|中国地震速报台网|CENC/i.test(doc.event.authority) || /非|合成|模拟|虚构|test/i.test(doc.event.authority + doc.event.bulletin) || !nonempty(doc.event.bulletin)) { error("4.6", "缺少中国地震台网正式震情来源及公告编号/链接") }
  if (!["R1", "R2", "R3"].includes(doc.region.zone) || !nonempty(doc.region.evidence) || !nonempty(doc.region.province)) { error("5", "缺少按震中位置确定的制图分区及依据") }
  const zone = dbtRegion(doc.region.province, doc.region.prefecture, doc.region.offshore)
  if (!zone || zone !== doc.region.zone) { error("5 表1", "制图分区与震中所属省市或近海属性不一致，须核实行政归属") }
  if (!doc.agency?.trim() || !validDate(doc.createdAt) || !doc.description?.trim()) { error("9.1 / 9.3", "制作单位、制图时间及该类别内容说明必须填写") }
  const bounds = standardBounds(doc, id)
  const visible = dbtScopedLayers(doc, id)
  for (const layer of visible) {
    if (!nonempty(layer.authority) || !nonempty(layer.source) || !validDate(layer.publishedAt) || !["public", "declassified"].includes(layer.security)) { error("4.6 / 4.7", `${layer.name || layer.id}：缺少行业来源、数据日期或非涉密/脱密证明`) }
    if (!Number.isFinite(layer.scale) || layer.scale <= 0) { error("4.7", `${layer.name || layer.id}：缺少数据比例尺`) } else if (layer.scale > 1_000_000) { issues.push({ clause: "4.7", severity: "warning", message: `${layer.name} 比例尺小于推荐的 1:1,000,000，需核查适用性` }) }
    if (/合成|模拟|虚构|test/i.test(layer.authority + layer.source)) { error("4.6", `${layer.name} 为测试来源，不能仅修改用途后作为正式数据`) }
    if (!nonempty(layer.crsEvidence)) { error("4.9", `${layer.name} 缺少原始坐标或转换依据`) }
    if (!layer.data.features.length && !layer.raster) { error("7 / 8", `${layer.name || layer.id} 在制图范围内没有要素，不能作为已具备图层`) }
    if (bounds && dbtBaseRoles.includes(layer.role) && (!coversBounds(layer.coverage || layer.raster?.bounds, bounds) || !nonempty(layer.coverageEvidence))) { error("8", `${layer.name} 缺少覆盖整个制图范围的完整性依据`) }
    if (layer.role === "dem" && layer.raster?.rendering !== "hillshade") { error("8.2.5", "地形底图需提供分级设色/晕渲栅格，等高示意线不能代替 DEM 晕渲") }
    if (layer.raster && !nonempty(layer.raster.radiometry)) { error("7.2.6 / 8.2.5", `${layer.name} 缺少匀光或晕渲处理说明`) }
    if (layer.raster && bounds && ["dem", "imagery"].includes(layer.role) && !coversBounds(layer.raster.bounds, bounds)) { error("8 / 10.1", `${layer.name} 实际栅格范围未覆盖全图，不会拉伸补齐缺失区域`) }
    for (const feature of layer.data.features) {
      const symbol = dbtFeatureSymbol(layer, feature)
      if (symbol && dbtSymbolDefinitions[symbol].geometry === "point" && !["Point", "MultiPoint"].includes(feature.geometry.type)) { error("9.4", `${layer.name} 点状符号不能用于线或面几何`); break }
      if (["boundary", "water", "transport"].includes(layer.role) && !symbol) { error("9.4 / 附录 B", `${layer.name} 缺少基础地理要素标准符号编码`); break }
      if (["Point", "MultiPoint"].includes(feature.geometry.type) && !dbtFeatureSymbol(layer, feature)) { error("9.4 / 附录 B", `${layer.name} 点要素缺少标准符号编码`); break }
      if (layer.role === "intensity" && !intensityLabel(Number(feature.properties?.intensity))) { error("7.2.4", `${layer.name} 存在缺失或无效烈度（应为 1–12 整数）`); break }
      if (["history", "aftershock"].includes(layer.role) && (!validDate(feature.properties?.occurredAt) || !Number.isFinite(feature.properties?.magnitude))) { error("7.2.1 / 7.2.6", `${layer.name} 缺少发震时间或震级`); break }
      if (layer.role === "history" && (!nonempty(feature.properties?.label) || !Number.isFinite(feature.properties?.casualties))) { error("7.2.1", "历史地震缺少震中位置或人员伤亡记录"); break }
      if (["boundary", "settlement", "fault"].includes(layer.role) && !nonempty(feature.properties?.label)) { error("8 / 9.5", `${layer.name} 缺少要素名称注记`); break }
      if (["target", "geohazard", "capacity"].includes(layer.role) && !nonempty(feature.properties?.category)) { error("7.2", `${layer.name} 缺少类别或级别字段 category`); break }
    }
    if (layer.role === "pga") {
      if (!nonempty(layer.parameterEvidence) || !/GB\s*18306/.test(layer.parameterEvidence) || !/GB\s*55002/.test(layer.parameterEvidence)) { error("7.2.5", "地震动参数缺少 GB 18306（含适用修改单）与 GB 55002 对应关系的核验依据") }
      if (layer.data.features.some(f => !Number.isFinite(f.properties?.pga) || f.properties!.pga <= 0 || !Number.isInteger(f.properties?.designIntensity) || f.properties!.designIntensity < 6 || f.properties!.designIntensity > 9)) { error("7.2.5", "地震动参数需提供正值 pga（gₙ）和 designIntensity（6–9度），不自动推算对应关系") }
    }
    if (["population", "economy"].includes(layer.role) && layer.data.features.some(f => !Number.isFinite(f.properties?.[layer.role === "population" ? "population" : "value"]))) { error("9.3.2", `${layer.name} 缺少可汇总数值字段`) }
    if (bounds && ["population", "economy"].includes(layer.role) && layer.data.features.some(f => !containedInBounds(f, bounds))) { error("9.3.2", `${layer.name} 统计单元跨出图件范围；需提供范围内已核算指标，禁止按面积摊分人口或经济数值`) }
    if (layer.role === "economy" && !nonempty(layer.unit)) { error("9.3.2", `${layer.name} 缺少经济指标单位`) }
    if (layer.legend?.length && !nonempty(layer.colorStandard)) { error("9.4", `${layer.name} 分级色带缺少配色依据`) }
  }
  if (!bounds) { error("6 表 2", `缺少 ${intensityLabel(intensityThreshold(doc, id)) || "有效烈度"}及以上的快速评估烈度面，无法生成外扩 10 km 的制图范围`) }
  const roles = new Set(visible.filter(layer => layer.data.features.length || layer.raster).map(layer => layer.role))
  if (id !== "T30101000" && !roles.has("intensity")) { error("7.1", "当前类别必须显示快速评估等震线，不可隐藏") }
  const instanceRoles: Partial<Record<DbtTemplateId, Record<string, string>>> = {
    T30101000: { "01": "transport", "02": "distance" },
    T30102000: { "01": "population", "02": "building", "03": "economy" },
    T30202000: { "02": "pga" },
    T30203000: { "01": "dem", "02": "imagery", "03": "settlement", "04": "target", "05": "transport", "06": "geohazard" }
  }
  const instanceRole = instanceRoles[id]?.[doc.classification?.instance || "00"]
  if (instanceRole && !roles.has(instanceRole)) { error("DB/T 101 第5章", `实例代码所指专题数据未显示：${dbtRoleNames[instanceRole]}`) }
  if (id === "T30103000" && doc.classification?.instance && !["00", "99"].includes(doc.classification.instance)) {
    const targetNames: Record<string, RegExp> = { "01": /医院|medical|hospital/i, "02": /学校|school/i, "03": /水库|reservoir/i, "04": /桥梁|bridge/i, "05": /危险|hazard/i }
    const pattern = targetNames[doc.classification.instance]
    if (pattern && !visible.filter(layer => layer.role === "target").some(layer => layer.data.features.some(f => pattern.test(`${f.properties?.category || ""} ${f.properties?.symbol || ""}`)))) { error("DB/T 101 第5章", "重点目标实例代码与图中实际目标类别不一致") }
  }
  const required = dbtTemplates.find(template => template.id === id)!
  if (!required.roles.some(role => roles.has(role))) { error(required.clause, `缺少该模板所需专题数据：${required.summary}`) }
  for (const role of ["boundary", "settlement", "water", "transport", "dem"]) {
    if (!roles.has(role)) { error("8.1", `缺少地理底图要素：${({ boundary: "行政区划", settlement: "居民地", water: "水系", transport: "交通", dem: "数字高程模型" })[role]}`) }
  }
  const requirements = baseRequirements(doc, id, visible)
  for (const [role, requirement] of Object.entries(requirements)) {
    if (!visible.some(layer => layer.role === role && nonempty(layer.coverageEvidence))) { error("8.2", `${dbtRoleNames[role]}：须核验${requirement}并提供完整性依据`) }
  }
  if (doc.region.zone === "R3" && !doc.layers.some(layer => layer.role === "land" && layer.data.features.length && nonempty(layer.source) && nonempty(layer.authority))) { error("7.2.4e", "近海制图需要带权威来源的陆地面用于裁切等震线") }
  if (id === "T30201000") {
    if (["longAxisKm", "shortAxisKm", "azimuth"].some(key => !Number.isFinite(doc.assessment?.[key])) || (doc.assessment?.longAxisKm || 0) <= 0 || (doc.assessment?.shortAxisKm || 0) <= 0 || (doc.assessment?.azimuth || 0) < 0 || (doc.assessment?.azimuth || 0) >= 360) { error("9.3.4", "缺少评估成果中的长轴长度、短轴长度、长轴走向（0–360°）") }
    if (intensityBands(visible).some(band => band.population === null)) { error("9.3.4", "缺少各烈度区人口 zonePopulation，不能用像素统计代替人口") }
  }
  for (const layer of doc.layers.filter(layer => layer.role === "land" && doc.region.zone === "R3")) {
    if (!nonempty(layer.crsEvidence) || !validDate(layer.publishedAt) || !["public", "declassified"].includes(layer.security) || /合成|模拟|test/i.test(layer.authority + layer.source)) { error("4.6 / 4.9", "近海裁切使用的陆地范围缺少权威来源、坐标或非涉密依据") }
  }
  return issues
}
export function geometryPositions(geometry: Geometry): Position[] {
  if (geometry.type === "GeometryCollection") { return geometry.geometries.flatMap(geometryPositions) }
  const values: Position[] = []
  const visit = (item: unknown) => { if (!Array.isArray(item)) { return }; if (typeof item[0] === "number") { values.push(item as Position) } else { item.forEach(visit) } }
  visit(geometry.coordinates)
  return values
}
