import { describe, expect, it } from "vitest"
import { dbtFeatureSymbol, type DbtLayer } from "./dbt116-standard"
import { remoteReferenceStyle } from "./remote-reference-style"

describe("reference vector cartographic meaning", () => {
  const feature = { type: "Feature" as const, properties: { symbol: "dbt-fault", color: "#ff0000" }, geometry: { type: "Polygon" as const, coordinates: [[[103, 30], [104, 30], [104, 31], [103, 30]]] } }
  function layer(collection: string, itemId: string, role: string): DbtLayer {
    return { id: "reference", name: "reference", role, authority: "", publishedAt: "", source: "", crs: "EPSG:4326", security: "", scale: 0, data: { type: "FeatureCollection", features: [feature] }, onlineSource: { collection, itemId, asset: "data", revision: "", fingerprint: "a".repeat(64), scope: { west: 103, south: 30, east: 104, north: 31 } } }
  }
  it("does not convert fault range polygons into formal active-fault symbols", () => {
    const fault = layer("spatial-thematic", "SP-fault_zones_shp", "fault")
    expect(dbtFeatureSymbol(fault, feature)).toBeUndefined()
    expect(remoteReferenceStyle(fault.onlineSource)?.label).toBe("断裂带范围（面，仅参考）")
  })
  it("does not infer confirmed disaster symbols or severity for pending polygons", () => {
    const hazard = layer("geohazard-spot", "HAZ-pending", "geohazard")
    feature.properties.symbol = "dbt-geohazard"
    expect(dbtFeatureSymbol(hazard, feature)).toBeUndefined()
    expect(remoteReferenceStyle(hazard.onlineSource)?.label).toBe("待核查隐患图斑（未分级）")
    expect(hazard.data.features[0].properties).not.toHaveProperty("severity")
  })
  it("preserves formal symbols for unrelated authoritative data", () => {
    const formal = layer("authoritative-fault-lines", "active-fault", "fault")
    feature.properties.symbol = "dbt-fault"
    expect(dbtFeatureSymbol(formal, feature)).toBe("dbt-fault")
    expect(remoteReferenceStyle(formal.onlineSource)).toBeUndefined()
  })
})
