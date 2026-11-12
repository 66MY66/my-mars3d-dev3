import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import RepositoryPublicationActions from "./RepositoryPublicationActions.vue"
import { verifyRepositoryFile, getRepositoryPublicationStatus, requestRepositoryPublication } from "./publication-repository"
import { downloadBlob } from "./export-media"
vi.mock("./publication-repository", () => ({ verifyRepositoryFile: vi.fn(), getRepositoryPublicationStatus: vi.fn(), requestRepositoryPublication: vi.fn() }))
vi.mock("./export-media", () => ({ downloadBlob: vi.fn() }))
let wrapper: VueWrapper
const file = new File(["current"], "current.zip")
const button = (name: string) => wrapper.findAll("button").find(item => item.text() === name)!
function setup(sourceReady = true) {
  wrapper = mount(RepositoryPublicationActions, { props: { file, artifactId: "art_1", datasetId: "ds_1", sourceReady }, global: { stubs: { "mars-button": { template: "<button><slot /></button>" }, "mars-icon": true } } })
}
describe("repository release stages", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    vi.mocked(verifyRepositoryFile).mockResolvedValue({ artifactId: "art_1", file, verifiedAt: "2026-11-01T00:00:00Z", sha256: "abc", url: "/api/eoapi/uploads/artifacts/a.zip" })
    vi.mocked(requestRepositoryPublication).mockResolvedValue({ datasetId: "ds_1", status: "reviewing" })
  })
  afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks() })
  it("blocks approval while a stored file cannot be retrieved and permits verification retry", async () => {
    vi.mocked(verifyRepositoryFile).mockRejectedValueOnce(new Error("HTTP 404"))
    setup(); await flushPromises()
    expect(button("提交公开审核").attributes("disabled")).toBeDefined()
    expect(wrapper.text()).toContain("HTTP 404")
    await button("重新校验文件").trigger("click"); await flushPromises()
    expect(button("提交公开审核").attributes("disabled")).toBeUndefined()
    expect(requestRepositoryPublication).not.toHaveBeenCalled()
  })
  it("requires explicit whole-dataset confirmation and does not equate reviewing with publication", async () => {
    setup(); await flushPromises()
    await button("提交公开审核").trigger("click"); await flushPromises()
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("整个数据集 ds_1"))
    expect(wrapper.text()).toContain("等待后台审核")
    expect(wrapper.text()).not.toContain("后台确认已公开发布")
    expect(button("提交公开审核").attributes("disabled")).toBeDefined()
  })
  it("does not submit after cancellation or when the document version no longer matches", async () => {
    setup(); await flushPromises()
    vi.mocked(window.confirm).mockReturnValueOnce(false)
    await button("提交公开审核").trigger("click"); await flushPromises()
    expect(requestRepositoryPublication).not.toHaveBeenCalled()
    await wrapper.setProps({ sourceReady: false })
    expect(button("提交公开审核").attributes("disabled")).toBeDefined()
    expect(wrapper.text()).toContain("当前图件版本或目标已变化")
  })
  it("downloads freshly retrieved bytes and accepts published only from backend status", async () => {
    setup(); await flushPromises()
    await button("下载已入库成果").trigger("click"); await flushPromises()
    expect(verifyRepositoryFile).toHaveBeenCalledTimes(2)
    expect(downloadBlob).toHaveBeenCalledWith(file, "current.zip")
    vi.mocked(getRepositoryPublicationStatus).mockResolvedValue({ datasetId: "ds_1", status: "published" })
    await button("查询审核状态").trigger("click"); await flushPromises()
    expect(wrapper.text()).toContain("后台确认已公开发布")
  })
})
