import { bbox, booleanIntersects, bboxPolygon } from "@turf/turf"
import type { Feature } from "geojson"
import { businessNumber } from "./business-map-data"
import { TEMPLATE_CONTRACTS, type TemplateDocument, type TemplateOptions } from "./template-renderer"
import type { RectInfo } from "./map"
import type { RemoteRasterQuantity } from "./remote-cartography-source"

export type ContentField = { key: string; present: number; numeric: number; integers: number; minimum?: number; maximum?: number; values: Array<string | number | boolean> }
export type ContentMetric = { field: string; label: string; unit: string; total?: boolean; score: number }
export type ContentGroup = { geometry: "point" | "line" | "polygon"; count: number; fields: ContentField[]; metrics: ContentMetric[]; roles: string[] }
export type ContentProfile = { kind: "vector" | "workspace" | "report" | "json" | "raster"; count: number; groups: ContentGroup[]; metadata: Record<string, any>; bounds?: RectInfo; raster?: Record<string, any> }
export type ContentRecommendation = { geometry: ContentGroup["geometry"]; field?: string; unit?: string; label: string; score: number; fieldMapping?: Record<string, string>; normalization?: TemplateOptions["normalization"]; evidence: string[] }

const identifiers = /^(id|fid|objectid|sourceFeatureId|adcode|admin_code|pac|gnid|code|gb|row|col|longitude|latitude|lon|lat|x|y|编号|序号|经度|纬度|shape_?area|shape_?leng(th)?|area_km2|cells|magnitude|depth_km)$/i
export const geometryFamily = (type: string): ContentGroup["geometry"] | undefined => ({ Point: "point", MultiPoint: "point", LineString: "line", MultiLineString: "line", Polygon: "polygon", MultiPolygon: "polygon" }[type] as ContentGroup["geometry"] | undefined)
const keyOf = (fields: ContentField[], names: string[]) => fields.find(field => names.some(name => name.toLowerCase() === field.key.toLowerCase()))
const allNumeric = (field: ContentField | undefined, count: number) => !!field && field.numeric === count
const timestamp = (value: unknown) => typeof value === "string" && /(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))

