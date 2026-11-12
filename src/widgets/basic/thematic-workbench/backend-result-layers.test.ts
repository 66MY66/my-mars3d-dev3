import { describe, expect, it } from "vitest"
import { backendResultKind, backendResultFields, presentBackendResult } from "./backend-result-layers"
import { matchesWorkflowItem, workflowMissing, workflowRequirements } from "./cartography-workflow"
import { remoteLayerAssets, type RemoteItem } from "./remote-cartography-source"
import type { TemplateDocument } from "./template-renderer"

const item: RemoteItem = { type: "Feature", id: "background", collection: "thermal-background", bbox: [103, 35, 105, 37], properties: { "background:field_type": "insar", "background:samples": 1 }, assets: { grid: { href: "http://192.168.10.15:9002/rs-products/background/grid.geojson", type: "application/geo+json" }, data: { href: "http://192.168.10.15:9002/rs-products/background/data.tif", type: "image/tiff" } } }
const document = { type: "FeatureCollection", metadata: { source: "backend" }, features: [-2, 0, 2].map((mean, i) => ({ type: "Feature", id: i, properties: { mean, std: 0, count: 1, latest: mean }, geometry: { type: "Polygon", coordinates: [[[103, 35], [104, 35], [104, 36], [103, 36], [103, 35]]] } })) } as TemplateDocument
describe("real backend results as operator map layers", () => {
  it("selects the actual statistical grid, not an undecoded three-band background image", () => {
    expect(remoteLayerAssets(item).map(asset => [asset.key, asset.kind])).toEqual([["grid", "vector"], ["data", "raster"]])
    expect(backendResultKind(item)).toBe("insar-background")
    expect(backendResultFields(item).map(field => field.key)).toEqual(["mean", "std", "count", "latest"])
  })
  it("keeps exact source geometry and values with matching print/map colors", () => {
    const original = structuredClone(document)
    const result = presentBackendResult(item, document, "mean", "fill")
    expect(document).toEqual(original)
    result.document.features.forEach((feature, i) => {
      expect(feature.geometry).toEqual(original.features[i].geometry)
      expect(feature.properties.mean).toBe(original.features[i].properties.mean)
      expect(result.symbol.callback(feature.properties).color).toBe(feature.properties.color)
    })
    expect(result.document.features[1].properties.color).toBe("#f7f7f7")
    expect(result.legend).toHaveLength(3)
  })
  it("shows the supplied sample count without inventing a historical baseline", () => {
    const result = presentBackendResult(item, document, "count")
    expect(result.legend).toHaveLength(1)
    expect(result.legend[0].label).toContain("参与样本数")
    expect(workflowMissing("insar-deformation", ["background"])).toContain("LOS 位移与相干性")
    expect(workflowMissing("thermal-infrared", ["background", "anomaly", "lst"])).toContain("历史基线与异常判定依据")
  })
  it("does not substitute an anomaly intensity field for earthquake intensity", () => {
    const anomaly = { ...item, collection: "thermal-anomaly", properties: { "result:type": "thermal_anomaly" } }
    expect(backendResultFields(anomaly).map(field => field.key)).not.toContain("intensity")
    expect(() => presentBackendResult(anomaly, document, "intensity")).toThrow("未声明")
    expect(matchesWorkflowItem(anomaly, "thermal-anomaly")).toBe(true)
    expect(matchesWorkflowItem(anomaly, "insar-background")).toBe(false)
  })
  it("preserves the precision of constant and narrowly spaced backend metrics", () => {
    const anomaly = { ...item, collection: "thermal-anomaly", properties: { "result:type": "thermal_anomaly" } }
    const constant = { ...document, features: [{ ...document.features[0], properties: { alice: 1.661 } }] }
    expect(presentBackendResult(anomaly, constant, "alice").legend[0].label).toBe("后台异常指数 1.661 无量纲")
    const narrow = { ...document, features: [1.66100001, 1.66100002].map(alice => ({ ...document.features[0], properties: { alice } })) }
    expect(presentBackendResult(anomaly, narrow, "alice").legend[0].label).toBe("后台异常指数 [1.66100001, 1.661000015] 无量纲")
    const zero = { ...document, features: [{ ...document.features[0], properties: { mean: 0 } }] }
    expect(presentBackendResult(item, zero, "mean", "fill").legend).toEqual([{ label: "背景均值 0 原始值", color: "#f7f7f7" }])
  })
  it("defaults coarse single-scene background to outlines and raw readings, never a fabricated anomaly", () => {
    const thermal = { ...item, properties: { "background:field_type": "thermal", "background:grid_size_deg": 1, "background:samples": 1 } }
    const result = presentBackendResult(thermal, document, "mean")
    expect(result.symbol.styleOptions.fill).toBe(false)
    expect(result.document.features.map(feature => feature.properties.label)).toEqual(["-2", "0", "2"])
    expect(result.legend[0]).toMatchObject({ shape: "line" })
    expect(result.note).toContain("原始网格 1°；选区 3 格；1 景样本")
    expect(result.note).toContain("不能计算时间基线异常")
    expect(result.unit).toBe("原始值")
    expect(result.document.metadata.backendResultPresentation).toMatchObject({ kind: "thermal-background", display: "grid", field: "mean" })
    expect(result.document.features.map(feature => feature.geometry)).toEqual(document.features.map(feature => feature.geometry))
    const filled = presentBackendResult(thermal, document, "mean", "fill")
    expect(filled.symbol.styleOptions.fill).toBe(true)
    expect(filled.document.features.every(feature => feature.properties.color !== "#b10026")).toBe(true)
    expect(filled.document.metadata.backendResultPresentation.display).toBe("fill")
  })
  it("refuses invalid metrics and unsupported PNG georeferencing without hiding catalog usage labels", () => {
    expect(() => presentBackendResult(item, { ...document, features: [{ ...document.features[0], properties: { mean: null } }] }, "mean")).toThrow("不会补零")
    expect(() => presentBackendResult(item, { ...document, features: [{ ...document.features[0], properties: { count: -1 } }] }, "count")).toThrow("样本数")
    expect(matchesWorkflowItem({ ...item, properties: { ...item.properties, usage: "demo" } }, "insar-background")).toBe(true)
    expect(backendResultKind({ ...item, collection: "thematic-map", properties: { "result:type": "visualization" } })).toBeNull()
    expect(remoteLayerAssets({ ...item, collection: "thematic-map", properties: {}, assets: { data: { href: "http://192.168.10.15:9002/rs-products/image.png", type: "image/png" } } })).toEqual([])
  })
  it("accepts actual archived grids while preserving formal missing requirements", () => {
    const archived = { ...item, collection: "thematic-map", assets: { data: item.assets.grid } }
    expect(matchesWorkflowItem(archived, "result-layer")).toBe(true)
    expect(remoteLayerAssets(archived)[0].key).toBe("data")
    expect(workflowRequirements("thermal-infrared").filter(entry => entry.adapter).map(entry => entry.adapter)).toContain("thermal-anomaly")
  })
})
