import { describe, expect, it } from "vitest"
import { buildColorMapping, classBreaks, defaultRenderStyle, interpolateColor, stylePoints } from "./render-style"

describe("live thematic symbology", () => {
  it("supports equal, quantile and natural breaks without mutating data", () => {
    const values = [100, 101, 1, 2, 3]
    expect(classBreaks(values, "equal", 2)).toEqual([51, 101])
    expect(classBreaks(values, "quantile", 2)).toEqual([3, 101])
    expect(classBreaks(values, "natural", 2)).toEqual([3, 101])
    expect(values).toEqual([100, 101, 1, 2, 3])
    expect(classBreaks([2, 2], "natural", 5)).toEqual([2])
  })
  it("maps endpoints, clamps raster values and leaves NoData transparent", () => {
    const style = { ...defaultRenderStyle(), mode: "raster" as const, min: 0, max: 10, nodata: -9999 }
    const mapping = buildColorMapping([0, 5, 10], style)
    expect(mapping.color(-9999)).toBeNull()
    expect(mapping.color(NaN)).toBeNull()
    expect(mapping.color(-1)).toBe(style.low)
    expect(mapping.color(11)).toBe(style.high)
    expect(mapping.legend).toHaveLength(3)
    expect(() => buildColorMapping([1], { ...style, max: 0 })).toThrow("下限")
  })
  it("does not silently collapse excessive unique categories", () => {
    expect(() => buildColorMapping(Array.from({ length: 25 }, (_, i) => i), { ...defaultRenderStyle(), mode: "unique" })).toThrow("24")
    const mapping = buildColorMapping([1, 2, 1], { ...defaultRenderStyle(), mode: "unique" })
    expect(mapping.legend).toHaveLength(2)
  })
  it("preserves business colors unless a custom style was explicitly selected", () => {
    const points = [{ lon: 100, lat: 30, value: 2, label: "2", band: "热异常", color: "#d73027" }]
    expect(stylePoints(points, defaultRenderStyle())).toBe(points)
    expect(interpolateColor("#000000", "#ffffff", 0.5)).toBe("#808080")
  })
})
