import { describe, expect, it } from "vitest"
import { generateLayerId, parseLayerId } from "./layer-id-generator"

describe("layer-id-generator", () => {
  it("generates IDs with the required layer format", () => {
    const id = generateLayerId(new Date(2026, 5, 26, 13, 45, 8))
    expect(id).toMatch(/^LAYER_20260626134508_[0-9a-f]{8}$/i)
  })

  it("generates unique IDs across repeated calls", () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i += 1) {
      ids.add(generateLayerId())
    }
    expect(ids.size).toBe(100)
  })

  it("parses a valid layer ID", () => {
    const parsed = parseLayerId("LAYER_20260626134508_ab12cd34")
    expect(parsed).not.toBeNull()
    expect(parsed?.random).toBe("ab12cd34")
    expect(parsed?.timestamp.getFullYear()).toBe(2026)
    expect(parsed?.timestamp.getMonth()).toBe(5)
    expect(parsed?.timestamp.getDate()).toBe(26)
    expect(parsed?.timestamp.getHours()).toBe(13)
    expect(parsed?.timestamp.getMinutes()).toBe(45)
    expect(parsed?.timestamp.getSeconds()).toBe(8)
  })

  it("returns null for invalid layer IDs", () => {
    expect(parseLayerId("invalid")).toBeNull()
    expect(parseLayerId("LAYER_invalid_ab12cd34")).toBeNull()
    expect(parseLayerId("LAYER_20260626134508_xxx")).toBeNull()
  })
})
