import { describe, expect, it } from "vitest"
import { selectionBoundary } from "./selection-geometry"

describe("geographic selection outline", () => {
  it("follows constant-latitude/longitude edges, not a screen bounding rectangle", () => {
    const bounds = { west: 103, east: 106, south: 26, north: 28 }
    const points = selectionBoundary(bounds)
    expect(points).toHaveLength(128)
    expect(points[0]).toEqual([103, 28]); expect(points[32]).toEqual([106, 28])
    expect(points[64]).toEqual([106, 26]); expect(points[96]).toEqual([103, 26])
    expect(points.slice(0, 32).every(point => point[1] === 28)).toBe(true)
    expect(points.slice(32, 64).every(point => point[0] === 106)).toBe(true)
  })
})
