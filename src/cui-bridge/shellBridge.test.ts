import { describe, expect, it, vi } from "vitest"
import { initShellBridge } from "@/cui-bridge/shellBridge"
import { commandBus } from "@/core/commandBus"
import { protocolVersion } from "@/cui-bridge/protocol"

describe("shellBridge", () => {
  it("handles cmd.execute and posts cmd.result", async () => {
    commandBus.register("unit.ok", () => ({ success: true, data: { ok: true } }))

    const postSpy = vi.spyOn(window, "postMessage")
    const dispose = initShellBridge(() => window)

    const msg = {
      version: protocolVersion,
      type: "cmd.execute",
      requestId: "r1",
      payload: { cmd: "unit.ok", args: {} }
    }

    const evt = new MessageEvent("message", { data: msg })
    Object.defineProperty(evt, "source", { value: window })
    window.dispatchEvent(evt)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(postSpy).toHaveBeenCalled()

    dispose()
    postSpy.mockRestore()
  })
})
