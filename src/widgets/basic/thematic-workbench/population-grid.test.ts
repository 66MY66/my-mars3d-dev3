// @vitest-environment node
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { writeArrayBuffer } from "geotiff"
import { populationColor, populationDensity, populationLegend, populationRowArea, populationSummary, validatePopulationGrid, type PopulationGrid } from "./population-grid"
import { readPopulationGeoTiff } from "./population-geotiff"
import { dbtDrawingBounds, emptyDbtDocument, inspectDbtDocument, readDbtDocument, standardBounds } from "./dbt116-standard"
import { dbtStatistics } from "./dbt-cartography-rules"
import { standardPreviewPath } from "./standard-preview-source"
import { readProjectRaster, rasterSourceColors, sourceRasterLegend } from "./project-raster-source"

function grid(): PopulationGrid {
  return { version: 1, width: 2, height: 2, bounds: { west: 100, east: 100.02, south: 29.98, north: 30 }, crs: "EPSG:4326", metric: "people-per-cell", values: [0, 100, null, 200], sourceFile: "fixture.tif", sourceSha256: "a".repeat(64), sourceWidth: 2, sourceHeight: 2, sourceWindow: [0, 0, 2, 2] }
}
async function tiff(options: Record<string, unknown> = {}) {
  return writeArrayBuffer(new Float32Array([0, 100, -9999, 200]), { width: 2, height: 2, GeographicTypeGeoKey: 4326, GTModelTypeGeoKey: 2, GTRasterTypeGeoKey: 1, ModelPixelScale: [0.01, 0.01, 0], ModelTiepoint: [0, 0, 0, 100, 30, 0], GDAL_NODATA: "-9999", SamplesPerPixel: 1, BitsPerSample: [32], SampleFormat: [3], PhotometricInterpretation: 1, ...options })
}
describe("original numeric population cells", () => {
  it("keeps zero, missing and positive classes separate with one legend", () => {
    expect(populationColor(0)).toBe("#ffffff")
    expect(populationColor(null)).not.toBe(populationColor(0))
    expect(populationColor(20)).not.toBe(populationColor(20.01))
    expect(populationLegend()).toHaveLength(13)
    expect(populationLegend().at(-1)?.label).toContain("NoData")
  })
  it("sums raw counts and excludes missing cells from known area", () => {
    const g = grid(); const summary = populationSummary(g)
    expect(summary.total).toBe(300); expect(summary.valid).toBe(3); expect(summary.missing).toBe(1); expect(summary.zero).toBe(1)
    expect(summary.areaKm2).toBeCloseTo(populationRowArea(g, 0) * 2 + populationRowArea(g, 1))
    expect(populationSummary({ ...g, values: [null, null, null, null] }).total).toBeNull()
  })
  it("does not divide an input density twice", () => {
    const g = { ...grid(), metric: "people-per-km2" as const }
    expect(populationDensity(g, 1)).toBe(100)
    expect(populationSummary(g).total).toBeCloseTo(100 * populationRowArea(g, 0) + 200 * populationRowArea(g, 1))
  })
  it("selects original whole cells by their centers without stretching or splitting counts", () => {
    expect(populationSummary(grid(), { west: 100.01, east: 100.02, north: 30, south: 29.98 }).total).toBe(300)
    expect(populationSummary(grid(), { west: 0, east: 1, north: 1, south: 0 }).total).toBeNull()
  })
  it("rejects malformed windows, negative values and missing units", () => {
    expect(() => validatePopulationGrid({ ...grid(), sourceWindow: [0, 0, 1, 2] })).toThrow("窗口")
    expect(() => validatePopulationGrid({ ...grid(), values: [0, -1, null, 100] })).toThrow("非负")
    expect(() => validatePopulationGrid({ ...grid(), metric: "" as PopulationGrid["metric"] })).toThrow("单位")
  })
  it("decodes actual original GeoTIFF values, georeferencing and NoData", async () => {
    const result = await readPopulationGeoTiff(await tiff(), "fixture.tif", "people-per-cell")
    expect(result.values).toEqual([0, 100, null, 200]); expect(result.bounds).toEqual(grid().bounds)
    expect(result.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
  })
  it("crops an integer source window without changing resolution or values", async () => {
    const result = await readPopulationGeoTiff(await tiff(), "fixture.tif", "people-per-cell", { west: 100.011, east: 100.019, north: 29.999, south: 29.981 })
    expect(result.width).toBe(1); expect(result.sourceWindow).toEqual([1, 0, 2, 2]); expect(result.values).toEqual([100, 200])
  })
  it("rejects unknown or projected CRS instead of relabeling as CGCS2000", async () => {
    await expect(readPopulationGeoTiff(await tiff({ GTModelTypeGeoKey: 1, ProjectedCSTypeGeoKey: 3857 }), "projected.tif", "people-per-cell")).rejects.toThrow("投影")
    await expect(readPopulationGeoTiff(await tiff({ GeographicTypeGeoKey: 32767 }), "unknown.tif", "people-per-cell")).rejects.toThrow("未知")
  })
  it("rejects a non-overlapping selection and undeclared negative cells", async () => {
    await expect(readPopulationGeoTiff(await tiff(), "fixture.tif", "people-per-cell", { west: 0, east: 1, north: 1, south: 0 })).rejects.toThrow("没有")
    await expect(readPopulationGeoTiff(await tiff({ GDAL_NODATA: "-1" }), "fixture.tif", "people-per-cell")).rejects.toThrow("非负")
  })
})
describe("historical references and supplied project rasters", () => {
  it("uses a real native-cell reference, not Gaussian synthetic population", () => {
    const path = `public/${standardPreviewPath("T30102000")}`
    const doc = readDbtDocument(JSON.parse(readFileSync(path, "utf8")))
    expect(doc.usage).toBe("reference"); expect(doc.layers.some(layer => layer.role === "intensity")).toBe(false)
    expect(doc.event.magnitude).toBe(0); expect(standardBounds(doc, "T30102000")).toBeNull()
    expect(dbtDrawingBounds(doc, "T30102000")).not.toBeNull()
    expect(inspectDbtDocument(doc, "T30102000").some(issue => issue.severity === "error")).toBe(true)
    const statistics = dbtStatistics(doc, "T30102000", doc.layers, dbtDrawingBounds(doc, "T30102000")!)
    expect(statistics.find(row => row.label === "有效格网人口")?.value).toBeGreaterThan(0)
    doc.usage = "operational"; expect(() => readDbtDocument(doc)).toThrow("历史参考图")
  })
  it("keeps imported data extent independent from formal assessment extent", () => {
    const doc = emptyDbtDocument(); doc.crs = "EPSG:4326"
    doc.layers = [{ id: "pop", name: "pop", role: "population", crs: "EPSG:4326", source: "", authority: "", publishedAt: "", security: "", scale: 1000000, grid: grid(), data: { type: "FeatureCollection", features: [] } }]
    expect(dbtDrawingBounds(doc, "T30102000")).not.toBeNull(); expect(standardBounds(doc, "T30102000")).toBeNull()
    expect(dbtDrawingBounds(doc, "T30101000")).toBeNull()
    doc.layers[0].crs = "EPSG:4490"; expect(() => readDbtDocument(doc)).toThrow("坐标")
  })
  for (const key of ["pop2020", "gdp2020"]) {
    it(`preserves ${key} actual 1km cells without claiming undocumented units or datum`, () => {
      const source = readProjectRaster(JSON.parse(readFileSync(`public/data/project-raster/${key}.json`, "utf8")))
      expect(source.datumStatus).toBe("unknown"); expect(source.unitStatus).toBe("unconfirmed")
      expect(source.sourceWkt).toContain("Krassowsky"); expect(source.width * source.height).toBe(144320)
      expect(source.resolution).toEqual([1000, 1000]); expect(source.missingCells).toBe(1)
      expect(rasterSourceColors(source)).toHaveLength(source.values.length)
      expect(sourceRasterLegend(source).at(-1)?.label).toBe("NoData")
    })
  }
})
