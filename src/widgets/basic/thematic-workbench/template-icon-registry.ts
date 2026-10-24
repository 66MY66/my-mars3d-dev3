import { dbtSymbolDefinitions, type DbtSymbolKind } from "./dbt116-symbols"
export type TemplateIconFamily = "basic" | "earthquake"

export type BasicTemplateVisualKind =
  | "choropleth"
  | "unique-value"
  | "graduated-symbol"
  | "point-heat"
  | "raster-ramp"
  | "raster-threshold"
  | "contour"
  | "trajectory"
  | "flow-direction"
  | "risk-overlay"
  | "time-compare"
  | "chart-linkage"

export type BasicTemplateCategoryId = "statistics" | "heat" | "flow" | "raster" | "compare"

export type EarthquakeSymbolKind = "epicenter" | "anomaly" | "landslide" | "rescue" | "shelter" | "road-interruption"
  | "disaster-earthquake" | "disaster-alert" | "disaster-flood" | "disaster-fire" | "disaster-heatwave" | "assembly-point"
export type BasicSymbolKind = "geo-location" | "geo-city" | "geo-peak" | "geo-water" | "geo-road" | "geo-flag"
  | "water-source" | "bridge" | "hospital" | "satellite-dish" | "cell-tower"
export type CartographySymbolKind = EarthquakeSymbolKind | BasicSymbolKind | DbtSymbolKind

export type EarthquakeTemplateId =
  | "earthquake_anomaly_composite"
  | "earthquake_thermal_infrared"
  | "earthquake_post_quake_risk"
  | "earthquake_swarm_trajectory"
  | "earthquake_insar_deformation"
  | "earthquake_intensity_distribution"
  | "earthquake_secondary_hazard"
  | "earthquake_building_resilience"
  | "earthquake_population_exposure"
  | "earthquake_emergency_command"

export type TemplateIconBinding = {
  kind: string
  family: TemplateIconFamily
  label: string
  icon: string
  accent: string
  asset?: string
  legacy?: boolean
  standardAsset?: string
  reference?: string
  shortLabel?: string
  fixedColors?: boolean
  priority?: number
  geometry?: "point" | "line" | "area"
}

type EarthquakeTemplateIconPlan = {
  primary: CartographySymbolKind
  symbols: readonly CartographySymbolKind[]
}

export const basicTemplateIconByVisualKind: Record<BasicTemplateVisualKind, TemplateIconBinding> = {
  choropleth: { kind: "basic-choropleth", family: "basic", label: "分级设色", icon: "layers", accent: "#2f8fd8" },
  "unique-value": { kind: "basic-unique-value", family: "basic", label: "唯一值分类", icon: "category-management", accent: "#2db7a3" },
  "graduated-symbol": { kind: "basic-graduated-symbol", family: "basic", label: "分级符号", icon: "bubble-chart", accent: "#4f7fe8" },
  "point-heat": { kind: "basic-point-heat", family: "basic", label: "点热力", icon: "fire", accent: "#e96b58" },
  "raster-ramp": { kind: "basic-raster-ramp", family: "basic", label: "栅格色带", icon: "color-card", accent: "#3d9c82" },
  "raster-threshold": { kind: "basic-raster-threshold", family: "basic", label: "栅格阈值", icon: "filter-one", accent: "#d98b3f" },
  contour: { kind: "basic-contour", family: "basic", label: "等值线", icon: "bezier-curve", accent: "#3c8ec7" },
  trajectory: { kind: "basic-trajectory", family: "basic", label: "轨迹回放", icon: "play-cycle", accent: "#2aa6a0" },
  "flow-direction": { kind: "basic-flow-direction", family: "basic", label: "流向", icon: "connection-arrow", accent: "#2f9fb3" },
  "risk-overlay": { kind: "basic-risk-overlay", family: "basic", label: "风险叠加", icon: "circular-connection", accent: "#d45d5d" },
  "time-compare": { kind: "basic-time-compare", family: "basic", label: "时序对比", icon: "split", accent: "#8a6dd3" },
  "chart-linkage": { kind: "basic-chart-linkage", family: "basic", label: "图表联动", icon: "chart-histogram", accent: "#3ca6c8" }
}

export const categoryFallbackTemplateIcons: Record<BasicTemplateCategoryId, TemplateIconBinding> = {
  statistics: { kind: "basic-statistics", family: "basic", label: "统计专题", icon: "chart-histogram", accent: "#3ca6c8" },
  heat: { kind: "basic-heat", family: "basic", label: "热力专题", icon: "fire", accent: "#e96b58" },
  flow: { kind: "basic-flow", family: "basic", label: "轨迹流向", icon: "connection-arrow", accent: "#2f9fb3" },
  raster: { kind: "basic-raster", family: "basic", label: "栅格专题", icon: "color-card", accent: "#3d9c82" },
  compare: { kind: "basic-compare", family: "basic", label: "对比专题", icon: "split", accent: "#8a6dd3" }
}

export const cartographySymbolSource = { name: "DB/T 116-2026", url: "https://std.samr.gov.cn/hb/search/stdHBDetailed?id=563F2BB5C8C56792E06397BE0A0AAF8A", license: "用户提供标准 · 附录 B" }

function ocha(kind: CartographySymbolKind, family: TemplateIconFamily, label: string, asset: string, accent: string): TemplateIconBinding {
  return { kind, family, label, asset, accent, icon: "", legacy: true }
}

