import { describe, it, expect, vi } from "vitest"
import { preserveNativeLinePaths } from "./native-line-style"

describe("native source line paths", () => {
  it("removes implicit closure for nested multi-part lines, without altering vertices or polygon outlines", () => {
    const positions = [[102, 27], [103, 28], [104, 27]]
    const open = { type: "polylineP", positions, setStyle: vi.fn() }
    const ring = { type: "polyline", positions: [...positions, positions[0]], setStyle: vi.fn() }
    const polygon = { type: "polygonP", setStyle: vi.fn() }
    preserveNativeLinePaths({ graphics: [{ type: "group", eachGraphic: visit => [open, ring, polygon].forEach(visit) }] })
    expect(open.setStyle).toHaveBeenCalledWith({ fill: true, outline: false, closure: false })
    expect(ring.setStyle).toHaveBeenCalledWith({ fill: true, outline: false, closure: false })
    expect(polygon.setStyle).not.toHaveBeenCalled()
    expect(open.positions).toBe(positions)
    expect(open.positions).toHaveLength(3)
    expect(ring.positions).toEqual([...positions, positions[0]])
  })
})
