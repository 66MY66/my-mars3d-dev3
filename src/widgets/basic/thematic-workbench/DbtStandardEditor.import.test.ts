import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { shallowMount, flushPromises, type VueWrapper } from "@vue/test-utils"
import { readFileSync } from "node:fs"
import DbtStandardEditor from "./DbtStandardEditor.vue"
import { renderDbtMap } from "./dbt116-renderer"
import { readBackendEventVector } from "./backend-event-parameters"
import type { RemoteItem } from "./remote-cartography-source"

vi.mock("./map", () => ({ getBusinessDataSources: () => [] }))
vi.mock("./dbt116-renderer", () => ({ renderDbtMap: vi.fn(async () => ({ bounds: null, issues: [], legendY: 895 })) }))
vi.mock("./standard-composition", () => ({ standardComposition: () => ({ id: "T30102000", title: "QA", usage: "draft", items: [] }) }))
vi.mock("./export-media", () => ({ canvasBlob: async () => new Blob(["QA"]), downloadBlob: vi.fn() }))
let wrapper: VueWrapper | undefined
const NativeURL = URL
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} })
  vi.stubGlobal("URL", class extends NativeURL { static createObjectURL() { return "blob:qa" } static revokeObjectURL() {} })
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })
const document = (place: string) => {
  const data = JSON.parse(readFileSync("public/data/dbt116-test/T30102000.json", "utf8"))
  data.event.place = place
  return JSON.stringify(data)
}
async function mount(allowFixtures = true) {
  wrapper = shallowMount(DbtStandardEditor, { props: { templateId: "T30102000", active: true, embedded: true, allowFixtures }, global: { stubs: { "mars-icon": true } } })
  await flushPromises(); await vi.advanceTimersByTimeAsync(250)
  return wrapper
}
async function pendingFile(current: VueWrapper) {
  let release!: (value: string) => void
  const text = new Promise<string>(resolve => { release = resolve })
  const input = current.get('input[aria-label="标准制图数据文件"]')
  Object.defineProperty(input.element, "files", { configurable: true, value: [{ name: "QA.json", size: 1000, text: () => text }] })
  await input.trigger("change")
  return release
}
async function settle() { await flushPromises(); await vi.advanceTimersByTimeAsync(250); await flushPromises() }

