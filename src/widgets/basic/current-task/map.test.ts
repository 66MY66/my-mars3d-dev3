import { beforeEach, describe, expect, it, vi } from "vitest"

const restoreWorkspace = vi.fn(() => Promise.resolve())

class MockBaseClass {}

class MockGroupLayer {
  id: string
  name: string
  type: string
  show: boolean
  open: boolean
  pid?: string | number
  options: Record<string, any>

  constructor(options: any) {
    this.id = options.id
    this.name = options.name
    this.type = options.type
    this.show = options.show
    this.open = options.open
    this.pid = options.pid
    this.options = { ...options }
  }
}

class MockGeoJsonLayer {
  id: string
  name: string
  type: string
  show: boolean
  pid?: string | number
  options: Record<string, any>

  constructor(options: any) {
    this.id = options.id
    this.name = options.name
    this.type = "geojson"
    this.show = options.show
    this.pid = options.pid
    this.options = { ...options }
  }
}

class MockHeatLayer {
  id: string
  name: string
  type: string
  show: boolean
  pid?: string | number
  options: Record<string, any>

  constructor(options: any) {
    this.id = options.id
    this.name = options.name
    this.type = "heat"
    this.show = options.show
    this.pid = options.pid
    this.options = { ...options }
  }
}

class MockXyzLayer {
  id: string
  name: string
  type: string
  show: boolean
  pid?: string | number
  options: Record<string, any>

  constructor(options: any) {
    this.id = options.id
    this.name = options.name
    this.type = "xyz"
    this.show = options.show
    this.pid = options.pid
    this.options = { ...options }
  }
}

vi.mock("mars3d", () => ({
  BaseClass: MockBaseClass,
  Cesium: {
    Rectangle: {
      fromDegrees: vi.fn()
    }
  },
  layer: {
    GroupLayer: MockGroupLayer,
    GeoJsonLayer: MockGeoJsonLayer,
    HeatLayer: MockHeatLayer,
    XyzLayer: MockXyzLayer
  }
}))

vi.mock("../dataset-repository/workspace", () => ({
  restoreWorkspace
}))

const {
  onMounted,
  onUnmounted,
  listDatasetSessions,
  persistSession,
  getPersistedSession,
  removePersistedSession,
  restorePersistedSessions,
  addGeoJsonLayer,
  addXyzLayer
} = await import("./map")

function createMapFixture() {
  const layers = new Map<string, any>()
  return {
    addLayer(layer: any) {
      layers.set(String(layer.id), layer)
    },
    getLayerById(id: string | number) {
      return layers.get(String(id)) || null
    },
    getLayers() {
      return Array.from(layers.values())
    },
    removeLayer(layer: any) {
      layers.delete(String(layer?.id))
    },
    scene: {
      requestRender: vi.fn()
    },
    __layers: layers
  }
}

