import { beforeEach, describe, expect, it, vi } from "vitest"

class MockBaseClass {}

class MockXyzLayer {
  id: string
  name: string
  type: string
  show: boolean
  options: Record<string, any>

  constructor(options: any) {
    this.id = options.id
    this.name = options.name
    this.type = "xyz"
    this.show = options.show ?? true
    this.options = { ...options }
  }
}

class MockHeatLayer {
  id: string
  name: string
  type: string
  show: boolean
  options: Record<string, any>

  constructor(options: any) {
    this.id = options.id
    this.name = options.name
    this.type = "heat"
    this.show = options.show ?? true
    this.options = { ...options }
  }
}

class MockGeoJsonLayer {
  id: string
  name: string
  type: string
  show: boolean
  options: Record<string, any>

  constructor(options: any) {
    this.id = options.id
    this.name = options.name
    this.type = "geojson"
    this.show = options.show ?? true
    this.options = { ...options }
  }
}

vi.mock("mars3d", () => ({
  BaseClass: MockBaseClass,
  Cesium: {
    Math: {
      toDegrees: vi.fn((value: number) => value),
      toRadians: vi.fn((value: number) => value)
    },
    Rectangle: {
      fromDegrees: vi.fn()
    },
    Cartesian3: {
      fromDegrees: vi.fn()
    }
  },
  layer: {
    GeoJsonLayer: MockGeoJsonLayer,
    HeatLayer: MockHeatLayer,
    XyzLayer: MockXyzLayer
  }
}))

vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true } as any)))

const {
  onMounted,
  onUnmounted,
  addGeoJsonLayer,
  addXyzLayer,
  addStacTileLayer
} = await import("./map")

const {
  DEFORMATION_IMAGERY_DEFAULT_STYLE,
  OPTICAL_IMAGERY_DEFAULT_STYLE,
  SAR_IMAGERY_DEFAULT_STYLE
} = await import("./services/layer-style-defaults")

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
    }
  }
}

describe("dataset-repository/map raster defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onUnmounted()
    localStorage.clear()
  })

  it("applies optical defaults to xyz layer instances", () => {
    const map = createMapFixture()
    onMounted(map as any)

    const layer: any = addXyzLayer("optical_layer", "https://example.com/tiles/{z}/{x}/{y}.png", {
      name: "灾后真彩影像"
    })

    expect(layer).toBeTruthy()
    expect(layer.options.styleProfile).toBe("optical")
    expect(layer.options.brightness).toBe(OPTICAL_IMAGERY_DEFAULT_STYLE.brightness)
    expect(layer.options.contrast).toBe(OPTICAL_IMAGERY_DEFAULT_STYLE.contrast)
    expect(layer.options.gamma).toBe(OPTICAL_IMAGERY_DEFAULT_STYLE.gamma)
    expect(layer.options.saturation).toBe(OPTICAL_IMAGERY_DEFAULT_STYLE.saturation)
  })

  it("marks stac visual layers as optical before creating xyz layers", () => {
    const map = createMapFixture()
    onMounted(map as any)

    const layer: any = addStacTileLayer("stac_visual", "COL_A", {
      id: "ITEM_1",
      assets: {
        visual: {
          href: "https://example.com/public-visual.tif"
        }
      }
    } as any, {
      name: "灾后真彩影像"
    })

    expect(layer).toBeTruthy()
    expect(layer.options.styleProfile).toBe("optical")
    expect(layer.options.assetKey).toBe("visual")
    expect(layer.options.brightness).toBe(OPTICAL_IMAGERY_DEFAULT_STYLE.brightness)
    expect(layer.options.url).toContain("/api/titiler-cog/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png")
  })

  it("applies sar defaults to radar xyz layer instances", () => {
    const map = createMapFixture()
    onMounted(map as any)

    const layer: any = addXyzLayer("sar_layer", "https://example.com/sar/{z}/{x}/{y}.png", {
      name: "Sentinel-1 SAR 影像"
    })

    expect(layer).toBeTruthy()
    expect(layer.options.styleProfile).toBe("sar")
    expect(layer.options.brightness).toBe(SAR_IMAGERY_DEFAULT_STYLE.brightness)
    expect(layer.options.contrast).toBe(SAR_IMAGERY_DEFAULT_STYLE.contrast)
    expect(layer.options.gamma).toBe(SAR_IMAGERY_DEFAULT_STYLE.gamma)
    expect(layer.options.saturation).toBe(SAR_IMAGERY_DEFAULT_STYLE.saturation)
  })

  it("applies deformation blue-red render defaults to titiler xyz layers", () => {
    const map = createMapFixture()
    onMounted(map as any)

    const layer: any = addXyzLayer(
      "deformation_layer",
      "https://example.com/cog/tiles/{z}/{x}/{y}@1x?url=/data/deformation.tif",
      {
        name: "InSAR 形变结果"
      }
    )

    expect(layer).toBeTruthy()
    expect(layer.options.styleProfile).toBe("deformation")
    expect(layer.options.contrast).toBe(DEFORMATION_IMAGERY_DEFAULT_STYLE.contrast)
    expect(layer.options.url).toContain("colormap_name=rdbu")
    expect(layer.options.colorRamp).toBe("blue-red")
  })

  it("creates heat layers for thermal point geojson data", () => {
    const map = createMapFixture()
    onMounted(map as any)

    const layer: any = addGeoJsonLayer(
      "thermal_points",
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { intensity: 6 },
            geometry: { type: "Point", coordinates: [118, 32] }
          }
        ]
      },
      {
        name: "热异常点位"
      }
    )

    expect(layer).toBeTruthy()
    expect(layer.type).toBe("heat")
    expect(layer.options.positions[0]).toMatchObject({ lng: 118, lat: 32, value: 6 })
  })

  it("creates geojson layers from remote source urls without embedding data", () => {
    const map = createMapFixture()
    onMounted(map as any)

    const layer: any = addGeoJsonLayer("remote_geojson", null, {
      name: "超大 GeoJSON",
      url: "https://example.com/artifacts/demo.geojson"
    })

    expect(layer).toBeTruthy()
    expect(layer.type).toBe("geojson")
    expect(layer.options.url).toBe("https://example.com/artifacts/demo.geojson")
    expect(layer.options.data).toBeUndefined()
  })
})
