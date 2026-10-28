import { describe, expect, it } from "vitest"
import {
  buildStatsAnalysisRegion,
  buildStatsColumnAnchors,
  assignStatsRowsToAnchors,
  getStatsElevationDomain,
  isFootprintInsideRegion,
  mapStatsElevationColor,
  type StatsLonLatRing
} from "./stats-terrain-overlay"

const rectangle: StatsLonLatRing = [
  [116, 39],
  [116.08, 39],
  [116.08, 39.06],
  [116, 39.06]
]

describe("stats terrain overlay spatial model", () => {
  it("keeps the normalized source ring as the only visible boundary", () => {
    const region = buildStatsAnalysisRegion(rectangle, { targetCells: 144, maxCells: 800 })

    expect(region).not.toBeNull()
    expect(region?.cells.length).toBeGreaterThan(0)
    expect(region?.cells.length).toBeLessThanOrEqual(800)
    expect(region?.outlines).toEqual([rectangle])
    expect(region?.boundaryEdges).toEqual([
      [rectangle[0], rectangle[1]],
      [rectangle[1], rectangle[2]],
      [rectangle[2], rectangle[3]],
      [rectangle[3], rectangle[0]]
    ])
  })

  it("maps terrain height continuously through one shared elevation palette", () => {
    const domain = getStatsElevationDomain([0, 100, 200, 300, 400])
    const low = mapStatsElevationColor(0, domain)
    const middle = mapStatsElevationColor(200, domain)
    const high = mapStatsElevationColor(400, domain)

    expect(domain).toEqual({ min: 0, max: 400 })
    expect(low).not.toEqual(middle)
    expect(middle).not.toEqual(high)
    expect(low[2]).toBeGreaterThan(low[0])
    expect(high[0]).toBeGreaterThan(high[2])
    expect(middle[3]).toBe(232)
  })

  it("keeps elevation coloring deterministic for flat and invalid samples", () => {
    const domain = getStatsElevationDomain([Number.NaN, 80, 80, Number.POSITIVE_INFINITY])

    expect(domain).toEqual({ min: 80, max: 80 })
    expect(mapStatsElevationColor(80, domain)).toEqual(mapStatsElevationColor(80, domain))
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
    expect(region?.outlines).toEqual([tiny])
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

  it("keeps row-to-anchor assignments stable when row order changes", () => {
    const region = buildStatsAnalysisRegion(rectangle, { targetCells: 144 })!
    const anchors = buildStatsColumnAnchors(region, 8, 160)
    const first = assignStatsRowsToAnchors(["东区", "西区", "南区"], anchors)
    const reordered = assignStatsRowsToAnchors(["南区", "东区", "西区"], anchors)

    expect(reordered.get("东区")).toEqual(first.get("东区"))
    expect(reordered.get("西区")).toEqual(first.get("西区"))
    expect(reordered.get("南区")).toEqual(first.get("南区"))
  })
})
