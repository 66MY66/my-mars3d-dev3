import { describe, expect, it } from "vitest"
import { auxiliaryResultBasis, createAuxiliaryRunGate, SCREENSHOT_TOOLS_IN_WORKBENCH } from "./workbench-process"

describe("workbench auxiliary tools", () => {
  it("keeps screenshot experiments outside the production cartography workflow", () => {
    expect(SCREENSHOT_TOOLS_IN_WORKBENCH).toBe(false)
  })
  it.each(["raster", "temporal", "signal", "statistics", "spatial", "background", "numeric"] as const)("identifies %s as screenshot processing", mode => {
    expect(auxiliaryResultBasis(mode).source).toContain("RGB 像素")
    expect(auxiliaryResultBasis(mode).constraint).toContain("不用于")
  })
  it("distinguishes coordinates and observations from screenshot pixels", () => {
    expect(auxiliaryResultBasis("numeric", "projection").source).toBe("范围坐标")
    expect(auxiliaryResultBasis("earthquake").source).toBe("观测数据")
  })
  it("rejects late completion after navigating or reopening the same tool", () => {
    const gate = createAuxiliaryRunGate()
    expect(gate.accepts(gate.capture())).toBe(false)
    gate.update(true)
    const first = gate.capture()
    expect(gate.accepts(first)).toBe(true)
    gate.update(true)
    expect(gate.accepts(first)).toBe(false)
    const second = gate.capture()
    gate.update(false)
    expect(gate.accepts(second)).toBe(false)
    gate.update(true)
    expect(gate.accepts(first)).toBe(false)
    expect(gate.accepts(second)).toBe(false)
    expect(gate.accepts(gate.capture())).toBe(true)
  })
})
