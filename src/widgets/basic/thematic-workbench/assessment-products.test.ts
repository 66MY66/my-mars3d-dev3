import { describe, expect, it } from "vitest"
import { featureCollection, polygon, lineString, point } from "@turf/turf"
import { assessmentContracts, assessmentSourceIssue, recommendAssessment, type AssessmentKind } from "./assessment-products"
import { inspectJsonContent } from "./content-routing"
import { renderTemplateDocument, type TemplateDocument } from "./template-renderer"
import { replayExpression, expressionLayer } from "./expression-presentation"
import { businessResult, businessChartOption } from "./business-map-data"
import type { DbtLayer } from "./dbt116-standard"

const bounds = { west: 103, east: 105, south: 25, north: 27 }
function document(kind: AssessmentKind): TemplateDocument {
  const features = [0, 1].map(i => {
    const p = { building_id: `b${i}`, road_id: `r${i}`, hazard_id: `h${i}`, zone_id: `z${i}`, region_id: `a${i}`, damage_grade: i ? "D5" : "D1", hazard_type: i ? "崩塌" : "滑坡", status: "confirmed", intensity: 6 + i, loss_value: i ? 400 : 100 }
    const x = 103.2 + i * 0.7
    if (kind === "road-damage") { return lineString([[x, 25.3], [x + 0.3, 26.2]], p) }
    if (kind === "geological-disaster") { return point([x, 25.3], p) }
    return polygon([[[x, 25.3], [x + 0.4, 25.3], [x + 0.4, 26.2], [x, 26.2], [x, 25.3]]], p)
  })
  return { ...featureCollection(features), metadata: { source: "isolated unit-test fixture; not runtime data", observedAt: "2026-10-30T00:00:00Z", eventId: "fixture-event", assessment: "fixture assessment v1", gradeDefinition: [{ value: "D1", label: "来源等级一", order: 1, color: "#ffffcc" }, { value: "D5", label: "来源等级五", order: 5, color: "#b2182b" }], assessmentMethod: "remote-sensing", delineationCriteria: "fixture criteria", currencyUnit: "万元", priceBaseYear: 2020, lossScope: "direct" } }
}

describe("assessment product contracts", () => {
  it.each(Object.keys(assessmentContracts) as AssessmentKind[])("renders and replays %s without changing source data", async kind => {
    const input = document(kind); const before = JSON.stringify(input)
    expect(assessmentSourceIssue(input, kind)).toBe("")
    expect(recommendAssessment(inspectJsonContent(input), kind)).not.toBeNull()
    const scene = renderTemplateDocument(kind, input, bounds)
    expect(scene.kind).toBe(kind); expect(scene.features).toHaveLength(2)
    expect(scene.legend.length).toBeGreaterThan(0)
    const base = { id: "online:assessment", name: kind, role: "business", source: input.metadata.source, authority: "", crs: "CRS84", security: "", scale: 0, data: input } as DbtLayer
    base.onlineSource = { collection: "unit-fixture", itemId: "fixture", asset: "data", revision: "v1", fingerprint: "a".repeat(64), scope: bounds }
    const layer = expressionLayer(base, await businessResult(input, scene, bounds, {}))
    const expression = layer.onlineSource!.rendering!.parameters!.expression as any
    expect(replayExpression(input, bounds, expression)).toEqual(scene)
    expect(JSON.stringify(input)).toBe(before)
  })
  it("uses source damage meanings, order, colors and category counts", async () => {
    const input = document("building-damage"); const scene = renderTemplateDocument("building-damage", input, bounds)
    expect(scene.legend.map(row => row.label)).toEqual(["来源等级一", "来源等级五"])
    expect(scene.legend.map(row => row.color)).toEqual(["#ffffcc", "#b2182b"])
    const chart = businessChartOption(await businessResult(input, scene, bounds, {}), "bar") as any
    expect(chart.series[0].data.map((row: any) => row.value)).toEqual([1, 1])
    input.features[0].properties.damage_grade = "unknown"
    expect(() => renderTemplateDocument("building-damage", input, bounds)).toThrow("不在来源等级字典")
  })
  it("does not impose a new productType protocol but respects an explicit conflicting declaration", () => {
    const input = document("building-damage")
    expect(input.metadata.productType).toBeUndefined()
    expect(recommendAssessment(inspectJsonContent(input), "building-damage")).not.toBeNull()
    input.metadata.productType = "vulnerability"
    expect(recommendAssessment(inspectJsonContent(input), "building-damage")).toBeNull()
  })
  it.each(["potential", "unknown"])("does not label %s hazards as confirmed disaster", status => {
    const input = document("geological-disaster"); input.features[0].properties.status = status
    expect(recommendAssessment(inspectJsonContent(input), "geological-disaster")).toBeNull()
    expect(() => renderTemplateDocument("geological-disaster", input, bounds)).toThrow("仅接纳已核查")
  })
  it("does not accept generic intensity without remote assessment provenance", () => {
    const input = document("remote-intensity"); input.metadata.assessmentMethod = "instrumental"
    expect(recommendAssessment(inspectJsonContent(input), "remote-intensity")).toBeNull()
  })
  it("does not manufacture extreme zones from intensity values", () => {
    const input = document("extreme-zone"); delete input.metadata.delineationCriteria
    expect(recommendAssessment(inspectJsonContent(input), "extreme-zone")).toBeNull()
  })
  it("renders loss amounts by symbol area and preserves full administrative values after clipping", () => {
    const input = document("direct-loss"); const scene = renderTemplateDocument("direct-loss", input, { ...bounds, west: 103.3 })
    expect(scene.features.map(feature => feature.properties.value)).toEqual([100, 400])
    const sizes = scene.features.map(feature => feature.properties.pixelSize)
    expect(sizes[1] ** 2 / sizes[0] ** 2).toBeCloseTo(4)
    expect(scene.note).toContain("不输出本选区损失总额")
    input.metadata.lossScope = "GDP"
    expect(recommendAssessment(inspectJsonContent(input), "direct-loss")).toBeNull()
  })
  it("rejects unknown amounts and duplicate object identifiers", () => {
    const input = document("direct-loss"); input.features[0].properties.loss_value = null
    expect(() => renderTemplateDocument("direct-loss", input, bounds)).toThrow("缺少loss_value")
    const building = document("building-damage"); building.features[1].properties.building_id = "b0"
    expect(() => renderTemplateDocument("building-damage", building, bounds)).toThrow("稳定标识b0重复")
  })
})
