import { describe, expect, it } from "vitest"
import { processStatisticsPixels } from "./statistics-analysis"

function image(width: number, height: number, valueAt: (x: number, y: number) => number) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = valueAt(x, y)
      pixels[offset + 3] = 255
    }
  }
  return pixels
}

describe("statistics analysis", () => {
  it("aggregates distinct regions and paints only valid pixels", () => {
    const pixels = image(12, 8, (x) => (x < 6 ? 30 : 210))
    pixels[3] = 0
    const result = processStatisticsPixels(pixels, 12, 8, { operation: "area", columns: 2, rows: 2 })
    expect(result.summary.rows).toHaveLength(4)
    expect(result.summary.rows[0].value).toBe(30)
    expect(result.summary.rows[1].value).toBe(210)
    expect(result.pixels[3]).toBe(0)
    expect(result.pixels[(1 * 12 + 1) * 4]).not.toBe(result.pixels[(1 * 12 + 8) * 4])
  })

  it("classifies brightness and preserves the population count", () => {
    const pixels = image(10, 10, (x) => x * 25)
    const result = processStatisticsPixels(pixels, 10, 10, { operation: "category", classCount: 5, classMethod: "quantile" })
    expect(result.summary.rows).toHaveLength(5)
    expect(result.summary.rows.reduce((sum, row) => sum + row.value, 0)).toBe(100)
    expect(result.summary.rows.every((row) => row.value > 0)).toBe(true)
  })

  it("reports positive Moran autocorrelation for adjacent bright and dark blocks", () => {
    const pixels = image(32, 24, (x) => (x < 16 ? 20 : 230))
    const result = processStatisticsPixels(pixels, 32, 24, { operation: "autocorrelation", columns: 4, rows: 3 })
    expect(result.summary.moranI).toBeGreaterThan(0)
    expect(result.summary.highHighCount).toBeGreaterThan(0)
    expect(result.summary.lowLowCount).toBeGreaterThan(0)
    expect(result.summary.rows.reduce((sum, row) => sum + row.value, 0)).toBe(12)
  })

  it("leaves an unvarying field without fabricated autocorrelation clusters", () => {
    const pixels = image(12, 12, () => 100)
    const result = processStatisticsPixels(pixels, 12, 12, { operation: "autocorrelation", columns: 3, rows: 3 })
    expect(result.summary.moranI).toBe(0)
    expect(result.summary.rows.reduce((sum, row) => sum + row.value, 0)).toBe(0)
    expect(result.pixels[3]).toBe(0)
  })

  it("computes local bright-pixel density without leaking outside the image", () => {
    const pixels = image(20, 20, (x, y) => (x >= 5 && x < 15 && y >= 5 && y < 15 ? 240 : 20))
    const result = processStatisticsPixels(pixels, 20, 20, { operation: "density", brightnessThreshold: 150, densityRadius: 2 })
    expect(result.summary.meanDensity).toBeGreaterThan(20)
    expect(result.summary.meanDensity).toBeLessThan(30)
    expect(result.summary.hotspotShare).toBeGreaterThan(0)
    expect(result.pixels[(10 * 20 + 10) * 4 + 3]).toBeGreaterThan(result.pixels[3])
  })
})
