import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { webcrypto } from "node:crypto"
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import ResultMapPublicationPanel from "./ResultMapPublicationPanel.vue"
import { loginThematicFlow, getThematicFlow } from "./thematic-backend"
import { prepareResultMap, submitResultMap, queryResultMap, loadPublishedMap } from "./result-map-publication"

vi.mock("./thematic-backend", () => ({ loginThematicFlow: vi.fn(), getThematicFlow: vi.fn() }))
vi.mock("./result-map-publication", async original => ({ ...await original<typeof import("./result-map-publication")>(), prepareResultMap: vi.fn(), submitResultMap: vi.fn(), queryResultMap: vi.fn(), loadPublishedMap: vi.fn() }))
let wrapper: VueWrapper
const input = () => ({ fingerprint: "a".repeat(64), args: {}, snapshot: { version: "mars3d.map-view.v1", title: "后台地图", usage: "internal-reviewed", layers: [{ parts: [{ id: "MAP-00000000-0000-0000-0000-000000000001-1" }] }] } })
const map = () => ({ snapshot: input().snapshot, fingerprint: input().fingerprint, catalogUrl: "http://192.168.10.15:5951/item", layers: [] })
const apply = vi.fn()
const button = (label: string) => wrapper.findAll("button").find(item => item.text() === label)!
function open(formalReady = false) {
  wrapper = mount(ResultMapPublicationPanel, { props: { title: "后台地图", topic: "T30101000", bounds: { west: 103, south: 29, east: 105, north: 31 }, layers: [{ id: "online:boundary", name: "行政区面", role: "boundary", crs: "EPSG:4326", security: "internal", data: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [104, 30] } }] }, onlineSource: { fingerprint: "a".repeat(64), sourceItemSha256: "b".repeat(64), itemId: "backend-admin" } } as any], formalReady, formalMode: formalReady, apply }, global: { stubs: { "mars-icon": true, "mars-button": { template: "<button><slot /></button>" } } } })
}
async function authorize() {
  await wrapper.get('input[type="email"]').setValue("test@example.com")
  await wrapper.get('input[type="password"]').setValue("test-only-password")
  await wrapper.get("form").trigger("submit"); await flushPromises()
}
async function approve() {
  await wrapper.get('[aria-label="内部发布审核人"]').setValue("测试审核人")
  await wrapper.get('[aria-label="内部发布审核意见"]').setValue("仅供内部使用，保留来源限制")
  for (const check of wrapper.findAll('.manual-review input[type="checkbox"]')) { await check.setValue(true) }
  await vi.waitFor(() => expect(button("确认本次审核").attributes("disabled")).toBeUndefined())
  await button("确认本次审核").trigger("click")
  await vi.waitFor(() => expect(wrapper.text()).toContain("本次版本已确认"))
}
async function confirmDispatch() { await wrapper.findAll('input[type="checkbox"]').at(-1)!.setValue(true) }
async function submit() { await approve(); await confirmDispatch(); await button("发布内部审核地图").trigger("click"); await flushPromises() }
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("crypto", webcrypto); sessionStorage.clear(); vi.spyOn(window, "confirm").mockReturnValue(true)
  vi.mocked(loginThematicFlow).mockResolvedValue("memory-only-token")
  vi.mocked(getThematicFlow).mockResolvedValue({ path: "u/fyt/earth/result_flow", summary: "汇交" })
  vi.mocked(prepareResultMap).mockResolvedValue(input() as any)
  vi.mocked(submitResultMap).mockResolvedValue("00000000-0000-0000-0000-000000000001")
  vi.mocked(queryResultMap).mockResolvedValue({ state: "verified", map: map() } as any)
  vi.mocked(loadPublishedMap).mockResolvedValue(map() as any)
  apply.mockResolvedValue(undefined)
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("operator result-flow publication controls", () => {
  it("keeps review actionable and explains missing input instead of silently disabling it", async () => {
    open(); await flushPromises()
    expect(button("确认本次审核").attributes("disabled")).toBeUndefined()
    expect(wrapper.text()).toContain("审核待办：填写审核人；填写审核意见；完成 5 项确认")
    expect(wrapper.text()).toContain("发布待办：连接汇交服务；确认本次人工审核；确认新编号汇交")
    await button("确认本次审核").trigger("click"); await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain("请填写实际审核人")
    expect(wrapper.get('[role="alert"]').text()).toContain("五项人工审核")
    expect(prepareResultMap).not.toHaveBeenCalled()
  })
  it("does not let explicit technical failures be bypassed by clicking the review button", async () => {
    open(); await wrapper.setProps({ viewError: "源文件 HTTP 404" })
    await wrapper.get('[aria-label="内部发布审核人"]').setValue("审核人")
    await wrapper.get('[aria-label="内部发布审核意见"]').setValue("检查失败不得发布")
    for (const check of wrapper.findAll('.manual-review input[type="checkbox"]')) { await check.setValue(true) }
    await button("确认本次审核").trigger("click"); await flushPromises()
    expect(wrapper.text()).not.toContain("本次版本已确认")
    expect(wrapper.get('[role="alert"]').text()).toContain("HTTP 404")
    expect(button("发布内部审核地图").attributes("disabled")).toBeDefined()
  })
  it("keeps credentials in memory and clears the password after authorization", async () => {
    open(); await authorize()
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
    expect(wrapper.text()).toContain("汇交服务已授权")
    expect(sessionStorage.getItem("thematic-result-flow-receipt-v1")).toBeNull()
    expect(button("发布内部审核地图").attributes("disabled")).toBeDefined()
  })
  it("publishes only an explicitly human-reviewed internal map without weakening formal document checks", async () => {
    open(); await authorize(); await submit()
    expect(prepareResultMap).toHaveBeenCalledWith(expect.objectContaining({ formal: false, internalReview: expect.objectContaining({ reviewer: "测试审核人", scope: "internal" }) }), expect.any(AbortSignal))
    expect(wrapper.text()).toContain("后台已接收任务")
    expect(wrapper.text()).not.toContain("已从后台重新读取并在 Mars3D 加载")
    expect(button("发布内部审核地图").attributes("disabled")).toBeDefined()
    const receipt = sessionStorage.getItem("thematic-result-flow-receipt-v1")!
    expect(receipt).not.toContain("memory-only-token"); expect(receipt).not.toContain("test-only-password")
  })
  it("does not promote a readiness flag to formal publication without the actual reviewed bundle", async () => {
    open(true); await authorize()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await button("汇交规范图层").trigger("click"); await flushPromises()
    expect(wrapper.text()).toContain("本次复核数据")
    expect(prepareResultMap).not.toHaveBeenCalled(); expect(submitResultMap).not.toHaveBeenCalled()
  })
  it("rejects a formal document revision change during review preparation", async () => {
    let finish!: (value: any) => void
    const prepareFormal = vi.fn(() => new Promise<any>(resolve => { finish = resolve }))
    open(true); await wrapper.setProps({ documentRevision: 1, prepareFormal }); await authorize()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await button("汇交规范图层").trigger("click")
    await wrapper.setProps({ documentRevision: 2 }); finish({}); await flushPromises()
    expect(wrapper.text()).toContain("已停止提交")
    expect(prepareResultMap).not.toHaveBeenCalled(); expect(submitResultMap).not.toHaveBeenCalled()
  })
  it("does not submit a changed source after asynchronous preparation", async () => {
    let finish!: (value: any) => void
    vi.mocked(prepareResultMap).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    open(); await authorize(); await approve(); await confirmDispatch()
    await button("发布内部审核地图").trigger("click")
    await wrapper.setProps({ title: "已变化" }); finish(input()); await flushPromises()
    expect(submitResultMap).not.toHaveBeenCalled(); expect(wrapper.text()).toContain("已停止提交")
  })
  it("blocks uncertain network dispatches rather than repeating a write", async () => {
    vi.mocked(submitResultMap).mockImplementationOnce(async (_token, _input, _check, _signal, dispatched) => { dispatched!(); throw new Error("connection lost") })
    open(); await authorize(); await submit()
    expect(wrapper.text()).toContain("提交结果未确认")
    expect(button("发布内部审核地图").attributes("disabled")).toBeDefined()
    expect(submitResultMap).toHaveBeenCalledOnce()
    expect(JSON.parse(sessionStorage.getItem("thematic-result-flow-receipt-v1")!).uncertain).toBe(true)
  })
  it("does not call a completed job or failed file check a usable map", async () => {
    vi.mocked(queryResultMap).mockRejectedValueOnce(Object.assign(new Error("HTTP 404"), { jobCompleted: true }))
    open(); await authorize(); await submit()
    await button("查询并校验成果").trigger("click"); await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain("HTTP 404")
    expect(button("从后台重新加载")).toBeUndefined()
    expect(button("开始新版本")).toBeDefined()
    expect(apply).not.toHaveBeenCalled()
  })
  it("rereads the published map before native loading and invalidates a subsequent native failure", async () => {
    open(); await authorize(); await submit()
    await button("查询并校验成果").trigger("click"); await flushPromises()
    expect(wrapper.text()).toContain("尚需重新加载查看")
    await button("从后台重新加载").trigger("click"); await flushPromises()
    expect(loadPublishedMap).toHaveBeenCalled(); expect(apply).toHaveBeenCalledWith(map())
    expect(wrapper.text()).toContain("审核记录随地图保存")
    await wrapper.setProps({ viewError: "瓦片读取失败" })
    expect(wrapper.text()).toContain("不能确认在线可用")
    expect(button("从后台重新加载")).toBeUndefined()
  })
  it("restores a backend map without a local data fallback or an authenticated write", async () => {
    open(); await wrapper.get('input[placeholder="MAP-…-1"]').setValue(input().snapshot.layers[0].parts[0].id)
    await button("读取并加载").trigger("click"); await flushPromises()
    expect(loadPublishedMap).toHaveBeenCalledOnce(); expect(apply).toHaveBeenCalledOnce()
    expect(submitResultMap).not.toHaveBeenCalled(); expect(loginThematicFlow).not.toHaveBeenCalled()
  })
  it("shows a restored review read-only without approving the current operator's version", async () => {
    const published = map()
    Object.assign(published.snapshot, { internalReview: { reviewer: "已发布版本审核人", notes: "历史版本审核意见", reviewedAt: "2026-11-02T08:00:00Z" } })
    vi.mocked(loadPublishedMap).mockResolvedValueOnce(published as any)
    open(); await wrapper.get('input[placeholder="MAP-…-1"]').setValue(input().snapshot.layers[0].parts[0].id)
    await button("读取并加载").trigger("click"); await flushPromises()
    expect(wrapper.text()).toContain("已发布版本的审核记录（只读）")
    expect(wrapper.text()).toContain("历史版本审核意见")
    expect(wrapper.text()).not.toContain("本次版本已确认")
    expect(button("发布内部审核地图").attributes("disabled")).toBeDefined()
  })
  it("allows a new isolated version only after a terminal verified task", async () => {
    open(); await authorize(); await submit()
    expect(button("开始新版本")).toBeUndefined()
    await button("查询并校验成果").trigger("click"); await flushPromises()
    await button("开始新版本").trigger("click")
    await confirmDispatch()
    expect(button("发布内部审核地图").attributes("disabled")).toBeUndefined()
  })
  it("shows enabled human-review controls for backend reference data and invalidates changed review opinions", async () => {
    open(); await authorize()
    expect(wrapper.findAll('.manual-review input[type="checkbox"]')).toHaveLength(5)
    expect(wrapper.findAll('.manual-review input[type="checkbox"]').every(check => check.attributes("disabled") === undefined)).toBe(true)
    await approve(); await confirmDispatch()
    expect(button("发布内部审核地图").attributes("disabled")).toBeUndefined()
    await wrapper.get('[aria-label="内部发布审核意见"]').setValue("修改审核意见")
    expect(wrapper.text()).toContain("重新确认本次审核")
    expect(button("发布内部审核地图").attributes("disabled")).toBeDefined()
  })
  it("does not approve stale human input changed while its map fingerprint is being calculated", async () => {
    open(); await authorize(); await approve()
    await wrapper.get('[aria-label="内部发布审核意见"]').setValue("重新审核")
    const digest = webcrypto.subtle.digest.bind(webcrypto.subtle)
    let finish!: () => Promise<void>
    vi.spyOn(webcrypto.subtle, "digest").mockImplementationOnce((algorithm, data) => new Promise(resolve => {
      finish = async () => { resolve(await digest(algorithm, data)) }
    }))
    await button("确认本次审核").trigger("click")
    await wrapper.get('[aria-label="内部发布审核意见"]').setValue("计算期间修改的审核意见")
    await finish(); await flushPromises()
    expect(wrapper.text()).toContain("审核内容已变化")
    expect(wrapper.text()).not.toContain("本次版本已确认")
    expect(button("发布内部审核地图").attributes("disabled")).toBeDefined()
  })
})
