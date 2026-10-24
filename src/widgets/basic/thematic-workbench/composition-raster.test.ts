import { describe, expect, it } from "vitest"
import { createCompositionItem, readCompositionRaster, restoreComposition, useCompositionRaster, type CompositionRaster } from "./composition-model"
import { compositionHistory } from "./composition-history"
import { processRasterPixels, rasterResultLegend } from "./raster-analysis"

const raster: CompositionRaster = { image: "data:image/png;base64,aGVsbG8=", label: "分级渲染", detail: "3 级", legend: [{ label: "[0, 30]", color: "#183b63" }] }

describe("raster composition usage", () => {
  it("replaces only the main bitmap while preserving the main frame and user title", () => {
    const items = [createCompositionItem("map"), createCompositionItem("title", "User title")]
    const next = useCompositionRaster(items, raster, "main")
    expect(next.filter(item => item.kind === "map")).toHaveLength(1)
    expect(next[0]).toMatchObject({ id: items[0].id, x: items[0].x, y: items[0].y, w: items[0].w, h: items[0].h, raster })
    expect(next[1]).toEqual(items[1])
    expect(items[0].raster).toBeUndefined()
    expect(restoreComposition(next)?.[0].raster).toEqual(raster)
  })
  it("adds independent insets and supports undo/redo without altering the main map", () => {
    const original = [createCompositionItem("map")]
    const history = compositionHistory()
    history.reset(original)
    const next = useCompositionRaster(original, raster, "inset")
    const more = useCompositionRaster(next, raster, "inset")
    expect(more[0]).toEqual(original[0])
    expect(more[1].id).not.toBe(more[2].id)
    expect(more[1].w * more[1].h).toBeLessThan(original[0].w * original[0].h)
    history.record(more)
    expect(history.step(-1)).toEqual(original)
    expect(history.step(1)).toEqual(more)
    const restored = restoreComposition(more)!
    expect(restored[1].raster).toEqual(raster)
    more[1].raster!.legend[0].color = "#ffffff"
    expect(more[2].raster!.legend[0].color).toBe("#183b63")
    expect(raster.legend[0].color).toBe("#183b63")
  })
  it("rejects transient, remote and malformed image references", () => {
    for (const image of ["blob:expired", "https://example.com/test.png", "data:image/svg+xml,<svg/>"]) {
      expect(readCompositionRaster({ ...raster, image })).toBeNull()
    }
    expect(restoreComposition([createCompositionItem("map"), createCompositionItem("image")])).toBeNull()
  })
  it("uses the same colors and inclusive upper bounds as classified pixels", () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 255, 127, 127, 127, 255, 255, 255, 255, 255])
    const result = processRasterPixels(pixels, 3, 1, { operation: "classified", classCount: 3, classMethod: "equal", opacity: 100 })
    const legend = rasterResultLegend(result.summary)
    expect(legend.map(entry => entry.color)).toEqual(["#183b63", "#1f78b4", "#4eb297"])
    expect(legend[0].label.startsWith("[")).toBe(true)
    expect(legend[1].label.startsWith("(")).toBe(true)
    for (let i = 0; i < 3; i++) {
      const rgb = Array.from(result.pixels.slice(i * 4, i * 4 + 3)).map(value => value.toString(16).padStart(2, "0")).join("")
      expect(legend[i].color).toBe(`#${rgb}`)
    }
    expect(rasterResultLegend({ ...result.summary, validPixelCount: 0 })).toEqual([])
  })
})
