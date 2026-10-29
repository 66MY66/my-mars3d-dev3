import { beforeEach, describe, expect, it, vi } from "vitest"
import { onMounted, onUnmounted } from "./map"

const { addLayer, graphicLayer } = vi.hoisted(() => ({
  addLayer: vi.fn(),
  graphicLayer: vi.fn(function (this: any) {
    this.addGraphic = vi.fn()
    this.clear = vi.fn()
  })
}))

vi.mock("mars3d", () => ({
  layer: { GraphicLayer: graphicLayer },
  graphic: { RectangleEntity: vi.fn() },
  Cesium: { Rectangle: { fromDegrees: vi.fn() } }
}))

vi.mock("@/api/spatialAnalysis", () => ({
  exportNeighborRaster: vi.fn(),
  runBufferAnalysis: vi.fn(),
  runNeighborAnalysis: vi.fn(),
  runNeighborRasterAnalysis: vi.fn(),
  runOverlayAnalysis: vi.fn()
}))

vi.mock("./local-neighbor-raster", () => ({
  analyzeLocalRaster: vi.fn(),
  createLocalRiskRaster: vi.fn(() => ({
    id: "local-synthetic-risk",
    name: "本地合成风险指数",
    bounds: [97, 21, 109, 35]
  })),
  describeLocalRasterSource: vi.fn(() => ({
    id: "local-synthetic-risk",
    label: "本地合成风险指数",
    sourceType: "raster",
    sourceRef: "memory://local-synthetic-risk",
    bands: [{ value: "1", label: "风险指数" }]
  })),
  rasterToCanvas: vi.fn(() => ({ toDataURL: vi.fn(() => "data:image/png;base64,test") }))
}))

describe("neighbor raster map lifecycle", () => {
  beforeEach(() => {
    addLayer.mockClear()
    graphicLayer.mockClear()
    process.env.API_LOCAL = "1"
  })

  it("registers the local raster without rendering a layer when the popup opens", () => {
    const map = { addLayer, removeLayer: vi.fn(), getLayers: vi.fn(() => []) } as any

    onMounted(map)

    expect(addLayer).not.toHaveBeenCalled()
    expect(graphicLayer).not.toHaveBeenCalled()
    onUnmounted()
  })
})
