import { describe, expect, it } from "vitest"
import config from "../../public/config/config.json"

const DATASET_PATH = "/api/rs-products/rs-products/spatial/basegeo-sw-250k/"
const layerCodes = ["BOUA", "BOUL", "LRDL", "LRRL", "HYDA", "HYDL", "RESA", "RESP", "AGNP"]

describe("southwest 1:250,000 base-geography layers", () => {
  it("exposes both I48 and H48 as 18 disabled GeoJSON layers", () => {
    const layers = config.layers || []

    expect(layers.find((item: any) => item?.id === 102)).toMatchObject({
      pid: 100,
      name: "基础地理数据",
      type: "group"
    })
    expect(layers.find((item: any) => item?.id === 1020)).toMatchObject({
      pid: 102,
      name: "西南基础地理（1:25万）",
      type: "group"
    })
    expect(layers.find((item: any) => item?.id === 1021)).toMatchObject({
      pid: 1020,
      name: "I48图幅（102°–108°E、32°–36°N）",
      type: "group"
    })
    expect(layers.find((item: any) => item?.id === 1022)).toMatchObject({
      pid: 1020,
      name: "H48图幅（102°–108°E、28°–32°N）",
      type: "group"
    })

    for (const [sheet, pid, idBase] of [
      ["I48", 1021, 102100],
      ["H48", 1022, 102200]
    ] as const) {
      layerCodes.forEach((code, index) => {
        const layer = layers.find((item: any) => item?.id === idBase + index + 1)
        expect(layer).toMatchObject({
          pid,
          type: "geojson",
          url: `${DATASET_PATH}${sheet}_build_${code}.geojson`,
          show: false,
          flyTo: true,
          hasOpacity: true,
          metadata: {
            itemId: "SP-swchina-basegeo-250k",
            sheet,
            featureCode: code
          }
        })
      })
    }
  })

  it("limits dense roads, hydrography lines, and settlement labels by distance", () => {
    const denseCodes = new Set(["LRDL", "HYDL", "AGNP"])
    const datasetLayers = (config.layers || []).filter((item: any) => item?.metadata?.itemId === "SP-swchina-basegeo-250k")

    expect(datasetLayers).toHaveLength(18)
    for (const layer of datasetLayers) {
      if (!denseCodes.has((layer as any).metadata.featureCode)) {
        continue
      }
      expect((layer as any).symbol?.styleOptions).toMatchObject({
        distanceDisplayCondition: true,
        distanceDisplayCondition_near: 0
      })
      expect((layer as any).symbol.styleOptions.distanceDisplayCondition_far).toBeGreaterThan(0)
    }
  })
})
