import { describe, expect, it, vi } from "vitest"
import { reactive } from "vue"
import { createCompositionItem, restoreComposition } from "./composition-model"
import { standardComposition, standardCompositionIssues, syncStandardComposition, type StandardComposition } from "./standard-composition"

function scene(): StandardComposition {
  return {
 id: "T30101000",
title: "test",
usage: "test",
items: ["map", "title", "image"].map((kind, i) => ({
    ...createCompositionItem(kind as "map" | "title" | "image", i ? "caption" : ""),
    id: `standard:T30101000:${kind}`,
standardPart: kind,
    ...(kind === "title" ? { y: 38 } : {}),
    ...(kind === "image" ? { x: 88, y: 1140, w: 1560, h: 44 } : {}),
    raster: { image: "data:image/png;base64,AAAA", label: kind, detail: i ? "caption" : "", legend: [] }
  })) 
}
}

describe("standard templates in the original composer", () => {
  it("removes a cached generic north arrow when the georeferenced map already includes one", () => {
    const baseline = { ...scene(), northAngle: 0 }
    const cached = [...baseline.items, createCompositionItem("north")]
    expect(syncStandardComposition(cached, baseline).some(item => item.kind === "north")).toBe(false)
    expect(cached.some(item => item.kind === "north")).toBe(true)
    expect(syncStandardComposition(cached, scene()).some(item => item.kind === "north")).toBe(true)
  })
  it("retains the same canonical region identities from draft to a data-backed map", () => {
    const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as any)
    const encode = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AAAA")
    try {
      const canvas = document.createElement("canvas"); canvas.width = 1680; canvas.height = 1188
      const draft = standardComposition(canvas, null, "T30102000", 535, true)
      const backed = standardComposition(canvas, null, "T30102000", 535, false)
      expect(backed.northAngle).toBe(0); expect(draft.northAngle).toBeUndefined()
      expect(draft.items.map(item => item.id)).toEqual(backed.items.map(item => item.id))
      expect(syncStandardComposition(draft.items, backed).some(item => item.kind === "scale")).toBe(true)
    } finally { context.mockRestore(); encode.mockRestore() }
  })
  it("follows changed content-region dimensions without stretching a new raster into an old slot", () => {
    const baseline = scene(); const items = syncStandardComposition([], baseline)
    baseline.items[1].h = 360
    const updated = syncStandardComposition(items, baseline)
    expect(updated[1].h).toBe(360)
    expect(standardCompositionIssues(updated, baseline)).toEqual([])
  })
  it("preserves explicitly positioned geometry when new data change the default layout", () => {
    const baseline = scene(); const items = syncStandardComposition([], baseline)
    items[1].positioned = true; items[1].h = 150; items[1].x = 200
    baseline.items[1].h = 360
    const updated = syncStandardComposition(items, baseline)
    expect(updated[1].h).toBe(150); expect(updated[1].x).toBe(200)
  })
  it("copies Vue scenes without mutating their baseline", () => {
    const baseline = reactive(scene()); const items = syncStandardComposition([], baseline)
    items[0].x += 10
    expect(items[0].x).not.toBe(baseline.items[0].x)
    expect(standardCompositionIssues(items, baseline)).toHaveLength(1)
    expect(standardCompositionIssues(syncStandardComposition(items, baseline, true), baseline)).toEqual([])
  })
  it("keeps user geometry and custom text when new data arrive", () => {
    const baseline = scene(); const items = syncStandardComposition([], baseline)
    items[0].rotation = 30; items[1].text = "custom"
    baseline.items[0].raster!.image = "data:image/png;base64,BBBB"
    baseline.items[1].text = baseline.items[1].raster!.detail = "new event"
    const updated = syncStandardComposition(items, baseline)
    expect(updated[0].rotation).toBe(30)
    expect(updated[0].raster!.image).toContain("BBBB")
    expect(updated[1].text).toBe("custom")
  })
  it("updates untouched copy, but does not silently reinsert deleted elements", () => {
    const baseline = scene(); const items = syncStandardComposition([], baseline).slice(0, 2)
    baseline.items[1].text = baseline.items[1].raster!.detail = "new title"
    const updated = syncStandardComposition(items, baseline)
    expect(updated[1].text).toBe("new title")
    expect(updated).toHaveLength(2)
    expect(standardCompositionIssues(updated, baseline).join()).toContain("缺少")
    expect(standardCompositionIssues([...baseline.items, createCompositionItem("text")], baseline).join()).toContain("附加元素")
  })
  it("roundtrips approved page-edge regions without shifting the title or footer", () => {
    const baseline = scene(); const restored = restoreComposition(JSON.parse(JSON.stringify(baseline.items)))!
    expect(standardCompositionIssues(restored, baseline)).toEqual([])
    expect(restored[1].y).toBe(38)
    expect(restored[2].y).toBe(1140)
  })
  it("blocks stale or altered rendering metadata", () => {
    for (const patch of [{ standardPart: "other" }, { opacity: 0.5 }, { color: "#ffffff" }, { raster: undefined }, { hidden: true }]) {
      const baseline = scene(); const items = syncStandardComposition([], baseline)
      Object.assign(items[0], patch)
      expect(standardCompositionIssues(items, baseline)).toHaveLength(1)
    }
  })
})