describe("cartography import transactions", () => {
  it("binds real backend event parameters to a reference proof and clears them when hidden or removed", async () => {
    const current = await mount(false); const editor = current.vm as any
    const scope = { west: 103, south: 32.5, east: 104.6, north: 34.1 }
    const item = { id: "SP-jiuzhaigou2017-intensity", collection: "spatial-thematic", properties: { "proj:epsg": 4326, "event:epicenter": [103.82, 33.2], "event:place": "后台震中地名", "event:name": "后台事件名称", "eq:magnitude": 7, datetime: "2017-08-08T13:19:00Z", "event:source": "随包参考" } } as RemoteItem
    const layer = { id: "online:event", name: "地震事件参数", role: "event", crs: "EPSG:4326", authority: "", source: "http://backend/items/event", publishedAt: item.properties.datetime, security: "", scale: 0, data: readBackendEventVector(item, scope), onlineSource: { collection: item.collection, itemId: item.id, asset: "properties", revision: "r1", fingerprint: "a".repeat(64), scope } }
    expect(editor.replaceOnlineLayers([layer], scope, "基本情况")).toBe(true); await settle()
    expect((current.get('input[aria-label="标准震中地名"]').element as HTMLInputElement).value).toBe("后台震中地名")
    const document = vi.mocked(renderDbtMap).mock.calls.at(-1)![1]!
    expect(document.usage).toBe("reference"); expect(document.event.magnitudeType).toBe("")
    expect(document.reference?.title).toContain("后台事件名称")
    expect(document.backendDocument).toBeUndefined()
    expect(editor.replaceOnlineLayers([{ ...layer, enabled: false }], scope, "基本情况")).toBe(true); await settle()
    expect((current.get('input[aria-label="标准震中地名"]').element as HTMLInputElement).value).toBe("")
    expect(editor.replaceOnlineLayers([layer], scope, "基本情况")).toBe(true); await settle()
    expect(editor.replaceOnlineLayers([], scope, "基本情况")).toBe(true); await settle()
    expect((current.get('input[aria-label="标准震中地名"]').element as HTMLInputElement).value).toBe("")
  })
  it("reuses a current preview and coalesces concurrent requests for the same changed document", async () => {
    const current = await mount(false); const editor = current.vm as any
    const calls = vi.mocked(renderDbtMap).mock.calls.length
    expect(await editor.preparePreview()).toBe(true)
    expect(vi.mocked(renderDbtMap).mock.calls).toHaveLength(calls)
    let finish!: (value: any) => void
    vi.mocked(renderDbtMap).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    editor.updateCopy("description", "Changed source summary")
    const first = editor.preparePreview(); const second = editor.preparePreview(); await flushPromises()
    expect(vi.mocked(renderDbtMap).mock.calls).toHaveLength(calls + 1)
    finish({ bounds: null, issues: [], legendY: 895 })
    expect(await Promise.all([first, second])).toEqual([true, true])
  })
  it("protects online geometry, preserves manual copy and signals source reset on a new document", async () => {
    const current = await mount(false)
    const scope = { west: 100, south: 28, east: 104, north: 32 }
    const layer = { id: "online:population", name: "人口分布", role: "population", crs: "EPSG:4326", authority: "", source: "backend.tif", security: "", publishedAt: "2020", scale: 0, data: { type: "FeatureCollection", features: [] }, raster: { image: "data:image/png;base64,AA==", bounds: scope, rendering: "classified", radiometry: "原始窗口" }, onlineSource: { collection: "spatial-thematic", itemId: "pop", asset: "data", revision: "r1", fingerprint: "a".repeat(64), scope } }
    const editor = current.vm as any
    expect(editor.replaceOnlineLayers([layer], scope, "人口分布")).toBe(true); await settle()
    expect(current.get(".dbt-layer fieldset").attributes()).toHaveProperty("disabled")
    editor.updateCopy("description", "USER VERIFIED COPY")
    expect(editor.replaceOnlineLayers([{ ...layer, publishedAt: "2021" }], scope, "人口分布")).toBe(true); await settle()
    expect((current.get('textarea[aria-label="标准内容说明"]').element as HTMLTextAreaElement).value).toBe("USER VERIFIED COPY")
    vi.spyOn(window, "confirm").mockReturnValue(true)
    await current.findAll("button").find(button => button.text().includes("新建图件"))!.trigger("click")
    expect(current.emitted("resetSources")).toHaveLength(1)
  })
  it("does not expose local business data imports or fixture entry points in production", async () => {
    const current = await mount(false)
    expect(current.text()).not.toContain("测试校样")
    expect(current.text()).not.toContain("加载测试数据")
    expect(current.find('input[aria-label="标准制图数据文件"]').exists()).toBe(false)
    expect(current.find('input[aria-label="人口GeoTIFF文件"]').exists()).toBe(false)
    expect(current.text()).not.toContain("导入制图数据")
    expect(current.text()).not.toContain("导入人口 GeoTIFF")
    expect((current.get('input[aria-label="标准震中地名"]').element as HTMLInputElement).value).toBe("")
  })
  it("keeps a selected data file when background map capture completes", async () => {
    const current = await mount(); const resolve = await pendingFile(current)
    await current.setProps({ mapPreview: { image: "data:image/png;base64,AA==", bounds: { west: 100, east: 101, south: 29, north: 30 }, capturedAt: "2026-10-26T00:00:00Z", view: "viewport" } })
    resolve(document("IMPORT SURVIVES CAPTURE")); await settle()
    expect((current.get('input[aria-label="标准震中地名"]').element as HTMLInputElement).value).toBe("IMPORT SURVIVES CAPTURE")
  })
  it("only applies the latest file when earlier reads finish out of order", async () => {
    const current = await mount(); const first = await pendingFile(current); const second = await pendingFile(current)
    second(document("LATEST FILE")); await settle()
    first(document("STALE FILE")); await settle()
    expect((current.get('input[aria-label="标准震中地名"]').element as HTMLInputElement).value).toBe("LATEST FILE")
  })
  it("does not overwrite edits made while a file is being read", async () => {
    const current = await mount(); const resolve = await pendingFile(current)
    await current.get('input[aria-label="标准震中地名"]').setValue("USER EDIT")
    resolve(document("OLD FILE")); await settle()
    expect((current.get('input[aria-label="标准震中地名"]').element as HTMLInputElement).value).toBe("USER EDIT")
  })
})
