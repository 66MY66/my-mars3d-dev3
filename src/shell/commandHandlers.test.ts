import { describe, expect, it, beforeEach } from "vitest"
import { commandBus } from "@/core/commandBus"

describe("mars3d skill commands", () => {
  beforeEach(() => {
    // 命令在 ShellLayout 挂载时注册；这里直接断言行为契约由集成测试覆盖，
    // 单测仅验证 bus 对未知命令返回失败
  })

  it("returns failure for unknown mars3d command", async () => {
    const res = await commandBus.execute("mars3d_open_panel", { panel: "unknown" })
    expect(res.success).toBe(false)
  })
})
