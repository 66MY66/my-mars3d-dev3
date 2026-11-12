import { describe, expect, it } from "vitest"
import { buildBufferRequestParams, buildBufferResultView, convertDistanceValue, createBufferRunCoordinator, getBufferInputState } from "./buffer-model"

describe("buffer analysis parameter model", () => {
  it("preserves physical distance when switching units", () => {
    expect(convertDistanceValue(1000, "m", "km")).toBe(1)
    expect(convertDistanceValue(1.5, "km", "m")).toBe(1500)
  })

  it("builds a single-ring request in meters", () => {
    expect(buildBufferRequestParams({ mode: "single", unit: "km", distance: 1.5, ringDistances: [], enabledRingIndexes: [] })).toMatchObject({
      mode: "single",
      radiusM: 1500,
      distanceUnit: "m"
    })
  })

  it("describes a valid single-ring radius and rejects a zero radius", () => {
    expect(getBufferInputState({ mode: "single", unit: "km", distance: 5, ringDistances: [], enabledRingIndexes: [] })).toMatchObject({
      valid: true,
      message: "将生成 0–5 km 的单环缓冲区",
      selectedDistances: [5]
    })
    expect(getBufferInputState({ mode: "single", unit: "m", distance: 0, ringDistances: [], enabledRingIndexes: [] })).toMatchObject({
      valid: false,
      message: "环半径必须大于 0"
    })
  })

  it("builds multi-ring interval rows and rejects duplicate enabled distances", () => {
    expect(getBufferInputState({ mode: "multi", unit: "km", distance: 1, ringDistances: [1, 5, 10], enabledRingIndexes: [0, 1, 2] })).toMatchObject({
      valid: true,
      message: "将生成 3 个互不重叠的距离环带",
      ranges: [
        { start: 0, end: 1, label: "0–1 km" },
        { start: 1, end: 5, label: "1–5 km" },
        { start: 5, end: 10, label: "5–10 km" }
      ]
    })
    expect(getBufferInputState({ mode: "multi", unit: "km", distance: 1, ringDistances: [1, 1, 10], enabledRingIndexes: [0, 1, 2] })).toMatchObject({
      valid: false,
      message: "已启用的多环距离不能重复"
    })
  })

  it("requires enabled multi-ring distances to increase from near to far", () => {
    expect(getBufferInputState({ mode: "multi", unit: "km", distance: 1, ringDistances: [5, 1, 10], enabledRingIndexes: [0, 1, 2] })).toMatchObject({
      valid: false,
      message: "多环距离需要由近到远递增"
    })
  })

  it("normalizes multi-ring distances without creating zero-radius rings", () => {
    expect(buildBufferRequestParams({
      mode: "multi",
      unit: "m",
      distance: 500,
      ringDistances: [2000, 500, 1000, 0],
      enabledRingIndexes: [0, 2, 3]
    })).toMatchObject({
      mode: "multi",
      distancesM: [500, 1000, 2000],
      enabledRingIndexes: [1, 2]
    })
  })

  it("keeps a formal analysis current while preview requests are attempted", () => {
    const coordinator = createBufferRunCoordinator()
    const preview = coordinator.beginPreview()
    expect(preview).not.toBeNull()

    const analysis = coordinator.beginAnalysis()
    expect(coordinator.beginPreview()).toBeNull()
    expect(coordinator.isCurrent(analysis)).toBe(true)
    expect(coordinator.isCurrent(preview!)).toBe(false)

    coordinator.finish(analysis)
    expect(coordinator.beginPreview()).not.toBeNull()
  })

  it("builds visible metric cards and ordered ring rows for the result panel", () => {
    const view = buildBufferResultView({
      mode: "multi",
      sourceType: "point",
      totalAreaM2: 12_500_000,
      distancesM: [500, 1000, 2000],
      ringStats: [
        { level: "core", rangeM: [0, 500], areaM2: 780_000 },
        { level: "transition", rangeM: [500, 1000], areaM2: 2_350_000 },
        { level: "edge", rangeM: [1000, 2000], areaM2: 9_370_000 }
      ]
    })

    expect(view.cards).toEqual([
      { key: "source", label: "分析对象", value: "点" },
      { key: "mode", label: "缓冲方式", value: "多环缓冲" },
      { key: "distance", label: "最大距离", value: "2 km" },
      { key: "area", label: "覆盖面积", value: "12.5 km²" }
    ])
    expect(view.rings.map((ring) => ring.rangeText)).toEqual(["0–500 m", "500 m–1 km", "1–2 km"])
    expect(view.rings.map((ring) => ring.areaText)).toEqual(["0.78 km²", "2.35 km²", "9.37 km²"])
  })
})
