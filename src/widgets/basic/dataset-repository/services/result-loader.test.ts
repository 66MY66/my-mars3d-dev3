import { beforeEach, describe, expect, it, vi } from "vitest"

const restoreWorkspace = vi.fn(async () => {})
const attachSourceRegistryToManifest = vi.fn((manifest: any) => manifest)
const tagLayerSourceRegistry = vi.fn()

class MockGroupLayer {
  id: string
  name: string
  type: string
  show: boolean
  open: boolean

  constructor(options: any) {
    this.id = options.id
    this.name = options.name
    this.type = options.type
    this.show = options.show
    this.open = options.open
  }
}

class MockModelEntity {
  id: string
  position: any
  style: any
  attr: any

  constructor(options: any) {
    this.id = options.id
    this.position = options.position
    this.style = options.style
    this.attr = options.attr
  }
}

vi.mock("mars3d", () => ({
  layer: {
    GroupLayer: MockGroupLayer
  },
  graphic: {
    ModelEntity: MockModelEntity
  }
}))

vi.mock("../workspace/restore", () => ({
  restoreWorkspace
}))

vi.mock("./source-registry", () => ({
  attachSourceRegistryToManifest,
  tagLayerSourceRegistry
}))

const { loadResultFile } = await import("./result-loader")

function createMapFixture() {
  const layers = new Map<string, any>()
  const graphics: any[] = []
  return {
    addLayer(layer: any) {
      layers.set(String(layer.id), layer)
    },
    getLayerById(id: string) {
      return layers.get(String(id)) || null
    },
    graphicLayer: {
      addGraphic(graphic: any) {
        graphics.push(graphic)
      }
    },
    getCenter() {
      return { lng: 120.12, lat: 30.28 }
    },
    __layers: layers,
    __graphics: graphics
  }
}

describe("result-loader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-result-file")
    })
  })

  it("previews document files without requiring a map", async () => {
    const progress: string[] = []
    const result = await loadResultFile(new File(["pdf"], "report.pdf", { type: "application/pdf" }), {
      onProgress(detail) {
        progress.push(`${detail.stage}:${detail.percent}`)
      }
    })

    expect(result).toMatchObject({
      target: "preview",
      name: "report.pdf",
      mime: "application/pdf",
      url: "blob:mock-result-file"
    })
    expect(result.message).toContain("仅支持预览")
    expect(progress).toEqual(["validating:10", "done:100"])
  })

  it("previews image files when the map is not ready", async () => {
    const result = await loadResultFile(new File(["img"], "preview.png", { type: "image/png" }))

    expect(result).toMatchObject({
      target: "preview",
      name: "preview.png",
      mime: "image/png",
      url: "blob:mock-result-file"
    })
    expect(result.message).toContain("图片可预览")
  })

  it("loads geojson files into map workspace and creates a classified group", async () => {
    const map = createMapFixture()

    const result = await loadResultFile(
      new File([JSON.stringify({ type: "FeatureCollection", features: [] })], "feature.geojson", { type: "application/geo+json" }),
      {
        map: map as any,
        datasetId: "ds-geo",
        datasetName: "GeoJSON成果"
      }
    )

    expect(result.target).toBe("map")
    expect(result.layerId).toMatch(/^LAYER_\d{14}_[0-9a-f]{8}$/i)
    expect(map.getLayerById("local_result_group_ds-geo")).toBeTruthy()
    expect(map.getLayerById("local_result_group_ds-geo")?.name).toBe("矢量/GeoJSON成果")
    expect(restoreWorkspace).toHaveBeenCalledTimes(1)
    expect(restoreWorkspace).toHaveBeenCalledWith(
      map,
      expect.objectContaining({
        layers: [
          expect.objectContaining({
            id: expect.stringMatching(/^LAYER_\d{14}_[0-9a-f]{8}$/i),
            sourceType: "geojson",
            pid: "local_result_group_ds-geo"
          })
        ]
      }),
      expect.objectContaining({
        strategy: "overlay",
        conflictResolution: "rename",
        restoreView: false,
        restoreDrawFeatures: false
      })
    )
    expect(tagLayerSourceRegistry).toHaveBeenCalled()
  })

  it("loads geotiff files into map workspace as raster layers", async () => {
    const map = createMapFixture()

    const result = await loadResultFile(new File(["tiff"], "elevation.tif", { type: "image/tiff" }), {
      map: map as any,
      datasetId: "ds-raster",
      datasetName: "高程成果"
    })

    expect(result.target).toBe("map")
    expect(result.layerId).toMatch(/^LAYER_\d{14}_[0-9a-f]{8}$/i)
    expect(restoreWorkspace).toHaveBeenCalledWith(
      map,
      expect.objectContaining({
        layers: [
          expect.objectContaining({
            id: expect.stringMatching(/^LAYER_\d{14}_[0-9a-f]{8}$/i),
            sourceType: "geotiff",
            pid: "local_result_group_ds-raster"
          })
        ]
      }),
      expect.anything()
    )
  })

  it("loads local gltf models onto the graphic layer", async () => {
    const map = createMapFixture()

    const result = await loadResultFile(new File(["gltf"], "scene.gltf", { type: "model/gltf+json" }), {
      map: map as any
    })

    expect(result).toMatchObject({
      target: "map",
      name: "scene.gltf",
      mime: "model/gltf+json"
    })
    expect(map.__graphics).toHaveLength(1)
    expect(map.__graphics[0]).toBeInstanceOf(MockModelEntity)
    expect(map.__graphics[0].style.url).toBe("blob:mock-result-file")
  })
})
