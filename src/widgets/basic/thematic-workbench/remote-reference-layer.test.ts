import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { captureStandardMapPreview, clearRemoteReference, flyToRemoteReference, getBusinessDataSources, onMounted, pickRemoteReferencePoint, showRemoteReference, showWorkflowLayer, clearWorkflowLayers, updateWorkflowPresentation } from "./map"

const state = vi.hoisted(() => ({ layers: [] as any[], nextReady: undefined as Promise<unknown> | undefined }))
vi.mock("mars3d", () => {
  class BaseClass { on = vi.fn(); off = vi.fn(); fire = vi.fn() }
  class Layer {
    graphics: any[] = []
    options: any; id: string; readyPromise: Promise<unknown>; handlers: Record<string, (...args: any[]) => void> = {}
    constructor(options: any) { this.options = options; this.id = options.id; this.readyPromise = state.nextReady || Promise.resolve(); state.layers.push(this) }
    on(name: string, handler: (...args: any[]) => void) { this.handlers[name] = handler }
  }
  return { BaseClass, layer: { XyzLayer: Layer, GeoJsonLayer: Layer, ImageLayer: Layer }, EventType: { click: "click", addTileError: "addTileError" }, LngLatPoint: { fromCartesian: (value: any) => value } }
})
vi.mock("./composition-symbols", () => ({ compositionSymbolImage: () => "" }))

let fakeMap: any
const raster = { url: "/api/thematic/tiles/collections/a/items/b/tiles/{z}/{x}/{y}", bounds: { west: 100, south: 28, east: 104, north: 32 }, minZoom: 0, maxZoom: 20 }
beforeEach(() => {
  state.layers = []; state.nextReady = undefined
  fakeMap = { addLayer: vi.fn(), removeLayer: vi.fn(), flyToExtent: vi.fn(), scene: { requestRender: vi.fn() }, on: vi.fn(), off: vi.fn(), getLayers: () => state.layers }
  onMounted(fakeMap)
})
afterEach(() => { clearRemoteReference() })

