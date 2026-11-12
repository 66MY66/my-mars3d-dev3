// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { area, featureCollection, polygon } from "@turf/turf"
import { socioeconomicMetrics } from "./socioeconomic-metrics"
import { styleSocioeconomicLayer } from "./socioeconomic-style"
import { dbtStatistics } from "./dbt-cartography-rules"
import { dbtTemplates, emptyDbtDocument, inspectDbtDocument, readDbtDocument, mergeDbtSourceLayer, type DbtLayer } from "./dbt116-standard"
import { businessStandardLayer } from "./business-standard-layer"
import { layoutDbtLegend } from "./dbt-legend-layout"
import { cartographyScale } from "./cartography-scale"
import { loadStandardPreviewDocument, standardPreviewPath } from "./standard-preview-source"
import { populationLegend } from "./population-grid"
import { draftRequirements } from "./dbt-draft-preview"

function source(): DbtLayer {
  return {
 id: "population",
name: "单位测试统计单元",
role: "population",
source: "QA",
crs: "EPSG:4490",
authority: "QA",
publishedAt: "2020-01-01",
security: "public",
scale: 100000,
    thematic: { field: "pop_density", inputMetric: "density", mode: "density" },
    data: featureCollection([10, 40].map((pop_density, i) => polygon([[[105 + i, 29], [105 + i + 0.1 * (i + 1), 29], [105 + i + 0.1 * (i + 1), 29.1], [105 + i, 29.1], [105 + i, 29]]], { pop_density }))) 
}
}
afterEach(() => vi.unstubAllGlobals())
describe("professional socioeconomic source semantics", () => {
  it("does not normalize an existing density a second time", () => {
    const input = source(); const before = JSON.stringify(input)
    expect(socioeconomicMetrics(input).rows.map(row => row.displayValue)).toEqual([10, 40])
    expect(styleSocioeconomicLayer(input).data.features.map(f => f.properties!.thematicValue)).toEqual([10, 40])
    expect(JSON.stringify(input)).toBe(before)
  })
  it("integrates density over whole source units instead of summing density values", () => {
    const input = source(); const document = emptyDbtDocument()
    const expected = input.data.features.reduce((sum, f) => sum + area(f) / 1e6 * f.properties!.pop_density, 0)
    const statistics = dbtStatistics(document, "T30102000", [input])
    expect(statistics[0].value).toBeCloseTo(expected)
    expect(statistics[0].value).not.toBe(50)
    expect(statistics[0].note).toContain("不将密度直接相加")
    input.thematic!.mode = "total"
    expect(styleSocioeconomicLayer(input).data.features[0].properties!.thematicValue).toBeCloseTo(area(input.data.features[0]) / 1e6 * 10)
  })
  it("preserves explicit field and metric metadata when reading a map business layer", () => {
    const input = source()
    const document = { ...input.data, metadata: { source: "QA source", role: "population", crs: "EPSG:4490", valueField: "pop_density", inputMetric: "density", thematic: { mode: "density", count: 3 } } }
    const converted = businessStandardLayer({ id: "source", name: "source", document })
    expect(converted.thematic).toEqual({ field: "pop_density", inputMetric: "density", mode: "density", count: 3 })
    expect(socioeconomicMetrics(converted).rows.map(row => row.displayValue)).toEqual([10, 40])
  })
  it("handles economic density units once and refuses an unmarked density unit", () => {
    const input = source(); input.role = "economy"; input.unit = "万元/km²"
    const result = socioeconomicMetrics(input)
    expect(result.baseUnit).toBe("万元"); expect(result.unit).toBe("万元/km²")
    input.thematic!.inputMetric = "total"
    expect(() => socioeconomicMetrics(input)).toThrow("再次除以面积")
  })
  it("keeps explicit missing values distinct from zero in symbology, statistics and formal QA", () => {
    const input = source(); input.data.features[0].properties!.pop_density = 0; input.data.features[1].properties!.pop_density = null
    const styled = styleSocioeconomicLayer(input)
    expect(styled.data.features[0].properties!.color).toBe("#ffffff")
    expect(styled.data.features[1].properties!.thematicNoData).toBe(true)
    expect(styled.legend!.at(-1)?.noData).toBe(true)
    expect(dbtStatistics(emptyDbtDocument(), "T30102000", [input])[0].value).toBeNull()
    const document = emptyDbtDocument(); document.layers = [input]
    expect(inspectDbtDocument(document, "T30102000").some(issue => issue.message.includes("缺测不能当作零值"))).toBe(true)
  })
  it("retains usable previews for all missing cells without inventing a zero total", () => {
    const input = source(); input.data.features.forEach(f => { f.properties!.pop_density = null })
    expect(styleSocioeconomicLayer(input).legend).toHaveLength(1)
    expect(dbtStatistics(emptyDbtDocument(), "T30102000", [input])[0].value).toBeNull()
  })
  it("uses descending classes and at most three positive proportional legend circles", () => {
    const input = source(); input.thematic!.mode = "total"
    const result = styleSocioeconomicLayer(input)
    expect(result.legend).toHaveLength(3)
    const [a, b] = result.legend!
    expect(a.value).toBeGreaterThan(b.value!); expect(a.radius! ** 2 / b.radius! ** 2).toBeCloseTo(a.value! / b.value!)
    expect(populationLegend()[0].label).toContain(">20,000")
  })
  it("rejects unknown metric metadata and requires confirmation for formal use", () => {
    const document = emptyDbtDocument(); const layer = source(); document.layers = [layer]
    layer.thematic!.inputMetric = "unconfirmed" as "total"
    expect(() => readDbtDocument(document)).toThrow("原始指标口径")
    delete layer.thematic!.inputMetric
    expect(inspectDbtDocument(document, "T30102000").some(issue => issue.message.includes("尚未确认原始指标"))).toBe(true)
  })
  it("treats socioeconomic topics as alternatives, not simultaneous mandatory layers", () => {
    const document = emptyDbtDocument(); const layer = source(); layer.role = "economy"; layer.unit = "万元"; document.layers = [layer]
    const requirements = draftRequirements(document, "T30102000")
    expect(requirements.find(row => row.role === "topic")?.present).toBe(true)
    expect(requirements.find(row => row.role === "intensity")?.present).toBe(false)
  })
})

