import { describe, expect, it } from "vitest"
import {
  collectNeighborRasterSources,
  formatNeighborRasterSummary,
  getNeighborParamDefs,
  type NeighborParamDef
} from "./neighbor-analysis"

const defs: NeighborParamDef[] = [
  { key: "analysisMode", label: "分析方式", type: "select", value: "hazard" },
  { key: "dataset", label: "数据集", type: "select", value: "hazard-point", modes: ["hazard"] },
  { key: "rasterSource", label: "栅格数据源", type: "select", value: "", modes: ["area", "focal"] },
  { key: "statistic", label: "统计方法", type: "select", value: "mean", modes: ["focal"] }
]

describe("neighbor analysis popup model", () => {
  it("keeps hazard controls and conditionally exposes raster controls", () => {
    expect(getNeighborParamDefs(defs, "hazard").map((item) => item.key)).toEqual(["analysisMode", "dataset"])
    expect(getNeighborParamDefs(defs, "area").map((item) => item.key)).toEqual(["analysisMode", "rasterSource"])
    expect(getNeighborParamDefs(defs, "focal").map((item) => item.key)).toEqual(["analysisMode", "rasterSource", "statistic"])
  })

  it("collects only visible analyzable raster layers and resolves bands", () => {
    const sources = collectNeighborRasterSources([
      { id: "cog", name: "地表温度", show: true, type: "cog", options: { url: "/lst.tif", bands: [{ id: 1, name: "LST", unit: "K" }] } },
      { id: "hidden", name: "隐藏DEM", show: false, type: "geotiff", options: { url: "/dem.tif" } },
      { id: "vector", name: "断层", show: true, type: "geojson" },
      { id: "image", name: "正射影像", show: true, type: "image", options: { url: "/ortho.png" } }
    ])

    expect(sources).toEqual([
      {
        id: "cog",
        label: "地表温度",
        sourceType: "cog",
        sourceRef: "/lst.tif",
        bands: [{ value: "1", label: "LST（K）" }]
      }
    ])
  })

  it("falls back to band one and formats the four required summary values", () => {
    const [source] = collectNeighborRasterSources([
      { id: 7, name: "形变速率", show: true, options: { sourceType: "geotiff", url: "/los.tif" } }
    ])
    expect(source.bands).toEqual([{ value: "1", label: "Band 1" }])
    expect(formatNeighborRasterSummary({ count: 12, mean: 1.234, maximum: 4, minimum: -2, stddev: 0.456, unit: "mm" })).toEqual([
      { key: "count", label: "有效像元", value: "12" },
      { key: "mean", label: "均值", value: "1.234 mm" },
      { key: "maximum", label: "最大值", value: "4.000 mm" },
      { key: "minimum", label: "最小值", value: "-2.000 mm" },
      { key: "stddev", label: "标准差", value: "0.456 mm" }
    ])
  })

  it("shows missing raster metrics as unavailable instead of zero", () => {
    expect(formatNeighborRasterSummary({ count: 0, mean: null, maximum: null, minimum: null, stddev: null, unit: "index" })).toEqual([
      { key: "count", label: "有效像元", value: "0" },
      { key: "mean", label: "均值", value: "—" },
      { key: "maximum", label: "最大值", value: "—" },
      { key: "minimum", label: "最小值", value: "—" },
      { key: "stddev", label: "标准差", value: "—" }
    ])
  })
})
