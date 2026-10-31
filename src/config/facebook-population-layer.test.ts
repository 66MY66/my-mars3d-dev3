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
    expect(layer.url).toBe(
      "/api/titiler/collections/spatial-thematic/items/SP-china-gdp2020/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=visual&resampling=nearest"
    )
  })

  it("keeps an empty Facebook population density layer with standard layer controls", () => {
    const layer = findLayer(config.layers || [], "Facebook 人口密度")

    expect(layer).toMatchObject({
      pid: 4120,
      type: "graphic",
      data: [],
      show: false,
      hasOpacity: true,
      flyTo: false,
      metadata: {
        source: "待接入",
        description: "Facebook population density placeholder"
      }
    })
    expect(layer.url).toBeUndefined()
  })
})
