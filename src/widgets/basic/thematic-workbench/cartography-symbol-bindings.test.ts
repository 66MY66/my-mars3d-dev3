import { describe, it, expect } from "vitest"
import { countSymbolBindings, standardSymbolBindings, symbolSourceKeys } from "./cartography-symbol-bindings"
import { emptyDbtDocument, type DbtLayer } from "./dbt116-standard"

const target = (properties: Record<string, unknown>, extra = {}) => ({ id: "hospitals", role: "target", data: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [103, 27] }, properties }] }, ...extra }) as DbtLayer
describe("data-backed symbol inventory", () => {
  it("counts explicit real symbol bindings and does not invent a hospital from a name", () => {
    expect(countSymbolBindings([target({ symbol: "dbt-medical" })])).toEqual({ "dbt-medical": 1 })
    expect(countSymbolBindings([target({ name: "医院旁的停车场" })])).toEqual({})
    expect(countSymbolBindings([target({ category: "医院" })])).toEqual({ "dbt-medical": 1 })
    expect(countSymbolBindings([target({ symbol: "dbt-medical" }, { enabled: false })])).toEqual({})
    expect(countSymbolBindings([target({ symbol: "dbt-medical" }, { opacity: 0 })])).toEqual({})
  })
  it("does not count the empty default event or an event outside the real map extent", () => {
    const doc = emptyDbtDocument(); doc.usage = "reference"; doc.reference = { title: "范围", notice: "参考", bounds: { west: 102, south: 26, east: 104, north: 28 } }
    expect(standardSymbolBindings(doc, "T30103000")).toEqual({})
    Object.assign(doc.event, { time: "2026-10-30T00:00:00Z", place: "源事件", magnitude: 5, longitude: 103, latitude: 27 })
    expect(standardSymbolBindings(doc, "T30103000")["dbt-current-epicenter"]).toBe(1)
    doc.event.latitude = 30
    expect(standardSymbolBindings(doc, "T30103000")).toEqual({})
  })
  it("links symbol inspection to the relevant business layer rather than manual placement", () => {
    expect(symbolSourceKeys("dbt-medical")).toEqual(["target-0"])
    expect(symbolSourceKeys("dbt-province-boundary")).toEqual(["border-line", "boundary"])
    expect(symbolSourceKeys("dbt-fault")).toEqual(["fault"])
  })
})
