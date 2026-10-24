import { describe, expect, it } from "vitest"
import { applyCompositionTemplate } from "./composition-template"
import { createCompositionItem, restoreComposition, PAGE } from "./composition-model"
import { templateLayoutProfiles } from "./composition-layout"
import { STANDARD_SLOTS } from "./cartography-standard-layout"

const raster = { image: "data:image/png;base64,AAAA", label: "当前框选地图", detail: "", legend: [] }
const text = { title: "测试制图", legendTitle: "图例", time: "2026-09-29T12:00:00Z", source: "当前框选地图截图" }
describe("data-free template layout", () => {
  it("adds all four-zone adornments without inventing analytical legend entries", () => {
    const initial = [createCompositionItem("map")]
    const result = applyCompositionTemplate(initial, raster, text)
    expect(result.map(item => item.kind)).toEqual(["map", "title", "legend", "scale", "north", "time", "source", "description", "agency"])
    expect(result[0].raster?.legend).toEqual([])
    expect(result[1].text).toBe(text.title)
    expect(initial).toHaveLength(1)
  })
  it("updates text without duplicating elements or moving existing materials", () => {
    const initial = applyCompositionTemplate([createCompositionItem("map"), createCompositionItem("symbol")], raster, text)
    initial.find(item => item.kind === "title")!.x = 85
    const result = applyCompositionTemplate(initial, raster, { ...text, title: "新标题" })
    expect(result).toHaveLength(initial.length)
    expect(result.map(item => item.id)).toEqual(initial.map(item => item.id))
    expect(result.find(item => item.kind === "title")).toMatchObject({ x: 85, text: "新标题" })
    expect(result.find(item => item.kind === "symbol")).toEqual(initial[1])
  })
  it("rejects invalid images and full layouts without partial updates", () => {
    const initial = [createCompositionItem("map"), ...Array.from({ length: 59 }, () => createCompositionItem("text"))]
    expect(applyCompositionTemplate(initial, raster, text)).toBe(initial)
    expect(applyCompositionTemplate(initial.slice(0, 1), { ...raster, image: "invalid" }, text)).toEqual(initial.slice(0, 1))
  })
  it("keeps the shared standard geometry when switching rendering templates", () => {
    const initial = [createCompositionItem("map"), createCompositionItem("symbol")]
    const atlas = applyCompositionTemplate(initial, raster, { ...text, kind: "choropleth" })
    const wide = applyCompositionTemplate(atlas, raster, { ...text, kind: "point-heat" })
    expect(atlas.find(item => item.kind === "map")).toMatchObject({ ...STANDARD_SLOTS.map, templateKind: "choropleth" })
    expect(wide.find(item => item.kind === "map")).toMatchObject({ ...STANDARD_SLOTS.map, templateKind: "point-heat" })
    expect(wide.find(item => item.kind === "legend")).toMatchObject({ ...STANDARD_SLOTS.legend, legendFlow: "rows" })
    for (const kind of ["legend", "north", "scale"]) {
      expect(wide.find(item => item.kind === kind)?.background).toBe("transparent")
      expect(wide.find(item => item.kind === kind)?.color).not.toBe("#ffffff")
    }
    expect(wide.find(item => item.kind === "title")).toMatchObject({ align: "center", fontSize: 36 })
    expect(wide.find(item => item.kind === "symbol")).toEqual(initial[1])
    expect(wide.map(item => item.id)).toEqual(atlas.map(item => item.id))
    expect(wide.find(item => item.kind === "map")?.raster?.legend).toEqual([])
  })
  it.each(Object.keys(templateLayoutProfiles))("keeps %s layout and charts within the safety margin without overlaps", kind => {
    const initial = [createCompositionItem("map"), ...Array.from({ length: 3 }, () => createCompositionItem("chart"))]
    const result = applyCompositionTemplate(initial, raster, { ...text, kind })
    for (const item of result) {
      expect(item.x).toBeGreaterThanOrEqual(PAGE.margin)
      expect(item.y).toBeGreaterThanOrEqual(PAGE.margin)
      expect(item.x + item.w).toBeLessThanOrEqual(PAGE.width - PAGE.margin)
      expect(item.y + item.h).toBeLessThanOrEqual(PAGE.height - PAGE.margin)
      for (const other of result.filter(candidate => candidate.id !== item.id)) {
        if ([item.kind, other.kind].includes("map") && [item.kind, other.kind].includes("north")) { continue }
        const overlap = item.x < other.x + other.w && item.x + item.w > other.x && item.y < other.y + other.h && item.y + item.h > other.y
        expect(overlap, `${kind}: ${item.kind} overlaps ${other.kind}`).toBe(false)
      }
    }
    const restored = restoreComposition(JSON.parse(JSON.stringify(result)))!
    expect(restored.map(item => [item.x, item.y, item.w, item.h, item.frameColor, item.ruleColor, item.legendFlow, item.templateKind]))
      .toEqual(result.map(item => [item.x, item.y, item.w, item.h, item.frameColor, item.ruleColor, item.legendFlow, item.templateKind]))
  })
  it("places explanation above the right legend and reserves the footer for scale and credits", () => {
    const result = applyCompositionTemplate([createCompositionItem("map")], { ...raster, width: 1280, height: 600 }, { ...text, kind: "choropleth" })
    const map = result.find(item => item.kind === "map")!
    for (const kind of ["north"]) {
      const item = result.find(item => item.kind === kind)!
      expect(item.x).toBeGreaterThanOrEqual(map.x)
      expect(item.y).toBeGreaterThanOrEqual(map.y)
      expect(item.x + item.w).toBeLessThanOrEqual(map.x + map.w)
      expect(item.y + item.h).toBeLessThanOrEqual(map.y + map.h)
      expect(item.background).toBe("transparent")
    }
    const legend = result.find(item => item.kind === "legend")!
    const description = result.find(item => item.kind === "description")!
    expect(legend.x).toBeGreaterThan(map.x + map.w)
    expect(description.y + description.h).toBeLessThan(legend.y)
    for (const kind of ["scale", "source", "agency", "time"]) {
      expect(result.find(item => item.kind === kind)!.y).toBeGreaterThan(map.y + map.h)
    }
  })
})
