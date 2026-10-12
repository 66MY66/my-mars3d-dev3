import { afterEach, describe, expect, it } from "vitest"
import { __resetA11yStateForTest, probeAccessibilitySupport, setA11yEnabled, useA11yService } from "./service"

describe("a11y service", () => {
  afterEach(() => {
    __resetA11yStateForTest()
  })

  it("disables aria helpers when the switch is turned off", () => {
    const a11y = useA11yService()
    setA11yEnabled(false)

    expect(a11y.enabled.value).toBe(false)
    expect(a11y.shouldApplyAria.value).toBe(false)
    expect(a11y.ariaLabel("关闭")).toBeUndefined()
    expect(a11y.ariaHidden()).toBeUndefined()
  })

  it("marks the environment as degraded when browser capability is missing", () => {
    const original = window.matchMedia
    const originalUserAgent = window.navigator.userAgent
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: undefined
    })
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0"
    })

    const result = probeAccessibilitySupport()

    expect(result.degraded).toBe(true)
    expect(result.reason).toContain("matchMedia")

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: original
    })
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent
    })
  })
})
