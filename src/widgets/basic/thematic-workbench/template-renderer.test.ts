import { describe, expect, it } from "vitest"
import { featureCollection, lineString, multiPolygon, point, polygon } from "@turf/turf"
import { readTemplateDocument, renderTemplateDocument, rgbGridDocument, TEMPLATE_CONTRACTS, type TemplateDocument } from "./template-renderer"

const bounds = { west: 103, east: 105, south: 25, north: 27 }
const metadata = {
  source: "测试夹具，非业务数据",
observedAt: "2026-09-29T10:00:00Z",
unit: "test",
  temperatureUnit: "K",
baselinePeriod: "2020–2025",
losUnit: "mm",
losConvention: "toward_positive",
acquisitionPair: "2026-09-01/2026-09-15",
  riskModel: "relative-screening-v1",
model: "fixture-v1",
weights: [1, 2, 1],
normalization: "0–1",
  depthUnit: "km",
magnitudeType: "Mw",
intensityStandard: "GB/T 17742-2020",
assessment: "测试夹具",
populationUnit: "人",
  beforeTime: "2026-09-01T00:00:00Z",
afterTime: "2026-09-15T00:00:00Z"
}
function fixture(kind: string): TemplateDocument {
  if (kind.startsWith("raster-")) {
    return readTemplateDocument({ ...featureCollection(Array.from({ length: 9 }, (_, i) => point([103.2 + i % 3 * 0.5, 25.2 + Math.floor(i / 3) * 0.5], { value: i * 20 }))), metadata })
  }
  const features = [0, 1, 2].map(i => {
    const p = {
 name: `对象${i}`,
value: (i + 1) * 10,
category: ["甲", "乙", "丙"][i],
observedAt: `2026-09-29T0${i}:00:00Z`,
track_id: "a",
magnitude: i + 3,
depth_km: 10 + i * 20,
flow_rate: i + 2,
      hazard_index: 0.5,
exposure_index: 0.8,
vulnerability_index: (i + 1) / 3,
risk_index: i / 2,
      thermal_index: 0.5,
deformation_index: 0.75,
seismic_index: 0.25,
lst_k: 300 + i * 3,
baseline_mean_k: 300,
baseline_sd_k: 2,
baseline_count: 20,
quality_flag: "good",
      los_mm: (i - 1) * 35,
coherence: 0.8,
intensity: i + 6,
population: 100 * (i + 1),
before: 10,
after: i * 10,
      hazard_type: ["滑坡", "火灾", "堰塞湖"][i],
severity: i + 1,
resource_type: "救援队",
status: ["available", "blocked", "unknown"][i] 
}
    const x = 103.1 + i * 0.5
    if (kind === "flow-direction") { return lineString([[x, 25.3], [x + 0.3, 26.2]], p) }
    if (["choropleth", "unique-value", "risk-overlay", "post-quake-risk", "building-resilience", "population-exposure", "intensity-distribution", "anomaly-composite", "time-compare", "secondary-hazard", "chart-linkage"].includes(kind)) { return polygon([[[x, 25.3], [x + 0.4, 25.3], [x + 0.4, 26.2], [x, 26.2], [x, 25.3]]], p) }
    return point([x, 25.3 + i * 0.3], p)
  })
  return readTemplateDocument({ ...featureCollection(features), metadata })
}

