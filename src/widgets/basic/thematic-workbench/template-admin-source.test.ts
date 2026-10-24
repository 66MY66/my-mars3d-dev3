import { describe, expect, it, vi } from "vitest"
import { polygon, area, booleanValid } from "@turf/turf"
import { ADMIN_AREA_FIELD, ADMIN_CODE_FIELD, loadTemplateAdministrativeSource } from "./template-admin-source"

const feature = (code: number, west: number, east: number, childrenNum: number, level: string) => polygon([[[west, 25], [east, 25], [east, 28], [west, 28], [west, 25]]], { adcode: code, name: `区域${code}`, childrenNum, level })
const province = feature(530000, 102, 108, 1, "province")
const city = feature(530600, 103, 107, 2, "city")
const districts = [feature(530601, 103, 105, 0, "district"), feature(530602, 105, 107, 0, "district")]
const bounds = { west: 104, east: 106, south: 26, north: 27 }

describe("automatic administrative template data", () => {
  it("repairs touching boundary spikes without expanding measured regions or changing source geometry", async () => {
    const touching = polygon([[[103, 25], [105, 25], [105, 28], [104, 28], [104, 27], [104, 28], [103, 28], [103, 25]]], districts[0].properties)
    expect(booleanValid(touching)).toBe(false)
    const original = JSON.stringify(touching)
    const result = await loadTemplateAdministrativeSource(bounds, undefined, async () => [touching])
    expect(booleanValid(result.document.features[0])).toBe(true)
    expect(result.document.features[0].properties[ADMIN_AREA_FIELD]).toBeCloseTo(area(touching) / 1e6, 1)
    expect(JSON.stringify(touching)).toBe(original)
  })
  it("loads intersecting real hierarchy and measures full regions before clipping", async () => {
    const load = vi.fn(async (code: string) => ({ 100000: [province], 530000: [city], 530600: districts }[code]!))
    const result = await loadTemplateAdministrativeSource(bounds, undefined, load)
    expect(load.mock.calls.map(([code]) => code)).toEqual(["100000", "530000", "530600"])
    expect(result.count).toBe(2)
    expect(result.name).toBe("区县行政区边界")
    expect(result.document.features[0].properties[ADMIN_AREA_FIELD]).toBeCloseTo(area(districts[0]) / 1e6, 1)
    expect(result.document.features[0].properties[ADMIN_CODE_FIELD]).toBe(530601)
    expect(result.source).toContain("非灾害指标")
    expect(districts[0].properties).not.toHaveProperty(ADMIN_AREA_FIELD)
  })
  it("does not substitute fake regions or partial data for network errors", async () => {
    const load = vi.fn(async (code: string) => {
      if (code === "530600") { throw new Error("boundary unavailable") }
      return code === "100000" ? [province] : [city]
    })
    await expect(loadTemplateAdministrativeSource(bounds, undefined, load)).rejects.toThrow("boundary unavailable")
    await expect(loadTemplateAdministrativeSource({ west: -10, east: -5, south: 0, north: 5 }, undefined, async () => [province])).rejects.toThrow("覆盖范围")
  })
  it("stops cancelled work and avoids detailed requests for a national extent", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(loadTemplateAdministrativeSource(bounds, controller.signal, async () => [province])).rejects.toThrow()
    const load = vi.fn(async () => [province])
    const result = await loadTemplateAdministrativeSource({ west: 70, east: 130, south: 10, north: 55 }, undefined, load)
    expect(load).toHaveBeenCalledTimes(1)
    expect(result.name).toBe("省级行政区边界")
  })
})
