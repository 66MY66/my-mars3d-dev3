import { describe, expect, it } from "vitest"
import { processRasterPixels } from "./raster-analysis"

const pixels = new Uint8ClampedArray([0, 0, 0, 255, 64, 64, 64, 255, 128, 128, 128, 255, 255, 255, 255, 255])

describe("processRasterPixels", () => {
  it("normalizes raster values across the available range", () => {
    const result = processRasterPixels(pixels, 2, 2, { operation: "algebra", algebraMode: "normalize" })
    expect([...result.pixels]).toEqual([...pixels])
    expect(result.summary.validPixelCount).toBe(4)
  })

  it("classifies each pixel with an opaque cartographic color", () => {
    const result = processRasterPixels(pixels, 2, 2, { operation: "classified", classCount: 4, classMethod: "equal" })
    expect(result.summary.breaks).toHaveLength(3)
    expect(result.pixels[3]).toBeGreaterThan(0)
    expect(result.pixels[0]).not.toBe(result.pixels[12])
  })

  it("extracts only pixels inside the configured threshold", () => {
    const result = processRasterPixels(pixels, 2, 2, { operation: "threshold", thresholdMin: 20, thresholdMax: 60 })
    expect(result.pixels[3]).toBe(0)
    expect(result.pixels[7]).toBeGreaterThan(0)
    expect(result.pixels[11]).toBeGreaterThan(0)
    expect(result.pixels[15]).toBe(0)
    expect(result.summary.validPixelCount).toBe(2)
  })

  it("mosaics pixels by averaging each block", () => {
    const result = processRasterPixels(pixels, 2, 2, { operation: "mosaic", mosaicSize: 2, opacity: 100 })
    expect(result.pixels[0]).toBe(result.pixels[4])
    expect(result.pixels[4]).toBe(result.pixels[8])
    expect(result.pixels[8]).toBe(result.pixels[12])
  })
})
