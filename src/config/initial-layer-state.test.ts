import { describe, expect, it, vi } from "vitest"
import { resetInitialBusinessLayerState, resetInitialMapLayerVisibility } from "./retired-layers"

describe("initial business layer state", () => {
  it("closes configured business layers and resets saved checks on a full page load", () => {
    const storage = { setItem: vi.fn() }
    const options = {
      basemaps: [{ id: 10, name: "base", show: true }],
      layers: [
        { id: 1, name: "visible leaf", type: "xyz", show: true },
        {
          id: 2,
          name: "nested group",
          type: "group",
          layers: [{ id: 3, name: "nested leaf", type: "geojson", show: true }]
        },
        { id: 4, name: "already hidden", type: "xyz", show: false }
      ]
    }

    const result = resetInitialBusinessLayerState(options, storage)

    expect(result).toBe(options)
    expect(options.basemaps[0].show).toBe(true)
    expect(options.layers[0].show).toBe(false)
    expect(options.layers[1].layers[0].show).toBe(false)
    expect(options.layers[2].show).toBe(false)
    expect(storage.setItem).toHaveBeenCalledWith("mars3d_layer_checked_keys", "[]")
  })

  it("hides asynchronously materialized business layers while preserving the active basemap", () => {
    const basemap = { id: 10, show: true, _isBasemap: true }
    const business = { id: 801101, show: true }
    const map = {
      getLayers: () => [basemap, business],
      getBasemaps: () => [basemap]
    }

    resetInitialMapLayerVisibility(map)

    expect(basemap.show).toBe(true)
    expect(business.show).toBe(false)
  })
})
