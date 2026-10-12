import { commandBus } from "@/core/commandBus"
import { setTheme } from "@/shell/theme"
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from "@/shell/sidebar"
import { useWidget } from "@mars/common/store/widget"

export function registerShellCommands() {
  const widgetApi = useWidget()

  commandBus.register("theme.switch", (args) => {
    const mode = args?.mode
    if (mode !== "light" && mode !== "dark") {
      return { success: false, error: "mode 只能是 light 或 dark" }
    }
    setTheme(mode)
    return { success: true, data: { mode } }
  })

  commandBus.register("sidebar.toggle", () => {
    const next = !getStoredSidebarCollapsed()
    setStoredSidebarCollapsed(next)
    window.dispatchEvent(new CustomEvent("sidebarToggle", { detail: { collapsed: next } }))
    return { success: true, data: { collapsed: next } }
  })

  commandBus.register("widget.refresh", (args) => {
    const id = args?.id
    if (!id || typeof id !== "string") {
      return { success: false, error: "缺少参数 id" }
    }
    const widget = widgetApi.getWidget(id)
    if (!widget) {
      return { success: false, error: `widget 不存在: ${id}` }
    }
    widgetApi.activate({ name: id }, true)
    return { success: true }
  })
}
