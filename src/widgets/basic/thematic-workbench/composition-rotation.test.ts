import { describe, expect, it } from "vitest"
import { rotationHandle, snapRotation } from "./composition-rotation"
import { PAGE, createCompositionItem } from "./composition-model"

describe("rotation interaction", () => {
  it("snaps near standard angles, supports shift steps and alt override", () => {
    expect(snapRotation(43)).toBe(45)
    expect(snapRotation(359)).toBe(0)
    expect(snapRotation(-89)).toBe(270)
    expect(snapRotation(38, true)).toBe(45)
    expect(snapRotation(43, false, true)).toBe(43)
    expect(snapRotation(39)).toBe(39)
  })
  it("keeps a fixed screen gap and puts the handle outside small symbols", () => {
    const rect = { x: 600, y: 500, w: 34, h: 34 }
    for (const zoom of [0.15, 0.37, 1, 2]) {
      for (const angle of [0, 45, 90, 180, 270]) {
        const point = rotationHandle(rect, angle, zoom)
        expect(Math.hypot(point.x - point.anchorX, point.y - point.anchorY) * zoom).toBeCloseTo(40)
        expect(point.x * zoom).toBeGreaterThanOrEqual(24)
        expect(point.y * zoom).toBeGreaterThanOrEqual(24)
        expect(point.x * zoom).toBeLessThanOrEqual(PAGE.width * zoom - 24)
        expect(point.y * zoom).toBeLessThanOrEqual(PAGE.height * zoom - 24)
      }
    }
  })
  it("moves the handle below top-edge titles instead of clipping it above the page", () => {
    const title = createCompositionItem("title")
    const point = rotationHandle(title, 0, 0.37)
    expect(point.y).toBeGreaterThan(title.y + title.h)
    expect(point.anchorY).toBe(title.y + title.h)
  })
})
