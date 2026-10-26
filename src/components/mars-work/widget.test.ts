import { defineAsyncComponent, h, markRaw } from "vue"
import { flushPromises, mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import MarsWidget from "./widget.vue"

describe("MarsWidget async loading", () => {
  it("shows immediate feedback while an async widget is loading", async () => {
    const component = defineAsyncComponent(() => new Promise(() => {}))
    const wrapper = mount(MarsWidget, {
      props: {
        widget: { name: "slow-widget", component: markRaw(component) },
        visible: true
      }
    })

    expect(wrapper.get('[role="status"]').text()).toContain("正在加载")
  })

  it("closes the widget when its async component cannot be loaded", async () => {
    const loadError = new Error("dynamic import failed")
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const component = defineAsyncComponent(() => Promise.reject(loadError))
    const errorHandler = vi.fn()
    const wrapper = mount(MarsWidget, {
      props: {
        widget: { name: "broken-widget", component: markRaw(component) },
        visible: true
      },
      global: {
        config: { errorHandler }
      }
    })

    await flushPromises()

    expect(wrapper.emitted("update:visible")).toEqual([[false]])
    expect(wrapper.emitted("load-error")?.[0]?.[0]).toBe(loadError)
    expect(errorHandler).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith("[widget] broken-widget 加载失败", loadError)
    consoleError.mockRestore()
  })

  it("renders the loaded widget instead of the loading feedback", async () => {
    const component = defineAsyncComponent(() => Promise.resolve({ render: () => h("div", "loaded") }))
    const wrapper = mount(MarsWidget, {
      props: {
        widget: { name: "ready-widget", component: markRaw(component) },
        visible: true
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain("loaded")
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it("starts a fresh load attempt when a failed widget is opened again", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    let attempts = 0
    const component = defineAsyncComponent(() => {
      attempts += 1
      return Promise.reject(new Error("dynamic import failed"))
    })
    const wrapper = mount(MarsWidget, {
      props: {
        widget: { name: "retry-widget", component: markRaw(component) },
        visible: true
      },
      global: {
        config: { errorHandler: vi.fn() }
      }
    })

    await flushPromises()
    expect(attempts).toBe(1)

    wrapper.unmount()
    mount(MarsWidget, {
      props: {
        widget: { name: "retry-widget", component: markRaw(component) },
        visible: true
      },
      global: {
        config: { errorHandler: vi.fn() }
      }
    })
    await flushPromises()

    expect(attempts).toBe(2)
    consoleError.mockRestore()
  })
})
