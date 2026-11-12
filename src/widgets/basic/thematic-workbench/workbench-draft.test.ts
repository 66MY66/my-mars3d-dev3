import { describe, expect, it } from "vitest"
import { restoreWorkbenchCopy, type WorkbenchDraft } from "./workbench-draft"

const draft = (templateId = "standard_raster_ramp"): WorkbenchDraft => ({ templateId, templateName: "栅格色带", title: "当前标题", subtitle: "", legendTitle: "图例", palette: "blue-red", notes: "", agency: "", publishName: "", publishDesc: "" })

describe("explicit workbench copy restoration", () => {
  it("never chooses a saved topic for a task without a selected template", () => {
    const current = draft("")
    expect(() => restoreWorkbenchCopy(current, draft("standard_point_heat"))).toThrow("请先选择专题模板")
    expect(current.templateId).toBe("")
  })
  it("cannot switch a selected product to the previously saved heat method", () => {
    const current = draft()
    const before = { ...current }
    expect(() => restoreWorkbenchCopy(current, draft("standard_point_heat"))).toThrow("当前专题未更改")
    expect(current).toEqual(before)
  })
  it("restores matching copy without replacing the current catalog identity or mutating its inputs", () => {
    const current = draft()
    const saved = { ...draft(), templateName: "旧模板名", title: "已保存标题", agency: "实际单位" }
    const restored = restoreWorkbenchCopy(current, saved)
    expect(restored).toEqual({ ...current, title: "已保存标题", agency: "实际单位" })
    expect(current.title).toBe("当前标题")
    expect(saved.templateName).toBe("旧模板名")
  })
  it("supports partial older copy without accepting invalid field types", () => {
    const current = draft()
    expect(restoreWorkbenchCopy(current, { templateId: current.templateId, notes: "旧文案" })).toEqual({ ...current, notes: "旧文案" })
    expect(() => restoreWorkbenchCopy(current, { templateId: current.templateId, title: {} })).toThrow("格式无效")
    expect(() => restoreWorkbenchCopy(current, null)).toThrow("没有可恢复")
  })
})
