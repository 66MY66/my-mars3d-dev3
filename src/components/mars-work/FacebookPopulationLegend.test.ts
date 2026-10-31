import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import FacebookPopulationLegend from "./FacebookPopulationLegend.vue"

describe("FacebookPopulationLegend", () => {
  it("renders the eleven population value classes from the supplied map", () => {
    const wrapper = mount(FacebookPopulationLegend)

    expect(wrapper.get("[data-testid='facebook-population-legend']").attributes("aria-label")).toBe("Facebook人口密度图例，单位人每平方公里")
    expect(wrapper.findAll(".facebook-population-legend__item")).toHaveLength(11)
    expect(wrapper.text()).toContain("1 – 20")
    expect(wrapper.text()).toContain("5 001 – 10 000")
    expect(wrapper.text()).toContain("≥ 10 001")
    expect(wrapper.text()).toContain("人/平方公里")
  })

  it("stays anchored to the top-right corner", () => {
    const wrapper = mount(FacebookPopulationLegend)
    const legend = wrapper.get("[data-testid='facebook-population-legend']")

    expect(legend.classes()).toContain("facebook-population-legend")
  })
})
