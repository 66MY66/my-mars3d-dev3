import { describe, expect, it } from "vitest"
import { buildFallbackManifestFromStacItem, buildFallbackManifestFromStacItems, normalizeDatasetApiRevisionsToStacItems } from "./eoapi-datasets"

function makeItem(params: {
  id: string
  bbox?: number[]
  assets?: Record<string, any>
  title?: string
}): any {
  return {
    id: params.id,
    type: "Feature",
    stac_version: "1.0.0",
    collection: "COL",
    geometry: null,
    bbox: params.bbox,
    properties: { datetime: "2024-01-01T00:00:00Z", title: params.title },
    links: [],
    assets: params.assets || {}
  }
}

describe("buildFallbackManifestFromStacItem", () => {
  it("returns null when bbox is missing", () => {
    const out = buildFallbackManifestFromStacItem("COL", makeItem({ id: "v1" }) as any)
    expect(out).toBeNull()
  })

  it("builds layers from raster-like assets and keeps version/layer separated", () => {
    const item = makeItem({
      id: "v1",
      title: "Version 1",
      bbox: [0, 0, 1, 1],
      assets: {
        visual: { href: "s3://bucket/a.tif", type: "image/tiff; application=geotiff", title: "RGB", roles: ["visual", "data"] },
        nir: { href: "s3://bucket/b.tif", type: "image/tiff", title: "NIR", roles: ["data"] },
        thumbnail: { href: "https://example.com/t.png", type: "image/png", roles: ["thumbnail"] }
      }
    })
    const out = buildFallbackManifestFromStacItem("COL", item as any)
    expect(out).not.toBeNull()
    expect(out?.layers?.length).toBe(2)

    const ids = (out!.layers || []).map((l: any) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.some((id) => id === "v1")).toBe(false)

    for (const l of out!.layers || []) {
      expect((l as any).data?.versionId).toBe("v1")
      expect(typeof (l as any).data?.layerKey).toBe("string")
      expect((l as any).data?.layerKey).not.toBe("v1")
      expect(String(l.sourceRef)).toContain("/api/titiler/collections/")
    }
    expect((out!.layers || [])[0] && (out!.layers || [])[0].data?.styleProfile).toBe("optical")
  })
})

describe("buildFallbackManifestFromStacItems", () => {
  it("generates distinct layer ids across versions for the same logical layer", () => {
    const item1 = makeItem({
      id: "v1",
      bbox: [0, 0, 1, 1],
      assets: { visual: { href: "s3://bucket/a.tif", type: "image/tiff", roles: ["data"] } }
    })
    const item2 = makeItem({
      id: "v2",
      bbox: [0, 0, 1, 1],
      assets: { visual: { href: "s3://bucket/a2.tif", type: "image/tiff", roles: ["data"] } }
    })
    const out = buildFallbackManifestFromStacItems("COL", [item1 as any, item2 as any])
    const ids = (out.layers || []).map((l: any) => l.id)
    expect(ids.length).toBe(2)
    expect(new Set(ids).size).toBe(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it("reduces opacity when importing multiple versions", () => {
    const item1 = makeItem({
      id: "v1",
      bbox: [0, 0, 1, 1],
      assets: { visual: { href: "s3://bucket/a.tif", type: "image/tiff", roles: ["data"] } }
    })
    const item2 = makeItem({
      id: "v2",
      bbox: [0, 0, 1, 1],
      assets: { visual: { href: "s3://bucket/a2.tif", type: "image/tiff", roles: ["data"] } }
    })
    const out = buildFallbackManifestFromStacItems("COL", [item1 as any, item2 as any])
    for (const l of out.layers || []) {
      expect(Number(l.opacity)).toBeLessThanOrEqual(0.7)
    }
  })

  it("merges all item bboxes so edge tiles are not dropped", () => {
    const item1 = makeItem({
      id: "v1",
      bbox: [100, 30, 101, 31],
      assets: { visual: { href: "s3://bucket/a.tif", type: "image/tiff", roles: ["data"] } }
    })
    const item2 = makeItem({
      id: "v2",
      bbox: [101, 31, 103, 34],
      assets: { visual: { href: "s3://bucket/b.tif", type: "image/tiff", roles: ["data"] } }
    })

    const out = buildFallbackManifestFromStacItems("COL", [item1 as any, item2 as any])
    expect(out.viewState?.bbox).toEqual([100, 30, 103, 34])
  })
})

describe("normalizeDatasetApiRevisionsToStacItems", () => {
  it("maps datasets-api revisions to stac-like items and injects manifest asset", () => {
    const out = normalizeDatasetApiRevisionsToStacItems("DS", {
      revisions: [
        { revisionId: "rev_1", message: "first", createdAt: 1700000000000 },
        { id: "rev_2", createdAt: "2025-01-01T00:00:00Z" }
      ],
      total: 2
    } as any)

    expect(out.total).toBe(2)
    expect(out.items.length).toBe(2)
    expect(out.items[0].assets?.manifest?.href).toContain("/datasets/DS/revisions/")
    expect(out.items[0].assets?.manifest?.href).toContain("/manifest")
    expect(out.items[0].links?.some((l: any) => l?.rel === "manifest")).toBe(true)
    expect(typeof out.items[0].properties?.datetime).toBe("string")
    expect(out.items[1].id).toBe("rev_2")
    expect(out.items[1].assets?.manifest?.href).toBe("/datasets/DS/revisions/rev_2/manifest")
  })
})
