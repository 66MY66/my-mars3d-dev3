import { describe, expect, it } from "vitest"
import type { SelectedDensityCell } from "./grid-density-statistics"
import { buildPopulationLatitudeProfile } from "./population-latitude-profile"

function cell(row: number, column: number, west: number, south: number, value: number): SelectedDensityCell {
  return {
    row,
    column,
    value,
    coverage: 1,
    areaKm2: 0.25,
    total: value * 0.25,
    west,
    east: west + 0.005,
    south,
    north: south + 0.005
  }
}

describe("population latitude profile", () => {
  it("snaps to the nearest raster row and orders cells from west to east", () => {
    const profile = buildPopulationLatitudeProfile([
      cell(10, 2, 101.01, 27.1, 120),
      cell(11, 1, 101.005, 27.095, 80),
      cell(10, 1, 101.005, 27.1, 100)
    ], 27.102)

    expect(profile.latitude).toBe(27.1025)
    expect(profile.points.map((point) => point && point.longitude)).toEqual([101.0075, 101.0125])
    expect(profile.points.map((point) => point && point.density)).toEqual([100, 120])
  })

  it("inserts a line break when selected cells have a longitude gap", () => {
    const profile = buildPopulationLatitudeProfile([
      cell(10, 1, 101.005, 27.1, 100),
      cell(10, 3, 101.015, 27.1, 140)
    ], 27.1025)

    expect(profile.points).toHaveLength(3)
    expect(profile.points[1]).toBeNull()
  })

  it("returns an empty profile when the polygon has no selected population cells", () => {
    expect(buildPopulationLatitudeProfile([], 27)).toEqual({ latitude: null, points: [] })
  })

  it("keeps only profile points whose cell centers are inside the drawn area", () => {
    const profile = buildPopulationLatitudeProfile([
      cell(10, 1, 101.005, 27.1, 100),
      cell(10, 2, 101.01, 27.1, 120)
    ], 27.1025, [[101, 27.09], [101.01, 27.09], [101.01, 27.12], [101, 27.12]])

    expect(profile.points.map((point) => point && point.longitude)).toEqual([101.0075])
  })

  it("clips a profile to the drawn polygon longitude span at the selected latitude", () => {
    const profile = buildPopulationLatitudeProfile([
      cell(10, 1, 100.995, 27.1, 80),
      cell(10, 2, 101.005, 27.1, 100),
      cell(10, 3, 101.015, 27.1, 120),
      cell(10, 4, 101.025, 27.1, 140)
    ], 27.1025, [[101, 27.09], [101.02, 27.09], [101.02, 27.12], [101, 27.12]])

    expect(profile.points.map((point) => point && point.longitude)).toEqual([101.0075, 101.0175])
  })
})
