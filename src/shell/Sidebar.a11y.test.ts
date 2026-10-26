import { mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import Sidebar from "@/shell/Sidebar.vue"

vi.mock("@/shell/permission", () => {
  return {
    hasPermission: () => true
  }
})

vi.mock("@mars/common/store/widget", () => {
  return {
    useWidget: () => ({
      activate: vi.fn(),
      disable: vi.fn(),
      isActivate: () => false
    })
  }
})

describe("Sidebar a11y", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("renders dashed placeholder when no current dataset", () => {
    const wrapper = mount(Sidebar, {
      props: { collapsed: false },
      global: {
        stubs: {
          "a-tooltip": { template: "<span><slot /></span>" }
        }
      }
    })

    expect(wrapper.findAll(".menu-placeholder").length).toBe(1)
    const current = wrapper.findAll("button.menu-item").find((b) => (b.attributes("aria-label") || "").includes("当前任务"))
    expect(current).toBeUndefined()
  })

  it("does not reserve current-task placeholder icon when sidebar is collapsed", () => {
    const wrapper = mount(Sidebar, {
      props: { collapsed: true },
      global: {
        stubs: {
          "a-tooltip": { template: "<span><slot /></span>" }
        }
      }
    })

    expect(wrapper.findAll(".menu-placeholder").length).toBe(0)
    expect(wrapper.findAll(".menu-icon.is-placeholder").length).toBe(0)
    const current = wrapper.findAll("button.menu-item").find((b) => (b.attributes("aria-label") || "").includes("当前任务"))
    expect(current).toBeUndefined()
  })

  it("renders current dataset button when dataset exists", async () => {
    localStorage.setItem(
      "ksh002_current_dataset_v1",
      JSON.stringify({ datasetId: "demo", name: "示范数据集", source: "repository", updatedAt: Date.now() })
    )

    const wrapper = mount(Sidebar, {
      props: { collapsed: false },
      global: {
        stubs: {
          "a-tooltip": { template: "<span><slot /></span>" }
        }
      }
    })

    expect(wrapper.findAll(".menu-placeholder").length).toBe(0)
    const btn = wrapper.findAll("button.menu-item").find((b) => b.attributes("aria-label") === "当前任务")
    expect(btn).toBeTruthy()
  })

  it("supports keyboard navigation with roving tabindex", async () => {
    const wrapper = mount(Sidebar, {
      props: { collapsed: false },
      attachTo: document.body,
      global: {
        stubs: {
          "a-tooltip": { template: "<span><slot /></span>" }
        }
      }
    })

    const buttons = wrapper.findAll("button.menu-item")
    expect(buttons.length).toBeGreaterThan(3)

    await buttons[0].trigger("focus")
    await buttons[0].trigger("keydown", { key: "ArrowDown" })
    expect(document.activeElement).toBe(buttons[1].element)

    await buttons[1].trigger("keydown", { key: "End" })
    expect(document.activeElement).toBe(buttons[buttons.length - 1].element)

    await buttons[buttons.length - 1].trigger("keydown", { key: "Home" })
    expect(document.activeElement).toBe(buttons[0].element)
  })

  it("does not keep a widget highlighted when the widget store reports it closed", async () => {
    const wrapper = mount(Sidebar, {
      props: { collapsed: false },
      global: {
        stubs: {
          "a-tooltip": { template: "<span><slot /></span>" }
        }
      }
    })

    const button = wrapper.find("button.menu-item")
    await button.trigger("click")

    expect(button.classes()).not.toContain("active")
  })
})
