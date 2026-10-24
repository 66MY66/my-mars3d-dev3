import { describe, expect, it } from "vitest"
import { compositionSymbolSvg } from "./composition-symbols"
import { cartographySymbolDefinitions, type CartographySymbolKind } from "./template-icon-registry"
import { constrainItem, createCompositionItem, restoreComposition } from "./composition-model"
import sources from "./symbol-assets/sources.json"
import standardSources from "./symbol-assets/dbt116-sources.json"
import pngSources from "./symbol-assets/dbt116-png.json"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { resolve } from "node:path"

describe("composition symbol materials", () => {
  it("renders all appendix B symbols and preserves legacy annotations", () => {
    const entries = Object.entries(cartographySymbolDefinitions)
    expect(entries.filter(([, symbol]) => !symbol.legacy && symbol.family === "basic")).toHaveLength(21)
    expect(entries.filter(([, symbol]) => !symbol.legacy && symbol.family === "earthquake")).toHaveLength(14)
    expect(entries.filter(([, symbol]) => symbol.legacy)).toHaveLength(23)
    for (const [kind, binding] of entries) {
      const svg = compositionSymbolSvg(kind as CartographySymbolKind, "#123456")
      expect(svg).toContain("<svg")
      if (!binding.standardAsset) { expect(svg).toContain("#123456") }
      expect(svg).not.toContain("undefined")
      const document = new DOMParser().parseFromString(svg, "image/svg+xml")
      expect(document.querySelector("parsererror, script, foreignObject")).toBeNull()
      if (binding.standardAsset) {
        expect(document.querySelector("image")?.getAttribute("href")).toMatch(/^data:image\/png;base64,/)
        expect(binding.standardAsset).toMatch(/\.png$/)
        const provenance = pngSources[binding.standardAsset as keyof typeof pngSources]
        expect(provenance.alpha).toBe(true)
        expect(standardSources.symbols.some(source => source.file === provenance.source)).toBe(true)
        const bytes = readFileSync(resolve(`src/widgets/basic/thematic-workbench/symbol-assets/${binding.standardAsset}`))
        expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(provenance.sha256)
        expect(compositionSymbolSvg(kind as CartographySymbolKind, "#ffffff")).toBe(svg)
      } else { expect(document.querySelectorAll("path, circle, rect, polygon").length).toBeGreaterThan(0) }
      expect(document.documentElement.getAttribute("width")).toBe("512")
      if (binding.asset) {
        expect(document.documentElement.getAttribute("fill")).toBe("#123456")
        const source = sources.find(source => source.filename === `ocha-${binding.asset}.svg`)
        expect(source?.source).toMatch(/^https:\/\/raw.githubusercontent.com\/UN-OCHA\/humanitarian-icons\//)
        expect(source?.sha256).toMatch(/^[a-f0-9]{64}$/)
      }
    }
    expect(sources).toHaveLength(18)
  })
  it("rejects invalid colors and never mutates cached source templates", () => {
    const invalid = compositionSymbolSvg("disaster-earthquake", 'red\" onload=\"alert(1)')
    expect(invalid).not.toContain("onload")
    expect(invalid).toContain(cartographySymbolDefinitions["disaster-earthquake"].accent)
    expect(compositionSymbolSvg("disaster-earthquake", "#112233")).toContain('fill="#112233"')
    expect(compositionSymbolSvg("disaster-earthquake", "#445566")).not.toContain("#112233")
  })
  it("keeps archived symbols without equivalent OCHA meanings available for restoration", () => {
    for (const kind of ["epicenter", "anomaly", "geo-peak", "geo-water", "geo-flag"] as const) {
      const symbol = { ...createCompositionItem("symbol"), symbolKind: kind }
      expect(restoreComposition([createCompositionItem("map"), symbol])?.[1].symbolKind).toBe(kind)
      expect(cartographySymbolDefinitions[kind].legacy).toBe(true)
    }
  })
  it("preserves small symbol size, appearance and identity across saved layouts", () => {
    const symbol = { ...createCompositionItem("symbol"), symbolKind: "rescue" as const, color: "#234567", w: 34, h: 34, rotation: 45, opacity: 0.35 }
    expect(constrainItem(symbol)).toMatchObject({ w: 34, h: 34 })
    const restored = restoreComposition([createCompositionItem("map"), symbol])
    expect(restored?.[1]).toMatchObject({ symbolKind: "rescue", color: "#234567", w: 34, h: 34, rotation: 45, opacity: 0.35 })
    expect(restored?.[1].x).toBeCloseTo(symbol.x)
    expect(restored?.[1].y).toBeCloseTo(symbol.y)
    expect(restoreComposition([createCompositionItem("map"), { ...symbol, symbolKind: "unknown" }])).toBeNull()
    expect(restoreComposition([createCompositionItem("map"), { ...symbol, symbolKind: "__proto__" }])).toBeNull()
  })
})
