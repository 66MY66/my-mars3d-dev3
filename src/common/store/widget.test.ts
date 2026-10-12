import { describe, expect, it } from "vitest"
import { isWidgetProtected, setWidgetProtected, shouldSkipMutualDisable } from "./widget-rules"

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
