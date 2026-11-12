import { describe, it, expect } from "vitest"
import { mapLegendGroups, uniqueLegendRows } from "./cartography-legend"
import type { DbtLayer } from "./dbt116-standard"
describe("semantic map and paper legends", () => {
  it("does not repeat the county-boundary class for multiple source layers", () => {
    const row = { kind: "dbt-county-boundary" as const, label: "县级界线", color: "#a298a5", shape: "line" as const }
    const layers = [{ id: "area", name: "行政区面", role: "boundary", legend: [row] }, { id: "line", name: "界线", role: "boundary", legend: [row] }, { id: "labels", name: "居民地名称", role: "settlement", legend: [] }] as DbtLayer[]
    const groups = mapLegendGroups(layers)
    expect(groups).toHaveLength(1); expect(groups[0].name).toBe("地理底图"); expect(groups[0].rows).toHaveLength(1)
    expect(layers[0].legend).toHaveLength(1)
  })
  it("keeps distinct raster indicator groups and hides disabled legends", () => {
    const rows = [{ label: "0–10", color: "#ffffff", group: "人口" }, { label: "0–10", color: "#ffffff", group: "经济" }]
    expect(uniqueLegendRows(rows)).toHaveLength(2)
    expect(mapLegendGroups([{ id: "hidden", role: "boundary", enabled: false, legend: rows }] as DbtLayer[])).toEqual([])
  })
})
