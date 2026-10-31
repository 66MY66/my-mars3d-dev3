import { describe, expect, it } from "vitest"
import { computeGridDensityStatistics, GRID_DENSITY_SOURCES } from "./grid-density-statistics"

describe("grid density statistics", () => {
  const raster = {
    west: 0,
    north: 1,
    pixelWidth: 1,
    pixelHeight: 1,
    width: 2,
    height: 1,
    values: new Float32Array([100, 200])
  }

  it("includes a boundary cell at exactly 40 percent and excludes one below it", () => {
    const result = computeGridDensityStatistics({
      dataset: "population",
      ring: [[0, 0], [0.4, 0], [0.4, 1], [0, 1]],
      raster
    })
    expect(result.selectedCellCount).toBe(1)
    expect(result.selectedCells[0].column).toBe(0)

    const below = computeGridDensityStatistics({
      dataset: "population",
      ring: [[0, 0], [0.399, 0], [0.399, 1], [0, 1]],
      raster
    })
    expect(below.selectedCellCount).toBe(0)
  })

  it("excludes nodata and converts density to totals using full selected cell area", () => {
    const result = computeGridDensityStatistics({
      dataset: "population",
      ring: [[0, 0], [2, 0], [2, 1], [0, 1]],
      raster: { ...raster, values: new Float32Array([-9999, 200]) }
    })
    expect(result.selectedCellCount).toBe(1)
    expect(result.nodataCellCount).toBe(1)
    expect(result.total).toBeGreaterThan(0)
    expect(result.meanDensity).toBe(200)
  })

  it("uses the published source legend bins", () => {
    const result = computeGridDensityStatistics({
      dataset: "gdp",
      ring: [[0, 0], [2, 0], [2, 1], [0, 1]],
      raster
    })
    expect(result.rows.map((row) => row["区间"])).toEqual(GRID_DENSITY_SOURCES.gdp.bins.map((bin) => bin.label))
    expect(result.rows.reduce((sum, row) => sum + Number(row["格网数"]), 0)).toBe(2)
  })
})

