import { webcrypto } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import { readCartographyWindow } from "./cartography-source-window"
import type { RemoteItem, RemoteLayerAsset } from "./remote-cartography-source"

vi.mock("geotiff", () => ({
  fromUrl: vi.fn(async () => ({
  close: vi.fn(),
  getImage: async () => ({
    getGeoKeys: () => ({ GTModelTypeGeoKey: 2, GeographicTypeGeoKey: 4326 }),
    fileDirectory: { getValue: () => undefined },
    getOrigin: () => [100, 22],
    getResolution: () => [1, -1],
    getHeight: () => 1,
    getWidth: () => 2,
    getSamplesPerPixel: () => 1,
    getGDALNoData: () => -9999,
    readRasters: async () => new Float64Array([10, 100])
  })
  }))
}))
afterEach(() => vi.unstubAllGlobals())

describe("content-aware original raster windows", () => {
  const item: RemoteItem = { type: "Feature", id: "SP-pop2020", collection: "new", bbox: [100, 21, 102, 22], properties: {}, assets: { data: { href: "http://192.168.10.15:9002/rs-products/quantity-window.tif", type: "image/tiff" } } }
  const asset: RemoteLayerAsset = { key: "data", kind: "raster", title: "data", numeric: true, bands: ["b1"], range: [0, 100] }
  const bounds = { west: 100, south: 21, east: 102, north: 22 }
  const options = { band: 1, minimum: 0, maximum: 100, statisticsOnly: true }
  it("classifies new GDP data with its inspected quantity rather than a population-like ID", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const result = await readCartographyWindow(item, { ...asset, quantity: "economy" }, bounds, options, new AbortController().signal)
    expect(result.statistics).toMatchObject({ minimum: 10, maximum: 100 })
    expect(result.legend.at(-1)?.color).toBe("#006d2c")
    expect(result.breaks?.at(-1)).toBe(100)
  })
  it("never applies population classification to inspected temperature based on the ID", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const result = await readCartographyWindow(item, { ...asset, quantity: "temperature" }, bounds, options, new AbortController().signal)
    expect(result.statistics?.valid).toBe(2)
    expect(result.breaks).toBeUndefined()
    expect(result.legend).toEqual([])
  })
})
