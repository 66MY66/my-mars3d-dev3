import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"

const messageSpy = vi.fn()
const connectDatasetSync = vi.fn()
const disconnectDatasetSync = vi.fn()
const getJobs = vi.fn()
const getJob = vi.fn()
const getJobResult = vi.fn()
const cancelJob = vi.fn()
const retryJob = vi.fn()
const getDirectoryLocks = vi.fn()
const upsertDirectoryLock = vi.fn()
const pickThematicExportArtifact = vi.fn()
const buildThematicExportFilename = vi.fn(() => "专题图-job_1.pdf")
const downloadThematicArtifact = vi.fn()
const resolveThematicServiceName = vi.fn((job: any) => job?.publishParams?.name || "")
const resolveThematicServiceDescription = vi.fn((job: any) => job?.publishParams?.description || "")
const canAddServiceRefToMap = vi.fn(() => true)
const copyServiceRefUrl = vi.fn(async () => true)
const openServiceRefUrl = vi.fn(() => true)
const isLikely3DServiceRef = vi.fn(() => false)
const addGeoJsonLayer = vi.fn(() => ({ id: "thematics_job_1" }))
const addXyzLayer = vi.fn(() => ({ id: "thematics_job_1" }))
const ensureGroupLayer = vi.fn()
const setLayerPid = vi.fn()
const flyToBbox = vi.fn()
const restorePersistedSessions = vi.fn(async () => 0)

let currentDatasetValue: any = null
let currentTaskLockValue: any = { locked: false, reason: "" }
const datasetListeners = new Set<(value: any) => void>()
const lockListeners = new Set<(value: any) => void>()

function emitDataset(value: any) {
  currentDatasetValue = value
  datasetListeners.forEach((cb) => cb(value))
}

function emitTaskLock(value: any) {
  currentTaskLockValue = value
  lockListeners.forEach((cb) => cb(value))
}

vi.mock("@mars/common/uses/use-lifecycle", () => ({
  default: vi.fn()
}))

vi.mock("@mars/components/mars-ui/index", () => ({
  $message: messageSpy
}))

vi.mock("@/utils/a11y/service", () => ({
  useA11yService: () => ({
    role: (v: string) => v,
    ariaModal: (v: boolean) => String(v),
    ariaLabel: (v: string) => v,
    tabIndex: (v: number) => v,
    ariaPressed: (v: boolean) => String(v)
  })
}))

vi.mock("@/shell/permission", () => ({
  isSuperAdmin: () => false
}))

vi.mock("@/shell/currentDataset", () => ({
  getCurrentDataset: () => currentDatasetValue,
  onCurrentDatasetChange: (cb: (value: any) => void) => {
    datasetListeners.add(cb)
    return () => datasetListeners.delete(cb)
  },
  getCurrentTaskLock: () => currentTaskLockValue,
  onCurrentTaskLockChange: (cb: (value: any) => void) => {
    lockListeners.add(cb)
    return () => lockListeners.delete(cb)
  },
  setCurrentTaskLock: (value: any) => emitTaskLock(value),
  clearCurrentTaskLock: () => emitTaskLock({ locked: false, reason: "" })
}))

vi.mock("./map", () => {
  const eventTarget = {
    on: vi.fn(),
    off: vi.fn()
  }
  return {
    eventTarget,
    getMap: vi.fn(() => null),
    getAllLayers: vi.fn(() => []),
    listDatasetSessions: vi.fn(() => [
      {
        datasetId: "ds-ct",
        groupId: "eoapi_group_ds-ct_1000",
        openedAt: 1000,
        source: "repository",
        groupName: "本次导入",
        layerIdPrefix: "eoapi_ds-ct_1000_",
        manifest: { manifestVersion: "1.0", layers: [], drawFeatures: [] }
      }
    ]),
    restorePersistedSessions,
    persistSession: vi.fn(),
    removePersistedSession: vi.fn(),
    getLayrsTree: vi.fn(() => ({
      tree: [
        {
          id: "eoapi_group_ds-ct_1000",
          key: "eoapi_group_ds-ct_1000",
          name: "本次导入",
          title: "本次导入",
          group: true,
          open: true,
          show: true,
          children: []
        }
      ]
    })),
    isLayerUnderGroup: vi.fn(() => true),
    ensureGroupLayer,
    addGeoJsonLayer,
    addXyzLayer,
    setLayerPid,
    flyToBbox,
    flyToLayer: vi.fn(),
    setLayerShow: vi.fn(),
    getLayerById: vi.fn((id: string) => (id === "eoapi_group_ds-ct_1000" ? { id, name: "本次导入" } : null))
  }
})

