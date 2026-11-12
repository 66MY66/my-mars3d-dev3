import { area, bbox, bboxPolygon, booleanIntersects, difference, featureCollection, intersect, union } from "@turf/turf"
import type { Feature, MultiPolygon, Polygon } from "geojson"
import type { DbtBounds, DbtDocument, DbtLayer, DbtTemplateId } from "./dbt116-standard"
import { populationSummary } from "./population-grid"
import { referenceGridSummary } from "./source-reference-grid"
import { socioeconomicMetrics } from "./socioeconomic-metrics"

export const dbtInstances: Record<DbtTemplateId, Record<string, string>> = {
  T30101000: { "00": "不区分实例", "01": "交通分布", "02": "主要城市震中距", 99: "其他基本情况" },
  T30102000: { "00": "不区分实例", "01": "人口分布", "02": "房屋建筑", "03": "国内生产总值", 99: "其他社会经济" },
  T30103000: { "00": "不区分实例", "01": "医院", "02": "学校", "03": "水库", "04": "桥梁", "05": "危险源", 99: "其他重点目标" },
  T30201000: { "00": "不区分实例", 99: "其他影响范围" },
  T30202000: { "00": "不区分实例", "01": "地震减灾能力", "02": "地震动参数区划", 99: "其他减灾能力" },
  T30203000: { "00": "不区分实例", "01": "地形", "02": "遥感影像", "03": "居民地", "04": "重点救灾目标", "05": "救灾道路", "06": "地震滑坡危险性", 99: "其他救灾信息" }
}
export const dbtSpatialCodes: Record<string, string> = { 0: "不区分范围", 1: "全球或多国", 2: "全国", 3: "跨省", 4: "全省", 5: "省内地区", 6: "震中及附近", 7: "火山或水库附近", 9: "其他范围" }
export function dbtMapCode(id: DbtTemplateId, instance = "00", spatial = "6") {
  if (!Object.hasOwn(dbtInstances[id], instance) || !Object.hasOwn(dbtSpatialCodes, spatial)) { throw new Error("专题图实例或空间范围代码不符合 DB/T 101-2024") }
  return `${id.slice(0, 6)}${instance}${spatial}`
}

const sparse: Record<string, string[] | "all"> = {
  内蒙古: "all",
西藏: "all",
新疆: "all",
  黑龙江: ["伊春", "黑河", "大兴安岭"],
四川: ["阿坝", "甘孜"],
  甘肃: ["嘉峪关", "金昌", "武威", "张掖", "酒泉", "甘南"],
青海: ["海北", "黄南", "海南", "果洛", "玉树", "海西"]
}
const provinces = "北京 天津 河北 山西 内蒙古 辽宁 吉林 黑龙江 上海 江苏 浙江 安徽 福建 江西 山东 河南 湖北 湖南 广东 广西 海南 重庆 四川 贵州 云南 西藏 陕西 甘肃 青海 宁夏 新疆 台湾 香港 澳门".split(" ")
export function dbtRegion(province: string, prefecture: string, offshore = false): "R1" | "R2" | "R3" | null {
  if (offshore) { return "R3" }
  const name = provinces.find(item => province.trim().startsWith(item))
  if (!name) { return null }
  const rule = sparse[name]
  if (rule === "all") { return "R1" }
  if (rule && !prefecture.trim()) { return null }
  return rule?.some(item => prefecture.trim().startsWith(item)) ? "R1" : "R2"
}

