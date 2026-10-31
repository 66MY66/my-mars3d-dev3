import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import GdpDensityLegend from "./GdpDensityLegend.vue"

describe("GdpDensityLegend", () => {
  it("renders the eleven GDP value classes from the supplied map", () => {
    const wrapper = mount(GdpDensityLegend)

    expect(wrapper.get("[data-testid='gdp-density-legend']").attributes("aria-label")).toBe("GDP分布密度图例，单位万元每平方公里")
    expect(wrapper.findAll(".gdp-density-legend__item")).toHaveLength(11)
    expect(wrapper.text()).toContain("1 – 100")
    expect(wrapper.text()).toContain("50 001 – 100 000")
    expect(wrapper.text()).toContain("≥ 100 001")
    expect(wrapper.text()).toContain("万元/平方公里")
  })
})
