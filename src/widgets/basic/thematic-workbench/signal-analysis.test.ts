import { describe, expect, it } from "vitest"
import { processSignalPixels } from "./signal-analysis"

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

describe("signal processing", () => {
  it("locates a horizontal periodic component and keeps the spatial response within the source", () => {
    const width = 32
    const pixels = image(width, 16, (x) => 128 + 70 * Math.cos((2 * Math.PI * x) / 8))
    const result = processSignalPixels(pixels, width, 16, { operation: "fourier", cutoff: 8 })
    expect(result.summary.spectrum.length).toBe(20)
    expect(result.summary.dominantPeriod).toBeGreaterThan(5)
    expect(result.summary.dominantPeriod).toBeLessThan(12)
    expect(result.summary.highFrequencyRatio).toBeGreaterThan(0.8)
    expect(result.pixels[3]).toBe(255)
  })

  it("separates a uniform low-frequency field from Haar detail", () => {
    const pixels = image(16, 16, () => 120)
    const result = processSignalPixels(pixels, 16, 16, { operation: "wavelet", waveletLevel: 2, waveletBand: "detail" })
    expect(result.summary.detailEnergyRatio).toBeLessThan(0.001)
    expect(result.summary.peak).toBeLessThan(0.001)
  })

  it("removes an isolated impulse with median filtering", () => {
    const pixels = image(9, 9, (x, y) => (x === 4 && y === 4 ? 255 : 50))
    const result = processSignalPixels(pixels, 9, 9, { operation: "filter", filter: "median", filterWindow: 3 })
    expect(result.pixels[(4 * 9 + 4) * 4]).toBe(50)
    expect(result.summary.noiseReduction).toBeGreaterThan(0.9)
    expect(result.summary.estimatedSnrGainDb).toBeGreaterThan(0)
  })

  it("traces a step edge while leaving uniform areas transparent", () => {
    const pixels = image(32, 24, (x) => (x < 16 ? 30 : 220))
    const result = processSignalPixels(pixels, 32, 24, { operation: "edge", edgeMethod: "canny", edgeThreshold: 25 })
    expect(result.summary.edgePixelCount).toBeGreaterThan(15)
    expect(result.summary.edgePixelCount).toBeLessThan(100)
    expect(result.pixels[(12 * 32 + 2) * 4 + 3]).toBe(0)
    expect(result.pixels[(12 * 32 + 16) * 4 + 3]).toBe(255)
  })
})
