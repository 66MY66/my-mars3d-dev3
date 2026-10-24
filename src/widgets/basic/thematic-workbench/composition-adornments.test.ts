import { describe, expect, it } from "vitest"
import { defaultAdornmentSettings } from "./cartography-layout"
import { createCompositionItem, PAGE, restoreComposition, rotationBounds } from "./composition-model"
import { compositionMetadata, migrateAdornments, placeInCorner, setCompositionMargin } from "./composition-adornments"
import { compositionHistory } from "./composition-history"

describe("single composer adornment controls", () => {
  it("preserves hidden elements and margin through storage and history", () => {
    const initial = [createCompositionItem("map"), createCompositionItem("title", "original")]
    const updated = setCompositionMargin(initial, 20)
    updated[1].x = 20; updated[1].hidden = true
    const restored = restoreComposition(JSON.parse(JSON.stringify(updated)))!
    expect(restored[0].safeMargin).toBe(20)
    expect(restored[1]).toMatchObject({ x: 20, hidden: true, text: "original" })
    const history = compositionHistory(); history.reset(initial); history.record(updated)
    expect(history.step(-1)?.[1].hidden).toBeUndefined()
    expect(history.step(1)?.[1].hidden).toBe(true)
  })
  it("keeps rotated elements within changed margins without altering original drafts", () => {
    const original = [createCompositionItem("map"), { ...createCompositionItem("text"), x: 0, y: 0, rotation: 45 }]
    const next = setCompositionMargin(original, 80)
    const box = rotationBounds(next[1], next[1].rotation)
    expect(box.x).toBeGreaterThanOrEqual(80 - 1e-6)
    expect(box.y).toBeGreaterThanOrEqual(80 - 1e-6)
    expect(original[1].x).toBe(0)
    const placed = placeInCorner(next[1], "bottom-right", 80)
    const rotated = rotationBounds(placed, placed.rotation)
    expect(rotated.x + rotated.w).toBeLessThanOrEqual(PAGE.width - 80 + 1e-6)
    expect(rotated.y + rotated.h).toBeLessThanOrEqual(PAGE.height - 80 + 1e-6)
  })
  it("migrates text, image, font and visibility only on explicit request", () => {
    const original = [createCompositionItem("map"), createCompositionItem("title", "old")]
    const settings = defaultAdornmentSettings()
    settings.title = "migrated title"; settings.text = "note"; settings.image = "data:image/png;base64,AAAA"
    settings.enabled = { title: true, source: false, text: true, image: true }
    settings.elements.title.font = "serif"; settings.elements.title.color = "#123456"
    const next = migrateAdornments(original, settings)
    expect(next.find(item => item.kind === "title")).toMatchObject({ text: "migrated title", font: "serif", color: "#123456" })
    expect(next.find(item => item.kind === "source")?.hidden).toBe(true)
    expect(next.find(item => item.kind === "text")?.text).toBe("note")
    expect(next.find(item => item.kind === "image")?.raster?.image).toBe(settings.image)
    expect(original).toHaveLength(2); expect(original[1].text).toBe("old")
    expect(migrateAdornments(next, settings).filter(item => item.kind === "image")).toHaveLength(1)
    expect(migrateAdornments(next, settings).filter(item => item.kind === "text")).toHaveLength(1)
  })
  it("does not accept hidden main maps or invalid margins from storage", () => {
    const map = { ...createCompositionItem("map"), hidden: true, safeMargin: 9999 }
    const restored = restoreComposition([map])!
    expect(restored[0].hidden).toBeUndefined(); expect(restored[0].safeMargin).toBe(80)
  })
  it("exports actual composer copy and visibility without losing palette provenance", () => {
    const base = { version: 1 as const, settings: defaultAdornmentSettings(), legend: [{ label: "VI", color: "#ffd2da" }], metrics: null, symbols: [], renderStyle: { businessPalette: { source: "test" } } }
    const items = [createCompositionItem("map"), { ...createCompositionItem("title", "current"), hidden: true }, { ...createCompositionItem("image"), raster: { image: "data:image/png;base64,AAAA", label: "photo", detail: "", legend: [] } }]
    const result = compositionMetadata(items, base)
    expect(result.settings.title).toBe("current"); expect(result.settings.enabled?.title).toBe(false)
    expect(result.renderStyle).toEqual(base.renderStyle); expect(result.legend).toEqual(base.legend)
    expect(result.composition.elements[2].imageLabel).toBe("photo")
    expect(JSON.stringify(result)).not.toContain("base64")
    expect(base.settings.title).toBe("")
  })
})
