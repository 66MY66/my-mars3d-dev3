import { describe, expect, it } from "vitest"
import { getLayerStatusText, isSameImageSelection } from "./status"

describe("split-screen compare status", () => {
  it("shows the required loading copy while imagery data is loading", () => {
    expect(getLayerStatusText({ loading: true, leftLoaded: false, rightLoaded: false })).toBe("正在加载影像…")
  })

  it("keeps the existing loaded-state copy when loading has finished", () => {
    expect(getLayerStatusText({ loading: false, leftLoaded: true, rightLoaded: true })).toBe("左侧已加载 | 右侧已加载")
  })

  it("detects the same collection and image without deciding whether loading may continue", () => {
    expect(isSameImageSelection("sar", "scene-1", "sar", "scene-1")).toBe(true)
    expect(isSameImageSelection("sar", "scene-1", "sar", "scene-2")).toBe(false)
  })
})
