import { describe, expect, it } from "vitest"
import { unwrapJeecgPage, unwrapJeecgResult } from "./client"

describe("JEECG response helpers", () => {
  it("unwraps list pagination", () => {
    expect(unwrapJeecgPage({ success: true, result: { records: [{ id: "1" }], total: 1, current: 1, size: 10 } })).toEqual({
      records: [{ id: "1" }], total: 1, current: 1, size: 10
    })
  })

  it("throws the backend message instead of pretending success", () => {
    expect(() => unwrapJeecgResult({ success: false, message: "保存失败", result: null })).toThrow("保存失败")
  })

  it("normalizes an empty page", () => {
    expect(unwrapJeecgPage({ success: true, result: null })).toEqual({ records: [], total: 0, current: 1, size: 10 })
  })
})
