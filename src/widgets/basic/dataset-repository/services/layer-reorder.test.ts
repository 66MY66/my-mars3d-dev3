import { describe, expect, it } from "vitest"
import { reorderLayerByDrop } from "./layer-reorder"

describe("reorderLayerByDrop", () => {
  it("moves a layer before a sibling and normalizes sibling order", () => {
    const layers = [
      { id: "a", pid: "root", order: 0 },
      { id: "b", pid: "root", order: 1 },
      { id: "c", pid: "root", order: 2 },
      { id: "child", pid: "a", order: 0 }
    ]

    const result = reorderLayerByDrop(layers, "c", "a", "before")

    expect(result.filter((item) => item.pid === "root").sort((a, b) => a.order - b.order).map((item) => item.id)).toEqual(["c", "a", "b"])
    expect(result.filter((item) => item.pid === "root").map((item) => item.order).sort()).toEqual([0, 1, 2])
    expect(result.find((item) => item.id === "child")?.pid).toBe("a")
  })
})
