import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import CompositionNumberInput from "./CompositionNumberInput.vue"

describe("composition numeric input", () => {
  it("preserves an in-progress edit during reactive updates", async () => {
    const wrapper = mount(CompositionNumberInput, { props: { value: 1200, label: "水平位置" } })
    const input = wrapper.get("input")
    await input.trigger("focus")
    input.element.value = "400"
    await input.trigger("input")
    await wrapper.setProps({ value: 1199 })
    expect(input.element.value).toBe("400")
    await input.trigger("change")
    expect(wrapper.emitted("change")?.[0]).toEqual([400])
    await wrapper.setProps({ value: 400 })
    await input.trigger("blur")
    expect(input.element.value).toBe("400")
    wrapper.unmount()
  })
  it("does not commit an empty value and reflects normalized geometry after blur", async () => {
    const wrapper = mount(CompositionNumberInput, { props: { value: 40, label: "水平位置" } })
    const input = wrapper.get("input")
    await input.trigger("focus")
    input.element.value = ""
    await input.trigger("input")
    await input.trigger("blur")
    expect(wrapper.emitted("change")).toBeUndefined()
    expect(input.element.value).toBe("40")
    await wrapper.setProps({ value: 200 })
    expect(input.element.value).toBe("200")
    wrapper.unmount()
  })
})
