import type { InspectedSource } from "./backend-content-routing"
import type { RectInfo } from "./map"

export type ImageryComparison = { version: 1; side: "before" | "after"; beforeTime: string; afterTime: string; eventTime: string; registrationId: string }
const timestamp = (value: unknown) => typeof value === "string" && /(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
function identity(source: InspectedSource) {
  const properties = source.item.properties; const raster = source.profile.raster
  const observedAt = properties.datetime
  const eventTime = properties["earthquake:time"] || properties["comparison:event_time"]
  const registrationId = properties["processing:registration_id"] || properties["comparison:registration_id"]
  const radiometry = properties["processing:level"] || properties["comparison:radiometry"]
  if (!raster?.rgb || !timestamp(observedAt) || !timestamp(eventTime) || typeof registrationId !== "string" || !registrationId.trim() || !Number.isFinite(properties.gsd) || Number(properties.gsd) <= 0 || typeof radiometry !== "string" || !radiometry.trim() || !properties.platform || !raster.crs) { return null }
  return { observedAt: String(observedAt), eventTime: String(eventTime), registrationId, key: JSON.stringify([eventTime, registrationId, properties.platform, properties.gsd, radiometry, raster.crs, raster.descriptions, raster.count]) }
}
export function imageryPairs(sources: InspectedSource[]) {
  const pairs: Array<{ before: InspectedSource; after: InspectedSource; comparison: Omit<ImageryComparison, "side"> }> = []
  const eligible = sources.map(source => ({ source, identity: identity(source) })).filter(entry => entry.identity !== null)
  for (const before of eligible) {
    if (Date.parse(before.identity!.observedAt) >= Date.parse(before.identity!.eventTime)) { continue }
    for (const after of eligible) {
      if (before.identity!.key !== after.identity!.key || Date.parse(after.identity!.observedAt) < Date.parse(after.identity!.eventTime) || before.source.fingerprint === after.source.fingerprint) { continue }
      pairs.push({ before: before.source, after: after.source, comparison: { version: 1, beforeTime: before.identity!.observedAt, afterTime: after.identity!.observedAt, eventTime: before.identity!.eventTime, registrationId: before.identity!.registrationId } })
    }
  }
  return pairs.sort((a, b) => (Date.parse(a.comparison.afterTime) - Date.parse(a.comparison.beforeTime)) - (Date.parse(b.comparison.afterTime) - Date.parse(b.comparison.beforeTime)))
}
export function comparisonBounds(bounds: RectInfo, value?: unknown): RectInfo {
  if (value === undefined) { return { ...bounds } }
  const data = value as ImageryComparison
  if (data?.version !== 1 || !["before", "after"].includes(data.side) || !timestamp(data.beforeTime) || !timestamp(data.afterTime) || !timestamp(data.eventTime) || Date.parse(data.beforeTime) >= Date.parse(data.eventTime) || Date.parse(data.afterTime) < Date.parse(data.eventTime) || typeof data.registrationId !== "string" || !data.registrationId.trim()) { throw new Error("灾前灾后影像配对记录无效，请重新匹配资料") }
  const middle = (bounds.west + bounds.east) / 2
  return data.side === "before" ? { ...bounds, east: middle } : { ...bounds, west: middle }
}
