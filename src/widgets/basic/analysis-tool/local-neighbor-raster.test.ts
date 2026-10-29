import { describe, expect, it } from "vitest"
import {
  analyzeLocalRaster,
  computeFocalRaster,
  createLocalRiskRaster,
  describeLocalRasterSource,
  maskRasterToPolygon,
  rasterToRgba,
  resampleRaster,
  summarizeRasterInPolygon,
  type LocalNeighborRaster
} from "./local-neighbor-raster"

function smallRaster(values: number[], nodata = -9999): LocalNeighborRaster {
  return {
    id: "test",
    name: "test",
    width: 3,
    height: 3,
    bounds: [0, 0, 3, 3],
    nodata,
    unit: "index",
    values: new Float32Array(values)
  }
}

describe("local neighborhood raster", () => {
  it("generates one deterministic risk surface with visible high and low areas", () => {
    const first = createLocalRiskRaster()
    const second = createLocalRiskRaster()

    expect(first).toMatchObject({
      id: "local-synthetic-risk",
      name: "本地合成风险指数",
      width: 512,
      height: 512,
      bounds: [97, 21, 109, 35],
      nodata: -9999,
      unit: "index"
    })
    expect(first.values).toEqual(second.values)
    expect(first.values.length).toBe(512 * 512)
    const valid = first.values.filter((value) => value !== first.nodata)
    expect(valid.reduce((maximum, value) => Math.max(maximum, value), -Infinity)).toBeGreaterThan(75)
    expect(valid.reduce((minimum, value) => Math.min(minimum, value), Infinity)).toBeLessThan(5)
    expect(first.values.some((value) => value === first.nodata)).toBe(true)
  })

  it("computes polygon statistics from the actual pixels and handles NoData", () => {
    const raster = smallRaster([1, 2, 3, 4, -9999, 6, 7, 8, 9])
    const wholeRaster = [[0, 0], [3, 0], [3, 3], [0, 3]] as Array<[number, number]>

    expect(summarizeRasterInPolygon(raster, wholeRaster, "ignore")).toEqual({
      count: 8,
      mean: 5,
      maximum: 9,
      minimum: 1,
      stddev: Math.sqrt(7.5),
      unit: "index"
    })
    expect(summarizeRasterInPolygon(raster, wholeRaster, "include")).toMatchObject({
      count: 9,
      mean: 40 / 9,
      maximum: 9,
      minimum: 0
    })
  })

  it("returns an empty summary when the polygon does not intersect the raster", () => {
    const summary = summarizeRasterInPolygon(
      smallRaster([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      [[10, 10], [11, 10], [11, 11], [10, 11]],
      "ignore"
    )
    expect(summary).toEqual({ count: 0, mean: null, maximum: null, minimum: null, stddev: null, unit: "index" })
  })

  it("applies statistic, window size and shape to focal pixels", () => {
    const raster = smallRaster([1, 2, 3, 4, 5, 6, 7, 8, 9])
    const squareMax = computeFocalRaster(raster, { statistic: "maximum", windowSize: 3, windowShape: "square", noDataMode: "ignore" })
    const circleMax = computeFocalRaster(raster, { statistic: "maximum", windowSize: 3, windowShape: "circle", noDataMode: "ignore" })
    const center = 4

    expect(squareMax.values[center]).toBe(9)
    expect(circleMax.values[center]).toBe(8)
    expect(computeFocalRaster(raster, { statistic: "mean", windowSize: 3, windowShape: "square", noDataMode: "ignore" }).values[center]).toBe(5)
    expect(computeFocalRaster(raster, { statistic: "minimum", windowSize: 3, windowShape: "square", noDataMode: "ignore" }).values[center]).toBe(1)
    expect(computeFocalRaster(raster, { statistic: "stddev", windowSize: 3, windowShape: "square", noDataMode: "ignore" }).values[center]).toBeCloseTo(Math.sqrt(60 / 9), 5)
  })

  it("derives a smaller preview from the source array and masks pixels outside the drawn polygon", () => {
    const source: LocalNeighborRaster = {
      ...smallRaster([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      width: 3,
      height: 3
    }
    const preview = resampleRaster(source, 2)
    expect(preview).toMatchObject({ width: 2, height: 2, bounds: [0, 0, 3, 3] })
    expect(Array.from(preview.values)).toEqual([1, 3, 7, 9])

    const masked = maskRasterToPolygon(source, [[0, 0], [1.5, 0], [1.5, 3], [0, 3]])
    expect(Array.from(masked.values)).toEqual([1, -9999, -9999, 4, -9999, -9999, 7, -9999, -9999])
  })

  it("renders valid values through the risk palette and NoData as transparent", () => {
    const raster: LocalNeighborRaster = {
      id: "colors",
      name: "colors",
      width: 3,
      height: 1,
      bounds: [0, 0, 3, 1],
      nodata: -9999,
      unit: "index",
      values: new Float32Array([0, 100, -9999])
    }
    expect(Array.from(rasterToRgba(raster))).toEqual([
      24, 78, 159, 220,
      213, 0, 0, 220,
      0, 0, 0, 0
    ])
  })

  it("uses the same source values for area summaries and focal previews", () => {
    const raster = smallRaster([1, 2, 3, 4, 5, 6, 7, 8, 9])
    const ring = [[0, 0], [3, 0], [3, 3], [0, 3]] as Array<[number, number]>
    const area = analyzeLocalRaster(raster, { mode: "area", ring, noDataMode: "ignore" })
    const focal = analyzeLocalRaster(raster, {
      mode: "focal",
      ring,
      noDataMode: "ignore",
      statistic: "maximum",
      windowShape: "square",
      windowSize: 3,
      previewResolution: "low"
    })

    expect(area.summary).toMatchObject({ count: 9, mean: 5, maximum: 9, minimum: 1 })
    expect(area.previewRaster).toBeNull()
    expect(focal.previewRaster?.values[4]).toBe(9)
    expect(focal.summary).toMatchObject({ analysisMode: "focal", statistic: "maximum", windowSize: 3 })
  })

  it("describes the in-memory grid as one selectable raster source", () => {
    expect(describeLocalRasterSource(createLocalRiskRaster())).toEqual({
      id: "local-synthetic-risk",
      label: "本地合成风险指数",
      sourceType: "raster",
      sourceRef: "memory://local-synthetic-risk",
      bands: [{ value: "1", label: "风险指数（index）" }]
    })
  })

  it("normalizes an even focal size to the odd window that is actually calculated", () => {
    const raster = smallRaster([1, 2, 3, 4, 5, 6, 7, 8, 9])
    const result = analyzeLocalRaster(raster, {
      mode: "focal",
      ring: [[0, 0], [3, 0], [3, 3], [0, 3]],
      noDataMode: "ignore",
      statistic: "mean",
      windowShape: "square",
      windowSize: 4,
      previewResolution: "low"
    })
    expect(result.summary.windowSize).toBe(5)
  })
})
