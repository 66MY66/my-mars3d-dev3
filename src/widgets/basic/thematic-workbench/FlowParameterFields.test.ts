import { describe, expect, it } from "vitest"
import { mount } from "@vue/test-utils"
import { defineComponent, ref } from "vue"
import FlowParameterFields from "./FlowParameterFields.vue"
describe("structured flow field controls", () => {
  it("retains false and zero, edits a bbox, and reports malformed object input instead of using stale values", async () => {
    const wrapper = mount(defineComponent({ components: { FlowParameterFields }, setup: () => ({ value: ref({ count: 0, enabled: false, bbox: [100, 20, 101, 21], payload: {} }), schema: { properties: { count: { type: "number" }, enabled: { type: "boolean" }, bbox: { type: "array" }, payload: { type: "object" } } } }), template: '<FlowParameterFields v-model="value" :schema="schema" />' }))
    expect(wrapper.find('input[type="number"]').element.getAttribute("value")).not.toBe("NaN")
    await wrapper.get('input[id="flow.enabled"]').setValue(true)
    await wrapper.get('[aria-label="flow.bbox.西"]').setValue("102")
    expect((wrapper.vm as any).value.enabled).toBe(true)
    expect((wrapper.vm as any).value.bbox[0]).toBe(102)
    await wrapper.get('textarea[id="flow.payload"]').setValue("{")
    expect(wrapper.get('[role="alert"]').text()).toContain("无效")
    expect((wrapper.vm as any).value.payload).toBe("{")
    await wrapper.get('textarea[id="flow.payload"]').setValue('{"title":"真实成果"}')
    expect((wrapper.vm as any).value.payload).toEqual({ title: "真实成果" })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
