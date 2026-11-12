import { describe, expect, it } from "vitest"
import { featureCollection, point, polygon } from "@turf/turf"
import { styleSocioeconomicLayer } from "./socioeconomic-style"
import type { DbtLayer } from "./dbt116-standard"

function layer(): DbtLayer {
  return {
 id: "population",
role: "population",
name: "统计单元",
source: "QA",
authority: "QA",
publishedAt: "2026-09-30",
security: "public",
crs: "EPSG:4490",
scale: 100000,
    thematic: { mode: "total", method: "equal", count: 3 },
    legend: [{ label: "旧人口 1200", color: "#ff0000" }],
    data: featureCollection([1200, 2800, 600].map((population, i) => polygon([[[105 + i * 0.1, 29], [105.1 + i * 0.1, 29], [105.1 + i * 0.1, 29.1], [105 + i * 0.1, 29.1], [105 + i * 0.1, 29]]], { population, label: "1200 人（旧值）", color: "#ff0000" }))) 
}
}
describe("source-driven socioeconomic cartography", () => {
  it("updates legend and annotations from values, ignoring stale source colors and labels", () => {
    const input = layer(); const original = JSON.stringify(input)
    const first = styleSocioeconomicLayer(input)
    input.data.features[0].properties!.population = 120000
    const second = styleSocioeconomicLayer(input)
    expect(first.legend).not.toEqual(second.legend)
    expect(second.data.features[0].properties!.label).toBe("120,000 人")
    expect(second.data.features[0].properties!.color).not.toBe("#ff0000")
    expect(first.legend?.every(entry => entry.label.includes("人"))).toBe(true)
    input.data.features[0].properties!.population = 1200
    expect(JSON.stringify(input)).toBe(original)
  })
  it("derives polygon density from population and geodesic area without changing totals", () => {
    const input = layer(); input.thematic = { mode: "density" }
    const result = styleSocioeconomicLayer(input)
    expect(result.legend?.every(entry => entry.label.includes("人/km²"))).toBe(true)
    expect(result.data.features.map(f => f.properties!.population)).toEqual([1200, 2800, 600])
    expect(result.data.features[0].properties!.thematicValue).toBeGreaterThan(0)
    expect(result.data.features[0].properties!.thematicValue).toBeLessThan(1200)
  })
  it("supports unit-bound economic maps and rejects missing units and invalid values", () => {
    const input = layer(); input.role = "economy"
    input.data.features.forEach(f => { f.properties!.value = f.properties!.population })
    expect(() => styleSocioeconomicLayer(input)).toThrow("单位")
    input.unit = "万元"
    expect(styleSocioeconomicLayer(input).legend?.every(row => row.label.includes("万元"))).toBe(true)
    input.data.features[0].properties!.value = -1
    expect(() => styleSocioeconomicLayer(input)).toThrow("非负")
  })
  it("derives proportional point sizes and requires polygons for density", () => {
    const input = layer(); input.data = featureCollection([point([105, 29], { population: 100 }), point([106, 29], { population: 400 })])
    const result = styleSocioeconomicLayer(input)
    expect(result.data.features[1].properties!.thematicRadius).toBeGreaterThan(result.data.features[0].properties!.thematicRadius)
    expect((result.data.features[1].properties!.thematicRadius / result.data.features[0].properties!.thematicRadius) ** 2).toBeCloseTo(4)
    input.thematic = { mode: "density" }
    expect(() => styleSocioeconomicLayer(input)).toThrow("面统计单元")
  })
  it("uses symbol areas and circle legend sizes for polygon totals without altering source geometry", () => {
    const input = layer(); const result = styleSocioeconomicLayer(input)
    expect(result.data.features.map(f => f.geometry)).toEqual(input.data.features.map(f => f.geometry))
    expect(result.data.features.every(f => f.properties!.thematicMode === "total")).toBe(true)
    expect(new Set(result.data.features.map(f => f.properties!.color)).size).toBe(1)
    expect(result.legend!.every(row => Number.isFinite(row.radius))).toBe(true)
    const [a, b] = result.legend!
    expect(b.radius! ** 2 / a.radius! ** 2).toBeCloseTo(b.value! / a.value!)
  })
})
