import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import SpatialAnalysisResult from "./SpatialAnalysisResult.vue"
import { calculateSpatialAnalysis, getAlertAnalysisDataset } from "./analysis-model"

const dialogStub = { props: ["visible"], emits: ["closed"], template: "<div class='dialog-stub'><button data-testid='dialog-title-close' @click='$emit(\"closed\")'>×</button><slot/><slot name='footer'/></div>" }

describe("SpatialAnalysisResult", () => {
  it("展示异常点空间分布和点位明细且不展示虚构边界结论", () => {
    const wrapper = mount(SpatialAnalysisResult, {
      props: { result: calculateSpatialAnalysis(getAlertAnalysisDataset("ALT-20261101-001")) },
      global: { stubs: { "mars-dialog": dialogStub } }
    })

    expect(wrapper.text()).toContain("异常点空间分布")
    expect(wrapper.find("svg.spatial-canvas").exists()).toBe(true)
    expect(wrapper.findAll(".point-marker")).toHaveLength(12)
    expect(wrapper.findAll("tbody tr")).toHaveLength(12)
    expect(wrapper.text()).toContain("待确认")
    expect(wrapper.text()).toContain("已确认")
    expect(wrapper.text()).not.toContain("边界周长")
    expect(wrapper.text()).not.toContain("扩展方向")
    expect(wrapper.text()).not.toContain("周边目标")
  })

  it("关闭按钮发出close事件", async () => {
    const wrapper = mount(SpatialAnalysisResult, { props: { result: calculateSpatialAnalysis(getAlertAnalysisDataset("ALT-20261101-001")) }, global: { stubs: { "mars-dialog": dialogStub } } })
    await wrapper.get("[data-testid='close-spatial-result']").trigger("click")
    expect(wrapper.emitted("close")).toHaveLength(1)
  })
})
