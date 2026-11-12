import { describe, expect, it } from "vitest"
import type { ThematicTemplate } from "../dataset-repository/types/eoapi-types"
import { dbtTemplates } from "./dbt116-standard"
import { emergencyCatalog, getEmergencyCatalogEntry, getTemplatePurpose, mergeWorkbenchTemplateCatalog, groupTemplateCatalog, productExpressionIds, matchesCatalogProduct, templateTier, templateProfessionalIdentity, productCatalog } from "./workbench-template-catalog"

const analysis: ThematicTemplate[] = Array.from({ length: 22 }, (_, i) => ({ templateId: `analysis-${i}`, templateVersion: "1.0", name: `Analysis ${i}`, parameters: [], createdAt: 1 }))

describe("unified workbench template catalog", () => {
  it("only presents business products in the main catalog while retaining tools in the registry", () => {
    const catalog = mergeWorkbenchTemplateCatalog(["standard_choropleth", "standard_unique_value", "standard_risk_overlay", "earthquake_insar_deformation"].map(templateId => ({ ...analysis[0], templateId })))
    expect(productCatalog(catalog)).toHaveLength(7)
    expect(productCatalog(catalog).some(entry => entry.templateId.startsWith("standard_"))).toBe(false)
    expect(catalog).toHaveLength(10)
  })
  it("combines all six emergency topics with existing analysis identities", () => {
    const catalog = mergeWorkbenchTemplateCatalog(analysis)
    expect(catalog).toHaveLength(28)
    expect(new Set(catalog.map(item => item.templateId)).size).toBe(28)
    expect(catalog.filter(item => getTemplatePurpose(item) === "emergency")).toHaveLength(6)
    expect(catalog.filter(item => getTemplatePurpose(item) === "analysis")).toEqual(analysis)
    expect(catalog[6]).toBe(analysis[0])
  })
  it("routes emergency identities to the existing standard contracts, not similar names", () => {
    emergencyCatalog.forEach((item, i) => {
      expect(getEmergencyCatalogEntry(item)?.emergencyId).toBe(dbtTemplates[i].id)
      expect(item.keywords).toContain(dbtTemplates[i].id)
      expect(item.components.length).toBeGreaterThan(0)
    })
    expect(getEmergencyCatalogEntry({ ...analysis[0], name: dbtTemplates[0].name } as ThematicTemplate)).toBeUndefined()
  })
  it("protects emergency topics from remote catalog identity collisions", () => {
    const remote = { ...analysis[0], templateId: emergencyCatalog[0].templateId, name: "Remote replacement" }
    const catalog = mergeWorkbenchTemplateCatalog([...analysis, remote])
    expect(catalog).toHaveLength(28)
    expect(catalog[0].name).toBe(dbtTemplates[0].name)
    expect(analysis).toHaveLength(22)
  })
  it("keeps emergency topics available without the remote analysis catalog", () => {
    expect(mergeWorkbenchTemplateCatalog([])).toEqual(emergencyCatalog)
    expect(emergencyCatalog.find(item => item.emergencyId === "T30203000")?.dataTypes).toContain("raster")
    expect(emergencyCatalog.every(item => item.keywords.includes("DB/T 116-2026"))).toBe(true)
  })
  it("separates business products from reusable expression methods without removing unready entries", () => {
    const names = ["earthquake_insar_deformation", "standard_raster_ramp", "standard_choropleth", "standard_graduated_symbol"]
    const catalog = mergeWorkbenchTemplateCatalog(names.map(templateId => ({ ...analysis[0], templateId })))
    expect(groupTemplateCatalog(catalog).map(group => [group.id, group.items.length])).toEqual([["emergency", 6], ["remote", 1], ["expression", 3]])
    const product = emergencyCatalog.find(item => item.emergencyId === "T30102000")!
    expect(productExpressionIds(product)).toContain("standard_graduated_symbol")
    expect(matchesCatalogProduct({ templateId: "standard_raster_ramp" }, product.templateId, catalog)).toBe(true)
    expect(matchesCatalogProduct({ templateId: "earthquake_insar_deformation" }, product.templateId, catalog)).toBe(false)
    expect(matchesCatalogProduct(product, product.templateId, catalog)).toBe(true)
  })
  it("uses code-backed product families without calling a method an industry product", () => {
    const entry = (templateId: string) => ({ templateId })
    expect(templateTier(entry("earthquake_thermal_infrared"))).toBe("remote")
    expect(templateProfessionalIdentity(entry("earthquake_insar_deformation")).code).toBe("T10805000")
    expect(templateProfessionalIdentity(entry("earthquake_building_resilience")).code).toBe("T20302000")
    expect(templateProfessionalIdentity(entry("earthquake_post_quake_risk")).code).toBe("T20303000")
    for (const id of ["standard_risk_overlay", "earthquake_anomaly_composite", "remote-unknown"]) {
      expect(templateTier(entry(id))).toBe("auxiliary")
      expect(templateProfessionalIdentity(entry(id)).code).toBe("")
    }
    expect(getTemplatePurpose(entry("standard_choropleth"))).toBe("expression")
    expect(getTemplatePurpose(entry("standard_risk_overlay"))).toBe("analysis")
    expect(templateProfessionalIdentity(entry("standard_point_heat")).badge).toBe("表达方法")
  })
  it("retains deferred products independently of backend availability without declaring a false standard identity", () => {
    for (const templateId of ["earthquake_swarm_trajectory", "earthquake_intensity_distribution", "earthquake_secondary_hazard"]) {
      expect(getTemplatePurpose({ templateId })).toBe("deferred")
      expect(templateProfessionalIdentity({ templateId }).badge).toBe("扩展预留")
    }
    expect(templateProfessionalIdentity({ templateId: "earthquake_intensity_distribution" }).code).toBe("")
    expect(templateProfessionalIdentity({ templateId: "earthquake_secondary_hazard" }).code).toBe("")
  })
  it("does not pair road status with water flow or assessed intensity with generic interpolation", () => {
    expect(productExpressionIds({ templateId: "earthquake_emergency_command" })).not.toContain("standard_flow_direction")
    expect(productExpressionIds({ templateId: "emergency:T30201000" })).not.toContain("standard_contour")
    expect(productExpressionIds({ templateId: "earthquake_swarm_trajectory" })).not.toContain("standard_trajectory_replay")
  })
})
