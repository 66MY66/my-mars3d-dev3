import { describe, expect, it, vi } from "vitest"

const fetchArrayBuffer = vi.fn(async () => new ArrayBuffer(8))
const fromDegrees = vi.fn((...bounds: number[]) => ({ bounds }))

class MockBaseTileLayer {
  id: string
  name?: string
  pid?: string | number
  show: boolean
  opacity: number
  options: Record<string, any>

  constructor(options: Record<string, any>) {
    this.id = options.id
    this.name = options.name
    this.pid = options.pid
    this.show = options.show ?? true
    this.opacity = options.opacity ?? 1
    this.options = { ...options }
  }
}

class MockUrlTemplateImageryProvider {
  options: Record<string, any>
  requestImage: any

  constructor(options: Record<string, any>) {
    this.options = options
  }
}

class MockResource {
  static lastUrl = ""

  constructor(options: { url: string }) {
    MockResource.lastUrl = options.url
  }

  fetchArrayBuffer = fetchArrayBuffer
}

vi.mock("mars3d", () => ({
  Cesium: {
    Rectangle: { fromDegrees },
    Resource: MockResource,
    UrlTemplateImageryProvider: MockUrlTemplateImageryProvider
  },
  layer: { BaseTileLayer: MockBaseTileLayer }
}))

vi.mock("./thematic-mvt", () => ({
  paintVectorTile: vi.fn(() => ({ tagName: "CANVAS" }))
}))

const { createMvtLayer } = await import("./mvt-layer")
const { paintVectorTile } = await import("./thematic-mvt")

describe("createMvtLayer", () => {
  it("rejects a URL without all z/x/y placeholders", () => {
    expect(() => createMvtLayer({ id: "bad", url: "https://example.com/{z}/{x}.pbf" })).toThrow("{z}/{x}/{y}")
  })

  it("creates a lifecycle-aware tile layer and renders requested vector tiles", async () => {
    const layer: any = createMvtLayer({
      id: "mvt_roads",
      name: "Roads",
      url: "https://example.com/{z}/{x}/{y}.pbf",
      pid: "vector_group",
      show: false,
      opacity: 0.4,
      minimumLevel: 2,
      maximumLevel: 16,
      bounds: [100, 20, 110, 30],
      sourceLayer: "roads",
      fillColor: "#112233",
      lineColor: "#445566"
    })

    expect(layer).toMatchObject({ id: "mvt_roads", name: "Roads", pid: "vector_group", show: false, opacity: 0.4 })

    const provider = await layer._createImageryProvider()
    expect(provider.options).toMatchObject({ minimumLevel: 2, maximumLevel: 16, rectangle: { bounds: [100, 20, 110, 30] } })

    await provider.requestImage(3, 5, 7, {})
    expect(MockResource.lastUrl).toBe("https://example.com/7/3/5.pbf")
    expect(paintVectorTile).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
      sourceLayer: "roads",
      fillColor: "#112233",
      lineColor: "#445566"
    })
  })
})
