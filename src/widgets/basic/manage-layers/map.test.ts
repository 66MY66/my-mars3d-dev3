import { describe, expect, it, vi } from "vitest"

vi.mock("mars3d", () => {
  return { Cesium: {} }
})

const { onMounted, removeLayerById, snapshotLayerZIndex, restoreLayerZIndex, exchangeLayer, syncLayerZIndexByIds } = await import("./map")

describe("manage-layers map", () => {
  it("removeLayerById destroys layer", () => {
    const layer = { id: "l1" }
    const removeLayer = vi.fn()
    const map: any = {
      getLayerById: vi.fn(() => layer),
      removeLayer
    }
    onMounted(map)

    const ok = removeLayerById("l1")
    expect(ok).toBe(true)
    expect(removeLayer).toHaveBeenCalled()
    expect(removeLayer.mock.calls[0]?.[0]).toBe(layer)
    expect(removeLayer.mock.calls[0]?.[1]).toBe(true)
  })

  it("snapshot and restore layer zIndex", () => {
    const layers = [
      { id: "a", zIndex: 10 },
      { id: "b", zIndex: 20 }
    ]
    const map: any = {
      getLayers: vi.fn(() => layers),
      getLayerById: vi.fn((id: string) => layers.find((l) => l.id === id))
    }
    onMounted(map)

    const snapshot = snapshotLayerZIndex()
    expect(snapshot).toEqual({ a: 10, b: 20 })

    layers[0].zIndex = 99
    layers[1].zIndex = 1
    restoreLayerZIndex(snapshot)
    expect(layers[0].zIndex).toBe(10)
    expect(layers[1].zIndex).toBe(20)
  })

  it("exchangeLayer swaps zIndex", () => {
    const a = { id: "a", zIndex: 1 }
    const b = { id: "b", zIndex: 2 }
    const map: any = {
      getLayerById: vi.fn((id: string) => [a, b].find((layer) => layer.id === id) || null)
    }
    onMounted(map)

    expect(exchangeLayer("a", "b")).toBe(true)
    expect(a.zIndex).toBe(2)
    expect(b.zIndex).toBe(1)
  })

  it("syncs existing imagery zIndex to list order without adding or removing layers", () => {
    const layers = [
      { id: "gdp", zIndex: 2 },
      { id: "population", zIndex: 8 }
    ]
    const map: any = {
      getLayerById: vi.fn((id: string) => layers.find((layer) => layer.id === id) || null),
      addLayer: vi.fn(),
      removeLayer: vi.fn()
    }
    onMounted(map)

    expect(syncLayerZIndexByIds(["gdp", "population"])).toBe(true)
    expect(layers[0].zIndex).toBeGreaterThan(layers[1].zIndex)
    expect(map.addLayer).not.toHaveBeenCalled()
    expect(map.removeLayer).not.toHaveBeenCalled()

    expect(syncLayerZIndexByIds(["population", "gdp"])).toBe(true)
    expect(layers[1].zIndex).toBeGreaterThan(layers[0].zIndex)
  })
})