describe("template catalog rendering", () => {
  it.each(["point-heat", "graduated-symbol", "chart-linkage"])("ignores empty clipped multipart regions for %s", kind => {
    const outsideLeft = [[[101, 25], [102, 25], [102, 26], [101, 26], [101, 25]]]
    const outsideRight = [[[106, 25], [107, 25], [107, 26], [106, 26], [106, 25]]]
    const inside = [[[103.5, 25.5], [104, 25.5], [104, 26], [103.5, 26], [103.5, 25.5]]]
    const input = readTemplateDocument({
 ...featureCollection([
      multiPolygon([outsideLeft, outsideRight], { value: 100 }),
      multiPolygon([outsideLeft, inside, outsideRight], { value: 20 })
    ]),
metadata 
})
    const original = JSON.stringify(input)
    const result = renderTemplateDocument(kind, input, bounds)
    expect(result.features).toHaveLength(1)
    expect(result.features[0].properties.value).toBe(20)
    expect(JSON.stringify(input)).toBe(original)
    if (result.heat) { expect(result.heat.every(p => Number.isFinite(p.lng) && Number.isFinite(p.lat))).toBe(true) }
  })
  it("covers all 22 catalog contracts", () => { expect(Object.keys(TEMPLATE_CONTRACTS)).toHaveLength(22) })
  for (const kind of Object.keys(TEMPLATE_CONTRACTS).filter(kind => kind !== "contour")) {
    it(`renders actual ${kind} input without mutating its source`, () => {
      const input = fixture(kind); const original = JSON.stringify(input)
      const result = renderTemplateDocument(kind, input, bounds, { field: kind === "unique-value" ? "category" : "value" })
      expect(result.features.length).toBeGreaterThan(0)
      expect(result.legend.length).toBeGreaterThan(0)
      expect(result.features.every(f => f.properties.color && Number.isFinite(f.properties.value))).toBe(true)
      expect(JSON.stringify(input)).toBe(original)
    })
  }
  it("extracts multiple isolines from the selected RGB grid without claiming elevation", () => {
    const pixels = new Uint8ClampedArray(32 * 24 * 4)
    for (let i = 0; i < pixels.length; i += 4) { pixels.set([i % 255, i % 255, i % 255, 255], i) }
    const grid = rgbGridDocument(pixels, 32, 24, bounds)
    const result = renderTemplateDocument("contour", grid, bounds)
    expect(result.features).toHaveLength(5)
    expect(result.features.every(f => f.geometry.type === "MultiLineString")).toBe(true)
    expect(result.source).toContain("非高程")
  })
  it("changes trajectory geometry with playback and never mixes track groups", () => {
    const input = fixture("trajectory")
    const early = renderTemplateDocument("trajectory", input, bounds, { progress: 0 })
    const full = renderTemplateDocument("trajectory", input, bounds, { progress: 100 })
    expect(early.features).toHaveLength(1); expect(full.features).toHaveLength(5)
    input.features[1].properties.track_id = "b"
    expect(renderTemplateDocument("trajectory", input, bounds).features.filter(f => f.properties.arrow)).toHaveLength(1)
  })
  it("rejects duplicate and nonuniform contour grid coordinates", () => {
    const pixels = new Uint8ClampedArray(32 * 24 * 4).fill(120)
    const duplicated = rgbGridDocument(pixels, 32, 24, bounds)
    duplicated.features[0] = duplicated.features[1]
    expect(() => renderTemplateDocument("contour", duplicated, bounds)).toThrow("完整规则")
    const irregular = rgbGridDocument(pixels, 32, 24, bounds)
    irregular.features[0].geometry = { type: "Point", coordinates: [bounds.west + 0.01, bounds.north] }
    expect(() => renderTemplateDocument("contour", irregular, bounds)).toThrow("完整规则")
  })
  it("renders declared asset exposure without interpreting exposure as damage", () => {
    const input = fixture("population-exposure")
    input.metadata.assetUnit = "万元"
    input.features.forEach((feature, index) => { feature.properties.asset_value = 1000 * (index + 1) })
    const result = renderTemplateDocument("population-exposure", input, bounds, { exposure: "asset_value", threshold: 7 })
    expect(result.features.map(f => f.properties.value)).toEqual([2000, 3000])
    expect(result.unit).toBe("万元")
    expect(result.note).toContain("不等于经济损失")
    delete input.metadata.assetUnit
    expect(() => renderTemplateDocument("population-exposure", input, bounds, { exposure: "asset_value" })).toThrow("assetUnit")
  })
  it("clips crossing trajectories even when both observed endpoints are outside", () => {
    const input = fixture("trajectory")
    input.features = [point([102, 26], input.features[0].properties), point([106, 26], input.features[1].properties)]
    const result = renderTemplateDocument("trajectory", input, bounds)
    expect(result.features).toHaveLength(1)
    expect((result.features[0].geometry as any).coordinates).toEqual([[103, 26], [105, 26]])
  })
  it("computes declared risk product and weighted normalized anomaly", () => {
    expect(renderTemplateDocument("risk-overlay", fixture("risk-overlay"), bounds).features[2].properties.value).toBeCloseTo(0.4)
    expect(renderTemplateDocument("anomaly-composite", fixture("anomaly-composite"), bounds).features[0].properties.value).toBeCloseTo(0.5625)
    expect(renderTemplateDocument("time-compare", fixture("time-compare"), bounds).features.map(f => f.properties.value)).toEqual([-10, 0, 10])
  })
  it("excludes low coherence and preserves whole-region exposed population", () => {
    const input = fixture("insar-deformation"); input.features[0].properties.coherence = 0.1
    expect(renderTemplateDocument("insar-deformation", input, bounds).features).toHaveLength(2)
    const result = renderTemplateDocument("population-exposure", fixture("population-exposure"), { ...bounds, east: 104.4 }, { threshold: 7 })
    expect(result.features.map(f => f.properties.value)).toEqual([200, 300])
  })
  it("rejects missing observations, invalid indices, timestamps and out-of-scope data", () => {
    const risk = fixture("risk-overlay"); risk.features[0].properties.hazard_index = 2
    expect(() => renderTemplateDocument("risk-overlay", risk, bounds)).toThrow("hazard_index")
    const time = fixture("time-compare"); time.metadata.beforeTime = "2026-10-01T00:00:00Z"
    expect(() => renderTemplateDocument("time-compare", time, bounds)).toThrow("晚于")
    const thermal = fixture("thermal-infrared"); delete thermal.metadata.baselinePeriod
    expect(() => renderTemplateDocument("thermal-infrared", thermal, bounds)).toThrow("基准期")
    expect(() => renderTemplateDocument("graduated-symbol", fixture("graduated-symbol"), { west: 1, east: 2, south: 1, north: 2 })).toThrow("没有匹配")
    expect(() => readTemplateDocument({ type: "FeatureCollection", features: [] })).toThrow()
  })
})
