import { describe, expect, it, vi } from "vitest"
import { GDP_DENSITY_LAYER_ID } from "./gdp-density-identify"
import { FACEBOOK_POPULATION_LAYER_ID, installFacebookPopulationIdentify } from "./facebook-population-identify"

function createMap(facebookShow = true, gdpShow = false, facebookZIndex = 2, gdpZIndex = 1) {
  let clickHandler: ((event: any) => void | Promise<void>) | undefined
  const facebookHandlers = new Map<string, VoidFunction>()
  const facebookLayer = {
    show: facebookShow,
    zIndex: facebookZIndex,
    on: vi.fn((type: string, handler: VoidFunction) => facebookHandlers.set(type, handler)),
    off: vi.fn()
  }
  const gdpLayer = { show: gdpShow, zIndex: gdpZIndex }
  const map = {
    getLayerById: vi.fn((id: number) => {
      if (id === FACEBOOK_POPULATION_LAYER_ID) {
        return facebookLayer
      }
      if (id === GDP_DENSITY_LAYER_ID) {
        return gdpLayer
      }
      return undefined
    }),
    on: vi.fn((_type: string, handler: typeof clickHandler) => { clickHandler = handler }),
    off: vi.fn(),
    openPopup: vi.fn()
  }
  return {
    map,
    facebookLayer,
    gdpLayer,
    emitClick: (event: any) => clickHandler?.(event),
    emitFacebook: (type: string) => facebookHandlers.get(type)?.()
  }
}

describe("Facebook population density point identify", () => {
  it("queries the STAC data asset and opens a population value popup when visible", async () => {
    const { map, emitClick } = createMap(true)
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ values: [123.5] }) })

    installFacebookPopulationIdentify({
      map,
      clickEvent: "click",
      toLngLat: () => ({ lng: 105.45123, lat: 37.99616 }),
      fetcher
    })
    await emitClick({ cartesian: {} })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/titiler/collections/spatial-thematic/items/SP-china-pop2020/point/105.45123,37.99616?assets=data",
      expect.objectContaining({ signal: expect.anything() })
    )
    expect(map.openPopup).toHaveBeenCalledWith(
      [105.45123, 37.99616],
      expect.stringContaining("123.5 人/平方公里")
    )
  })

  it("does not query when the Facebook population layer is hidden", async () => {
    const { map, emitClick } = createMap(false)
    const fetcher = vi.fn()

    installFacebookPopulationIdentify({
      map,
      clickEvent: "click",
      toLngLat: () => ({ lng: 105, lat: 38 }),
      fetcher
    })
    await emitClick({ cartesian: {} })

    expect(fetcher).not.toHaveBeenCalled()
  })

  it("does not query when a visible GDP layer is above Facebook in the list order", async () => {
    const { map, emitClick } = createMap(true, true, 1, 2)
    const fetcher = vi.fn()

    installFacebookPopulationIdentify({
      map,
      clickEvent: "click",
      toLngLat: () => ({ lng: 105, lat: 38 }),
      fetcher
    })
    await emitClick({ cartesian: {} })

    expect(fetcher).not.toHaveBeenCalled()
  })

  it("shows no data for the raster nodata sentinel", async () => {
    const { map, emitClick } = createMap(true)
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ values: [-9999] }) })

    installFacebookPopulationIdentify({
      map,
      clickEvent: "click",
      toLngLat: () => ({ lng: 80, lat: 40 }),
      fetcher
    })
    await emitClick({ cartesian: {} })

    expect(map.openPopup).toHaveBeenCalledWith([80, 40], expect.stringContaining("无数据"))
  })

  it("keeps the GDP layer visible when Facebook population becomes visible", () => {
    const { map, facebookLayer, gdpLayer, emitFacebook } = createMap(false, true)

    installFacebookPopulationIdentify({
      map,
      clickEvent: "click",
      showEvent: "show",
      hideEvent: "hide",
      toLngLat: () => ({ lng: 105, lat: 38 }),
      fetcher: vi.fn()
    })
    facebookLayer.show = true
    emitFacebook("show")

    expect(gdpLayer.show).toBe(true)
  })

  it("keeps legend visibility synchronized with Facebook layer show and hide events", () => {
    const { map, facebookLayer, emitFacebook } = createMap(false)
    const onVisibilityChange = vi.fn()
    const cleanup = installFacebookPopulationIdentify({
      map,
      clickEvent: "click",
      showEvent: "show",
      hideEvent: "hide",
      onVisibilityChange,
      toLngLat: () => ({ lng: 105, lat: 38 }),
      fetcher: vi.fn()
    } as any)

    expect(onVisibilityChange).toHaveBeenLastCalledWith(false)
    facebookLayer.show = true
    emitFacebook("show")
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true)
    facebookLayer.show = false
    emitFacebook("hide")
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false)

    cleanup()
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false)
  })
})
