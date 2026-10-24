import { describe, expect, it } from "vitest"
import { validateAdornments, type AdornmentSettings } from "./map-adornments"
import { defaultAdornmentSettings } from "./cartography-layout"

describe("mandatory map furniture", () => {
  const settings: AdornmentSettings = { ...defaultAdornmentSettings(), title: "地震专题", source: "观测台网", time: "2026-09-26T12:00:00Z", legendTitle: "相对风险", scaleDenominator: 50000 }
  const legend = [{ label: "低", color: "#27925d" }]
  const metrics = { metersPerPixel: 100, selectionWidth: 800, northAngle: 0 }
  it("requires all six elements, including real map metrics", () => {
    expect(validateAdornments(settings, legend, metrics).every((item) => item.valid)).toBe(true)
    expect(validateAdornments(settings, legend, null).filter((item) => !item.valid).map((item) => item.label)).toEqual(["比例尺", "指北针"])
  })
  it("rejects empty title, source, legend and invalid time", () => {
    const result = validateAdornments({ ...settings, title: "  ", source: "", time: "unknown" }, [], metrics)
    expect(result.filter((item) => !item.valid).map((item) => item.label)).toEqual(["标题", "图例", "时间", "来源"])
    expect(validateAdornments(settings, legend, { ...metrics, metersPerPixel: NaN }).find((item) => item.label === "比例尺")?.valid).toBe(false)
  })
  it("omits validation of disabled adornments without changing publication scale rules", () => {
    const disabled = { ...settings, title: "", source: "", time: "", enabled: { title: false, legend: false, scale: false, north: false, time: false, source: false } }
    expect(validateAdornments(disabled, [], null).every(item => item.valid)).toBe(true)
    expect(validateAdornments({ ...disabled, enabled: { ...disabled.enabled, title: true } }, [], null).find(item => item.label === "标题")?.valid).toBe(false)
  })
})
