import { describe, expect, it } from "vitest"
import { getAdaptiveStatsPeakMetrics, getStatsOverlayLod } from "./stats-overlay-metrics"

describe("stats overlay metrics", () => {
  it("limits peak radius for a close view while preserving area-based height", () => {
    const metrics = getAdaptiveStatsPeakMetrics(250000, 500)

    expect(metrics.radius).toBeLessThan(55)
    expect(metrics.maxHeight).toBeGreaterThan(2000)
    expect(metrics.heightScale).toBeCloseTo(1.5)
    expect(metrics.widthScale).toBeCloseTo(0.33)
  })

  it("interpolates from normal proportions at 10km to slim peaks at 500m", () => {
    const near = getAdaptiveStatsPeakMetrics(250000, 500)
    const mid = getAdaptiveStatsPeakMetrics(250000, 5000)
    const far = getAdaptiveStatsPeakMetrics(250000, 10000)

    expect(near.radius).toBeLessThan(mid.radius)
    expect(mid.radius).toBeLessThanOrEqual(far.radius)
    expect(near.maxHeight).toBeGreaterThan(mid.maxHeight)
    expect(mid.maxHeight).toBeGreaterThanOrEqual(far.maxHeight)
  })

  it("uses four LOD states and keeps columns hidden around 10-20km", () => {
    expect(getStatsOverlayLod(400000)).toBe("hidden")
    expect(getStatsOverlayLod(20000)).toBe("region")
    expect(getStatsOverlayLod(10000)).toBe("region")
    expect(getStatsOverlayLod(6000)).toBe("columns")
    expect(getStatsOverlayLod(1800)).toBe("labels")
  })
})
