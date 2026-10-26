import { beforeEach, describe, expect, it, vi } from "vitest"

const applyRestoreStrategy = vi.fn(async () => ({
  success: true,
  removedLayers: [],
  preservedLayers: [],
  errors: [],
  timestamp: Date.now()
}))

const applyDefaultRasterStyleOptions = vi.fn((options: any) => options)
const layerUtilCreate = vi.fn()

class MockXyzLayer {
  id: string
  name: string
  type: string
  pid?: string | number
  options: Record<string, any>

  constructor(options: any) {
    this.id = options.id
    this.name = options.name
    this.type = "xyz"
    this.pid = options.pid
    this.options = { ...options }
  }
}

class MockGeoTiffLayer {
  id: string
  name: string
  type: string
  pid?: string | number
  options: Record<string, any>

  constructor(options: any) {
    this.id = options.id
    this.name = options.name
    this.type = "geotiff"
    this.pid = options.pid
    this.options = { ...options }
  }
}

class MockHeatLayer {
  id: string
  name: string
  type: string
  pid?: string | number
  options: Record<string, any>

  constructor(options: any) {
    this.id = options.id
    this.name = options.name
    this.type = "heat"
    this.pid = options.pid
    this.options = { ...options }
  }
}

class MockRectangle {
  static fromDegrees = vi.fn()
}

vi.mock("mars3d", () => ({
  Cesium: {
    Rectangle: MockRectangle,
    Cartesian3: {
      fromDegrees: vi.fn()
    },
    Math: {
      toRadians: vi.fn((value: number) => value)
    }
  },
  Util: {
    clone: vi.fn((value: any) => JSON.parse(JSON.stringify(value)))
  },
  LayerUtil: {
    create: layerUtilCreate
  },
  layer: {
    XyzLayer: MockXyzLayer,
    HeatLayer: MockHeatLayer,
    GeoTiffLayer: MockGeoTiffLayer,
    GeoTifLayer: MockGeoTiffLayer
  }
}))

vi.mock("./strategies", () => ({
  applyRestoreStrategy
}))

vi.mock("../services/layer-style-defaults", () => ({
  applyDefaultRasterStyleOptions
}))

const { restoreWorkspace } = await import("./restore")

function createMapFixture() {
  const layers = new Map<string, any>()
  return {
    addLayer(layer: any) {
      layers.set(String(layer.id), layer)
    },
    getLayerById(id: string | number) {
      return layers.get(String(id)) || null
    },
    removeLayer(layer: any) {
      layers.delete(String(layer?.id))
    },
    getLayers() {
      return Array.from(layers.values())
    },
    graphicLayer: {
      clear: vi.fn()
    },
    camera: {
      flyTo: vi.fn()
    },
    __layers: layers
  }
}

