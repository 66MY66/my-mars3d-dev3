import { describe, expect, it } from "vitest"
import { compositionHistory } from "./composition-history"
import { createCompositionItem } from "./composition-model"

describe("composition history", () => {
  it("restores independent snapshots for geometry, text, rotation and deletion", () => {
    const history = compositionHistory()
    const title = createCompositionItem("title", "Original")
    const originalX = title.x
    history.reset([title])
    title.rotation = 45; title.text = "Edited"; title.x = 200
    history.record([title])
    history.record([])
    expect(history.step(-1)?.[0]).toMatchObject({ rotation: 45, text: "Edited", x: 200 })
    const original = history.step(-1)!
    expect(original[0]).toMatchObject({ rotation: 0, text: "Original", x: originalX })
    original[0].text = "Must not mutate stored state"
    expect(history.step(-1)).toBeNull()
    expect(history.step(1)?.[0].text).toBe("Edited")
    expect(history.step(1)).toEqual([])
    expect(history.step(1)).toBeNull()
  })
  it("deduplicates frames and discards redo on new edits", () => {
    const history = compositionHistory()
    const item = createCompositionItem("north")
    history.reset([item]); history.record([item])
    expect(history.canUndo).toBe(false)
    item.rotation = 90; history.record([item]); history.step(-1)
    expect(history.canRedo).toBe(true)
    item.rotation = 180; history.record([item])
    expect(history.canRedo).toBe(false)
    expect(history.step(-1)?.[0].rotation).toBe(0)
  })
  it("retains chart identity and resets on a new scope", () => {
    const history = compositionHistory(2)
    const chart = { ...createCompositionItem("chart"), linkedId: "chart-1", chartType: "heatmap" }
    history.reset([]); history.record([chart])
    chart.chartType = "contour"; history.record([chart])
    chart.rotation = 30; history.record([chart])
    expect(history.step(-1)?.[0]).toMatchObject({ linkedId: "chart-1", chartType: "contour", rotation: 0 })
    expect(history.step(-1)?.[0].chartType).toBe("heatmap")
    expect(history.step(-1)).toBeNull()
    history.reset([])
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })
})
