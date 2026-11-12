import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { webcrypto } from "node:crypto"
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import HostPublicationPanel from "./HostPublicationPanel.vue"
import { THEMATIC_PUBLICATION_HOST, type ThematicPublicationHost } from "./publication-host"
import { createPublicationPackage, validatePublicationSources } from "./publication-package"
import { downloadBlob } from "./export-media"
vi.mock("./publication-package", () => ({ createPublicationPackage: vi.fn(), validatePublicationSources: vi.fn() }))
vi.mock("./export-media", () => ({ downloadBlob: vi.fn() }))

let wrapper: VueWrapper
const prepareView = vi.fn()
const prepared = () => ({ manifest: { id: "THEMATIC-test-id", title: "后台地图", topic: "choropleth" }, file: new File(["zip"], "专题图-发布包.zip"), sha256: "a".repeat(64) }) as any
const button = (text: string) => wrapper.findAll("button").find(entry => entry.text() === text)!
function open(host?: ThematicPublicationHost, extra = {}) {
  wrapper = mount(HostPublicationPanel, { props: { title: "后台地图", topic: "choropleth", bounds: { west: 103, south: 29, east: 105, north: 31 }, layers: [{ id: "online:business", name: "业务数据", role: "business", crs: "EPSG:4326", security: "internal", data: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [104, 30] } }] }, onlineSource: { fingerprint: "a".repeat(64), sourceItemSha256: "b".repeat(64), itemId: "actual-source" } } as any], formalReady: false, presentationKey: "layout-v1", prepareView, ...extra }, global: { provide: host ? { [THEMATIC_PUBLICATION_HOST as symbol]: host } : {}, stubs: { "mars-icon": true, "mars-button": { template: "<button><slot /></button>" } } } })
}
async function approve() {
  await wrapper.get('[aria-label="内部发布审核人"]').setValue("前端回归测试")
  await wrapper.get('[aria-label="内部发布审核意见"]').setValue("仅用于测试发布能力，不提交真实平台")
  for (const check of wrapper.findAll('.manual-review input[type="checkbox"]')) { await check.setValue(true) }
  await button("确认本次审核").trigger("click")
  await vi.waitFor(() => expect(wrapper.text()).toContain("本次版本已确认"))
}
async function submit() { await wrapper.get("label.check:not(.manual-review .check) input").setValue(true); await button("发布专题图").trigger("click"); await flushPromises() }
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("crypto", webcrypto); vi.stubGlobal("fetch", vi.fn()); vi.spyOn(window, "confirm").mockReturnValue(true)
  vi.mocked(createPublicationPackage).mockResolvedValue(prepared())
  vi.mocked(validatePublicationSources).mockResolvedValue(undefined)
  prepareView.mockResolvedValue({ file: new File(["png"], "composition.png", { type: "image/png" }), layout: { version: 1 } })
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("host-owned publication with no Windmill dependency", () => {
  it("retains publication and review controls without asking for workflow credentials", async () => {
    open(); await flushPromises()
    expect(wrapper.text()).not.toMatch(/Windmill|汇交服务|账号|密码/)
    expect(wrapper.text()).toContain("目标平台待对接")
    expect(button("确认本次审核").attributes("disabled")).toBeUndefined()
    expect(button("发布专题图").attributes("disabled")).toBeDefined()
    await button("确认本次审核").trigger("click"); await flushPromises()
    expect(wrapper.text()).toContain("请填写实际审核人")
  })
  it("downloads a reviewed package without calling any publishing service or faking success", async () => {
    open(); await approve()
    await button("下载发布包").trigger("click"); await flushPromises()
    expect(createPublicationPackage).toHaveBeenCalledOnce()
    expect(downloadBlob).toHaveBeenCalledWith(prepared().file, "专题图-发布包.zip")
    expect(wrapper.text()).toContain("尚未提交目标平台")
    expect(wrapper.text()).not.toContain("已确认发布")
    expect(fetch).not.toHaveBeenCalled()
  })
  it("publishes using only the injected platform adapter and prevents duplicate submission", async () => {
    const publish = vi.fn(async () => ({ status: "published" as const, publicationId: "portal-map-1", packageSha256: prepared().sha256, url: "https://portal.example/maps/1" }))
    const openPublished = vi.fn()
    open({ name: "目标业务平台", publish, openPublished }); await approve(); await submit()
    expect(publish).toHaveBeenCalledOnce()
    expect(openPublished).toHaveBeenCalledWith(expect.objectContaining({ status: "published", publicationId: "portal-map-1" }))
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "THEMATIC-test-id", archive: prepared().file }))
    expect(wrapper.text()).toContain("目标平台已确认本次专题图发布")
    expect(wrapper.get("a").attributes("href")).toBe("https://portal.example/maps/1")
    expect(button("发布专题图").attributes("disabled")).toBeDefined()
    expect(fetch).not.toHaveBeenCalled()
  })
  it("does not turn a submission acknowledgment into published success", async () => {
    const openPublished = vi.fn()
    open({ name: "目标业务平台", openPublished, publish: async () => ({ status: "submitted", publicationId: "job-1", packageSha256: prepared().sha256 }) }); await approve(); await submit()
    expect(openPublished).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain("尚未确认发布完成")
    expect(wrapper.text()).not.toContain("目标平台已确认本次专题图发布")
  })
  it("invalidates human review when layout changes and rejects view failures", async () => {
    open(); await approve(); await wrapper.setProps({ presentationKey: "layout-v2" })
    expect(wrapper.text()).toContain("重新确认本次审核")
    expect(button("下载发布包").attributes("disabled")).toBeDefined()
    await wrapper.setProps({ viewError: "实际地图加载失败" }); await approve().catch(() => undefined)
    expect(wrapper.text()).toContain("实际地图加载失败")
  })
  it("reuses the downloaded package but rechecks backend revisions before submission", async () => {
    const publish = vi.fn(async () => ({ status: "published" as const, publicationId: "id", packageSha256: prepared().sha256, url: "https://portal.example/maps/1" }))
    open({ name: "目标平台", publish }); await approve()
    await button("下载发布包").trigger("click"); await flushPromises()
    await submit()
    expect(createPublicationPackage).toHaveBeenCalledOnce()
    expect(validatePublicationSources).toHaveBeenCalledOnce()
    expect(publish).toHaveBeenCalledOnce()
  })
  it("blocks source changes during asynchronous packaging and unconfirmed network retries", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("网络断开"))
    open({ name: "目标平台", publish }); await approve(); await submit()
    expect(wrapper.text()).toContain("提交状态未确认")
    expect(button("发布专题图").attributes("disabled")).toBeDefined()
    expect(publish).toHaveBeenCalledOnce()
  })
  it("never dispatches a package prepared for a source that changed in the meantime", async () => {
    let finish!: (value: any) => void
    vi.mocked(createPublicationPackage).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const publish = vi.fn()
    open({ name: "目标平台", publish }); await approve()
    await wrapper.get("label.check:not(.manual-review .check) input").setValue(true)
    await button("发布专题图").trigger("click"); await flushPromises()
    await wrapper.setProps({ title: "已改变的图件" }); finish(prepared()); await flushPromises()
    expect(publish).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain("已停止提交")
  })
  it("does not promote a formal readiness flag without the reviewed document", async () => {
    open(undefined, { formalMode: true, formalReady: true })
    await button("下载发布包").trigger("click"); await flushPromises()
    expect(wrapper.text()).toContain("本次复核数据")
    expect(createPublicationPackage).not.toHaveBeenCalled()
  })
})
