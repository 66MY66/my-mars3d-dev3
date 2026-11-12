import { describe, expect, it } from "vitest"
import { renderTemplateDocument, type TemplateDocument } from "./template-renderer"
import { buildColorMapping, defaultRenderStyle } from "./render-style"

const bounds = { west: 100, east: 104, south: 28, north: 32 }
const document = (values: number[]): TemplateDocument => ({ type: "FeatureCollection", metadata: { source: "backend", unit: "人" }, features: values.map((value, i) => ({ type: "Feature", geometry: { type: "Point", coordinates: [101 + i / 100, 30] }, properties: { value } })) })
describe("professional layer symbology", () => {
  it("uses a fixed symbol size for each class, with matching size legends", () => {
    const scene = renderTemplateDocument("graduated-symbol", document([1, 2, 3, 4, 20, 21]), bounds, { field: "value", count: 2 })
    expect(new Set(scene.features.map(f => f.properties.pixelSize)).size).toBe(2)
    expect(scene.legend).toHaveLength(2)
    expect(scene.legend.every(row => row.shape === "point" && row.radius)).toBe(true)
    expect(new Set(scene.features.map(f => f.properties.color)).size).toBe(1)
  })
  it("scales proportional symbol area, not radius, and retains zero as zero", () => {
    const scene = renderTemplateDocument("proportional-symbol", document([0, 1, 4]), bounds, { field: "value" })
    const sizes = scene.features.map(f => f.properties.pixelSize)
    expect(sizes[0]).toBe(0)
    expect(sizes[2] / sizes[1]).toBe(2)
    expect(() => renderTemplateDocument("proportional-symbol", document([-1, 4]), bounds, { field: "value" })).toThrow("负数")
  })
  it("keeps exact class labels for small differences", () => {
    const result = buildColorMapping([0.039, 0.094, 0.475], { ...defaultRenderStyle(), count: 3, method: "natural" })
    expect(result.legend[0].label).toContain("0.039")
    expect(result.legend.at(-1)!.label).toContain("0.475")
    expect(result.legend.some(row => row.label.includes("0.04"))).toBe(false)
  })
  it("keeps category colors stable when feature order or scope changes", () => {
    const data = document([1, 2, 3]); data.features.forEach((f, i) => { f.properties.category = ["学校", "医院", "桥梁"][i] })
    const render = (d: TemplateDocument) => renderTemplateDocument("unique-value", d, bounds, { field: "category" }).legend
    expect(render({ ...data, features: [...data.features].reverse() })).toEqual(render(data))
    const subset = render({ ...data, features: data.features.slice(1) })
    expect(subset).toEqual(render(data).filter(row => row.label !== "学校"))
  })
})
