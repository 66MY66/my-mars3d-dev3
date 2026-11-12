import { describe, expect, it } from "vitest"
import config from "../../public/config/config.json"

describe("China national and provincial boundary layer", () => {
  it("loads the boundary GeoJSON under the anomaly-monitoring auxiliary group", () => {
    const layers = config.layers || []
    const root = layers.find((item: any) => item?.id === 70)
    const directory = layers.find((item: any) => item?.id === 7070)
    const layer = layers.find((item: any) => item?.name === "中国国界与省级行政区划界线")

    expect(root).toMatchObject({ name: "卫星遥感产品", type: "group" })
    expect(directory).toMatchObject({ id: 7070, pid: 70, name: "辅助图层", type: "group" })
    expect(layer).toMatchObject({
      id: 707001,
      pid: 7070,
      type: "geojson",
      url: "/api/rs-products/rs-products/spatial/china-admin/province_border.geojson",
      symbol: {
        type: "polylineP",
        styleOptions: {
          color: "#ffd666",
          width: 2,
          opacity: 0.9
        }
      },
      show: false,
      flyTo: true,
      hasOpacity: true,
      metadata: {
        source: "eoAPI STAC",
        itemId: "SP-china-province-border"
      }
    })
    expect(layer?.popup).toBeUndefined()
  })
})
