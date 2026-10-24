import { describe, expect, it } from "vitest"
import { reactive } from "vue"
import { createCompositionItem, restoreComposition } from "./composition-model"
import { standardCompositionIssues, syncStandardComposition, type StandardComposition } from "./standard-composition"

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
