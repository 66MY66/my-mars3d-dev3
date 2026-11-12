import { describe, expect, it } from "vitest"
import { workflowRequirements, workflowMissing, workflowRequiresCore, productionItem, matchesWorkflowItem, intersectBounds, scopeFingerprint, clipWorkflowVector } from "./cartography-workflow"
import { summarizeRawValues, originalWindow, displayWindow, classifyRawValues } from "./cartography-source-window"
import { emptyDbtDocument, readDbtDocument, inspectDbtDocument, type DbtLayer } from "./dbt116-standard"
import { dbtStatistics } from "./dbt-cartography-rules"
import type { RemoteItem } from "./remote-cartography-source"
const scope = { west: 100, south: 28, east: 104, north: 32 }
const pop: RemoteItem = { type: "Feature", id: "SP-luding-pop2020", collection: "spatial-thematic", bbox: [100, 28, 104, 32], properties: { title: "历史人口" }, assets: {} }

describe("production cartography requirements", () => {
  it.each(["population-exposure", "building-resilience", "post-quake-risk", "emergency-command", "thermal-infrared", "insar-deformation", "imagery-comparison", "building-damage", "road-damage", "geological-disaster", "remote-intensity", "extreme-zone", "direct-loss"])("requires actual core data for %s rather than optional references", id => {
    expect(workflowRequiresCore(id)).toBe(true)
    expect(workflowMissing(id, ["boundary", "settlement", "imagery", "rate", "background"]).length).toBeGreaterThan(0)
  })
  it("keeps all emergency topics even without a backend", () => {
    for (const id of ["T30101000", "T30102000", "T30103000", "T30201000", "T30202000", "T30203000"]) { expect(workflowRequirements(id).length).toBeGreaterThan(5) }
    expect(workflowRequirements("T30103000").filter(r => r.role === "target")).toHaveLength(5)
  })
  it("treats topic alternatives differently from mandatory base and event data", () => {
    expect(workflowMissing("T30102000", ["population"]).some(s => s.startsWith("至少一类"))).toBe(false)
    expect(workflowMissing("T30102000", ["population"])).toContain("地震事件参数")
    expect(workflowMissing("T30201000", ["fault-reference"])).toContain("活动断层线")
  })
  it("never substitutes rate for displacement or an unverified hazard for a confirmed one", () => {
    expect(workflowMissing("insar-deformation", ["rate"])).toContain("LOS 位移与相干性")
    expect(workflowMissing("secondary-hazard", ["hazard-reference"])).toContain("已确认次生灾害")
  })
  it("never hides structurally valid backend items by name or usage labels", () => {
    expect(productionItem(pop)).toBe(true)
    expect(productionItem({ ...pop, id: "SP-luding-intensity" })).toBe(true)
    expect(productionItem({ ...pop, id: "GF2_DEMO" })).toBe(true)
    expect(productionItem({ ...pop, properties: { usage: "synthetic" } })).toBe(true)
    expect(matchesWorkflowItem(pop, "population")).toBe(true)
    expect(matchesWorkflowItem(pop, "economy")).toBe(false)
    expect(matchesWorkflowItem({ ...pop, id: "unknown-population-filename" }, "population")).toBe(false)
  })
  it("does not ask the backend to deliver a precomputed distance file for a basic map", () => {
    expect(workflowMissing("T30101000", ["event", "intensity", "boundary", "settlement", "water", "transport", "dem"])).toEqual([])
    expect(workflowRequirements("T30101000").find(entry => entry.key === "distance")?.group).toBe("optional")
  })
  it("only accepts explicitly declared roles for later population items", () => {
    expect(matchesWorkflowItem({ ...pop, id: "future-source", properties: { "cartography:role": "population" } }, "population")).toBe(true)
  })
})
describe("selection and original raster statistics", () => {
  it("does not move a non-overlapping source to fill the selection", () => {
    expect(intersectBounds(scope, { west: 110, east: 114, south: 28, north: 32 })).toBeNull()
    expect(() => originalWindow(100, 100, scope, { west: 110, east: 114, south: 28, north: 32 })).toThrow("不相交")
  })
  it("retains the source pixel grid and refuses silent downsampling", () => {
    const result = originalWindow(400, 400, scope, { west: 101.005, east: 102.005, south: 29.005, north: 30.005 })
    expect(result.window).toEqual([100, 199, 201, 300])
    expect(result.bounds.west).toBe(101)
    expect(() => originalWindow(2000, 2000, scope, scope)).toThrow("100 万")
  })
  it("clips partial edge cells exactly without stretching the source grid to the selected bounds", () => {
    const selected = { west: 101.007, east: 102.003, south: 29.007, north: 30.003 }
    const geometry = originalWindow(400, 400, scope, selected)
    const display = displayWindow(geometry, selected)
    expect(display.bounds).toEqual(selected)
    expect(display.x).toBeCloseTo(0.7); expect(display.y).toBeCloseTo(0.7)
    expect(display.width).toBeCloseTo(99.6); expect(display.height).toBeCloseTo(99.6)
    expect(geometry.window).toEqual([100, 199, 201, 300])
  })
  it("does not fill uncovered parts of a selection with stretched data", () => {
    const selected = { west: 99, east: 102.003, south: 29.007, north: 33 }
    const display = displayWindow(originalWindow(400, 400, scope, selected), selected)
    expect(display.bounds).toEqual({ west: 100, east: 102.003, south: 29.007, north: 32 })
    expect(display.x).toBe(0); expect(display.y).toBe(0)
  })
  it("preserves zero and separates NoData from outside pixels without returning a business total", () => {
    expect(summarizeRawValues([0, 10, null, undefined])).toEqual({ valid: 2, missing: 1, outside: 1, minimum: 0, maximum: 10, mean: 5 })
    expect(summarizeRawValues([null]).minimum).toBeNull()
    expect(() => summarizeRawValues([NaN])).toThrow("无效数值")
    expect(summarizeRawValues([0, 10])).not.toHaveProperty("total")
  })
  it("derives distinguishable classes from the selected values instead of an unrelated display maximum", () => {
    const values = [0, 2, 5, 10, 30, 80, 200, 419, null]
    const mapped = classifyRawValues(values, { band: 1, minimum: 0, maximum: 5000, automatic: true })
    expect(mapped.color(2)).not.toBe(mapped.color(419))
    expect(mapped.legend.at(-2)!.label).toContain("419")
    expect(mapped.legend.at(-1)!.label).toContain("NoData")
    expect(mapped.summary.valid).toBe(8)
  })
  it("uses different semantic palettes and handles constant data without fabricated classes", () => {
    const options = { band: 1, minimum: 0, maximum: 100, automatic: true }
    expect(classifyRawValues([0, 100], options, "population").color(100)).not.toBe(classifyRawValues([0, 100], options, "economy").color(100))
    expect(classifyRawValues([0, 0, 0], options).legend).toHaveLength(1)
    expect(() => classifyRawValues([1], { ...options, count: 20 })).toThrow("分级方法或数量")
  })
  it("keys tasks by real coordinates, not screen size", () => { expect(scopeFingerprint(scope)).toBe(scopeFingerprint({ ...scope })); expect(scopeFingerprint(null)).toBe("") })
  it("filters vector geometry rather than trusting the STAC bounding box", () => {
    const data: any = { type: "FeatureCollection", metadata: { source: "backend" }, features: [100.5, 120].map(lon => ({ type: "Feature", properties: { value: lon }, geometry: { type: "Point", coordinates: [lon, 30] } })) }
    const result = clipWorkflowVector(data, scope)
    expect(result.features).toHaveLength(1); expect(result.features[0].geometry.coordinates).toEqual([100.5, 30])
  })
})
describe("bound provenance and formal checks", () => {
  const layer: DbtLayer = { id: "online:population", name: "人口分布", role: "population", crs: "EPSG:4326", authority: "", source: "backend.tif", security: "", publishedAt: "2020", scale: 0, data: { type: "FeatureCollection", features: [] }, raster: { image: "data:image/png;base64,AA==", bounds: scope, rendering: "classified", radiometry: "原始窗口" }, onlineSource: { collection: "spatial-thematic", itemId: "pop", asset: "data", revision: "r1", fingerprint: "a".repeat(64), scope, statistics: { valid: 2, missing: 1, minimum: 0, maximum: 10, mean: 5 } } }
  it("blocks changing an unverified online document to operational use", () => {
    const doc = { ...emptyDbtDocument(), crs: "EPSG:4326", usage: "reference" as const, reference: { title: "人口校样", bounds: scope, notice: "待核验" }, layers: [layer] }
    expect(readDbtDocument(doc).layers[0].onlineSource?.revision).toBe("r1")
    expect(() => readDbtDocument({ ...doc, usage: "operational", reference: undefined })).toThrow("待核验")
    expect(inspectDbtDocument(doc, "T30102000").some(i => i.message.includes("待核验"))).toBe(true)
  })
  it("reports raw statistics, never a fake population sum from an image", () => {
    const doc = { ...emptyDbtDocument(), layers: [layer] }
    const rows = dbtStatistics(doc, "T30102000", [layer], scope)
    expect(rows.some(row => row.unit === "人")).toBe(false)
    expect(rows[0].value).toBe(0)
    const imageOnly = { ...layer, onlineSource: undefined }
    expect(dbtStatistics(doc, "T30102000", [imageOnly], scope)[0].value).toBeNull()
  })
})
