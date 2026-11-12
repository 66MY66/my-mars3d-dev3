import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { flushPromises, mount } from "@vue/test-utils"
import { webcrypto } from "node:crypto"
import LayerAnalysisTools from "./LayerAnalysisTools.vue"
import * as mapWork from "./map"
import type { DbtLayer } from "./dbt116-standard"
vi.mock("./map", () => ({ clearWorkflowLayers: vi.fn(), clearRasterResult: vi.fn(), getLockedSelection: vi.fn(() => ({ west: 101, east: 103, south: 29, north: 31 })), renderTemplateScene: vi.fn().mockResolvedValue(undefined), eventTarget: { on: vi.fn(), off: vi.fn() } }))
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("crypto", webcrypto) })
afterEach(() => vi.unstubAllGlobals())
const layer: DbtLayer = { id: "online:rain", name: "降水观测", role: "business", source: "http://backend/rain.geojson", authority: "", crs: "CRS84", publishedAt: "2026-11-03T00:00:00Z", security: "internal", scale: 0, data: { type: "FeatureCollection", features: [1, 2].map(value => ({ type: "Feature", geometry: { type: "Point", coordinates: [102, 30] }, properties: { rain_mm: value } })) }, onlineSource: { collection: "observations", itemId: "rain-original", asset: "data", revision: "r1", fingerprint: "a".repeat(64), scope: { west: 101, east: 103, south: 29, north: 31 } } }
describe("business tools stay independent of product selection", () => {
  it("keeps spatial and viewing tools available without choosing a source automatically", () => {
    const wrapper = mount(LayerAnalysisTools, { props: { layers: [layer], scopeKey: "scope", busy: false } })
    expect(wrapper.get('[aria-label="分析输入图层"]').element).toHaveProperty("value", "")
    expect(wrapper.findAll("option").map(option => option.text())).toContain("风险指数叠加")
    expect(wrapper.findAll("option").map(option => option.text())).toContain("等值线生成")
    expect(wrapper.findAll("option").map(option => option.text())).toContain("LST 时间基线偏差")
    expect(wrapper.findAll("option").map(option => option.text())).toContain("LOS 位移与相干性筛选")
    expect(wrapper.findAll("option").map(option => option.text())).toContain("仪器烈度初判（PGA / PGV）")
    expect(wrapper.findComponent({ name: "TemplateDataRenderer" }).exists()).toBe(false)
    wrapper.unmount()
  })
  it.each([
    { kind: "thermal-infrared", metadata: { temperatureUnit: "K", baselinePeriod: "unit-test historical baseline", analysisParams: { thermalZ: 3 } }, properties: { lst_k: 304, baseline_mean_k: 300, baseline_sd_k: 2, baseline_count: 20, quality_flag: "good" }, value: 2, threshold: 3 },
    { kind: "insar-deformation", metadata: { losUnit: "mm", losConvention: "toward_positive", acquisitionPair: "unit-test acquisition pair", analysisParams: { deformationMm: 40, coherenceMin: 0.75 } }, properties: { los_mm: -35, coherence: 0.8 }, value: -35, threshold: 40 },
    { kind: "instrumental-intensity", metadata: { intensityStandard: "GB/T 17742-2020" }, properties: { pga_ms2: 0.6, pgv_ms: 0.06 }, value: 6 }
  ])("calculates $kind from the selected backend attributes without capturing screenshot pixels", async ({ kind, metadata, properties, value, threshold }) => {
    const observedAt = "2026-09-27T07:00:00Z"
    const source = { ...layer, data: { ...layer.data, metadata: { ...metadata, observedAt }, features: [{ ...layer.data.features[0], properties }] } } as DbtLayer
    const before = JSON.stringify(source)
    const wrapper = mount(LayerAnalysisTools, { props: { layers: [source], scopeKey: "scope", busy: false }, global: { stubs: { "mars-icon": true } } })
    await wrapper.get('[aria-label="分析输入图层"]').setValue(source.id)
    await wrapper.get('[aria-label="业务分析工具"]').setValue(kind)
    if (threshold) { expect((wrapper.get('[aria-label="专题模板阈值"]').element as HTMLInputElement).value).toBe(String(threshold)) }
    const execute = wrapper.findAll("button").find(button => button.text() === "执行并查看")!
    expect(execute.attributes("disabled")).toBeUndefined()
    await execute.trigger("click"); await flushPromises()
    await vi.waitFor(() => expect(mapWork.renderTemplateScene).toHaveBeenCalledOnce())
    expect(vi.mocked(mapWork.renderTemplateScene).mock.calls[0][0]).toMatchObject({ kind, rows: [{ value }] })
    expect(vi.mocked(mapWork.renderTemplateScene).mock.calls[0][3]).toBe("tool-preview")
    if (threshold) { expect(vi.mocked(mapWork.renderTemplateScene).mock.calls[0][0].rows[0].color).toBe("#f7f7f7") }
    expect(wrapper.emitted("add")).toBeUndefined()
    await wrapper.findAll("button").find(button => button.text() === "加入地图图层")!.trigger("click")
    expect((wrapper.emitted("add")![0][1] as any).document.metadata.itemId).toBe(source.onlineSource!.itemId)
    expect((wrapper.emitted("add")![0][1] as any).scene.time).toBe(observedAt)
    expect(JSON.stringify(source)).toBe(before)
    wrapper.unmount()
  })
  it("does not accept a bare screenshot, hidden layer or local unbound document as an analysis input", () => {
    const wrapper = mount(LayerAnalysisTools, { props: { layers: [{ ...layer, onlineSource: undefined }, { ...layer, enabled: false }, { ...layer, opacity: 0 }, { ...layer, raster: { image: "data:image/png;base64,AA==", bounds: layer.onlineSource!.scope } }], scopeKey: "scope", busy: false } })
    expect(wrapper.get('[aria-label="分析输入图层"]').findAll("option")).toHaveLength(1)
    expect(wrapper.text()).toContain("请先加载可读取要素属性的业务图层")
    wrapper.unmount()
  })
  it("keeps execution disabled when brightness grid fields cannot supply an LST historical baseline", async () => {
    const source = { ...layer, data: { ...layer.data, features: [{ ...layer.data.features[0], properties: { mean: 270, std: 0, count: 1 } }] } }
    const wrapper = mount(LayerAnalysisTools, { props: { layers: [source], scopeKey: "scope", busy: false }, global: { stubs: { "mars-icon": true } } })
    await wrapper.get('[aria-label="分析输入图层"]').setValue(source.id)
    await wrapper.get('[aria-label="业务分析工具"]').setValue("thermal-infrared")
    expect(wrapper.findAll("button").find(button => button.text() === "执行并查看")!.attributes("disabled")).toBeDefined()
    expect(wrapper.text()).toContain("lst_k")
    expect(mapWork.renderTemplateScene).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it("only forwards the chosen layer and adds results through an explicit action", async () => {
    const result = { scene: { kind: "chart-linkage", rows: [], legend: [], note: "真实指标" }, options: {}, document: layer.data, bounds: layer.onlineSource!.scope, fingerprint: "b".repeat(64) }
    const wrapper = mount(LayerAnalysisTools, { props: { layers: [layer], scopeKey: "scope", busy: false }, global: { stubs: { "mars-icon": true, TemplateDataRenderer: { name: "TemplateDataRenderer", props: ["backendSources"], template: "<div />", setup(_, { expose }) { expose({ ready: true, render: vi.fn().mockResolvedValue(result) }) } } } } })
    const before = JSON.stringify(layer)
    await wrapper.get('[aria-label="分析输入图层"]').setValue(layer.id)
    await wrapper.get('[aria-label="业务分析工具"]').setValue("chart-linkage")
    expect(wrapper.getComponent({ name: "TemplateDataRenderer" }).props("backendSources")[0].document.metadata.itemId).toBe("rain-original")
    await wrapper.findAll("button").find(button => button.text() === "执行并查看")!.trigger("click"); await flushPromises()
    expect(wrapper.emitted("add")).toBeUndefined()
    await wrapper.findAll("button").find(button => button.text() === "加入地图图层")!.trigger("click")
    expect(wrapper.emitted("add")![0][0]).toEqual(layer)
    expect(JSON.stringify(layer)).toBe(before)
    wrapper.unmount()
  })
})
