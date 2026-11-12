import { describe, expect, it } from "vitest"
import { demonstrationSource } from "./cartography-provenance"
import { emptyDbtDocument, inspectDbtDocument, type DbtLayer } from "./dbt116-standard"
describe("whole publication package provenance", () => {
  it("distinguishes explicit demo provenance from ordinary latest dataset paths", () => {
    for (const value of ["https://source/latest/event", "latest-dataset", "正式资料 非涉密"]) { expect(demonstrationSource(value)).toBe(false) }
    for (const value of ["FY3_DEMO", "test-data", "synthetic_map", "演示批量导入", "本地测试景"]) { expect(demonstrationSource(value)).toBe(true) }
  })
  it("checks hidden layers for restricted and demo data before archiving", () => {
    const doc = emptyDbtDocument(); doc.usage = "operational"
    const layer: DbtLayer = { id: "hidden", name: "隐藏业务层", role: "target", enabled: false, authority: "来源机构", source: "https://source/latest/targets", publishedAt: "2026-10-30", security: "restricted", crs: "EPSG:4490", scale: 100000, data: { type: "FeatureCollection", features: [] } }
    doc.layers.push(layer)
    expect(inspectDbtDocument(doc, "T30102000").some(issue => issue.message.includes("隐藏图层也不得"))).toBe(true)
    layer.security = "public"; layer.source = "https://source/DEMO/targets"
    expect(inspectDbtDocument(doc, "T30102000").some(issue => issue.message.includes("隐藏后作为正式数据"))).toBe(true)
    layer.source = "https://source/latest/targets"
    expect(inspectDbtDocument(doc, "T30102000").some(issue => issue.message.includes("为测试来源"))).toBe(false)
  })
  it("does not treat a fault-zone polygon as a formal active-fault line", () => {
    const doc = emptyDbtDocument()
    doc.layers.push({ id: "fault", name: "断层资料", role: "fault", authority: "来源机构", source: "https://source/faults", publishedAt: "2026-10-30", security: "public", crs: "EPSG:4490", scale: 100000, data: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[102, 26], [103, 26], [103, 27], [102, 26]]] }, properties: { label: "范围面" } }] } })
    expect(inspectDbtDocument(doc, "T30201000").some(issue => issue.message.includes("不能用断裂带范围面替代"))).toBe(true)
  })
})
