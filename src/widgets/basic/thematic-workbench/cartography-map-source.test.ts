import { webcrypto } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import { backendMapLayer, backendRenderPlan } from "./cartography-backend-render"
import { remoteRaster, type RemoteItem } from "./remote-cartography-source"

vi.mock("./remote-cartography-source", async original => ({ ...await original<typeof import("./remote-cartography-source")>(), remoteRaster: vi.fn().mockResolvedValue({ url: "backend-xyz", bounds: { west: 100, south: 25, east: 106, north: 30 }, minZoom: 0, maxZoom: 24 }) }))
afterEach(() => vi.unstubAllGlobals())
const item: RemoteItem = { type: "Feature", collection: "spatial-thematic", id: "SP-china-pop2020", bbox: [100, 25, 106, 30], properties: { updated: "r1" }, assets: { data: { href: "source.tif", type: "image/tiff" } } }
const asset = { key: "data", title: "population", kind: "raster" as const, numeric: true, bands: ["band1"], range: [0, 5000] as [number, number] }
const plan = backendRenderPlan(item, asset, "raster-ramp", { band: 1, minimum: 0, maximum: 5000 }, null)
describe("native map source, independent from print pixels", () => {
  it("only resolves native tiles and exact source intersection, without drawing a replacement image", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const scope = { west: 99, south: 26, east: 103, north: 32 }
    const layer = await backendMapLayer(item, asset, scope, plan, new AbortController().signal)
    expect(remoteRaster).toHaveBeenCalledWith(item, asset, plan.params, expect.any(AbortSignal))
    expect(layer.raster.bounds).toEqual({ west: 100, south: 26, east: 103, north: 30 })
    expect(layer.raster.url).toBe("backend-xyz")
    expect(layer.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(layer).not.toHaveProperty("image")
    expect(layer).not.toHaveProperty("proofUrl")
    expect(layer).not.toHaveProperty("dpi")
  })
  it("refuses to stretch a nonintersecting asset into the selected area", async () => {
    await expect(backendMapLayer(item, asset, { west: 110, south: 40, east: 112, north: 42 }, plan, new AbortController().signal)).rejects.toThrow("不移动或拉伸")
  })
})
