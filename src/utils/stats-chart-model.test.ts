import { describe, expect, it } from "vitest"
import { buildStatsChartOption, getStatsDivisionLabel } from "./stats-chart-model"

describe("statistics chart model", () => {
  it("renders population as a descending horizontal ranking", () => {
    const option: any = buildStatsChartOption("population", [
      { 区划: "乙区", 人口: 200, 人口密度: 80 },
      { 区划: "甲区", 人口: 500, 人口密度: 120 }
    ])

    expect(option.yAxis.type).toBe("category")
    expect(option.yAxis.data).toEqual(["甲区", "乙区"])
    expect(option.xAxis.type).toBe("value")
    expect(option.series[0].type).toBe("bar")
    expect(option.series[0].data).toEqual([500, 200])
  })

  it("renders housing as five 100-percent stacked risk series", () => {
    const option: any = buildStatsChartOption("housing", [
      { 分类: "砖木结构", 高风险: 35, 较高风险: 25, 中风险: 20, 较低风险: 15, 低风险: 5 }
    ])

    expect(option.xAxis.max).toBe(100)
    expect(option.yAxis.data).toEqual(["砖木结构"])
    expect(option.series).toHaveLength(5)
    expect(option.series.every((item: any) => item.type === "bar" && item.stack === "抗震等级")).toBe(true)
  })

  it("renders economy as a treemap composition", () => {
    const option: any = buildStatsChartOption("economy", [
      { 区划: "甲区", 经济: 900 },
      { 区划: "乙区", 经济: 300 }
    ])

    expect(option.series[0].type).toBe("treemap")
    expect(option.series[0].data).toEqual([
      { name: "甲区", value: 900 },
      { name: "乙区", value: 300 }
    ])
  })

  it("renders thermal radiation with normal range, baseline and anomaly markers", () => {
    const option: any = buildStatsChartOption("radiation", [
      { 月份: "2026-01", 数值: 36, 基准值: 30, 正常下限: 26, 正常上限: 34, 异常: true },
      { 月份: "2026-02", 数值: 31, 基准值: 30, 正常下限: 26, 正常上限: 34, 异常: false }
    ])

    expect(option.series.map((item: any) => item.name)).toEqual(["正常下限", "正常范围", "历史基准", "热辐射", "异常点"])
    expect(option.series[1].stack).toBe("正常范围")
    expect(option.series[4].data).toEqual([["2026-01", 36]])
  })

  it("renders vegetation as stacked coverage areas with an NDVI line", () => {
    const option: any = buildStatsChartOption("vegetation", [
      { 月份: "2026-01", 无植被: 10, 低覆盖: 20, 中覆盖: 30, 中高覆盖: 25, 高覆盖: 15, NDVI: 0.48 }
    ])

    expect(option.yAxis[0].max).toBe(100)
    expect(option.series.slice(0, 5).every((item: any) => item.type === "line" && item.stack === "覆盖等级" && item.areaStyle)).toBe(true)
    expect(option.series[5].name).toBe("平均NDVI")
    expect(option.series[5].yAxisIndex).toBe(1)
  })

  it("describes the grouping basis for each card", () => {
    expect(getStatsDivisionLabel("population")).toBe("人口栅格 · 行政区汇总")
    expect(getStatsDivisionLabel("housing")).toBe("建筑结构 · 抗震等级")
    expect(getStatsDivisionLabel("economy")).toBe("区域经济贡献")
    expect(getStatsDivisionLabel("radiation")).toBe("月份 · 异常等级")
    expect(getStatsDivisionLabel("vegetation")).toBe("月份 · 覆盖等级")
  })
})
