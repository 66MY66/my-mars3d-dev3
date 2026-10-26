import { describe, expect, it } from "vitest"
import { area as turfArea } from "@turf/turf"
import { runBufferAnalysis, runNeighborAnalysis, runOverlayAnalysis } from "@/api/spatialAnalysis"

describe("spatialAnalysis mock", () => {
  it("buffer returns polygon feature", async () => {
    ;(process.env as any).API_LOCAL = "1"
    const res = await runBufferAnalysis({
      target: { type: "polygon", ring: [[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01]] },
      mode: "multi",
      coreKm: 50,
      transitionKm: 100,
      edgeKm: 150,
      opacity: 70,
      smooth: 32
    })
    expect(res.geojson?.type).toBe("FeatureCollection")
    expect(res.geojson.features.length).toBeGreaterThan(0)
    expect(res.summary.totalAreaM2).toBeGreaterThan(0)
  })

  it("buffers point, line and polygon targets from their real geometry", async () => {
    ;(process.env as any).API_LOCAL = "1"
    const point = await runBufferAnalysis({ target: { type: "point", coordinates: [0, 0] }, mode: "single", radiusM: 1000 })
    const line = await runBufferAnalysis({ target: { type: "polyline", coordinates: [[0, 0], [0.02, 0]] }, mode: "single", radiusM: 1000 })
    const polygon = await runBufferAnalysis({
      target: { type: "polygon", ring: [[0, 0], [0.02, 0], [0.02, 0.01], [0, 0.01]] },
      mode: "single",
      radiusM: 1000
    })

    expect(point.geojson.features[0].geometry.type).toMatch(/Polygon/)
    expect(point.summary.ringStats).toEqual([
      expect.objectContaining({ level: "core", distanceM: 1000, rangeM: [0, 1000] })
    ])
    expect(line.summary.sourceType).toBe("polyline")
    expect(polygon.summary.sourceType).toBe("polygon")
    expect(line.summary.areaM2).toBeGreaterThan(point.summary.areaM2)
    expect(polygon.summary.areaM2).toBeGreaterThan(line.summary.areaM2)
  })

  it("emits only selected multi-ring distances in ascending order", async () => {
    ;(process.env as any).API_LOCAL = "1"
    const res = await runBufferAnalysis({
      target: { type: "point", coordinates: [0, 0] },
      mode: "multi",
      distancesM: [2000, 500, 1000],
      enabledRingIndexes: [0, 2]
    })

    expect(res.geojson.features).toHaveLength(2)
    expect(res.geojson.features.map((feature: any) => feature.properties.distanceM)).toEqual([2000, 500])
    expect(res.summary.distancesM).toEqual([500, 2000])
  })

  it("creates non-overlapping multi-ring zones", async () => {
    ;(process.env as any).API_LOCAL = "1"
    const res = await runBufferAnalysis({
      target: { type: "point", coordinates: [0, 0] },
      mode: "multi",
      distancesM: [500, 1000, 2000]
    })
    const renderedArea = res.geojson.features.reduce((total: number, feature: any) => total + turfArea(feature), 0)
    expect(renderedArea).toBeCloseTo(res.summary.totalAreaM2, -1)
    expect(res.summary.ringStats).toHaveLength(3)
    expect(res.summary.ringStats.map((ring: any) => ring.rangeM)).toEqual([[0, 500], [500, 1000], [1000, 2000]])
    expect(res.summary.ringStats.reduce((total: number, ring: any) => total + ring.areaM2, 0)).toBeCloseTo(res.summary.totalAreaM2, -1)
  })

  it("overlay returns A/B and possibly Result", async () => {
    ;(process.env as any).API_LOCAL = "1"
    const res = await runOverlayAnalysis({
      target: { type: "polygon", ring: [[0, 0], [0.02, 0], [0.02, 0.02], [0, 0.02]] },
      targetLayer: "mock-admin",
      operation: "intersect"
    })
    expect(res.geojson.features.length).toBeGreaterThanOrEqual(2)
  })

  it("neighbor returns polygon + points", async () => {
    ;(process.env as any).API_LOCAL = "1"
    const res = await runNeighborAnalysis({
      target: { type: "polygon", ring: [[0, 0], [0.02, 0], [0.02, 0.02], [0, 0.02]] },
      dataset: "hazard-point",
      radiusM: 800,
      limit: 50
    })
    const points = res.geojson.features.filter((f: any) => f.geometry?.type === "Point")
    const polys = res.geojson.features.filter((f: any) => f.geometry?.type === "Polygon")
    expect(polys.length).toBeGreaterThanOrEqual(1)
    expect(points.length).toBeGreaterThan(0)
  })
})
