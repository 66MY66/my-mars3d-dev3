import { mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"

const messageSpy = vi.fn()
const createDataset = vi.fn()
const createRevision = vi.fn()
const getDatasets = vi.fn()
const getLatestDatasetManifest = vi.fn()
const quickSaveManifest = vi.fn()
const submitDatasetPublishRequest = vi.fn()
const updateLocalDataset = vi.fn()
const smartUploadArtifact = vi.fn()
const uploadThumbnail = vi.fn()
const emitDatasetSync = vi.fn()
const requestDatasetShare = vi.fn()
const getTemplates = vi.fn()
const getJobs = vi.fn()
const getJobResult = vi.fn()
const getCoverCache = vi.fn()
const setCoverCache = vi.fn()
const computeCoverCacheKey = vi.fn(() => "cover-key")
const idbDraftStore = new Map<string, any>()
const DRAFT_KEY = "save_manifest_draft_v1"
const DRAFT_LS_KEY = "save_manifest_draft_ls_v1"

vi.mock("@mars/components/mars-ui/index", () => ({
  $message: messageSpy
}))

vi.mock("../workspace/serialize", () => ({
  serializeWorkspace: vi.fn(() => ({
    manifestVersion: "1.0",
    layers: [],
    drawFeatures: [],
    viewState: {
      center: { longitude: 120, latitude: 30, height: 1000 },
      bbox: [119, 29, 121, 31]
    }
  })),
  validateManifest: vi.fn(() => ({ valid: true, errors: [] }))
}))

vi.mock("../services/eoapi-datasets", () => ({
  createDataset,
  createRevision,
  getDatasets,
  getLatestDatasetManifest,
  quickSaveManifest,
  submitDatasetPublishRequest,
  updateLocalDataset
}))

vi.mock("../services/eoapi-artifacts", () => ({
  smartUploadArtifact,
  uploadThumbnail
}))

vi.mock("../services/cover-cache", () => ({
  computeCoverCacheKey,
  getCoverCache,
  setCoverCache
}))

vi.mock("../services/dataset-sync", () => ({
  emitDatasetSync
}))

vi.mock("../services/publish-status", () => ({
  requestDatasetShare
}))

vi.mock("../services/eoapi-thematics", () => ({
  getJobs,
  getJobResult,
  getTemplates
}))

vi.mock("../map", () => ({
  getMap: vi.fn(() => null),
  getViewState: vi.fn(() => ({
    center: { longitude: 120, latitude: 30, height: 1000 },
    bbox: [119, 29, 121, 31],
    heading: 0,
    pitch: -45,
    roll: 0
  })),
  captureCoverImage: vi.fn(async () => new Blob(["cover"], { type: "image/jpeg" })),
  ensureGroupLayer: vi.fn(),
  setLayerName: vi.fn(() => true),
  setLayerPid: vi.fn()
}))

vi.mock("idb-keyval", () => ({
  createStore: vi.fn(() => ({})),
  del: vi.fn(async (key: string) => {
    idbDraftStore.delete(String(key))
  }),
  get: vi.fn(async (key: string) => idbDraftStore.get(String(key)) ?? null),
  set: vi.fn(async (key: string, value: any) => {
    idbDraftStore.set(String(key), value)
  })
}))

vi.mock("mars3d", () => ({
  Cesium: {
    Math: {
      toDegrees: (value: number) => value
    }
  },
  graphic: {
    PolygonEntity: class {}
  }
}))

vi.mock("@/utils/contextmenu/context-detector", () => ({
  getGraphicRing: vi.fn(() => []),
  getPolygonArea: vi.fn(() => 0)
}))

const SaveManifestDialog = (await import("./SaveManifestDialog.vue")).default

const fakeMap = {
  getLayers: vi.fn(() => [
    {
      id: "layer_1",
      name: "图层1",
      show: true,
      type: "image"
    }
  ]),
  camera: {
    changed: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  }
}

async function flushUi() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

async function waitForNameConflict(wrapper: any) {
  for (let i = 0; i < 20; i++) {
    await flushUi()
    if ((wrapper.vm as any).$.setupState.nameConflictOpen) {
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  }
  throw new Error("name conflict dialog did not open")
}

function createWrapper() {
  return mount(SaveManifestDialog, {
    props: {
      open: true
    },
    attachTo: document.body,
    global: {
      provide: {
        getMapInstance: () => fakeMap
      },
      stubs: {
        teleport: true,
        transition: false,
        "mars-dialog": {
          props: ["visible", "title"],
          emits: ["update:visible", "closed"],
          template: `
            <div v-if="visible" class="mars-dialog">
              <div class="dialog-title">{{ title }}</div>
              <slot />
              <slot name="footer" />
            </div>
          `
        },
        "mars-task-modal": {
          props: ["open", "title"],
          emits: ["update:open", "cancel"],
          template: `
            <div v-if="open" class="mars-task-modal">
              <div class="modal-title">{{ title }}</div>
              <slot />
              <slot name="footer" />
            </div>
          `
        },
        "a-form": { template: "<form><slot /></form>" },
        "a-form-item": { props: ["label", "name"], template: "<div class='a-form-item'><slot /></div>" },
        "a-input": {
          props: ["value", "modelValue", "placeholder"],
          emits: ["update:value", "update:modelValue", "blur"],
          template: "<input :value='value ?? modelValue' :placeholder='placeholder' @blur=\"$emit('blur')\" />"
        },
        "a-textarea": { template: "<textarea></textarea>" },
        "a-radio-group": { template: "<div class='a-radio-group'><slot /></div>" },
        "a-radio": { props: ["value", "disabled"], template: "<label class='a-radio'><slot /></label>" },
        "a-select": { template: "<div class='a-select'><slot /></div>" },
        "a-upload": { template: "<div class='a-upload'><slot /></div>" },
        "a-checkbox-group": { template: "<div class='a-checkbox-group'><slot /></div>" },
        "a-checkbox": { props: ["value"], template: "<label class='a-checkbox'><slot /></label>" },
        "a-empty": { props: ["description"], template: "<div class='a-empty'>{{ description }}</div>" },
        "a-progress": { template: "<div class='a-progress'></div>" },
        "a-alert": { template: "<div class='a-alert'><slot /><slot name='action' /></div>" },
        "a-button": {
          props: ["disabled", "loading", "type", "size", "danger"],
          emits: ["click"],
          template: "<button :disabled='disabled' @click=\"$emit('click', $event)\"><slot /></button>"
        }
      }
    }
  })
}

describe("SaveManifestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
    localStorage.clear()
    idbDraftStore.clear()
    vi.stubGlobal("fetch", vi.fn(async () => ({
      blob: async () => new Blob(["thematic-cover"], { type: "image/png" })
    } as any)))
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob://mock-cover"),
      revokeObjectURL: vi.fn()
    })
    getTemplates.mockResolvedValue({ success: true, data: [] })
    getJobs.mockResolvedValue({ success: true, data: [] })
    getJobResult.mockResolvedValue({ success: true, data: null })
    getCoverCache.mockReturnValue("data:image/jpeg;base64,Y292ZXI=")
    createRevision.mockResolvedValue({ success: true, data: { revisionId: "rev_1" } })
    getLatestDatasetManifest.mockResolvedValue({ success: true, data: { manifest: { manifestVersion: "1.0", layers: [] } } })
    uploadThumbnail.mockResolvedValue({ success: true })
    smartUploadArtifact.mockResolvedValue({ success: true })
    quickSaveManifest.mockResolvedValue({ success: true, data: { datasetId: "local_1", revisionId: "rev_local" } })
    submitDatasetPublishRequest.mockResolvedValue({ success: true })
  })

  it("covers existing dataset by creating a new revision", async () => {
    getDatasets.mockResolvedValue({
      success: true,
      data: [
        { id: "ds_existing", title: "重复成果" }
      ]
    })
    createDataset.mockResolvedValue({ success: true, data: { datasetId: "should_not_create" } })

    const wrapper = createWrapper()
    await flushUi()

    ;(wrapper.vm as any).formState.name = "重复成果"
    ;(wrapper.vm as any).$.setupState.previewManifest = {
      manifestVersion: "1.0",
      layers: [{ id: "layer_1", name: "图层1", sourceType: "image", sourceRef: "a.png" }],
      drawFeatures: []
    }

    const pending = (wrapper.vm as any).confirmPreview("save")
    await waitForNameConflict(wrapper)
    expect(document.body.textContent || "").toContain("名称已存在")
    ;(wrapper.vm as any).$.setupState.resolveNameConflict("cover")
    await pending
    await flushUi()

    expect(createDataset).not.toHaveBeenCalled()
    expect(createRevision).toHaveBeenCalledWith(
      "ds_existing",
      expect.objectContaining({
        message: "覆盖保存"
      })
    )
    expect(uploadThumbnail).toHaveBeenCalled()
    expect(emitDatasetSync).toHaveBeenCalledWith(expect.objectContaining({
      datasetId: "ds_existing",
      reason: "saved"
    }))
    wrapper.unmount()
  })

  it("renames duplicate dataset and creates a new dataset", async () => {
    getDatasets.mockResolvedValue({
      success: true,
      data: [
        { id: "ds_existing", title: "重复成果" }
      ]
    })
    createDataset.mockResolvedValue({ success: true, data: { datasetId: "ds_new" } })

    const wrapper = createWrapper()
    await flushUi()

    ;(wrapper.vm as any).formState.name = "重复成果"
    ;(wrapper.vm as any).$.setupState.previewManifest = {
      manifestVersion: "1.0",
      layers: [{ id: "layer_1", name: "图层1", sourceType: "image", sourceRef: "a.png" }],
      drawFeatures: []
    }

    const pending = (wrapper.vm as any).confirmPreview("save")
    await waitForNameConflict(wrapper)
    ;(wrapper.vm as any).$.setupState.resolveNameConflict("rename")
    await pending
    await flushUi()

    expect(createDataset).toHaveBeenCalledWith(expect.objectContaining({
      name: "重复成果-1"
    }))
    expect(createRevision).toHaveBeenCalledWith(
      "ds_new",
      expect.objectContaining({
        message: "init"
      })
    )
    wrapper.unmount()
  })

  it("restores saved draft after a failed save and clears it after retry succeeds", async () => {
    createDataset.mockResolvedValue({ success: false, message: "network down" })
    quickSaveManifest.mockResolvedValue({ success: false, message: "network down" })

    const first = createWrapper()
    await flushUi()

    ;(first.vm as any).formState.name = "断网草稿"
    ;(first.vm as any).formState.description = "等待恢复后重提"
    ;(first.vm as any).formState.tags = ["draft-tag"]
    ;(first.vm as any).$.setupState.previewManifest = {
      manifestVersion: "1.0",
      layers: [{ id: "layer_1", name: "图层1", sourceType: "image", sourceRef: "a.png" }],
      drawFeatures: []
    }

    await (first.vm as any).confirmPreview("save")
    await flushUi()

    expect(messageSpy).toHaveBeenCalledWith(expect.stringContaining("已保存草稿"))
    expect(localStorage.getItem(DRAFT_LS_KEY)).toBeTruthy()
    expect(idbDraftStore.get(DRAFT_KEY)).toBeTruthy()
    first.unmount()

    createDataset.mockResolvedValue({ success: true, data: { datasetId: "ds_retry_1" } })
    createRevision.mockResolvedValue({ success: true, data: { revisionId: "rev_retry_1" } })

    const second = createWrapper()
    await flushUi()

    expect(document.body.textContent || "").toContain("恢复草稿")
    await (second.vm as any).$.setupState.restoreDraft()
    await flushUi()

    expect((second.vm as any).formState.name).toBe("断网草稿")
    expect((second.vm as any).formState.description).toBe("等待恢复后重提")
    expect((second.vm as any).formState.tags).toEqual(["draft-tag"])
    expect(messageSpy).toHaveBeenCalledWith("草稿已恢复")

    ;(second.vm as any).$.setupState.previewManifest = {
      manifestVersion: "1.0",
      layers: [{ id: "layer_1", name: "图层1", sourceType: "image", sourceRef: "a.png" }],
      drawFeatures: []
    }

    await (second.vm as any).confirmPreview("save")
    await flushUi()

    expect(createDataset).toHaveBeenCalledWith(expect.objectContaining({
      name: "断网草稿",
      description: "等待恢复后重提",
      tags: ["draft-tag"]
    }))
    expect(localStorage.getItem(DRAFT_LS_KEY)).toBeNull()
    expect(idbDraftStore.get(DRAFT_KEY)).toBeUndefined()
    second.unmount()
  })

  it("uses uploaded image as cover source when coverMode is upload", async () => {
    createDataset.mockResolvedValue({ success: true, data: { datasetId: "ds_cover_upload" } })
    createRevision.mockResolvedValue({ success: true, data: { revisionId: "rev_cover_upload" } })

    const wrapper = createWrapper()
    await flushUi()

    const file = new File(["upload-cover"], "upload-cover.png", { type: "image/png" })
    ;(wrapper.vm as any).formState.name = "上传封面"
    ;(wrapper.vm as any).formState.coverMode = "upload"
    ;(wrapper.vm as any).$.setupState.beforeCoverUpload(file)
    ;(wrapper.vm as any).$.setupState.previewManifest = {
      manifestVersion: "1.0",
      layers: [{ id: "layer_1", name: "图层1", sourceType: "image", sourceRef: "a.png" }],
      drawFeatures: []
    }

    await (wrapper.vm as any).confirmPreview("save")
    await flushUi()

    expect(uploadThumbnail).toHaveBeenCalledWith("ds_cover_upload", file, "rev_cover_upload")
    wrapper.unmount()
  })

  it("uses selected thematic thumbnail as cover source when coverMode is thematic", async () => {
    createDataset.mockResolvedValue({ success: true, data: { datasetId: "ds_cover_thematic" } })
    createRevision.mockResolvedValue({ success: true, data: { revisionId: "rev_cover_thematic" } })

    const wrapper = createWrapper()
    await flushUi()

    ;(wrapper.vm as any).formState.name = "专题图封面"
    ;(wrapper.vm as any).formState.coverMode = "thematic"
    await (wrapper.vm as any).$.setupState.selectThematicThumb({
      artifactId: "art_thumb_1",
      url: "https://example.com/thumb.png",
      name: "专题图缩略图",
      jobId: "job_1"
    })
    ;(wrapper.vm as any).$.setupState.previewManifest = {
      manifestVersion: "1.0",
      layers: [{ id: "layer_1", name: "图层1", sourceType: "image", sourceRef: "a.png" }],
      drawFeatures: []
    }

    await (wrapper.vm as any).confirmPreview("save")
    await flushUi()

    const thematicBlob = (uploadThumbnail.mock.calls.at(-1) || [])[1] as Blob
    expect(uploadThumbnail).toHaveBeenCalledWith("ds_cover_thematic", expect.any(Blob), "rev_cover_thematic")
    expect(await thematicBlob.text()).toBe("thematic-cover")
    wrapper.unmount()
  })
})
