import { describe, expect, it } from "vitest"
import config from "../../public/config/config.json"
import { removeRetiredLayers } from "./retired-layers"

describe("Jiuzhaigou 2017 intensity-zone layer", () => {
  it("exposes classified intensity polygons under seismic geology data", () => {
    const layers = removeRetiredLayers(config.layers || [])
    const root = layers.find((item: any) => item?.id === 100)
    const directory = layers.find((item: any) => item?.id === 101)
    const layer = layers.find((item: any) => item?.name === "2017年九寨沟7.0级地震烈度圈")

    expect(root).toMatchObject({ name: "地震监测与评估", type: "group" })
    expect(directory).toMatchObject({ id: 101, pid: 100, name: "地震地质基础数据", type: "group" })
    expect(layer).toMatchObject({
      id: 8050,
      pid: 101,
      type: "geojson",
      url: "/api/rs-products/rs-products/spatial/jiuzhaigou-20170808/intensity_zones.geojson",
      symbol: {
        type: "polygon",
        styleField: "intensity",
        styleFieldOptions: {
          "6": { color: "#ffd2da" },
          "7": { color: "#ffbebe" },
          "8": { color: "#ff7f7f" },
          "9": { color: "#c82828" }
        }
      },
      show: true,
      flyTo: true,
      hasOpacity: true,
      metadata: {
        source: "eoAPI STAC",
        itemId: "SP-jiuzhaigou2017-intensity"
      }
    })
    expect(layer?.popup).toContain("{intensity_label}")
  })
})
