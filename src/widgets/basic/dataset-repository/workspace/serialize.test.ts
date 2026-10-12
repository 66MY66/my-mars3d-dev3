import { beforeAll, describe, expect, it } from "vitest"

;(globalThis as any).CanvasRenderingContext2D = (globalThis as any).CanvasRenderingContext2D || class {}

let resolveManifestCoverageBBox: typeof import("./serialize")["resolveManifestCoverageBBox"]

beforeAll(async () => {
  const mod = await import("./serialize")
  resolveManifestCoverageBBox = mod.resolveManifestCoverageBBox
})

describe("resolveManifestCoverageBBox", () => {
  it("expands bbox to include layer edge coverage", () => {
    const manifest: any = {
      manifestVersion: "1.0",
      viewState: {
        bbox: [100, 30, 101, 31]
      },
      layers: [
        {
          id: "img-a",
          sourceType: "image",
          sourceRef: "a.png",
          options: {
            bounds: [99.5, 29.8, 102.2, 31.4]
          }
        }
      ]
    }

    expect(resolveManifestCoverageBBox(manifest)).toEqual([99.5, 29.8, 102.2, 31.4])
  })

  it("includes draw feature corners when they exceed current view", () => {
    const manifest: any = {
      manifestVersion: "1.0",
      viewState: {
        bbox: [100, 30, 101, 31]
      },
      drawFeatures: [
        {
          id: "poly-1",
          type: "polygon",
          coordinates: [[[98, 28], [104, 28], [104, 35], [98, 35], [98, 28]]]
        }
      ]
    }

    expect(resolveManifestCoverageBBox(manifest)).toEqual([98, 28, 104, 35])
  })
})
