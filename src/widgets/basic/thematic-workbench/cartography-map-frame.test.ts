import { describe, expect, it } from "vitest"
import { referenceMapFrame } from "./cartography-map-frame"
import { dbtDrawingBounds, emptyDbtDocument } from "./dbt116-standard"

describe("reference maps retain the queried range without stretching", () => {
  const slot = { x: 88, y: 196, w: 1076, h: 802 }
  it.each([
    { west: 102.198, south: 27.104, east: 104.079, north: 28.506 },
    { west: 102, south: 27, east: 103, north: 31 },
    { west: 102, south: 27, east: 106, north: 28 }
  ])("fits the frame instead of extending the area of interest: %j", bounds => {
    const doc = emptyDbtDocument(); doc.usage = "reference"; doc.reference = { title: "参考图", bounds, notice: "待核验" }
    expect(dbtDrawingBounds(doc, "T30101000")).toEqual(bounds)
    const frame = referenceMapFrame(bounds, slot)
    expect(frame.w / frame.h).toBeCloseTo((bounds.east - bounds.west) / (bounds.north - bounds.south), 10)
    expect(frame.w).toBeLessThanOrEqual(slot.w); expect(frame.h).toBeLessThanOrEqual(slot.h)
    expect(frame.x).toBeGreaterThanOrEqual(slot.x); expect(frame.y).toBeGreaterThanOrEqual(slot.y)
    const aligned = referenceMapFrame(bounds, slot, "top")
    expect(aligned.y).toBe(slot.y)
    expect(aligned.w / aligned.h).toBeCloseTo(frame.w / frame.h, 10)
  })
})
