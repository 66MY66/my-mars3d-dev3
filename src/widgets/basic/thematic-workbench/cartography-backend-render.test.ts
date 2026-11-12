import { describe, expect, it } from "vitest"
import { backendDisplay, backendRange, backendRenderPlan, classifiedDisplay } from "./cartography-backend-render"
import { remoteLayerAssets, remoteRasterParams, remoteItemTime, type RemoteItem } from "./remote-cartography-source"
import { classifyRawValues, type CartographySourceWindow } from "./cartography-source-window"
import { workflowRequirements } from "./cartography-workflow"

const scene: RemoteItem = {
 type: "Feature",
id: "mersi",
collection: "fy3-mersi-l1",
bbox: [100, 25, 110, 35],
properties: {},
assets: {
  visual: { href: "http://192.168.10.15:9002/rs-warm-images/rgb.tif", type: "image/tiff" },
  visible: { href: "http://192.168.10.15:9002/rs-warm-images/reflectance.tif", type: "image/tiff", unit: "1", bands: [{ name: "CH01", min: 0.04, max: 0.98 }, { name: "CH02", min: 0.02, max: 0.94 }] },
  thermal: { href: "http://192.168.10.15:9002/rs-warm-images/brightness.tif", type: "image/tiff", unit: "K", bands: [{ name: "CH24", min: 217, max: 318 }] }
} 
}
const options = { band: 1, minimum: 0, maximum: 1, automatic: true }
describe("backend data-specific cartographic rendering", () => {
  it.each(["SP-china-pop2020", "SP-china-gdp2020", "DEF-rate"])("preserves the preset visual asset for %s without inventing its classes", id => {
    const item: RemoteItem = { ...scene, id, collection: id.startsWith("DEF-") ? "insar-deformation" : "spatial-thematic", assets: { visual: scene.assets.visual, data: scene.assets.visible } }
    const visual = remoteLayerAssets(item).find(asset => asset.key === "visual")!
    expect(visual.numeric).toBe(false)
    const plan = backendRenderPlan(item, visual, "raster-ramp", options, null)
    expect(plan.kind).toBe("preset"); expect(plan.legend).toEqual([])
    const query = remoteRasterParams(visual, plan.params)
    expect(query.get("assets")).toBe("visual"); expect(query.has("colormap_name")).toBe(false); expect(query.has("rescale")).toBe(false)
  })
  it("treats both Landsat aliases as scalar values, stretches real values and never guesses temperature units", () => {
    const lst: RemoteItem = { ...scene, id: "SP-landsat-lst-20260216", collection: "spatial-thematic", properties: { datetime_range_start: "2026-02-16T00:00:00Z", datetime: "2026-04-15T00:00:00Z" }, assets: { data: { ...scene.assets.visible, unit: undefined }, visual: { ...scene.assets.visible, unit: undefined } } }
    const assets = remoteLayerAssets(lst)
    expect(assets.map(a => [a.key, a.numeric])).toEqual([["data", true], ["visual", true]])
    const raw = { statistics: { minimum: 10.97, maximum: 32.53 } } as CartographySourceWindow
    for (const asset of assets) {
      const plan = backendRenderPlan(lst, asset, "thermal-infrared", options, raw)
      expect(plan.params).toMatchObject({ minimum: 10.97, maximum: 32.53, colormapName: "inferno" })
      expect(plan.unit).toBe("原始值（单位待核验）")
      expect(classifiedDisplay(lst, asset, "thermal-infrared")).toBe(false)
      expect(remoteRasterParams(asset, plan.params).get("asset_bidx")).toBe(`${asset.key}|1`)
      expect(() => backendRenderPlan(lst, asset, "thermal-infrared", options, null)).toThrow("选区有效原值")
    }
    expect(remoteItemTime(lst)).toBe("2026-02-16 至 2026-04-15（资料时段）")
    expect(workflowRequirements("thermal-infrared").find(r => r.key === "thermal")?.adapter).toBe("business-vector")
    expect(workflowRequirements("thermal-infrared").find(r => r.adapter === "lst")?.group).toBe("optional")
    const threshold = backendRenderPlan(lst, assets[0], "raster-threshold", { ...options, automatic: false, minimum: 0, maximum: 50, threshold: 25 }, null)
    expect(threshold.params.colormap).toHaveLength(2)
    expect(threshold.label).toContain("非业务预警")
  })
  it("preserves backend RGB without an invented single-band palette", () => {
    const asset = remoteLayerAssets(scene).find(a => a.key === "visual")!
    const plan = backendRenderPlan(scene, asset, "T30203000", options, null)
    expect(plan.kind).toBe("rgb"); expect(plan.legend).toEqual([])
    const query = remoteRasterParams(asset, plan.params)
    expect(query.get("assets")).toBe("visual"); expect(query.has("colormap_name")).toBe(false); expect(query.has("rescale")).toBe(false)
  })
  it("uses grayscale reflectance, not population blue or quantile classes", () => {
    const asset = remoteLayerAssets(scene).find(a => a.key === "visible")!
    expect(classifiedDisplay(scene, asset, "T30203000")).toBe(false)
    const plan = backendRenderPlan(scene, asset, "T30203000", options, null)
    expect(plan.params.colormapName).toBe("gray"); expect(plan.label).toContain("灰度")
    expect(backendRange(scene, asset, 2)).toEqual([0.02, 0.94])
  })
  it("keeps brightness temperature distinct from land-surface temperature and thermal anomaly", () => {
    const asset = remoteLayerAssets(scene).find(a => a.key === "thermal")!
    const plan = backendRenderPlan(scene, asset, "thermal-infrared", { ...options, minimum: 217, maximum: 318 }, null)
    expect(plan.params.colormapName).toBe("inferno"); expect(plan.label).toContain("非地表温度")
    expect(plan.legend.every(row => row.label.endsWith("K"))).toBe(true)
  })
  it("submits real class breaks as contiguous backend intervals without rescaling again", () => {
    const pop: RemoteItem = { ...scene, id: "SP-china-pop2020", collection: "spatial-thematic", properties: { "grid:unit": "人/平方公里" }, assets: { data: scene.assets.visible } }
    const asset = remoteLayerAssets(pop)[0]
    const classes = classifyRawValues([0, 10, 20, 30, 40, 50], { ...options, maximum: 50 }, "population")
    const raw = { ...classes, statistics: classes.summary } as unknown as CartographySourceWindow
    const plan = backendRenderPlan(pop, asset, "T30102000", options, raw)
    expect(plan.params.colormap).toHaveLength(classes.breaks.length)
    const query = remoteRasterParams(asset, plan.params)
    expect(query.has("rescale")).toBe(false); expect(query.has("colormap_name")).toBe(false)
    const intervals = JSON.parse(query.get("colormap")!)
    expect(intervals.every((entry: any, i: number) => !i || entry[0][0] === intervals[i - 1][0][1])).toBe(true)
    expect(plan.legend).toEqual(classes.legend)
    expect(() => backendRenderPlan(pop, asset, "T30102000", options, null)).toThrow("原始数值断点")
  })
  it("requires an explicit threshold and never pretends a color ramp is an isoline", () => {
    const pop: RemoteItem = { ...scene, id: "SP-china-pop2020", collection: "spatial-thematic", assets: { data: scene.assets.visible } }
    const asset = remoteLayerAssets(pop)[0]
    expect(() => backendRenderPlan(pop, asset, "raster-threshold", options, null)).toThrow("分类阈值")
    const plan = backendRenderPlan(pop, asset, "raster-threshold", { ...options, threshold: 100 }, null)
    expect(plan.params.colormap).toHaveLength(2); expect(plan.legend[1].label).toContain("100")
    expect(workflowRequirements("contour")[0].label).toBe("等值线成果")
    expect(workflowRequirements("contour").some(entry => entry.adapter === "population")).toBe(false)
  })
  it("renders an unmapped quantity as explicit scalar grayscale rather than inventing population semantics", () => {
    const unknown = { ...scene, collection: "other", assets: { data: scene.assets.visible } }
    const asset = { key: "data", title: "unknown", kind: "raster" as const, numeric: true, bands: ["b1"], range: [0, 1] as [number, number] }
    expect(backendDisplay(unknown, asset)).toBe("scalar")
    expect(backendRenderPlan(unknown, asset, "raster-ramp", { ...options, automatic: false }, null)).toMatchObject({ params: { colormapName: "gray" }, label: "原始数值 · 灰度线性拉伸（不推断业务物理量）" })
  })
  it.each([
    ["population", "blues"], ["economy", "greens"], ["rate", "rdbu_r"], ["temperature", "inferno"], ["reflectance", "gray"], ["brightness", "inferno"]
  ] as const)("renders inspected %s in a new collection using its quantity rather than names", (quantity, colormapName) => {
    const unknown: RemoteItem = { ...scene, id: "unrelated-record", collection: "new-collection", properties: {}, assets: { data: scene.assets.visible } }
    const asset = { ...remoteLayerAssets(unknown)[0], quantity }
    const raw = { statistics: { minimum: 1, maximum: 10 } } as CartographySourceWindow
    expect(backendDisplay(unknown, asset)).toBe(quantity)
    expect(backendRenderPlan(unknown, asset, "raster-ramp", options, raw).params.colormapName).toBe(colormapName)
  })
  it("keeps fixed breaks unchanged across different data ranges and rejects invalid cutoffs", () => {
    const fixed = { ...options, automatic: false, minimum: 0, maximum: 50, fixedBreaks: [10, 30, 50] }
    const a = classifyRawValues([0, 5, 100], fixed)
    const b = classifyRawValues([20, 300, 500], fixed)
    expect(a.breaks).toEqual(b.breaks); expect(a.color(100)).toBe(b.color(500))
    expect(a.legend.at(-1)!.label).toContain("含上限以上")
    expect(() => classifyRawValues([1, 2], { ...fixed, fixedBreaks: [30, 10] })).toThrow("递增")
    expect(() => classifyRawValues([1, 2], { ...fixed, fixedBreaks: [NaN] })).toThrow("有限")
  })
})
