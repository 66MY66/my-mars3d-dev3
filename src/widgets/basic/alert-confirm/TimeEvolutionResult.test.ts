import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import TimeEvolutionResult from "./TimeEvolutionResult.vue"
import { calculateTemporalAnalysis, getAlertAnalysisDataset } from "./analysis-model"

const dialogStub = { props: ["visible"], emits: ["closed"], template: "<div class='dialog-stub'><button data-testid='dialog-title-close' @click='$emit(\"closed\")'>×</button><slot/><slot name='footer'/></div>" }

describe("TimeEvolutionResult", () => {
  it("展示观测预报温差日序列且不展示虚构指标", () => {
    const wrapper = mount(TimeEvolutionResult, {
      props: { result: calculateTemporalAnalysis(getAlertAnalysisDataset("ALT-20261101-001")) },
      global: { stubs: { "mars-dialog": dialogStub } }
    })

    expect(wrapper.text()).toContain("观测—预报—温差日序列")
    expect(wrapper.text()).toContain("观测温度")
    expect(wrapper.text()).toContain("预报温度")
    expect(wrapper.text()).toContain("温差")
    expect(wrapper.find("svg.temporal-chart").exists()).toBe(true)
    expect(wrapper.findAll("tbody tr")).toHaveLength(6)
    expect(wrapper.text()).not.toContain("异常面积")
    expect(wrapper.text()).not.toContain("扩张速度")
    expect(wrapper.text()).not.toContain("置信度")
  })

  it("关闭按钮发出close事件", async () => {
    const wrapper = mount(TimeEvolutionResult, { props: { result: calculateTemporalAnalysis(getAlertAnalysisDataset("ALT-20261101-001")) }, global: { stubs: { "mars-dialog": dialogStub } } })
    await wrapper.get("[data-testid='close-temporal-result']").trigger("click")
    expect(wrapper.emitted("close")).toHaveLength(1)
  })
})
