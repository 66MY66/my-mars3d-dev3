import { flushPromises, shallowMount } from "@vue/test-utils"
import { nextTick } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const collection = {
  id: "dataset_1",
  type: "Collection",
  title: "测试数据集",
  description: "用于封面预览",
  license: "private",
  keywords: [],
  links: [],
  extent: {
    spatial: { bbox: [[100, 20, 101, 21]] },
    temporal: { interval: [[null, null]] }
  },
  summaries: { coverUrl: "https://example.test/cover.png" }
}

vi.mock("mars3d", () => ({ Cesium: {}, Log: { hasInfo: vi.fn() } }))

const flyToBbox = vi.fn()
const captureCoverImage = vi.fn(async () => new Blob(["cover"], { type: "image/png" }))
const restoreWorkspace = vi.fn(async () => {})
const addMoveEndListener = vi.fn((listener: () => void) => { listener(); return vi.fn() })
const serializeWorkspace = vi.fn(() => ({
  manifestVersion: "1.0",
  createdAt: 1,
  layers: [],
  drawFeatures: []
}))
const map = {
  camera: {
    positionWC: { x: 1, y: 2, z: 3, clone() { return { x: this.x, y: this.y, z: this.z } } },
    heading: 0.1,
    pitch: -0.5,
    roll: 0,
    setView: vi.fn(),
    moveEnd: { addEventListener: addMoveEndListener }
  },
  scene: { requestRender: vi.fn() }
}

vi.mock("../map", () => ({
  getMap: () => map,
  flyToBbox,
  captureCoverImage
}))
vi.mock("../workspace/serialize", () => ({ serializeWorkspace }))
vi.mock("../workspace/restore", () => ({ restoreWorkspace }))

vi.mock("../services/eoapi-datasets", () => ({
  getCollectionsAll: vi.fn(async () => ({ success: true, data: [collection] })),
  getLatestDatasetManifest: vi.fn(async () => ({
    success: true,
    data: { manifest: { manifestVersion: "1.0", createdAt: 2, layers: [], drawFeatures: [] }, revisionId: "r1" }
  })),
  getLocalDataset: vi.fn(() => null),
  getLocalManifests: vi.fn(() => []),
  updateLocalDataset: vi.fn()
}))

vi.mock("../services/eoapi-client", () => ({ resolveEoapiHref: (url: string) => url }))
vi.mock("../services/eoapi-i18n", () => ({
  ensureEoapiI18nConfig: vi.fn(async () => null),
  pickCollectionText: vi.fn(() => "")
}))
vi.mock("../services/dataset-metrics", () => ({
  getDatasetMetric: () => ({ browseCount: 0, importCount: 0, favorite: false }),
  getFavoriteDatasetIds: () => [],
  getRecentDatasetIds: () => [],
  onDatasetMetricsChange: () => () => {},
  recordDatasetBrowse: vi.fn(),
  syncMetricsFromServer: vi.fn(async () => {}),
  toggleDatasetFavorite: vi.fn(() => false)
}))
vi.mock("../services/cover-cache", () => ({
  getOrCreateBboxCover: vi.fn(),
  getPersistedDatasetCover: vi.fn(async () => null),
  setPersistedDatasetCover: vi.fn()
}))
vi.mock("../services/eoapi-config", () => ({ eoApiConfig: { autoSync: false } }))
vi.mock("../services/dataset-sync", () => ({ onDatasetSync: () => () => {} }))

const DatasetEntry = (await import("./DatasetEntry.vue")).default

describe("DatasetEntry cover preview", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let coverIndex = 0
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      Reflect.apply(callback, window, [0])
      return 1
    })
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => `blob:cover-${++coverIndex}`),
      revokeObjectURL: vi.fn()
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows upload and locate text actions while keeping the list cover preview open", async () => {
    const wrapper = shallowMount(DatasetEntry, {
      global: {
        stubs: {
          AButton: true,
          AInput: true,
          ASelect: true,
          ASelectOption: true,
          ASpin: true,
          AEmpty: true,
          ATag: true,
          APagination: true,
          MarsIcon: true,
          MarsTaskModal: {
            props: ["open"],
            template: '<section v-if="open" class="modal-stub"><slot name="headerRight"/><slot/></section>'
          }
        }
      }
    })
    await nextTick()
    ;(wrapper.vm as any).$.setupState.openCoverPreview(collection)
    await nextTick()

    const upload = wrapper.get(".cover-preview-upload-btn")
    const locate = wrapper.get(".cover-preview-locate-btn")
    expect(upload.text()).toBe("上图")
    expect(locate.text()).toBe("定位")

    await upload.trigger("click")
    await flushPromises()
    await locate.trigger("click")
    await flushPromises()
    expect(wrapper.find(".modal-stub").exists()).toBe(true)
    expect((wrapper.vm as any).$.setupState.coverPreviewVisible).toBe(true)
    expect(restoreWorkspace).toHaveBeenCalledOnce()
    expect(flyToBbox).toHaveBeenCalledWith([100, 20, 101, 21])
    expect(captureCoverImage).toHaveBeenCalledTimes(2)
    expect(addMoveEndListener).toHaveBeenCalledTimes(2)
    expect(wrapper.get(".cover-preview img").attributes("src")).toBe("blob:cover-2")

    await (wrapper.vm as any).$.setupState.closeCoverPreview()
    await flushPromises()
    expect(restoreWorkspace).toHaveBeenCalledTimes(2)
    expect(restoreWorkspace.mock.calls[1][2]).toMatchObject({ strategy: "replace", restoreView: false })
    expect(map.camera.setView).toHaveBeenCalledOnce()
    expect(wrapper.find(".modal-stub").exists()).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:cover-2")
    wrapper.unmount()
  })
})
