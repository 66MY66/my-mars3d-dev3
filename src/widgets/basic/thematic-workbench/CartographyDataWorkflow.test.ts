import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import CartographyDataWorkflow from "./CartographyDataWorkflow.vue"
import * as mapWork from "./map"
import { webcrypto } from "node:crypto"
import BackendLayerPicker from "./BackendLayerPicker.vue"
import LayerStyleEditor from "./LayerStyleEditor.vue"
import { backendMapLayer, backendRasterLayer } from "./cartography-backend-render"
vi.mock("./result-map-publication", () => ({ mapPublicationHash: vi.fn().mockResolvedValue("c".repeat(64)) }))
vi.mock("./map", () => ({ clearWorkflowLayers: vi.fn(), showWorkflowLayer: vi.fn().mockResolvedValue(undefined), renderTemplateScene: vi.fn().mockResolvedValue(undefined), updateWorkflowPresentation: vi.fn() }))
vi.mock("./cartography-source-window", () => ({ readCartographyWindow: vi.fn().mockResolvedValue({ image: "", bounds: { west: 100, south: 28, east: 104, north: 32 }, sourceBounds: { west: 100, south: 28, east: 104, north: 32 }, crs: "EPSG:4326", fingerprint: "a".repeat(64), statistics: { valid: 2, missing: 1, minimum: 0, maximum: 10, mean: 5 }, legend: [{ label: "原始值", color: "#21918c" }], breaks: [10] }) }))
vi.mock("./cartography-backend-render", async importOriginal => ({ ...await importOriginal<typeof import("./cartography-backend-render")>(), backendMapLayer: vi.fn().mockResolvedValue({ raster: { url: "backend-xyz", bounds: { west: 101, south: 29, east: 103, north: 31 }, minZoom: 0, maxZoom: 24 }, bounds: { west: 101, south: 29, east: 103, north: 31 }, fingerprint: "b".repeat(64), tileUrl: "backend-xyz" }), backendRasterLayer: vi.fn().mockResolvedValue({ image: "data:image/png;base64,AA==", bounds: { west: 101, south: 29, east: 103, north: 31 }, raster: { url: "backend-xyz", bounds: { west: 101, south: 29, east: 103, north: 31 }, minZoom: 0, maxZoom: 24 }, fingerprint: "a".repeat(64), tileUrl: "backend-xyz", url: "backend-bbox", urls: ["backend-bbox"], width: 3200, height: 2400, dpi: 300 }) }))
const scope = { west: 101, south: 29, east: 103, north: 31 }
const pop = { type: "Feature", id: "SP-luding-pop2020", collection: "spatial-thematic", bbox: [100, 28, 104, 32], properties: { title: "泸定人口", updated: "r1", "grid:year": 2020, "proj:epsg": 4326 }, assets: { data: { href: "http://192.168.10.15:9002/rs-products/pop.tif", type: "image/tiff", title: "人口数值" } } }
const response = (value: unknown) => new Response(JSON.stringify(value))
let wrapper: VueWrapper | undefined; let fetcher: ReturnType<typeof vi.fn>
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); fetcher = vi.fn(async (url: string) => response(url.endsWith("/search") ? { type: "FeatureCollection", features: [pop, { ...pop, id: "SP-luding-intensity" }] } : pop)); vi.stubGlobal("fetch", fetcher) })
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals() })
function open(bounds: typeof scope | null = scope, topic = "T30102000") { wrapper = mount(CartographyDataWorkflow, { props: { bounds, topic, active: true }, global: { stubs: { "mars-icon": true } } }); return wrapper }
async function query(current: VueWrapper) { await flushPromises(); await current.findAll("button").find(b => b.text().includes("刷新可用图层"))!.trigger("click"); await flushPromises() }
async function render(current: VueWrapper) { await current.findAll("button").find(b => b.text().includes("叠加渲染"))!.trigger("click"); await flushPromises() }
describe("scope-first production data workflow", () => {
  it("keeps source preparation accessible when no business input was automatically matched", async () => {
    fetcher.mockImplementation(async (url: string) => response(url.includes("/collections?") ? { collections: [{ id: "empty-business" }] } : { type: "FeatureCollection", features: [] }))
    wrapper = mount(CartographyDataWorkflow, { props: { bounds: scope, topic: "population-exposure", active: true, autoMatch: true }, global: { stubs: { "mars-icon": true } } })
    await vi.waitFor(() => expect(wrapper!.text()).toContain("当前范围没有满足此模板的资料"))
    expect(wrapper.get(".generate-map").attributes("disabled")).toBeDefined()
    expect(wrapper.text()).toContain("待准备：人口与资产暴露业务数据")
    await wrapper.get(".prepare-data").trigger("click"); await flushPromises()
    expect(wrapper.get(".backend-picker").attributes("open")).toBeDefined()
    expect((wrapper.getComponent(BackendLayerPicker).vm as any).$?.setupState.target).toBe("business")
  })
  it("loads explicitly chosen alias columns for preparation without claiming a rendered product", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const item = { ...pop, id: "arbitrary-real-data", collection: "arbitrary-catalog", assets: { data: { href: "http://192.168.10.15:9002/rs-products/alias-exposure-unit.geojson", type: "application/geo+json" } } }
    const data = { type: "FeatureCollection", metadata: { observedAt: "2026-10-30T00:00:00Z", populationUnit: "人", assessment: "unit source assessment" }, features: [{ type: "Feature", properties: { residents: "20", assessed_level: "7" }, geometry: { type: "Polygon", coordinates: [[[101.5, 29.5], [102.5, 29.5], [102.5, 30.5], [101.5, 30.5], [101.5, 29.5]]] } }] }
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes("/collections?")) { return response({ collections: [{ id: item.collection }] }) }
      if (url.endsWith("/search")) { return response({ type: "FeatureCollection", features: [item] }) }
      return response(url.includes("/files/") ? data : item)
    })
    wrapper = mount(CartographyDataWorkflow, { props: { bounds: scope, topic: "population-exposure", active: true, autoMatch: true }, global: { stubs: { "mars-icon": true } } })
    await vi.waitFor(() => expect(wrapper!.text()).toContain("当前范围没有满足此模板的资料"))
    wrapper.getComponent(BackendLayerPicker).vm.$emit("assign", { item, asset: "data", key: "business" })
    await vi.waitFor(() => expect(wrapper!.emitted("expression-input-ready")).toHaveLength(1))
    const layers = wrapper.emitted("change")!.at(-1)![0] as any[]
    expect(layers).toHaveLength(1)
    expect(layers[0].id).toBe("online:business")
    expect(layers[0].data.features[0].properties.residents).toBe("20")
    expect(layers[0].data.features[0].properties.population).toBeUndefined()
    expect(layers[0].onlineSource.rendering.parameters.inputOnly).toBe(true)
    expect(mapWork.renderTemplateScene).not.toHaveBeenCalled()
    expect(wrapper.emitted("generate-expression")).toBeUndefined()
    const configure = wrapper.findAll("button").find(button => button.text() === "配置指标")!
    expect(configure).toBeDefined()
    await configure.trigger("click")
    expect(wrapper.emitted("expression-input-ready")).toHaveLength(2)
  })
  it("rejects raster-to-vector business binding before requesting pixels or drawing a fake business layer", async () => {
    const current = open(scope, "population-exposure"); await flushPromises()
    current.getComponent(BackendLayerPicker).vm.$emit("assign", { item: pop, key: "business", asset: "data" })
    await vi.waitFor(() => expect(current.text()).toContain("栅格可作为参考图层加载，不能直接绑定为业务字段"))
    expect(backendMapLayer).not.toHaveBeenCalled()
    expect(mapWork.showWorkflowLayer).not.toHaveBeenCalled()
    expect(mapWork.renderTemplateScene).not.toHaveBeenCalled()
    expect(current.emitted("expression-input-ready")).toBeUndefined()
  })
  it("keeps coarse background as a readable reference and saves/restores an explicit fill preference", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const item = { ...pop, id: "background-unit", collection: "thermal-background", properties: { "background:field_type": "thermal", "background:grid_size_deg": 1, "background:samples": 1 }, assets: { grid: { href: "http://192.168.10.15:9002/rs-products/grid-unit.geojson", type: "application/geo+json" } } }
    const data = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[101, 29], [102, 29], [102, 30], [101, 30], [101, 29]]] }, properties: { mean: 271.123, std: 0, count: 1, latest: 271.123 } }] }
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes("/collections?")) { return response({ collections: [{ id: item.collection }] }) }
      if (url.endsWith("/search")) { return response({ type: "FeatureCollection", features: [item] }) }
      return response(url.includes("/files/") ? data : item)
    })
    wrapper = mount(CartographyDataWorkflow, { props: { bounds: scope, topic: "thermal-infrared", active: true, autoMatch: true }, global: { stubs: { "mars-icon": true } } })
    await vi.waitFor(() => expect(wrapper!.text()).toContain("已匹配 1 类参考资料"))
    expect(wrapper.get(".generate-map").text()).toBe("显示参考资料")
    await wrapper.get(".generate-map").trigger("click")
    await vi.waitFor(() => expect(mapWork.showWorkflowLayer).toHaveBeenCalledOnce())
    expect(vi.mocked(mapWork.showWorkflowLayer).mock.calls[0][1]).toMatchObject({ symbol: { styleOptions: { fill: false } }, labels: [{ text: "271.123" }] })
    expect(wrapper.emitted("generate-expression")).toBeUndefined()
    await vi.waitFor(() => expect(wrapper!.find('[aria-label="亮温背景网格背景网格表达"]').exists()).toBe(true))
    expect(wrapper.text()).toContain("单景背景，不能计算时间基线异常")
    await wrapper.get('[aria-label="亮温背景网格背景网格表达"]').setValue("fill")
    await vi.waitFor(() => expect(mapWork.showWorkflowLayer).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect((wrapper!.emitted("change")!.at(-1)![0] as any[])[0].onlineSource.rendering.parameters.resultDisplay).toBe("fill"))
    await wrapper.findAll("button").find(button => button.text() === "保存数据配置")!.trigger("click")
    const saved = Object.values(localStorage).map(value => JSON.parse(value as string)).find(value => value.backgroundDisplays)
    expect(saved.backgroundDisplays.background).toBe("fill")
    await wrapper.findAll("button").find(button => button.text() === "恢复数据配置")!.trigger("click")
    await vi.waitFor(() => expect(wrapper!.text()).toContain("已恢复配置"))
    expect((wrapper.get('[aria-label="亮温背景网格显示指标"]').element as HTMLSelectElement).value).toBe("mean")
    await wrapper.get(".generate-map").trigger("click")
    await vi.waitFor(() => expect(vi.mocked(mapWork.showWorkflowLayer).mock.calls.at(-1)![1].symbol!.styleOptions.fill).toBe(true))
  })
  it("routes actual LST baseline fields, not grid means, into thermal business rendering", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const item = { ...pop, id: "arbitrary-baseline", collection: "new-data", assets: { data: { href: "http://192.168.10.15:9002/rs-products/baseline-unit.geojson", type: "application/geo+json" } } }
    const data = { type: "FeatureCollection", metadata: { observedAt: "2026-09-27T07:00:00Z", temperatureUnit: "K", baselinePeriod: "unit-test reference period" }, features: [{ type: "Feature", geometry: { type: "Point", coordinates: [102, 30] }, properties: { lst_k: 304, baseline_mean_k: 300, baseline_sd_k: 2, baseline_count: 20, quality_flag: "good" } }] }
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes("/collections?")) { return response({ collections: [{ id: item.collection }] }) }
      if (url.endsWith("/search")) { return response({ type: "FeatureCollection", features: [item] }) }
      return response(url.includes("/files/") ? data : item)
    })
    wrapper = mount(CartographyDataWorkflow, { props: { bounds: scope, topic: "thermal-infrared", active: true, autoMatch: true }, global: { stubs: { "mars-icon": true } } })
    await vi.waitFor(() => { expect(wrapper!.get(".generate-map").text()).toBe("生成专题效果"); expect(wrapper!.get(".generate-map").attributes("disabled")).toBeUndefined() })
    await wrapper.get(".generate-map").trigger("click")
    await vi.waitFor(() => expect(wrapper!.emitted("generate-expression")).toHaveLength(1))
    const layer = (wrapper.emitted("change")!.at(-1)![0] as any[])[0]
    expect(layer.id).toBe("online:thermal")
    expect(layer.data.metadata.contentRecommendation.kind).toBe("thermal-infrared")
    expect(mapWork.showWorkflowLayer).not.toHaveBeenCalled()
  })
  it("loads a content-verified building damage product straight into a scoped native scene", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const item = { ...pop, id: "arbitrary-damage-name", collection: "new-products", assets: { data: { href: "http://192.168.10.15:9002/rs-products/verified-damage.geojson", type: "application/geo+json" } } }
    const data = { type: "FeatureCollection", metadata: { eventId: "unit-event", assessment: "unit assessment v1", observedAt: "2026-10-30T00:00:00Z", gradeDefinition: [{ value: "D1", label: "来源破坏等级", order: 1 }] }, features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[101.5, 29.5], [102.5, 29.5], [102.5, 30.5], [101.5, 30.5], [101.5, 29.5]]] }, properties: { building_id: "b1", damage_grade: "D1" } }] }
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes("/collections?")) { return response({ collections: [{ id: item.collection }] }) }
      if (url.endsWith("/search")) { return response({ type: "FeatureCollection", features: [item] }) }
      return response(url.includes("/files/") ? data : item)
    })
    wrapper = mount(CartographyDataWorkflow, { props: { bounds: scope, topic: "building-damage", active: true, autoMatch: true }, global: { stubs: { "mars-icon": true } } })
    await vi.waitFor(() => expect(wrapper!.text()).toContain("已按数据内容匹配"))
    await wrapper.get(".generate-map").trigger("click")
    await vi.waitFor(() => expect(mapWork.renderTemplateScene).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect((wrapper!.emitted("change")!.at(-1)![0] as any[])).toHaveLength(1))
    const layer = (wrapper.emitted("change")!.at(-1)![0] as any[])[0]
    expect(layer.onlineSource.rendering.engine).toBe("Mars3D.GraphicLayer")
    expect(layer.onlineSource.rendering.parameters.expression.kind).toBe("building-damage")
    expect(layer.data.features[0].properties.damage_grade).toBe("D1")
    expect(vi.mocked(mapWork.renderTemplateScene).mock.calls[0][3]).toBe("assessment")
    expect(wrapper.text()).toContain("所需图层已显示")
    expect(mapWork.showWorkflowLayer).not.toHaveBeenCalled()
  })
  it("uses two compatible backend acquisitions and keeps each half geographically clipped for map and proof", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const make = (id: string, datetime: string) => ({ ...pop, id, collection: "comparison-unit", properties: { datetime, updated: "comparison-unit-v1", "earthquake:time": "2026-09-20T00:00:00Z", "processing:registration_id": "registered-unit-v1", "processing:level": "rgb-unit", gsd: 10, platform: "unit-sensor" }, assets: { data: { href: `http://192.168.10.15:9002/rs-products/${id}.tif`, type: "image/tiff" } } })
    const before = make("comparison-before-unit", "2026-09-19T00:00:00Z"); const after = make("comparison-after-unit", "2026-09-21T00:00:00Z")
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes("/collections?")) { return response({ collections: [{ id: before.collection }] }) }
      if (url.endsWith("/search")) { return response({ type: "FeatureCollection", features: [before, after] }) }
      if (url.includes("/cog/info")) { return response({ count: 3, width: 10, height: 10, crs: "EPSG:4326", colorinterp: ["red", "green", "blue"], band_descriptions: [[1, "red"], [2, "green"], [3, "blue"]], bounds: [100, 28, 104, 32] }) }
      return response(url.includes(after.id) ? after : before)
    })
    for (let i = 0; i < 2; i++) { vi.mocked(backendMapLayer).mockImplementationOnce(async (_item, _asset, bounds) => ({ raster: { url: "backend-xyz", bounds, minZoom: 0, maxZoom: 24 }, bounds, fingerprint: "b".repeat(64), tileUrl: "backend-xyz" })) }
    wrapper = mount(CartographyDataWorkflow, { props: { bounds: scope, topic: "imagery-comparison", active: true, autoMatch: true }, global: { stubs: { "mars-icon": true } } })
    await vi.waitFor(() => expect(wrapper!.text()).toContain("已按数据内容匹配 2 类资料"))
    await wrapper.get(".generate-map").trigger("click")
    await vi.waitFor(() => expect(mapWork.showWorkflowLayer).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect((wrapper!.emitted("change")!.at(-1)![0] as any[])).toHaveLength(2))
    const layers = wrapper.emitted("change")!.at(-1)![0] as any[]
    expect(layers[0].raster.bounds).toEqual({ ...scope, east: 102 })
    expect(layers[1].raster.bounds).toEqual({ ...scope, west: 102 })
    expect(layers[0].onlineSource.scope).toEqual(scope)
    expect(layers[1].onlineSource.rendering.parameters.comparison.side).toBe("after")
    expect(await (wrapper.vm as any).prepareComposition()).toBe(true)
    expect(vi.mocked(backendRasterLayer).mock.calls.map(call => call[2])).toEqual([{ ...scope, east: 102 }, { ...scope, west: 102 }])
    await wrapper.get('[aria-label="灾前影像数据条目"]').setValue("")
    expect(wrapper.emitted("change")!.at(-1)![0]).toEqual([])
  })
  it("offers business dates without asking the operator to choose a backend collection", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const first = { ...pop, id: "population-2020", properties: { ...pop.properties, updated: "r1", "grid:year": 2020, "grid:unit": "人/平方公里" } }
    const second = { ...pop, id: "population-2021", properties: { ...first.properties, updated: "r2", "grid:year": 2021 } }
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes("/collections?")) { return response({ collections: [{ id: pop.collection }] }) }
      if (url.endsWith("/search")) { return response({ type: "FeatureCollection", features: [first, second] }) }
      return response({ count: 1, width: 2, height: 2, band_descriptions: [[1, "people_per_km2"]], bounds: [101, 29, 103, 31], dtype: "float32" })
    })
    wrapper = mount(CartographyDataWorkflow, { props: { bounds: scope, topic: "T30102000", active: true, autoMatch: true }, global: { stubs: { "mars-icon": true } } })
    await vi.waitFor(() => expect(wrapper!.find('[aria-label="专题资料时点"]').exists()).toBe(true))
    expect(wrapper.get('[aria-label="专题资料时点"]').findAll("option").map(option => option.text())).toEqual(["2021", "2020"])
    await wrapper.get('[aria-label="专题资料时点"]').setValue("2020")
    expect(wrapper.get('[aria-label="人口分布数据条目"]').element).toHaveProperty("value", JSON.stringify([pop.collection, first.id]))
  })
  it("applies a style to one layer without removing or changing other backend layers", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const current = open(); await query(current); await render(current)
    await vi.waitFor(() => expect((current.emitted("change")!.at(-1)![0] as any[])).toHaveLength(1))
    const population = (current.emitted("change")!.at(-1)![0] as any[])[0]
    const item = { ...pop, id: "rain-original", collection: "real-observations", assets: { points: { href: "http://192.168.10.15:9002/rs-products/rain.geojson", type: "application/geo+json" } } }
    const data = { type: "FeatureCollection", features: [1, 2].map(rain_mm => ({ type: "Feature", geometry: { type: "Point", coordinates: [102 + rain_mm / 10, 30] }, properties: { rain_mm } })) }
    fetcher.mockImplementation(async (url: string) => response(url.includes("/files/") ? data : item))
    current.getComponent(BackendLayerPicker).vm.$emit("assign", { item, key: "settlement", asset: "points" })
    await vi.waitFor(() => expect((current.emitted("change")!.at(-1)![0] as any[])).toHaveLength(2))
    await current.get('[aria-label="居民地名称符号化与渲染"]').trigger("click")
    current.getComponent(LayerStyleEditor).vm.$emit("apply", "graduated-symbol", { field: "rain_mm", unit: "mm", count: 2 })
    await vi.waitFor(() => expect(mapWork.renderTemplateScene).toHaveBeenCalled())
    await vi.waitFor(() => expect(current.text()).toContain("表达已更新"))
    const layers = current.emitted("change")!.at(-1)![0] as any[]
    expect(layers.find(layer => layer.id === population.id)).toEqual(population)
    expect(layers.find(layer => layer.id === "online:settlement").onlineSource).toMatchObject({ itemId: "rain-original", rendering: { kind: "graduated-symbol" } })
    expect(vi.mocked(mapWork.renderTemplateScene).mock.calls[0][3]).toBe("settlement")
  })
  it("inspects actual content and generates without manual dataset or field selection", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const item = { ...pop, id: "fake-demo", collection: "new-catalog", properties: { title: "保存成果", "proj:epsg": 4326 }, assets: { data: { href: "http://192.168.10.15:9002/rs-products/actual.geojson", type: "application/geo+json" } } }
    const data = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [102, 30] }, properties: { rain_mm: "12.4" } }] }
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes("/collections?")) { return response({ collections: [{ id: item.collection }] }) }
      if (url.endsWith("/search")) { return response({ type: "FeatureCollection", features: [item] }) }
      return response(url.includes("/files/") ? data : item)
    })
    wrapper = mount(CartographyDataWorkflow, { props: { bounds: scope, topic: "point-heat", active: true, autoMatch: true }, global: { stubs: { "mars-icon": true } } })
    const current = wrapper
    await vi.waitFor(() => expect(current.text()).toContain("已按数据内容匹配"))
    expect(current.get(".matched-settings").attributes("open")).toBeUndefined()
    const button = current.findAll("button").find(button => button.text() === "生成专题效果")!
    expect(button.attributes("disabled")).toBeUndefined()
    await button.trigger("click")
    await vi.waitFor(() => expect(current.emitted("generate-expression")).toHaveLength(1))
    const layers = current.emitted("change")!.at(-1)![0] as any[]
    expect(layers[0].onlineSource.itemId).toBe("fake-demo")
    expect(layers[0].data.metadata.contentRecommendation).toMatchObject({ kind: "point-heat", field: "rain_mm", unit: "mm" })
    expect(layers[0].data.features[0].properties.rain_mm).toBe("12.4")
    expect(fetcher.mock.calls.some(call => String(call[0]).includes("/files/"))).toBe(true)
    expect(mapWork.showWorkflowLayer).not.toHaveBeenCalled()
  })
  it("does not assign workspace manifests as renderable business data", async () => {
    const item = { ...pop, collection: "new-catalog", assets: { data: { href: "http://192.168.10.15:9002/rs-products/workspace.geojson", type: "application/geo+json" } } }
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes("/collections?")) { return response({ collections: [{ id: item.collection }] }) }
      if (url.endsWith("/search")) { return response({ type: "FeatureCollection", features: [item] }) }
      return response({ version: 1, layers: [] })
    })
    wrapper = mount(CartographyDataWorkflow, { props: { bounds: scope, topic: "point-heat", active: true, autoMatch: true }, global: { stubs: { "mars-icon": true } } })
    await vi.waitFor(() => expect(wrapper!.text()).toContain("当前范围没有满足此模板的资料"))
    expect(wrapper.findAll("button").find(button => button.text() === "生成专题效果")!.attributes("disabled")).toBeDefined()
  })
  it("discovers vector expression inputs across collections without name filtering or ID collisions", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const item = { ...pop, id: "DEMO-real-observations", collection: "new-catalog", assets: { data: { href: "http://192.168.10.15:9002/rs-products/observations.geojson", type: "application/geo+json" } } }
    const other = { ...item, collection: "second-catalog" }
    const data = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [102, 30] }, properties: { rain_mm: "12.4" } }] }
    fetcher.mockImplementation(async (url: string) => {
      if (url.endsWith("/search")) { return response({ type: "FeatureCollection", features: [item, other] }) }
      return response(url.includes("/files/") ? data : item)
    })
    const current = open(scope, "graduated-symbol"); await flushPromises()
    const search = fetcher.mock.calls.find(call => call[0].endsWith("/search"))!
    expect(JSON.parse(search[1].body)).toEqual({ bbox: [101, 29, 103, 31], limit: 50 })
    const select = current.get('[aria-label="分级符号业务数据数据条目"]')
    expect(select.findAll("option")).toHaveLength(3)
    expect(select.findAll("option").slice(1).map(option => option.attributes("value"))).toEqual([JSON.stringify([item.collection, item.id]), JSON.stringify([other.collection, item.id])])
    await current.get('[data-requirement-key="business"]').findAll("button").find(button => button.text() === "读取专题数据")!.trigger("click"); await flushPromises()
    await vi.waitFor(() => expect((current.emitted("change")!.at(-1)![0] as any[])).toHaveLength(1))
    const layers = current.emitted("change")!.at(-1)![0] as any[]
    expect(layers[0].data.features[0].properties.rain_mm).toBe("12.4")
    expect(layers[0].onlineSource.collection).toBe(item.collection)
    expect(layers[0].onlineSource.rendering.parameters.inputOnly).toBe(true)
    expect(mapWork.showWorkflowLayer).not.toHaveBeenCalled()
    expect(current.text()).toContain("待应用表达方法")
  })
  it("renders a manually selected backend item outside legacy item and collection lists", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const current = open(); await flushPromises()
    const item = { ...pop, id: "station-DEMO-test", collection: "new-backend-catalog", properties: { title: "后台原始地名", "proj:epsg": 4326 }, assets: { points: { href: "http://192.168.10.15:9002/rs-products/test/points.geojson", type: "application/geo+json" } } }
    const feature = { type: "Feature", properties: { NAME: "原始地名" }, geometry: { type: "Point", coordinates: [102, 30] } }
    fetcher.mockImplementation(async (url: string) => response(url.includes("/files/") ? { type: "FeatureCollection", features: [feature] } : item))
    current.getComponent(BackendLayerPicker).vm.$emit("assign", { item, key: "settlement", asset: "points" })
    await vi.waitFor(() => expect(mapWork.showWorkflowLayer).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect((current.emitted("change")!.at(-1)![0] as any[])[0]?.onlineSource?.itemId).toBe(item.id))
    const layer = (current.emitted("change")!.at(-1)![0] as any[])[0]
    expect(layer.onlineSource.collection).toBe(item.collection)
    expect(layer.data.features[0].geometry).toEqual(feature.geometry)
    expect(layer.onlineSource.rendering.engine).toBe("Mars3D.GeoJsonLayer")
  })
  it("does not query globally before the user confirms a selection", () => { const current = open(null); expect(fetcher).not.toHaveBeenCalled(); expect(current.text()).toContain("尚未确认地图框选范围"); expect(current.text()).toContain("人口分布"); expect(current.text()).toContain("房屋建筑分布") })
  it("sends the exact selected bounds and keeps missing requirements", async () => {
    const current = open(); await query(current)
    expect(JSON.parse(fetcher.mock.calls[0][1].body).bbox).toEqual([101, 29, 103, 31])
    expect(current.get('select[aria-label="人口分布数据条目"]').findAll("option")).toHaveLength(2)
    expect(current.text()).toContain("房屋建筑分布"); expect(current.text()).toContain("不代表后台没有数据")
    expect(current.text()).not.toContain("示意烈度")
  })
  it("binds real data identity, statistics and scope to both map and document", async () => {
    const current = open(); await query(current); await render(current)
    expect(mapWork.showWorkflowLayer).toHaveBeenCalledOnce()
    const events = current.emitted("change")!; const layers: any = events[events.length - 1][0]
    expect(layers[0].onlineSource).toMatchObject({ itemId: pop.id, revision: "r1", scope, statistics: { minimum: 0 } })
    expect(layers[0].onlineSource.rendering.engine).toBe("Mars3D.XyzLayer")
    expect((mapWork.showWorkflowLayer as any).mock.calls[0][1]).toHaveProperty("raster.url")
    expect((mapWork.showWorkflowLayer as any).mock.calls[0][1]).not.toHaveProperty("image")
    expect(backendRasterLayer).not.toHaveBeenCalled()
    expect(layers[0].raster.image).toBe("")
    expect(layers[0].onlineSource.rendering).not.toHaveProperty("proofUrl")
    expect(current.text()).toContain("已渲染 · 待核验"); expect(current.text()).toContain("不推算人口总数")
    await current.setProps({ bounds: { ...scope, east: 102 } })
    expect(current.emitted("change")!.at(-1)![0]).toEqual([])
    expect(mapWork.clearWorkflowLayers).toHaveBeenCalled()
    expect(current.text()).not.toContain("已渲染 · 待核验")
  })
  it("clears bindings when a rendering parameter changes", async () => {
    const current = open(); await query(current); await render(current)
    await current.findAll('input[type="number"]')[0].setValue(20)
    expect(current.emitted("change")!.at(-1)![0]).toEqual([])
  })
  it("keeps native visibility and opacity synchronized with the document", async () => {
    const current = open(); await query(current); await render(current)
    await current.get('input[aria-label="人口分布透明度"]').setValue("0.4")
    expect(mapWork.updateWorkflowPresentation).toHaveBeenLastCalledWith("population", expect.objectContaining({ opacity: 0.4 }))
    expect((current.emitted("change")!.at(-1)![0] as any)[0].opacity).toBe(0.4)
    await current.get('input[aria-label="人口分布显示"]').setValue(false)
    expect((current.emitted("change")!.at(-1)![0] as any)[0].enabled).toBe(false)
  })
  it("retains locked breaks for a new query scope, but does not reuse old images", async () => {
    const current = open(); await query(current); await render(current)
    await current.findAll("button").find(b => b.text().includes("固定当前分级断点"))!.trigger("click")
    expect(current.get('input[aria-label="人口分布固定断点1"]').element.value).toBe("10")
    await current.setProps({ bounds: { ...scope, east: 102 } }); await query(current)
    expect(current.get('input[aria-label="人口分布固定断点1"]').element.value).toBe("10")
    expect(current.emitted("change")!.at(-1)![0]).toEqual([])
  })
  it("invalidates success and the proof when native XYZ reports a tile failure", async () => {
    const current = open(); await query(current); await render(current)
    const request = vi.mocked(mapWork.showWorkflowLayer).mock.calls[0][1]
    request.onError!("后端 XYZ 瓦片读取失败")
    await flushPromises()
    expect(current.text()).not.toContain("已渲染 · 待核验")
    expect(current.text()).toContain("读取失败")
    expect(current.emitted("change")!.at(-1)![0]).toEqual([])
  })
  it("does not open a stale composition while the parent is regenerating its regions", async () => {
    const current = open(); await query(current); await render(current)
    const button = current.findAll("button").find(b => b.text().includes("排版校样"))!
    await current.setProps({ composeReady: false })
    expect(button.attributes("disabled")).toBeDefined()
    await button.trigger("click"); expect(current.emitted("compose")).toBeUndefined()
    await current.setProps({ composeReady: true })
    expect(button.attributes("disabled")).toBeUndefined()
    await button.trigger("click"); expect(current.emitted("compose")).toHaveLength(1)
  })
  it("reports backend failure separately from a genuine empty result", async () => {
    fetcher.mockRejectedValue(new TypeError("offline")); const current = open(); await query(current)
    expect(current.text()).toContain("读取失败"); expect(current.text()).toContain("内网/VPN")
    fetcher.mockResolvedValue(response({ type: "FeatureCollection", features: [] })); await query(current)
    expect(current.text()).toContain("未匹配到该类图层"); expect(current.text()).toContain("后端目录仍可选择")
  })
  it("saves configuration and provenance without treating cached pixels as current data", async () => {
    const current = open(); await query(current); await render(current)
    await current.findAll("button").find(b => b.text().includes("保存数据配置"))!.trigger("click")
    const saved = JSON.parse(localStorage.getItem("mars3d.cartography.workflow.v1")!)
    expect(saved.topic).toBe("T30102000"); expect(saved.provenance[0].itemId).toBe(pop.id); expect(saved).not.toHaveProperty("image")
    expect(saved).not.toHaveProperty("features")
    expect(saved).not.toHaveProperty("bindings")
    expect(current.get(".local-data-draft > summary").text()).toBe("图层方案")
    expect(current.get('[aria-label="地图图层列表"]').text()).toContain("人口分布")
    expect(current.text()).not.toContain("本机数据配置")
    const previousCalls = fetcher.mock.calls.length
    await current.findAll("button").find(b => b.text().includes("恢复数据配置"))!.trigger("click"); await flushPromises()
    expect(fetcher.mock.calls.length).toBeGreaterThan(previousCalls)
    expect(current.emitted("change")!.at(-1)![0]).toEqual([])
    expect(current.text()).toContain("重新渲染")
  })
  it("does not restore saved geometry or report success when automatic backend matching fails", async () => {
    localStorage.setItem("mars3d.cartography.workflow.v1", JSON.stringify({ version: 1, topic: "point-heat", scope, bindings: { cached: { data: { features: [{ properties: { value: 999 } }] } } }, image: "data:image/png;base64,cached" }))
    fetcher.mockRejectedValue(new TypeError("offline"))
    wrapper = mount(CartographyDataWorkflow, { props: { bounds: scope, topic: "point-heat", active: true, autoMatch: true }, global: { stubs: { "mars-icon": true } } })
    await vi.waitFor(() => expect(wrapper!.find('[role="alert"]').exists()).toBe(true))
    await wrapper.findAll("button").find(button => button.text() === "恢复数据配置")!.trigger("click")
    await vi.waitFor(() => expect(wrapper!.text()).toContain("后端目录读取失败，图层方案尚未恢复"))
    expect(wrapper.text()).not.toContain("已恢复配置")
    expect(wrapper.emitted("change")!.at(-1)![0]).toEqual([])
    expect(mapWork.showWorkflowLayer).not.toHaveBeenCalled()
    expect(fetcher.mock.calls.every(call => String(call[0]).startsWith("/api/thematic/"))).toBe(true)
  })
  it("queries automatically and keeps technical evidence collapsed until requested", async () => {
    const current = open(); await flushPromises()
    expect(fetcher).toHaveBeenCalled()
    expect(current.get('select[aria-label="人口分布数据条目"]').exists()).toBe(true)
    expect(current.text()).toContain("可叠加")
    await render(current)
    const details = current.get('section[aria-label="人口分布"] .layer-provenance')
    expect(details.attributes("open")).toBeUndefined()
    expect(details.text()).toContain("Mars3D.XyzLayer")
    expect(current.get(".local-data-draft").attributes("open")).toBeUndefined()
    expect(current.findAll("button").find(b => b.text() === "查看地图")!.attributes("disabled")).toBeUndefined()
    await current.findAll("button").find(b => b.text() === "查看地图")!.trigger("click")
    expect(current.emitted("view-map")).toHaveLength(1)
    expect(current.text()).toContain("资料状态与图件业务审核分别记录")
  })
  it("prepares print pixels on demand without replacing the native map layer", async () => {
    const current = open(); await query(current); await render(current)
    expect(backendRasterLayer).not.toHaveBeenCalled()
    expect(await (current.vm as any).prepareComposition()).toBe(true)
    const layer: any = current.emitted("change")!.at(-1)![0][0]
    expect(layer.raster.image).toContain("data:image/png")
    expect(layer.onlineSource.rendering.sourceWidth).toBe(3200)
    expect(layer.onlineSource.rendering.tileUrl).toBe("backend-xyz")
    expect(mapWork.showWorkflowLayer).toHaveBeenCalledTimes(1)
    expect(await (current.vm as any).prepareComposition()).toBe(true)
    expect(backendRasterLayer).toHaveBeenCalledTimes(1)
  })
  it("retains a working map layer when preparing a print fails", async () => {
    const current = open(); await query(current); await render(current)
    vi.mocked(backendRasterLayer).mockRejectedValueOnce(new Error("print service offline"))
    vi.mocked(mapWork.clearWorkflowLayers).mockClear()
    expect(await (current.vm as any).prepareComposition()).toBe(false)
    expect(current.text()).toContain("print service offline")
    expect((current.emitted("change")!.at(-1)![0] as any[])).toHaveLength(1)
    expect(mapWork.clearWorkflowLayers).not.toHaveBeenCalled()
    expect(current.text()).toContain("已渲染 · 待核验")
  })
  it("changing print DPI does not remove or reload the native map", async () => {
    const current = open(); await query(current); await render(current)
    vi.mocked(mapWork.clearWorkflowLayers).mockClear()
    await current.get('select[aria-label="人口分布源图DPI"]').setValue("600")
    expect(mapWork.clearWorkflowLayers).not.toHaveBeenCalled()
    expect(mapWork.showWorkflowLayer).toHaveBeenCalledTimes(1)
    expect((current.emitted("change")!.at(-1)![0] as any[])).toHaveLength(1)
  })
  it("rejects a source revision change before printing without clearing the map", async () => {
    const current = open(); await query(current); await render(current)
    fetcher.mockResolvedValue(response({ ...pop, properties: { ...pop.properties, updated: "r2" } }))
    expect(await (current.vm as any).prepareComposition()).toBe(false)
    expect(current.text()).toContain("版本已变化")
    expect(backendRasterLayer).not.toHaveBeenCalled()
    expect((current.emitted("change")!.at(-1)![0] as any[])).toHaveLength(1)
  })
  it("revalidates actual vector source revisions before composition as well", async () => {
    vi.stubGlobal("crypto", { subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) } })
    let revision = "r1"
    const assessment = { ...pop, id: "SP-jiuzhaigou2017-intensity", bbox: [103, 32, 105, 35], assets: { data: { href: "http://192.168.10.15:9002/rs-products/intensity.geojson", type: "application/geo+json" } } }
    const polygon = { type: "Feature", properties: { intensity: 7 }, geometry: { type: "Polygon", coordinates: [[[103.1, 33], [104, 33], [104, 33.5], [103.1, 33.5], [103.1, 33]]] } }
    fetcher.mockImplementation(async (url: string) => {
      if (url.endsWith("/search")) { return response({ type: "FeatureCollection", features: [assessment] }) }
      if (url.startsWith("/api/thematic/files")) { return response({ type: "FeatureCollection", features: [polygon] }) }
      return response({ ...assessment, properties: { ...assessment.properties, updated: revision } })
    })
    const current = open({ west: 103, south: 32.5, east: 104.5, north: 34 }, "T30201000")
    await query(current); await render(current)
    expect((current.emitted("change")!.at(-1)![0] as any[])[0].onlineSource.rendering.engine).toBe("Mars3D.GeoJsonLayer")
    revision = "r2"
    expect(await (current.vm as any).prepareComposition()).toBe(false)
    expect(current.text()).toContain("版本已变化")
    expect((current.emitted("change")!.at(-1)![0] as any[])).toHaveLength(1)
  })
  it("does not restore a layer whose native tiles fail during print preparation", async () => {
    const current = open(); await query(current); await render(current)
    let finish!: (result: any) => void
    const proof = vi.mocked(backendRasterLayer).mock.results[0]?.value
    vi.mocked(backendRasterLayer).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = (current.vm as any).prepareComposition()
    await flushPromises()
    const input = vi.mocked(mapWork.showWorkflowLayer).mock.calls[0][1]
    input.onError!("native tile failed")
    finish(await proof || { image: "data:image/png;base64,AA==", fingerprint: "a".repeat(64), tileUrl: "backend-xyz" })
    expect(await pending).toBe(false)
    expect(current.emitted("change")!.at(-1)![0]).toEqual([])
  })
})