describe("remote reference map layer ownership", () => {
  it("uses the explicit reference polygon style without changing source properties", async () => {
    const document = { type: "FeatureCollection" as const, metadata: {}, features: [] }
    const vectorStyle = { color: "#e9e2cc", outlineColor: "#786b45" }
    await showWorkflowLayer("fault-reference", { name: "断裂带范围参考", document: document as any, vectorStyle, opacity: 1 }, new AbortController().signal)
    expect(state.layers[0].options.data).toBe(document)
    expect(state.layers[0].options.symbol.styleOptions).toMatchObject(vectorStyle)
  })
  it("loads backend XYZ in native geography instead of a locally painted image", async () => {
    await showWorkflowLayer("imagery", { name: "后台真彩色", raster, opacity: 1 }, new AbortController().signal)
    expect(state.layers[0].options.url).toBe(raster.url)
    expect(state.layers[0].options.minimumLevel).toBe(raster.minZoom)
    expect(state.layers[0].options.rectangle).toEqual({ xmin: 100, xmax: 104, ymin: 28, ymax: 32 })
    expect(state.layers[0].options.url).not.toContain("data:image")
  })
  it("hides native tile opacity and restores the selected opacity without reloading data", async () => {
    await showWorkflowLayer("imagery", { name: "后台影像", raster, opacity: 0.6 }, new AbortController().signal)
    const layer = state.layers[0]; layer.isTile = true
    updateWorkflowPresentation("imagery", { enabled: false })
    expect(layer.show).toBe(false)
    expect(layer.opacity).toBe(0)
    updateWorkflowPresentation("imagery", { enabled: true })
    expect(layer.show).toBe(true)
    expect(layer.opacity).toBe(0.6)
    expect(fakeMap.addLayer).toHaveBeenCalledTimes(1)
  })
  it("keeps multiple task layers in their true geographic bounds and removes them individually", async () => {
    const input = { name: "真实窗口", image: "data:image/png;base64,AA==", bounds: raster.bounds, opacity: 1 }
    await showWorkflowLayer("population", input, new AbortController().signal)
    await showWorkflowLayer("imagery", input, new AbortController().signal)
    expect(state.layers[0].options.rectangle).toEqual({ xmin: 100, xmax: 104, ymin: 28, ymax: 32 })
    expect(state.layers[1].id).not.toBe(state.layers[0].id)
    clearWorkflowLayers("population")
    expect(fakeMap.removeLayer).toHaveBeenCalledWith(state.layers[0], true)
    expect(fakeMap.removeLayer).not.toHaveBeenCalledWith(state.layers[1], true)
    clearWorkflowLayers()
    expect(fakeMap.removeLayer).toHaveBeenCalledWith(state.layers[1], true)
  })
  it("cancels a pending task layer without removing a replacement layer", async () => {
    state.nextReady = new Promise(() => {})
    const controller = new AbortController()
    const pending = showWorkflowLayer("population", { name: "旧", image: "data:image/png;base64,AA==", bounds: raster.bounds, opacity: 1 }, controller.signal)
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" })
    state.nextReady = undefined
    await showWorkflowLayer("population", { name: "新", image: "data:image/png;base64,AA==", bounds: raster.bounds, opacity: 1 }, new AbortController().signal)
    controller.abort(); await rejected
    expect(fakeMap.removeLayer).not.toHaveBeenCalledWith(state.layers[1], true)
  })
  it("uses the original geographic bounds and never exposes reference data as business input", async () => {
    await showRemoteReference({ name: "在线人口", raster })
    expect(state.layers[0].options.rectangle).toEqual({ xmin: 100, xmax: 104, ymin: 28, ymax: 32 })
    expect(getBusinessDataSources()).toEqual([])
    flyToRemoteReference(raster.bounds)
    expect(fakeMap.flyToExtent).toHaveBeenCalledWith({ xmin: 100, xmax: 104, ymin: 28, ymax: 32 }, { duration: 0.8 })
    await expect(captureStandardMapPreview()).rejects.toThrow("在线参考图层")
  })
  it("removes the old layer rather than leaving overlays behind after changing data", async () => {
    await showRemoteReference({ name: "人口", raster })
    const first = state.layers[0]
    await showRemoteReference({ name: "GDP", raster })
    expect(fakeMap.removeLayer).toHaveBeenCalledWith(first, true)
    clearRemoteReference()
    expect(fakeMap.removeLayer).toHaveBeenLastCalledWith(state.layers[1], true)
  })
  it("immediately rejects a cancelled load even if the map library never resolves its ready promise", async () => {
    state.nextReady = new Promise(() => {})
    const controller = new AbortController()
    const pending = showRemoteReference({ name: "取消读取", raster }, controller.signal)
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" })
    controller.abort(); await rejected
    expect(fakeMap.removeLayer).toHaveBeenCalledWith(state.layers[0], true)
  })
  it("ignores a previous layer that completes after a replacement", async () => {
    let release!: () => void
    state.nextReady = new Promise<void>(resolve => { release = resolve })
    const first = showRemoteReference({ name: "旧图层", raster })
    const rejected = expect(first).rejects.toThrow("替换")
    state.nextReady = undefined
    await showRemoteReference({ name: "新图层", raster })
    release(); await rejected
    expect(fakeMap.removeLayer).not.toHaveBeenCalledWith(state.layers[1], true)
  })
  it("detaches point query handlers when clearing a reference layer", async () => {
    await showRemoteReference({ name: "人口", raster })
    const callback = vi.fn()
    pickRemoteReferencePoint(callback)
    const handler = fakeMap.on.mock.calls[0][1]
    handler({ cartesian: { lng: 102, lat: 29 } })
    expect(callback).toHaveBeenCalledWith(102, 29)
    clearRemoteReference()
    expect(fakeMap.off).toHaveBeenCalledWith("click", handler)
  })
})
