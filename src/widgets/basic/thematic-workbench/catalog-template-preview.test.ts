import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { area, bbox, intersect, featureCollection } from "@turf/turf"
import { CATALOG_SAMPLE_BOUNDS } from "./catalog-template-samples"
import { TEMPLATE_CONTRACTS, readTemplateDocument, renderTemplateDocument } from "./template-renderer"
import { standardScale, STANDARD_SHEET } from "./cartography-standard-layout"

const sample = (kind: string) => readTemplateDocument(JSON.parse(readFileSync(`public/data/dbt116-test/templates/${kind}.geojson`, "utf8")))
describe("original catalog standard previews", () => {
  it.each(Object.keys(TEMPLATE_CONTRACTS))("renders %s from test geometry, not an illustration", kind => {
    const document = sample(kind)
    expect(document.metadata.usage).toBe("test")
    expect(document.metadata.templateKind).toBe(kind)
    expect(document.metadata.previewDescription.length).toBeGreaterThan(10)
    for (const feature of document.features) {
      expect(TEMPLATE_CONTRACTS[kind].fields.every(key => Object.hasOwn(feature.properties, key))).toBe(true)
    }
    const scene = renderTemplateDocument(kind, document, CATALOG_SAMPLE_BOUNDS, { field: kind === "unique-value" ? "category" : "value" })
    expect(scene.features.length).toBeGreaterThan(0)
    expect(scene.legend.length).toBeGreaterThan(0)
    expect(scene.source).toContain("合成")
  })
  it("uses separate datasets with only relevant business fields", () => {
    const fingerprints = Object.keys(TEMPLATE_CONTRACTS).map(kind => JSON.stringify(sample(kind).features))
    // Ramp, threshold and contour intentionally share the same scalar field.
    expect(new Set(fingerprints).size).toBe(20)
    expect(sample("secondary-hazard").features[0].properties).not.toHaveProperty("intensity")
  })
  it("does not treat arbitrary imported styling properties as renderer instructions", () => {
    const data = sample("graduated-symbol")
    data.features[0].properties.symbolKind = "not-a-symbol"
    data.features[0].properties.opacity = -1
    data.features[0].properties.rasterCell = true
    const feature = renderTemplateDocument("graduated-symbol", data, CATALOG_SAMPLE_BOUNDS).features[0]
    expect(feature.properties.symbolKind).toBeUndefined()
    expect(feature.properties.opacity).toBeUndefined()
    expect(feature.properties.rasterCell).toBe(false)
  })
  it("has nested non-overlapping intensity bands, not a checkerboard", () => {
    const doc = sample("intensity-distribution")
    expect(doc.features.map(f => f.properties.intensity)).toEqual([6, 7, 8, 9])
    expect(renderTemplateDocument("intensity-distribution", doc, CATALOG_SAMPLE_BOUNDS).legend.map(e => e.label)).toEqual(["IX度（9度）", "VIII度（8度）", "VII度（7度）", "VI度（6度）"])
    const annotations = renderTemplateDocument("intensity-distribution", doc, CATALOG_SAMPLE_BOUNDS).annotations!
    expect(annotations).toHaveLength(5)
    expect(annotations[0].symbolKind).toBe("dbt-current-epicenter")
    doc.features.forEach((f, i) => {
      expect(f.geometry.type).toBe("Polygon")
      if (i) { expect(bbox(f)[0]).toBeGreaterThan(bbox(doc.features[i - 1])[0]) }
      doc.features.slice(i + 1).forEach(other => {
        const overlap = intersect(featureCollection([f, other]) as any)
        expect(overlap ? area(overlap) : 0).toBeLessThan(1)
      })
    })
  })
  it("shows all five hazards as localized points and footprints", () => {
    const doc = sample("secondary-hazard")
    expect(new Set(doc.features.map(f => f.properties.hazard_type)).size).toBe(5)
    expect(new Set(doc.features.map(f => f.geometry.type))).toEqual(new Set(["Point", "Polygon"]))
    expect(doc.features.filter(f => f.geometry.type === "Polygon").every(f => area(f) < 3e8)).toBe(true)
  })
  it("uses building footprints and population units instead of invented risk rasters", () => {
    expect(sample("building-resilience").features.length).toBe(88)
    expect(Math.max(...sample("building-resilience").features.map(f => area(f)))).toBeLessThan(Math.min(...sample("choropleth").features.map(f => area(f))))
    expect(sample("population-exposure").metadata.populationUnit).toBe("人")
  })
  it("renders continuous raster colors separately from discrete thresholds", () => {
    const ramp = renderTemplateDocument("raster-ramp", sample("raster-ramp"), CATALOG_SAMPLE_BOUNDS)
    const threshold = renderTemplateDocument("raster-threshold", sample("raster-threshold"), CATALOG_SAMPLE_BOUNDS)
    expect(new Set(ramp.features.map(f => f.properties.color)).size).toBeGreaterThan(100)
    expect(new Set(threshold.features.map(f => f.properties.color)).size).toBeLessThanOrEqual(5)
    expect(ramp.features.every(f => f.geometry.type === "Polygon")).toBe(true)
  })
  it("uses standard resource symbols for supported emergency facility types", () => {
    const scene = renderTemplateDocument("emergency-command", sample("emergency-command"), CATALOG_SAMPLE_BOUNDS)
    expect(scene.features.filter(f => f.geometry.type === "Point").every(f => f.properties.symbolKind?.startsWith("dbt-"))).toBe(true)
    expect(scene.features.filter(f => f.geometry.type === "LineString")).toHaveLength(3)
  })
  it("uses A3 proportions and 5-km multiples with a real geographic scale", () => {
    expect(STANDARD_SHEET.width / STANDARD_SHEET.height).toBeCloseTo(420 / 297)
    for (const mpp of [40, 200, 1050]) {
      const scale = standardScale(mpp, 300)!
      expect(scale.stepKm % 5).toBe(0)
      expect(scale.pixels).toBeLessThanOrEqual(300)
      expect(scale.pixels * mpp).toBe(scale.stepKm * 2000)
    }
    expect(standardScale(1, 300)).toBeNull()
  })
})