export const earthquakeSymbolDefinitions: Record<EarthquakeSymbolKind, TemplateIconBinding> = {
  "disaster-earthquake": ocha("disaster-earthquake", "earthquake", "地震", "Earthquake", "#f36c72"),
  landslide: ocha("landslide", "earthquake", "滑坡泥石流", "Landslide-mudslide", "#e6a23c"),
  rescue: ocha("rescue", "earthquake", "搜救", "Search-and-rescue", "#4aa6ff"),
  shelter: ocha("shelter", "earthquake", "安置点", "Shelter", "#3fc98c"),
  "road-interruption": ocha("road-interruption", "earthquake", "道路损毁", "Road-destroyed", "#ff785a"),
  "disaster-alert": ocha("disaster-alert", "earthquake", "警报", "Alert", "#eeb852"),
  "disaster-flood": ocha("disaster-flood", "earthquake", "洪水", "Flood", "#46b6db"),
  "disaster-fire": ocha("disaster-fire", "earthquake", "火灾", "Fire", "#ef8253"),
  "disaster-heatwave": ocha("disaster-heatwave", "earthquake", "热浪", "Heatwave", "#e49765"),
  "assembly-point": ocha("assembly-point", "earthquake", "集合点", "Assembly-point", "#67c697"),
  // Preserve archived annotations whose meaning has no equivalent in this collection.
  epicenter: { kind: "epicenter", family: "earthquake", label: "震中", icon: "aiming", accent: "#ff5c68", legacy: true },
  anomaly: { kind: "anomaly", family: "earthquake", label: "异常", icon: "abnormal", accent: "#36c7d4", legacy: true }
}

export const basicGeographicSymbols: Record<BasicSymbolKind, TemplateIconBinding> = {
  "geo-location": ocha("geo-location", "basic", "位置点", "Location", "#48abe8"),
  "geo-city": ocha("geo-city", "basic", "城镇", "Urban", "#84b6cc"),
  "geo-road": ocha("geo-road", "basic", "道路", "Road", "#d5ad55"),
  "water-source": ocha("water-source", "basic", "水源", "Water-source", "#45b8d5"),
  bridge: ocha("bridge", "basic", "桥梁", "Bridge", "#c1a888"),
  hospital: ocha("hospital", "basic", "医院", "Hospital", "#70c39f"),
  "satellite-dish": ocha("satellite-dish", "basic", "卫星天线", "Satellite-dish", "#88bdf0"),
  "cell-tower": ocha("cell-tower", "basic", "通信塔", "Cell-tower", "#b1a4db"),
  "geo-peak": { kind: "geo-peak", family: "basic", label: "山峰", icon: "mountain", accent: "#52a47b", legacy: true },
  "geo-water": { kind: "geo-water", family: "basic", label: "水系", icon: "water", accent: "#28adce", legacy: true },
  "geo-flag": { kind: "geo-flag", family: "basic", label: "地标", icon: "flag", accent: "#dd7659", legacy: true }
}
export const cartographySymbolDefinitions: Record<CartographySymbolKind, TemplateIconBinding> = { ...basicGeographicSymbols, ...earthquakeSymbolDefinitions, ...dbtSymbolDefinitions }

export const earthquakeTemplateIconPlans: Record<EarthquakeTemplateId, EarthquakeTemplateIconPlan> = {
  earthquake_anomaly_composite: { primary: "anomaly", symbols: [] },
  earthquake_thermal_infrared: { primary: "anomaly", symbols: [] },
  earthquake_post_quake_risk: { primary: "dbt-current-epicenter", symbols: ["dbt-current-epicenter", "dbt-geohazard"] },
  earthquake_swarm_trajectory: { primary: "dbt-aftershock", symbols: ["dbt-aftershock", "dbt-current-epicenter"] },
  earthquake_insar_deformation: { primary: "anomaly", symbols: [] },
  earthquake_intensity_distribution: { primary: "dbt-isoseismal", symbols: ["dbt-isoseismal", "dbt-current-epicenter"] },
  earthquake_secondary_hazard: { primary: "dbt-geohazard", symbols: ["dbt-geohazard"] },
  earthquake_building_resilience: { primary: "dbt-refuge", symbols: ["dbt-refuge"] },
  earthquake_population_exposure: { primary: "dbt-current-epicenter", symbols: ["dbt-current-epicenter", "dbt-rescue-target"] },
  earthquake_emergency_command: { primary: "dbt-rescue-target", symbols: ["dbt-rescue-target", "dbt-current-epicenter", "dbt-refuge", "dbt-rescue-area"] }
}

export function isEarthquakeTemplateId(templateId: string): templateId is EarthquakeTemplateId {
  return Object.prototype.hasOwnProperty.call(earthquakeTemplateIconPlans, templateId)
}

export function getBasicTemplateIconBinding(
  visualKind: string,
  category?: BasicTemplateCategoryId
): TemplateIconBinding | undefined {
  const visualBinding = basicTemplateIconByVisualKind[visualKind as BasicTemplateVisualKind]
  return visualBinding || (category ? categoryFallbackTemplateIcons[category] : undefined)
}

export function getEarthquakeTemplatePrimaryIcon(templateId: EarthquakeTemplateId): TemplateIconBinding {
  return cartographySymbolDefinitions[earthquakeTemplateIconPlans[templateId].primary]
}

export function getEarthquakeTemplateSymbolBindings(templateId: EarthquakeTemplateId): TemplateIconBinding[] {
  return earthquakeTemplateIconPlans[templateId].symbols.map((kind) => cartographySymbolDefinitions[kind])
}
