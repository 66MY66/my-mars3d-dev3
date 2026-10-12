import { describe, expect, it } from "vitest"
import { pickManifestHrefFromStacItem } from "./manifest-resolver"

describe("pickManifestHrefFromStacItem", () => {
  it("prefers link rel=manifest", () => {
    const href = pickManifestHrefFromStacItem({
      id: "rev",
      type: "Feature",
      stac_version: "1.0.0",
      geometry: null,
      properties: {},
      links: [{ rel: "manifest", href: "/assets/m.json" }],
      assets: {}
    } as any)
    expect(href).toBe("/assets/m.json")
  })

  it("falls back to assets.manifest", () => {
    const href = pickManifestHrefFromStacItem({
      id: "rev",
      type: "Feature",
      stac_version: "1.0.0",
      geometry: null,
      properties: {},
      links: [],
      assets: { manifest: { href: "/assets/manifest.json", type: "application/json" } }
    } as any)
    expect(href).toBe("/assets/manifest.json")
  })
})

