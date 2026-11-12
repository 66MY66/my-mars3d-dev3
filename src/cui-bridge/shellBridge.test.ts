import { afterEach, describe, expect, it, vi } from "vitest"
import { initShellBridge } from "@/cui-bridge/shellBridge"
import { commandBus } from "@/core/commandBus"
import { protocolVersion } from "@/cui-bridge/protocol"

describe("shellBridge", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function commandMessage(cmd = "unit.ok") {
    return {
      version: protocolVersion,
      type: "cmd.execute",
      requestId: "r1",
      payload: { cmd, args: {} }
    }
  }

  function dispatchBridgeMessage(source: Window, origin: string, data = commandMessage()) {
    const event = new MessageEvent("message", { data, origin })
    Object.defineProperty(event, "source", { value: source })
    window.dispatchEvent(event)
  }

  it("executes a command from the configured iframe and replies only to its exact origin", async () => {
    commandBus.register("unit.ok", () => ({ success: true, data: { ok: true } }))
    const target = { postMessage: vi.fn() } as unknown as Window
    const dispose = initShellBridge(() => target, "http://192.168.10.15:6060")

    dispatchBridgeMessage(target, "http://192.168.10.15:6060")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(target.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "cmd.result",
        requestId: "r1",
        payload: { cmd: "unit.ok", success: true, data: { ok: true } }
      }),
      "http://192.168.10.15:6060"
    )
    dispose()
  })

  it("ignores a message from the iframe when its origin is not allowed", async () => {
    const handler = vi.fn(() => ({ success: true as const }))
    commandBus.register("unit.blocked", handler)
    const target = { postMessage: vi.fn() } as unknown as Window
    const dispose = initShellBridge(() => target, "http://192.168.10.15:6060")

    dispatchBridgeMessage(target, "http://attacker.example", commandMessage("unit.blocked"))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(handler).not.toHaveBeenCalled()
    expect(target.postMessage).not.toHaveBeenCalled()
    dispose()
  })

  it("ignores messages after the bridge is disposed", async () => {
    const handler = vi.fn(() => ({ success: true as const }))
    commandBus.register("unit.disposed", handler)
    const target = { postMessage: vi.fn() } as unknown as Window
    const dispose = initShellBridge(() => target, "http://192.168.10.15:6060")

    dispose()
    dispatchBridgeMessage(target, "http://192.168.10.15:6060", commandMessage("unit.disposed"))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(handler).not.toHaveBeenCalled()
    expect(target.postMessage).not.toHaveBeenCalled()
  })

  it("rejects a registered command that is outside the bridge command whitelist", async () => {
    const handler = vi.fn(() => ({ success: true as const }))
    commandBus.register("unit.not-allowed", handler)
    const target = { postMessage: vi.fn() } as unknown as Window
    const dispose = initShellBridge(
      () => target,
      "http://192.168.10.15:6060",
      new Set(["route.navigate", "ui.panel.open", "ui.panel.close"])
    )

    dispatchBridgeMessage(target, "http://192.168.10.15:6060", commandMessage("unit.not-allowed"))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(handler).not.toHaveBeenCalled()
    expect(target.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          cmd: "unit.not-allowed",
          success: false,
          error: "UNSUPPORTED_COMMAND: command is not allowed"
        }
      }),
      "http://192.168.10.15:6060"
    )
    dispose()
  })
})
