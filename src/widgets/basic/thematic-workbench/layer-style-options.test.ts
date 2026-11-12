import { describe, expect, it } from "vitest"
import { layerStyleOptions, layerStyleDocument } from "./layer-style-options"
import type { DbtLayer } from "./dbt116-standard"
const layer = (properties: Record<string, unknown>, type = "Point"): DbtLayer => ({ id: "online:population", name: "后台资料", role: "population", authority: "", source: "http://backend/real.geojson", publishedAt: "2026", crs: "CRS84", security: "internal", scale: 0, data: { type: "FeatureCollection", features: [1, 2].map(value => ({ type: "Feature", geometry: type === "Point" ? { type: "Point", coordinates: [102 + value / 10, 30] } : { type: "Polygon", coordinates: [[[102, 30], [103, 30], [103, 31], [102, 31], [102, 30]]] }, properties: Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, typeof v === "number" ? v * value : `${v}${value}`])) })) }, onlineSource: { collection: "c", itemId: "original", asset: "data", revision: "r1", fingerprint: "f", scope: { west: 101, east: 104, south: 29, north: 32 } } })
describe("layer scoped expressions", () => {
  it("preserves the source observation time rather than replacing it with the catalog publication year", () => {
    const original = layer({ los_mm: 2 })
    ;(original.data as any).metadata = { observedAt: "2026-09-27T07:00:00Z", losUnit: "mm", acquisitionPair: "unit-test pair" }
    expect(layerStyleDocument(original).metadata).toMatchObject({ observedAt: "2026-09-27T07:00:00Z", losUnit: "mm", acquisitionPair: "unit-test pair" })
    expect(original.publishedAt).toBe("2026")
  })
  it("offers methods for the selected content, never searches another dataset", () => {
    expect(layerStyleOptions(layer({ rain_mm: 2 })).map(entry => entry.value)).toEqual(["graduated-symbol", "proportional-symbol"])
    expect(layerStyleOptions(layer({ population_density: 2 }, "Polygon")).map(entry => entry.value)).toEqual(["choropleth", "graduated-symbol", "proportional-symbol"])
    expect(layerStyleOptions(layer({ OBJECTID: 2 }))).toEqual([])
  })
  it("retains original geometry, source identity and fields", () => {
    const original = layer({ population_density: 2 }, "Polygon"); const snapshot = JSON.stringify(original)
    expect(layerStyleDocument(original).metadata).toMatchObject({ onlineLayerId: original.id, collection: "c", itemId: "original", source: original.source })
    expect(JSON.stringify(original)).toBe(snapshot)
  })
  it("uses documented source classifications rather than guessing category meanings from dataset names", () => {
    const original = layer({ GB: 240101 }, "Polygon")
    original.data.features.forEach(feature => { feature.properties = { GB: 240101, cartographySchema: "china-basegeo-250k.gb13923.v1", cartographyKind: "dbt-reservoir" } })
    expect(layerStyleDocument(original).metadata.categoryLabels["240101"]).toBe("水库（240101）")
    original.data.features.forEach(feature => { delete feature.properties!.cartographySchema })
    expect(layerStyleDocument(original).metadata.categoryLabels).toEqual({})
  })
})
