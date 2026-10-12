import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"

const messageSpy = vi.fn()

const getTemplates = vi.fn()
const getJobs = vi.fn()
const getJob = vi.fn()
const getJobResult = vi.fn()
const createJob = vi.fn()
const cancelJob = vi.fn()
const retryJob = vi.fn()
const pushToArchive = vi.fn()
const getJobLogs = vi.fn()
const buildThematicArchiveMetadata = vi.fn(() => ({ archive: true }))
const canAddServiceRefToMap = vi.fn(() => false)
const ensureGroupLayer = vi.fn()
const addXyzLayer = vi.fn(() => ({ id: "layer_1" }))
const addGeoJsonLayer = vi.fn(() => ({ id: "layer_geo_1" }))

vi.mock("@mars/components/mars-ui/index", () => ({
  $message: messageSpy
}))

vi.mock("../services/eoapi-thematics", () => ({
  getTemplates,
  getJobs,
  getJob,
  getJobResult,
  createJob,
  cancelJob,
  retryJob,
  pushToArchive,
  getJobLogs
}))

vi.mock("../../../eoapi-workbench/services/eoapi-services", () => ({
  createLayerIdFromService: () => "service_layer_1",
  buildLayerConfig: () => ({ url: "https://example.com/{z}/{x}/{y}.png", minZoom: 0, maxZoom: 18 })
}))

vi.mock("../map", () => ({
  getMap: () => null,
  ensureGroupLayer,
  addXyzLayer,
  addGeoJsonLayer,
  flyToBbox: vi.fn(),
  flyToLayer: vi.fn(),
  getViewState: vi.fn(),
  flyToViewState: vi.fn(),
  getCurrentBounds: vi.fn(() => [100, 20, 101, 21])
}))

vi.mock("../services/layer-id", () => ({
  ensureUniqueMapLayerId: (_: any, id: string) => id,
  normalizeLayerIdToken: (id: string) => id
}))

vi.mock("../services/layer-id-generator", () => ({
  generateLayerId: () => "layer_gen_1"
}))

vi.mock("../services/thematic-export", () => ({
  buildThematicArchiveMetadata,
  buildThematicCreateJobParams: (form: any) => form,
  buildThematicExportFilename: () => "thematics_export.pdf",
  downloadThematicArtifact: vi.fn(),
  pickThematicExportArtifact: () => null,
  resolveThematicServiceName: () => "",
  resolveThematicServiceDescription: () => ""
}))

vi.mock("../services/service-ref", () => ({
  canAddServiceRefToMap,
  copyServiceRefUrl: vi.fn(async () => true),
  isLikely3DServiceRef: () => false,
  openServiceRefUrl: () => true,
  resolveServiceRefUrl: () => "https://example.com/{z}/{x}/{y}.png"
}))

vi.mock("../workspace/restore", () => ({
  restoreWorkspace: vi.fn()
}))

vi.mock("./ArtifactPreview.vue", () => ({
  default: {
    props: ["url", "mime"],
    template: "<div class='artifact-preview-stub'>{{ url }}|{{ mime }}</div>"
  }
}))

const ThematicJobs = (await import("./ThematicJobs.vue")).default