describe("bounded professional legends and scale bars", () => {
  const measure = (label: string, width: number, size: number) => Math.ceil(label.length * size / width) * size * 1.5
  it("retains vector-before-raster order and source order within groups", () => {
    const entries = [{ label: "基础界线", order: 100 }, { label: "高值", order: 230, group: "密度" }, { label: "低值", order: 230, group: "密度" }, { label: "地形", order: 400 }]
    const before = JSON.stringify(entries); const result = layoutDbtLegend(entries, 580, measure)
    expect(result.rows.map(row => row.entry.label)).toEqual(["基础界线", "高值", "低值", "地形"])
    expect(result.omitted).toBe(0); expect(JSON.stringify(entries)).toBe(before)
    for (const row of result.rows) { expect(row.y + row.height).toBeLessThanOrEqual(1028) }
  })
  it("reserves space for long labels, group headings and true-size circle symbols", () => {
    const entries = [{ label: "长注记".repeat(20), order: 230, group: "比例圆图例", radius: 20 }, { label: "小圆", order: 230, group: "比例圆图例", radius: 10 }]
    const result = layoutDbtLegend(entries, 580, measure)
    expect(result.rows[0].height).toBeGreaterThan(40)
    expect(result.rows[1].y).toBeGreaterThan(result.rows[0].y + result.rows[0].height)
    expect(result.headings[0].y + result.headings[0].height).toBeLessThanOrEqual(result.rows[0].y)
  })
  it("reports overflow instead of drawing over the footer", () => {
    const result = layoutDbtLegend(Array.from({ length: 30 }, (_, i) => ({ label: `超长的图例内容${i}`, order: 230, group: "分级", radius: 20 })), 580, measure)
    expect(result.omitted).toBeGreaterThan(0)
    expect(result.rows.every(row => row.y + row.height <= 1028)).toBe(true)
  })
  it("uses ellipsoidal parallel distance at the map latitude with 5km-multiple divisions", () => {
    const equator = cartographyScale({ west: 100, east: 110, north: 1, south: -1 }, "EPSG:4326")!
    expect(equator.parallelKm).toBeCloseTo(1113.1949079, 5)
    const north = cartographyScale({ west: 100, east: 110, north: 61, south: 59 }, "EPSG:4490")!
    expect(north.parallelKm).toBeLessThan(equator.parallelKm * 0.51)
    expect(north.stepKm % 5).toBe(0); expect(north.width).toBeLessThanOrEqual(240)
    expect(cartographyScale({ west: 100, east: 101, north: 30, south: 29 }, "UNKNOWN")).toBeNull()
  })
})

describe("professional library previews", () => {
  it("adopts the first source frame only for a genuinely unbound document", () => {
    const document = emptyDbtDocument(); const layer = source(); layer.crs = "EPSG:4326"
    const next = mergeDbtSourceLayer(document, layer)
    expect(next.crs).toBe("EPSG:4326"); expect(document.layers).toEqual([])
    const mixed = source(); mixed.id = "another"
    expect(() => mergeDbtSourceLayer(next, mixed)).toThrow("坐标不一致")
    document.event.time = "2020-01-01"
    expect(() => mergeDbtSourceLayer(document, layer)).toThrow("坐标不一致")
  })
  it("rejects mixed-coordinate documents before rendering, even if formal checks have not run", () => {
    const document = emptyDbtDocument(); const layer = source(); layer.crs = "EPSG:4326"; document.layers = [layer]
    expect(() => readDbtDocument(document)).toThrow("坐标不一致")
  })
  it("never fetches synthetic map fixtures for the normal template library", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
    for (const template of dbtTemplates.filter(item => item.id !== "T30102000")) {
      const document = await loadStandardPreviewDocument(template.id)
      expect(document.layers).toEqual([]); expect(document.event.time).toBe(""); expect(standardPreviewPath(template.id)).toBeNull()
    }
    expect(fetch).not.toHaveBeenCalled()
  })
  it("loads the separately labeled historic population reference without fictional quake layers", async () => {
    const reference = JSON.parse(readFileSync("public/data/cartography-reference/population-worldpop2020.json", "utf8"))
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => reference }); vi.stubGlobal("fetch", fetch)
    const document = await loadStandardPreviewDocument("T30102000")
    expect(document.usage).toBe("reference"); expect(document.layers.some(layer => layer.role === "intensity")).toBe(false)
    expect(fetch.mock.calls[0][0]).toContain("cartography-reference/")
  })
})
