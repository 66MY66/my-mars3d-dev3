import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import StandardPublicationPanel from "./StandardPublicationPanel.vue"
import { createStandardPublicationArchive, uploadStandardPublicationArchive } from "./standard-publication-delivery"
import { downloadBlob } from "./export-media"
import type { StandardPublicationBundle, StandardPublicationState } from "./standard-publication"

vi.mock("./standard-publication-delivery", () => ({
  createStandardPublicationArchive: vi.fn(),
  uploadStandardPublicationArchive: vi.fn()
}))
vi.mock("./export-media", () => ({ downloadBlob: vi.fn() }))

const state = (): StandardPublicationState => ({
  templateId: "T30101000",
  revision: 1,
  name: "基本情况专题图",
  title: "组件测试图件",
  code: "T30101006",
  preview: "",
  usage: "operational",
  status: "",
  error: "",
  hasDocument: true,
  busy: false,
  ready: true,
  format: "pdf",
  dpi: 300,
  blockers: [],
  issues: [],
  reviewCount: 5,
  reviewTotal: 5
})

function deferred<T>() {
  let complete!: (value: T) => void
  const promise = new Promise<T>(resolve => { complete = resolve })
  return { promise, resolve: complete }
}

let wrapper: VueWrapper
const prepare = vi.fn()
function setup(overrides: Partial<StandardPublicationState> = {}) {
  wrapper = mount(StandardPublicationPanel, {
    props: { state: { ...state(), ...overrides }, datasetId: "ds_1", prepare },
    global: {
      stubs: {
        RepositoryPublicationActions: true,
        "mars-button": { template: "<button><slot /></button>" },
        "mars-icon": true,
        "a-select": { template: "<select><slot /></select>" },
        "a-select-option": { template: "<option><slot /></option>" },
        "a-input": { props: ["value"], template: "<input :value='value' @input=\"$emit('update:value', $event.target.value)\" />" },
        "a-textarea": { props: ["value"], template: "<textarea :value='value' @input=\"$emit('update:value', $event.target.value)\" />" }
      }
    }
  })
  return wrapper
}
const button = (text: string) => wrapper.findAll("button").find(item => item.text() === text)!
const describePublication = () => wrapper.get('[aria-label="规范发布描述"]').setValue("组件测试发布描述")

describe("standard publication panel delivery", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Rendering/inspection are covered separately; this suite isolates delivery UI state.
    prepare.mockResolvedValue({} as StandardPublicationBundle)
    vi.mocked(createStandardPublicationArchive).mockResolvedValue(new File(["zip"], "map.zip"))
    vi.mocked(uploadStandardPublicationArchive).mockResolvedValue({ artifactId: "art_1", url: "/artifacts/art_1" } as any)
  })
  afterEach(() => wrapper?.unmount())

  it("disables formal delivery for unreviewed documents while preserving proof export", async () => {
    setup({ ready: false, usage: "test", blockers: ["仅可导出校样"] })
    expect(button("上传到成果库").attributes("disabled")).toBeDefined()
    expect(button("下载发布包").attributes("disabled")).toBeDefined()
    await button("导出校样").trigger("click")
    expect(wrapper.emitted("export")).toEqual([[false]])
    expect(prepare).not.toHaveBeenCalled()
  })

  it("downloads the package without claiming a remote publication", async () => {
    setup()
    await button("下载发布包").trigger("click")
    await flushPromises()
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(File), "map.zip")
    expect(uploadStandardPublicationArchive).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain("尚未上传至成果库")
  })

  it("validates targets and descriptions before preparing a package", async () => {
    setup()
    await wrapper.get('[aria-label="规范发布目标数据集"]').setValue("")
    await button("上传到成果库").trigger("click")
    expect(wrapper.text()).toContain("请填写成果库中的目标数据集 ID")
    await wrapper.get('[aria-label="规范发布目标数据集"]').setValue("ds_1")
    await button("上传到成果库").trigger("click")
    expect(wrapper.text()).toContain("至少")
    expect(prepare).not.toHaveBeenCalled()
  })

  it("prevents repeated submissions during upload and after the confirmed receipt", async () => {
    const pending = deferred<any>()
    vi.mocked(uploadStandardPublicationArchive).mockReturnValueOnce(pending.promise)
    setup()
    await describePublication()
    await button("上传到成果库").trigger("click")
    await flushPromises()
    expect(button("上传到成果库").attributes("disabled")).toBeDefined()
    await button("上传到成果库").trigger("click")
    expect(uploadStandardPublicationArchive).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).not.toContain("成果编号")
    pending.resolve({ artifactId: "art_1" })
    await flushPromises()
    expect(wrapper.text()).toContain("成果编号 art_1")
    expect(wrapper.text()).toContain("数据集公开权限未改变")
    await button("上传到成果库").trigger("click")
    await flushPromises()
    expect(uploadStandardPublicationArchive).toHaveBeenCalledTimes(1)
  })

  it("retries failed uploads without claiming success or rebuilding unchanged files", async () => {
    vi.mocked(uploadStandardPublicationArchive).mockRejectedValueOnce(new Error("VPN disconnected"))
    setup()
    await describePublication()
    await button("上传到成果库").trigger("click")
    await flushPromises()
    expect(wrapper.text()).toContain("未确认上传成功")
    expect(wrapper.get('[role="alert"]').text()).toBe("VPN disconnected")
    await button("上传到成果库").trigger("click")
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain("成果编号 art_1")
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(uploadStandardPublicationArchive).toHaveBeenCalledTimes(2)
  })

  it("rejects packages whose source changed while preparing them", async () => {
    const pending = deferred<File>()
    vi.mocked(createStandardPublicationArchive).mockReturnValueOnce(pending.promise)
    setup()
    await describePublication()
    await button("上传到成果库").trigger("click")
    await flushPromises()
    await wrapper.setProps({ state: { ...state(), revision: 2 } })
    pending.resolve(new File(["zip"], "stale.zip"))
    await flushPromises()
    expect(uploadStandardPublicationArchive).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain("图件已变化")
  })

  it("identifies the submitted version if the source changes during network upload", async () => {
    const pending = deferred<any>()
    vi.mocked(uploadStandardPublicationArchive).mockReturnValueOnce(pending.promise)
    setup()
    await describePublication()
    await button("上传到成果库").trigger("click")
    await flushPromises()
    await wrapper.setProps({ state: { ...state(), revision: 2 } })
    pending.resolve({ artifactId: "art_1" })
    await flushPromises()
    expect(wrapper.text()).toContain("上传的是提交时的版本，当前图件已有修改")
    await button("上传到成果库").trigger("click")
    await flushPromises()
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(uploadStandardPublicationArchive).toHaveBeenCalledTimes(2)
  })
  it("does not reuse a verified previous artifact for another target or a busy document", async () => {
    setup(); await describePublication()
    await button("上传到成果库").trigger("click"); await flushPromises()
    const actions = wrapper.findComponent({ name: "RepositoryPublicationActions" })
    expect(actions.props("sourceReady")).toBe(true)
    await wrapper.setProps({ state: { ...state(), busy: true } })
    expect(actions.props("sourceReady")).toBe(false)
    await wrapper.setProps({ state: state() })
    await wrapper.get('[aria-label="规范发布目标数据集"]').setValue("ds_other")
    expect(actions.props("sourceReady")).toBe(false)
  })

  it("keeps repository upload separate from online map production", () => {
    setup()
    expect(wrapper.text()).toContain("成果库归档与文件校验")
    expect(wrapper.text()).not.toContain("服务模板")
    expect(wrapper.text()).not.toContain("提交在线发布任务")
  })
})
