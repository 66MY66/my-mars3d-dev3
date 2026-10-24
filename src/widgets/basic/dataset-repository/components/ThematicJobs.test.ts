import { mount, shallowMount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import { cartographySettings, cartographySnapshot } from "../../thematic-workbench/cartography-state"

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
const getArchiveStatus = vi.fn()
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
  getArchiveStatus,
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
  resolveServiceRefUrl: () => "https://example.com/{z}/{x}/{y}.png",
  resolveServiceRefType: (ref: any) => ref.type
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
    getArchiveStatus.mockResolvedValue({ success: true, data: { archiveId: "a1", status: "completed" } })
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

  it("renders the task toolbar as live DOM and opens the publication dialog from the workbench", async () => {
    getJobs.mockResolvedValue({ success: true, data: [] })
    getTemplates.mockResolvedValue({ success: true, data: { templates: [{ templateId: "raster", name: "栅格色带" }] } })
    const wrapper = shallowMount(ThematicJobs, { props: { datasetId: "dataset_1", publishDescription: "发布测试一下" } })
    await flushUi()
    expect(wrapper.find(".jobs-header").exists()).toBe(true)
    expect(wrapper.find("template").exists()).toBe(false)
    cartographySettings.scaleDenominator = 50000
    ;(wrapper.vm as any).openPublishDialog("raster")
    const state = (wrapper.vm as any).$.setupState
    expect(state.showCreateDialog).toBe(true)
    expect(state.createForm).toMatchObject({ templateId: "raster", datasetId: "dataset_1", description: "发布测试一下", shouldPublish: true })
    expect(createJob).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it("blocks the publication entry for short descriptions, missing scale and unavailable service", async () => {
    getJobs.mockResolvedValue({ success: true, data: [] })
    const wrapper = shallowMount(ThematicJobs, { props: { publishDescription: "不足五字" } })
    await flushUi()
    const state = (wrapper.vm as any).$.setupState
    cartographySettings.scaleDenominator = 50000
    ;(wrapper.vm as any).openPublishDialog()
    expect(state.showCreateDialog).toBe(false)
    expect(messageSpy).toHaveBeenLastCalledWith("发布描述至少需要 5 个有效字符，空白不计入字数")
    await wrapper.setProps({ publishDescription: "发布测试一下" })
    cartographySettings.scaleDenominator = null
    ;(wrapper.vm as any).openPublishDialog()
    expect(state.showCreateDialog).toBe(false)
    cartographySettings.scaleDenominator = 50000
    state.apiAvailable = false
    ;(wrapper.vm as any).openPublishDialog()
    expect(state.showCreateDialog).toBe(false)
    expect(messageSpy).toHaveBeenLastCalledWith("专题图服务暂未启用，暂时无法发布")
    expect(createJob).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it("validates publication description before creating a task and inherits the workbench description", async () => {
    getJobs.mockResolvedValue({ success: true, data: [] })
    createJob.mockResolvedValue({ success: false, message: "test response" })
    const wrapper = shallowMount(ThematicJobs, { props: { publishDescription: "震后风险图" } })
    await flushUi()
    const state = (wrapper.vm as any).$.setupState
    state.handleCreateJob()
    expect(state.createForm.description).toBe("震后风险图")
    state.createForm.templateId = "earthquake_test"
    state.createForm.description = "震后风险"
    await state.handleSubmitCreate()
    expect(createJob).not.toHaveBeenCalled()
    expect(state.publishDescriptionInvalid).toBe(true)
    state.createForm.description = "震后风险图"
    cartographySettings.scaleDenominator = null
    await state.handleSubmitCreate()
    expect(createJob).not.toHaveBeenCalled()
    expect(state.publishScaleInvalid).toBe(true)
    cartographySettings.scaleDenominator = 50000
    await state.handleSubmitCreate()
    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({ publish: expect.objectContaining({ type: "xyz", description: "震后风险图" }) }))
    const submitted = createJob.mock.calls[0][0]
    expect(submitted.parameters.cartography).toEqual(submitted.publish.metadata.cartography)
    cartographySettings.elements.title.color = "#112233"
    expect(submitted.parameters.cartography.settings.elements.title.color).not.toBe("#112233")
    createJob.mockClear()
    state.createForm.shouldPublish = false
    state.createForm.description = ""
    await state.handleSubmitCreate()
    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({ publish: undefined }))
    wrapper.unmount()
  })

  it("archives the job cartography snapshot instead of the current edited settings", async () => {
    getJobs.mockResolvedValue({ success: true, data: [] })
    const wrapper = shallowMount(ThematicJobs)
    await flushUi()
    cartographySettings.title = "发布时的标题"
    cartographySettings.scaleDenominator = 100000
    const snapshot = cartographySnapshot()
    cartographySettings.title = "后续编辑的标题"
    cartographySettings.scaleDenominator = 250000
    await (wrapper.vm as any).$.setupState.handlePushToArchive({ jobId: "job_snapshot", datasetId: "dataset_snapshot", parameters: { cartography: snapshot } })
    expect(pushToArchive).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ cartography: snapshot, annotations: snapshot.symbols, effects3D: snapshot.effects }) }))
    expect(pushToArchive.mock.calls[0][0].metadata.cartography.settings.title).toBe("发布时的标题")
    wrapper.unmount()
  })

  it.each(["xyz", "mvt", "wms", "wmts"])("submits %s with all three qualities and consistent 2D metadata", async (type) => {
    getJobs.mockResolvedValue({ success: true, data: [] })
    createJob.mockResolvedValue({ success: false, message: "fixture" })
    const wrapper = shallowMount(ThematicJobs)
    await flushUi()
    const state = (wrapper.vm as any).$.setupState
    cartographySettings.scaleDenominator = 50000
    state.createForm.templateId = "raster"
    state.createForm.description = "发布数据说明"
    state.createForm.publishName = "地震专题服务"
    state.createForm.publishType = type
    for (const [quality, width] of [["standard", 1280], ["high", 2560], ["print", 3840]]) {
      state.createForm.qualityPreset = quality
      await state.handleSubmitCreate()
      const request = createJob.mock.lastCall![0]
      expect(request.publish).toMatchObject({ type, name: "地震专题服务", description: "发布数据说明", metadata: { dimensions: 2, description: "发布数据说明" } })
      expect(request.parameters).toMatchObject({ qualityPreset: quality, outputWidth: width, prefer2D: true, serviceDimensions: 2 })
      expect(request.parameters.cartography).toEqual(request.publish.metadata.cartography)
    }
    wrapper.unmount()
  })

  it("polls archive completion, prevents duplicate pushes and permits failed archive retry", async () => {
    getJobs.mockResolvedValue({ success: true, data: [] })
    const wrapper = shallowMount(ThematicJobs)
    await flushUi()
    const state = (wrapper.vm as any).$.setupState
    const job = { jobId: "job_1", datasetId: "ds_1", status: "succeeded", progress: { stage: "done" } }
    state.selectedJobId = job.jobId
    state.jobResult = (await getJobResult()).data
    await state.handlePushToArchive(job)
    expect(state.jobSteps(job)[4].state).toBe("active")
    await state.handlePushToArchive(job)
    expect(pushToArchive).toHaveBeenCalledTimes(1)
    getArchiveStatus.mockResolvedValueOnce({ success: true, data: { archiveId: "a1", status: "failed" } })
    await state.pollArchives()
    expect(state.jobSteps(job)[4].state).toBe("error")
    await state.handlePushToArchive(job)
    expect(pushToArchive).toHaveBeenCalledTimes(2)
    await state.pollArchives()
    expect(state.jobSteps(job)[4].state).toBe("done")
    expect(state.jobResult.archiveRef.status).toBe("completed")
    wrapper.unmount()
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
