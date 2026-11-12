import { describe, expect, it } from "vitest"
import { structuredFlowSchema, validateFlowParameters, orderedFlowFields } from "./flow-parameters"
const schema = { type: "object", required: ["source"], properties: { source: { type: "string" }, bbox: { type: "array", items: { type: "number" } }, limit: { type: "integer" }, start: { type: "string" }, end: { type: "string" }, export: { type: "string", enum: ["", "csv"] } } }
describe("Windmill structured business parameters", () => {
  it("validates types required fields bounds dates and limits before sending", () => {
    const errors = validateFlowParameters("search_flow", { source: " ", bbox: [100, 30, 99, 31], limit: 1.5, start: "2026-10-30", end: "2026-09-30", export: "png" }, schema)
    expect(errors.join(" ")).toMatch(/必填/); expect(errors.join(" ")).toMatch(/范围/); expect(errors.join(" ")).toMatch(/integer/); expect(errors.join(" ")).toMatch(/晚于/); expect(errors.join(" ")).toMatch(/选项/)
    expect(validateFlowParameters("search_flow", { source: "STAC", bbox: [100, 30, 101, 31], limit: 100, export: "" }, schema)).toEqual([])
  })
  it("does not silently replace optional numeric zero or boolean false", () => {
    expect(validateFlowParameters("search_flow", { n: 0, enabled: false }, { properties: { n: { type: "number" }, enabled: { type: "boolean" } } })).toEqual([])
    expect(validateFlowParameters("search_flow", { n: null }, { properties: { n: { type: "number" } } })[0]).toContain("number")
  })
  it("retains every backend grid mode and event control without rewriting the source contract", () => {
    const original = { properties: { coverage: { type: "string", enum: ["national", "event"] }, epicenter_lon: { type: "number" }, file_path: { type: "string" } }, order: ["epicenter_lon", "file_path", "coverage"] }
    const result = structuredFlowSchema("grid_layer_flow", original)
    expect(orderedFlowFields(result)).toEqual(["epicenter_lon", "file_path", "coverage"])
    expect(result.properties?.coverage.enum).toEqual(["national", "event"]); expect(result).toEqual(original)
    expect(validateFlowParameters("grid_layer_flow", { coverage: "event", epicenter_lon: 103.82 }, original)).toEqual([])
  })
  it("requires actual nonempty business payloads for writes", () => {
    expect(validateFlowParameters("result_flow", { receive_type: "manual", result_data: {} }, {}).join(" ")).toContain("空成果")
    expect(validateFlowParameters("stac_flow", { action: "update", update: {} }, {}).join(" ")).toContain("非空")
    expect(validateFlowParameters("stac_flow", { action: "query", query: {} }, {})).toEqual([])
  })
  it("expands only documented model parameters and rejects invalid nested extents", () => {
    const s = { properties: { thresholds: { type: "object" } } }
    expect(validateFlowParameters("background_flow", { thresholds: { region_bbox: [100, 30, 102], duration_days: 0 } }, s).join(" ")).toContain("范围")
    expect(validateFlowParameters("background_flow", { thresholds: { region_bbox: [100, 30, 102, 32], duration_days: 3 }, submit_anomaly: false }, s)).toEqual([])
  })
  it("does not overwrite backend field ranges nested schemas or new operation choices", () => {
    const s = { properties: { limit: { type: "integer", maximum: 50000 }, thresholds: { type: "object", properties: { future_model: { type: "number" } } } } }
    expect(structuredFlowSchema("background_flow", s)).toEqual(s)
    expect(validateFlowParameters("search_flow", { limit: 20000 }, s)).toEqual([])
    expect(validateFlowParameters("stac_flow", { action: "delete", item_id: "id" }, { properties: { action: { type: "string", enum: ["query", "delete"] }, item_id: { type: "string" } } })).toEqual([])
  })
})
