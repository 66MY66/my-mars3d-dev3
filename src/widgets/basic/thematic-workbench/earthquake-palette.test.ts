import { describe, expect, it } from "vitest"
import { analyzeEarthquakeDataset, type EarthquakeDataset } from "./earthquake-analysis"
import { earthquakeLegend, earthquakePalette, INTENSITY_COLORS } from "./earthquake-palette"
import { scanTargets, type DisplayPoint } from "./display-model"
import { createStyleMapper, defaultRenderStyle } from "./render-style"

const bounds = { west: 99, south: 29, east: 101, north: 31 }
const thresholds = { thermalZ: 2, deformationMm: 20, riskHigh: 0.3 }
function data(properties: Array<Record<string, unknown>>): EarthquakeDataset {
  return { source: "synthetic QA", observedAt: "2026-09-28", metadata: { temperatureUnit: "K", baselinePeriod: "test", losUnit: "mm", losConvention: "toward_positive", acquisitionPair: "test", riskModel: "relative-screening-v1", intensityStandard: "GB/T 17742-2020" }, features: properties.map(item => ({ lon: 100, lat: 30, properties: item })) }
}
describe("earthquake business colors", () => {
  it("uses normative RGB, not a sampled or interpolated intensity palette", () => {
    expect(Object.values(INTENSITY_COLORS)).toEqual(["#ffd2da", "#ffbebe", "#ff7f7f", "#c82828", "#a80000", "#8c0000"])
    const result = analyzeEarthquakeDataset(data([[0.6, 0.06], [1.2, 0.12], [2.7, 0.25], [5, 0.5], [10, 1], [20, 2]].map(([pga_ms2, pgv_ms]) => ({ pga_ms2, pgv_ms }))), "intensity", bounds)
    expect(result.points.map(point => point.color)).toEqual(Object.values(INTENSITY_COLORS))
    expect(earthquakeLegend(result.palette)).toHaveLength(6)
    expect(result.palette.note).toContain("初判")
  })
  it("keeps thermal boundaries, neutral cold values and stable ordered legends", () => {
    const result = analyzeEarthquakeDataset(data([308, 300, 292].map(lst_k => ({ lst_k, baseline_mean_k: 300, baseline_sd_k: 4, baseline_count: 20, quality_flag: "good" }))), "thermal", bounds, thresholds)
    expect(result.points.map(point => point.color)).toEqual(["#d73027", "#fee08b", "#9aa6b2"])
    expect(result.rows.map(row => row.label)).toEqual(["偏冷", "背景范围", "热异常"])
  })
  it("preserves signed LOS colors and declares the data's physical direction", () => {
    const dataset = data([-20, 0, 20].map(los_mm => ({ los_mm, coherence: 0.8 })))
    const result = analyzeEarthquakeDataset(dataset, "deformation", bounds, thresholds)
    expect(result.points.map(point => point.color)).toEqual(["#2166ac", "#f7f7f7", "#b2182b"])
    expect(result.palette.entries[0].label).toContain("远离卫星")
    expect(earthquakePalette("deformation", thresholds, "away_positive").entries[0].label).toContain("朝向卫星")
    expect(scanTargets(result.points).map(point => point.value)).toEqual([-20, 20])
  })
  it("assigns green/yellow/red at exact risk boundaries without rounding classification", () => {
    const result = analyzeEarthquakeDataset(data([0, thresholds.riskHigh / 3, 0.3, 1].map(hazard_index => ({ hazard_index, exposure_index: 1, vulnerability_index: 1 }))), "risk", bounds, thresholds)
    expect(result.points.map(point => point.color)).toEqual(["#27925d", "#f2c94c", "#d83b36", "#d83b36"])
    expect(scanTargets(result.points).map(point => point.value)).toEqual([0.3, 1])
    expect(scanTargets(result.points.slice(0, 2))).toEqual([])
  })
  it("does not invent thermal anomalies or animate zero-valued samples", () => {
    const point: DisplayPoint = { lon: 100, lat: 30, value: 1, band: "背景范围", color: "#fee08b", label: "" }
    expect(scanTargets([point])).toEqual([])
    expect(scanTargets([{ ...point, value: 0, band: "截图像元" }])).toEqual([])
  })
})
describe("cached rendering", () => {
  it("recolors cached breaks, invalidates NoData and keeps older mappings immutable", () => {
    const values = [0, 1, 2, 10, NaN]
    const mapper = createStyleMapper(values)
    const style = { ...defaultRenderStyle(), mode: "classified" as const, count: 2 }
    const first = mapper(style)
    const firstColor = first.color(10)
    style.high = "#ff0000"
    const next = mapper(style)
    expect(next.color(10)).toBe("#ff0000")
    expect(first.color(10)).toBe(firstColor)
    expect(mapper({ ...style, nodata: 10 }).color(10)).toBeNull()
    expect(mapper({ ...style, mode: "raster", min: 0, max: 10 }).color(20)).toBe("#ff0000")
    expect(values).toEqual([0, 1, 2, 10, NaN])
  })
  it("supports all methods, unique values and raster without repeated source sorting", () => {
    const mapper = createStyleMapper(Array.from({ length: 230400 }, (_, i) => i % 20))
    for (const method of ["equal", "quantile", "natural"] as const) {
      const mapping = mapper({ ...defaultRenderStyle(), mode: "classified", method })
      expect(mapping.legend.length).toBeGreaterThan(1)
      expect(mapping.color(19)).toBe(defaultRenderStyle().high)
    }
    expect(mapper({ ...defaultRenderStyle(), mode: "unique" }).legend).toHaveLength(20)
    expect(() => mapper({ ...defaultRenderStyle(), mode: "raster", min: NaN })).toThrow("有限")
  })
})
