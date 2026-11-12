import { describe, expect, it } from "vitest"
import config from "../../public/config/config.json"
import { removeRetiredLayers } from "./retired-layers"

const layers = config.layers as any[]

describe("structured layer property details", () => {
  it("assigns the confirmed metadata profiles to the standalone layers", () => {
    const expectedProfiles = new Map([
      [707001, "china-admin-boundary"],
      [706001, "thermal-evolution-demo"],
      [8050, "jiuzhaigou-intensity"],
      [101001, "china-active-faults"]
    ])

    for (const [id, profile] of expectedProfiles) {
      expect(layers.find((layer) => layer.id === id)?.metadata?.detailProfile).toBe(profile)
    }
  })

  it("assigns the base-geography profile to every H48 and I48 child layer", () => {
    const sheetLayers = layers.filter((layer) => layer.pid === 1021 || layer.pid === 1022)

    expect(sheetLayers).toHaveLength(18)
    expect(sheetLayers.every((layer) => layer.metadata?.detailProfile === "basegeo-250k")).toBe(true)
    expect(new Set(sheetLayers.map((layer) => layer.metadata?.sheet))).toEqual(new Set(["H48", "I48"]))
  })

  it("keeps the building-damage heatmap in a visible earthquake damage assessment group", () => {
    const layer = layers.find((item) => item.id === 802001)
    const group = layers.find((item) => item.id === 103)
    const visibleLayers = removeRetiredLayers(layers)

    expect(layer).toMatchObject({
      pid: 103,
      name: "房屋损毁热力图（fake_damage10，测试数据）",
      type: "xyz",
      minimumLevel: 0,
      maximumLevel: 24,
      rectangle: { xmin: 101.5805, ymin: 26.5875, xmax: 101.5835, ymax: 26.5905 },
      metadata: {
        detailProfile: "building-damage-heatmap",
        collection: "building-damage-assessment",
        itemId: "HD-fake_damage10-01a19a99"
      }
    })
    expect(layer.url).toBe(
      "/api/titiler/collections/building-damage-assessment/items/HD-fake_damage10-01a19a99/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=data&rescale=0,2.983392&colormap_name=ylorrd"
    )
    expect(group).toMatchObject({ pid: 100, name: "地震灾害评估", type: "group" })
    expect(visibleLayers.some((item) => item.id === 103)).toBe(true)
    expect(visibleLayers.some((item) => item.id === 802001)).toBe(true)
  })
})
