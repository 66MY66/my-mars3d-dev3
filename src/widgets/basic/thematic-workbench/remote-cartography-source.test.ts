import { afterEach, describe, expect, it, vi } from "vitest"
import { pointInside, readRemoteItem, refreshRemoteItem, remoteBounds, remoteCatalogUnit, remoteItemBlock, remoteItemTime, remoteLayerAssets, remotePoint, remoteProxyUrl, remoteRaster, remoteVector, searchRemoteItems, searchStacPage, type RemoteItem } from "./remote-cartography-source"

const item = (overrides: Partial<RemoteItem> = {}): RemoteItem => ({ type: "Feature", id: "SP-luding-pop2020", collection: "spatial-thematic", bbox: [100.15, 27.65, 104.75, 32.35], properties: { title: "泸定人口 2020", "grid:year": 2020, "grid:unit": "人/平方公里", "proj:epsg": 4326, datetime: "2022-09-05T05:10:00Z" }, assets: { data: { href: "http://192.168.10.15:9002/rs-products/pop.tif", type: "image/tiff" }, visual: { href: "http://192.168.10.15:9002/rs-products/pop_visual.tif", type: "image/tiff", title: "含示意烈度圈" } }, ...overrides })
const response = (raw: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(raw), { status, headers: { "Content-Type": "application/json", ...headers } })
const tiles = (extra = "") => ({ tilejson: "2.2.0", scheme: "xyz", minzoom: 0, maxzoom: 24, bounds: item().bbox, tiles: [`http://192.168.10.15:5952/collections/spatial-thematic/items/SP-luding-pop2020/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?assets=data&asset_bidx=data%7C1&rescale=0%2C5000&colormap_name=gray${extra}`] })
const options = { band: 1, minimum: 0, maximum: 5000 }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe("remote cartography read services", () => {
  it("uses documented PgSTAC POST continuation tokens without following external URLs or changing filters", async () => {
    const body = { collections: ["spatial-thematic"], bbox: [100, 20, 110, 30], limit: 50 }
    const next = { rel: "next", method: "POST", href: "http://192.168.10.15:5951/search", body: { token: "next:page-1", collections: ["other"] } }
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response({ type: "FeatureCollection", features: [item()], links: [next] }))); vi.stubGlobal("fetch", fetcher)
    const first = await searchStacPage(body)
    expect(first.nextToken).toBe("next:page-1")
    await searchStacPage(body, undefined, first.nextToken)
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ ...body, token: "next:page-1" })
    expect(fetcher.mock.calls[1][0]).toBe("/api/thematic/stac/search")
    expect((await searchStacPage(body, undefined, first.nextToken)).nextToken).toBeUndefined()
    fetcher.mockResolvedValue(response({ type: "FeatureCollection", features: [], links: [{ ...next, href: "http://other.test/private" }] }))
    expect(await searchStacPage(body)).toMatchObject({ hasMore: true, nextToken: undefined })
    await expect(searchStacPage(body, undefined, "x".repeat(5000))).rejects.toThrow("分页令牌")
  })
  it("validates geographic coverage rather than moving a layer into a selected extent", () => {
    expect(remoteBounds(item().bbox)).toEqual({ west: 100.15, south: 27.65, east: 104.75, north: 32.35 })
    for (const raw of [[180, 20, -180, 40], [10, 95, 20, 100], [10, 20, 10, 30], ["10", 20, 30, 40], [10, 20, 30, Infinity]]) { expect(() => remoteBounds(raw)).toThrow() }
    expect(pointInside(remoteBounds(item().bbox), 102, 29)).toBe(true)
    expect(pointInside(remoteBounds(item().bbox), 105, 29)).toBe(false)
    expect(() => readRemoteItem({ ...item(), id: "../bad" })).toThrow()
  })
  it("proxies only documented service origins and preserves XYZ placeholders", () => {
    expect(remoteProxyUrl("tiles", tiles().tiles[0])).toContain("/api/thematic/tiles/collections/")
    expect(remoteProxyUrl("tiles", tiles().tiles[0])).toContain("{z}/{x}/{y}")
    expect(remoteProxyUrl("files", "/api/thematic/files/rs-products/a.geojson")).toBe("/api/thematic/files/rs-products/a.geojson")
    for (const href of ["https://example.com/rs-products/a.geojson", "s3://rs-products/a.geojson", "http://admin:pass@192.168.10.15:9002/rs-products/a.geojson", "http://192.168.10.15:9002/admin/settings", "javascript:alert(1)"]) { expect(() => remoteProxyUrl("files", href)).toThrow() }
  })
  it("searches by real bounds without hiding station items or unlisted backend collections", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ type: "FeatureCollection", features: [item(), item({ id: "SP-strong_motion_stations" })], links: [{ rel: "next", href: "x" }] }))
    vi.stubGlobal("fetch", fetcher)
    const result = await searchRemoteItems("spatial-thematic", { west: 100, south: 27, east: 105, north: 33 })
    expect(result.items.map(v => v.id)).toEqual(["SP-luding-pop2020", "SP-strong_motion_stations"])
    expect(result.excluded).toBe(0); expect(result.hasMore).toBe(true)
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ collections: ["spatial-thematic"], limit: 50, bbox: [100, 27, 105, 33] })
    expect(fetcher.mock.calls[0][1].credentials).toBe("omit")
    fetcher.mockResolvedValueOnce(response({ type: "FeatureCollection", features: [item({ collection: "station-observations", id: "new-DEMO-test" })] }))
    expect((await searchRemoteItems("station-observations")).items[0].id).toBe("new-DEMO-test")
  })
  it("rejects an invalid catalog or a changed item identity", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ type: "FeatureCollection", features: [item({ collection: "other" })] })).mockResolvedValueOnce(response(item({ id: "other" }))))
    await expect(searchRemoteItems("spatial-thematic")).rejects.toThrow("不匹配")
    await expect(refreshRemoteItem(item())).rejects.toThrow("身份")
  })
  it("keeps all displayable assets selectable and defaults to raw values rather than a baked visual", () => {
    expect(remoteLayerAssets(item()).map(a => a.key)).toEqual(["data", "visual"])
    expect(remoteItemTime(item())).toBe("2020 年")
    expect(remoteCatalogUnit(item(), "data")).toBe("人/平方公里")
    expect(remoteLayerAssets(item({ id: "SP-luding-intensity" }))).toHaveLength(2)
    expect(remoteItemBlock(item({ collection: "gf-optical", id: "GF2_DEMO" }))).toBe("")
  })
  it("reads all declared raw-image bands and their numeric ranges regardless of the item name", () => {
    const raw = item({ id: "GF2_DEMO", collection: "gf-optical", properties: { "raster:bands": [1, 2, 3, 4].map(band => ({ band, min: 200, max: 3199 })) }, assets: { source: { href: "http://192.168.10.15:9002/rs-warm-images/raw.tiff", type: "image/tiff" } } })
    expect(remoteLayerAssets(raw)[0]).toMatchObject({ numeric: true, bands: ["波段 1", "波段 2", "波段 3", "波段 4"], range: [200, 3199] })
  })
  it("keeps true-color, brightness temperature and reflectance assets distinct", () => {
    const scene = item({ collection: "fy3-mersi-l1", assets: { visual: { href: "http://192.168.10.15:9002/rs-warm-images/rgb.tif", type: "image/tiff" }, thermal: { href: "http://192.168.10.15:9002/rs-warm-images/bt.tif", type: "image/tiff", unit: "K", bands: [{ name: "CH20" }, { name: "CH24" }] }, source: { href: "s3://bucket/source.HDF", type: "application/x-hdf5" } } })
    expect(remoteLayerAssets(scene).map(a => [a.key, a.numeric, a.bands.length])).toEqual([["visual", false, 1], ["thermal", true, 2]])
    expect(remoteCatalogUnit(scene, "thermal")).toBe("K")
  })
  it("loads data TileJSON using an explicit band and display range", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(tiles()))
    vi.stubGlobal("fetch", fetcher)
    const result = await remoteRaster(item(), remoteLayerAssets(item())[0], options)
    expect(result.bounds).toEqual(remoteBounds(item().bbox))
    expect(result.url).toContain("assets=data")
    const query = new URL(fetcher.mock.calls[0][0], window.location.origin).searchParams
    expect(query.get("asset_bidx")).toBe("data|1"); expect(query.get("rescale")).toBe("0,5000")
    await expect(remoteRaster(item(), remoteLayerAssets(item())[0], { ...options, maximum: 0 })).rejects.toThrow("上限")
    await expect(remoteRaster(item(), remoteLayerAssets(item())[0], { ...options, band: 2 })).rejects.toThrow("波段")
  })
  it.each([
    { ...tiles(), tiles: [tiles().tiles[0].replace("colormap_name=gray", "colormap_name=viridis")] },
    { ...tiles(), tiles: [tiles().tiles[0].replace("rescale=0%2C5000", "rescale=0%2C100")] },
    { ...tiles(), tiles: [tiles().tiles[0].replace("assets=data", "assets=visual")] },
    { ...tiles(), tiles: [tiles().tiles[0].replace("data%7C1", "data%7C2")] },
    { ...tiles(), tiles: [tiles().tiles[0].replace("SP-luding-pop2020", "other-item")] },
    { ...tiles(), bounds: [110, 10, 120, 20] },
    { ...tiles(), scheme: "tms" }
  ])("refuses mismatched assets, bands, identities, extents or tile schemes", async invalid => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(invalid)))
    await expect(remoteRaster(item(), remoteLayerAssets(item())[0], options)).rejects.toThrow()
  })
  it.each([0, -12.5, 42, null, -9999])("preserves raw %s, including zero, and does not fabricate a statistical total", async raw => {
    const fetcher = vi.fn().mockResolvedValue(response({ coordinates: [102, 29], values: [raw], band_names: ["data_b1"] }))
    vi.stubGlobal("fetch", fetcher)
    const result = await remotePoint(item(), remoteLayerAssets(item())[0], 1, 102, 29)
    expect(result.value).toBe(raw === -9999 ? null : raw)
    expect(fetcher.mock.calls[0][0]).toContain("asset_bidx=data%7C1")
  })
  it("does not request out-of-coverage points or accept a returned different band", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ values: [12], band_names: ["data_b2"] }))
    vi.stubGlobal("fetch", fetcher)
    await expect(remotePoint(item(), remoteLayerAssets(item())[0], 1, 120, 29)).rejects.toThrow("覆盖范围")
    expect(fetcher).not.toHaveBeenCalled()
    await expect(remotePoint(item(), remoteLayerAssets(item())[0], 1, 102, 29)).rejects.toThrow("波段")
  })
  it("reads vector properties without inventing severity and forces reference-only provenance", async () => {
    const source = item({ id: "SP-fault_zones_shp", assets: { data: { href: "http://192.168.10.15:9002/rs-products/fault.geojson", type: "application/geo+json" } } })
    const raw = { type: "FeatureCollection", metadata: { usage: "operational", referenceOnly: false }, features: [{ type: "Feature", id: "a", properties: { NAME: "断裂带", LEVEL: "I" }, geometry: { type: "Polygon", coordinates: [[[101, 29], [102, 29], [102, 30], [101, 29]]] } }] }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(raw)))
    const result = await remoteVector(source, remoteLayerAssets(source)[0])
    expect(result.metadata.referenceOnly).toBe(true); expect(result.metadata.usage).toBe("reference")
    expect(result.features[0].properties.severity).toBeUndefined()
    expect(result.features[0].geometry).toEqual(raw.features[0].geometry)
    await expect(remoteVector({ ...source, properties: { "proj:epsg": 3857 } }, remoteLayerAssets(source)[0])).rejects.toThrow("转换")
  })
  it("reports service failures, oversized files and network errors rather than falling back to examples", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({}, 503)).mockResolvedValueOnce(response({}, 200, { "content-length": String(11 * 1024 * 1024) })).mockRejectedValueOnce(new TypeError("network")))
    await expect(refreshRemoteItem(item())).rejects.toThrow("HTTP 503")
    await expect(refreshRemoteItem(item())).rejects.toThrow("10 MB")
    await expect(refreshRemoteItem(item())).rejects.toThrow("内网/VPN")
  })
  it("aborts pending reads and expires stalled requests", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))))
    const controller = new AbortController()
    const cancelled = expect(refreshRemoteItem(item(), controller.signal)).rejects.toMatchObject({ name: "AbortError" })
    controller.abort(); await cancelled
    const expired = expect(refreshRemoteItem(item())).rejects.toThrow("超时")
    await vi.advanceTimersByTimeAsync(20001); await expired
  })
})
