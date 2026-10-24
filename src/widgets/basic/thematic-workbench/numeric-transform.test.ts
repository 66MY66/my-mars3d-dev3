import { describe, expect, it } from "vitest"
import { processNumericPixels, projectWgs84 } from "./numeric-transform"

function image(width: number, height: number, color: (x: number, y: number) => [number, number, number]) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.set([...color(x, y), 255], (y * width + x) * 4)
    }
  }
  return pixels
}

describe("numeric image transformations", () => {
  it("extracts only pixels over a channel threshold", () => {
    const pixels = image(4, 2, (x) => x < 2 ? [210, 20, 20] : [20, 20, 20])
    const result = processNumericPixels(pixels, 4, 2, { operation: "extract", channel: "red", threshold: 150 })
    expect(result.summary.selectedPixelCount).toBe(4)
    expect(result.summary.coverage).toBe(50)
    expect(result.pixels[3]).toBeGreaterThan(0)
    expect(result.pixels[2 * 4 + 3]).toBe(0)
  })

  it("vectorizes thresholded grid cells as pixel-space SVG", () => {
    const pixels = image(8, 8, (x, y) => x < 4 && y < 4 ? [220, 220, 220] : [10, 10, 10])
    const result = processNumericPixels(pixels, 8, 8, { operation: "vectorize", threshold: 100, blockSize: 4 })
    expect(result.summary.featureCount).toBe(1)
    expect(result.summary.selectedPixelCount).toBe(16)
    expect(result.svg).toContain("M0 0h4v4h-4Z")
  })

  it("calculates RGB greenness without calling it NDVI", () => {
    const pixels = image(2, 1, (x) => x ? [150, 70, 40] : [40, 150, 40])
    const exg = processNumericPixels(pixels, 2, 1, { operation: "index", index: "exg" })
    const ngrdi = processNumericPixels(pixels, 2, 1, { operation: "index", index: "ngrdi" })
    expect(exg.summary.selectedPixelCount).toBe(1)
    expect(ngrdi.summary.selectedPixelCount).toBe(1)
  })

  it("projects the locked WGS84 bounds to EPSG:3857", () => {
    expect(projectWgs84(0, 0)[0]).toBe(0)
    expect(projectWgs84(0, 0)[1]).toBeCloseTo(0, 6)
    const pixels = image(8, 8, () => [80, 80, 80])
    const result = processNumericPixels(pixels, 8, 8, { operation: "projection", bounds: { west: 100, south: 20, east: 102, north: 22 } })
    expect(result.summary.centerWgs84).toEqual([101, 21])
    expect(result.summary.centerMercator?.[0]).toBeCloseTo(11243268.57, 0)
    expect(result.summary.mercatorBounds?.[0]).toBeLessThan(result.summary.mercatorBounds?.[2] || 0)
  })
})
