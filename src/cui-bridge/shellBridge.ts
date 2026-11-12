import { commandBus } from "@/core/commandBus"
import { protocolVersion } from "@/cui-bridge/protocol"
import type { CmdExecuteMessage, CmdResultMessage } from "@/cui-bridge/protocol"

export function initShellBridge(
  getCuiWindow: () => Window | null,
  allowedOrigin = window.location.origin,
  allowedCommands?: ReadonlySet<string>
) {
  async function onMessage(evt: MessageEvent) {
    const targetWindow = getCuiWindow()
    if (!targetWindow || evt.source !== targetWindow || evt.origin !== allowedOrigin) {
      return
    }
    const msg = evt.data as Partial<CmdExecuteMessage>
    if (!msg || msg.version !== protocolVersion || msg.type !== "cmd.execute") {
      return
    }
    const cmd = msg.payload?.cmd
    if (!cmd || typeof cmd !== "string") {
      const res: CmdResultMessage = {
        version: protocolVersion,
        type: "cmd.result",
        requestId: msg.requestId,
        payload: { cmd: "", success: false, error: "缺少cmd" }
      }
      targetWindow.postMessage(res, allowedOrigin)
      return
    }
    if (allowedCommands && !allowedCommands.has(cmd)) {
      const res: CmdResultMessage = {
        version: protocolVersion,
        type: "cmd.result",
        requestId: msg.requestId,
        payload: { cmd, success: false, error: "UNSUPPORTED_COMMAND: command is not allowed" }
      }
      targetWindow.postMessage(res, allowedOrigin)
      return
    }

    const result = await commandBus.execute(cmd, msg.payload?.args)
    let payload: CmdResultMessage["payload"]
    if (result.success === false) {
      payload = { cmd, success: false, error: (result as any).error }
    } else {
      payload = { cmd, success: true, data: (result as any).data }
    }
    const res: CmdResultMessage = {
      version: protocolVersion,
      type: "cmd.result",
      requestId: msg.requestId,
      payload
    }
    targetWindow.postMessage(res, allowedOrigin)
  }

  window.addEventListener("message", onMessage)
  return () => {
    window.removeEventListener("message", onMessage)
  }
}
