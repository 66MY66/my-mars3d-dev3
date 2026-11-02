import { describe, expect, it } from "vitest"
import config from "../../public/config/config.json"

describe("Landsat LST layer", () => {
  it("loads the Lijiang-Dali sample under the surface-temperature group", () => {
    const layer = (config.layers || []).find(
      (item: any) => item?.name === "Landsat地表温度（丽江—大理，2026-02—04）"
    )

    expect(layer).toMatchObject({
      id: 402001,
      pid: 4020,
      type: "xyz",
      url: "/api/titiler/collections/spatial-thematic/items/SP-landsat-lst-20260216/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=visual&resampling=nearest",
      minimumLevel: 0,
      maximumLevel: 12,
      rectangle: {
        xmin: 100.726296,
        ymin: 25.388546,
        xmax: 103.209958,
        ymax: 27.872208
      },
      show: true,
      hasOpacity: true,
      flyTo: true,
      metadata: {
        source: "eoAPI STAC",
        itemId: "SP-landsat-lst-20260216",
        temporalRange: "2026-02-16/2026-04-15"
      }
    })
  })
})
