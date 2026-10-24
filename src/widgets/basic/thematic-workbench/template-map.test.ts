import { describe, expect, it } from "vitest"
import { readPolygonDocument } from "./polygon-source"
import { classifyTemplatePolygons, recolorTemplatePolygons, colorTemplatePixels } from "./template-map"
import { mapTemplatePalettes } from "./template-palettes"

const document = readPolygonDocument({ type: "FeatureCollection", features: [1, 5, 12].map((value, i) => ({ type: "Feature", properties: { value }, geometry: { type: "Polygon", coordinates: [[[i, 0], [i + 1, 0], [i + 1, 1], [i, 1], [i, 0]]] } })) }).document
const bounds = { west: 0.5, south: 0, east: 2.5, north: 1 }
describe("template map rendering", () => {
  it("classifies real fields and clips the original polygons", () => {
    const result = classifyTemplatePolygons(document, "value", bounds, "sequential-blue", "natural", 3)
    expect(result.polygons.map(item => item.value)).toEqual([1, 5, 12])
    expect(result.legend).toHaveLength(3)
    expect(result.polygons[0].color).toBe("#d8f3ff")
    expect(result.polygons[2].color).toBe("#0b3f6b")
    expect(result.polygons.every(item => item.rings.flat().every(([x]) => x >= 0.5 && x <= 2.5))).toBe(true)
    expect(document.features[0].geometry.coordinates[0][0]).toEqual([0, 0])
  })
  it("keeps numeric unique values separate", () => {
    const result = classifyTemplatePolygons(document, "value", bounds, "categorical", "equal", 5, true)
    expect(result.legend.map(item => item.label)).toEqual(["1", "5", "12"])
  })
  it("supports textual categories and retains their labels when recoloring", () => {
    const input = { ...document, features: document.features.map((feature, index) => ({ ...feature, properties: { category: ["住宅", "学校", "医院"][index] } })) }
    const parsed = readPolygonDocument(input, true)
    expect(parsed.fields).toEqual(["category"])
    const result = classifyTemplatePolygons(parsed.document, "category", bounds, "categorical", "equal", 5, true)
    expect(result.legend.map(row => row.label)).toEqual(["住宅", "学校", "医院"])
    expect(recolorTemplatePolygons(result.polygons, "terrain", "equal", 5, true).legend.map(row => row.label)).toEqual(["住宅", "学校", "医院"])
  })
  it("rejects missing fields and areas with no valid data", () => {
    expect(() => classifyTemplatePolygons(document, "missing", bounds, "risk", "natural", 5)).toThrow()
    expect(() => classifyTemplatePolygons(document, "value", { west: 90, east: 95, south: 20, north: 25 }, "risk", "equal", 5)).toThrow()
  })
  it("reuses real polygons without changing their values or geometry", () => {
    const first = classifyTemplatePolygons(document, "value", bounds, "sequential-blue", "equal", 3)
    const next = recolorTemplatePolygons(first.polygons, "categorical", "equal", 3, true)
    expect(next.polygons.map(item => item.color)).toEqual(mapTemplatePalettes.categorical.slice(0, 3))
    expect(next.polygons.map(item => item.value)).toEqual(first.polygons.map(item => item.value))
    expect(next.polygons.map(item => item.rings)).toEqual(first.polygons.map(item => item.rings))
    expect(first.polygons[0].color).toBe("#d8f3ff")
  })
  it("uses intermediate template stops for five classes", () => {
    const base = classifyTemplatePolygons(document, "value", bounds, "sequential-blue", "equal", 3).polygons[0]
    const result = recolorTemplatePolygons([0, 1, 2, 3, 4].map(value => ({ ...base, value })), "terrain", "equal", 5)
    expect(result.legend.map(item => item.color)).toEqual(mapTemplatePalettes.terrain)
  })
  it("recolors RGB brightness, preserves alpha and leaves the input untouched", () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 100, 255, 255, 255, 255, 1, 2, 3, 0])
    const before = pixels.slice()
    const result = colorTemplatePixels(pixels, "terrain", false)
    expect(Array.from(result.data.slice(0, 4))).toEqual([23, 63, 95, 255])
    expect(Array.from(result.data.slice(8, 12))).toEqual([249, 132, 74, 255])
    expect(result.data[7]).toBe(100)
    expect(Array.from(result.data.slice(12))).toEqual([1, 2, 3, 0])
    expect(result.legend.every(entry => entry.label.startsWith("RGB 亮度"))).toBe(true)
    expect(pixels).toEqual(before)
    expect(colorTemplatePixels(pixels, "sequential-blue", false).data).not.toEqual(result.data)
  })
  it("builds threshold classes from actual pixel brightness", () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255])
    const result = colorTemplatePixels(pixels, "threshold", true, 3)
    expect(result.legend).toHaveLength(3)
    expect(result.legend.map(entry => entry.color)).toEqual(["#2f80ed", "#f4d35e", "#d1495b"])
    expect(recolorTemplatePolygons.bind(null, [], "terrain", "equal", 5)).toThrow()
  })
})
