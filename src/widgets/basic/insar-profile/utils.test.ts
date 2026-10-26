import { describe, expect, it } from "vitest"
import {
  buildProfileSummary,
  applyTerrainHeights,
  computeLineLengthMeters,
  interpolateProfilePoints,
  profileSamplesToCsv,
  smoothElevations,
  type ProfilePoint
} from "./utils"

describe("insar-profile utils", () => {
  it("computes line length for a simple segment", () => {
    const points: ProfilePoint[] = [
      { lng: 116.39, lat: 39.9 },
      { lng: 116.4, lat: 39.9 }
    ]
    const length = computeLineLengthMeters(points)
    expect(length).toBeGreaterThan(800)
    expect(length).toBeLessThan(1000)
  })

  it("interpolates evenly across multiple points", () => {
    const points: ProfilePoint[] = [
      { lng: 0, lat: 0, height: 10 },
      { lng: 1, lat: 0, height: 30 },
      { lng: 2, lat: 0, height: 50 }
    ]
    const samples = interpolateProfilePoints(points, 5)
    expect(samples).toHaveLength(5)
    expect(samples[0].elevationM).toBe(10)
    expect(samples[4].elevationM).toBe(50)
    expect(samples[2].lng).toBeCloseTo(1, 6)
  })

  it("smooths elevation values with moving average", () => {
    const samples = [
      { index: 1, ratio: 0, distanceM: 0, lng: 0, lat: 0, elevationM: 10 },
      { index: 2, ratio: 0.5, distanceM: 50, lng: 0.5, lat: 0, elevationM: 40 },
      { index: 3, ratio: 1, distanceM: 100, lng: 1, lat: 0, elevationM: 20 }
    ]
    const out = smoothElevations(samples, 3)
    expect(out[1].elevationM).toBeCloseTo((10 + 40 + 20) / 3, 6)
  })

  it("builds summary and csv output", () => {
    const samples = [
      { index: 1, ratio: 0, distanceM: 0, lng: 100, lat: 30, elevationM: 5 },
      { index: 2, ratio: 1, distanceM: 100, lng: 101, lat: 30, elevationM: 15 }
    ]
    const summary = buildProfileSummary(samples)
    expect(summary?.sampleCount).toBe(2)
    expect(summary?.reliefM).toBe(10)

    const csv = profileSamplesToCsv(samples)
    expect(csv).toContain("index,distanceM,lng,lat,elevationM")
    expect(csv).toContain("2,100.00,101.000000,30.000000,15.00")
  })

  it("applies every sampled terrain height without changing profile coordinates", () => {
    const samples = interpolateProfilePoints([
      { lng: 100, lat: 30 },
      { lng: 101, lat: 30 }
    ], 4)

    const result = applyTerrainHeights(samples, [120, 185, 142, 210])

    expect(result.map((item) => item.elevationM)).toEqual([120, 185, 142, 210])
    expect(result.map((item) => item.distanceM)).toEqual(samples.map((item) => item.distanceM))
    expect(result.map((item) => [item.lng, item.lat])).toEqual(samples.map((item) => [item.lng, item.lat]))
  })

  it("keeps the original elevation when a terrain response is invalid", () => {
    const samples = interpolateProfilePoints([
      { lng: 100, lat: 30, height: 12 },
      { lng: 101, lat: 30, height: 24 }
    ], 2)

    expect(applyTerrainHeights(samples, [88, Number.NaN]).map((item) => item.elevationM)).toEqual([88, 24])
  })
})
