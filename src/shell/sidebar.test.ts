import { describe, expect, it } from "vitest"
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from "@/shell/sidebar"

describe("sidebar", () => {
  it("persists collapsed state", () => {
    setStoredSidebarCollapsed(true)
    expect(getStoredSidebarCollapsed()).toBe(true)
    setStoredSidebarCollapsed(false)
    expect(getStoredSidebarCollapsed()).toBe(false)
  })
})

