import { area, bbox, booleanValid, buffer, featureCollection, simplify } from "@turf/turf"
import type { Feature, Polygon, MultiPolygon } from "geojson"
import { readPolygonDocument } from "./polygon-source"
import type { RectInfo } from "./map"

type AdminFeature = Feature<Polygon | MultiPolygon, Record<string, any>>
type LoadArea = (code: string, signal?: AbortSignal) => Promise<AdminFeature[]>
const cache = new Map<string, AdminFeature[]>()
const base = (import.meta.env.VITE_MARS3D_DATA_URL || "https://data.mars3d.cn").replace(/\/$/, "")
export const ADMIN_AREA_FIELD = "行政区面积_km2"
export const ADMIN_CODE_FIELD = "行政区代码"

export async function fetchAdministrativeArea(code: string, signal?: AbortSignal): Promise<AdminFeature[]> {
  if (!/^\d{6}$/.test(code)) { throw new Error("行政区代码无效") }
  signal?.throwIfAborted()
  if (cache.has(code)) { return cache.get(code)! }
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener("abort", abort, { once: true })
  const timer = setTimeout(abort, 12000)
  try {
    const response = await fetch(`${base}/file/geojson/areas/${code}_full.json`, { signal: controller.signal })
    if (!response.ok) { throw new Error(`HTTP ${response.status}`) }
    const json = await response.json()
    if (json.type !== "FeatureCollection" || !Array.isArray(json.features)) { throw new Error("边界格式无效") }
    const features = json.features.filter((item: AdminFeature) => item?.geometry && ["Polygon", "MultiPolygon"].includes(item.geometry.type))
    if (!features.length || features.length > 500) { throw new Error("边界要素数量无效") }
    cache.set(code, features)
    return features
  } catch (error) {
    if (signal?.aborted) { throw new Error("行政区加载已取消") }
    throw new Error(`行政区边界 ${code} 加载失败，请检查网络或导入 GeoJSON：${error instanceof Error ? error.message : error}`)
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort) }
}

function intersectsBounds(feature: AdminFeature, bounds: RectInfo) {
  const box = bbox(feature)
  return box[0] < bounds.east && box[2] > bounds.west && box[1] < bounds.north && box[3] > bounds.south
}

function repairBoundary(feature: AdminFeature): AdminFeature {
  if (booleanValid(feature)) { return feature }
  // Published boundaries can contain touching spikes; zero-width buffering repairs topology without expanding the region.
  const repaired = buffer(feature, 0, { units: "kilometers" }) as AdminFeature | undefined
  if (!repaired || !booleanValid(repaired)) { throw new Error(`${feature.properties.name || feature.properties.adcode} 边界拓扑无法修复，请导入有效分区数据`) }
  return { ...repaired, properties: { ...feature.properties } }
}

export async function loadTemplateAdministrativeSource(bounds: RectInfo, signal?: AbortSignal, load: LoadArea = fetchAdministrativeArea) {
  const extent = Math.max(bounds.east - bounds.west, bounds.north - bounds.south)
  if (!(bounds.east > bounds.west && bounds.north > bounds.south)) { throw new Error("框选范围无效") }
  let features = (await load("100000", signal)).filter(item => intersectsBounds(item, bounds))
  if (!features.length) { throw new Error("当前范围不在行政区数据覆盖范围内，请导入当地分区 GeoJSON") }
  // Use progressively finer real boundaries, with bounded requests for broad selections.
  for (let depth = 0; depth < (extent <= 4 ? 2 : 1); depth++) {
    if (extent > 12 || features.length > 12) { break }
    const children: AdminFeature[] = []
    for (const feature of features) {
      signal?.throwIfAborted()
      if (!feature.properties.childrenNum) { children.push(feature); continue }
      const values = await load(String(feature.properties.adcode), signal)
      children.push(...values.filter(item => intersectsBounds(item, bounds)))
    }
    if (!children.length) { break }
    features = children
  }
  const byCode = new Map(features.map(item => [String(item.properties.adcode), item]))
  const measured = [...byCode.values()].map(repairBoundary).map(feature => ({
    ...feature,
    properties: { ...feature.properties, [ADMIN_AREA_FIELD]: Math.round(area(feature) / 1e6 * 100) / 100, [ADMIN_CODE_FIELD]: Number(feature.properties.adcode) }
  }))
  // Measure complete administrative regions before display-only simplification and clipping.
  const collection = featureCollection(measured)
  let reduced = collection
  for (const tolerance of [0.0005, 0.001, 0.002, 0.005]) {
    reduced = simplify(collection, { tolerance, highQuality: true, mutate: false })
    const vertices = reduced.features.reduce((total, feature) => {
      const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates
      return total + polygons.reduce((sum, rings) => sum + rings.reduce((n, ring) => n + ring.length, 0), 0)
    }, 0)
    if (vertices <= 18000) { break }
  }
  const parsed = readPolygonDocument(featureCollection(reduced.features.map(repairBoundary)))
  const levels = new Set(features.map(item => item.properties.level))
  let level = "省级"
  if (levels.has("city")) { level = "州市" }
  if (levels.has("district")) { level = "区县" }
  return { ...parsed, name: `${level}行政区边界`, source: `Mars3D 行政区边界；面积按完整行政区球面几何计算（km²），非灾害指标`, count: features.length }
}
