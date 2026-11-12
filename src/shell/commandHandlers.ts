import { commandBus } from "@/core/commandBus"
import { router } from "@/shell/router"
import { setTheme } from "@/shell/theme"
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from "@/shell/sidebar"
import { useWidget } from "@mars/common/store/widget"

type NavigationTarget = string | { name: string }

type ShellCommandDependencies = {
  navigate: (target: NavigationTarget) => Promise<unknown> | unknown
  widgetApi: {
    activate: (option: any, reload?: boolean) => void
    disable: (option: string | string[]) => void
    getWidget: (name: string) => any
  }
}

const routeTargets: Record<string, NavigationTarget> = {
  map: "/",
  "satellite.dataPool": { name: "satellite-data-pool" },
  "satellite.metadata": { name: "satellite-metadata" },
  "satellite.catalog": { name: "satellite-catalog" },
  "satellite.query": { name: "satellite-query" },
  "satellite.share": { name: "satellite-share" }
}

const panelTargets: Record<string, string> = {
  layer: "manage-layers",
  basemap: "manage-basemap"
}

export function registerShellCommands(dependencies?: ShellCommandDependencies) {
  const widgetApi = dependencies?.widgetApi ?? useWidget()
  const navigate = dependencies?.navigate ?? ((target: NavigationTarget) => router.push(target))

  commandBus.register("route.navigate", async (args) => {
    const route = args?.route
    const target = typeof route === "string" ? routeTargets[route] : undefined
    if (!target) {
      return { success: false, error: "INVALID_ARGUMENT: unsupported route" }
    }
    await navigate(target)
    return { success: true, data: { route } }
  })

  commandBus.register("ui.panel.open", (args) => {
    const panel = args?.panel
    const widgetName = typeof panel === "string" ? panelTargets[panel] : undefined
    if (!widgetName) {
      return { success: false, error: "INVALID_ARGUMENT: unsupported panel" }
    }
    if (!widgetApi.getWidget(widgetName)) {
      return { success: false, error: "TARGET_NOT_FOUND: panel is unavailable" }
    }
    widgetApi.activate({ name: widgetName }, false)
    return { success: true, data: { panel, state: "open" } }
  })

  commandBus.register("ui.panel.close", (args) => {
    const panel = args?.panel
    const widgetName = typeof panel === "string" ? panelTargets[panel] : undefined
    if (!widgetName) {
      return { success: false, error: "INVALID_ARGUMENT: unsupported panel" }
    }
    if (!widgetApi.getWidget(widgetName)) {
      return { success: false, error: "TARGET_NOT_FOUND: panel is unavailable" }
    }
    widgetApi.disable(widgetName)
    return { success: true, data: { panel, state: "closed" } }
  })

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
