import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("@mars/common/store/widget", () => {
  return {
    useWidget: () => ({
      activate: vi.fn(),
      disable: vi.fn(),
      getWidget: () => null
    })
  }
})

vi.mock("@/shell/Sidebar.vue", () => {
  return { default: { template: "<div></div>" } }
})

vi.mock("@/shell/UserMenu.vue", () => {
  return { default: { template: "<div></div>" } }
})

vi.mock("@/shell/components/TopHeaderMenus.vue", () => {
  return { default: { template: "<div></div>" } }
})

vi.mock("@/shell/components/TopSettingsMenu.vue", () => {
  return { default: { template: "<div></div>" } }
})

vi.mock("@/shell/components/TopStatusBar.vue", () => {
  return { default: { template: "<div></div>" } }
})

vi.mock("@/shell/components/TopNotificationsMenu.vue", () => {
  return { default: { template: "<div></div>" } }
})

vi.mock("@/stores", () => {
  return {
    useThemeStore: () => ({
      theme: "light",
      setTheme: vi.fn()
    })
  }
})

function setWindowWidth(w: number) {
  Object.defineProperty(window, "innerWidth", { value: w, configurable: true })
  window.dispatchEvent(new Event("resize"))
}

describe("ShellLayout responsive", () => {
  it("updates sidebar expanded width by breakpoints", async () => {
    const raf = window.requestAnimationFrame
    Object.defineProperty(window, "requestAnimationFrame", {
      value: (cb: FrameRequestCallback) => {
        cb(Date.now())
        return 1
      },
      configurable: true
    })

    setWindowWidth(1366)
    const ShellLayout = (await import("@/shell/ShellLayout.vue")).default
    const wrapper = mount(ShellLayout, {
      attachTo: document.body,
      global: { stubs: { TopModulesDropdown: { template: "<div></div>" } } }
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect((wrapper.element as HTMLElement).style.getPropertyValue("--sidebar-expanded-width")).toBe("144px")

    setWindowWidth(1920)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect((wrapper.element as HTMLElement).style.getPropertyValue("--sidebar-expanded-width")).toBe("176px")

    setWindowWidth(2560)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect((wrapper.element as HTMLElement).style.getPropertyValue("--sidebar-expanded-width")).toBe("208px")

    wrapper.unmount()
    Object.defineProperty(window, "requestAnimationFrame", { value: raf, configurable: true })
  })
})
