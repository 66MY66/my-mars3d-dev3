// @vitest-environment node
import { describe, expect, it } from "vitest"
import { defaultAdornmentSettings, normalizePreferences, snapRect, snapToFeatures, validScale, type CartographySnapshot } from "./cartography-layout"
import { embedCartographyMetadata } from "./cartography-png"
import { basicGeographicSymbols, cartographySymbolDefinitions, earthquakeSymbolDefinitions } from "./template-icon-registry"

describe("cartography alignment and export contract", () => {
  it("snaps the right edge even when the left edge has no matching target", () => {
    expect(snapRect({ x: 650, y: 150, w: 310, h: 200 }, 1000, 800, []).x).toBe(666)
    expect(snapRect({ x: 100, y: 100, w: 200, h: 200 }, 1000, 800, [{ x: 320, y: 450, w: 100, h: 100 }]).x).toBe(120)
    expect(snapRect({ x: 99, y: 100, w: 200, h: 200 }, 1000, 800, [{ x: 320, y: 450, w: 100, h: 100 }]).x).toBe(99)
  })
  it("keeps oversize and out of bounds content inside the safe area", () => {
    expect(snapRect({ x: -60, y: 900, w: 1200, h: 300 }, 1000, 800, [])).toEqual({ x: 24, y: 476, w: 952, h: 300 })
  })
  it("snaps to the closest point or segment within 20 screen pixels", () => {
    expect(snapToFeatures({ x: 50, y: 50 }, [{ x: 70, y: 50 }], [])).toEqual({ x: 70, y: 50, snapped: true })
    expect(snapToFeatures({ x: 50, y: 50 }, [{ x: 71, y: 50 }], []).snapped).toBe(false)
    expect(snapToFeatures({ x: 50, y: 50 }, [{ x: 70, y: 50 }], [[{ x: 0, y: 40 }, { x: 100, y: 40 }]])).toEqual({ x: 50, y: 40, snapped: true })
  })
  it("requires an explicit valid scale and remembers sanitized per-element preferences", () => {
    expect(validScale(null)).toBe(false)
    expect(validScale(75000)).toBe(false)
    for (const preset of [50000, 100000, 250000]) { expect(validScale(preset)).toBe(true) }
    const settings = defaultAdornmentSettings()
    settings.elements.title = { font: "serif", color: "#ff4433", corner: "bottom-right", align: "right", fontSize: 32 }
    settings.safeMargin = 0
    const restored = normalizePreferences(JSON.parse(JSON.stringify(settings)))
    expect(restored.elements.title).toEqual(settings.elements.title)
    expect(restored.safeMargin).toBeGreaterThanOrEqual(20)
  })
  it("keeps basic and earthquake icon families disjoint", () => {
    expect(Object.values(basicGeographicSymbols).every(item => item.family === "basic")).toBe(true)
    expect(Object.values(earthquakeSymbolDefinitions).every(item => item.family === "earthquake")).toBe(true)
    const active = Object.values(cartographySymbolDefinitions).filter(item => !item.legacy)
    expect(active.filter(item => item.family === "basic")).toHaveLength(21)
    expect(active.filter(item => item.family === "earthquake")).toHaveLength(14)
    expect(Object.values(cartographySymbolDefinitions).filter(item => item.legacy)).toHaveLength(23)
  })
  it("embeds the complete Unicode metadata snapshot in PNG without changing image data", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9kAAAAASUVORK5CYII=", "base64")
    const metadata: CartographySnapshot = { version: 1, settings: { ...defaultAdornmentSettings(), title: "震后形变", scaleDenominator: 100000 }, legend: [{ label: "沉降", color: "#3344ff" }], metrics: null, symbols: [] }
    const encoded = new Uint8Array(await (await embedCartographyMetadata(new Blob([png]), metadata)).arrayBuffer())
    expect(encoded.slice(0, png.length - 12)).toEqual(new Uint8Array(png.subarray(0, -12)))
    const text = new TextDecoder().decode(encoded.slice(png.length - 12 + 8, -16))
    expect(JSON.parse(text.slice("Cartography\0\0\0\0\0".length))).toEqual(metadata)
    expect(Array.from(encoded.slice(-12))).toEqual(Array.from(png.subarray(-12)))
  })
})