describe("current-task/map", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    onUnmounted()
  })

  it("lists repository and my-repository sessions by group id prefix", () => {
    const map = createMapFixture()
    map.addLayer({ id: "eoapi_group_ds-1_1000", name: "仓库导入" })
    map.addLayer({ id: "myrepo_group_ds-1_2000", name: "我的仓库导入" })
    map.addLayer({ id: "other-layer", name: "其他图层" })
    onMounted(map as any)

    const sessions = listDatasetSessions("ds-1")

    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({
      datasetId: "ds-1",
      groupId: "myrepo_group_ds-1_2000",
      source: "my-repository",
      groupName: "我的仓库导入"
    })
    expect(sessions[1]).toMatchObject({
      datasetId: "ds-1",
      groupId: "eoapi_group_ds-1_1000",
      source: "repository",
      groupName: "仓库导入"
    })
  })

  it("persists and removes session metadata by group id", () => {
    persistSession({
      datasetId: "ds-1",
      groupId: "eoapi_group_ds-1_1000",
      openedAt: 1000,
      source: "repository",
      groupName: "本次导入",
      layerIdPrefix: "eoapi_ds-1_1000_",
      manifest: { layers: [] } as any
    })

    expect(getPersistedSession("eoapi_group_ds-1_1000")).toMatchObject({
      datasetId: "ds-1",
      groupId: "eoapi_group_ds-1_1000",
      layerIdPrefix: "eoapi_ds-1_1000_"
    })

    removePersistedSession("eoapi_group_ds-1_1000")

    expect(getPersistedSession("eoapi_group_ds-1_1000")).toBeNull()
  })

  it("restores persisted sessions into a group layer and workspace", async () => {
    const map = createMapFixture()
    onMounted(map as any)

    persistSession({
      datasetId: "ds-1",
      groupId: "eoapi_group_ds-1_1234",
      openedAt: 1234,
      source: "repository",
      groupName: "数据集成果/测试数据",
      layerIdPrefix: "eoapi_ds-1_1234_",
      manifest: {
        manifestVersion: "1.0",
        layers: [],
        drawFeatures: []
      } as any
    })

    const restoredCount = await restorePersistedSessions("ds-1")

    expect(restoredCount).toBe(1)
    expect(map.getLayerById("eoapi_group_ds-1_1234")).toBeTruthy()
    expect(restoreWorkspace).toHaveBeenCalledTimes(1)
    expect(restoreWorkspace).toHaveBeenCalledWith(
      map,
      expect.objectContaining({ manifestVersion: "1.0" }),
      expect.objectContaining({
        strategy: "overlay",
        conflictResolution: "rename",
        restoreView: false,
        restoreLayers: true,
        restoreDrawFeatures: true,
        layerIdPrefix: "eoapi_ds-1_1234_",
        layerParentId: "eoapi_group_ds-1_1234",
        drawIdPrefix: "eoapi_ds-1_1234_"
      })
    )
  })

  it("reuses existing geojson layer and backfills pid", () => {
    const map = createMapFixture()
    const existing: any = { id: "layer-1", name: "旧名称", type: "geojson", show: false, pid: null, options: {} }
    map.addLayer(existing)
    onMounted(map as any)

    const layer = addGeoJsonLayer("layer-1", { type: "FeatureCollection", features: [] }, {
      name: "新名称",
      pid: "group-1"
    })

    expect(layer).toBe(existing)
    expect(existing.show).toBe(true)
    expect(existing.name).toBe("新名称")
    expect(existing.pid).toBe("group-1")
    expect(existing.options.pid).toBe("group-1")
  })

  it("reuses existing xyz layer and backfills pid", () => {
    const map = createMapFixture()
    const existing: any = { id: "layer-2", name: "旧瓦片", type: "xyz", show: false, pid: null, options: {} }
    map.addLayer(existing)
    onMounted(map as any)

    const layer = addXyzLayer("layer-2", "https://example.com/{z}/{x}/{y}.png", {
      name: "新瓦片",
      pid: "group-2"
    })

    expect(layer).toBe(existing)
    expect(existing.show).toBe(true)
    expect(existing.name).toBe("新瓦片")
    expect(existing.pid).toBe("group-2")
    expect(existing.options.pid).toBe("group-2")
  })

  it("creates geojson layers with vector point and label defaults", () => {
    const map = createMapFixture()
    onMounted(map as any)

    const layer: any = addGeoJsonLayer("layer-3", { type: "FeatureCollection", features: [] }, {
      name: "点位图层",
      pid: "group-3"
    })

    expect(layer).toBeTruthy()
    expect(layer.options.symbol.applyVectorStyleByGeometry).toBe(true)
    expect(layer.options.symbol.styleOptions.pixelSize).toBe(10)
    expect(layer.options.symbol.styleOptions.labelField).toBe("")
    expect(typeof layer.options.symbol.callback).toBe("function")
  })

  it("creates heat layers for thermal point geojson data", () => {
    const map = createMapFixture()
    onMounted(map as any)

    const layer: any = addGeoJsonLayer(
      "layer-heat",
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { temperature: 9 },
            geometry: { type: "Point", coordinates: [110, 30] }
          }
        ]
      },
      {
        name: "热异常点位"
      }
    )

    expect(layer).toBeTruthy()
    expect(layer.type).toBe("heat")
    expect(layer.options.positions).toHaveLength(1)
    expect(layer.options.positions[0]).toMatchObject({ lng: 110, lat: 30, value: 9 })
  })
})
