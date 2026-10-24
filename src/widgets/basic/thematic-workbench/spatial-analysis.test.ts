import { describe, expect, it } from "vitest"
import { processSpatialPixels } from "./spatial-analysis"

function image(width: number, height: number, colorAt: (x: number, y: number) => [number, number, number]) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      const [red, green, blue] = colorAt(x, y)
      pixels.set([red, green, blue, 255], offset)
    }
  }
  return pixels
}

describe("spatial image analysis", () => {
  it("extracts a contour around a bright area without coloring its interior", () => {
    const pixels = image(20, 20, (x, y) => (x >= 5 && x < 15 && y >= 5 && y < 15 ? [220, 220, 220] : [20, 20, 20]))
    const result = processSpatialPixels(pixels, 20, 20, { operation: "contour", threshold: 120 })
    expect(result.summary.contourSegments).toBeGreaterThan(30)
    expect(result.summary.contourLength).toBeGreaterThan(30)
    expect(result.pixels[(10 * 20 + 10) * 4 + 3]).toBe(0)
    expect(result.pixels[(5 * 20 + 10) * 4 + 3]).toBe(255)
  })

  it("expands a bright source by a bounded raster buffer", () => {
    const pixels = image(21, 21, (x, y) => (x === 10 && y === 10 ? [255, 255, 255] : [0, 0, 0]))
    const result = processSpatialPixels(pixels, 21, 21, { operation: "buffer", threshold: 150, radius: 3 })
    expect(result.summary.rows[0].value).toBe(1)
    expect(result.summary.rows[1].value).toBeGreaterThan(20)
    expect(result.pixels[(10 * 21 + 13) * 4 + 3]).toBeGreaterThan(0)
    expect(result.pixels[(10 * 21 + 15) * 4 + 3]).toBe(0)
  })

  it("applies intersect, union and difference to brightness and green masks", () => {
    const pixels = image(6, 3, (x) => {
      if (x < 2) {
        return [40, 120, 40]
      }
      return x < 4 ? [170, 230, 170] : [220, 220, 220]
    })
    const intersection = processSpatialPixels(pixels, 6, 3, { operation: "overlay", threshold: 150, overlayMode: "intersect" })
    const union = processSpatialPixels(pixels, 6, 3, { operation: "overlay", threshold: 150, overlayMode: "union" })
    const difference = processSpatialPixels(pixels, 6, 3, { operation: "overlay", threshold: 150, overlayMode: "difference" })
    expect(intersection.summary.selectedPixelCount).toBe(6)
    expect(union.summary.selectedPixelCount).toBe(18)
    expect(difference.summary.selectedPixelCount).toBe(6)
  })

  it("computes local mean and variation without crossing a transparent pixel", () => {
    const pixels = image(12, 12, (x) => (x < 6 ? [20, 20, 20] : [220, 220, 220]))
    pixels[3] = 0
    const mean = processSpatialPixels(pixels, 12, 12, { operation: "neighborhood", radius: 2, neighborhoodMetric: "mean" })
    const variation = processSpatialPixels(pixels, 12, 12, { operation: "neighborhood", radius: 2, neighborhoodMetric: "variation" })
    expect(mean.summary.mean).toBeGreaterThan(100)
    expect(variation.summary.maximum).toBeGreaterThan(50)
    expect(variation.pixels[3]).toBe(0)
  })
})
