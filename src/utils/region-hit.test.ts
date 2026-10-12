import { describe, expect, it } from "vitest"
import { buildRegionIndex, hitTestRegions, pointInRing } from "@/utils/region-hit"

describe("region-hit", () => {
  it("pointInRing basic square", () => {
    const ring: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ]
    expect(pointInRing({ lng: 5, lat: 5 }, ring)).toBe(true)
    expect(pointInRing({ lng: -1, lat: 5 }, ring)).toBe(false)
    expect(pointInRing({ lng: 5, lat: 11 }, ring)).toBe(false)
  })

  it("hitTestRegions supports no regions / single / multi", () => {
    const empty = buildRegionIndex([])
    expect(hitTestRegions(empty, { lng: 1, lat: 1 })).toBeNull()

    const idx1 = buildRegionIndex([
      { id: "r1", type: "disaster", ring: [[0, 0], [10, 0], [10, 10], [0, 10]], updatedAt: 1 }
    ])
    expect(hitTestRegions(idx1, { lng: 5, lat: 5 })?.id).toBe("r1")
    expect(hitTestRegions(idx1, { lng: 50, lat: 50 })).toBeNull()

    const idx2 = buildRegionIndex([
      { id: "r1", type: "disaster", ring: [[0, 0], [10, 0], [10, 10], [0, 10]], updatedAt: 1 },
      { id: "r2", type: "generic", ring: [[20, 20], [25, 20], [25, 25], [20, 25]], updatedAt: 2 }
    ])
    expect(hitTestRegions(idx2, { lng: 22, lat: 22 })?.id).toBe("r2")
    expect(hitTestRegions(idx2, { lng: 6, lat: 6 })?.id).toBe("r1")
  })

  it("performance: 1000 regions hit test under 100ms", () => {
    const regions = Array.from({ length: 1000 }, (_, i) => {
      const x = (i % 50) * 2
      const y = Math.floor(i / 50) * 2
      return {
        id: `r${i}`,
        type: "disaster" as const,
        ring: [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1]
        ] as Array<[number, number]>,
        updatedAt: i
      }
    })
    const idx = buildRegionIndex(regions)
    const t0 = performance.now()
    const hit = hitTestRegions(idx, { lng: 10.2, lat: 10.2 })
    const t1 = performance.now()
    expect(hit).not.toBeNull()
    expect(t1 - t0).toBeLessThan(100)
  })
})

