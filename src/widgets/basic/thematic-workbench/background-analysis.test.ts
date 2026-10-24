import { describe, expect, it } from "vitest"
import { processBackgroundPixels } from "./background-analysis"

function gray(width: number, height: number, valueAt: (x: number, y: number) => number) {
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

describe("background field image operations", () => {
  it("maps positive and negative differences with distinct colors", () => {
    const baseline = gray(6, 4, () => 100)
    const current = gray(6, 4, (x) => x < 3 ? 130 : 70)
    const result = processBackgroundPixels(current, baseline, 6, 4, { operation: "difference" })
    expect(result.summary.meanDifference).toBe(0)
    expect(result.summary.positiveCount).toBe(12)
    expect(result.summary.negativeCount).toBe(12)
    expect(result.pixels[0]).toBeGreaterThan(result.pixels[3 * 4])
  })

  it("computes ratios while excluding zero baseline pixels", () => {
    const baseline = gray(6, 4, (x) => x === 0 ? 0 : 100)
    const current = gray(6, 4, () => 200)
    const result = processBackgroundPixels(current, baseline, 6, 4, { operation: "ratio" })
    expect(result.summary.meanRatio).toBe(2)
    expect(result.summary.validPixelCount).toBe(20)
    expect(result.pixels[3]).toBe(0)
  })

  it("normalizes change against baseline spatial dispersion", () => {
    const baseline = gray(6, 4, (x) => x < 3 ? 50 : 150)
    const current = gray(6, 4, (x) => x < 3 ? 100 : 200)
    const result = processBackgroundPixels(current, baseline, 6, 4, { operation: "normalization" })
    expect(result.summary.baselineDeviation).toBe(50)
    expect(result.summary.meanZ).toBe(1)
    expect(result.summary.positiveCount).toBe(24)
  })

  it("removes an isolated change using the median residual", () => {
    const baseline = gray(9, 9, () => 90)
    const current = gray(9, 9, (x, y) => x === 4 && y === 4 ? 240 : 90)
    const result = processBackgroundPixels(current, baseline, 9, 9, { operation: "denoise", denoiseWindow: 3 })
    expect(result.summary.suppressedResidual).toBeGreaterThan(0)
    expect(result.pixels[(4 * 9 + 4) * 4 + 3]).toBe(0)
  })
})
