import { describe, expect, it } from "vitest"
import { PAGE, constrainItem, containImage, createCompositionItem, restoreComposition, normalizeRotation, rotationBounds, reconcileCharts } from "./composition-model"

describe("composition layout", () => {
  it("keeps the main map dominant and inside the output safe area", () => {
    const map = createCompositionItem("map")
    const chart = createCompositionItem("chart")
    expect(map.w * map.h).toBeGreaterThan(chart.w * chart.h * 8)
    expect(constrainItem(map)).toEqual({ x: map.x, y: map.y, w: map.w, h: map.h })
  })
  it("contains the entire screenshot without stretching or cropping", () => {
    const rect = containImage({ x: 40, y: 120, w: 1140, h: 860 }, 1000, 500)
    expect(rect).toEqual({ x: 40, y: 265, w: 1140, h: 570 })
  })
  it("clamps dragging and resizing to the safe area", () => {
    expect(constrainItem({ x: -100, y: 2000, w: 2000, h: 2000 })).toEqual({ x: PAGE.margin, y: PAGE.margin, w: PAGE.width - 2 * PAGE.margin, h: PAGE.height - 2 * PAGE.margin })
    expect(constrainItem({ x: NaN, y: 0, w: -10, h: 0 })).toEqual({ x: 40, y: 40, w: 80, h: 44 })
  })
  it("snaps to peer edges only within the 20px tolerance", () => {
    const peer = { x: 400, y: 100, w: 200, h: 100 }
    expect(constrainItem({ x: 383, y: 400, w: 100, h: 100 }, [peer], true).x).toBe(400)
    expect(constrainItem({ x: 375, y: 400, w: 100, h: 100 }, [peer], true).x).toBe(375)
  })
  it("roundtrips text and positions while rejecting corrupt layouts", () => {
    const map = createCompositionItem("map")
    const title = createCompositionItem("title", "测试标题")
    title.x = 80; title.w = 700; title.color = "#234567"
    expect(restoreComposition(JSON.parse(JSON.stringify([map, title])))).toEqual([map, title])
    expect(restoreComposition([title])).toBeNull()
    expect(restoreComposition([map, { ...title, id: map.id }])).toBeNull()
    expect(restoreComposition([map, { kind: "unknown" }])).toBeNull()
    expect(PAGE.margin).toBe(40)
  })
  it("normalizes angles and keeps rotated corners inside the safe area", () => {
    expect(normalizeRotation(-45)).toBe(315)
    expect(normalizeRotation(Infinity)).toBe(0)
    for (const angle of [30, 45, 90, 180, 270]) {
      const rect = constrainItem({ x: -200, y: 990, w: 1520, h: 400, rotation: angle })
      const bounds = rotationBounds(rect, angle)
      expect(bounds.x).toBeGreaterThanOrEqual(39.999)
      expect(bounds.y).toBeGreaterThanOrEqual(39.999)
      expect(bounds.x + bounds.w).toBeLessThanOrEqual(PAGE.width - PAGE.margin + 0.001)
      expect(bounds.y + bounds.h).toBeLessThanOrEqual(PAGE.height - PAGE.margin + 0.001)
    }
  })
  it("migrates old decorations to transparent backgrounds and saves rotation", () => {
    const map = createCompositionItem("map")
    const legend = { ...createCompositionItem("legend"), rotation: -45, background: undefined }
    const restored = restoreComposition([map, legend])!
    expect(restored[1].rotation).toBe(315)
    expect(restored[1].background).toBe("transparent")
    expect(restoreComposition(JSON.parse(JSON.stringify(restored)))).toEqual(restored)
  })
  it("links add, edit and delete without resetting custom layout", () => {
    let items = reconcileCharts([createCompositionItem("map")], [{ id: "a", type: "heatmap", name: "heat" }])
    items[1].x = 200; items[1].rotation = 30; items[1].background = "transparent"; items[1].positioned = true
    items = reconcileCharts(items, [{ id: "a", type: "contour", name: "line" }, { id: "b", type: "heatmap", name: "heat" }])
    expect(items[1]).toMatchObject({ x: 200, rotation: 30, background: "transparent", linkedId: "a", chartType: "contour", label: "line" })
    expect(items).toHaveLength(3)
    items = reconcileCharts(items, [{ id: "a", type: "contour", name: "line" }])
    expect(items).toHaveLength(2)
    const restored = reconcileCharts(items, [{ id: "new-session", type: "contour", name: "line" }], true)
    expect(restored[1]).toMatchObject({ x: 200, rotation: 30, linkedId: "new-session" })
  })
  it("stacks automatically placed charts without overlap when adding templates", () => {
    let items = [createCompositionItem("map")]
    const charts = Array.from({ length: 4 }, (_, i) => ({ id: String(i), type: "heatmap", name: "heat" }))
    for (let count = 1; count <= charts.length; count++) { items = reconcileCharts(items, charts.slice(0, count)) }
    const boxes = items.filter(item => item.kind === "chart")
    for (const box of boxes) {
      expect(box.x).toBeGreaterThan(items[0].x + items[0].w)
      for (const other of boxes.filter(candidate => candidate !== box)) {
        expect(box.x < other.x + other.w && box.x + box.w > other.x && box.y < other.y + other.h && box.y + box.h > other.y).toBe(false)
      }
    }
  })
})
