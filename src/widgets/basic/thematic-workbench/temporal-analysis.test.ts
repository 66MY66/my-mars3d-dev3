import { describe, expect, it } from "vitest"
import { processTemporalFrames, type TemporalFrameInput } from "./temporal-analysis"

function frame(values: number[], label: string): TemporalFrameInput {
  const pixels = new Uint8ClampedArray(values.flatMap((value) => [value, value, value, 255]))
  return { pixels, width: 2, height: 2, label, timestamp: label }
}

const frames = [
  frame([20, 40, 60, 80], "T1"),
  frame([30, 42, 58, 90], "T2"),
  frame([40, 44, 56, 100], "T3")
]

describe("processTemporalFrames", () => {
  it("renders signed difference and reports changed pixels", () => {
    const result = processTemporalFrames(frames, { operation: "difference", differenceMode: "delta" })
    expect(result.summary.frameCount).toBe(3)
    expect(result.summary.changedRatio).toBeGreaterThan(0)
    expect(result.pixels[3]).toBeGreaterThan(0)
  })

  it("computes temporal mean and variance", () => {
    const mean = processTemporalFrames(frames, { operation: "statistics", statisticMode: "mean" })
    const variance = processTemporalFrames(frames, { operation: "statistics", statisticMode: "variance" })
    expect(mean.summary.frameMeans).toHaveLength(3)
    expect(variance.summary.meanVariance).toBeGreaterThan(0)
  })

  it("fits a positive trend for increasing pixels", () => {
    const result = processTemporalFrames(frames, { operation: "trend", minimumR2: 0.2 })
    expect(result.summary.meanSlope).toBeGreaterThan(0)
    expect(result.summary.meanR2).toBeGreaterThan(0)
  })

  it("masks normal pixels and exposes strong latest-frame anomalies", () => {
    const anomalyFrames = [frame([30, 30, 30, 30], "T1"), frame([31, 30, 30, 30], "T2"), frame([90, 30, 30, 30], "T3")]
    const result = processTemporalFrames(anomalyFrames, { operation: "anomaly", anomalyThreshold: 2 })
    expect(result.summary.anomalyRatio).toBeGreaterThan(0)
    expect(result.pixels[3]).toBeGreaterThan(0)
    expect(result.pixels[7]).toBe(0)
  })
})
