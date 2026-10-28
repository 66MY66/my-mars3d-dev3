import { describe, expect, it } from "vitest"
import { findNextAvailableFrameIndex, getTimelineStatusText } from "./status"

describe("timeline player status", () => {
  it("asks for a dataset before one is selected", () => {
    expect(getTimelineStatusText({ selected: false, itemCount: 0, skippedFrame: false })).toBe("请选择数据集")
  })

  it("reports an empty selected time range", () => {
    expect(getTimelineStatusText({ selected: true, itemCount: 0, skippedFrame: false })).toBe("该范围内无影像")
  })

  it("prioritizes the unavailable-frame notice after a frame is skipped", () => {
    expect(getTimelineStatusText({ selected: true, itemCount: 3, skippedFrame: true })).toBe("该帧不可用，已跳过")
  })

  it("finds the next available frame and does not retry the failed frame", () => {
    const attempted: number[] = []
    const result = findNextAvailableFrameIndex(4, 1, (index) => {
      attempted.push(index)
      return index === 3
    })

    expect(result).toBe(3)
    expect(attempted).toEqual([2, 3])
  })

  it("returns no frame after checking every remaining frame once", () => {
    const attempted: number[] = []
    const result = findNextAvailableFrameIndex(3, 1, (index) => {
      attempted.push(index)
      return false
    })

    expect(result).toBeNull()
    expect(attempted).toEqual([2, 0])
  })
})
