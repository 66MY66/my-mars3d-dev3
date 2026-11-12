import type { RemoteItem, RemoteLayerAsset } from "./remote-cartography-source"
import type { DbtDocument } from "./dbt116-standard"
import type { TemplateDocument } from "./template-renderer"
import type { RectInfo } from "./map"
import { EmptyScopedVectorError } from "./supplemental-cartography"

export type BackendEventParameters = { event: DbtDocument["event"]; name: string; depthKm: number | null; mw: number | null; source: string }
export function eventParametersAsset(item: RemoteItem): RemoteLayerAsset[] {
  return (item.properties["event:epicenter"] || item.properties["eq:epicenter"]) && Number.isFinite(item.properties["eq:magnitude"])
    ? [{ key: "properties", title: "后台条目震情参数（随包参考）", kind: "vector", numeric: false, bands: [], range: [0, 1] }]
    : []
}
export function readBackendEventParameters(item: RemoteItem): BackendEventParameters {
  const original = item.properties
  const p: Record<string, any> = { ...original, "event:epicenter": original["event:epicenter"] || original["eq:epicenter"], "event:place": original["event:place"] || original["eq:event_name"], "event:source": original["event:source"] || original["report:source"] }
  const position = p["event:epicenter"]; const time = p.datetime
  if (!eventParametersAsset(item).length || p["proj:epsg"] !== 4326 || !Array.isArray(position) || position.length !== 2 || !position.every(Number.isFinite) || Math.abs(position[0]) > 180 || Math.abs(position[1]) > 90) { throw new Error("后台震情缺少已声明 WGS84 的有效震中坐标，不使用条目覆盖框中心代替") }
  if (typeof time !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(time) || !Number.isFinite(Date.parse(time)) || typeof p["event:place"] !== "string" || !p["event:place"].trim() || !Number.isFinite(p["eq:magnitude"]) || p["eq:magnitude"] <= 0 || typeof p["event:source"] !== "string" || !p["event:source"].trim()) { throw new Error("后台震情时间、地名、震级或来源不完整，未猜测缺失参数") }
  return { event: { time, place: p["event:place"], magnitude: p["eq:magnitude"], magnitudeType: typeof p["eq:magnitude_type"] === "string" ? p["eq:magnitude_type"] : "", longitude: position[0], latitude: position[1], authority: "", bulletin: p["event:source"] }, name: String(p["event:name"] || p["event:place"]), depthKm: Number.isFinite(p["eq:depth_km"]) && p["eq:depth_km"] >= 0 ? p["eq:depth_km"] : null, mw: Number.isFinite(p["eq:magnitude_mw"]) ? p["eq:magnitude_mw"] : null, source: p["event:source"] }
}
export function readBackendEventVector(item: RemoteItem, scope: RectInfo): TemplateDocument {
  const parameters = readBackendEventParameters(item); const e = parameters.event
  if (e.longitude < scope.west || e.longitude > scope.east || e.latitude < scope.south || e.latitude > scope.north) { throw new EmptyScopedVectorError("后台震情读取正常，但真实震中位于选区外；未移动到框选中心") }
  return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [e.longitude, e.latitude] }, properties: { label: parameters.name, name: parameters.name, symbol: "dbt-current-epicenter", occurredAt: e.time, magnitude: e.magnitude, magnitudeType: e.magnitudeType } }], metadata: { usage: "reference", referenceOnly: true, crs: "EPSG:4326", eventParameters: parameters, source: parameters.source } }
}
export function layerEventParameters(layers: Array<{ role: string; data: unknown; enabled?: boolean; opacity?: number }>): BackendEventParameters | undefined {
  return (layers.find(layer => layer.role === "event" && layer.enabled !== false && (layer.opacity ?? 1) > 0)?.data as TemplateDocument | undefined)?.metadata?.eventParameters
}
