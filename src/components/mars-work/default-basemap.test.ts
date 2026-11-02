import { describe, expect, it } from "vitest"
import { activateDefaultBasemap } from "./default-basemap"

describe("activateDefaultBasemap", () => {
  it("activates the online Gaode imagery instead of the similarly named local entry", () => {
    let selectedBasemap = "local-runtime-id"
    let renderRequests = 0
    let clockTicks = 0
    const basemaps = [
      { id: "local-runtime-id", name: "高德影像(本地)", show: true, isAdded: true },
      { id: "online-runtime-id", name: "高德影像", show: false, isAdded: false }
    ]
    const map = {
      getBasemaps: () => basemaps,
      get basemap() {
        return selectedBasemap
      },
      set basemap(value: string) {
        selectedBasemap = value
      },
      scene: {
        requestRender: () => {
          renderRequests += 1
        }
      },
      viewer: {
        clock: {
          tick: () => {
            clockTicks += 1
          }
        }
      }
    }

    expect(activateDefaultBasemap(map)).toBe(true)
    expect(selectedBasemap).toBe("online-runtime-id")
    expect(basemaps.map((item) => item.show)).toEqual([false, true])
    expect(renderRequests).toBe(1)
    expect(clockTicks).toBe(1)
  })

  it("leaves the map unchanged when the configured default is unavailable", () => {
    let selectedBasemap = "existing-id"
    const map = {
      getBasemaps: () => [{ id: "local-runtime-id", name: "高德影像(本地)" }],
      get basemap() {
        return selectedBasemap
      },
      set basemap(value: string) {
        selectedBasemap = value
      }
    }

    expect(activateDefaultBasemap(map)).toBe(false)
    expect(selectedBasemap).toBe("existing-id")
  })
})
