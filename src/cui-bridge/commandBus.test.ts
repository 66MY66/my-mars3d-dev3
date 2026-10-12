import { describe, expect, it } from "vitest"
import { commandBus } from "@/core/commandBus"

describe("commandBus", () => {
  it("returns error for unknown command", async () => {
    const res = await commandBus.execute("__not_exist__", {})
    expect(res.success).toBe(false)
  })

  it("executes registered command", async () => {
    commandBus.register("unit.echo", (args) => ({ success: true, data: args }))
    const res = await commandBus.execute("unit.echo", { a: 1 })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data).toEqual({ a: 1 })
    }
  })
})

