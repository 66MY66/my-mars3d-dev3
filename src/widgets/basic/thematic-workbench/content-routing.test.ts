import { describe, expect, it } from "vitest"
import { area, polygon, point, featureCollection, booleanValid } from "@turf/turf"
import { inspectJsonContent, inspectRasterContent, prepareContentDocument, recommendExpression } from "./content-routing"
import { contentBindings } from "./backend-content-routing"
import { clipWorkflowVector, workflowRequirements } from "./cartography-workflow"
import { bindExpressionFields } from "./expression-presentation"
import { supplementalSheetKeys } from "./supplemental-cartography"
import { normalizeContentGeometry } from "./content-geometry"

const square = (x: number, properties: any) => polygon([[[x, 20], [x + 2, 20], [x + 2, 22], [x, 22], [x, 20]]], properties)
const document = (features: any[], metadata = {}) => ({ ...featureCollection(features), metadata }) as any
const scope = { west: 100, south: 20, east: 101, north: 21 }

describe("backend content routing, independent of catalog names", () => {
  it("unions overlapping valid multipart regions without changing attributes or the source", () => {
    const first = square(100, { 受灾人口: 100 })
    const raw = document([{ ...first, geometry: { type: "MultiPolygon", coordinates: [first.geometry.coordinates, square(101, {}).geometry.coordinates] } }])
    const original = structuredClone(raw)
    const normalized = normalizeContentGeometry(raw)
    expect(normalized.features[0].properties).toEqual(first.properties)
    expect(normalized.metadata.geometryNormalizations[0].operation).toBe("union-overlapping-valid-parts")
    expect(area(normalized.features[0])).toBeLessThan(area(raw.features[0]))
    expect(raw).toEqual(original)
  })
  it("distinguishes workspace and report documents from map features", () => {
    expect(inspectJsonContent({ version: 1, layers: [] }).kind).toBe("workspace")
    expect(inspectJsonContent({ report_type: "assessment", event_info: {} }).kind).toBe("report")
    expect(recommendExpression(inspectJsonContent({ version: 1, layers: [] }), "choropleth")).toBeNull()
  })
  it("never turns administrative codes, coordinates or shape areas into business metrics", () => {
    const profile = inspectJsonContent(document([square(100, { PAC: 530100, SHAPE_Area: 2, OBJECTID: 3 })]))
    expect(profile.groups[0].roles).toContain("admin-area")
    expect(recommendExpression(profile, "choropleth")).toBeNull()
  })
  it("uses actual numeric text rainfall and rejects points outside the query", () => {
    const raw = document([point([100.5, 20.5], { rain_mm: "12.4", lat: 20.5 }), point([104, 30], { rain_mm: "20.5" })])
    const profile = inspectJsonContent(raw, scope)
    expect(profile.count).toBe(1)
    expect(recommendExpression(profile, "point-heat")).toMatchObject({ field: "rain_mm", unit: "mm", geometry: "point" })
  })
  it("does not interpret thermal anomaly intensity as earthquake intensity", () => {
    const thermal = inspectJsonContent(document([square(100, { intensity: 3, alice: 2.8, max_bt: 306 })]))
    expect(thermal.groups[0].roles).not.toContain("assessment-intensity")
    const seismic = inspectJsonContent(document([square(100, { intensity: 7, intensity_label: "VII" })]))
    expect(seismic.groups[0].roles).toContain("assessment-intensity")
  })
  it("respects feature units rather than an item claiming population in its title", () => {
    const profile = inspectJsonContent(document([square(100, { density: 190.1, unit: "万元/平方公里" })]))
    expect(recommendExpression(profile, "choropleth")?.unit).toBe("万元/平方公里")
  })
  it("keeps full original area and raw counts when clipping anonymous mixed geometry", () => {
    const raw = document([point([90, 20]), square(100, { 受灾人口: "12850" }), point([100.5, 20.5], { magnitude: 4.2 })])
    const original = structuredClone(raw)
    const clipped = clipWorkflowVector(raw, scope)
    const recommendation = recommendExpression(inspectJsonContent(clipped), "choropleth")!
    expect(recommendation.normalization).toEqual({ kind: "area-density" })
    const prepared = prepareContentDocument(clipped, recommendation, "a".repeat(64), "choropleth")
    const options = { field: recommendation.field, unit: recommendation.unit, normalization: recommendation.normalization, geometryFilter: recommendation.geometry }
    const result = bindExpressionFields(prepared, options)
    expect(result.features).toHaveLength(1)
    expect(result.features[0].properties.受灾人口).toBeCloseTo(12850 / (area(raw.features[1]) / 1e6), 8)
    expect(prepared.features[0].properties.受灾人口).toBe("12850")
    expect(raw).toEqual(original)
    expect(recommendExpression(inspectJsonContent(clipped), "graduated-symbol")?.normalization).toBeUndefined()
  })
  it("retains disconnected parts when clipping a concave statistical region", () => {
    const raw = document([polygon([[[100, 20], [104, 20], [104, 24], [103, 24], [103, 21], [101, 21], [101, 24], [100, 24], [100, 20]]], { 受灾人口: 100 })])
    const clipped = clipWorkflowVector(raw, { west: 100, south: 22, east: 104, north: 24 })
    expect(clipped.features[0].geometry.type).toBe("MultiPolygon")
    expect(booleanValid(clipped.features[0])).toBe(true)
    expect(clipped.metadata.sourceAreaKm2ById["0"]).toBeCloseTo(area(raw.features[0]) / 1e6)
  })
  it("identifies raster meaning from header bands and explicit units, not a blue preview", () => {
    const header = { count: 1, width: 100, height: 100, band_descriptions: [["b1", "people_per_km2"]], bounds: [100, 20, 102, 22] }
    expect(inspectRasterContent(header, { "grid:unit": "人/平方公里" }).raster?.roles).toContain("population")
    expect(inspectRasterContent(header, { title: "GDP" }).raster?.roles).not.toContain("economy")
    expect(inspectRasterContent(header, { "result:type": "deformation_rate", "deformation:unit": "mm/a" }).raster?.roles).toEqual(["rate"])
    const rgb = { ...header, count: 4, band_descriptions: [["b1", ""], ["b2", ""], ["b3", ""], ["b4", ""]], colorinterp: ["red", "green", "blue", "alpha"] }
    expect(inspectRasterContent(rgb, { "grid:unit": "人/平方公里" }).raster?.roles).not.toContain("imagery")
    expect(inspectRasterContent(rgb, { platform: "fy-3h", gsd: 1000 }).raster?.roles).toContain("imagery")
    const spectral = { ...rgb, colorinterp: ["gray", "undefined", "undefined", "undefined"], band_descriptions: [["b1", "CH01 (0.468um)"], ["b2", "CH02 (0.549um)"], ["b3", "CH03 (0.655um)"], ["b4", "CH04 (0.866um)"]] }
    expect(inspectRasterContent(spectral, { platform: "fy-3h", gsd: 1000 }).raster?.reflective).toBe(true)
  })
  it("does not discard actual content due to test/demo names or duplicate source aliases", () => {
    const profile = inspectJsonContent(document([point([100.5, 20.5], { rain_mm: "12.4" })]))
    const item = { type: "Feature", collection: "test", id: "fake-demo", properties: { title: "工作区", updated: "r1" }, assets: {}, bbox: [100, 20, 102, 22] } as any
    const source = { item, asset: { key: "data", kind: "vector" }, profile, fingerprint: "a".repeat(64) } as any
    const requirement = workflowRequirements("point-heat")[0]
    const choices = contentBindings({ sources: [source, { ...source, item: { ...item, id: "normal" } }], problems: [], complete: true }, requirement, "point-heat")
    expect(choices).toHaveLength(1)
    expect(choices[0].recommendation?.field).toBe("rain_mm")
  })
  it("routes declared LST with an actual scalar header without inventing units or relying on a title", () => {
    const header = { count: 1, width: 9, height: 9, band_descriptions: [["b1", ""]], dtype: "float64", colorinterp: ["gray"], bounds: [100, 25, 103, 28] }
    const profile = inspectRasterContent(header, { "spatial:layer_name": "landsat_sr_lst" })
    expect(profile.raster).toMatchObject({ quantity: "temperature", roles: ["lst"], numeric: true })
    expect(profile.metadata.unit).toBeUndefined()
    expect(inspectRasterContent(header, { title: "Landsat LST 地表温度" }).raster?.roles).not.toContain("lst")
    const source = { item: { assets: {}, properties: {} }, asset: { key: "data", kind: "raster" }, profile, fingerprint: "lst" } as any
    const entry = workflowRequirements("raster-ramp").find(entry => entry.adapter === "lst")!
    expect(contentBindings({ sources: [source], problems: [], complete: true }, entry, "raster-ramp")).toHaveLength(1)
  })
  it("keeps verified single-band reflectance and brightness assets available without calling brightness LST", () => {
    const header = { count: 1, width: 100, height: 100, band_descriptions: [["b1", "CH01 (0.468um)"]], bounds: [100, 25, 103, 28] }
    const sensor = { platform: "sensor", gsd: 1000 }
    expect(inspectRasterContent(header, sensor, { unit: "1" }).raster).toMatchObject({ quantity: "reflectance", roles: ["imagery"] })
    const thermal = { ...header, band_descriptions: [["b1", "CH24 (10.734um)"]] }
    expect(inspectRasterContent(thermal, sensor, { unit: "K" }).raster).toMatchObject({ quantity: "brightness", roles: ["imagery"] })
    expect(inspectRasterContent(thermal, sensor, { unit: "radiance" }).raster?.quantity).toBeUndefined()
    expect(inspectRasterContent(thermal, sensor, { unit: "K" }).raster?.roles).not.toContain("lst")
  })
  it("prefers a backend-declared visual RGB verified in its header over scalar bands or an RGB overview", () => {
    const item = { assets: { original: { roles: ["data"] }, colors: { roles: ["visual"] }, overview: { roles: ["overview"] } }, properties: {} }
    const raster = { rgb: true, roles: ["imagery"], count: 3, descriptions: [] }
    const sources = [
      { item, asset: { key: "original", kind: "raster" }, profile: { kind: "raster", groups: [], raster: { ...raster, rgb: false, reflective: true } }, fingerprint: "raw" },
      { item, asset: { key: "overview", kind: "raster" }, profile: { kind: "raster", groups: [], raster }, fingerprint: "preview" },
      { item, asset: { key: "colors", kind: "raster" }, profile: { kind: "raster", groups: [], raster }, fingerprint: "rgb" }
    ] as any
    const entry = workflowRequirements("T30203000").find(entry => entry.adapter === "imagery")!
    expect(contentBindings({ sources, problems: [], complete: true }, entry, "T30203000").map(source => source.asset.key)).toEqual(["colors", "original", "overview"])
  })
  it("requires genuine model and temporal contracts for analytical conclusions", () => {
    const profile = inspectJsonContent(document([square(100, { hazard_index: 0.5, exposure_index: 0.4, vulnerability_index: 0.2 })]))
    expect(recommendExpression(profile, "risk-overlay")).toBeNull()
  })
  it("joins adjacent aliases in one family without drawing duplicate copies", () => {
    const item = { id: "SP-swchina-basegeo-250k", assets: { H48_road_BOUA: {}, I48_road_BOUA: {}, H48_build_BOUA: {}, I48_build_BOUA: {} } } as any
    expect(supplementalSheetKeys(item, "H48_road_BOUA", { west: 102, south: 27, east: 104, north: 33 })).toEqual(["I48_road_BOUA", "H48_road_BOUA"])
  })
})
