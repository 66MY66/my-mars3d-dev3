import { describe, expect, it } from "vitest"
import { buildProfiledLayerPropertySections } from "./layer-property-details"

describe("building damage heatmap property details", () => {
  it("builds four data-backed property groups", () => {
    const sections = buildProfiledLayerPropertySections({
      id: 802001,
      name: "房屋损毁热力图（fake_damage10，测试数据）",
      type: "xyz",
      detailProfile: "building-damage-heatmap",
      source: "eoAPI STAC / 房屋损毁评估",
      collection: "building-damage-assessment",
      itemId: "HD-fake_damage10-01a19a99",
      runTag: "fake_damage10",
      runId: "01a19a99-9ff8-8cd6-85a7-6f3a69325110",
      assessmentTime: "2026-11-02T05:00:48.176340Z",
      updatedAt: "2026-11-02T10:24:11Z"
    })

    expect(sections.map((section) => section.title)).toEqual(["基本信息", "数据信息", "数值信息", "数据说明"])
    const details = sections.flatMap((section) => section.fields.map((field) => `${field.label}:${field.value}`)).join("\n")
    expect(details).toContain("HD-fake_damage10-01a19a99")
    expect(details).toContain("300 × 300")
    expect(details).toContain("0～2.983392")
    expect(details).toContain("84 栋")
    expect(details).toContain("GLM-5.3-Flash")
    expect(details).toContain("测试数据")
  })
})

describe("China socioeconomic grid property details", () => {
  it.each([
    {
      name: "全国人口格网（2020）",
      itemId: "SP-china-pop2020",
      metricName: "人口密度",
      unit: "人/平方公里",
      bandDescription: "people_per_km2",
      valueRange: "0～30571",
      total: "约 13.88 亿人"
    },
    {
      name: "全国GDP格网（2020）",
      itemId: "SP-china-gdp2020",
      metricName: "GDP密度",
      unit: "万元/平方公里",
      bandDescription: "gdp_10k_cny_per_km2",
      valueRange: "0～979493",
      total: "约 1008553 亿元"
    }
  ])("builds four data-backed sections for $name", (fixture) => {
    const sections = buildProfiledLayerPropertySections({
      id: fixture.itemId === "SP-china-pop2020" ? 412002 : 412001,
      name: fixture.name,
      type: "xyz",
      detailProfile: "china-socioeconomic-grid",
      source: "eoAPI STAC",
      collection: "spatial-thematic",
      itemId: fixture.itemId,
      metricName: fixture.metricName,
      unit: fixture.unit,
      bandDescription: fixture.bandDescription,
      valueRange: fixture.valueRange,
      total: fixture.total,
      updatedAt: "2026-10-30"
    })

    expect(sections.map((section) => section.title)).toEqual(["基本信息", "数据信息", "数值信息", "数据说明"])
    const details = sections.flatMap((section) => section.fields.map((field) => `${field.label}:${field.value}`)).join("\n")
    expect(details).toContain(fixture.itemId)
    expect(details).toContain(fixture.unit)
    expect(details).toContain(fixture.bandDescription)
    expect(details).toContain(fixture.valueRange)
    expect(details).toContain(fixture.total)
    expect(details).toContain("14080 × 8192")
    expect(details).toContain("0.005°")
  })
})
