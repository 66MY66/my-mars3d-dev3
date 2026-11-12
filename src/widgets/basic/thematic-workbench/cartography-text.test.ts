import { describe, expect, it } from "vitest"
import { layoutCartographyText } from "./cartography-text"
import { layoutDbtInformation } from "./dbt-information-layout"

const measure = (value: string, width: number, height: number, size: number) => layoutCartographyText(value, width - 4, height, size, (line, fontSize) => [...line].length * fontSize)

describe("complete cartographic text", () => {
  it("preserves all characters, explicit paragraphs and long unbroken identifiers", () => {
    const value = "遥感影像：2026-09-27T07:00:00Z\n\n人口分布：来源和单位依据待核验。"
    const result = measure(value, 180, Infinity, 20)
    expect(result.lines.join("")).toBe(value.replaceAll("\n", ""))
    expect(result.lines).toContain("")
    expect(result.lines.every(line => [...line].length * result.size <= 176)).toBe(true)
  })
  it("fits long titles without horizontal compression or removing words", () => {
    const value = "2026-10-30 某地地震快速评估地震重灾区救灾相关信息专题图 · 在线数据校样"
    const result = layoutCartographyText(value, 780, 110, 36, (line, size) => [...line].length * size, 28)
    expect(result.fits).toBe(true)
    expect(result.lines.length).toBeGreaterThan(1)
    expect(result.lines.join("")).toBe(value)
  })
  it("moves statistics and legends below the full multi-layer description", () => {
    const description = "遥感影像：2026-09-27T07:00:00Z；源覆盖框包含选区；像元缺测及业务完整性仍待核验；指标单位依据待核验。\n人口分布：2020；源覆盖框包含选区；像元缺测及业务完整性仍待核验；指标单位依据待核验。"
    const entries = Array.from({ length: 5 }, (_, i) => ({ label: `[${i * 100}, ${(i + 1) * 100}] 原始值`, order: 350 }))
    const result = layoutDbtInformation(description, ["人口分布原值最小值：111 原始值", "人口分布原值最大值：1201 原始值", "有效/缺测像元：123456/0 格"], entries, measure)
    expect(result.description.layout.height).toBeGreaterThan(165)
    expect(result.description.layout.lines.join("")).toBe(description.replaceAll("\n", ""))
    expect(result.rows[0].y).toBeGreaterThan(result.description.y + result.description.layout.height)
    expect(result.legendY).toBeGreaterThan(result.rows.at(-1)!.y + result.rows.at(-1)!.layout.height)
    expect(result.legend.omitted).toBe(0)
    expect(result.legend.rows).toHaveLength(5)
  })
  it("wraps every statistic instead of silently dropping rows after six", () => {
    const statistics = Array.from({ length: 8 }, (_, i) => `统计指标${i}：123 原始值`)
    const result = layoutDbtInformation("真实数据说明", statistics, [], measure)
    expect(result.rows.map(row => row.value)).toEqual(statistics)
    expect(result.rows.every(row => row.layout.fits)).toBe(true)
  })
  it("refuses an unreadable overflowing sheet rather than returning a clipped proof", () => {
    expect(() => layoutDbtInformation("说明".repeat(1000), [], [], measure)).toThrow("未生成文字不完整的校样")
    expect(measure("文字".repeat(50), 100, 20, 18).fits).toBe(false)
  })
})
