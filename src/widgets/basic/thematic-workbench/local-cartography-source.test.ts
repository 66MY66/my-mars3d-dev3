import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { emptyDbtDocument, readDbtDocument, inspectDbtDocument } from "./dbt116-standard"
import { referenceGridStyle, referenceGridSummary, validateSourceReferenceGrid, type SourceReferenceGrid } from "./source-reference-grid"
import { sourcePixelWindow, thermalDocument, type LocalSource } from "./local-cartography-source"
import { renderTemplateDocument } from "./template-renderer"
import { readBusinessDocument } from "./business-map-data"
import { businessStandardLayer } from "./business-standard-layer"

const bounds = { west: 100, south: 28, east: 104, north: 31 }
const grid: SourceReferenceGrid = { width: 2, height: 2, bounds, crs: "EPSG:4024", values: [0, 9, null, 1], sourceWindow: [0, 0, 2, 2], unit: "原始值（单位未注明）" }
const catalog: { sources: LocalSource[] } = JSON.parse(readFileSync("public/data/local-cartography/catalog.json", "utf8"))
const thermal = catalog.sources.find(s => s.id === "thermal")!
const frames = JSON.parse(readFileSync("public/data/local-cartography/thermal-frames.json", "utf8")).frames
describe("extracted project cartography sources", () => {
  it("checks every committed data product against the catalogue fingerprint", () => {
    expect(catalog.sources).toHaveLength(5)
    for (const source of catalog.sources) { expect(createHash("sha256").update(readFileSync(`public/${source.url}`)).digest("hex")).toBe(source.sha256) }
    expect(createHash("sha256").update(readFileSync(`public/${thermal.nativeForecastUrl}`)).digest("hex")).toBe(thermal.nativeForecastSha256)
    expect(frames).toHaveLength(150)
  })
  it("retains every independently decoded GRIB message with its real nonrectangular coordinates and unit", () => {
    const forecasts = JSON.parse(readFileSync(`public/${thermal.nativeForecastUrl}`, "utf8")).forecasts
    expect(forecasts).toHaveLength(180)
    expect(forecasts.every((f: any) => f.points.length === 515 && f.gridType === "reduced_gg" && f.unit === "K" && f.radiusMetres === 6367470)).toBe(true)
    expect(forecasts[0].points[0]).toEqual({ lon: 128.7, lat: 34.36938397087891, value: 293.8045654296875 })
    expect(forecasts.some((f: any) => f.date === "2026-07-23")).toBe(true)
  })
  it("uses integer source windows, preserving overlap rather than filling the AOI", () => {
    const crop = sourcePixelWindow(bounds, 400, 300, { west: 99, south: 30, east: 101, north: 32 })
    expect(crop).toEqual({ window: [0, 0, 100, 100], width: 100, height: 100, bounds: { west: 100, south: 30, east: 101, north: 31 } })
    expect(() => sourcePixelWindow(bounds, 400, 300, { west: 130, south: 33, east: 131, north: 34 })).toThrow("没有交集")
    expect(() => sourcePixelWindow(bounds, 4000, 3000, bounds)).toThrow("像元过多")
  })
  it("rejects inverted or nonfinite selections", () => {
    expect(() => sourcePixelWindow(bounds, 400, 300, { ...bounds, east: 99 })).toThrow("范围无效")
    expect(() => sourcePixelWindow(bounds, 400, 300, { ...bounds, north: NaN })).toThrow("范围无效")
  })
  it("keeps unknown-unit raw data separate from people, currency, zeros and missing values", () => {
    validateSourceReferenceGrid(grid)
    expect(referenceGridSummary(grid)).toEqual({ minimum: 0, maximum: 9, mean: 10 / 3, valid: 3, missing: 1 })
    const style = referenceGridStyle(grid)
    expect(style.color(null)).toBe("#d9dee5"); expect(style.color(0)).toBe("#ffffff")
    expect(style.legend.map(entry => entry.label).join(" ")).not.toMatch(/人\/|万元|GDP/)
    expect(referenceGridSummary({ ...grid, values: [null, null, null, null] }).minimum).toBeNull()
  })
  it("does not silently promote original-ellipsoid reference products into operational maps", () => {
    const sourceReference = { catalogId: "pop2020", originalSha256: "a".repeat(64), productSha256: "b".repeat(64), processing: "原椭球反投影", notice: "单位及基准未核验" }
    const document = { ...emptyDbtDocument(), crs: "EPSG:4024", usage: "reference", reference: { title: "人口原值参考", bounds, notice: sourceReference.notice }, layers: [{ id: "source", name: "人口原值", role: "population", crs: "EPSG:4024", authority: "", source: "original", publishedAt: "", security: "", scale: 1000000, sourceReference, sourceGrid: grid, data: { type: "FeatureCollection", features: [] } }] }
    const parsed = readDbtDocument(document)
    expect(inspectDbtDocument(parsed, "T30102000").some(issue => issue.message.includes("独立参考产品"))).toBe(true)
    expect(() => readDbtDocument({ ...document, usage: "operational", reference: undefined })).toThrow("独立参考")
    expect(() => readDbtDocument({ ...document, crs: "EPSG:4490" })).toThrow("坐标不一致")
  })
  it("loads actual temperature report frames with valid UTC and preserves missing source cells", () => {
    const document = thermalDocument(thermal, frames[0], "observedC")
    expect(document.metadata.observedAt).toBe("2026-06-13T01:30:00.000Z")
    expect(readBusinessDocument(document).features).toHaveLength(10)
    const scene = renderTemplateDocument("raster-ramp", document, thermal.bounds, { field: "value" })
    expect(scene.rows).toHaveLength(10)
    expect(scene.features).toHaveLength(16)
    expect(scene.features.filter(f => f.properties.noData)).toHaveLength(6)
    expect(scene.features.filter(f => f.properties.noData).every(f => f.properties.value === null)).toBe(true)
    expect(scene.legend.at(-1)?.label).toContain("缺测")
    expect(() => renderTemplateDocument("raster-ramp", document, bounds)).toThrow("没有匹配数据")
    expect(() => businessStandardLayer({ id: "ref", name: "温度", document }, "population")).toThrow("参考数据")
  })
  it("keeps report forecast-minus-observation direction and never fabricates a Z score", () => {
    const document = thermalDocument(thermal, frames[0], "differenceC")
    expect(document.features[0].properties.value).toBe(-2.549)
    expect(document.features[0].properties).not.toHaveProperty("baseline_sd_k")
    const scene = renderTemplateDocument("raster-ramp", document, thermal.bounds, { field: "value" })
    expect(scene.rows[0].value).toBe(-2.549)
  })
})
