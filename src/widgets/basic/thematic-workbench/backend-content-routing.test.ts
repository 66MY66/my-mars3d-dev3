import { webcrypto } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import { inspectBackendSource, inspectScopedCatalog } from "./backend-content-routing"
import { remoteLayerAssets, type RemoteItem } from "./remote-cartography-source"

afterEach(() => vi.unstubAllGlobals())

describe("backend content origin feedback", () => {
  it("carries actual header quantity into the asset used by the renderer", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const item: RemoteItem = { type: "Feature", id: "fresh-record", collection: "new-collection", bbox: [100, 20, 102, 22], properties: { updated: "quantity-r1", "grid:unit": "万元/平方公里" }, assets: { data: { href: "http://192.168.10.15:9002/rs-products/quantity.tif", type: "image/tiff" } } }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ count: 1, width: 2, height: 2, band_descriptions: [["b1", "gdp_10k_cny_per_km2"]], bounds: item.bbox }))))
    const source = await inspectBackendSource(item, remoteLayerAssets(item)[0], { west: 100, south: 20, east: 102, north: 22 }, new AbortController().signal)
    expect(source.asset.quantity).toBe("economy")
    expect(source.asset.numeric).toBe(true)
  })
  it("reports backend progress and reads geometry only from the backend asset", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const item = {
      type: "Feature",
      id: "origin-feedback",
      collection: "original-content",
      bbox: [100, 28, 104, 32],
      properties: { updated: "origin-feedback-r1" },
      assets: { data: { href: "http://192.168.10.15:9002/rs-products/origin-feedback.geojson", type: "application/geo+json" } }
    }
    const data = { type: "FeatureCollection", features: [{ type: "Feature", properties: { rain_mm: 12 }, geometry: { type: "Point", coordinates: [102, 30] } }] }
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("/collections?")) { return new Response(JSON.stringify({ collections: [{ id: item.collection }] })) }
      if (url.endsWith("/search")) { return new Response(JSON.stringify({ type: "FeatureCollection", features: [item] })) }
      return new Response(JSON.stringify(data))
    })
    vi.stubGlobal("fetch", fetcher)
    const progress: string[] = []
    const result = await inspectScopedCatalog({ west: 101, south: 29, east: 103, north: 31 }, new AbortController().signal, text => progress.push(text))
    expect(progress).toEqual(["正在查询框选范围内的后端目录", "正在核对后端资料 0/1", "正在核对后端资料 1/1"])
    expect(result.sources).toHaveLength(1)
    expect(result.sources[0].item.id).toBe(item.id)
    expect(result.sources[0].profile.count).toBe(1)
    expect(fetcher.mock.calls.every(call => call[0].startsWith("/api/thematic/"))).toBe(true)
    expect(fetcher.mock.calls.some(call => call[0] === "/api/thematic/files/rs-products/origin-feedback.geojson")).toBe(true)
  })
})
