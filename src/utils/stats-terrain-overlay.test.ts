import { describe, expect, it } from "vitest"
import {
  buildStatsAnalysisRegion,
  buildStatsColumnAnchors,
  isFootprintInsideRegion,
  type StatsLonLatRing
} from "./stats-terrain-overlay"

const rectangle: StatsLonLatRing = [
  [116, 39],
  [116.08, 39],
  [116.08, 39.06],
  [116, 39.06]
]

describe("stats terrain overlay spatial model", () => {
  it("builds a continuous analysis region without internal grid edges", () => {
    const region = buildStatsAnalysisRegion(rectangle, { targetCells: 144, maxCells: 800 })

    expect(region).not.toBeNull()
    expect(region?.cells.length).toBeGreaterThan(0)
    expect(region?.cells.length).toBeLessThanOrEqual(800)
    expect(region?.outlines).toHaveLength(1)
    expect(region?.outlines[0].length).toBeGreaterThanOrEqual(4)
    expect(region?.boundaryEdges.length).toBeLessThan(region!.cells.length * 4)
  })

  it("keeps anchors and their complete footprints inside a concave region", () => {
    const concave: StatsLonLatRing = [
      [116, 39],
      [116.08, 39],
      [116.08, 39.02],
      [116.03, 39.02],
      [116.03, 39.07],
      [116, 39.07]
    ]
    const region = buildStatsAnalysisRegion(concave, { targetCells: 196, maxCells: 900 })
    const anchors = buildStatsColumnAnchors(region!, 8, 180)

    expect(region).not.toBeNull()
    expect(anchors.length).toBeGreaterThan(0)
    anchors.forEach((anchor) => {
      expect(isFootprintInsideRegion(anchor, anchor.footprintMeters, region!.outlines)).toBe(true)
    })
  })

  it("normalizes reversed rings and duplicate closing points deterministically", () => {
    const reversedClosed = [...rectangle].reverse()
    reversedClosed.push(reversedClosed[0])

    const forward = buildStatsAnalysisRegion(rectangle, { targetCells: 100 })
    const reversed = buildStatsAnalysisRegion(reversedClosed, { targetCells: 100 })

    expect(reversed?.hash).toBe(forward?.hash)
    expect(reversed?.cells).toEqual(forward?.cells)
    expect(buildStatsColumnAnchors(reversed!, 6, 160)).toEqual(buildStatsColumnAnchors(forward!, 6, 160))
  })

  it("returns no unsafe anchors when the range cannot contain the requested footprint", () => {
    const tiny: StatsLonLatRing = [
      [116, 39],
      [116.0002, 39],
      [116.0002, 39.0002],
      [116, 39.0002]
    ]
    const region = buildStatsAnalysisRegion(tiny, { targetCells: 16, maxCells: 64 })

    expect(region).not.toBeNull()
    expect(buildStatsColumnAnchors(region!, 4, 120)).toEqual([])
  })

  it("keeps anchor spacing collision-free and stable", () => {
    const region = buildStatsAnalysisRegion(rectangle, { targetCells: 144 })!
    const first = buildStatsColumnAnchors(region, 12, 160)
    const second = buildStatsColumnAnchors(region, 12, 160)

    expect(second).toEqual(first)
    for (let i = 0; i < first.length; i++) {
      for (let j = i + 1; j < first.length; j++) {
        const dx = (first[i].lng - first[j].lng) * 86_500
        const dy = (first[i].lat - first[j].lat) * 111_320
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(160)
      }
    }
  })
})
