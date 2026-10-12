import { beforeEach, describe, expect, it, vi } from "vitest"

const restoreWorkspace = vi.fn(() => Promise.resolve())
const serializeWorkspace = vi.fn(() => ({ layers: [], viewState: { bbox: [100, 20, 101, 21] } }))

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

vi.mock("mars3d", () => ({
  Cesium: {},
  layer: {
    GroupLayer: MockGroupLayer
  }
}))

vi.mock("../dataset-repository/workspace", () => ({
  restoreWorkspace
}))

vi.mock("../dataset-repository/workspace/serialize", () => ({
  serializeWorkspace
}))

const { onMounted, onUnmounted, openLocalDataset, undoOpen } = await import("./map")

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
    }
  }
}

describe("my-repository/map", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onUnmounted()
  })

  it("dispatches session persist after open succeeds", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1234)
    const map = createMapFixture()
    onMounted(map as any)
    const persisted: any[] = []
    const handler = (evt: Event) => persisted.push((evt as CustomEvent).detail)
    window.addEventListener("mars3d:session-persist", handler as EventListener)

    try {
      await openLocalDataset({
        datasetId: "ds-1",
        datasetName: "测试数据",
        manifest: { layers: [], viewState: {} } as any,
        timeMode: "saved"
      })
    } finally {
      window.removeEventListener("mars3d:session-persist", handler as EventListener)
    }

    expect(restoreWorkspace).toHaveBeenCalledTimes(1)
    expect(persisted).toHaveLength(1)
    expect(persisted[0]).toMatchObject({
      datasetId: "ds-1",
      groupId: "myrepo_group_ds-1_1234",
      source: "my-repository",
      groupName: "我的仓库/测试数据",
      layerIdPrefix: "myrepo_ds-1_1234_"
    })
  })

  it("dispatches session remove after undo succeeds", async () => {
    vi.spyOn(Date, "now").mockReturnValue(4321)
    const map = createMapFixture()
    onMounted(map as any)
    const removed: any[] = []
    const handler = (evt: Event) => removed.push((evt as CustomEvent).detail)
    window.addEventListener("mars3d:session-remove", handler as EventListener)

    try {
      await openLocalDataset({
        datasetId: "ds-2",
        datasetName: "回退数据",
        manifest: { layers: [], viewState: {} } as any,
        timeMode: "saved"
      })

      const ok = await undoOpen()
      expect(ok).toBe(true)
    } finally {
      window.removeEventListener("mars3d:session-remove", handler as EventListener)
    }

    expect(restoreWorkspace).toHaveBeenCalledTimes(2)
    expect(removed).toHaveLength(1)
    expect(removed[0]).toMatchObject({
      groupId: "myrepo_group_ds-2_4321",
      source: "my-repository"
    })
  })

  it("removes stale my-repository layers after undo restores snapshot", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5678)
    const map = createMapFixture()
    onMounted(map as any)

    await openLocalDataset({
      datasetId: "ds-3",
      datasetName: "残留图层",
      manifest: { layers: [], viewState: {} } as any,
      timeMode: "saved"
    })

    map.addLayer({ id: "myrepo_ds-3_5678_1", name: "残留子图层" })
    map.addLayer({ id: "myrepo_ds-3_5678_2", name: "残留子图层2" })

    const ok = await undoOpen()
    expect(ok).toBe(true)
    expect(map.getLayerById("myrepo_group_ds-3_5678")).toBeNull()
    expect(map.getLayerById("myrepo_ds-3_5678_1")).toBeNull()
    expect(map.getLayerById("myrepo_ds-3_5678_2")).toBeNull()
  })
})
