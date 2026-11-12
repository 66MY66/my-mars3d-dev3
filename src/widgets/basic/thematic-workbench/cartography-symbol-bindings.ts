import { dbtDrawingBounds, dbtFeatureSymbol, dbtScopedLayers, type DbtDocument, type DbtLayer, type DbtTemplateId } from "./dbt116-standard"
import { dbtSymbolDefinitions, type DbtSymbolKind } from "./dbt116-symbols"

export type SymbolBindings = Partial<Record<DbtSymbolKind, number>>
export function countSymbolBindings(layers: DbtLayer[]): SymbolBindings {
  const counts: SymbolBindings = {}
  for (const layer of layers) {
    if (layer.enabled === false || (layer.opacity ?? 1) <= 0) { continue }
    for (const feature of layer.data.features) {
      const kind = dbtFeatureSymbol(layer, feature)
      if (!kind) { continue }
      const geometry = dbtSymbolDefinitions[kind].geometry
      let matches = /LineString$|Polygon$/.test(feature.geometry.type)
      if (geometry === "point") { matches = ["Point", "MultiPoint"].includes(feature.geometry.type) }
      if (geometry === "area") { matches = /Polygon$/.test(feature.geometry.type) }
      if (matches) { counts[kind] = (counts[kind] || 0) + 1 }
    }
  }
  return counts
}
export function standardSymbolBindings(doc: DbtDocument | null, id: DbtTemplateId): SymbolBindings {
  if (!doc) { return {} }
  const counts = countSymbolBindings(dbtScopedLayers(doc, id))
  const b = dbtDrawingBounds(doc, id); const event = doc.event
  if (b && event.time && event.place && event.magnitude > 0 && event.longitude >= b.west && event.longitude <= b.east && event.latitude >= b.south && event.latitude <= b.north) { counts["dbt-current-epicenter"] = 1 }
  return counts
}
export function symbolSourceKeys(kind: string): string[] {
  if (kind === "dbt-current-epicenter") { return ["event"] }
  if (/boundary$/.test(kind)) { return ["border-line", "boundary"] }
  if (/seat$|village$/.test(kind)) { return ["settlement"] }
  if (/road$|expressway$/.test(kind)) { return ["transport"] }
  if (kind === "dbt-railway") { return ["rail"] }
  if (kind === "dbt-river") { return ["water"] }
  if (/lake$|reservoir$/.test(kind)) { return ["water-area", "target-2"] }
  return ({ "dbt-medical": ["target-0"], "dbt-school": ["target-1"], "dbt-isoseismal": ["intensity"], "dbt-fault": ["fault"], "dbt-geohazard": ["geohazard", "hazard"], "dbt-refuge": ["capacity"], "dbt-rescue-area": ["building", "geohazard"] } as Record<string, string[]>)[kind] || []
}
