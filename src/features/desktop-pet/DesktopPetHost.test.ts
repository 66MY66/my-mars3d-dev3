import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import DesktopPetHost from "./DesktopPetHost.vue"
import { commandBus } from "@/core/commandBus"
import { protocolVersion } from "@/cui-bridge/protocol"

describe("DesktopPetHost", () => {
  function pointerEvent(type: string, init: MouseEventInit, pointerId = 7) {
    const event = new MouseEvent(type, init)
    Object.defineProperty(event, "pointerId", { configurable: true, value: pointerId })
    return event
  }

  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 })
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 })
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    })
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn()
    })
  })

  afterEach(() => {
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  it("opens Hermes in an iframe dialog when the animated pet is clicked and destroys it on close", async () => {
    const wrapper = mount(DesktopPetHost, { attachTo: document.body })
    const host = wrapper.get("[data-desktop-pet-host]")

    expect(host.attributes("style")).toContain("translate3d(986px, 526px, 0)")
    const pet = wrapper.get('[role="img"]')
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()

    await pet.trigger("click")
    await nextTick()

    const dialog = document.body.querySelector('[role="dialog"]')
    const iframe = dialog?.querySelector("iframe")
    expect(dialog).not.toBeNull()
    expect(iframe?.getAttribute("src")).toBe("http://192.168.10.15:6060/")
    expect(iframe?.getAttribute("title")).toBe("Hermes Web UI")

    const closeButton = dialog?.querySelector<HTMLButtonElement>('[aria-label="关闭 Hermes"]')
    closeButton?.click()
    await nextTick()

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.querySelector('iframe[title="Hermes Web UI"]')).toBeNull()
  })

  it("moves within the browser viewport and saves the final position", async () => {
    const wrapper = mount(DesktopPetHost, { attachTo: document.body })
    const host = wrapper.get("[data-desktop-pet-host]")

    host.element.dispatchEvent(pointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 1000, clientY: 600 }))
    window.dispatchEvent(pointerEvent("pointermove", { clientX: 1400, clientY: 900 }))
    window.dispatchEvent(pointerEvent("pointerup", {}))
    await nextTick()

    expect(host.attributes("style")).toContain("translate3d(998px, 538px, 0)")
    expect(JSON.parse(localStorage.getItem("syc.desktop-pet.position") || "null")).toEqual({ x: 998, y: 538 })

    await wrapper.get('[role="img"]').trigger("click")
    await nextTick()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it("accepts commands only from the configured Hermes iframe origin", async () => {
    const handler = vi.fn(() => ({ success: true as const, data: { opened: true } }))
    commandBus.register("ui.panel.open", handler)
    const wrapper = mount(DesktopPetHost, { attachTo: document.body })

    await wrapper.get('[role="img"]').trigger("click")
    await nextTick()
    await nextTick()

    const iframe = document.body.querySelector<HTMLIFrameElement>('iframe[title="Hermes Web UI"]')
    const target = iframe?.contentWindow
    expect(target).toBeTruthy()
    const postSpy = vi.spyOn(target!, "postMessage")
    const message = {
      version: protocolVersion,
      type: "cmd.execute",
      requestId: "hermes-1",
      payload: { cmd: "ui.panel.open", args: { panel: "layer" } }
    }

    const attackerEvent = new MessageEvent("message", { data: message, origin: "http://attacker.example" })
    Object.defineProperty(attackerEvent, "source", { value: target })
    window.dispatchEvent(attackerEvent)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(handler).not.toHaveBeenCalled()

    const hermesEvent = new MessageEvent("message", { data: message, origin: "http://192.168.10.15:6060" })
    Object.defineProperty(hermesEvent, "source", { value: target })
    window.dispatchEvent(hermesEvent)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(handler).toHaveBeenCalledOnce()
    expect(postSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "cmd.result", requestId: "hermes-1" }), "http://192.168.10.15:6060")
  })
})
