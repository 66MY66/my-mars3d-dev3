import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("@mars/utils/mars-util", () => {
  return {
    logWarn: vi.fn()
  }
})

const MarsDialog = (await import("./index.vue")).default

function ensureWarpper() {
  const id = "mars-main-view"
  const existing = document.getElementById(id)
  if (existing) {
    return
  }
  const div = document.createElement("div")
  div.id = id
  document.body.appendChild(div)
}

describe("mars-dialog a11y", () => {
  it("focuses close button on open and keeps dialog mounted during leave animation", async () => {
    ensureWarpper()

    const trigger = document.createElement("button")
    trigger.textContent = "trigger"
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const wrapper = mount(MarsDialog, {
      attachTo: document.body,
      props: {
        visible: true,
        title: "测试面板",
        closeable: true,
        closeButton: true,
        draggable: false
      },
      global: {
        stubs: {
          teleport: true,
          "mars-icon": { template: "<span></span>" }
        }
      },
      slots: {
        default: '<button type="button" class="inner-btn">inner</button>'
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    const closeBtn = wrapper.element.querySelector(".close-btn") as HTMLButtonElement | null
    expect(closeBtn).toBeTruthy()
    expect(document.activeElement).toBe(closeBtn)

    await wrapper.setProps({ visible: false })
    const root = wrapper.element.querySelector(".mars-dialog") as HTMLElement | null
    expect(root).toBeTruthy()
    expect(root?.style.display).not.toBe("none")
    await new Promise((resolve) => setTimeout(resolve, 300))
    const hiddenRoot = wrapper.element.querySelector(".mars-dialog") as HTMLElement | null
    expect(hiddenRoot?.style.display).toBe("none")

    wrapper.unmount()
    trigger.remove()
  })

  it("closes on Escape when closeable", async () => {
    ensureWarpper()

    const wrapper = mount(MarsDialog, {
      attachTo: document.body,
      props: {
        visible: true,
        title: "测试面板",
        closeable: true,
        closeButton: true,
        draggable: false
      },
      global: {
        stubs: {
          teleport: true,
          "mars-icon": { template: "<span></span>" }
        }
      }
    })

    const root = wrapper.element.querySelector(".mars-dialog") as HTMLElement | null
    expect(root).toBeTruthy()

    root?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const emitted = wrapper.emitted("update:visible")
    expect(emitted?.length || 0).toBeGreaterThan(0)
    expect(emitted?.[0]?.[0]).toBe(false)
  })

  it("resets layout when persistLayout is false on reopen", async () => {
    ensureWarpper()

    const wrapper = mount(MarsDialog, {
      attachTo: document.body,
      props: {
        visible: true,
        title: "无持久化面板",
        closeable: true,
        closeButton: true,
        draggable: true,
        persistLayout: false,
        position: { top: 0, left: 0, bottom: 0 },
        width: 340
      },
      global: {
        stubs: {
          teleport: true,
          "mars-icon": { template: "<span></span>" }
        }
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    const root = wrapper.element.querySelector(".mars-dialog") as HTMLElement | null
    expect(root).toBeTruthy()

    await wrapper.setProps({ visible: false })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await wrapper.setProps({ visible: true })
    await new Promise((resolve) => setTimeout(resolve, 0))

    wrapper.unmount()
  })
})
