import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { dbtTemplates, readDbtDocument, inspectDbtDocument, standardBounds, intensityThreshold, intensityLabel, dbtVisibleLayers, dbtTitle } from "./dbt116-standard"
import { jpegWithDpi } from "./dbt116-export"
import { area, bboxPolygon } from "@turf/turf"
import { dbtRegion, dbtMapCode, intensityBands, dbtStatistics, coversBounds } from "./dbt-cartography-rules"
import { CARTOGRAPHY_RULESET } from "./cartography-standards"
const fixture = () => readDbtDocument(JSON.parse(readFileSync(resolve("public/data/dbt116-test/T30101000.json"), "utf8")))
describe("Emergency cartography pre-adoption and DB/T 101 classification", () => {
  it("retains explicit derived layers in reference compositions without adding them to formal product roles", () => {
    const doc = fixture(); const layer = { ...doc.layers[0], id: "derived", role: "business" }; doc.layers.push(layer)
    doc.usage = "reference"
    expect(dbtVisibleLayers(doc, "T30102000")).toContain(layer)
    doc.usage = "operational"
    expect(dbtVisibleLayers(doc, "T30102000")).not.toContain(layer)
  })
  it("records a versioned pre-adoption profile rather than claiming certified published compliance", () => {
    expect(CARTOGRAPHY_RULESET.id).toBe("earthquake-response-dbt116-2026.pre-adoption.v2")
    expect(CARTOGRAPHY_RULESET.symbolEffectiveDate).toBe("2026-12-01")
    expect(CARTOGRAPHY_RULESET.title).toContain("提前采用")
    expect(CARTOGRAPHY_RULESET.adoption).toContain("not-product-certification")
  })
  it("accepts terrain, settlement and rescue-road instances without unrelated thematic layers", () => {
    for (const [instance, role] of [["01", "dem"], ["03", "settlement"], ["05", "transport"]]) {
      const doc = fixture()
      doc.classification = { instance, spatial: "6" }
      doc.layers = doc.layers.filter(layer => [role, "intensity", "boundary", "water"].includes(layer.role))
      const issues = inspectDbtDocument(doc, "T30203000")
      expect(dbtVisibleLayers(doc, "T30203000").some(layer => layer.role === role)).toBe(true)
      expect(issues.some(issue => /缺少该模板所需专题数据|实例代码所指专题数据未显示/.test(issue.message))).toBe(false)
      // Source and formal event checks remain active for this synthetic test fixture.
      expect(issues.some(issue => issue.message.includes("禁止正式出图"))).toBe(true)
    }
  })
  it("allows a distance map without stations but does not treat an ordinary road basemap as a distance map", () => {
    const doc = fixture()
    doc.layers = doc.layers.filter(layer => layer.role !== "station")
    expect(inspectDbtDocument(doc, "T30101000").some(issue => issue.message.includes("缺少该模板所需专题数据"))).toBe(false)
    doc.layers = doc.layers.filter(layer => layer.role !== "distance")
    expect(inspectDbtDocument(doc, "T30101000").some(issue => issue.message.includes("缺少该模板所需专题数据"))).toBe(true)
  })
  it("does not let a PGA-only map pass as a disaster-reduction capacity instance", () => {
    const doc = fixture()
    doc.layers = doc.layers.filter(layer => !["capacity", "supplies", "refuge"].includes(layer.role))
    doc.classification = { instance: "01", spatial: "6" }
    expect(inspectDbtDocument(doc, "T30202000").some(issue => issue.message.includes("不能仅用地震动参数区划替代"))).toBe(true)
    doc.classification.instance = "02"
    expect(inspectDbtDocument(doc, "T30202000").some(issue => issue.message.includes("不能仅用地震动参数区划替代"))).toBe(false)
  })
  it("does not count zero opacity layers as visible mandatory content", () => {
    const doc = fixture(); doc.layers.forEach(layer => { if (layer.role === "population") { layer.opacity = 0 } })
    expect(dbtVisibleLayers(doc, "T30102000").some(layer => layer.role === "population")).toBe(false)
  })
  it("has six category codes and matching mandatory roles", () => {
    expect(dbtTemplates).toHaveLength(6)
    expect(new Set(dbtTemplates.map(item => item.id)).size).toBe(6)
    const doc = fixture()
    expect(dbtVisibleLayers(doc, "T30102000").some(layer => layer.role === "population")).toBe(true)
    expect(dbtVisibleLayers(doc, "T30102000").some(layer => layer.role === "rescue-area")).toBe(false)
  })
  it("selects VI/V/highest/VIII intensity by table 2 and buffers extent", () => {
    const doc = fixture()
    expect(intensityThreshold(doc, "T30101000")).toBe(6)
    const bounds = standardBounds(doc, "T30101000")!
    expect((bounds.west + bounds.east) / 2).toBe(doc.event.longitude)
    expect(bounds.east).toBeGreaterThan(106.9)
    doc.event.magnitude = 6.4
    expect(intensityThreshold(doc, "T30101000")).toBe(5)
    expect(intensityThreshold(doc, "T30201000")).toBe(6)
    expect(intensityThreshold(doc, "T30203000")).toBe(8)
    doc.layers.find(layer => layer.role === "intensity")!.data.features.forEach(feature => { feature.properties!.intensity = 4 })
    expect(intensityThreshold(doc, "T30101000")).toBe(4)
    expect(standardBounds(doc, "T30201000")).toBeNull()
  })
  it("never permits synthetic data, non-CGCS2000 or missing references to pass", () => {
    const doc = fixture()
    expect(inspectDbtDocument(doc, "T30101000").some(item => item.message.includes("禁止正式出图"))).toBe(true)
    doc.crs = "CRS84"
    expect(inspectDbtDocument(doc, "T30101000").some(item => item.clause === "4.9")).toBe(true)
    doc.event.bulletin = ""
    expect(inspectDbtDocument(doc, "T30101000").some(item => item.clause === "4.6")).toBe(true)
  })
  it("rejects invalid coordinates, unsupported symbols and duplicate layer ids", () => {
    const doc = fixture(); doc.layers[1].id = doc.layers[0].id
    expect(() => readDbtDocument(doc)).toThrow()
    const bad = fixture(); bad.layers[0].data.features[0].properties!.symbol = "made-up"
    expect(() => readDbtDocument(bad)).toThrow()
    const geo = fixture(); geo.event.longitude = Infinity
    expect(() => readDbtDocument(geo)).toThrow()
  })
  it("uses both Roman and Arabic intensity labels", () => {
    expect(intensityLabel(7)).toBe("Ⅶ度(7度)")
    expect(intensityLabel(7.5)).toBe("")
  })
  it("names the selected instance in the title without inventing missing event facts", () => {
    const doc = fixture()
    for (const [id, instance, name] of [["T30101000", "02", "震中与主要城市距离"], ["T30103000", "01", "医院"], ["T30103000", "04", "桥梁"], ["T30202000", "02", "地震动参数区划"], ["T30203000", "02", "遥感影像"], ["T30203000", "05", "救灾道路"]] as const) {
      doc.classification = { instance, spatial: "6" }
      expect(dbtTitle(doc, id)).toContain(name)
      expect(dbtTitle(doc, id)).toContain(doc.event.place)
    }
    doc.event.time = ""; doc.event.place = ""; doc.event.magnitude = 0
    expect(dbtTitle(doc, "T30101000")).toContain("[发震日期] [震中地名] [震级]")
  })
  it("encodes instance and spatial scope independently", () => {
    expect(dbtMapCode("T30102000", "01", "6")).toBe("T30102016")
    expect(() => dbtMapCode("T30201000", "03", "6")).toThrow()
    expect(() => dbtMapCode("T30201000", "00", "8")).toThrow()
    const doc = fixture(); doc.classification = { instance: "03", spatial: "6" }
    expect(inspectDbtDocument(doc, "T30102000").some(i => i.message.includes("实例代码所指专题数据未显示"))).toBe(true)
  })
  it("derives table 1 region including sparse prefectures and offshore", () => {
    expect(dbtRegion("四川省", "阿坝藏族羌族自治州")).toBe("R1")
    expect(dbtRegion("四川省", "成都市")).toBe("R2")
    expect(dbtRegion("四川省", "")).toBeNull()
    expect(dbtRegion("内蒙古自治区", "")).toBe("R1")
    expect(dbtRegion("福建省", "", true)).toBe("R3")
    expect(dbtRegion("虚构省", "")).toBeNull()
  })
  it("does not double count nested intensity areas", () => {
    const doc = fixture(); const layer = doc.layers.find(l => l.role === "intensity")!
    const outer = bboxPolygon([105, 28, 107, 30], { properties: { intensity: 6, zonePopulation: 100 } })
    const inner = bboxPolygon([105.5, 28.5, 106.5, 29.5], { properties: { intensity: 7, zonePopulation: 50 } })
    layer.data.features = [outer, inner]
    const bands = intensityBands([layer])
    expect(bands.reduce((sum, b) => sum + b.areaKm2, 0)).toBeCloseTo(area(outer) / 1e6, 5)
    expect(bands.map(b => b.population)).toEqual([50, 100])
    delete layer.data.features[0].properties!.zonePopulation
    expect(intensityBands([layer])[1].population).toBeNull()
  })
  it("clips offshore intensity to supplied land and requires land", () => {
    const doc = fixture(); doc.region.zone = "R3"
    expect(standardBounds(doc, "T30201000")).toBeNull()
    const land = { ...doc.layers[0], id: "land", role: "land", data: { type: "FeatureCollection" as const, features: [bboxPolygon([105.8, 28.8, 106.2, 29.2])] } }
    doc.layers.push(land)
    expect(standardBounds(doc, "T30201000")!.east).toBeLessThan(106.5)
  })
  it("uses geographic coverage rather than image stretching", () => {
    const doc = fixture(); const bounds = standardBounds(doc, "T30101000")!
    expect((bounds.east - bounds.west) / (bounds.north - bounds.south)).toBeCloseTo(1076 / 802, 8)
    expect(coversBounds({ west: 105.9, south: 28.9, east: 106.1, north: 29.1 }, bounds)).toBe(false)
  })
  it("does not let hidden mandatory layers or renamed synthetic sources pass", () => {
    const doc = fixture(); doc.usage = "operational"
    doc.layers.find(l => l.role === "intensity")!.enabled = false
    expect(inspectDbtDocument(doc, "T30102000").some(i => i.message.includes("不可隐藏"))).toBe(true)
    expect(inspectDbtDocument(doc, "T30102000").some(i => i.message.includes("测试来源"))).toBe(true)
  })
  it("reports numeric population and category counts, not map pixels", () => {
    const doc = fixture()
    expect(dbtStatistics(doc, "T30102000", doc.layers)[0].value).toBe(4600)
    expect(dbtStatistics(doc, "T30103000", doc.layers).map(row => row.label)).toEqual(["医院", "学校", "机场"])
  })
  it("writes JFIF resolution in dots per inch and forbids below 300", () => {
    const bytes = new Uint8Array([255, 216, 255, 217])
    const result = jpegWithDpi(bytes, 300)
    expect(result[13]).toBe(1)
    expect(new DataView(result.buffer).getUint16(14)).toBe(300)
    expect(new DataView(result.buffer).getUint16(16)).toBe(300)
    expect(() => jpegWithDpi(bytes, 96)).toThrow()
    expect(jpegWithDpi(result, 600)).toHaveLength(result.length)
  })
})
