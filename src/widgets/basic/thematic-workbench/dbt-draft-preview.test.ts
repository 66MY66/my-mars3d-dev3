import { describe, expect, it } from "vitest"
import { emptyDbtDocument, dbtTemplates, standardBounds, inspectDbtDocument } from "./dbt116-standard"
import { draftRequirements } from "./dbt-draft-preview"

describe("Standard draft preview remains separate from business data", () => {
  it("lists the appropriate data requirements for every template without populating fake layers", () => {
    const doc = emptyDbtDocument()
    const before = JSON.stringify(doc)
    for (const template of dbtTemplates) {
      const required = draftRequirements(doc, template.id)
      expect(required.map(item => item.role)).toEqual(["intensity", ...template.roles])
      expect(required.every(item => !item.present && item.label)).toBe(true)
      expect(standardBounds(doc, template.id)).toBeNull()
      expect(inspectDbtDocument(doc, template.id).some(item => item.severity === "error")).toBe(true)
    }
    expect(JSON.stringify(doc)).toBe(before)
  })
  it("does not count empty or hidden layers as available thematic data", () => {
    const doc = emptyDbtDocument()
    doc.layers.push({ id: "pop", name: "population", role: "population", authority: "", publishedAt: "", source: "", crs: "EPSG:4490", security: "", scale: 1000000, data: { type: "FeatureCollection", features: [] } })
    const population = () => draftRequirements(doc, "T30102000").find(item => item.role === "population")!
    expect(population().present).toBe(false)
    doc.layers[0].data.features.push({ type: "Feature", geometry: { type: "Point", coordinates: [106, 29] }, properties: { population: 10 } })
    expect(population().present).toBe(true)
    doc.layers[0].enabled = false
    expect(population().present).toBe(false)
  })
})
