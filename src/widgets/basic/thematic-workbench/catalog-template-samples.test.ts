import { readFileSync } from "node:fs"
import { bbox, booleanPointInPolygon, point } from "@turf/turf"
import { describe, expect, it } from "vitest"
import { fitTemplateSampleToBounds, CATALOG_SAMPLE_BOUNDS } from "./catalog-template-samples"
import { TEMPLATE_CONTRACTS, readTemplateDocument, renderTemplateDocument } from "./template-renderer"
import { classifyTemplatePolygons } from "./template-map"
import { readPolygonDocument } from "./polygon-source"

const selected = { west: 102.951, south: 26.399, east: 108.9355, north: 29.3849 }
const sample = (kind: string) => readTemplateDocument(JSON.parse(readFileSync(`public/data/dbt116-test/templates/${kind}.geojson`, "utf8")))

describe("selection-scoped synthetic template samples", () => {
  it.each(Object.keys(TEMPLATE_CONTRACTS))("places %s in the selection without mutating the original", kind => {
    const original = sample(kind); const before = JSON.stringify(original)
    const fitted = fitTemplateSampleToBounds(original, selected)
    expect(JSON.stringify(original)).toBe(before)
    expect(fitted.metadata.usage).toBe("test")
    expect(fitted.metadata.extentMode).toBe("selection")
    expect(fitted.metadata.bounds).toEqual(selected)
    expect(fitted.metadata.source).toContain("非真实观测")
    const result = renderTemplateDocument(kind, fitted, selected, { field: kind === "unique-value" ? "category" : "value" })
    expect(result.features.length).toBeGreaterThan(0)
    expect(bbox(fitted)[0]).toBeGreaterThanOrEqual(selected.west - 1e-9)
    expect(bbox(fitted)[2]).toBeLessThanOrEqual(selected.east + 1e-9)
  })
  it.each(["unique-value", "choropleth"])("covers the entire selection for %s", kind => {
    const fitted = fitTemplateSampleToBounds(sample(kind), selected)
    expect(bbox(fitted)).toEqual([selected.west, selected.south, selected.east, selected.north])
    for (let x = 0; x <= 10; x++) {
      for (let y = 0; y <= 10; y++) {
        const p = point([selected.west + (selected.east - selected.west) * x / 10, selected.south + (selected.north - selected.south) * y / 10])
        expect(fitted.features.some(f => booleanPointInPolygon(p, f as any)), JSON.stringify({ x, y, coordinate: p.geometry.coordinates })).toBe(true)
      }
    }
    const result = classifyTemplatePolygons(readPolygonDocument(fitted, kind === "unique-value").document, kind === "unique-value" ? "category" : "value", selected, "categorical", "natural", 5, kind === "unique-value")
    expect(result.polygons).toHaveLength(fitted.features.length)
  })
  it("updates the event, context, and analytic geometry together", () => {
    const source = sample("intensity-distribution")
    const result = fitTemplateSampleToBounds(source, selected)
    expect(result.metadata.event.coordinates).not.toEqual(source.metadata.event.coordinates)
    expect(result.metadata.context).not.toEqual(source.metadata.context)
    const event = point(result.metadata.event.coordinates)
    expect(booleanPointInPolygon(event, result.features.at(-1) as any)).toBe(true)
  })
  it("regenerates from the base fixture after reselection", () => {
    const source = sample("unique-value")
    const next = { west: 110, south: 31, east: 113, north: 33 }
    const first = fitTemplateSampleToBounds(source, selected)
    const second = fitTemplateSampleToBounds(source, next)
    expect(bbox(second)).toEqual([110, 31, 113, 33])
    expect(first.metadata.bounds).toEqual(selected)
    expect(source.metadata.bounds).toEqual(CATALOG_SAMPLE_BOUNDS)
  })
  it("rejects operational inputs and invalid bounds", () => {
    const real = sample("unique-value"); real.metadata.usage = "operational"
    expect(() => fitTemplateSampleToBounds(real, selected)).toThrow("业务数据必须保持原坐标")
    for (const invalid of [{ ...selected, west: NaN }, { ...selected, east: selected.west }, { ...selected, north: 95 }]) {
      expect(() => fitTemplateSampleToBounds(sample("unique-value"), invalid)).toThrow("范围无效")
    }
  })
})
