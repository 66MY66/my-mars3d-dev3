import { webcrypto } from "node:crypto"
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { featureCollection, point, lineString, polygon } from "@turf/turf"
import TemplateMapEditor from "./TemplateMapEditor.vue"
import TemplateDataRenderer from "./TemplateDataRenderer.vue"
import * as mapWork from "./map"
import { readBusinessDocument } from "./business-map-data"

vi.mock("./map", () => ({
  getBusinessDataSources: vi.fn(),
onBusinessLayersChanged: vi.fn(() => () => {}),
  getLockedSelection: vi.fn(() => ({ west: 103, east: 106, south: 25, north: 28 })),
  renderTemplateScene: vi.fn(async () => true),
captureSelectionImage: vi.fn(async () => new Blob(["png"])),
  clearRasterResult: vi.fn(),
clearCartographySymbols: vi.fn(),
getMapAdornmentMetrics: vi.fn(() => null),
  eventTarget: { on: vi.fn(), off: vi.fn() },
highlightTemplateFeature: vi.fn()
}))
const data = () => readBusinessDocument({ ...featureCollection([point([104, 26], { value: 10 }), point([105, 27], { value: 20 }), point([110, 30], { value: 999 })]), metadata: { source: "QA isolated assertions", unit: "件" } })
let wrapper: VueWrapper
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("crypto", webcrypto)
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:qa")
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
  vi.mocked(mapWork.getBusinessDataSources).mockReturnValue([{ id: "qa", name: "QA layer", document: data() }])
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function setup() {
  wrapper = mount(TemplateMapEditor, { props: { kind: "graduated-symbol", palette: "blue", title: "QA", legendTitle: "指标", scopeKey: "scope", scopeLabel: "范围" }, global: { stubs: { "mars-icon": true } } })
  await flushPromises()
  await wrapper.get('[aria-label="实时渲染"]').setValue(false)
}
async function apply() { await wrapper.get("button.primary").trigger("click"); await vi.waitFor(() => expect((wrapper.vm as any).isRendering()).toBe(false)); await flushPromises() }
describe("business template workflow", () => {
  it("always offers backend preparation and never reads unrelated map layers when its business sources are empty", async () => {
    wrapper = mount(TemplateMapEditor, { props: { kind: "population-exposure", palette: "blue", title: "人口暴露", legendTitle: "人", scopeKey: "scope", scopeLabel: "范围", backendSources: [] }, global: { stubs: { "mars-icon": true } } })
    await flushPromises()
    expect(wrapper.text()).toContain("业务数据准备")
    expect(wrapper.text()).toContain("population、intensity")
    expect(wrapper.find('[aria-label="专题字段映射 population"]').exists()).toBe(false)
    expect(wrapper.get("button.primary").attributes("disabled")).toBeDefined()
    await wrapper.findAll("button").find(button => button.text() === "选择后端业务资料")!.trigger("click")
    expect(wrapper.emitted("choose-data")).toHaveLength(1)
    expect(mapWork.getBusinessDataSources).not.toHaveBeenCalled()
    await (wrapper.vm as any).applyRecommended()
    expect(wrapper.emitted("applied")).toBeUndefined()
    expect(mapWork.renderTemplateScene).not.toHaveBeenCalled()
  })
  it("renders actual exposure after explicit field mapping and preflights missing source metadata", async () => {
    const document = readBusinessDocument({ ...featureCollection([polygon([[[104, 26], [105, 26], [105, 27], [104, 27], [104, 26]]], { residents: "120", level: "7" })]), metadata: { source: "http://backend/statistical-units.geojson", observedAt: "2026-10-30T00:00:00Z", populationUnit: "人", assessment: "unit source assessment" } })
    wrapper = mount(TemplateMapEditor, { props: { kind: "population-exposure", palette: "blue", title: "人口暴露", legendTitle: "人", scopeKey: "scope", scopeLabel: "范围", backendSources: [{ id: "online:business", name: "实际统计单元", document }] }, global: { stubs: { "mars-icon": true } } })
    await flushPromises(); await wrapper.get('[aria-label="实时渲染"]').setValue(false)
    expect(wrapper.get("button.primary").attributes("disabled")).toBeDefined()
    await wrapper.get('[aria-label="专题字段映射 population"]').setValue("residents")
    await wrapper.get('[aria-label="专题字段映射 intensity"]').setValue("level")
    expect(wrapper.get("button.primary").attributes("disabled")).toBeUndefined()
    await apply()
    const result = wrapper.emitted("applied")!.at(-1)![3] as any
    expect(result.scene.rows[0].value).toBe(120)
    expect(result.document.features[0].properties.residents).toBe("120")
    expect(result.options.fieldMapping).toEqual({ population: "residents", intensity: "level" })
    const missing = JSON.parse(JSON.stringify(document)); delete missing.metadata.assessment
    await wrapper.setProps({ backendSources: [{ id: "online:business", name: "来源未补齐", document: missing }] })
    await wrapper.get('[aria-label="专题字段映射 population"]').setValue("residents")
    await wrapper.get('[aria-label="专题字段映射 intensity"]').setValue("level")
    expect(wrapper.text()).toContain("assessment 暴露与烈度成果来源")
    expect(wrapper.get("button.primary").attributes("disabled")).toBeDefined()
  })
  it("renders explicitly supplied backend numeric text without offering local imports or reading unrelated map layers", async () => {
    const document = data(); document.features.forEach((feature, i) => { feature.properties = { rain_mm: String(10 + i * 10), PAC: "001" } })
    wrapper = mount(TemplateMapEditor, { props: { kind: "graduated-symbol", palette: "blue", title: "后台降雨", legendTitle: "mm", scopeKey: "scope", scopeLabel: "范围", backendSources: [{ id: "online:business", name: "后台观测", document }] }, global: { stubs: { "mars-icon": true } } })
    await flushPromises(); await wrapper.get('[aria-label="实时渲染"]').setValue(false)
    expect(wrapper.find('[aria-label="专题模板数据源"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain("导入数据")
    expect(wrapper.text()).not.toContain("仅底图校样")
    expect((wrapper.get('[aria-label="专题模板数值字段"]').element as HTMLSelectElement).value).toBe("rain_mm")
    expect(mapWork.getBusinessDataSources).not.toHaveBeenCalled()
    await wrapper.get('[aria-label="专题指标单位"]').setValue("mm")
    await apply()
    const result = wrapper.emitted("applied")!.at(-1)![3] as any
    expect(result.scene.rows.map((row: any) => row.value)).toEqual([10, 20])
    expect(result.options.unit).toBe("mm")
    expect(wrapper.emitted("applied")!.at(-1)![1]).toBe(false)
    await wrapper.setProps({ palette: "green" })
    expect(wrapper.find(".result img").exists()).toBe(false)
    expect((wrapper.get('[aria-label="专题模板数值字段"]').element as HTMLSelectElement).value).toBe("rain_mm")
    await apply()
    expect((wrapper.emitted("applied")!.at(-1)![3] as any).options.palette).toBe("green")
  })
  it("maps real source columns for a directional method without filling in missing metrics", async () => {
    const document = readBusinessDocument({ ...featureCollection([lineString([[104, 26], [105, 27]], { discharge: "8" })]), metadata: { source: "backend-rivers", observedAt: "2026-11-01T00:00:00Z", unit: "m3/s" } })
    wrapper = mount(TemplateMapEditor, { props: { kind: "flow-direction", palette: "blue", title: "径流", legendTitle: "m3/s", scopeKey: "scope", scopeLabel: "范围", backendSources: [{ id: "river", name: "后台河流", document }] }, global: { stubs: { "mars-icon": true } } })
    await flushPromises(); await wrapper.get('[aria-label="实时渲染"]').setValue(false)
    expect(wrapper.text()).toContain("未绑定有效源字段")
    await wrapper.get('[aria-label="专题字段映射 flow_rate"]').setValue("discharge")
    await apply()
    const result = wrapper.emitted("applied")!.at(-1)![3] as any
    expect(result.scene.rows[0].value).toBe(8)
    expect(result.options.fieldMapping).toEqual({ flow_rate: "discharge" })
    expect(result.document.features[0].properties.discharge).toBe("8")
  })
  it("reports incompatible backend geometry instead of leaving an unexplained blank preview", async () => {
    wrapper = mount(TemplateMapEditor, { props: { kind: "choropleth", palette: "blue", title: "面分级", legendTitle: "件", scopeKey: "scope", scopeLabel: "范围", backendSources: [{ id: "points", name: "真实点数据", document: data() }] }, global: { stubs: { "mars-icon": true } } })
    await flushPromises()
    expect(wrapper.get("button.primary").attributes("disabled")).toBeDefined()
    expect(wrapper.text()).toContain("需要面要素")
    expect(mapWork.renderTemplateScene).not.toHaveBeenCalled()
    expect(wrapper.emitted("applied")).toBeUndefined()
  })
  it("defaults to compatible map data and emits the same scene, legend and snapshot", async () => {
    await setup()
    expect((wrapper.get('[aria-label="专题模板数据源"]').element as HTMLSelectElement).value).toBe("map")
    expect(wrapper.text()).not.toContain("加载测试数据")
    expect(wrapper.text()).not.toContain("RGB 亮度")
    await apply()
    const emitted = wrapper.emitted("applied")?.[0]
    expect(emitted?.[2]).toBe(true)
    const result = emitted?.[3] as any
    expect(result.scene.rows.map((r: any) => r.value)).toEqual([10, 20])
    expect(result.scene).toEqual(vi.mocked(mapWork.renderTemplateScene).mock.calls[0][0])
    expect(result.document.features).toHaveLength(3)
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(mapWork.captureSelectionImage).toHaveBeenCalledOnce()
  })
  it("blocks missing map data instead of generating a replacement", async () => {
    vi.mocked(mapWork.getBusinessDataSources).mockReturnValue([])
    await setup()
    expect(wrapper.get("button.primary").attributes("disabled")).toBeDefined()
    expect(mapWork.renderTemplateScene).not.toHaveBeenCalled()
    expect(mapWork.captureSelectionImage).not.toHaveBeenCalled()
  })
  it("invalidates the preview after changing the selection", async () => {
    await setup(); await apply()
    expect(wrapper.find(".result img").exists()).toBe(true)
    await wrapper.setProps({ scopeKey: "new-scope" })
    expect(wrapper.find(".result img").exists()).toBe(false)
    expect((wrapper.vm as any).getDocument()).toBeNull()
    expect(wrapper.emitted("invalidate")?.length).toBeGreaterThan(0)
  })
  it("keeps the data snapshot when layout copy is synchronized", async () => {
    await setup(); await apply()
    const doc = (wrapper.vm as any).getDocument()
    await wrapper.setProps({ title: "new layout title", legendTitle: "count" })
    expect(wrapper.find(".result img").exists()).toBe(true)
    expect((wrapper.vm as any).getDocument()).toBe(doc)
  })
  it("checks the current layer again before applying", async () => {
    await setup()
    vi.mocked(mapWork.getBusinessDataSources).mockReturnValue([])
    await apply()
    expect(mapWork.renderTemplateScene).not.toHaveBeenCalled()
    expect(wrapper.emitted("applied")).toBeUndefined()
  })
  it("rejects fixture imports at the business entry point", async () => {
    await setup()
    const test = data(); test.metadata.usage = "test"
    expect(() => (wrapper.findComponent(TemplateDataRenderer).vm as any).importDocument(test, "fixture.geojson")).toThrow("不能用于业务模板")
  })
  it("does not emit a stale result when a render finishes after scope change", async () => {
    let finish!: () => void
    vi.mocked(mapWork.renderTemplateScene).mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve(true) }))
    await setup(); await wrapper.get("button.primary").trigger("click")
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"))
    await wrapper.setProps({ scopeKey: "new-scope" })
    finish(); await flushPromises()
    expect(wrapper.emitted("applied")).toBeUndefined()
    expect(mapWork.captureSelectionImage).not.toHaveBeenCalled()
  })
})