vi.mock("../dataset-repository/services/dataset-sync", () => ({
  connectDatasetSync,
  disconnectDatasetSync,
  onDatasetSync: (cb: any) => {
    return () => {}
  }
}))

vi.mock("../dataset-repository/services/eoapi-directory-locks", () => ({
  getDirectoryLocks,
  upsertDirectoryLock
}))

vi.mock("../dataset-repository/services/eoapi-thematics", () => ({
  getJobs,
  getJob,
  getJobResult,
  cancelJob,
  retryJob
}))

vi.mock("../dataset-repository/services/eoapi-config", () => ({
  eoApiConfig: {
    autoSync: false
  }
}))

vi.mock("../dataset-repository/services/eoapi-artifacts", () => ({
  getArtifacts: vi.fn(async () => ({ success: true, data: [] })),
  getArtifactDownloadUrl: vi.fn(async () => ({ success: true, data: { downloadUrl: "https://example.com/file.png" } })),
  smartUploadArtifact: vi.fn(),
  deleteArtifact: vi.fn(),
  linkArtifactToDataset: vi.fn(),
  formatArtifactSize: vi.fn(() => "1KB"),
  getArtifactTypeName: vi.fn(() => "封面")
}))

vi.mock("../dataset-repository/services/eoapi-datasets", () => ({
  getItems: vi.fn(),
  getLatestDatasetManifest: vi.fn(),
  getRevisionManifest: vi.fn(),
  forkDataset: vi.fn(),
  saveDatasetRevision: vi.fn()
}))

vi.mock("../dataset-repository/services/manifest-diff", () => ({
  diffManifests: vi.fn(() => [])
}))

vi.mock("../dataset-repository/services/layer-id", () => ({
  buildScopedGroupId: vi.fn(() => "eoapi_group_ds-ct_1000"),
  buildScopedLayerId: vi.fn(() => "layer_1"),
  buildScopedLayerPrefix: vi.fn(() => "eoapi_ds-ct_1000_"),
  ensureUniqueMapLayerId: vi.fn((_: any, id: string) => id),
  normalizeLayerIdToken: vi.fn((id: string) => id)
}))

vi.mock("../dataset-repository/services/thematic-export", () => ({
  pickThematicExportArtifact,
  buildThematicExportFilename,
  downloadThematicArtifact,
  resolveThematicServiceName,
  resolveThematicServiceDescription
}))

vi.mock("../dataset-repository/services/service-ref", () => ({
  canAddServiceRefToMap,
  copyServiceRefUrl,
  openServiceRefUrl,
  isLikely3DServiceRef
}))

vi.mock("../dataset-repository/workspace/restore", () => ({
  restoreWorkspace: vi.fn()
}))

vi.mock("../dataset-repository/workspace/serialize", () => ({
  serializeWorkspace: vi.fn(async () => ({ manifestVersion: "1.0", layers: [], drawFeatures: [] }))
}))

vi.mock("mars3d", () => ({
  Cesium: {
    Math: {
      toDegrees: (value: number) => value
    }
  }
}))

vi.mock("../dataset-repository/components/SaveManifestDialog.vue", () => ({
  default: {
    props: ["open"],
    template: "<div v-if='open' class='save-manifest-stub'></div>"
  }
}))

vi.mock("../dataset-repository/components/ArtifactPreview.vue", () => ({
  default: {
    props: ["url", "mime"],
    template: "<div class='artifact-preview-stub'>{{ url }}|{{ mime }}</div>"
  }
}))