export const dbtBaseRoles = ["boundary", "settlement", "water", "transport", "dem"]
export const dbtRoleNames: Record<string, string> = {
  event: "地震事件参数",
  boundary: "行政界线",
settlement: "居民地",
water: "水系",
transport: "交通",
dem: "地形高程",
imagery: "遥感影像",
  intensity: "快速评估等震线",
station: "监测中心站",
distance: "震中距",
history: "历史地震",
aftershock: "余震",
  population: "人口分布",
building: "建筑物",
economy: "经济分布",
target: "重点目标",
fault: "活动断层",
  pga: "地震动参数区划",
refuge: "避难场所",
supplies: "物资储备",
capacity: "减灾能力",
"rescue-area": "救援建议区",
geohazard: "地质灾害",
land: "陆地范围"
}
export function validBounds(bounds?: DbtBounds): bounds is DbtBounds {
  return !!bounds && [bounds.west, bounds.east, bounds.south, bounds.north].every(Number.isFinite) && bounds.west < bounds.east && bounds.south < bounds.north && bounds.west >= -180 && bounds.east <= 180 && bounds.south >= -90 && bounds.north <= 90
}
export function fitDbtBounds(bounds: DbtBounds): DbtBounds {
  const ratio = 1076 / 802
  const cx = (bounds.east + bounds.west) / 2; const cy = (bounds.south + bounds.north) / 2
  const dx = Math.max((bounds.east - bounds.west) / 2, (bounds.north - bounds.south) * ratio / 2)
  return { west: cx - dx, east: cx + dx, south: cy - dx / ratio, north: cy + dx / ratio }
}
export function coversBounds(outer: DbtBounds | undefined, inner: DbtBounds) {
  return validBounds(outer) && outer.west <= inner.west && outer.east >= inner.east && outer.south <= inner.south && outer.north >= inner.north
}
export function insideBounds(feature: Feature, bounds: DbtBounds) {
  return booleanIntersects(feature, bboxPolygon([bounds.west, bounds.south, bounds.east, bounds.north]))
}
export function containedInBounds(feature: Feature, bounds: DbtBounds) {
  const [west, south, east, north] = bbox(feature)
  return west >= bounds.west && east <= bounds.east && south >= bounds.south && north <= bounds.north
}
export function polygonUnion(features: Feature[]): Feature<Polygon | MultiPolygon> | null {
  const polygons = features.filter(f => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") as Feature<Polygon | MultiPolygon>[]
  return polygons.length > 1 ? union(featureCollection(polygons)) : polygons[0] || null
}
export function clipLand(features: Feature[], doc: DbtDocument): Feature[] {
  if (doc.region.zone !== "R3") { return features }
  const land = polygonUnion(doc.layers.filter(layer => layer.role === "land").flatMap(layer => layer.data.features))
  if (!land) { return [] }
  return features.flatMap(feature => {
    if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") { return [] }
    const clipped = intersect(featureCollection([feature as Feature<Polygon | MultiPolygon>, land]))
    return clipped ? [{ ...clipped, properties: feature.properties }] : []
  })
}

export type DbtStatistic = { label: string; value: number | null; unit: string; note?: string }
export type IntensityBand = { intensity: number; areaKm2: number; population: number | null }
// Nested isoseismal envelopes are differenced before reporting areas; never sum overlapping envelopes.
export function intensityBands(layers: DbtLayer[]): IntensityBand[] {
  const features = layers.filter(layer => layer.role === "intensity").flatMap(layer => layer.data.features)
  const levels = [...new Set(features.map(f => Number(f.properties?.intensity)))].filter(Number.isFinite).sort((a, b) => b - a)
  let higher: Feature<Polygon | MultiPolygon> | null = null
  return levels.flatMap(intensity => {
    const group = features.filter(f => Number(f.properties?.intensity) === intensity)
    const envelope = polygonUnion(group)
    if (!envelope) { return [] }
    const band = higher ? difference(featureCollection([envelope, higher])) : envelope
    higher = polygonUnion([envelope, ...(higher ? [higher] : [])])
    const hasPopulation = group.every(f => Number.isFinite(f.properties?.zonePopulation) && f.properties!.zonePopulation >= 0)
    return [{ intensity, areaKm2: band ? area(band) / 1e6 : 0, population: hasPopulation ? group.reduce((sum, f) => sum + f.properties!.zonePopulation, 0) : null }]
  })
}
export function dbtStatistics(doc: DbtDocument, id: DbtTemplateId, layers: DbtLayer[], bounds?: DbtBounds): DbtStatistic[] {
  if (id === "T30201000") {
    const onlineReference = doc.usage === "reference" && layers.some(layer => layer.role === "intensity" && layer.onlineSource)
    if (onlineReference) {
      const features = layers.filter(layer => layer.role === "intensity").flatMap(layer => layer.data.features)
      const levels = features.map(feature => Number(feature.properties?.intensity)).filter(value => Number.isInteger(value) && value >= 1 && value <= 12)
      return [{ label: "最高评估烈度", value: levels.length ? Math.max(...levels) : null, unit: "度（参考）" }, { label: "选区评估要素数", value: features.length, unit: "个", note: "仅为选区内已提供的评估要素，不计算正式影响面积、暴露人口或损失；来源、方法和版本仍待核验。" }]
    }
    const bands = intensityBands(layers)
    return [
      { label: "最高烈度", value: bands[0]?.intensity ?? null, unit: "度" },
      { label: "影响总面积", value: bands.reduce((sum, row) => sum + row.areaKm2, 0), unit: "km²" },
      ...["longAxisKm", "shortAxisKm", "azimuth"].map((key, i) => ({ label: ["长轴长度", "短轴长度", "长轴走向"][i], value: doc.assessment?.[key] ?? null, unit: i === 2 ? "°" : "km" }))
    ]
  }
  const roles = ({ T30102000: ["population", "building", "economy"], T30103000: ["target"], T30202000: ["refuge", "supplies", "capacity"], T30203000: ["target", "rescue-area", "geohazard", "aftershock"] } as Partial<Record<DbtTemplateId, string[]>>)[id] || ["station", "distance", "history"]
  return layers.filter(layer => roles.includes(layer.role)).flatMap(layer => {
    if (layer.role === "population" || layer.role === "economy") {
      if (layer.onlineSource || layer.raster) {
        const summary = layer.onlineSource?.statistics
        return summary
? [
          { label: `${layer.name}原值最小值`, value: summary.minimum, unit: "原始值", note: "按框选内原始像元中心纳入；未重采样，不推算人口或 GDP 总量。" },
          { label: `${layer.name}原值最大值`, value: summary.maximum, unit: "原始值" },
          { label: "有效／缺测像元", value: summary.valid, unit: `／${summary.missing} 格` }
        ]
: [{ label: `${layer.name}业务总量`, value: null, unit: "待核实", note: "图片不能代替原始指标与统计口径，不将空要素集汇总为零。" }]
      }
      if (layer.sourceGrid) {
        const summary = referenceGridSummary(layer.sourceGrid)
        return [{ label: "选区原值最小 / 最大", value: summary.minimum, unit: ` / ${summary.maximum ?? "缺测"}`, note: "仅为最近邻重采样后选区原始数值的范围，不汇总为人口总数或 GDP 金额。" }, { label: "有效 / 缺测像元", value: summary.valid, unit: ` / ${summary.missing} 格` }]
      }
      if (layer.grid) {
        const summary = populationSummary(layer.grid, bounds || (doc.usage === "reference" ? doc.reference?.bounds : undefined))
        return [
          { label: "有效格网人口", value: summary.total, unit: "人", note: "按图幅内像元中心纳入完整源像元；面积按源 CRS 椭球计算，边界像元不按面积摊分人数，缺测不作零人口。数据年份与统计口径以来源记录为准。" },
          { label: "有效格网面积", value: summary.areaKm2, unit: "km²" },
          { label: "有效格网人口密度", value: summary.density, unit: "人/km²" },
          { label: "缺测格网", value: summary.missing, unit: "格" }
        ]
      }
      let metrics: ReturnType<typeof socioeconomicMetrics>
      try { metrics = socioeconomicMetrics(layer) } catch (err) { return [{ label: layer.name, value: null, unit: "", note: err instanceof Error ? err.message : "指标口径无效" }] }
      const missing = metrics.rows.filter(row => row.total === null).length
      const known = metrics.rows.filter(row => row.total !== null)
      const subtotal = known.reduce((sum, row) => sum + row.total!, 0)
      const total = known.length && !missing && Number.isFinite(subtotal) ? subtotal : null
      const note = metrics.inputMetric === "density" ? "按完整统计单元的源密度乘面积积分总量，不将密度直接相加；不按图幅边界摊分，缺测不补零" : "按纳入图件的完整统计单元汇总；跨边界单元不按面积摊分人口或经济指标"
      const result: DbtStatistic[] = [{ label: `${layer.name}${metrics.inputMetric === "density" ? "（密度积分估算）" : ""}`, value: total, unit: metrics.baseUnit, note }]
      if (layer.role === "population") {
        const combined = polygonUnion(layer.data.features); const km2 = combined ? area(combined) / 1e6 : 0
        result.push({ label: "人口统计单元面积", value: km2 || null, unit: "km²" }, { label: "统计单元人口密度", value: km2 && total !== null ? total / km2 : null, unit: "人/km²" })
      }
      if (missing) { result.push({ label: "缺测统计单元", value: missing, unit: "个" }) }
      return result
    }
    const groups = new Map<string, number>()
    for (const f of layer.data.features) {
      const label = String(f.properties?.category || dbtRoleNames[layer.role] || layer.name)
      groups.set(label, (groups.get(label) || 0) + (f.geometry.type === "MultiPoint" ? f.geometry.coordinates.length : 1))
    }
    return [...groups].map(([label, value]) => ({ label, value, unit: "项" }))
  })
}

export function baseRequirements(doc: DbtDocument, id: DbtTemplateId, layers = doc.layers) {
  const sparse = doc.region.zone === "R1"
  const large = doc.event.magnitude >= 7.5
  const pointTheme = layers.filter(layer => !dbtBaseRoles.includes(layer.role) && !["intensity", "land"].includes(layer.role)).every(layer => layer.data.features.every(f => /Point$/.test(f.geometry.type)))
  let settlement = sparse && !large && !pointTheme ? "乡级及以上居民地" : "县级及以上居民地"
  if (id === "T30203000") { settlement = "村级及以上居民地" }
  let water = "河流、水库、湖泊"
  if (id === "T30103000") { water = !large && sparse ? "小型及以上水库" : "中型及以上水库" }
  if (id === "T30203000") { water = sparse ? "湖泊、中型及以上水库、四级及以上河流" : "湖泊、大型水库、三级及以上河流" }
  return {
    boundary: sparse && !large ? "乡级及以上界线" : "县级及以上界线",
    settlement,
    water,
    transport: id === "T30203000" ? "铁路、高速公路、县级及以上公路、机场、码头" : "铁路、高速公路、省级及以上公路、机场、码头"
  }
}
