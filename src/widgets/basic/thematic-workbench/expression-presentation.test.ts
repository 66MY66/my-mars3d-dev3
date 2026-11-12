import { describe, expect, it } from "vitest"
import { featureCollection, point } from "@turf/turf"
import { availableFields, businessNumber, defaultBusinessField } from "./business-map-data"
import { backendTemplateSources, bindExpressionFields, expressionLayer, replayExpression } from "./expression-presentation"
import type { TemplateDocument } from "./template-renderer"
import type { DbtLayer } from "./dbt116-standard"

const bounds = { west: 103, south: 29, east: 105, north: 31 }
const document = (): TemplateDocument => ({ ...featureCollection([point([104, 30], { rain_mm: "12.4", PAC: "001" }), point([104.5, 30.5], { rain_mm: "24.8", PAC: "002" })]), metadata: { source: "http://backend/actual.geojson", collection: "backend", itemId: "rainfall" } })

describe("backend expression presentation", () => {
  it("limits business inputs to explicit workflow slots, not administrative or place-name references", () => {
    const layer = { id: "online:business", name: "真实业务数据", data: document(), onlineSource: { collection: "backend", itemId: "actual" } } as DbtLayer
    const references = ["boundary", "settlement", "catalog-reference"].map(key => ({ ...layer, id: `online:${key}` }))
    expect(backendTemplateSources(references, new Set(["online:business"]))).toEqual([])
    expect(backendTemplateSources([layer, ...references], new Set(["online:business"])).map(source => source.id)).toEqual([layer.id])
  })
  it("accepts finite decimal text but never treats blanks, flags or formatted strings as zero", () => {
    for (const value of ["", " ", "0x10", "12%", "1,000", null, false, "Infinity", "NaN"]) { expect(businessNumber(value)).toBeNull() }
    expect(businessNumber("0")).toBe(0); expect(businessNumber("-1.2e3")).toBe(-1200)
    expect(availableFields(document(), false, true)).toEqual(["rain_mm", "PAC"])
    expect(defaultBusinessField(document(), "point-heat")).toBe("rain_mm")
  })
  it("keeps raw source properties and geometry unchanged when binding actual columns", () => {
    const raw = document(); const copy = JSON.stringify(raw)
    const bound = bindExpressionFields(raw, { fieldMapping: { flow_rate: "rain_mm" }, unit: "mm" })
    expect(bound.features[0].properties.flow_rate).toBe(12.4)
    expect(bound.features[0].properties.rain_mm).toBe("12.4")
    expect(bound.metadata.numericTextConversions).toEqual({ flow_rate: 2 })
    expect(JSON.stringify(raw)).toBe(copy)
    expect(() => bindExpressionFields(raw, { fieldMapping: { population: "missing" } })).toThrow("未绑定有效源字段")
    expect(bindExpressionFields(raw, { field: "PAC", unit: "类别" }).features[0].properties.PAC).toBe("001")
  })
  it("replays the recorded field, unit and palette instead of a generic geometry style", () => {
    const options = { field: "rain_mm", unit: "mm", palette: "green" }
    const scene = replayExpression(document(), bounds, { kind: "graduated-symbol", options, fingerprint: "a".repeat(64) })
    expect(scene.rows.map(row => row.value)).toEqual([12.4, 24.8])
    expect(scene.unit).toBe("mm")
    expect(scene.features.map(feature => feature.geometry)).toEqual(document().features.map(feature => feature.geometry))
    expect(() => replayExpression(document(), bounds, { kind: "point-heat", options, fingerprint: "" })).toThrow("记录不完整")
  })
  it("supplies only actual online vector documents and keeps publication descriptors detached from painted data", () => {
    const layer = { id: "online:business", name: "后台降雨", data: document(), onlineSource: { collection: "backend", itemId: "rainfall", fingerprint: "b".repeat(64), rendering: { engine: "未渲染", kind: "input", parameters: { inputOnly: true, contentRole: "original-role" } } } } as DbtLayer
    const sources = backendTemplateSources([layer])
    expect(sources[0].document?.metadata.onlineLayerId).toBe(layer.id)
    expect((layer.data as TemplateDocument).metadata.onlineLayerId).toBeUndefined()
    const scene = replayExpression(document(), bounds, { kind: "point-heat", options: { field: "rain_mm", unit: "mm" }, fingerprint: "a".repeat(64) })
    const painted = expressionLayer(layer, { fingerprint: "a".repeat(64), bounds, document: document(), scene, options: { field: "rain_mm", unit: "mm" } })
    expect(painted.data).toBe(layer.data)
    expect(painted.onlineSource?.rendering?.engine).toBe("Mars3D.HeatLayer")
    expect(painted.onlineSource?.rendering?.parameters?.inputOnly).toBeUndefined()
    expect(painted.onlineSource?.rendering?.parameters?.contentRole).toBe("original-role")
    expect(backendTemplateSources([{ ...layer, raster: {} as any }])[0].issue).toContain("栅格")
  })
})