vi.mock("@/components/Dataset/DatasetImportModal.vue", () => ({
  default: {
    props: ["open"],
    template: "<div v-if='open' class='dataset-import-stub'></div>"
  }
}))

const CurrentTask = (await import("./index.vue")).default

function mountCurrentTask() {
  return mount(CurrentTask, {
    props: {
      visible: true
    },
    attachTo: document.body,
    global: {
      stubs: {
        teleport: true,
        transition: false,
        "a-tooltip": { template: "<span><slot /></span>" },
        "a-tag": { template: "<span><slot /></span>" },
        "a-empty": { props: ["description"], template: "<div class='a-empty'>{{ description }}</div>" },
        "a-spin": { template: "<div class='a-spin'><slot /></div>" },
        "a-form": { template: "<form class='a-form'><slot /></form>" },
        "a-form-item": {
          props: ["label", "required"],
          template: "<label class='a-form-item'><span class='a-form-item-label'>{{ label }}</span><slot /></label>"
        },
        "a-input": {
          props: ["value", "modelValue", "placeholder", "size"],
          emits: ["update:value", "update:modelValue"],
          methods: {
            onInput(event: Event) {
              const target = event.target as HTMLInputElement | null
              const value = target?.value || ""
              this.$emit("update:value", value)
              this.$emit("update:modelValue", value)
            }
          },
          template: "<input :placeholder='placeholder' :value='value ?? modelValue' @input='onInput' />"
        },
        "a-button": {
          props: ["disabled", "type", "size", "ariaPressed"],
          emits: ["click"],
          template: "<button :disabled='disabled' @click=\"$emit('click', $event)\"><slot /></button>"
        },
        "a-modal": {
          props: ["open", "title", "footer", "width"],
          emits: ["update:open", "cancel", "ok"],
          template: "<div v-if='open' class='a-modal'><div class='modal-title'>{{ title }}</div><button class='modal-close' @click=\"$emit('cancel');$emit('update:open', false)\">close</button><slot /></div>"
        },
        "a-upload": { template: "<div class='a-upload'><slot /></div>" },
        "a-select": {
          props: ["value", "modelValue", "options", "placeholder", "size", "allowClear"],
          emits: ["update:value", "update:modelValue"],
          template: "<div class='a-select'><slot /></div>"
        },
        "a-select-option": { template: "<div class='a-select-option'><slot /></div>" },
        "a-list": { template: "<div class='a-list'><slot /></div>" },
        "a-list-item": { template: "<div class='a-list-item'><slot /></div>" },
        "a-list-item-meta": { template: "<div class='a-list-item-meta'><slot /></div>" },
        "a-dropdown": { template: "<div class='a-dropdown'><slot /><slot name='overlay' /></div>" },
        "a-menu": { emits: ["click"], template: "<div class='a-menu'><slot /></div>" },
        "a-menu-item": { template: "<button class='a-menu-item'><slot /></button>" },
        "a-menu-divider": { template: "<div class='a-menu-divider'></div>" },
        "mars-button": {
          props: ["disabled", "type", "size"],
          emits: ["click"],
          template: "<button class='mars-btn' :disabled='disabled' @click=\"$emit('click', $event)\"><slot /></button>"
        },
        "mars-icon": { template: "<span class='mars-icon'></span>" },
        "mars-tree": { template: "<div class='mars-tree'></div>" },
        "mars-dropdown-menu": { template: "<div class='mars-dropdown'><slot /><slot name='overlay' /></div>" },
        "mars-slider": { template: "<div class='mars-slider'></div>" }
      }
    }
  })
}

async function flushUi() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

function getBodyText() {
  return document.body.textContent || ""
}

function findBodyButton(text: string) {
  return Array.from(document.body.querySelectorAll("button")).find((btn) => (btn.textContent || "").includes(text)) as HTMLButtonElement | undefined
}

function findButtonIn(selector: string, text: string) {
  const root = document.body.querySelector(selector)
  if (!root) {
    return undefined
  }
  return Array.from(root.querySelectorAll("button")).find((btn) => (btn.textContent || "").includes(text)) as HTMLButtonElement | undefined
}

