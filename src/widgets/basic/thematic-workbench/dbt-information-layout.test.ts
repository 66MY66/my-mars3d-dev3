import { describe, expect, it } from "vitest"
import { layoutCartographyText } from "./cartography-text"
import { layoutDbtLegend } from "./dbt-legend-layout"
import { layoutDbtInformation } from "./dbt-information-layout"

const measure = (value: string, width: number, height: number, size: number) => layoutCartographyText(value, width - 4, height, size, (line, fontSize) => [...line].length * fontSize)
const legendMeasure = (value: string, width: number, size: number) => measure(value, width, Infinity, size).height

describe("complete multilayer A3 information column", () => {
  it("balances wrapped legend labels rather than forcing every entry into one column", () => {
    const entries = ["当前震中", "主要活动断层及其名称", "国界", "省界", "县界", "河流", "水面", "公路", "居民地", "VII度（7度）"].map((label, order) => ({ label, order }))
    const result = layoutDbtLegend(entries, 500, legendMeasure)
    expect(result.rows.map(row => row.entry)).toEqual(entries)
    expect(new Set(result.rows.map(row => row.x)).size).toBe(2)
    expect(result.omitted).toBe(0)
    expect(result.height).toBeLessThan(entries.reduce((sum, entry) => sum + Math.max(32, legendMeasure(entry.label, 318, 20)) + 3, 0))
    for (const row of result.rows) { expect(row.height).toBeGreaterThanOrEqual(legendMeasure(row.entry.label, row.width, result.fontSize)) }
  })
  it("retains description, statistics and every grouped legend entry in a dense normal proof", () => {
    const description = "地震及评估：历史事件震情，烈度分区为自动评估成果，不代表调查烈度。\n基础地理：1:25万，原始来源及坐标依据待核验。活动断层：目录提供的真实线要素。当前仅为在线数据校样，不能视为正式应急成果。"
    const entries = Array.from({ length: 18 }, (_, i) => ({ label: i % 5 ? `图层分类${i}` : `较长的图例分类说明${i}`, order: i, group: i < 9 ? "震情及评估" : "基础地理" }))
    const stats = ["已载入评估分区：4 个", "选区最高评估烈度：9 度"]
    const result = layoutDbtInformation(description, stats, entries, measure)
    expect(result.description.layout.lines.join("")).toBe(description.replaceAll("\n", ""))
    expect(result.description.layout.size).toBeGreaterThanOrEqual(16)
    expect(result.rows.map(row => row.value)).toEqual(stats)
    expect(result.legend.rows.map(row => row.entry)).toEqual(entries)
    expect(result.legend.headings.map(row => row.label)).toEqual(["震情及评估", "基础地理"])
    expect(result.legend.rows.every(row => row.y + row.height <= 1028)).toBe(true)
    expect(result.legend.omitted).toBe(0)
  })
  it("keeps large proportional circles unscaled and outside adjacent columns", () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({ label: `分级${i}`, radius: 42, order: i }))
    const result = layoutDbtLegend(entries, 200, legendMeasure)
    expect(new Set(result.rows.map(row => row.x)).size).toBe(1)
    expect(result.rows.every(row => row.height >= 88 && row.entry.radius === 42)).toBe(true)
  })
  it("flows the complete legend across columns instead of reserving two columns for each small group", () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({ label: `分类${i}`, order: i, group: `图层${i}` }))
    const result = layoutDbtInformation("后台专题图层及基础地理，按当前选区绘制。", ["有效像元：12,345 格"], entries, measure)
    expect(result.legend.rows.map(row => row.entry)).toEqual(entries)
    expect(result.legend.omitted).toBe(0)
    expect(result.legend.headings.every(heading => heading.y + heading.height <= 1028)).toBe(true)
    expect(result.legend.rows.every(row => row.y + row.height <= 1028)).toBe(true)
    expect(new Set(result.legend.rows.map(row => row.x)).size).toBe(2)
  })
  it("continues to reject genuine overflow without omitting entries or using unreadable text", () => {
    expect(() => layoutDbtInformation("说明".repeat(2000), [], [], measure)).toThrow("未生成文字不完整的校样")
    const entries = Array.from({ length: 120 }, (_, i) => ({ label: `完整图例分类${i}`, order: i }))
    expect(() => layoutDbtInformation("真实数据说明", [], entries, measure)).toThrow("未生成文字不完整的校样")
  })
})
