import { describe, expect, it } from "vitest"
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
