import { describe, expect, it } from "vitest"
import config from "../../public/config/config.json"

describe("imagery product layers", () => {
  it("exposes the four requested XYZ products under one imagery-products group", () => {
    const layers = config.layers || []
    const group = layers.find((item: any) => item?.name === "影像产品" && item?.type === "group") as any

    expect(group).toBeDefined()

    const children = layers.filter((item: any) => item?.pid === group.id) as any[]
    expect(children).toHaveLength(4)
    expect(children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "2-9 光学真彩色",
          type: "xyz",
          url: "http://192.168.10.15:5952/collections/fy3-mersi-l1/items/FY3H_MERSI_GRAN_L1_20260927_0700_1000M_V0/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=visual",
          rectangle: { xmin: 73.44, ymin: 20.9, xmax: 108.21, ymax: 42.48 }
        }),
        expect.objectContaining({
          name: "2-10 SAR 黑白",
          type: "xyz",
          url: "http://192.168.10.15:5952/collections/sentinel-1-sar/items/S1A_IW_GRDH_1SDV_20260927T100000_DEMO/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=visual&rescale=0,0.3&colormap_name=gray",
          rectangle: { xmin: 103.2, ymin: 35.6, xmax: 104.2, ymax: 36.6 }
        }),
        expect.objectContaining({
          name: "2-11 形变配色",
          type: "xyz",
          url: "http://192.168.10.15:5952/collections/insar-deformation/items/DEF-20261009151058-2ccbd7/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=visual",
          rectangle: { xmin: 103.2, ymin: 35.4, xmax: 104.4, ymax: 36.6 }
        }),
        expect.objectContaining({
          name: "2-12 热异常热力图",
          type: "xyz",
          url: "http://192.168.10.15:5952/collections/thermal-diff-timeseries/items/TD-kumamoto-2026-07-11/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=visual",
          rectangle: { xmin: 128.5, ymin: 30.5, xmax: 132.5, ymax: 34.5 }
        })
      ])
    )
  })
})
