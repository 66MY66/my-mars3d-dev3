import { describe, expect, it } from "vitest"
import { computeAreaM2, computePerimeterM, estimateMetrics, formatArea, formatDistance, formatMoney, formatPopulation } from "@/utils/disaster-metrics"

const R = 6378137
function mercX(lngDeg: number) {
  return (R * lngDeg * Math.PI) / 180
}
function mercY(latDeg: number) {
  const lat = (latDeg * Math.PI) / 180
  return R * Math.log(Math.tan(Math.PI / 4 + lat / 2))
}

describe("disaster-metrics", () => {
  it("computes area/perimeter in EPSG:3857 for small square near equator", () => {
    const ring: Array<[number, number]> = [
      [0, 0],
      [0.001, 0],
      [0.001, 0.001],
      [0, 0.001]
    ]
    const area = computeAreaM2(ring)
    const perimeter = computePerimeterM(ring)

    const w = mercX(0.001) - mercX(0)
    const h = mercY(0.001) - mercY(0)
    const expectedArea = Math.abs(w * h)
    const expectedPerimeter = 2 * (Math.abs(w) + Math.abs(h))

    expect(area).toBeGreaterThan(0)
    expect(perimeter).toBeGreaterThan(0)
    expect(Math.abs(area - expectedArea) / expectedArea).toBeLessThan(0.01)
    expect(Math.abs(perimeter - expectedPerimeter) / expectedPerimeter).toBeLessThan(0.01)
  })

  it("estimates population and loss", () => {
    const ring: Array<[number, number]> = [
      [0, 0],
      [0.001, 0],
      [0.001, 0.001],
      [0, 0.001]
    ]
    const metrics = estimateMetrics(ring, { populationDensityPerKm2: 1000, lossPerPersonYuan: 5000 })
    expect(metrics.areaM2).toBeGreaterThan(0)
    expect(metrics.population).toBeGreaterThan(0)
    expect(metrics.lossYuan).toBe(metrics.population * 5000)
  })

  it("formats units", () => {
    expect(formatArea(1_000_000, "km2")).toContain("1.000 km²")
    expect(formatArea(1234, "m2")).toContain("m²")
    expect(formatDistance(1000, "km")).toContain("1.000 km")
    expect(formatDistance(123, "m")).toContain("m")
    expect(formatPopulation(10_000, "wan")).toContain("1.000 万人")
    expect(formatPopulation(1234, "person")).toContain("人")
    expect(formatMoney(100_000_000, "yi")).toContain("1.000 亿元")
    expect(formatMoney(10_000, "wan")).toContain("1.000 万元")
    expect(formatMoney(1234, "yuan")).toContain("元")
  })
})

