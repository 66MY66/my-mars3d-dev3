import { describe, expect, it } from "vitest"
import * as iconPark from "@icon-park/svg"
import {
  basicTemplateIconByVisualKind,
  categoryFallbackTemplateIcons,
  earthquakeSymbolDefinitions,
  cartographySymbolDefinitions,
  earthquakeTemplateIconPlans,
  getEarthquakeTemplatePrimaryIcon,
  getEarthquakeTemplateSymbolBindings
} from "./template-icon-registry"

function toIconParkExportName(icon: string): string {
  return icon
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("")
}

describe("thematic template icon registry", () => {
  it("keeps every general template icon in the basic family", () => {
    const bindings = [
      ...Object.values(basicTemplateIconByVisualKind),
      ...Object.values(categoryFallbackTemplateIcons)
    ]

    expect(bindings).toHaveLength(17)
    expect(bindings.every((binding) => binding.family === "basic" && binding.kind.startsWith("basic-"))).toBe(true)
  })

  it("binds earthquake templates only to sourced emergency symbols", () => {
    const approvedKinds = Object.values(cartographySymbolDefinitions).filter(binding => !binding.legacy && binding.family === "earthquake").map(binding => binding.kind).sort()
    const usedKinds = new Set<string>()

    expect(approvedKinds).toHaveLength(14)

    Object.entries(earthquakeTemplateIconPlans).forEach(([templateId, plan]) => {
      if (plan.primary === "anomaly") { expect(plan.symbols).toEqual([]); return }
      expect(approvedKinds).toContain(plan.primary)
      expect(plan.symbols).toContain(plan.primary)
      expect(new Set(plan.symbols).size).toBe(plan.symbols.length)

      const primary = getEarthquakeTemplatePrimaryIcon(templateId as keyof typeof earthquakeTemplateIconPlans)
      const symbols = getEarthquakeTemplateSymbolBindings(templateId as keyof typeof earthquakeTemplateIconPlans)
      expect(primary.family).toBe("earthquake")
      expect(symbols.length).toBeGreaterThan(0)
      expect(symbols.every((binding) => binding.family === "earthquake")).toBe(true)
      expect(symbols.every((binding) => !!binding.standardAsset && !binding.legacy)).toBe(true)
      plan.symbols.forEach((kind) => usedKinds.add(kind))
    })

    expect([...usedKinds].every(kind => kind.startsWith("dbt-"))).toBe(true)
  })

  it("retains existing IconPark bindings for non-material UI icons and legacy symbols", () => {
    const bindings = [
      ...Object.values(basicTemplateIconByVisualKind),
      ...Object.values(categoryFallbackTemplateIcons),
      ...Object.values(earthquakeSymbolDefinitions).filter(binding => !binding.asset)
    ]

    bindings.forEach((binding) => {
      expect(typeof iconPark[toIconParkExportName(binding.icon) as keyof typeof iconPark], binding.icon).toBe("function")
    })
  })
})
