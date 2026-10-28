import { describe, expect, it } from "vitest"
import {
  buildFallbackManifestFromStacItem,
  buildFallbackManifestFromStacItems,
  getLocalDataset,
  getLocalManifests,
  normalizeDatasetApiRevisionsToStacItems,
  assertSuccessfulImportSessionResponse
} from "./eoapi-datasets"

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

describe("assertSuccessfulImportSessionResponse", () => {
  it("returns a successful import-session response", () => {
    const response = { success: true, data: { success: true, status: "undone", deletedArtifactCount: 1 } }

    expect(assertSuccessfulImportSessionResponse(response)).toEqual({ success: true, mode: "remote" })
  })

  it("falls back to local-only undo when the server does not expose import sessions", () => {
    expect(assertSuccessfulImportSessionResponse({ success: false, code: 404, message: "Not Found" }))
      .toEqual({ success: false, mode: "local-only" })
  })

  it("throws for import-session failures other than an unsupported endpoint", () => {
    expect(() => assertSuccessfulImportSessionResponse({ success: false, code: 500, message: "Server Error" }))
      .toThrow("Server Error")
  })
})

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

describe("bundled SAR demonstration dataset", () => {
  it("appears in the dataset repository with an offline SAR raster layer", () => {
    localStorage.clear()

    const datasets = getLocalManifests()
    const summary = datasets.find((item) => item.datasetId === "local_sar_demo")
    const dataset = getLocalDataset("local_sar_demo")
    const layer: any = dataset?.manifest?.layers?.[0]

    expect(summary?.name).toBe("合成 SAR 后向散射影像")
    expect(summary?.tags).toEqual(expect.arrayContaining(["SAR", "栅格", "演示数据"]))
    expect(layer).toMatchObject({
      name: "合成 Sentinel-1 SAR 后向散射影像",
      sourceType: "image",
      sourceRef: "/data/sar/synthetic-sar-backscatter.png",
      visible: true,
      opacity: 1,
      options: {
        styleProfile: "sar",
        bbox: [100.7, 24.2, 103.1, 26.1]
      }
    })
  })

  it("migrates the previously bundled imageBounds field to the supported bbox field", () => {
    localStorage.setItem("eoapi_manifests", JSON.stringify({
      local_sar_demo: {
        name: "合成 SAR 后向散射影像",
        manifest: {
          manifestVersion: "1.0",
          layers: [{
            id: "synthetic_sar_backscatter",
            sourceType: "image",
            sourceRef: "/data/sar/synthetic-sar-backscatter.png",
            options: { styleProfile: "sar", imageBounds: [100.7, 24.2, 103.1, 26.1] }
          }]
        }
      }
    }))

    getLocalManifests()
    const dataset = getLocalDataset("local_sar_demo")
    const options: any = dataset?.manifest?.layers?.[0]?.options

    expect(options?.bbox).toEqual([100.7, 24.2, 103.1, 26.1])
    expect(options).not.toHaveProperty("imageBounds")
  })
})

describe("bundled layer loading acceptance dataset", () => {
  it("seeds one importable dataset covering every supported loading branch", () => {
    localStorage.clear()

    const summary = getLocalManifests().find((item) => item.datasetId === "local_layer_loading_acceptance")
    const dataset = getLocalDataset("local_layer_loading_acceptance")
    const layers = dataset?.manifest?.layers || []

    expect(summary).toMatchObject({
      name: "图层数据接入综合验收数据集",
      visibility: "private"
    })
    expect(summary?.tags).toEqual(expect.arrayContaining(["图层验收", "栅格", "MVT", "公开服务"]))
    expect(layers.map((layer: any) => layer.sourceType)).toEqual([
      "cog",
      "image",
      "xyz",
      "wms",
      "mvt",
      "custom-unknown"
    ])
    expect(layers.find((layer: any) => layer.sourceType === "image")?.options?.bounds).toEqual([-180, -90, 180, 90])
    expect(layers.find((layer: any) => layer.sourceType === "wms")?.options?.layers).toBe("VIIRS_SNPP_CorrectedReflectance_TrueColor")
    expect(layers.find((layer: any) => layer.sourceType === "mvt")?.sourceRef).toContain("/{z}/{y}/{x}.pbf")
    expect(layers.find((layer: any) => layer.sourceType === "custom-unknown")?.sourceRef).toBe("")
  })

  it("does not overwrite a user-modified copy of the bundled dataset", () => {
    localStorage.setItem("eoapi_manifests", JSON.stringify({
      local_layer_loading_acceptance: {
        name: "用户已修改的验收数据集",
        manifest: { manifestVersion: "1.0", layers: [] }
      }
    }))

    getLocalManifests()

    expect(getLocalDataset("local_layer_loading_acceptance")?.name).toBe("用户已修改的验收数据集")
  })
})