function summarize(rows: Record<string, any>[]): ContentField[] {
  return [...new Set(rows.flatMap(row => Object.keys(row)))].map(key => {
    const present = rows.map(row => row[key]).filter(value => value !== null && value !== undefined && value !== "")
    const numeric = present.map(businessNumber).filter(value => value !== null) as number[]
    return { key, present: present.length, numeric: numeric.length, integers: numeric.filter(Number.isInteger).length, minimum: numeric.length ? Math.min(...numeric) : undefined, maximum: numeric.length ? Math.max(...numeric) : undefined, values: [...new Set(present.filter(value => ["number", "string", "boolean"].includes(typeof value)))].slice(0, 25) }
  })
}
function metricFor(field: ContentField, count: number, metadata: Record<string, any>, fields: ContentField[]): ContentMetric | null {
  if (!allNumeric(field, count) || identifiers.test(field.key)) { return null }
  const key = field.key.toLowerCase()
  const declared = metadata.fieldUnits?.[field.key] || metadata.units?.[field.key]
  let unit = typeof declared === "string" ? declared : "原始值"
  let score = 20; let total = false
  if (/^(population_density|people_per_km2|人口密度)$/.test(key)) { unit = "人/km²"; score = 100 } else if (/^(population|people|受灾人口|人口数|人口)$/.test(key) && field.minimum! >= 0 && field.integers === count) { unit = "人"; score = 95; total = true } else if (/^(rain_mm|precipitation_mm|降雨量\(mm\)|降雨量（mm）)$/.test(key) && field.minimum! >= 0) { unit = "mm"; score = 90 } else if (/^(pga\(gal\)|pga_gal)$/.test(key) && field.minimum! >= 0) { unit = "gal"; score = 85 } else if (/^(intensity|inty|烈度)$/.test(key) && field.minimum! >= 1 && field.maximum! <= 12 && field.integers === count && !keyOf(fields, ["alice", "max_bt", "background_mean"])) { unit = "度"; score = 80 } else if (/^(damage_rate|损毁率|损坏率)$/.test(key) && field.minimum! >= 0 && field.maximum! <= 1) { unit = "比例（0–1）"; score = 100 } else if (key === "density") { unit = metadata.rowUnit || unit; score = /人|元|cny/i.test(unit) ? 100 : 50 } else if (["mean", "latest", "alice", "max_bt", "max_rate", "slip_mm"].includes(key)) { score = 65; if (key === "slip_mm") { unit = "mm" } } else if (/^倒塌房屋$/.test(key) && field.minimum! >= 0) { score = 75; total = true; unit = "原始计数" }
  if (metadata.valueField === field.key) { score += 20; unit = typeof metadata.unit === "string" ? metadata.unit : unit; if (unit !== "原始值") { score = Math.max(score, 85) } }
  if (field.minimum === field.maximum && score < 75) { return null }
  const labels: Record<string, string> = { population_density: "人口密度", people_per_km2: "人口密度", population: "人口数量", rain_mm: "降水量", precipitation_mm: "降水量", damage_rate: "损毁比例", pga_gal: "峰值地面加速度", mean: "背景均值", latest: "最近观测值", alice: "背景标准化指标", max_bt: "最高亮温原值", max_rate: "最大形变速率原值", slip_mm: "滑移量" }
  return { field: field.key, label: metadata.fieldLabels?.[field.key] || labels[key] || field.key, unit, total, score }
}
function rolesFor(group: ContentGroup): string[] {
  const fields = group.fields; const get = (names: string[]) => keyOf(fields, names)
  const gb = get(["GB"]); const codes = gb?.values.map(businessNumber).filter(value => value !== null) as number[] || []
  const roles: string[] = []
  if (group.geometry === "polygon" && get(["PAC", "adcode", "admin_code"])?.values.some(value => /^\d{6}$/.test(String(value)))) { roles.push("admin-area") }
  if (group.geometry === "point" && get(["GNID"]) && get(["NAME"])) { roles.push("settlement-name") }
  if (group.geometry === "polygon" && codes.some(code => code >= 310000 && code < 320000)) { roles.push("settlement-area") }
  if (group.geometry !== "point" && codes.some(code => code >= 210000 && code < 270000) && get(["HYDC"])) { roles.push(group.geometry === "line" ? "water-line" : "water-area"); if (codes.includes(240101)) { roles.push("target-2") } }
  if (group.geometry === "line" && codes.some(code => code >= 420000 && code < 450000) && get(["RN", "RTEG"])) { roles.push("road-line") }
  if (group.geometry === "line" && codes.some(code => code >= 410000 && code < 420000) && get(["RN", "TYPE"])) { roles.push("rail-line") }
  if (group.geometry === "line" && codes.some(code => code >= 620000 && code < 670000)) { roles.push("border-line") }
  if (group.geometry === "line" && get(["FN_Ch", "fault_name"]) && get(["Fea_Ch", "fault_type"]) && get(["AGE", "age"])) { roles.push("active-faults") }
  if (group.geometry === "polygon" && get(["NAME"]) && get(["LEVEL"]) && allNumeric(get(["SLIP_MM"]), group.count)) { roles.push("fault-reference") }
  const intensity = group.metrics.find(metric => metric.unit === "度")
  if (group.geometry === "polygon" && intensity) { roles.push("assessment-intensity") }
  const hazard = get(["hazard_type"])
  if (hazard) { roles.push("hazard-reference"); if (get(["severity"])?.values.every(value => [1, 2, 3].includes(Number(value))) && get(["status"])?.values.every(value => ["confirmed", "已核查", "已确认"].includes(String(value)))) { roles.push("hazard") } }
  const category = get(["resource_type", "category", "设施类型"])
  for (const [index, names] of [["医院", "hospital"], ["学校", "school"], ["水库", "reservoir"], ["桥梁", "bridge"], ["危险源", "hazard-source"]].entries()) { if (category?.values.some(value => names.includes(String(value)))) { roles.push(`target-${index}`) } }
  return roles
}

