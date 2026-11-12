import { describe, expect, it } from "vitest"
import { imageryPairs, comparisonBounds } from "./imagery-comparison"
import { inspectRasterContent } from "./content-routing"
import type { InspectedSource } from "./backend-content-routing"

function source(id: string, datetime: string): InspectedSource {
  const properties = { title: "test", datetime, "earthquake:time": "2026-09-20T00:00:00Z", "processing:registration_id": "fixture-registration-v1", "processing:level": "surface-reflectance-rgb-v1", gsd: 10, platform: "fixture-sensor" }
  const profile = inspectRasterContent({ count: 3, width: 10, height: 10, crs: "EPSG:4326", colorinterp: ["red", "green", "blue"], band_descriptions: [["b1", "red"], ["b2", "green"], ["b3", "blue"]], bounds: [103, 25, 105, 27] }, properties)
  return { item: { id, type: "Feature", collection: "fixture", assets: { data: { href: `http://fixture.invalid/${id}.tif`, type: "image/tiff" } }, properties, bbox: [103, 25, 105, 27], geometry: null }, asset: { key: "data", kind: "raster", title: "RGB", numeric: false, bands: ["red", "green", "blue"], range: [0, 255] }, profile, fingerprint: id }
}
const before = () => source("before", "2026-09-19T00:00:00Z")
const after = () => source("after", "2026-09-21T00:00:00Z")
describe("source-evidenced imagery comparisons", () => {
  it("pairs comparable acquisitions across the same event without inspecting names", () => {
    const a = before(); const b = after(); a.item.properties.title = "fake_damage"; b.item.properties.title = "arbitrary"
    const pair = imageryPairs([b, a])[0]
    expect(pair.before.item.id).toBe("before"); expect(pair.after.item.id).toBe("after")
    expect(imageryPairs([a])).toEqual([])
  })
  it.each(["processing:registration_id", "processing:level", "gsd", "platform", "earthquake:time"])("does not pair incompatible %s", key => {
    const a = before(); const b = after(); b.item.properties[key] = key === "gsd" ? 20 : "different"
    expect(imageryPairs([a, b])).toEqual([])
  })
  it("requires real RGB structure, CRS and registration evidence", () => {
    const a = before(); const b = after(); delete b.item.properties["processing:registration_id"]
    expect(imageryPairs([a, b])).toEqual([])
    const c = after(); c.profile.raster!.rgb = false
    expect(imageryPairs([a, c])).toEqual([])
    const d = after(); d.profile.raster!.crs = undefined
    expect(imageryPairs([a, d])).toEqual([])
  })
  it("clips geographic extent without stretching either image into the other half", () => {
    const bounds = { west: 103, east: 105, south: 25, north: 27 }; const pair = imageryPairs([before(), after()])[0].comparison
    expect(comparisonBounds(bounds, { ...pair, side: "before" })).toEqual({ ...bounds, east: 104 })
    expect(comparisonBounds(bounds, { ...pair, side: "after" })).toEqual({ ...bounds, west: 104 })
    expect(comparisonBounds(bounds)).toEqual(bounds)
    expect(() => comparisonBounds(bounds, { ...pair, side: "left" })).toThrow("配对记录无效")
    expect(() => comparisonBounds(bounds, { ...pair, side: "after", afterTime: pair.beforeTime })).toThrow("配对记录无效")
  })
})
