import { describe, expect, it } from "vitest"
import { cartographyLabel, placeCartographyLabels, type LabelCandidate } from "./cartography-labels"
import type { DbtLayer } from "./dbt116-standard"
const frame = { x: 0, y: 0, w: 500, h: 400 }
const label = (id: string, priority = 300): LabelCandidate => ({ id, text: id, x: 250, y: 200, w: 80, h: 28, priority, radius: 12 })
const overlap = (a: typeof frame, b: typeof frame) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
describe("priority and physical map annotation placement", () => {
  it("prioritizes actual thematic anchors within 50 km in magnitude >= 6.5 events", () => {
    const source = { id: "targets", role: "target", data: { type: "FeatureCollection", features: [] } } as unknown as DbtLayer
    const feature = { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [104, 27] }, properties: { label: "目标", symbol: "dbt-medical" } }
    const event = { magnitude: 6.8, longitude: 104, latitude: 27 }
    const near = cartographyLabel(source, feature, [104, 27], "near", event)!
    const far = cartographyLabel(source, feature, [106, 27], "far", event)!
    expect(near.priority).toBeGreaterThan(far.priority)
    expect(near.priority).toBeLessThan(1000)
    expect(cartographyLabel(source, feature, [104, 27], "small", { ...event, magnitude: 6.4 })!.priority).toBe(far.priority)
    expect(near.bold).toBe(true)
  })
  it("places event and intensity first independently of geometry draw order", () => {
    const entries = [label("settlement"), label("event", 1000), label("intensity", 900)]
    const a = placeCartographyLabels(entries, frame)
    expect(a.placed[0].id).toBe("event"); expect(a.placed[1].id).toBe("intensity")
    expect(placeCartographyLabels(entries.reverse(), frame)).toEqual(a)
  })
  it("avoids all source symbols, other labels and the north arrow", () => {
    const obstacle = { x: 265, y: 150, w: 100, h: 80 }
    const result = placeCartographyLabels(Array.from({ length: 50 }, (_, i) => ({ ...label(`hospital-${i}`), x: 80 + i * 7, y: 110 + i * 3 })), frame, [obstacle])
    expect(result.placed.length).toBeGreaterThan(0)
    for (const a of result.placed) { expect(overlap(a.box, obstacle)).toBe(false); for (const b of result.placed) { if (a.id !== b.id) { expect(overlap(a.box, b.box)).toBe(false) } } }
    expect(result.placed.length + result.skipped.length).toBe(50)
  })
  it("reports omissions and retains the full text instead of truncating or overprinting", () => {
    const result = placeCartographyLabels([{ ...label("long"), w: 600 }, { ...label("outside"), x: 510 }, ...Array.from({ length: 200 }, (_, i) => label(`dense-${i}`))], frame)
    expect(result.skipped.find(x => x.id === "long")?.reason).toBe("oversize")
    expect(result.skipped.find(x => x.id === "outside")?.reason).toBe("outside")
    expect(result.skipped.some(x => x.reason === "crowded")).toBe(true)
    expect(result.placed.every(x => x.text === x.id)).toBe(true)
  })
  it("budgets dense candidates after ranking so a late event is never discarded by input order", () => {
    const entries = [...Array.from({ length: 30 }, (_, i) => label(`base-${i}`)), label("event", 1000)]
    const result = placeCartographyLabels(entries, frame, [], 80, 3)
    expect(result.placed[0].id).toBe("event")
    expect(result.skipped.filter(entry => entry.reason === "limit")).toHaveLength(28)
    expect(result.skipped.find(entry => entry.id === "event")).toBeUndefined()
  })
  it("generalizes ordinary base names at page scale but preserves essential thematic annotations", () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({ ...label(`base-${i}`), x: 20 + i % 10 * 45, y: 20 + Math.floor(i / 10) * 35, radius: 0, generalizable: true, maxOffset: 12 }))
    const event = { ...label("event", 1000), generalizable: false }
    const result = placeCartographyLabels([...entries, event], frame)
    expect(result.placed[0].id).toBe("event")
    expect(result.placed.filter(entry => entry.generalizable).length).toBeLessThanOrEqual(Math.floor(frame.w * frame.h / 14000))
    expect(result.skipped.some(entry => entry.reason === "generalized")).toBe(true)
    expect(result.placed.filter(entry => entry.generalizable).every(entry => !entry.leader)).toBe(true)
  })
  it("does not repeat an administrative name as an ordinary settlement label", () => {
    const high = { ...label("county", 540), repeatKey: "place:某县", radius: 0 }
    const low = { ...label("place", 220), repeatKey: "place:某县", generalizable: true, radius: 0 }
    const result = placeCartographyLabels([low, high], frame)
    expect(result.placed.map(entry => entry.id)).toEqual(["county"])
    expect(result.skipped[0].reason).toBe("duplicate")
  })
})
