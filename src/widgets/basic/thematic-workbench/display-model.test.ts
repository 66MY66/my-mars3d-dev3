import { describe, expect, it } from "vitest"
import { evaluateQuality, initialQuality, inBounds, niceScale, orderedTracks, type DisplayPoint } from "./display-model"

describe("display quality and data contracts", () => {
  it("reduces quality on 4K or three simultaneous effects", () => {
    expect(initialQuality(3840 * 2160, 1)).toBe("medium")
    expect(initialQuality(3776 * 2096, 1)).toBe("medium")
    expect(initialQuality(1920 * 1080, 3)).toBe("medium")
    expect(initialQuality(1920 * 1080, 1)).toBe("high")
  })
  it("degrades high to medium to low only after sustained load", () => {
    let state = { quality: "high" as const as "high" | "medium" | "low", slowWindows: 0 }
    for (let i = 0; i < 6; i++) { state = evaluateQuality(state.quality, 20, state.slowWindows) }
    expect(state.quality).toBe("low")
    expect(evaluateQuality("high", 20, 1).changed).toBe(false)
    expect(evaluateQuality("medium", 60, 2).slowWindows).toBe(0)
    expect(evaluateQuality("high", 1, 2, false).changed).toBe(false)
    expect(evaluateQuality("low", 15, 4).quality).toBe("low")
  })
  it("requires valid chronology and does not mutate input or join tracks", () => {
    const point = { lon: 1, lat: 2, value: 1, color: "#ff0000", label: "", band: "" }
    const points: DisplayPoint[] = [{ ...point, time: 20 }, { ...point }, { ...point, time: 10 }, { ...point, track: "other", time: 5 }]
    expect(orderedTracks(points).map((track) => track.map((p) => p.time))).toEqual([[10, 20]])
    expect(points[0].time).toBe(20)
    expect(orderedTracks([{ ...point, time: 10 }, { ...point, time: 10 }])).toEqual([])
  })
  it("keeps scope inclusive and rejects invalid coordinates", () => {
    const bounds = { west: 100, east: 101, south: 30, north: 31 }
    expect(inBounds({ lon: 100, lat: 31 }, bounds)).toBe(true)
    expect(inBounds({ lon: 99, lat: 31 }, bounds)).toBe(false)
    expect(inBounds({ lon: NaN, lat: 31 }, bounds)).toBe(false)
  })
  it("produces a ground-distance scale with no invented fixed denominator", () => {
    expect(niceScale(1000)).toEqual({ meters: 100000, pixels: 100, label: "100 km" })
    expect(niceScale(1)?.label).toBe("100 m")
    expect(niceScale(0)).toBeNull()
  })
})
