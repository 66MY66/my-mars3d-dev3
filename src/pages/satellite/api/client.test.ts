import { describe, expect, it } from "vitest"
import { toJeecgPage } from "./client"

describe("eoAPI pagination adapter", () => {
  it("converts offset/limit to jeecg-style page", () => {
    expect(toJeecgPage([{ id: "1" }], 0, 10, 1)).toEqual({
      records: [{ id: "1" }], total: 1, current: 1, size: 10
    })
  })

  it("computes current page from offset", () => {
    expect(toJeecgPage([{ id: "2" }], 20, 10).current).toBe(3)
  })

  it("normalizes an empty page", () => {
    expect(toJeecgPage([], 0, 10)).toEqual({ records: [], total: 0, current: 1, size: 10 })
  })
})
