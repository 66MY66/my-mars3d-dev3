import { describe, expect, it } from "vitest"
import { backendServiceLinks } from "./backend-service-links"
import type { RemoteItem } from "./remote-cartography-source"
const item: RemoteItem = { type: "Feature", collection: "future-DEMO", id: "test", bbox: [103, 35, 105, 37], properties: {}, assets: { data: { href: "http://192.168.10.15:9002/new-products/raw.tif", type: "image/tiff" } } }
describe("every documented asset read interface", () => {
  it("exposes catalog file TileJSON XYZ WMTS preview point and direct COG services", () => {
    expect(backendServiceLinks(item, "data").map(link => link.id)).toEqual(["stac-item", "catalog-item", "file", "tilejson", "xyz", "wmts", "preview", "point", "cog-tilejson", "cog-viewer"])
  })
  it("uses the actual file URL for COG and retains explicit band/display parameters", () => {
    const links = backendServiceLinks(item, "data", { band: 1, minimum: -5, maximum: 5, colormapName: "rdbu_r" })
    const cog = new URL(links.find(link => link.id === "cog-tilejson")!.href)
    expect(cog.searchParams.get("url")).toBe(item.assets.data.href)
    expect(cog.searchParams.get("rescale")).toBe("-5,5")
    const wmts = new URL(links.find(link => link.id === "wmts")!.href)
    expect(wmts.searchParams.get("asset_bidx")).toBe("data|1")
    expect(wmts.searchParams.get("colormap_name")).toBe("rdbu_r")
    expect(links.find(link => link.id === "xyz")!.href).not.toContain("{z}")
  })
  it("preserves any backend attachment extension without requesting raster services for it", () => {
    for (const extension of ["zip", "rar", "docx", "pdf", "html", "csv", "png", "geojson"]) {
      const current = { ...item, assets: { data: { href: `http://192.168.10.15:9002/rs-inbox/source.${extension}` } } }
      expect(backendServiceLinks(current, "data").map(link => link.id)).toEqual(["stac-item", "catalog-item", "file"])
    }
  })
  it("does not send an unrelated external URL to the internal COG service", () => {
    expect(backendServiceLinks({ ...item, assets: { data: { href: "http://localhost/private.tif" } } }, "data").map(link => link.id)).toEqual(["stac-item", "catalog-item"])
  })
})
