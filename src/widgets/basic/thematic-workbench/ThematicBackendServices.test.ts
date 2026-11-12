import { describe, expect, it, vi } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import ThematicBackendServices from "./ThematicBackendServices.vue"
const mocks = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock("./thematic-backend", async importOriginal => ({
  ...await importOriginal<typeof import("./thematic-backend")>(),
  loginThematicFlow: vi.fn(async () => "unit-session"),
  inspectThematicFlows: vi.fn(async () => [{
    id: "search_flow",
    definition: { path: "u/fyt/earth/search_flow", summary: "检索", schema: { properties: { limit: { type: "integer" }, export: { type: "string", enum: ["", "csv"] } } } }
  }]),
  runThematicFlow: mocks.run
}))
describe("uncertain backend submissions", () => {
  it("does not retry after an unknown receipt or clear the guard by switching forms", async () => {
    mocks.run.mockRejectedValueOnce(new Error("连接中断，回执未知"))
    const wrapper = mount(ThematicBackendServices, { props: { active: true, bounds: null, items: [] }, global: { stubs: { "mars-icon": true } } })
    const button = (text: string) => wrapper.findAll("button").find(entry => entry.text() === text)!
    await wrapper.get('input[aria-label="Windmill账号"]').setValue("unit@example.invalid")
    await wrapper.get('input[aria-label="Windmill密码"]').setValue("unit-password")
    await button("登录 Windmill").trigger("click"); await flushPromises()
    expect(wrapper.get('select[aria-label="Windmill流程"]').findAll("option").some(option => option.attributes("value") === "result_flow")).toBe(false)
    await button("提交后台任务").trigger("click"); await flushPromises()
    expect(mocks.run).toHaveBeenCalledTimes(1)
    expect(button("提交后台任务").attributes("disabled")).toBeDefined()
    await wrapper.get('select[aria-label="Windmill流程"]').setValue("stac_flow")
    await wrapper.get('select[aria-label="Windmill流程"]').setValue("search_flow")
    expect(button("提交后台任务").attributes("disabled")).toBeDefined()
    expect(wrapper.text()).toContain("已在后台核对")
    await wrapper.get('input[aria-label="确认后台未生成重复任务"]').setValue(true)
    expect(button("提交后台任务").attributes("disabled")).toBeUndefined()
    expect(mocks.run).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
