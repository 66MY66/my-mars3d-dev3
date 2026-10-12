import { describe, expect, it } from "vitest"
import { getIdentifyFocusAction } from "./identify-focus"

describe("identify precursor focus", () => {
  it("toggles the same precursor point back to the overview", () => {
    expect(getIdentifyFocusAction("precursor", 3, 3)).toBe("restore")
  })

  it("focuses a new precursor point and preserves other category behavior", () => {
    expect(getIdentifyFocusAction("precursor", null, 3)).toBe("focus")
    expect(getIdentifyFocusAction("macro", 3, 3)).toBe("focus")
  })
})