describe("workspace/restore raster branches", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("restores xyz layers without errors", async () => {
    const map = createMapFixture()

    await restoreWorkspace(map as any, {
      manifestVersion: "1.0",
      layers: [
        {
          id: "xyz_layer",
          name: "XYZ底图",
          sourceType: "xyz",
          sourceRef: "https://example.com/tiles/{z}/{x}/{y}.png"
        } as any
      ]
    } as any, {
      restoreView: false,
      restoreDrawFeatures: false
    })

    const layer = map.getLayerById("xyz_layer") as MockXyzLayer
    expect(layer).toBeTruthy()
    expect(layer.options.url).toContain("{z}/{x}/{y}.png")
  })

  it("restores wms config layers via LayerUtil.create", async () => {
    const map = createMapFixture()
    layerUtilCreate.mockImplementation((options: any) => ({
      id: options.id,
      type: options.type,
      options: { ...options }
    }))

    await restoreWorkspace(map as any, {
      manifestVersion: "1.0",
      layers: [
        {
          id: "wms_layer",
          name: "WMS图层",
          sourceType: "wms",
          sourceRef: "https://example.com/service?service=WMS&request=GetMap",
          options: {
            layers: "demo:layer",
            format: "image/png",
            transparent: true
          }
        } as any
      ]
    } as any, {
      restoreView: false,
      restoreDrawFeatures: false
    })

    expect(layerUtilCreate).toHaveBeenCalledWith(expect.objectContaining({
      id: "wms_layer",
      type: "wms",
      layers: "demo:layer",
      format: "image/png",
      transparent: true
    }))
    expect(map.getLayerById("wms_layer")).toMatchObject({
      type: "wms"
    })
  })

  it("restores image config layers via LayerUtil.create", async () => {
    const map = createMapFixture()
    layerUtilCreate.mockImplementation((options: any) => ({
      id: options.id,
      type: options.type,
      options: { ...options }
    }))

    await restoreWorkspace(map as any, {
      manifestVersion: "1.0",
      layers: [
        {
          id: "img_layer",
          name: "单张影像",
          sourceType: "image",
          sourceRef: "https://example.com/result.png",
          options: {
            imageBounds: [100, 20, 101, 21]
          }
        } as any
      ]
    } as any, {
      restoreView: false,
      restoreDrawFeatures: false
    })

    expect(layerUtilCreate).toHaveBeenCalledWith(expect.objectContaining({
      id: "img_layer",
      type: "image",
      imageBounds: [100, 20, 101, 21]
    }))
    expect(map.getLayerById("img_layer")).toMatchObject({
      type: "image"
    })
  })

  it("restores cog/geotiff config layers via LayerUtil config path", async () => {
    const map = createMapFixture()
    layerUtilCreate.mockImplementation((options: any) => ({
      id: options.id,
      type: options.type,
      options: { ...options }
    }))

    await restoreWorkspace(map as any, {
      manifestVersion: "1.0",
      layers: [
        {
          id: "cog_layer",
          name: "COG影像",
          sourceType: "cog",
          sourceRef: "https://example.com/raster.tif",
          options: {
            styleProfile: "optical"
          }
        } as any
      ]
    } as any, {
      restoreView: false,
      restoreDrawFeatures: false
    })

    expect(layerUtilCreate).toHaveBeenCalledWith(expect.objectContaining({
      id: "cog_layer",
      type: "cog",
      styleProfile: "optical"
    }))
    expect(map.getLayerById("cog_layer")).toMatchObject({
      type: "cog"
    })
  })

  it("restores heat layers with heat positions and style config", async () => {
    const map = createMapFixture()

    await restoreWorkspace(map as any, {
      manifestVersion: "1.0",
      layers: [
        {
          id: "heat_layer",
          name: "热异常热力图",
          sourceType: "heat",
          data: {
            type: "FeatureCollection",
            features: []
          },
          options: {
            positions: [{ lng: 118, lat: 32, value: 7 }],
            valueColumn: "value",
            heatStyle: {
              radius: 28
            },
            styleProfile: "thermal"
          }
        } as any
      ]
    } as any, {
      restoreView: false,
      restoreDrawFeatures: false
    })

    const layer = map.getLayerById("heat_layer") as MockHeatLayer
    expect(layer).toBeTruthy()
    expect(layer.type).toBe("heat")
    expect(layer.options.positions).toEqual([{ lng: 118, lat: 32, value: 7 }])
    expect(layer.options.heatStyle).toMatchObject({ radius: 28 })
    expect(layer.options.styleProfile).toBe("thermal")
  })

  it("blocks duplicate source instances before restoring manifest layers", async () => {
    const map = createMapFixture()
    map.addLayer({
      id: "existing_layer",
      name: "同源图层",
      options: {
        sourceRegistryKey: "local::demo-file",
        sourceRegistryLabel: "本地成果/demo.geojson",
        sourceRegistryKind: "local",
        sourceRegistryGroupId: "existing_group"
      }
    })

    await expect(
      restoreWorkspace(map as any, {
        manifestVersion: "1.0",
        layers: [
          {
            id: "new_layer",
            name: "重复图层",
            sourceType: "geojson",
            data: { type: "FeatureCollection", features: [] },
            options: {
              sourceRegistryKey: "local::demo-file",
              sourceRegistryLabel: "本地成果/demo.geojson",
              sourceRegistryKind: "local"
            }
          } as any
        ]
      } as any, {
        restoreView: false,
        restoreDrawFeatures: false
      })
    ).rejects.toThrow("本地成果/demo.geojson已在地图中加载，禁止重复实例化")

    expect(applyRestoreStrategy).not.toHaveBeenCalled()
  })

  it("does not treat the current import parent group as an existing source instance", async () => {
    const map = createMapFixture()
    map.addLayer({
      id: "current_import_group",
      name: "本次导入分组",
      options: {
        sourceRegistryKey: "revision::dataset::multi-layer-v1::saved",
        sourceRegistryLabel: "成果版本/multi-layer-v1",
        sourceRegistryKind: "revision",
        sourceRegistryGroupId: "current_import_group"
      }
    })

    await restoreWorkspace(map as any, {
      manifestVersion: "1.0",
      layers: [
        {
          id: "new_layer",
          name: "首次导入图层",
          sourceType: "xyz",
          sourceRef: "https://example.com/{z}/{x}/{y}.png",
          options: {
            sourceRegistryKey: "revision::dataset::multi-layer-v1::saved",
            sourceRegistryLabel: "成果版本/multi-layer-v1",
            sourceRegistryKind: "revision"
          }
        } as any
      ]
    } as any, {
      strategy: "overlay",
      layerParentId: "current_import_group",
      restoreView: false,
      restoreDrawFeatures: false
    })

    expect(map.getLayerById("new_layer")).toBeTruthy()
  })

  it("allows same source restore when workspace strategy is replace", async () => {
    const map = createMapFixture()
    map.addLayer({
      id: "existing_layer",
      name: "同源图层",
      options: {
        sourceRegistryKey: "local::demo-file",
        sourceRegistryLabel: "本地成果/demo.geojson"
      }
    })

    await restoreWorkspace(map as any, {
      manifestVersion: "1.0",
      layers: [
        {
          id: "replace_layer",
          name: "替换图层",
          sourceType: "geojson",
          data: { type: "FeatureCollection", features: [] },
          options: {
            sourceRegistryKey: "local::demo-file",
            sourceRegistryLabel: "本地成果/demo.geojson"
          }
        } as any
      ]
    } as any, {
      strategy: "replace",
      restoreView: false,
      restoreDrawFeatures: false
    })

    expect(applyRestoreStrategy).toHaveBeenCalled()
  })
})
