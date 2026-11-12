import { describe, expect, it } from "vitest"
import { acceptPulledPoint, baselineParameter, createShapeBaseline, pointOnBaseline, shapeVertices, signedOffsetMeters } from "./draw-shape"

const a = { lng: 104, lat: 30 }
const b = { lng: 104.01, lat: 30 }

describe("irregular shape pulled from a baseline", () => {
  it("places a dragged point on the baseline before it leaves the line", () => {
    const baseline = createShapeBaseline(a, b)!
    expect(pointOnBaseline(baseline, 0)).toEqual(a)
    expect(pointOnBaseline(baseline, 1).lng).toBeCloseTo(b.lng, 6)
    expect(pointOnBaseline(baseline, 1).lat).toBeCloseTo(b.lat, 6)
    expect(baselineParameter(baseline, pointOnBaseline(baseline, 0.5))).toBeCloseTo(0.5, 4)
    expect(Math.abs(signedOffsetMeters(baseline, pointOnBaseline(baseline, 0.4)))).toBeLessThan(0.01)
  })

  it("builds a triangle from one side point and a quad from opposite sides", () => {
    const baseline = createShapeBaseline(a, b)!
    const north = { lng: 104.004, lat: 30.004 }
    const south = { lng: 104.006, lat: 29.996 }
    expect(signedOffsetMeters(baseline, north)).toBeGreaterThan(5)
    expect(signedOffsetMeters(baseline, south)).toBeLessThan(-5)
    expect(shapeVertices(baseline, [north])).toEqual([a, north, b])
    expect(shapeVertices(baseline, [north, south])).toEqual([a, north, b, south])
    expect(acceptPulledPoint(baseline, [], north)).toEqual({ ok: true, point: north })
    expect(acceptPulledPoint(baseline, [north], north).ok).toBe(false)
    expect(acceptPulledPoint(baseline, [north], south)).toEqual({ ok: true, point: south })
    expect(acceptPulledPoint(baseline, [], pointOnBaseline(baseline, 0.5)).ok).toBe(false)
  })

  it("rejects a baseline that is too short", () => {
    expect(createShapeBaseline(a, a)).toBeNull()
  })
})
