import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import RemoteCartographySources from "./RemoteCartographySources.vue"
import * as mapWork from "./map"

vi.mock("./map", () => ({ getLockedSelection: vi.fn(() => null), clearRemoteReference: vi.fn(), showRemoteReference: vi.fn().mockResolvedValue(undefined), flyToRemoteReference: vi.fn(), pickRemoteReferencePoint: vi.fn() }))
const pop = { type: "Feature", id: "SP-luding-pop2020", collection: "spatial-thematic", bbox: [100, 28, 104, 32], properties: { title: "泸定人口", "grid:year": 2020, "proj:epsg": 4326 }, assets: { data: { href: "http://192.168.10.15:9002/rs-products/pop.tif", type: "image/tiff", title: "人口数值" } } }
const gdp = { ...pop, id: "SP-luding-gdp2020", properties: { ...pop.properties, title: "泸定GDP" } }
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } })
let wrapper: VueWrapper | undefined
let fetcher: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks()
  fetcher = vi.fn(async (url: string) => {
    if (url.includes("/collections?")) { return json({ collections: [{ id: "spatial-thematic", title: "空间专题" }] }) }
    if (url.endsWith("/search")) { return json({ type: "FeatureCollection", features: [pop, gdp] }) }
    if (url.includes("tilejson")) { return json({ scheme: "xyz", minzoom: 0, maxzoom: 24, bounds: pop.bbox, tiles: [`http://192.168.10.15:5952/collections/spatial-thematic/items/SP-luding-pop2020/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?${new URL(url, window.location.origin).searchParams}`] }) }
    if (url.includes("/point/")) { return json({ values: [0], band_names: ["data_b1"] }) }
    return json(pop)
  })
  vi.stubGlobal("fetch", fetcher)
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals() })
async function open() {
  wrapper = mount(RemoteCartographySources, { props: { active: true }, global: { stubs: { "mars-icon": true } } })
  ;(wrapper.element as HTMLDetailsElement).open = true
  await wrapper.trigger("toggle"); await flushPromises()
  return wrapper
}
async function load(current: VueWrapper) { await current.findAll("button").find(b => b.text().includes("加载参考图层"))!.trigger("click"); await flushPromises() }

describe("online cartography source workflow", () => {
  it("loads only on opening the directory and uses real query/asset results", async () => {
    wrapper = mount(RemoteCartographySources, { props: { active: true }, global: { stubs: { "mars-icon": true } } })
    expect(fetcher).not.toHaveBeenCalled(); wrapper.unmount()
    const current = await open()
    expect(current.get('select[aria-label="在线数据条目"]').findAll("option")).toHaveLength(2)
    await load(current)
    expect(mapWork.showRemoteReference).toHaveBeenCalledOnce()
    expect(current.text()).toContain("数据参考，非正式成果")
    expect(current.text()).toContain("2020 年")
  })
  it("uses zero as a real point value and rejects outside points without a request", async () => {
    const current = await open(); await load(current)
    await current.findAll("button").find(b => b.text().includes("读取点位数值"))!.trigger("click"); await flushPromises()
    expect(current.get('output[aria-label="在线点查数值"]').text()).toBe("0")
    await current.get('input[aria-label="在线点查经度"]').setValue(130)
    const before = fetcher.mock.calls.length
    await current.findAll("button").find(b => b.text().includes("读取点位数值"))!.trigger("click"); await flushPromises()
    expect(fetcher).toHaveBeenCalledTimes(before)
    expect(current.text()).toContain("不在数据覆盖范围")
    expect(current.find('output[aria-label="在线点查数值"]').exists()).toBe(false)
  })
  it("clears the old layer and point result when the item or display parameters change", async () => {
    const current = await open(); await load(current)
    vi.mocked(mapWork.clearRemoteReference).mockClear()
    await current.get('input[aria-label="在线显示上限"]').setValue(6000)
    expect(mapWork.clearRemoteReference).toHaveBeenCalled()
    expect(current.text()).not.toContain("数据参考，非正式成果")
    await current.get('select[aria-label="在线数据条目"]').setValue("SP-luding-gdp2020")
    expect(current.text()).not.toContain("参考图层已加入地图")
  })
  it("does not silently query the whole world when selection-only has no locked bounds", async () => {
    const current = await open()
    await current.get('input[type="checkbox"]').setValue(true)
    fetcher.mockClear()
    await current.findAll("button").find(b => b.text().includes("查询数据"))!.trigger("click"); await flushPromises()
    expect(fetcher).not.toHaveBeenCalled(); expect(current.text()).toContain("框选并锁定")
  })
  it("cleans map layers and click subscriptions on close and unmount", async () => {
    const current = await open(); await load(current)
    await current.findAll('input[type="checkbox"]')[1].setValue(true)
    expect(vi.mocked(mapWork.pickRemoteReferencePoint).mock.calls.some(call => typeof call[0] === "function")).toBe(true)
    await current.setProps({ active: false })
    expect(vi.mocked(mapWork.pickRemoteReferencePoint).mock.lastCall?.[0]).toBeUndefined()
    expect(mapWork.clearRemoteReference).toHaveBeenCalled()
    expect(current.text()).not.toContain("参考图层已加入地图")
    vi.mocked(mapWork.clearRemoteReference).mockClear(); current.unmount(); wrapper = undefined
    expect(mapWork.clearRemoteReference).toHaveBeenCalledOnce()
  })
  it("ignores a stale catalog response after closing the workbench", async () => {
    let release!: (value: Response) => void
    fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve }))
    const current = await open()
    const signal = fetcher.mock.calls[0][1].signal as AbortSignal
    await current.setProps({ active: false }); expect(signal.aborted).toBe(true)
    release(json({ type: "FeatureCollection", features: [pop] })); await flushPromises()
    expect(current.find('select[aria-label="在线数据条目"]').exists()).toBe(false)
    expect(mapWork.showRemoteReference).not.toHaveBeenCalled()
  })
  it("does not apply a layer whose ready promise resolves after cancellation", async () => {
    let release!: () => void
    vi.mocked(mapWork.showRemoteReference).mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve }))
    const current = await open()
    await current.findAll("button").find(b => b.text().includes("加载参考图层"))!.trigger("click"); await flushPromises()
    await current.setProps({ active: false }); release(); await flushPromises()
    expect(current.text()).not.toContain("参考图层已加入地图")
    expect(mapWork.flyToRemoteReference).not.toHaveBeenCalled()
  })
  it("shows service failures with no fabricated data or map layer", async () => {
    fetcher.mockImplementationOnce(async () => new Response("error", { status: 503 }))
    const current = await open()
    expect(current.get('[role="alert"]').text()).toContain("HTTP 503")
    expect(current.find('select[aria-label="在线数据条目"]').exists()).toBe(false)
    expect(mapWork.showRemoteReference).not.toHaveBeenCalled()
  })
})
