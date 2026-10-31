import { describe, expect, it } from "vitest"
import config from "../../public/config/config.json"

function findLayer(items: any[], name: string): any | undefined {
  for (const item of items) {
    if (item?.name === name) {
      return item
    }
    if (Array.isArray(item?.layers)) {
      const match = findLayer(item.layers, name)
      if (match) {
        return match
      }
    }
  }
  return undefined
}

describe("population density layers", () => {
  it("loads the GDP visual asset as a positioned STAC tile layer", () => {
    const layer = findLayer(config.layers || [], "人口GDP分布密度")

    expect(layer).toMatchObject({
      id: 412001,
      pid: 4120,
      type: "xyz",
      minimumLevel: 2,
      maximumLevel: 14,
      rectangle: {
        xmin: 67.5,
        ymin: 15,
        xmax: 136.8,
        ymax: 55
      },
      show: false,
      hasOpacity: true,
      flyTo: true,
      metadata: {
        source: "eoAPI STAC",
        description: "China 2020 GDP density visual asset",
        temporalRange: "2020"
      }
    })
    expect(layer.radio).toBeUndefined()
    expect(layer.url).toBe(
      "/api/titiler/collections/spatial-thematic/items/SP-china-gdp2020/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=visual&resampling=nearest"
    )
  })

  it("loads the Facebook population visual asset as the next positioned STAC tile layer", () => {
    const layer = findLayer(config.layers || [], "Facebook 人口密度")

    expect(layer).toMatchObject({
      id: 412002,
      pid: 4120,
      type: "xyz",
      minimumLevel: 2,
      maximumLevel: 14,
      rectangle: {
        xmin: 67.5,
        ymin: 15,
        xmax: 136.8,
        ymax: 55
      },
      show: false,
      hasOpacity: true,
      flyTo: true,
      metadata: {
        source: "eoAPI STAC",
        description: "China 2020 Facebook population density visual asset",
        temporalRange: "2020"
      }
    })
    expect(layer.url).toBe(
      "/api/titiler/collections/spatial-thematic/items/SP-china-pop2020/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=visual&resampling=nearest"
    )
    expect(layer.radio).toBeUndefined()
  })

  it("keeps GDP before Facebook in the configured imagery order", () => {
    const layers = config.layers || []
    const gdpIndex = layers.findIndex((item: any) => item?.name === "人口GDP分布密度")
    const facebookIndex = layers.findIndex((item: any) => item?.name === "Facebook 人口密度")

    expect(gdpIndex).toBeGreaterThanOrEqual(0)
    expect(facebookIndex).toBe(gdpIndex + 1)
  })
})
