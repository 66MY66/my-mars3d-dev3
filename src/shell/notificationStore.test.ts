import { describe, expect, it } from "vitest"
import {
  getSeverityColor,
  getSeverityRank,
  parseNotificationSeverity
} from "@/shell/notificationStore"

describe("notification severity helpers", () => {
  it("parses severity from notification title", () => {
    expect(parseNotificationSeverity("今天 18:32 触发预告警通知（严重）")).toBe("严重")
    expect(parseNotificationSeverity("2024-12-18 16:10 触发预告警通知（中等）")).toBe("中等")
    expect(parseNotificationSeverity("2024-12-17 09:20 触发预告警通知（轻微）")).toBe("轻微")
    expect(parseNotificationSeverity("未知通知")).toBe("轻微")
  })

  it("maps severity to colors", () => {
    expect(getSeverityColor("严重")).toBe("#CB272D")
    expect(getSeverityColor("中等")).toBe("#FF7D00")
    expect(getSeverityColor("轻微")).toBe("#FADC19")
  })

  it("ranks severity for sorting", () => {
    expect(getSeverityRank("严重")).toBeGreaterThan(getSeverityRank("中等"))
    expect(getSeverityRank("中等")).toBeGreaterThan(getSeverityRank("轻微"))
  })
})
