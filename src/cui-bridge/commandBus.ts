export type CommandResult =
  | { success: true; data?: any }
  | { success: false; error: string }

export type CommandHandler = (args: any) => CommandResult | Promise<CommandResult>

class CommandBus {
  private handlers = new Map<string, CommandHandler>()

  register(cmd: string, handler: CommandHandler) {
    this.handlers.set(cmd, handler)
  }

  async execute(cmd: string, args: any): Promise<CommandResult> {
    const handler = this.handlers.get(cmd)
    if (!handler) {
      return { success: false, error: `未知指令: ${cmd}` }
    }
    try {
      const res = await handler(args)
      return res
    } catch (e: any) {
      return { success: false, error: e?.message ? String(e.message) : "指令执行失败" }
    }
  }
}

export const commandBus = new CommandBus()

