import { describe, expect, it, vi } from "vitest"
import { injectState } from "./widget"
import { isWidgetProtected, setWidgetProtected, shouldSkipMutualDisable } from "./widget-rules"

vi.mock("@mars/utils/mars-util", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn()
}))

describe("widget mutual exclusion", () => {
  it("keeps current-task visible when manage-layers is activated", () => {
    expect(shouldSkipMutualDisable("manage-layers", "current-task")).toBe(true)
    expect(shouldSkipMutualDisable("manage-layers", "dataset-repository")).toBe(false)
    expect(shouldSkipMutualDisable("dataset-repository", "current-task")).toBe(false)
  })

  it("protects current-task only while its import flow is active", () => {
    setWidgetProtected("current-task", true)
    expect(isWidgetProtected("current-task")).toBe(true)
    expect(shouldSkipMutualDisable("dataset-repository", "current-task")).toBe(true)

    setWidgetProtected("current-task", false)
    expect(isWidgetProtected("current-task")).toBe(false)
    expect(shouldSkipMutualDisable("dataset-repository", "current-task")).toBe(false)
  })
})

describe("widget load failure", () => {
  it("removes a failed widget from the mounted widget list so reopening can retry", async () => {
    const store = injectState({
      state: {
        widgets: [{ name: "broken-widget", visible: true }],
        openAtStart: ["broken-widget"]
      }
    })

    await store.dispatch("loadError", "broken-widget")

    expect(store.state.widgets[0].visible).toBe(false)
    expect(store.state.openAtStart).toEqual([])
  })
})
