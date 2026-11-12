import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prepareResultMap, submitResultMap, loadPublishedMap, queryResultMap, mapPublicationHash, type PreparedMapPublication } from "./result-map-publication"
import { refreshRemoteItem, type RemoteItem } from "./remote-cartography-source"
import { getThematicFlow, runThematicFlow, getThematicJob } from "./thematic-backend"
import type { DbtLayer } from "./dbt116-standard"
import { confirmInternalReview, internalReviewChecks } from "./internal-map-review"
import { readBackendEventVector } from "./backend-event-parameters"

vi.mock("./remote-cartography-source", async original => ({ ...await original<typeof import("./remote-cartography-source")>(), refreshRemoteItem: vi.fn() }))
vi.mock("./thematic-backend", () => ({ getThematicFlow: vi.fn(), runThematicFlow: vi.fn(), getThematicJob: vi.fn() }))
const bounds = { west: 103, south: 29, east: 105, north: 31 }
const source = (): RemoteItem => ({ type: "Feature", collection: "spatial-thematic", id: "backend-targets", bbox: [103, 29, 105, 31], properties: { title: "后台目标", updated: "2026-11-01T00:00:00Z", "proj:epsg": 4326 }, assets: { data: { href: "http://192.168.10.15:9002/rs-products/targets.geojson", type: "application/geo+json" } } })
const data = { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "后台医院", category: "hospital" }, geometry: { type: "Point", coordinates: [104, 30] } }] }
let prepared: PreparedMapPublication
let fetcher: ReturnType<typeof vi.fn>
let published: RemoteItem
const jobId = "019a0000-0000-0000-0000-000000000001"
async function layer(): Promise<DbtLayer> {
  return { id: "online:target", name: "医院", role: "target", source: source().assets.data.href, authority: "", publishedAt: "", crs: "EPSG:4326", security: "", scale: 0, data: data as any, onlineSource: { collection: source().collection, itemId: source().id, asset: "data", revision: source().properties.updated, sourceItemSha256: await mapPublicationHash(source()), fingerprint: "a".repeat(64), scope: bounds, rendering: { engine: "Mars3D.GeoJsonLayer", kind: "真实目标", parameters: {} } } }
}
async function prepare(layers?: DbtLayer[]) {
  const source = { title: "后台医院分布", topic: "T30103000", layers: layers || [await layer()], bounds }
  const internalReview = await confirmInternalReview(source, "测试审核人（非生产）", "仅验证内部审核记录，不作为实际业务审核", internalReviewChecks.map(check => check.id))
  return prepareResultMap({ ...source, formal: false, internalReview })
}
beforeEach(async () => {
  vi.resetAllMocks(); vi.stubGlobal("crypto", webcrypto)
  fetcher = vi.fn(async (url: string) => url.startsWith("/api/thematic/stac/") ? new Response("", { status: 404 }) : new Response(JSON.stringify(data)))
  vi.stubGlobal("fetch", fetcher)
  vi.mocked(refreshRemoteItem).mockImplementation(async item => item.id === source().id ? source() : published)
  vi.mocked(getThematicFlow).mockResolvedValue({ path: "u/fyt/earth/result_flow", summary: "成果汇交", schema: { properties: { receive_type: { enum: ["batch_import"] }, batch_data: { type: "array" } } } })
  vi.mocked(runThematicFlow).mockResolvedValue(jobId)
  prepared = await prepare()
  const id = prepared.snapshot.layers[0].parts[0].id
  published = { ...source(), collection: "thematic-map", id, properties: { "cartography:map_sha256": prepared.fingerprint, "cartography:map_view": prepared.snapshot }, assets: { data: { href: `http://192.168.10.15:9002/rs-products/results/generic/${id}/targets.geojson`, type: "application/geo+json" } } }
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("existing result_flow online map pipeline", () => {
  it.each([undefined, "grid", "fill"])("reopens background grids with faithful reference legend, labels and display mode (%s)", async display => {
    const background = { ...source(), collection: "thermal-background", id: "background-reopen-unit", properties: { ...source().properties, "background:field_type": "thermal", "background:grid_size_deg": 1, "background:samples": 1 } }
    const raw = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[103, 29], [104, 29], [104, 30], [103, 30], [103, 29]]] }, properties: { mean: 271.123, std: 0, count: 1, latest: 271.123 } }] }
    fetcher.mockImplementation(async () => new Response(JSON.stringify(raw)))
    vi.mocked(refreshRemoteItem).mockImplementation(async item => item.id === background.id ? background : published)
    const input = await layer(); input.data = raw as any; input.role = "imagery"
    input.onlineSource = { ...input.onlineSource!, collection: background.collection, itemId: background.id, sourceItemSha256: await mapPublicationHash(background), rendering: { engine: "Mars3D.GeoJsonLayer", kind: "背景原值", parameters: { vectorField: "mean", ...(display ? { resultDisplay: display } : {}) } } }
    const snapshot = structuredClone(prepared.snapshot)
    snapshot.usage = "internal-proof"; delete snapshot.internalReview
    snapshot.layers[0].source = background
    snapshot.layers[0].layer.onlineSource = input.onlineSource
    snapshot.layers[0].layer.role = "imagery"
    snapshot.layers[0].parts[0].sha256 = await mapPublicationHash(raw)
    const id = snapshot.layers[0].parts[0].id
    published = { ...published, id, properties: { "cartography:map_sha256": await mapPublicationHash(snapshot), "cartography:map_view": snapshot } }
    const reopened = (await loadPublishedMap(id)).layers[0]
    expect(reopened.symbol?.styleOptions.fill).toBe(display === "fill")
    expect(reopened.layer.onlineSource?.rendering?.parameters?.resultDisplay).toBe(display === "fill" ? "fill" : "grid")
    expect(reopened.layer.colorStandard).toContain("单景背景，不能计算时间基线异常")
    if (display !== "fill") {
      expect(reopened.layer.legend?.[0]).toMatchObject({ shape: "line" })
      expect(reopened.labels?.[0].text).toBe("271.123")
    }
    expect(runThematicFlow).not.toHaveBeenCalled()
  })
  it("keeps independent expression descriptors for multiple layers", async () => {
    const first = await layer(); const second = { ...await layer(), id: "online:second" }
    for (const entry of [first, second]) { entry.onlineSource!.rendering!.parameters = { expression: { kind: "unique-value", fingerprint: "e".repeat(64), options: { field: "category", unit: "类别" } } } }
    const result = await prepare([first, second])
    expect(result.snapshot.layers).toHaveLength(2)
    expect(result.snapshot.layers.map(entry => entry.layer.id)).toEqual([first.id, second.id])
  })
  it("refuses to publish an unrendered expression input", async () => {
    const input = await layer(); input.onlineSource!.rendering!.parameters = { inputOnly: true }
    await expect(prepare([input])).rejects.toThrow("尚未渲染")
    expect(runThematicFlow).not.toHaveBeenCalled()
  })
  it("reopens a real raw backend file using its recorded expression field and palette", async () => {
    const raw = { ...data, features: [{ ...data.features[0], properties: { ...data.features[0].properties, rain_mm: "12.4" } }] }
    fetcher.mockImplementation(async () => new Response(JSON.stringify(raw)))
    const input = await layer(); input.data = raw as any; input.onlineSource!.rendering!.parameters = { expression: { kind: "graduated-symbol", fingerprint: "e".repeat(64), options: { field: "rain_mm", unit: "mm", palette: "green" } } }
    prepared = await prepare([input])
    const id = prepared.snapshot.layers[0].parts[0].id
    published = { ...published, id, properties: { "cartography:map_sha256": prepared.fingerprint, "cartography:map_view": prepared.snapshot }, assets: { data: { href: `http://192.168.10.15:9002/rs-products/results/generic/${id}/targets.geojson` } } }
    const reopened = await loadPublishedMap(id)
    expect(reopened.layers[0].scene?.rows[0].value).toBe(12.4)
    expect(reopened.layers[0].scene?.unit).toBe("mm")
    expect(reopened.layers[0].document?.features[0].properties.rain_mm).toBe("12.4")
    expect(reopened.layers[0].symbol).toBeUndefined()
  })
  it("prepares isolated MinIO/STAC inputs without an artifact repository or a proposed task API", () => {
    expect(prepared.args).toMatchObject({ receive_type: "batch_import", visibility: "internal", source_system: "mars3d-thematic-workbench", batch_data: [{ result_type: "generic", collection_id: "thematic-map", file: "minio://rs-products/targets.geojson" }] })
    expect(prepared.snapshot.usage).toBe("internal-reviewed")
    expect(prepared.snapshot.internalReview?.reviewer).toBe("测试审核人（非生产）")
    expect(prepared.snapshot.layers[0].parts[0].id).toMatch(/^MAP-[a-f\d-]{36}-1$/)
    expect(JSON.stringify(prepared.args)).not.toContain("5960")
    expect(JSON.stringify(prepared.args)).not.toContain("/thematics/")
  })
  it("hashes JSON deterministically across STAC JSONB property reordering", async () => {
    expect(await mapPublicationHash({ b: 2, a: { d: 3, c: 4 } })).toBe(await mapPublicationHash({ a: { c: 4, d: 3 }, b: 2 }))
  })
  it("does not block a human-reviewed backend map because source IDs, titles or filenames contain test/demo words", async () => {
    const backend = source(); backend.id = "DEMO-test-targets"; backend.properties.title = "测试命名的真实后端数据"; backend.assets.data.href = "http://192.168.10.15:9002/rs-products/demo/test-targets.geojson"
    vi.mocked(refreshRemoteItem).mockResolvedValueOnce(backend)
    const current = await layer(); current.source = backend.assets.data.href; current.onlineSource = { ...current.onlineSource!, itemId: backend.id, sourceItemSha256: await mapPublicationHash(backend) }
    const prepared = await prepare([current])
    expect(prepared.snapshot.usage).toBe("internal-reviewed")
    expect((prepared.args.batch_data as any[])[0].file).toBe("minio://rs-products/demo/test-targets.geojson")
  })
  it("rejects changed source versions, mismatched AOIs and local-only layers", async () => {
    vi.mocked(refreshRemoteItem).mockResolvedValueOnce({ ...source(), properties: { ...source().properties, updated: "changed" } })
    await expect(prepare()).rejects.toThrow("版本已变化")
    const item = await layer(); item.onlineSource!.scope = { ...bounds, east: 106 }
    await expect(prepare([item])).rejects.toThrow("当前范围")
    await expect(prepare([{ ...await layer(), onlineSource: undefined }])).rejects.toThrow("来源或内容无效")
  })
  it("never publishes an event summary alone or ordinary downloads as map services", async () => {
    await expect(prepare([{ ...await layer(), role: "event" }])).rejects.toThrow("仅有震中摘要")
    const pdf = source(); pdf.assets.data.href = "http://192.168.10.15:9002/rs-products/map.pdf"
    vi.mocked(refreshRemoteItem).mockResolvedValueOnce(pdf)
    const item = await layer(); item.onlineSource!.sourceItemSha256 = await mapPublicationHash(pdf)
    await expect(prepare([item])).rejects.toThrow("普通文件不算地图服务")
  })
  it("requires manual review and refuses a review reused after a style or title change", async () => {
    const source = { title: "医院分布", topic: "T30103000", bounds, layers: [await layer()], formal: false }
    await expect(prepareResultMap(source)).rejects.toThrow("人工审核")
    const internalReview = await confirmInternalReview(source, "测试人", "内部测试用途", internalReviewChecks.map(check => check.id))
    await expect(prepareResultMap({ ...source, title: "改变标题", internalReview })).rejects.toThrow("重新审核")
    source.layers[0].opacity = 0.5
    await expect(prepareResultMap({ ...source, internalReview })).rejects.toThrow("重新审核")
  })
  it("carries a genuine STAC event summary as an audited sidecar without manufacturing a file", async () => {
    const event = { ...source(), id: "SP-jiuzhaigou2017-intensity", properties: { "proj:epsg": 4326, datetime: "2017-08-08T13:19:00Z", "event:epicenter": [104, 30], "eq:magnitude": 7, "event:place": "随包地名", "event:source": "后台随包参数表" } }
    const document = readBackendEventVector(event, bounds)
    const eventLayer = { ...await layer(), id: "online:event", name: "震中参数", role: "event", data: document, source: `http://192.168.10.15:5951/collections/spatial-thematic/items/${event.id}` }
    eventLayer.onlineSource = { ...eventLayer.onlineSource!, itemId: event.id, asset: "properties", sourceItemSha256: await mapPublicationHash(event) }
    vi.mocked(refreshRemoteItem).mockImplementation(async item => { if (item.id === event.id) { return event }; return item.id === source().id ? source() : published })
    prepared = await prepare([eventLayer, await layer()])
    expect((prepared.args.batch_data as any[])).toHaveLength(1)
    expect(prepared.snapshot.layers[0]).toMatchObject({ derived: "stac-event-parameters", parts: [] })
    const id = prepared.snapshot.layers[1].parts[0].id
    published = { ...published, id, properties: { "cartography:map_sha256": prepared.fingerprint, "cartography:map_view": prepared.snapshot }, assets: { data: { href: `http://192.168.10.15:9002/rs-products/results/generic/${id}/targets.geojson` } } }
    const reopened = await loadPublishedMap(id)
    expect(reopened.layers[0].document?.features).toEqual(document.features)
    expect(reopened.layers[0].symbol?.type).toBe("billboard")
    expect(reopened.layers[1].document?.features).toHaveLength(1)
  })
  it("rejects external or artifact-store source files", async () => {
    const external = source(); external.assets.data.href = "http://192.168.10.15:5960/uploads/artifacts/abc.geojson"
    vi.mocked(refreshRemoteItem).mockResolvedValueOnce(external)
    const item = await layer(); item.onlineSource!.sourceItemSha256 = await mapPublicationHash(external)
    await expect(prepare([item])).rejects.toThrow("已配置的数据服务")
  })
  it("rejects mutations to either the snapshot or the submitted payload before dispatch", async () => {
    prepared.args.visibility = "public"
    await expect(submitResultMap("token", prepared, () => {})).rejects.toThrow("提交参数")
    expect(runThematicFlow).not.toHaveBeenCalled()
  })
  it("requires a current reviewed-document fingerprint before using an operational label", async () => {
    await expect(prepareResultMap({ title: "正式图件", topic: "T30103000", bounds, layers: [await layer()], formal: true })).rejects.toThrow("本次已复核图件")
  })
  it("rejects canonical business IDs even in otherwise rehashed configuration", async () => {
    prepared.snapshot.id = "SP-china-pop2020"
    await expect(submitResultMap("token", prepared, () => {})).rejects.toThrow("独立 MAP 版本")
    expect(runThematicFlow).not.toHaveBeenCalled()
  })
  it("preflights IDs, rechecks current inputs and only invokes the documented Windmill flow", async () => {
    const check = vi.fn(); const dispatched = vi.fn()
    expect(await submitResultMap("token", prepared, check, undefined, dispatched)).toBe(jobId)
    expect(check).toHaveBeenCalledTimes(2); expect(dispatched).toHaveBeenCalledOnce()
    expect(runThematicFlow).toHaveBeenCalledWith("token", "result_flow", prepared.args, true, undefined)
  })
  it("does not overwrite existing IDs or dispatch after an uncertain preflight", async () => {
    fetcher.mockResolvedValueOnce(new Response("{}"))
    await expect(submitResultMap("token", prepared, () => {})).rejects.toThrow("阻止覆盖")
    fetcher.mockResolvedValueOnce(new Response("", { status: 503 }))
    await expect(submitResultMap("token", prepared, () => {})).rejects.toThrow("编号冲突")
    expect(runThematicFlow).not.toHaveBeenCalled()
  })
  it("reopens vector bytes from the new MinIO path with the same AOI and fingerprint", async () => {
    const map = await loadPublishedMap(published.id, prepared.fingerprint)
    expect(map.snapshot.bounds).toEqual(bounds)
    expect(map.layers[0].document!.features[0].geometry).toEqual(data.features[0].geometry)
    expect(map.layers[0].document!.metadata.source).toContain(`/results/generic/${published.id}/`)
    expect(map.fingerprint).toBe(prepared.fingerprint)
  })
  it("treats 404, modified file bytes and wrong map fingerprints as failures", async () => {
    fetcher.mockResolvedValueOnce(new Response("missing", { status: 404 }))
    await expect(loadPublishedMap(published.id)).rejects.toThrow("HTTP 404")
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...data, features: [] })))
    await expect(loadPublishedMap(published.id)).rejects.toThrow("指纹不一致")
    await expect(loadPublishedMap(published.id, "f".repeat(64))).rejects.toThrow("指纹不匹配")
  })
  it("does not call a job receipt or a partial result a verified map", async () => {
    vi.mocked(getThematicJob).mockResolvedValueOnce({ state: "running", status: {}, result: null })
    expect((await queryResultMap("token", jobId, prepared)).state).toBe("running")
    vi.mocked(getThematicJob).mockResolvedValueOnce({ state: "succeeded", status: {}, result: { received: 1, published: 1, failed: 0 } })
    await expect(queryResultMap("token", jobId, prepared)).rejects.toThrow("未完整发布")
    vi.mocked(getThematicJob).mockResolvedValueOnce({ state: "succeeded", status: {}, result: { received: 1, published: 1, failed: 0, results: [{ result_id: published.id, status: "published" }] } })
    expect((await queryResultMap("token", jobId, prepared)).state).toBe("verified")
  })

  async function raster() {
    const rasterSource = source(); rasterSource.assets.data = { href: "http://192.168.10.15:9002/rs-products/rate.tif", type: "image/tiff" }
    vi.mocked(refreshRemoteItem).mockImplementation(async item => item.id === rasterSource.id ? rasterSource : published)
    const item = await layer()
    item.raster = { image: "", bounds, rendering: "classified", radiometry: "后台速率" }
    item.onlineSource!.sourceItemSha256 = await mapPublicationHash(rasterSource)
    item.onlineSource!.rendering = { engine: "Mars3D.XyzLayer", kind: "速率", parameters: { band: 1, minimum: -20, maximum: 20, colormapName: "rdbu_r" }, tileUrl: "/api/thematic/tiles/collections/spatial-thematic/items/backend-targets/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=data&asset_bidx=data%7C1&colormap_name=rdbu_r&rescale=-20%2C20" }
    prepared = await prepare([item])
    const id = prepared.snapshot.layers[0].parts[0].id
    published = { ...published, id, properties: { "cartography:map_sha256": prepared.fingerprint, "cartography:map_view": prepared.snapshot }, assets: { data: { href: `http://192.168.10.15:9002/rs-products/results/generic/${id}/rate.tif`, type: "image/tiff" } } }
    fetcher.mockImplementation(async (url: string) => {
      if (url.includes("tilejson.json")) {
        const query = new URL(url, window.location.origin).search
        return new Response(JSON.stringify({ scheme: "xyz", minzoom: 0, maxzoom: 18, bounds: [103, 29, 105, 31], tiles: [`http://192.168.10.15:5952/collections/thematic-map/items/${id}/tiles/WebMercatorQuad/{z}/{x}/{y}@1x${query}`] }))
      }
      if (url.includes("/files/")) { return new Response(new Uint8Array([73, 73, 42, 0, 8, 0, 0, 0]), { headers: { "content-type": "image/tiff" }, status: 206 }) }
      return new Response(new Uint8Array([255, 216, 255, 224, 0, 10]), { headers: { "content-type": "image/jpeg" } })
    })
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1, height: 1, close: vi.fn() }))
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([20, 40, 60, 255]) }) } as any)
  }
  it("accepts valid TiTiler JPEG tiles and retains the published raw-band style", async () => {
    await raster()
    const map = await loadPublishedMap(published.id)
    expect(map.layers[0].raster!.url).toContain("colormap_name=rdbu_r")
    expect(map.layers[0].raster!.url).toContain(published.id)
    expect(map.layers[0].raster!.bounds).toEqual(bounds)
  })
  it("rejects a missing raw raster even when the directory record exists", async () => {
    await raster(); fetcher.mockResolvedValueOnce(new Response("missing", { status: 404 }))
    await expect(loadPublishedMap(published.id)).rejects.toThrow("MinIO 发布文件读取失败（HTTP 404）")
  })
  it("does not accept HTML as GeoTIFF or as a successful tile image", async () => {
    await raster(); fetcher.mockResolvedValueOnce(new Response("<html>not a raster</html>"))
    await expect(loadPublishedMap(published.id)).rejects.toThrow("未返回实际 GeoTIFF")
    await raster()
    const original = fetcher.getMockImplementation()!
    fetcher.mockImplementation((url: string) => url.includes("@1x") ? Promise.resolve(new Response("<html>not a tile</html>", { headers: { "content-type": "image/jpeg" } })) : original(url))
    await expect(loadPublishedMap(published.id)).rejects.toThrow("媒体类型一致")
  })
  it("rejects a TileJSON that silently drops the requested color map", async () => {
    await raster()
    const original = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url: string) => {
      const response = await original(url)
      if (!url.includes("tilejson.json")) { return response }
      const value = await response.json(); value.tiles[0] = value.tiles[0].replace("colormap_name=rdbu_r", "colormap_name=blues")
      return new Response(JSON.stringify(value))
    })
    await expect(loadPublishedMap(published.id)).rejects.toThrow("未保留地图渲染参数")
  })
  it("does not call all-transparent sample tiles a visible map", async () => {
    await raster()
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) }) } as any)
    await expect(loadPublishedMap(published.id)).rejects.toThrow("抽检瓦片全部透明")
  })
})
