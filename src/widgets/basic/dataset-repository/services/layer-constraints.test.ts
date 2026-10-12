import { describe, expect, it } from "vitest"
import { assertLayerCapacity, checkLayerCapacity, countManifestLayers, countMapLayers, MAX_LAYERS } from "./layer-constraints"

describe("layer-constraints", () => {
  it("counts only non-group business layers", () => {
    const map = {
      getLayers: () => ([
        { id: "group-1", type: "group" },
        { id: "layer-1", type: "xyz" },
        { id: "layer-2", options: { type: "geojson" } },
        { id: "restored_features", type: "graphic" }
      ])
    } as any

    expect(countMapLayers(map)).toBe(2)
  })

  it("counts only manifest leaf layers", () => {
    expect(countManifestLayers({
      manifestVersion: "1.0",
      layers: [
        { id: "g1", sourceType: "group", sourceRef: "" } as any,
        { id: "l1", sourceType: "xyz", sourceRef: "a" } as any,
        { id: "l2", sourceType: "geojson", sourceRef: "" } as any
      ]
    } as any)).toBe(2)
  })

  it("applies overlay and replace strategies differently", () => {
    const map = {
      getLayers: () => new Array(10).fill(0).map((_, index) => ({ id: `layer-${index}`, type: "xyz" }))
    } as any

    expect(checkLayerCapacity(map, {
      incomingCount: 5,
      strategy: "overlay"
    })).toEqual(expect.objectContaining({
      ok: true,
      projectedCount: 15,
      limit: MAX_LAYERS
    }))

    expect(checkLayerCapacity(map, {
      incomingCount: 16,
      strategy: "replace"
    })).toEqual(expect.objectContaining({
      ok: false,
      projectedCount: 16
    }))
  })

  it("throws a readable error when exceeding the layer limit", () => {
    const map = {
      getLayers: () => new Array(14).fill(0).map((_, index) => ({ id: `layer-${index}`, type: "xyz" }))
    } as any

    expect(() => assertLayerCapacity(map, {
      incomingCount: 2,
      strategy: "overlay",
      actionLabel: "导入成果版本"
    })).toThrow("已超过上限 15 层")
  })
})
