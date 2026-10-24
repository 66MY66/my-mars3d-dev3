import { describe, expect, it } from "vitest"
import { analyzeScreenshotPixels, type ScreenshotPixelSource } from "./screenshot-analysis"

function createPixels(width: number, height: number, getColor: (x: number, y: number) => [number, number, number]): ScreenshotPixelSource {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue] = getColor(x, y)
      const offset = (y * width + x) * 4
      data[offset] = red
      data[offset + 1] = green
      data[offset + 2] = blue
      data[offset + 3] = 255
    }
  }
  return { width, height, data }
}

describe("screenshot analysis", () => {
  it("computes luminance and level distribution from sampled pixels", () => {
    const source = createPixels(4, 2, (x) => x < 2 ? [0, 0, 0] : [255, 255, 255])
    const result = analyzeScreenshotPixels(source, {
      metric: "luminance",
      sampleStep: 1,
      gridColumns: 2,
      gridRows: 1
    })

    expect(result.sampledPixels).toBe(8)
    expect(result.mean).toBe(50)
    expect(result.gridValues).toEqual([0, 100])
    expect(result.levelDistribution).toEqual([50, 0, 0, 50])
  })

  it("excludes the white frame and identifies green coverage", () => {
    const source = createPixels(6, 6, (x, y) => {
      const isFrame = x === 0 || y === 0 || x === 5 || y === 5
      return isFrame ? [255, 255, 255] : [35, 150, 55]
    })
    const result = analyzeScreenshotPixels(source, {
      metric: "greenness",
      sampleStep: 1,
      gridColumns: 2,
      gridRows: 2,
      inset: 1
    })

    expect(result.sampledPixels).toBe(16)
    expect(result.colorDistribution[1]).toBe(100)
    expect(result.mean).toBeGreaterThan(70)
  })

  it("derives texture strength from adjacent pixel contrast", () => {
    const source = createPixels(8, 2, (x) => x % 2 === 0 ? [0, 0, 0] : [255, 255, 255])
    const result = analyzeScreenshotPixels(source, {
      metric: "texture",
      sampleStep: 1,
      gridColumns: 4,
      gridRows: 1
    })

    expect(result.mean).toBeGreaterThan(80)
    expect(result.maximum).toBe(100)
    expect(result.profileValues).toHaveLength(8)
  })
})
