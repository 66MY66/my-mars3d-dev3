import { flushPromises, mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import { createAsyncWidgetComponent } from "./async-widget"

describe("createAsyncWidgetComponent", () => {
  it("retries one transient module load failure", async () => {
    let attempts = 0
    const component = createAsyncWidgetComponent(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new Error("temporary fetch failure")
      }
      return { template: "<div>loaded</div>" }
    })

    const errorHandler = vi.fn()
    mount(component, { global: { config: { errorHandler } } })
    await vi.waitFor(() => expect(attempts).toBe(2))
    await flushPromises()

    expect(attempts).toBe(2)
    expect(errorHandler).not.toHaveBeenCalled()
  })

  it("stops after the retry also fails", async () => {
    let attempts = 0
    const component = createAsyncWidgetComponent(async () => {
      attempts += 1
      throw new Error("permanent fetch failure")
    })
    const errorHandler = vi.fn()

    mount(component, { global: { config: { errorHandler } } })
    await flushPromises()
    await vi.waitFor(() => expect(errorHandler).toHaveBeenCalled())

    expect(attempts).toBe(2)
  })
})