// Titles, collection IDs and filenames deliberately do not enter the classifier.
export function inspectJsonContent(raw: any, scope?: RectInfo): ContentProfile {
  if (raw?.type !== "FeatureCollection" || !Array.isArray(raw.features)) {
    let kind: ContentProfile["kind"] = "json"
    if (raw?.layers && (raw?.version || raw?.dataset || raw?.manifestVersion)) { kind = "workspace" }
    if (raw?.report_type || (raw?.event_info && raw?.seismic_impact)) { kind = "report" }
    return { kind, count: 0, groups: [], metadata: {} }
  }
  const region = scope ? bboxPolygon([scope.west, scope.south, scope.east, scope.north]) : undefined
  const features = raw.features.filter((feature: Feature) => {
    try { return !!geometryFamily(feature.geometry?.type) && !!feature.properties && (!region || booleanIntersects(feature, region)) } catch { return false }
  }) as TemplateDocument["features"]
  const metadata = { ...(raw.metadata || {}) }
  const groups = (["point", "line", "polygon"] as const).flatMap(geometry => {
    const rows = features.filter(feature => geometryFamily(feature.geometry.type) === geometry).map(feature => feature.properties)
    if (!rows.length) { return [] }
    const fields = summarize(rows); const rowUnit = keyOf(fields, ["unit", "单位"])
    const units = rowUnit?.present === rows.length && rowUnit.values.length === 1 ? String(rowUnit.values[0]) : ""
    const metrics = fields.map(field => metricFor(field, rows.length, { ...metadata, rowUnit: units }, fields)).filter(Boolean) as ContentMetric[]
    const group: ContentGroup = { geometry, count: rows.length, fields, metrics: metrics.sort((a, b) => b.score - a.score || a.field.localeCompare(b.field)), roles: [] }
    group.roles = rolesFor(group)
    return [group]
  })
  let bounds: RectInfo | undefined
  if (features.length) { const [west, south, east, north] = bbox({ type: "FeatureCollection", features }); bounds = { west, south, east, north } }
  return { kind: "vector", count: features.length, groups, metadata, bounds }
}
export function inspectRasterContent(info: Record<string, any>, properties: Record<string, any>, asset: Record<string, any> = {}): ContentProfile {
  if (!Number.isInteger(info.count) || info.count < 1 || !Number.isInteger(info.width) || !Number.isInteger(info.height) || !Array.isArray(info.band_descriptions)) { throw new Error("文件未返回有效栅格结构") }
  const descriptions = info.band_descriptions.map((entry: any[]) => String(entry[1]).toLowerCase())
  const rgb = ["red", "green", "blue"].every(name => info.colorinterp?.includes(name))
  const numeric = !rgb && info.count === 1
  const roles: string[] = []
  let quantity: RemoteRasterQuantity | undefined
  if (numeric && descriptions.includes("people_per_km2") && /人/.test(String(properties["grid:unit"]))) { roles.push("population") }
  if (numeric && descriptions.includes("gdp_10k_cny_per_km2") && /万元/.test(String(properties["grid:unit"]))) { roles.push("economy") }
  if (numeric && properties["result:type"] === "deformation_rate" && properties["deformation:unit"] === "mm/a") { roles.push("rate") }
  quantity = roles[0] as RemoteRasterQuantity | undefined
  const declared = properties["cartography:role"] || properties["raster:quantity"] || properties["spatial:layer_name"]
  // The legacy source has no unit tag. Its declared layer identity permits raw display only, never a Celsius conversion or anomaly claim.
  if (numeric && !quantity && ["lst", "temperature", "land_surface_temperature", "landsat_sr_lst"].includes(declared)) { roles.push("lst"); quantity = "temperature" }
  const sensor = typeof properties.platform === "string" && properties.platform.trim() && (Number.isFinite(properties.gsd) || Array.isArray(properties["eo:bands"]))
  const wavelengths = descriptions.map((name: string) => Number(name.match(/\(([\d.]+)um\)/)?.[1]))
  const reflective = wavelengths.every((wavelength: number) => wavelength >= 0.4 && wavelength <= 2.5)
  const thermal = wavelengths.every((wavelength: number) => wavelength >= 3 && wavelength <= 15)
  if (sensor && !rgb && reflective && asset.unit === "1") { quantity = "reflectance" }
  if (sensor && !rgb && thermal && asset.unit === "K") { quantity = "brightness" }
  if (sensor && (rgb || info.count >= 3 || quantity === "reflectance" || quantity === "brightness")) { roles.push("imagery") }
  const [west, south, east, north] = info.bounds || []
  return { kind: "raster", count: info.width * info.height, groups: [], metadata: {}, bounds: { west, south, east, north }, raster: { roles, quantity, numeric, rgb, reflective, count: info.count, width: info.width, height: info.height, descriptions, crs: info.crs || properties["proj:code"] || properties["proj:epsg"], dtype: info.dtype, nodata: info.nodata_value } }
}
export function recommendExpression(profile: ContentProfile, kind: string): ContentRecommendation | null {
  const contract = TEMPLATE_CONTRACTS[kind]
  if (!contract || profile.kind !== "vector") { return null }
  const allowed: string[] = []
  if (/Polygon/.test(contract.geometry)) { allowed.push("polygon") }
  if (/LineString/.test(contract.geometry)) { allowed.push("line") }
  if (/Point/.test(contract.geometry)) { allowed.push("point") }
  if (["graduated-symbol", "proportional-symbol", "point-heat", "chart-linkage", "risk-overlay", "time-compare", "anomaly-composite", "post-quake-risk", "secondary-hazard"].includes(kind)) { allowed.push("point", "polygon") }
  for (const group of profile.groups.filter(group => allowed.includes(group.geometry))) {
    if (contract.automatic) {
      if (kind === "unique-value") {
        const field = keyOf(group.fields, ["hazard_type", "category", "landuse", "土地利用", "intensity_label", "GB"])
        if (!field || field.present !== group.count || field.values.length < 2 || field.values.length > 24) { continue }
        const score = field.key === "GB" ? 65 : 90
        return { geometry: group.geometry, field: field.key, unit: "类别", label: `${field.key}分类`, score, evidence: [`${group.count} 个${group.geometry === "polygon" ? "面" : "点"}要素`, `${field.values.length} 类实际属性值`] }
      }
      if (kind === "contour") {
        if (!profile.metadata.gridDefinition) { continue }
      }
      const metric = group.metrics.find(metric => metric.score >= 65 && (!["point-heat", "graduated-symbol", "proportional-symbol"].includes(kind) || (group.fields.find(field => field.key === metric.field)?.minimum || 0) >= 0))
      if (!metric) { continue }
      const normalization = kind === "choropleth" && metric.total ? { kind: "area-density" as const } : undefined
      return { geometry: group.geometry, field: metric.field, unit: normalization ? `${metric.unit}/km²` : metric.unit, label: `${metric.label}${normalization ? "密度" : ""}`, score: metric.score, normalization, evidence: [`${group.count} 个真实要素`, `${metric.field} 全部为有效数值`, ...(normalization ? ["总量按原统计区面积转为密度，不按框选面积分摊"] : [])] }
    }
    const fields = kind === "population-exposure" ? ["population", "intensity"] : contract.fields
    const mapping = Object.fromEntries(fields.map(key => [key, keyOf(group.fields, [key])?.key || ""]))
    if (Object.values(mapping).some(value => !value)) { continue }
    if (!timestamp(profile.metadata.observedAt)) { continue }
    if (Object.keys(contract.metadata || {}).some(key => profile.metadata[key] === undefined || profile.metadata[key] === "")) { continue }
    return { geometry: group.geometry, label: contract.name, fieldMapping: mapping, score: 90, evidence: ["几何、必需字段与业务元数据已核对"] }
  }
  return null
}

export function prepareContentDocument(document: TemplateDocument, recommendation: ContentRecommendation, fingerprint: string, kind = ""): TemplateDocument {
  const features = document.features.filter(feature => geometryFamily(feature.geometry.type) === recommendation.geometry).map(feature => {
    const labelKey = ["name", "NAME", "admin_name", "地区", "名称", "站点"].find(key => typeof feature.properties[key] === "string" && feature.properties[key].trim())
    return labelKey && !feature.properties.label ? { ...feature, properties: { ...feature.properties, label: feature.properties[labelKey] } } : feature
  })
  return { ...document, features, metadata: { ...document.metadata, valueField: recommendation.field, fieldMapping: recommendation.fieldMapping, unit: recommendation.unit || document.metadata.unit, contentRecommendation: { ...recommendation, kind, fingerprint }, observedAt: document.metadata.observedAt } }
}
