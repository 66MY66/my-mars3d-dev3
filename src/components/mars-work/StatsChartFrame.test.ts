// @vitest-environment jsdom

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import StatsChartFrame from "./StatsChartFrame.vue"

describe("StatsChartFrame", () => {
  it("keeps the chart element mounted while the real grid data is loading", async () => {
    const wrapper = mount(StatsChartFrame, {
      props: {
        loading: false,
        empty: false,
        error: null
      }
    })

    const chart = wrapper.get('[data-testid="stats-chart"]')
    expect(wrapper.find('[data-testid="stats-loading"]').exists()).toBe(false)

    await wrapper.setProps({ loading: true })

    expect(wrapper.get('[data-testid="stats-chart"]').element).toBe(chart.element)
    expect(wrapper.get('[data-testid="stats-loading"]').text()).toBe("加载中...")
  })

  it("shows errors and empty results without unmounting the chart element", async () => {
    const wrapper = mount(StatsChartFrame, {
      props: {
        loading: false,
        empty: false,
        error: null
      }
    })
    const chart = wrapper.get('[data-testid="stats-chart"]')

    await wrapper.setProps({ error: "真实格网数据加载失败" })
    expect(wrapper.get('[data-testid="stats-error"]').text()).toBe("真实格网数据加载失败")
    expect(wrapper.get('[data-testid="stats-chart"]').element).toBe(chart.element)

    await wrapper.setProps({ error: null, empty: true })
    expect(wrapper.get('[data-testid="stats-empty"]').text()).toBe("暂无数据")
    expect(wrapper.get('[data-testid="stats-chart"]').element).toBe(chart.element)
  })
})
