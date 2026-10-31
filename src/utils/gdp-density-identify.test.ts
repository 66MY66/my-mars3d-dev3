import { describe, expect, it, vi } from "vitest"
import { GDP_DENSITY_LAYER_ID, installGdpDensityIdentify } from "./gdp-density-identify"

function createMap(layerShow = true) {
  let clickHandler: ((event: any) => void | Promise<void>) | undefined
  const layerHandlers: Map<string, VoidFunction> = new Map()
  const layer = {
    show: layerShow,
    on: vi.fn((type: string, handler: () => void) => layerHandlers.set(type, handler)),
    off: vi.fn()
  }
  const map = {
    getLayerById: vi.fn((id: number) => id === GDP_DENSITY_LAYER_ID ? layer : undefined),
    on: vi.fn((_type: string, handler: typeof clickHandler) => { clickHandler = handler }),
    off: vi.fn(),
    openPopup: vi.fn()
  }
  return {
    map,
    layer,
    emitClick: (event: any) => clickHandler?.(event),
    emitLayer: (type: string) => layerHandlers.get(type)?.()
  }
}

describe("GDP density point identify", () => {
  it("queries the STAC data asset and opens a GDP value popup when the layer is visible", async () => {
    const { map, emitClick } = createMap(true)
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ coordinates: [105.45123, 37.99616], values: [46], band_names: ["data_b1"] })
    })

    installGdpDensityIdentify({
      map,
      clickEvent: "click",
      toLngLat: () => ({ lng: 105.45123, lat: 37.99616 }),
      fetcher
    })
    await emitClick({ cartesian: {} })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/titiler/collections/spatial-thematic/items/SP-china-gdp2020/point/105.45123,37.99616?assets=data",
      expect.objectContaining({ signal: expect.anything() })
    )
    expect(map.openPopup).toHaveBeenCalledWith(
      [105.45123, 37.99616],
      expect.stringContaining("46 万元/平方公里")
    )
  })

  it("does not query when the GDP density layer is hidden", async () => {
    const { map, emitClick } = createMap(false)
    const fetcher = vi.fn()

    installGdpDensityIdentify({
      map,
      clickEvent: "click",
      toLngLat: () => ({ lng: 105, lat: 38 }),
      fetcher
    })
    await emitClick({ cartesian: {} })

    expect(fetcher).not.toHaveBeenCalled()
    expect(map.openPopup).not.toHaveBeenCalled()
  })

  it("shows no data for the raster nodata sentinel", async () => {
    const { map, emitClick } = createMap(true)
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ values: [-9999] }) })

    installGdpDensityIdentify({
      map,
      clickEvent: "click",
      toLngLat: () => ({ lng: 80, lat: 40 }),
      fetcher
    })
    await emitClick({ cartesian: {} })

    expect(map.openPopup).toHaveBeenCalledWith([80, 40], expect.stringContaining("无数据"))
  })

  it("removes its click listener during cleanup", () => {
    const { map } = createMap(true)
    const cleanup = installGdpDensityIdentify({
      map,
      clickEvent: "click",
      toLngLat: () => ({ lng: 105, lat: 38 }),
      fetcher: vi.fn()
    })

    cleanup()

    expect(map.off).toHaveBeenCalledWith("click", expect.any(Function))
  })

  it("keeps legend visibility synchronized with GDP layer show and hide events", () => {
    const { map, layer, emitLayer } = createMap(false)
    const onVisibilityChange = vi.fn()
    const cleanup = installGdpDensityIdentify({
      map,
      clickEvent: "click",
      showEvent: "show",
      hideEvent: "hide",
      onVisibilityChange,
      toLngLat: () => ({ lng: 105, lat: 38 }),
      fetcher: vi.fn()
    } as any)

    expect(onVisibilityChange).toHaveBeenLastCalledWith(false)
    layer.show = true
    emitLayer("show")
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true)
    layer.show = false
    emitLayer("hide")
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false)

    cleanup()
    expect(layer.off).toHaveBeenCalledWith("show", expect.any(Function))
    expect(layer.off).toHaveBeenCalledWith("hide", expect.any(Function))
  })
})
