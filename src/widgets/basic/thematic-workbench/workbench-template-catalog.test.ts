import { describe, expect, it } from "vitest"
import type { ThematicTemplate } from "../dataset-repository/types/eoapi-types"
import { dbtTemplates } from "./dbt116-standard"
import { emergencyCatalog, getEmergencyCatalogEntry, getTemplatePurpose, mergeWorkbenchTemplateCatalog } from "./workbench-template-catalog"

const analysis: ThematicTemplate[] = Array.from({ length: 22 }, (_, i) => ({ templateId: `analysis-${i}`, templateVersion: "1.0", name: `Analysis ${i}`, parameters: [], createdAt: 1 }))

describe("unified workbench template catalog", () => {
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
    expect(emergencyCatalog.every(item => item.keywords.includes("制作要求报批稿"))).toBe(true)
  })
})
