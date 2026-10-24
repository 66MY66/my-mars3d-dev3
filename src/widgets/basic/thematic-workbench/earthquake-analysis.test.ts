import { describe, expect, it } from "vitest"
import { analyzeEarthquakeDataset, filterEarthquakePoints, loadEarthquakeParameters, parseEarthquakeGeoJson, type EarthquakeDataset } from "./earthquake-analysis"

const bounds = { west: 99, south: 19, east: 102, north: 22 }
const metadata = {
  source: "field-observations",
  observedAt: "2026-01-01T00:00:00Z",
  temperatureUnit: "K",
  baselinePeriod: "2018-2025 same-season",
  losUnit: "mm",
  losConvention: "toward_positive",
  acquisitionPair: "2025-12-20/2026-01-01",
  riskModel: "relative-screening-v1",
  intensityStandard: "GB/T 17742-2020"
}

function dataset(properties: Array<Record<string, unknown>>): EarthquakeDataset {
  return parseEarthquakeGeoJson({
    type: "FeatureCollection",
    metadata,
    features: properties.map((item, index) => ({ type: "Feature", geometry: { type: "Point", coordinates: [100 + index * 0.1, 20] }, properties: item }))
  })
}

describe("earthquake observations", () => {
  it("rejects unprovenanced or invalid-position data", () => {
    expect(() => parseEarthquakeGeoJson({ type: "FeatureCollection", metadata: {}, features: [] })).toThrow(/source|observedAt|来源/)
    expect(() => parseEarthquakeGeoJson({ type: "FeatureCollection", metadata, features: [{ type: "Feature", geometry: { type: "Point", coordinates: [200, 20] }, properties: {} }] })).toThrow(/坐标/)
  })

  it("calculates quality-controlled thermal z scores and excludes out-of-scope points", () => {
    const source = dataset([
      { lst_k: 310, baseline_mean_k: 300, baseline_sd_k: 4, baseline_count: 20, quality_flag: "good" },
      { lst_k: 320, baseline_mean_k: 300, baseline_sd_k: 4, baseline_count: 20, quality_flag: "bad" },
      { lst_k: 302, baseline_mean_k: 300, baseline_sd_k: 4, baseline_count: 20, quality_flag: "good" }
    ])
    source.features.push({ lon: 130, lat: 40, properties: { lst_k: 320, baseline_mean_k: 300, baseline_sd_k: 4, baseline_count: 20, quality_flag: "good" } })
    const result = analyzeEarthquakeDataset(source, "thermal", bounds, { thermalZ: 2 })
    expect(result.totalInScope).toBe(3)
    expect(result.excludedCount).toBe(1)
    expect(result.points[0].value).toBe(2.5)
    expect(result.points[0].band).toBe("热异常")
  })

  it("screens LOS observations by coherence and preserves signed displacement", () => {
    const result = analyzeEarthquakeDataset(dataset([{ los_mm: -25, coherence: 0.7 }, { los_mm: 80, coherence: 0.2 }]), "deformation", bounds, { coherenceMin: 0.4, deformationMm: 20 })
    expect(result.points).toHaveLength(1)
    expect(result.points[0].band).toBe("LOS 负向")
    expect(result.excludedCount).toBe(1)
  })

  it("combines only bounded hazard, exposure, and vulnerability indices", () => {
    const result = analyzeEarthquakeDataset(dataset([{ hazard_index: 0.8, exposure_index: 0.75, vulnerability_index: 0.5 }, { hazard_index: 2, exposure_index: 0.7, vulnerability_index: 0.5 }]), "risk", bounds)
    expect(result.points[0].value).toBeCloseTo(0.3)
    expect(result.points[0].band).toBe("优先核查")
    expect(result.excludedCount).toBe(1)
  })

  it("keeps only PGA and PGV observations with a matching VI-XI grade", () => {
    const result = analyzeEarthquakeDataset(dataset([{ pga_ms2: 2.79, pgv_ms: 0.258 }, { pga_ms2: 2.79, pgv_ms: 0.555 }, { pga_ms2: 0.1, pgv_ms: 0.01 }, { pga_ms2: 0.95, pgv_ms: 0.06 }]), "intensity", bounds)
    expect(result.points).toHaveLength(1)
    expect(result.points[0].band).toBe("VIII")
    expect(result.excludedCount).toBe(3)
  })

  it("fails closed when required units or valid observations are absent", () => {
    const source = dataset([{ los_mm: 30, coherence: 0.8 }])
    source.metadata.losUnit = "m"
    expect(() => analyzeEarthquakeDataset(source, "deformation", bounds)).toThrow(/mm/)
    expect(() => analyzeEarthquakeDataset(dataset([{ pga_ms2: 2.79, pgv_ms: 0.555 }]), "intensity", bounds)).toThrow(/无有效/)
  })

  it("loads only bounded processing defaults from observation metadata", () => {
    expect(loadEarthquakeParameters({ analysisParams: { thermalZ: 3.2, coherenceMin: 0.65, deformationMm: 110, riskHigh: "0.4" } })).toEqual({
      thermalZ: 3.2, coherenceMin: 0.65, deformationMm: 20, riskHigh: 0.25
    })
  })

  it("combines numeric, spatial, and feature filters without changing source points", () => {
    const points = analyzeEarthquakeDataset(dataset([
      { hazard_index: 0.9, exposure_index: 0.8, vulnerability_index: 0.6 },
      { hazard_index: 0.6, exposure_index: 0.7, vulnerability_index: 0.4 },
      { hazard_index: 0.1, exposure_index: 0.2, vulnerability_index: 0.3 }
    ]), "risk", bounds).points
    const filtered = filterEarthquakePoints(points, { min: 0.2, max: 0.5, band: "优先核查", bounds: { west: 99.9, east: 100.05, south: 19.9, north: 20.1 } })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].value).toBeCloseTo(0.432)
    expect(points).toHaveLength(3)
    expect(filterEarthquakePoints(points, { min: null, max: null, band: "all", bounds: null })).toHaveLength(3)
  })
})
