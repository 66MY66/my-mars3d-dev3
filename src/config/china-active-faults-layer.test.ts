import { describe, expect, it } from "vitest"
import config from "../../public/config/config.json"
import { removeRetiredLayers } from "./retired-layers"

describe("China active faults layer", () => {
  it("exposes the on-demand GeoJSON layer under the seismic geology directory", () => {
    const visibleLayers = removeRetiredLayers(config.layers || [])
    const root = visibleLayers.find((item: any) => item?.name === "地震监测与评估")
    const directory = visibleLayers.find((item: any) => item?.name === "地震地质基础数据")
    const layer = visibleLayers.find((item: any) => item?.name === "中国活动断层线")

    expect(root).toMatchObject({ id: 100, type: "group" })
    expect(directory).toMatchObject({ id: 101, pid: 100, type: "group" })
    expect(layer).toMatchObject({
      id: 101001,
      pid: 101,
      type: "geojson",
      url: "http://192.168.10.15:9002/rs-products/spatial/china-faults/active_faults.geojson",
      show: true,
      flyTo: true,
      symbol: {
        type: "polylineP",
        styleOptions: {
          clampToGround: true,
          opacity: 1
        }
      }
    })
  })

  it("keeps the retired seismic demo branches hidden", () => {
    const visibleNames = new Set(removeRetiredLayers(config.layers || []).map((item: any) => item?.name))

    expect(visibleNames.has("地震中短期宏观异常检测")).toBe(false)
    expect(visibleNames.has("地震区域风险监测")).toBe(false)
    expect(visibleNames.has("地震灾害评估")).toBe(false)
  })
})
