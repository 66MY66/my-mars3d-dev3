import { commandBus } from "@/core/commandBus"
import { router } from "@/shell/router"
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

/** cui-chat 技能 → 面板/路由 命令映射 */
const PANEL_WIDGETS: Record<string, string> = {
  layer: "manage-layers",
  basemap: "manage-basemap"
}

const ROUTE_ALIASES: Record<string, string> = {
  map: "/",
  "satellite.dataPool": "/satellite/data-pool",
  "satellite.metadata": "/satellite/metadata",
  "satellite.catalog": "/satellite/catalog",
  "satellite.query": "/satellite/query",
  "satellite.share": "/satellite/share"
}

export function registerMars3dCommands() {
  const widgetApi = useWidget()
  commandBus.register("mars3d_open_panel", (args) => {
    const widget = PANEL_WIDGETS[args?.panel]
    if (!widget) {
      return { success: false, error: `未知面板: ${args?.panel}（仅支持 layer / basemap）` }
    }
    widgetApi.activate(widget)
    return { success: true, data: { panel: args.panel, widget } }
  })

  commandBus.register("mars3d_close_panel", (args) => {
    const widget = PANEL_WIDGETS[args?.panel]
    if (!widget) {
      return { success: false, error: `未知面板: ${args?.panel}（仅支持 layer / basemap）` }
    }
    widgetApi.disable(widget)
    return { success: true, data: { panel: args.panel, widget } }
  })

  commandBus.register("mars3d_navigate", (args) => {
    const route = ROUTE_ALIASES[args?.route]
    if (!route) {
      return { success: false, error: `未知路由: ${args?.route}（支持 ${Object.keys(ROUTE_ALIASES).join(" / ")}）` }
    }
    router.push(route)
    return { success: true, data: { route, path: route } }
  })
}
