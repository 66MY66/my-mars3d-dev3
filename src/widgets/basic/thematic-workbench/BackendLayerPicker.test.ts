import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import BackendLayerPicker from "./BackendLayerPicker.vue"
const scope = { west: 103, south: 35, east: 105, north: 37 }
const item = { type: "Feature", collection: "future-DEMO-dataset", id: "test-真实数据", bbox: [103, 35, 105, 37], properties: { title: "测试命名的后台资料" }, assets: { geometry: { href: "http://192.168.10.15:9002/rs-products/test/geometry.geojson", type: "application/geo+json" }, archive: { href: "http://192.168.10.15:9002/rs-products/source.zip", type: "application/zip" } } }
const response = (value: unknown) => new Response(JSON.stringify(value))
let wrapper: VueWrapper; let fetcher: ReturnType<typeof vi.fn>
beforeEach(() => { fetcher = vi.fn(async (url: string) => response(url.includes("/collections?") ? { collections: [{ id: item.collection, title: "新增数据集" }] } : { type: "FeatureCollection", features: [item] })); vi.stubGlobal("fetch", fetcher) })
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })
async function open() {
  wrapper = mount(BackendLayerPicker, { props: { bounds: scope, active: true, busy: false, requirements: [{ key: "settlement", label: "居民地名称", role: "settlement", group: "required", note: "" }] }, global: { stubs: { "mars-icon": true } } })
  ;(wrapper.element as HTMLDetailsElement).open = true; await wrapper.trigger("toggle"); await flushPromises()
}
describe("complete backend asset selection", () => {
  it("opens the requested business input directly and reads the catalog only once", async () => {
    wrapper = mount(BackendLayerPicker, { props: { bounds: scope, active: true, busy: false, requirements: [{ key: "business", label: "人口与烈度统计单元", role: "business", group: "required", adapter: "business-vector", note: "" }] }, global: { stubs: { "mars-icon": true } } })
    ;(wrapper.vm as any).open("business"); await flushPromises()
    await wrapper.trigger("toggle"); await flushPromises()
    expect((wrapper.element as HTMLDetailsElement).open).toBe(true)
    expect((wrapper.get('[aria-label="后端图层专题用途"]').element as HTMLSelectElement).value).toBe("business")
    await wrapper.findAll("button").find(button => button.text() === "读取并配置字段")!.trigger("click")
    expect(wrapper.emitted("assign")?.[0][0]).toEqual({ item, asset: "geometry", key: "business" })
    expect(fetcher.mock.calls.filter(call => String(call[0]).endsWith("/search"))).toHaveLength(1)
  })
  it("discovers collections and items without hiding test names and binds the chosen asset", async () => {
    await open()
    expect(wrapper.get('[aria-label="后端图层数据集"]').text()).toContain("新增数据集")
    expect(wrapper.get('[aria-label="后端图层数据"]').text()).toContain(item.properties.title)
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ limit: 50, bbox: [103, 35, 105, 37] })
    await wrapper.findAll("button").find(button => button.text() === "叠加到地图")!.trigger("click")
    expect(wrapper.emitted("assign")?.[0][0]).toEqual({ item, asset: "geometry", key: "settlement" })
    await wrapper.setProps({ requirements: [{ key: "catalog-reference", label: "其他参考图层", role: "business", group: "optional", note: "" }] })
    expect(wrapper.get('[aria-label="后端图层专题用途"]').findAll("option")).toHaveLength(1)
  })
  it("preserves source archives as downloadable files rather than missing data or fake map layers", async () => {
    await open(); await wrapper.get('[aria-label="后端图层资产"]').setValue("archive")
    expect(wrapper.text()).toContain("后台已提供此文件")
    expect(wrapper.findAll("button").some(button => button.text() === "叠加到地图")).toBe(false)
    expect(wrapper.find('a[href="/api/thematic/files/rs-products/source.zip"]').exists()).toBe(true)
  })
  it("keeps the exact scope and dataset on continuation requests", async () => {
    await open(); await wrapper.get('[aria-label="后端图层数据集"]').setValue(item.collection)
    fetcher.mockResolvedValueOnce(response({ type: "FeatureCollection", features: [item], links: [{ rel: "next", method: "POST", href: "http://192.168.10.15:5951/search", body: { token: "page2" } }] }))
    await wrapper.findAll("button").find(button => button.text() === "查询图层")!.trigger("click"); await flushPromises()
    await wrapper.findAll("button").find(button => button.text() === "继续读取")!.trigger("click"); await flushPromises()
    expect(JSON.parse(fetcher.mock.lastCall![1].body)).toEqual({ limit: 50, collections: [item.collection], bbox: [103, 35, 105, 37], token: "page2" })
    expect(wrapper.get('[aria-label="后端图层数据"]').findAll("option")).toHaveLength(1)
  })
  it("does not replace current options with a stale response after scope changes", async () => {
    await open()
    let finish!: (value: Response) => void
    fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    await wrapper.findAll("button").find(button => button.text() === "查询图层")!.trigger("click")
    await wrapper.setProps({ bounds: { ...scope, west: 104 } })
    finish(response({ type: "FeatureCollection", features: [item] })); await flushPromises()
    expect(wrapper.find('[aria-label="后端图层数据"]').exists()).toBe(false)
    expect(wrapper.emitted("assign")).toBeUndefined()
  })
})
