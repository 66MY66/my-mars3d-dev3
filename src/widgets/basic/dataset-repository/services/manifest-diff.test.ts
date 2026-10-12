import { describe, expect, it } from "vitest"
import { diffManifests } from "./manifest-diff"

describe("diffManifests", () => {
  it("detects added and removed layers", () => {
    const a: any = {
      manifestVersion: "1.0",
      layers: [
        { id: "l1", name: "L1", sourceType: "xyz", sourceRef: "a", order: 0, visible: true, opacity: 1 }
      ]
    }
    const b: any = {
      manifestVersion: "1.0",
      layers: [
        { id: "l2", name: "L2", sourceType: "xyz", sourceRef: "b", order: 0, visible: true, opacity: 1 }
      ]
    }
    const out = diffManifests(a, b)
    expect(out.summary.added).toBe(1)
    expect(out.summary.removed).toBe(1)
    expect(out.added[0].id).toBe("l2")
    expect(out.removed[0].id).toBe("l1")
  })

  it("detects changed fields", () => {
    const a: any = {
      manifestVersion: "1.0",
      layers: [
        { id: "l1", name: "L1", sourceType: "xyz", sourceRef: "a", order: 0, visible: true, opacity: 1 }
      ]
    }
    const b: any = {
      manifestVersion: "1.0",
      layers: [
        { id: "l1", name: "L1-new", sourceType: "xyz", sourceRef: "a2", order: 0, visible: false, opacity: 0.5 }
      ]
    }
    const out = diffManifests(a, b)
    expect(out.summary.changed).toBe(1)
    const keys = out.changed[0].changes.map((c: any) => c.key)
    expect(keys).toContain("name")
    expect(keys).toContain("sourceRef")
    expect(keys).toContain("visible")
    expect(keys).toContain("opacity")
  })

  it("detects move by pid/order", () => {
    const a: any = {
      manifestVersion: "1.0",
      layers: [
        { id: "g1", name: "G1", sourceType: "group", sourceRef: "", order: 0, visible: true, opacity: 1 },
        { id: "l1", name: "L1", sourceType: "xyz", sourceRef: "a", pid: "g1", order: 0, visible: true, opacity: 1 }
      ]
    }
    const b: any = {
      manifestVersion: "1.0",
      layers: [
        { id: "g1", name: "G1", sourceType: "group", sourceRef: "", order: 0, visible: true, opacity: 1 },
        { id: "l1", name: "L1", sourceType: "xyz", sourceRef: "a", pid: undefined, order: 2, visible: true, opacity: 1 }
      ]
    }
    const out = diffManifests(a, b)
    expect(out.summary.moved).toBe(1)
    expect(out.moved[0].id).toBe("l1")
    expect(String(out.moved[0].fromPid)).toBe("g1")
    expect(out.moved[0].toPid).toBeUndefined()
  })
})

