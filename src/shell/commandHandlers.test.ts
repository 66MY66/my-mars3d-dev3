import { beforeEach, describe, expect, it, vi } from "vitest"
import { commandBus } from "@/core/commandBus"
import { registerShellCommands } from "@/shell/commandHandlers"

vi.mock("@mars/common/store/widget", () => ({
  useWidget: () => ({
    activate: vi.fn(),
    disable: vi.fn(),
    getWidget: vi.fn()
  })
}))

describe("shell business commands", () => {
  const navigate = vi.fn()
  const activate = vi.fn()
  const disable = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    navigate.mockResolvedValue(undefined)
    registerShellCommands({
      navigate,
      widgetApi: {
        activate,
        disable,
        getWidget: (name: string) =>
          ["manage-layers", "manage-basemap"].includes(name) ? { name } : null
      }
    })
  })

  it("navigates to the map through the stable map route id", async () => {
    const result = await commandBus.execute("route.navigate", { route: "map" })

    expect(result).toEqual({ success: true, data: { route: "map" } })
    expect(navigate).toHaveBeenCalledWith("/")
  })

  it("navigates to a whitelisted satellite page", async () => {
    const result = await commandBus.execute("route.navigate", { route: "satellite.metadata" })

    expect(result).toEqual({ success: true, data: { route: "satellite.metadata" } })
    expect(navigate).toHaveBeenCalledWith({ name: "satellite-metadata" })
  })

  it("rejects a route outside the business whitelist", async () => {
    const result = await commandBus.execute("route.navigate", { route: "https://example.com" })

    expect(result).toEqual({ success: false, error: "INVALID_ARGUMENT: unsupported route" })
    expect(navigate).not.toHaveBeenCalled()
  })

  it("opens the layer panel through its stable panel id", async () => {
    const result = await commandBus.execute("ui.panel.open", { panel: "layer" })

    expect(result).toEqual({ success: true, data: { panel: "layer", state: "open" } })
    expect(activate).toHaveBeenCalledWith({ name: "manage-layers" }, false)
  })

  it("opens the basemap panel through its stable panel id", async () => {
    const result = await commandBus.execute("ui.panel.open", { panel: "basemap" })

    expect(result).toEqual({ success: true, data: { panel: "basemap", state: "open" } })
    expect(activate).toHaveBeenCalledWith({ name: "manage-basemap" }, false)
  })

  it("closes a whitelisted panel", async () => {
    const result = await commandBus.execute("ui.panel.close", { panel: "layer" })

    expect(result).toEqual({ success: true, data: { panel: "layer", state: "closed" } })
    expect(disable).toHaveBeenCalledWith("manage-layers")
  })

  it("rejects a panel outside the business whitelist", async () => {
    const result = await commandBus.execute("ui.panel.open", { panel: "developer-console" })

    expect(result).toEqual({ success: false, error: "INVALID_ARGUMENT: unsupported panel" })
    expect(activate).not.toHaveBeenCalled()
  })
})