describe("current-task/index.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
    emitDataset({
      datasetId: "ds-ct",
      name: "当前任务测试数据集",
      source: "repository",
      updatedAt: Date.now()
    })
    emitTaskLock({ locked: false, reason: "" })
    datasetListeners.clear()
    lockListeners.clear()
    getDirectoryLocks.mockResolvedValue({ success: true, data: [] })
    upsertDirectoryLock.mockResolvedValue({ success: true, data: { locked: true } })
    getJobs.mockResolvedValue({
      success: true,
      data: [
        {
          jobId: "job_1",
          templateId: "local_mock_template",
          status: "succeeded",
          outputFormat: "pdf",
          publishParams: {
            name: "专题服务A",
            description: "这是服务简介"
          },
          parameters: {
            notes: "备注"
          }
        }
      ]
    })
    getJob.mockResolvedValue({ success: true, data: null })
    cancelJob.mockResolvedValue({ success: true, data: { success: true } })
    retryJob.mockResolvedValue({ success: true, data: { jobId: "job_1" } })
    getJobResult.mockResolvedValue({
      success: true,
      data: {
        jobId: "job_1",
        artifacts: [
          {
            artifactId: "art_preview",
            name: "预览图",
            type: "thumbnail",
            url: "data:image/svg+xml;charset=utf-8,preview",
            mime: "image/svg+xml"
          },
          {
            artifactId: "art_export",
            name: "导出文件.txt",
            type: "export",
            url: "data:text/plain;charset=utf-8,export",
            mime: "text/plain"
          },
          {
            artifactId: "art_pdf",
            name: "专题图.pdf",
            type: "report",
            url: "data:application/pdf;charset=utf-8,pdf",
            mime: "application/pdf"
          }
        ],
        serviceRef: {
          type: "xyz",
          urlTemplate: "data:application/geo+json;charset=utf-8,%7B%22type%22%3A%22FeatureCollection%22%2C%22features%22%3A%5B%5D%7D",
          bounds: [100, 20, 101, 21]
        }
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("locks current task after alert confirmation and disables mutating actions", async () => {
    const wrapper = mountCurrentTask()
    await flushUi()

    expect(getBodyText()).toContain("只读：关")

    window.dispatchEvent(new CustomEvent("mars3d_alertConfirmed", {
      detail: {
        alertInfo: {
          location: "测试区域"
        }
      }
    }))
    await flushUi()

    expect(messageSpy).toHaveBeenCalledWith("任务目录已锁定：告警已定稿：测试区域")
    expect(getBodyText()).toContain("只读：开")
    expect(findBodyButton("批量显示")?.disabled).toBe(true)
    expect(findBodyButton("批量隐藏")?.disabled).toBe(true)

    wrapper.unmount()
  })

  it("supports thematic preview, add-to-map, locate and export in lightweight mode", async () => {
    const openSpy = vi.fn()
    vi.stubGlobal("open", openSpy)
    pickThematicExportArtifact.mockReturnValue({
      artifactId: "art_pdf",
      name: "专题图.pdf",
      type: "report",
      url: "data:application/pdf;charset=utf-8,pdf",
      mime: "application/pdf"
    })
    const wrapper = mountCurrentTask()
    await flushUi()

    const thematicToggle = findBodyButton("专题图")
    expect(thematicToggle).toBeTruthy()
    thematicToggle!.click()
    await flushUi()

    expect(getJobs).toHaveBeenCalledWith({ datasetId: "ds-ct", limit: 200, offset: 0 })

    const refreshBtn = findBodyButton("刷新")
    expect(refreshBtn).toBeTruthy()
    refreshBtn!.click()
    await flushUi()

    expect(getBodyText()).toContain("local_mock_template")

    const jobItem = wrapper.find(".job-item")
    await jobItem.trigger("click")
    await flushUi()

    expect(getJobResult).toHaveBeenCalledWith("job_1")
    expect(getBodyText()).toContain("专题服务A")
    expect(getBodyText()).toContain("这是服务简介")

    const previewBtn = findBodyButton("预览")
    expect(previewBtn).toBeTruthy()
    previewBtn!.click()
    await flushUi()
    expect((document.body.querySelector(".a-modal .modal-title") as HTMLElement | null)?.textContent).toBe("附件预览")
    expect((document.body.querySelector(".artifact-preview-stub") as HTMLElement | null)?.textContent || "").toContain("data:image/svg+xml")

    const addBtn = findButtonIn(".service-actions", "上图")
    expect(addBtn).toBeTruthy()
    addBtn!.click()
    await flushUi()
    expect(ensureGroupLayer).toHaveBeenCalledWith("eoapi_group_ds-ct_1000__thematics", "专题图", "eoapi_group_ds-ct_1000")
    expect(addGeoJsonLayer).toHaveBeenCalled()
    expect(setLayerPid).toHaveBeenCalledWith("thematics_job_1", "eoapi_group_ds-ct_1000__thematics")
    expect(messageSpy).toHaveBeenCalledWith("已上图", "success")

    const locateBtn = findButtonIn(".service-actions", "定位")
    expect(locateBtn).toBeTruthy()
    locateBtn!.click()
    expect(flyToBbox).toHaveBeenCalledWith([100, 20, 101, 21], 1.2)

    const copyBtn = findButtonIn(".service-actions", "复制链接")
    expect(copyBtn).toBeTruthy()
    copyBtn!.click()
    await flushUi()
    expect(copyServiceRefUrl).toHaveBeenCalled()

    const openBtn = findButtonIn(".service-actions", "打开")
    expect(openBtn).toBeTruthy()
    openBtn!.click()
    expect(openServiceRefUrl).toHaveBeenCalled()

    const exportBtn = findButtonIn(".service-actions", "导出")
    expect(exportBtn).toBeTruthy()
    exportBtn!.click()
    expect(pickThematicExportArtifact).toHaveBeenCalledWith(expect.any(Array), "pdf")
    expect(buildThematicExportFilename).toHaveBeenCalled()
    expect(downloadThematicArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactId: "art_pdf"
    }), "专题图-job_1.pdf")

    wrapper.unmount()
  })

  it("supports thematic cancel and retry actions", async () => {
    getJobs.mockResolvedValue({
      success: true,
      data: [
        {
          jobId: "job_running",
          templateId: "local_mock_template",
          status: "running",
          progress: { percent: 30, stage: "rendering", message: "", startTime: Date.now() }
        },
        {
          jobId: "job_failed",
          templateId: "local_mock_template",
          status: "failed",
          progress: { percent: 60, stage: "tiling", message: "boom", startTime: Date.now() }
        }
      ]
    })
    getJobResult.mockResolvedValue({
      success: true,
      data: {
        jobId: "job_failed",
        status: "failed",
        artifacts: [],
        createdAt: Date.now()
      }
    })
    cancelJob.mockResolvedValue({ success: true, data: { success: true } })
    retryJob.mockResolvedValue({ success: true, data: { jobId: "job_failed" } })

    const wrapper = mountCurrentTask()
    await flushUi()

    const thematicToggle = findBodyButton("专题图")
    expect(thematicToggle).toBeTruthy()
    thematicToggle!.click()
    await flushUi()

    const jobItems = wrapper.findAll(".job-item")
    expect(jobItems.length).toBeGreaterThan(0)

    await jobItems[jobItems.length - 1].trigger("click")
    await flushUi()

    const retryBtn = findBodyButton("重试")
    expect(retryBtn).toBeTruthy()
    retryBtn!.click()
    await flushUi()
    expect(retryJob).toHaveBeenCalledWith("job_failed")

    await jobItems[0].trigger("click")
    await flushUi()

    const cancelBtn = findBodyButton("取消")
    expect(cancelBtn).toBeTruthy()
    cancelBtn!.click()
    await flushUi()
    expect(cancelJob).toHaveBeenCalledWith("job_running")

    wrapper.unmount()
  })
})
