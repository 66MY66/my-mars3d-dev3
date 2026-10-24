import { describe, expect, it } from "vitest"
import { clipPolygons, readPolygonDocument } from "./polygon-source"

const document = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "A", intensity: 7 },
      geometry: {
        type: "Polygon",
        coordinates: [
          [[99, 29], [103, 29], [103, 33], [99, 33], [99, 29]],
          [[100.2, 30.2], [100.8, 30.2], [100.8, 30.8], [100.2, 30.8], [100.2, 30.2]]
        ]
      }
    },
    {
      type: "Feature",
      properties: { name: "B", intensity: 9 },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [[[101, 31], [101.3, 31], [101.3, 31.3], [101, 31.3], [101, 31]]],
          [[[105, 35], [106, 35], [106, 36], [105, 36], [105, 35]]]
        ]
      }
    }
  ]
}
const bounds = { west: 100, south: 30, east: 102, north: 32 }

describe("GeoJSON polygon 3D source", () => {
  it("validates numeric fields and preserves clipped holes and MultiPolygon parts", () => {
    const parsed = readPolygonDocument(document)
    expect(parsed.fields).toEqual(["intensity"])
    const clipped = clipPolygons(parsed.document, "intensity", bounds)
    expect(clipped).toHaveLength(2)
    expect(clipped[0].rings).toHaveLength(2)
    expect(clipped.map((item) => item.value)).toEqual([7, 9])
    expect(clipped.every((item) => item.rings.every((ring) => ring.every(([x, y]) => x >= 100 && x <= 102 && y >= 30 && y <= 32)))).toBe(true)
    expect(clipped[0].color).not.toBe(clipped[1].color)
  })
  it("rejects projected coordinates, malformed rings and non-numeric input", () => {
    expect(() => readPolygonDocument({ ...document, features: [{ ...document.features[0], geometry: { type: "Polygon", coordinates: [[[500000, 29], [103, 29], [103, 33], [500000, 29]]] } }] })).toThrow(/WGS84/)
    expect(() => readPolygonDocument({ type: "FeatureCollection", features: [{ ...document.features[0], properties: { value: "7" } }] })).toThrow(/数值属性/)
  })
  it("does not render features outside selection or without selected numeric field", () => {
    const parsed = readPolygonDocument(document)
    expect(() => clipPolygons(parsed.document, "missing", bounds)).toThrow(/范围内/)
    expect(() => clipPolygons(parsed.document, "intensity", { west: 0, south: 0, east: 1, north: 1 })).toThrow(/范围内/)
  })
})