async function flushUi() {
  await Promise.resolve()
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

function findButton(text: string) {
  return Array.from(document.body.querySelectorAll("button")).find((btn) => (btn.textContent || "").includes(text)) as HTMLButtonElement | undefined
}

describe("ThematicJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
    vi.spyOn(window, "setInterval").mockImplementation(() => 1 as any)
    vi.spyOn(window, "clearInterval").mockImplementation(() => {})
    ensureGroupLayer.mockReset()
    addXyzLayer.mockClear()
    addGeoJsonLayer.mockClear()
    getTemplates.mockResolvedValue({ success: true, data: { templates: [], total: 0 } })
    getJobResult.mockResolvedValue({
      success: true,
      data: {
        jobId: "job_1",
        status: "succeeded",
        artifacts: [
          { artifactId: "art_1", name: "report.pdf", type: "report", mime: "application/pdf" },
          { artifactId: "art_2", name: "thumb.png", type: "thumbnail", mime: "image/png" }
        ],
        createdAt: Date.now()
      }
    })
    getJob.mockResolvedValue({ success: true, data: null })
    cancelJob.mockResolvedValue({ success: true, data: { success: true } })
    retryJob.mockResolvedValue({ success: true, data: null })
    pushToArchive.mockResolvedValue({ success: true, data: { archiveId: "a1", status: "pending" } })
    canAddServiceRefToMap.mockReturnValue(false)
    getJobLogs.mockResolvedValue({
      success: true,
      data: {
        logId: "log_1",
        entries: [
          { timestamp: Date.now(), level: "info", stage: "render", message: "render ok" }
        ],
        total: 1
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders queued job progress stage in list", async () => {
    getJobs.mockResolvedValue({
      success: true,
      data: [
        {
          jobId: "job_queued",
          templateId: "tpl_1",
          templateVersion: "1.0",
          status: "queued",
          progress: { percent: 0, stage: "rendering", message: "", startTime: Date.now() },
          createdAt: Date.now()
        }
      ]
    })

    mount(ThematicJobs, {
      props: { datasetId: "ds_1" },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
          transition: false,
          "a-alert": { template: "<div class='a-alert'><slot /></div>" },
          "a-spin": { props: ["tip"], template: "<div class='a-spin'>{{ tip }}</div>" },
          "a-empty": { props: ["description"], template: "<div class='a-empty'>{{ description }}</div>" },
          "a-progress": { props: ["percent", "status", "size"], template: "<div class='a-progress'>{{ percent }}|{{ status }}</div>" },
          "a-tag": { template: "<span class='a-tag'><slot /></span>" },
          "a-select": { template: "<div class='a-select'><slot /></div>" },
          "a-select-option": { template: "<div class='a-select-option'><slot /></div>" },
          "a-form": { template: "<form class='a-form'><slot /></form>" },
          "a-form-item": { template: "<div class='a-form-item'><slot /></div>" },
          "a-input": { template: "<input />" },
          "mars-button": { emits: ["click"], template: "<button class='mars-btn' @click=\"$emit('click', $event)\"><slot /></button>" },
          "mars-icon": { template: "<span class='mars-icon'></span>" },
          "mars-task-modal": {
            props: ["open", "title", "footer", "width"],
            emits: ["update:open", "cancel", "ok"],
            template: "<div v-if='open' class='mars-task-modal'><div class='title'>{{ title }}</div><slot /></div>"
          }
        }
      }
    })

    await flushUi()
    expect(document.body.textContent || "").toContain("渲染")
  })

  it("supports cancelling queued job from list", async () => {
    getJobs.mockResolvedValue({
      success: true,
      data: [
        {
          jobId: "job_queued",
          templateId: "tpl_1",
          templateVersion: "1.0",
          status: "queued",
          progress: { percent: 0, stage: "queued", message: "", startTime: Date.now() },
          createdAt: Date.now()
        }
      ]
    })

    mount(ThematicJobs, {
      props: { datasetId: "ds_1" },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
          transition: false,
          "a-alert": { template: "<div class='a-alert'><slot /></div>" },
          "a-spin": { template: "<div class='a-spin'><slot /></div>" },
          "a-empty": { props: ["description"], template: "<div class='a-empty'>{{ description }}</div>" },
          "a-progress": { template: "<div class='a-progress'></div>" },
          "a-tag": { template: "<span class='a-tag'><slot /></span>" },
          "a-select": { template: "<div class='a-select'><slot /></div>" },
          "a-select-option": { template: "<div class='a-select-option'><slot /></div>" },
          "a-form": { template: "<form class='a-form'><slot /></form>" },
          "a-form-item": { template: "<div class='a-form-item'><slot /></div>" },
          "a-input": { template: "<input />" },
          "mars-button": { emits: ["click"], template: "<button class='mars-btn' @click=\"$emit('click', $event)\"><slot /></button>" },
          "mars-icon": { template: "<span class='mars-icon'></span>" },
          "mars-task-modal": { props: ["open"], template: "<div v-if='open' class='mars-task-modal'><slot /></div>" }
        }
      }
    })

    await flushUi()

    const btn = findButton("取消")
    expect(btn).toBeTruthy()
    btn?.click()
    await flushUi()

    expect(cancelJob).toHaveBeenCalledWith("job_queued")
  })

  it("loads logs when viewing failed job", async () => {
    getJobs.mockResolvedValue({
      success: true,
      data: [
        {
          jobId: "job_failed",
          templateId: "tpl_1",
          templateVersion: "1.0",
          status: "failed",
          progress: { percent: 30, stage: "slicing", message: "failed", startTime: Date.now() },
          createdAt: Date.now()
        }
      ]
    })
    getJobResult.mockResolvedValue({ success: true, data: { jobId: "job_failed", status: "failed", artifacts: [], createdAt: Date.now() } })

    const wrapper = mount(ThematicJobs, {
      props: { datasetId: "ds_1" },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
          transition: false,
          "a-alert": { template: "<div class='a-alert'><slot /></div>" },
          "a-spin": { props: ["tip"], template: "<div class='a-spin'>{{ tip }}</div>" },
          "a-empty": { props: ["description"], template: "<div class='a-empty'>{{ description }}</div>" },
          "a-progress": { template: "<div class='a-progress'></div>" },
          "a-tag": { template: "<span class='a-tag'><slot /></span>" },
          "a-select": { template: "<div class='a-select'><slot /></div>" },
          "a-select-option": { template: "<div class='a-select-option'><slot /></div>" },
          "a-form": { template: "<form class='a-form'><slot /></form>" },
          "a-form-item": { template: "<div class='a-form-item'><slot /></div>" },
          "a-input": { template: "<input />" },
          "mars-button": { emits: ["click"], template: "<button class='mars-btn' @click=\"$emit('click', $event)\"><slot /></button>" },
          "mars-icon": { template: "<span class='mars-icon'></span>" },
          "mars-task-modal": {
            props: ["open", "title"],
            emits: ["update:open", "cancel", "ok"],
            template: "<div v-if='open' class='mars-task-modal'><div class='title'>{{ title }}</div><slot /></div>"
          }
        }
      }
    })

    await flushUi()
    await wrapper.find(".job-item").trigger("click")
    await flushUi()

    const viewLogs = findButton("查看日志")
    expect(viewLogs).toBeTruthy()
    viewLogs?.click()
    await flushUi()

    expect(getJobLogs).toHaveBeenCalledWith("job_failed", { limit: 200 })
    expect(document.body.textContent || "").toContain("render ok")
  })

  it("notifies when job transitions to succeeded", async () => {
    getJobs
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            jobId: "job_running",
            templateId: "tpl_1",
            templateVersion: "1.0",
            status: "running",
            progress: { percent: 50, stage: "rendering", message: "", startTime: Date.now() },
            createdAt: Date.now()
          }
        ]
      })
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            jobId: "job_running",
            templateId: "tpl_1",
            templateVersion: "1.0",
            status: "succeeded",
            progress: { percent: 100, stage: "done", message: "", startTime: Date.now() },
            createdAt: Date.now()
          }
        ]
      })

    mount(ThematicJobs, {
      props: { datasetId: "ds_1" },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
          transition: false,
          "a-alert": { template: "<div class='a-alert'><slot /></div>" },
          "a-spin": { template: "<div class='a-spin'><slot /></div>" },
          "a-empty": { props: ["description"], template: "<div class='a-empty'>{{ description }}</div>" },
          "a-progress": { template: "<div class='a-progress'></div>" },
          "a-tag": { template: "<span class='a-tag'><slot /></span>" },
          "a-select": { template: "<div class='a-select'><slot /></div>" },
          "a-select-option": { template: "<div class='a-select-option'><slot /></div>" },
          "a-form": { template: "<form class='a-form'><slot /></form>" },
          "a-form-item": { template: "<div class='a-form-item'><slot /></div>" },
          "a-input": { template: "<input />" },
          "mars-button": { emits: ["click"], template: "<button class='mars-btn' @click=\"$emit('click', $event)\"><slot /></button>" },
          "mars-icon": { template: "<span class='mars-icon'></span>" },
          "mars-task-modal": { props: ["open"], template: "<div v-if='open' class='mars-task-modal'><slot /></div>" }
        }
      }
    })

    await flushUi()
    const refresh = findButton("刷新")
    refresh?.click()
    await flushUi()

    const ok = messageSpy.mock.calls.some((args) => String(args[0] || "").includes("专题任务已完成"))
    expect(ok).toBe(true)
  })

  it("pushes archive with artifact ids and structured metadata", async () => {
    getJobs.mockResolvedValue({
      success: true,
      data: [
        {
          jobId: "job_1",
          templateId: "tpl_1",
          templateVersion: "1.0",
          datasetId: "ds_1",
          status: "succeeded",
          progress: { percent: 100, stage: "done", message: "", startTime: Date.now() },
          createdAt: Date.now()
        }
      ]
    })

    const wrapper = mount(ThematicJobs, {
      props: { datasetId: "ds_1" },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
          transition: false,
          "a-alert": { template: "<div class='a-alert'><slot /></div>" },
          "a-spin": { template: "<div class='a-spin'><slot /></div>" },
          "a-empty": { props: ["description"], template: "<div class='a-empty'>{{ description }}</div>" },
          "a-progress": { template: "<div class='a-progress'></div>" },
          "a-tag": { template: "<span class='a-tag'><slot /></span>" },
          "a-select": { template: "<div class='a-select'><slot /></div>" },
          "a-select-option": { template: "<div class='a-select-option'><slot /></div>" },
          "a-form": { template: "<form class='a-form'><slot /></form>" },
          "a-form-item": { template: "<div class='a-form-item'><slot /></div>" },
          "a-input": { template: "<input />" },
          "mars-button": { emits: ["click"], template: "<button class='mars-btn' @click=\"$emit('click', $event)\"><slot /></button>" },
          "mars-icon": { template: "<span class='mars-icon'></span>" },
          "mars-task-modal": { props: ["open"], template: "<div v-if='open' class='mars-task-modal'><slot /></div>" }
        }
      }
    })

    await flushUi()
    await wrapper.find(".job-item").trigger("click")
    await flushUi()

    const archiveBtn = findButton("推送归档")
    expect(archiveBtn).toBeTruthy()
    archiveBtn?.click()
    await flushUi()

    expect(buildThematicArchiveMetadata).toHaveBeenCalled()
    expect(pushToArchive).toHaveBeenCalledWith(expect.objectContaining({
      datasetId: "ds_1",
      jobId: "job_1",
      artifacts: ["art_1", "art_2"],
      metadata: { archive: true }
    }))
  })

  it("adds thematic service into dedicated thematic subgroup", async () => {
    canAddServiceRefToMap.mockReturnValue(true)
    getJobs.mockResolvedValue({
      success: true,
      data: [
        {
          jobId: "job_1",
          templateId: "tpl_1",
          templateVersion: "1.0",
          datasetId: "ds_1",
          status: "succeeded",
          progress: { percent: 100, stage: "done", message: "", startTime: Date.now() },
          createdAt: Date.now()
        }
      ]
    })
    getJobResult.mockResolvedValue({
      success: true,
      data: {
        jobId: "job_1",
        status: "succeeded",
        artifacts: [],
        serviceRef: {
          type: "xyz",
          serviceId: "svc_1",
          urlTemplate: "https://example.com/{z}/{x}/{y}.png",
          minZoom: 0,
          maxZoom: 18,
          createdAt: Date.now()
        },
        createdAt: Date.now()
      }
    })

    const wrapper = mount(ThematicJobs, {
      props: { datasetId: "ds_1" },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
          transition: false,
          "a-alert": { template: "<div class='a-alert'><slot /></div>" },
          "a-spin": { template: "<div class='a-spin'><slot /></div>" },
          "a-empty": { props: ["description"], template: "<div class='a-empty'>{{ description }}</div>" },
          "a-progress": { template: "<div class='a-progress'></div>" },
          "a-tag": { template: "<span class='a-tag'><slot /></span>" },
          "a-select": { template: "<div class='a-select'><slot /></div>" },
          "a-select-option": { template: "<div class='a-select-option'><slot /></div>" },
          "a-form": { template: "<form class='a-form'><slot /></form>" },
          "a-form-item": { template: "<div class='a-form-item'><slot /></div>" },
          "a-input": { template: "<input />" },
          "mars-button": { emits: ["click"], template: "<button class='mars-btn' :disabled='disabled' @click=\"$emit('click', $event)\"><slot /></button>", props: ["disabled"] },
          "mars-icon": { template: "<span class='mars-icon'></span>" },
          "mars-task-modal": { props: ["open"], template: "<div v-if='open' class='mars-task-modal'><slot /></div>" }
        }
      }
    })

    await flushUi()
    await wrapper.find(".job-item").trigger("click")
    await flushUi()

    const addBtn = findButton("上图")
    expect(addBtn).toBeTruthy()
    addBtn?.click()
    await flushUi()

    expect(canAddServiceRefToMap).toHaveBeenCalled()
    expect(ensureGroupLayer).toHaveBeenCalledWith("myrepo_group_ds_1_results", "数据集成果/ds_1")
    expect(ensureGroupLayer).toHaveBeenCalledWith("myrepo_group_ds_1_results__thematics", "专题图", "myrepo_group_ds_1_results")
    expect(addXyzLayer).toHaveBeenCalledWith(
      "service_layer_1",
      "https://example.com/{z}/{x}/{y}.png",
      expect.objectContaining({ pid: "myrepo_group_ds_1_results__thematics" })
    )
  })

  it("auto loads succeeded retried job into thematic subgroup", async () => {
    canAddServiceRefToMap.mockReturnValue(true)
    getJobs.mockResolvedValue({
      success: true,
      data: [
        {
          jobId: "job_failed",
          templateId: "tpl_1",
          templateVersion: "1.0",
          datasetId: "ds_1",
          status: "failed",
          progress: { percent: 60, stage: "publish", message: "failed", startTime: Date.now() },
          createdAt: Date.now()
        }
      ]
    })
    retryJob.mockResolvedValue({
      success: true,
      data: {
        jobId: "job_retry_ok",
        templateId: "tpl_1",
        templateVersion: "1.0",
        datasetId: "ds_1",
        status: "succeeded",
        progress: { percent: 100, stage: "done", message: "", startTime: Date.now() },
        createdAt: Date.now()
      }
    })
    getJobResult.mockResolvedValue({
      success: true,
      data: {
        jobId: "job_retry_ok",
        status: "succeeded",
        artifacts: [],
        serviceRef: {
          type: "xyz",
          serviceId: "svc_retry",
          urlTemplate: "https://example.com/{z}/{x}/{y}.png"
        },
        createdAt: Date.now()
      }
    })

    const wrapper = mount(ThematicJobs, {
      props: { datasetId: "ds_1" },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
          transition: false,
          "a-alert": { template: "<div class='a-alert'><slot /></div>" },
          "a-spin": { template: "<div class='a-spin'><slot /></div>" },
          "a-empty": { props: ["description"], template: "<div class='a-empty'>{{ description }}</div>" },
          "a-progress": { template: "<div class='a-progress'></div>" },
          "a-tag": { template: "<span class='a-tag'><slot /></span>" },
          "a-select": { template: "<div class='a-select'><slot /></div>" },
          "a-select-option": { template: "<div class='a-select-option'><slot /></div>" },
          "a-form": { template: "<form class='a-form'><slot /></form>" },
          "a-form-item": { template: "<div class='a-form-item'><slot /></div>" },
          "a-input": { template: "<input />" },
          "mars-button": { emits: ["click"], template: "<button class='mars-btn' :disabled='disabled' @click=\"$emit('click', $event)\"><slot /></button>", props: ["disabled"] },
          "mars-icon": { template: "<span class='mars-icon'></span>" },
          "mars-task-modal": { props: ["open"], template: "<div v-if='open' class='mars-task-modal'><slot /></div>" }
        }
      }
    })

    await flushUi()
    const retryBtn = findButton("重试")
    expect(retryBtn).toBeTruthy()
    retryBtn?.click()
    await flushUi()

    expect(retryJob).toHaveBeenCalledWith("job_failed")
    expect(ensureGroupLayer).toHaveBeenCalledWith("myrepo_group_ds_1_results", "数据集成果/ds_1")
    expect(ensureGroupLayer).toHaveBeenCalledWith("myrepo_group_ds_1_results__thematics", "专题图", "myrepo_group_ds_1_results")
    expect(addXyzLayer).toHaveBeenCalledWith(
      "service_layer_1",
      "https://example.com/{z}/{x}/{y}.png",
      expect.objectContaining({ pid: "myrepo_group_ds_1_results__thematics" })
    )
    const ok = messageSpy.mock.calls.some((args) => String(args[0] || "").includes("任务完成，已自动上图"))
    expect(ok).toBe(true)
    wrapper.unmount()
  })
})
