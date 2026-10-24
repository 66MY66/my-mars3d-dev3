import { describe, expect, it } from "vitest"
import { composerDock, workbenchDock } from "./composer-dock"

describe("workbench viewport bounds", () => {
  it("clamps a selection's offscreen right edge and keeps its header reachable", () => {
    expect(workbenchDock({ left: 2000, top: 1100 }, { width: 1440, height: 900 }, false)).toEqual({ left: 1028, top: 288 })
    expect(workbenchDock({ left: -900, top: -400 }, { width: 1440, height: 900 }, false)).toEqual({ left: 12, top: 12 })
  })
  it("keeps the composer and workbench inside the viewport when the selection moves", () => {
    for (const left of [-600, 700, 2400]) {
      const panel = workbenchDock({ left, top: 150 }, { width: 1368, height: 937 }, true)
      expect(panel.left).toBe(956)
      const composer = composerDock({ x: panel.left + 60, y: panel.top + 63, w: 400, h: 600 }, { width: 1440, height: 1000 })
      expect(composer.x).toBeGreaterThanOrEqual(72)
      expect(composer.x + composer.w + 12).toBe(panel.left + 60)
    }
  })
})

describe("composer docking", () => {
  it("aligns with the analysis dialog on its left with a 12px gap", () => {
    const anchor = { x: 1244, y: 166, w: 400, h: 600 }
    const result = composerDock(anchor, { width: 1920, height: 1080 })
    expect(result).toEqual({ x: 112, y: 166, w: 1120, h: 600 })
    expect(result.x + result.w + 12).toBe(anchor.x)
  })
  it("fits the available left space and keeps the map toolbar clear", () => {
    expect(composerDock({ x: 700, y: 100, w: 400, h: 600 }, { width: 1280, height: 800 })).toEqual({ x: 72, y: 100, w: 616, h: 600 })
  })
  it("stacks below the compact analysis dialog without overlap on mobile", () => {
    const result = composerDock({ x: 12, y: 64, w: 366, h: 372 }, { width: 390, height: 844 })
    expect(result).toEqual({ x: 12, y: 448, w: 366, h: 384 })
  })
})
