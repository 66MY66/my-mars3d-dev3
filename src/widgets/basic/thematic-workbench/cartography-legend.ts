import type { DbtLayer } from "./dbt116-standard"
import { dbtSymbolDefinitions, type DbtSymbolKind } from "./dbt116-symbols"
type Row = { kind?: string; label: string; color?: string; shape?: string; styleKey?: string; group?: string; radius?: number }
export function uniqueLegendRows<T extends Row>(rows: T[]): T[] {
  return [...new Map(rows.map(row => [row.kind || JSON.stringify([row.group, row.label, row.color, row.shape, row.styleKey, row.radius]), row])).values()]
}
export function mapLegendGroups(layers: DbtLayer[]) {
  const groups = new Map<string, { name: string; time: string; rows: NonNullable<DbtLayer["legend"]> }>()
  for (const layer of layers) {
    if (layer.enabled === false || (layer.opacity ?? 1) <= 0 || !layer.legend?.length) { continue }
    let group = layer.id; let name = layer.name
    if (["boundary", "settlement", "water", "transport", "dem", "land"].includes(layer.role)) { group = "base"; name = "地理底图" }
    if (["event", "intensity", "fault", "pga", "target", "geohazard", "rescue-area"].includes(layer.role)) { group = "theme"; name = "专题要素" }
    if (!groups.has(group)) { groups.set(group, { name, time: ["base", "theme"].includes(group) ? "" : layer.publishedAt, rows: [] }) }
    groups.get(group)!.rows.push(...layer.legend)
  }
  const rank = (row: Row) => {
    const definition = dbtSymbolDefinitions[row.kind as DbtSymbolKind]
    if (definition) { return ["point", "line", "area"].indexOf(definition.geometry) * 100 + Object.keys(dbtSymbolDefinitions).indexOf(row.kind!) }
    return row.shape === "line" ? 180 : 280
  }
  return [...groups].sort(([a], [b]) => Number(b === "theme") - Number(a === "theme")).map(([key, group]) => ({ key, ...group, rows: uniqueLegendRows(group.rows).sort((a, b) => rank(a) - rank(b)) }))
}
