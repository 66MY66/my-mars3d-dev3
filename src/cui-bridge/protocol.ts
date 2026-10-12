export const protocolVersion = "1.0.0" as const

export type AppContextMessage = {
  version: typeof protocolVersion
  type: "app.context"
  data: {
    pageId: string
    userId: string
    theme: "light" | "dark"
  }
}

export type CmdExecuteMessage = {
  version: typeof protocolVersion
  type: "cmd.execute"
  requestId?: string
  payload: {
    cmd: string
    args?: any
  }
}

export type CmdResultMessage = {
  version: typeof protocolVersion
  type: "cmd.result"
  requestId?: string
  payload: {
    cmd: string
    success: boolean
    data?: any
    error?: string
  }
}

export type AnyBridgeMessage = AppContextMessage | CmdExecuteMessage | CmdResultMessage

