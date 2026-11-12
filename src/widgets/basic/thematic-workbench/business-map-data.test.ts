import { webcrypto } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import { featureCollection, point, polygon, lineString } from "@turf/turf"
import { availableFields, businessChartOption, businessResult, collectMapDataSources, defaultBusinessField, readBusinessDocument, templateSourceIssue } from "./business-map-data"
import { businessStandardLayer } from "./business-standard-layer"
import { renderTemplateDocument, type TemplateDocument } from "./template-renderer"

// These coordinates and values are isolated assertions, never operational data.
const bounds = { west: 103, east: 106, south: 25, north: 28 }
function fixture(): TemplateDocument {
  return { ...featureCollection([point([104, 26], { value: 10 }), point([105, 27], { value: 30 }), point([110, 30], { value: 999 })]), metadata: { source: "QA isolated assertions", unit: "件", observedAt: "2026-10-20T00:00:00Z" } }
}
afterEach(() => vi.unstubAllGlobals())
describe("source-backed business cartography", () => {
  it.each([{ usage: "test" }, { source: "合成测试" }, { originalSampleBounds: bounds }, { extentMode: "selection" }, { source: "RGB 亮度采样" }])("rejects synthetic or image-derived inputs %j", metadata => {
    const data = fixture(); Object.assign(data.metadata, metadata)
    expect(() => readBusinessDocument(data)).toThrow("不能用于业务模板")
  })
  it.each(["EPSG:3857", "GCJ02", "EPSG:4547"])("does not relabel %s as geographic data", crs => {
    const data = fixture(); data.metadata.crs = crs
    expect(() => readBusinessDocument(data)).toThrow("坐标")
  })
  it("preserves source geometry, identifiers, CRS and metadata without mutating the input", () => {
    const raw = fixture(); raw.features[0].id = "source-42"; raw.metadata.crs = "EPSG:4490"
    const original = JSON.stringify(raw); const parsed = readBusinessDocument(raw)
    expect(parsed.features[0].properties.sourceFeatureId).toBe("source-42")
    expect(parsed.features[0].geometry).toEqual(raw.features[0].geometry)
    expect(parsed.metadata.crs).toBe("EPSG:4490")
    expect(JSON.stringify(raw)).toBe(original)
  })
  it("only collects visible source layers, never generated overlays or unreadable imagery", () => {
    const source = { id: "business", type: "geojson", name: "业务", options: { data: fixture() } }
    const result = collectMapDataSources([{ id: "group", layers: [source, source] }, { ...source, id: "hidden", show: false }, { ...source, id: "thematic-workbench-rendered" }, { id: "image", name: "影像", type: "xyz", options: {} }])
    expect(result.map(item => item.id)).toEqual(["business", "image"])
    expect(result[0].document?.features).toHaveLength(3)
    expect(result[1].document).toBeUndefined()
    expect(result[1].issue).toContain("不能代替业务指标")
  })
  it("reads loaded GeoJSON features but rejects offset-coordinate layers", () => {
    const layer = { id: "remote", type: "geojson", name: "远程", options: { url: "/source.geojson" }, toGeoJSON: () => fixture() }
    expect(collectMapDataSources([layer])[0].document?.features).toHaveLength(3)
    expect(collectMapDataSources([{ ...layer, options: { chinaCRS: "GCJ02" } }])[0].issue).toContain("偏移坐标")
  })
  it("does not silently choose one of several numeric indicators", () => {
    const doc = fixture()
    doc.features.forEach(f => { f.properties = { people: 5, assets: 7, adcode: 12 } })
    expect(defaultBusinessField(doc, "choropleth")).toBe("")
    doc.metadata.valueField = "assets"
    expect(defaultBusinessField(doc, "choropleth")).toBe("assets")
    doc.features[0].properties.assets = null
    expect(availableFields(doc)).not.toContain("assets")
  })
  it("rejects incompatible geometry and accepts economic exposure without a population column", () => {
    expect(templateSourceIssue(fixture(), "choropleth")).toBe("需要面要素")
    const doc = fixture()
    doc.features = [polygon([[[103, 25], [104, 25], [104, 26], [103, 26], [103, 25]]], { asset_value: 500, intensity: 7 })]
    expect(templateSourceIssue(doc, "population-exposure", "asset_value")).toBe("")
    expect(templateSourceIssue(doc, "population-exposure", "population")).toContain("population")
  })
  it("filters an extent without shifting coordinates or filling the missing area", () => {
    const doc = readBusinessDocument(fixture())
    const scene = renderTemplateDocument("graduated-symbol", doc, bounds, { field: "value" })
    expect(scene.rows.map(row => row.value)).toEqual([10, 30])
    expect(scene.features.map(f => f.geometry)).toEqual(doc.features.slice(0, 2).map(f => f.geometry))
    expect(() => renderTemplateDocument("graduated-symbol", doc, { west: 115, east: 116, south: 35, north: 36 })).toThrow("没有匹配数据")
  })
  it("does not move polygon-derived symbols when the extent changes", () => {
    const doc = fixture()
    doc.features = [polygon([[[103, 25], [105, 25], [105, 27], [103, 27], [103, 25]]], { value: 20 })]
    const a = renderTemplateDocument("graduated-symbol", doc, bounds)
    const b = renderTemplateDocument("graduated-symbol", doc, { west: 103.9, east: 105.8, south: 25.8, north: 27.8 })
    expect(a.features[0].geometry).toEqual(b.features[0].geometry)
  })
  it("hashes a detached snapshot and builds charts only from rendered features", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const doc = readBusinessDocument(fixture())
    const scene = renderTemplateDocument("graduated-symbol", doc, bounds)
    const result = await businessResult(doc, scene, bounds, { field: "value" })
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    const bar = businessChartOption(result, "deformation-bar") as any
    expect(bar.series[0].data.map((d: any) => d.value)).toEqual([10, 30])
    const pie = businessChartOption(result, "population-distribution") as any
    expect(pie.series[0].data.reduce((sum: number, d: any) => sum + d.value, 0)).toBe(2)
    doc.features[0].properties.value = 5
    expect(result.document.features[0].properties.value).toBe(10)
    expect((await businessResult(doc, scene, bounds, { field: "value" })).fingerprint).not.toBe(result.fingerprint)
  })
  it("counts categories by attribute rather than palette color", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const doc = fixture()
    doc.features = Array.from({ length: 10 }, (_, i) => polygon([[[103, 25], [104, 25], [104, 26], [103, 26], [103, 25]]], { category: "category-" + i }))
    const scene = renderTemplateDocument("unique-value", doc, bounds, { field: "category" })
    const result = await businessResult(doc, scene, bounds, {})
    const chart = businessChartOption(result, "population-distribution") as any
    expect(chart.series[0].data).toHaveLength(10)
    expect(chart.series[0].data.every((d: any) => d.value === 1)).toBe(true)
  })
  it("counts actual directional lines and does not invent an observation timestamp", () => {
    const doc = fixture(); doc.metadata.unit = "m3/s"; doc.features = [lineString([[104, 26], [105, 27]], { flow_rate: 8 })]
    expect(renderTemplateDocument("flow-direction", doc, bounds).rows[0].value).toBe(8)
    delete doc.metadata.observedAt
    doc.features = fixture().features
    expect(renderTemplateDocument("graduated-symbol", doc, bounds).time).toBe("")
  })
  it("preserves standard provenance and refuses to guess a layer role", () => {
    const document = fixture()
    expect(() => businessStandardLayer({ id: "x", name: "人口", document })).toThrow("未声明")
    Object.assign(document.metadata, { role: "population", authority: "QA authority", scale: 50000, crs: "EPSG:4326", coverage: bounds, coverageEvidence: "QA coverage", security: "public" })
    const layer = businessStandardLayer({ id: "x", name: "人口", document })
    expect(layer.crs).toBe("EPSG:4326")
    expect(layer.authority).toBe("QA authority")
    expect(layer.scale).toBe(50000)
    expect(layer.coverageEvidence).toBe("QA coverage")
    expect(layer.data.features[0].geometry).toEqual(document.features[0].geometry)
    const missing = businessStandardLayer({ id: "y", name: "未核验", document: fixture() }, "target")
    expect(missing.authority).toBe("")
    expect(missing.scale).toBe(0)
    expect(missing.security).toBe("")
  })
})
