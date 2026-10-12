import { describe, expect, it, vi } from "vitest"

import { applyExclusiveBasemapState } from "./map"

vi.mock("mars3d", () => ({
  Cesium: {}
}))

describe("manage-basemap/map", () => {
  it("keeps only one basemap active after switching", () => {
    const basemaps = [
      { id: "a", show: true },
      { id: "b", show: false },
      { id: "c", show: true }
    ]

    applyExclusiveBasemapState(basemaps, "b")

    expect(basemaps).toEqual([
      { id: "a", show: false },
      { id: "b", show: true },
      { id: "c", show: false }
    ])
  })
})
