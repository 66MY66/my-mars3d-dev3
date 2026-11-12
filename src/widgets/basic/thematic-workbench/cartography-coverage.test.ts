import { describe, expect, it } from "vitest"
import { coverageGaps, needsCoverageCheck } from "./cartography-coverage"
import type { DbtLayer } from "./dbt116-standard"
describe("actual sheet coverage, not the bounding hull", () => {
  const h = { west: 102, south: 28, east: 108, north: 32 }
  const i = { west: 102, south: 32, east: 108, north: 36 }
  it("joins adjacent available sheets across 32 degrees", () => {
    expect(coverageGaps({ west: 103, south: 31, east: 105, north: 33 }, [h, i])).toEqual([])
  })
  it("identifies the exact unavailable southern area in the user screenshot", () => {
    expect(coverageGaps({ west: 102.198, south: 27.104, east: 104.079, north: 28.506 }, [h])).toEqual([{ west: 102.198, south: 27.104, east: 104.079, north: 28 }])
  })
  it("does not invent coverage in a hole between disconnected source sheets", () => {
    expect(coverageGaps({ west: 0, south: 0, east: 3, north: 1 }, [{ west: 0, south: 0, east: 1, north: 1 }, { west: 2, south: 0, east: 3, north: 1 }])).toEqual([{ west: 1, south: 0, east: 2, north: 1 }])
  })
  it("distinguishes a discrete feature envelope from a continuous coverage contract", () => {
    const base = { role: "boundary", data: { type: "FeatureCollection", features: [], metadata: { sourceCoverages: [h] } } } as unknown as DbtLayer
    expect(needsCoverageCheck(base)).toBe(true)
    for (const role of ["intensity", "fault", "event", "target", "geohazard"]) { expect(needsCoverageCheck({ ...base, role })).toBe(false) }
    expect(needsCoverageCheck({ ...base, data: { type: "FeatureCollection", features: [] } })).toBe(false)
  })
})
