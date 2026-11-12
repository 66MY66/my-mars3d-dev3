import { describe, expect, it } from "vitest"
import { clampPetPosition, getDefaultPetPosition } from "./pet-position"

describe("desktop pet positioning", () => {
  it("places the pet near the lower-right corner inside the browser viewport", () => {
    expect(getDefaultPetPosition({ width: 1440, height: 900 }, { width: 190, height: 250 })).toEqual({
      x: 1226,
      y: 626
    })
  })

  it("keeps a dragged pet fully inside the browser viewport", () => {
    const viewport = { width: 1200, height: 800 }
    const pet = { width: 190, height: 250 }

    expect(clampPetPosition({ x: -80, y: -30 }, viewport, pet)).toEqual({ x: 12, y: 12 })
    expect(clampPetPosition({ x: 1180, y: 790 }, viewport, pet)).toEqual({ x: 998, y: 538 })
  })

  it("still exposes a reachable drag area when the viewport is smaller than the pet", () => {
    expect(
      clampPetPosition({ x: 200, y: 200 }, { width: 120, height: 100 }, { width: 190, height: 250 })
    ).toEqual({ x: 12, y: 12 })
  })
})
