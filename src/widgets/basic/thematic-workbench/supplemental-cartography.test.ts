import { describe, expect, it } from "vitest"
import { workflowRequirements, matchesWorkflowItem, workflowAssets, workflowMissing } from "./cartography-workflow"
import { remoteLayerAssets, remoteItemNotice, type RemoteItem } from "./remote-cartography-source"
import { supplementalAssetKeys, supplementalAssetBounds, presentSupplementalVector, readSupplementalVector, EmptyScopedVectorError, supplementalSheetKeys, mergeSupplementalSheets } from "./supplemental-cartography"
import { dbtStatistics } from "./dbt-cartography-rules"
import { emptyDbtDocument, inspectDbtDocument } from "./dbt116-standard"

const scope = { west: 103, south: 32.5, east: 104.5, north: 34 }
function item(id: string, keys = ["data"]): RemoteItem {
  return { type: "Feature", id, collection: "spatial-thematic", bbox: [102, 28, 108, 36], properties: { title: id, "proj:epsg": 4326 }, assets: Object.fromEntries(keys.map(key => [key, { href: `http://192.168.10.15:9002/rs-products/spatial/${id}/${key}.geojson`, type: "application/geo+json", title: key }])) }
}
const polygon = { type: "Feature", properties: { INTY: 7 }, geometry: { type: "Polygon", coordinates: [[[103.5, 33], [104, 33], [104, 33.5], [103.5, 33.5], [103.5, 33]]] } }
const collection = (features: unknown[]) => ({ type: "FeatureCollection", features })

describe("supplemental backend data from colleague interface list", () => {
  it.each(["HYDL", "LRDL", "LRRL", "BOUL"])("accepts a documented %s multi-line asset containing one valid path", (code) => {
    const key = `I48_build_${code}`
    const source = item("SP-swchina-basegeo-250k", [key])
    const coordinates = [[103.2, 33.1], [103.8, 33.3], [104.2, 33.6]]
    const feature = { type: "Feature", properties: { NAME: "真实线路", GB: code === "HYDL" ? 210101 : 420201 }, geometry: { type: "MultiLineString", coordinates: [coordinates] } }
    const raw = collection([feature])
    const document = readSupplementalVector(raw, source, key, scope)
    expect(document.features).toHaveLength(1)
    expect(document.features[0].geometry).toEqual(feature.geometry)
    expect(document.metadata.rejectedCount).toBe(0)
    expect(raw.features[0]).toEqual(feature)
  })
  it("clips a single-path multi-line and still rejects collapsed paths", () => {
    const key = "I48_build_HYDL"
    const source = item("SP-swchina-basegeo-250k", [key])
    const line = (coordinates: number[][]) => ({ type: "Feature", properties: { GB: 210101 }, geometry: { type: "MultiLineString", coordinates: [coordinates] } })
    const document = readSupplementalVector(collection([line([[102, 33], [105, 33]]), line([[104, 33], [104, 33]])]), source, key, scope)
    expect(document.features).toHaveLength(1)
    expect(document.features[0].geometry.coordinates).toEqual([[scope.west, 33], [scope.east, 33]])
    expect(document.metadata.rejectedCount).toBe(1)
  })
  it("normalizes only exact consecutive duplicate vertices without dropping a valid area or changing the source", () => {
    const source = item("SP-swchina-basegeo-250k", ["I48_build_BOUA"])
    const repeated = { ...polygon, id: "repeated", geometry: { type: "Polygon", coordinates: [[[103.5, 33], [104, 33], [104, 33], [104, 33.5], [103.5, 33.5], [103.5, 33], [103.5, 33]]] } }
    const raw = collection([repeated]); const original = structuredClone(raw)
    const document = readSupplementalVector(raw, source, "I48_build_BOUA", scope)
    expect(raw).toEqual(original)
    expect(document.features[0].geometry).toEqual(polygon.geometry)
    expect(document.metadata.normalizedFeatures).toEqual([{ id: "repeated", removedVertices: 2 }])
    expect(document.metadata.rejectedCount).toBe(0)
  })
  it("discovers future published adjacent sheets without hardcoding H48 or I48", () => {
    const source = item("SP-swchina-basegeo-250k", ["G48_build_BOUA", "H48_build_BOUA", "H49_build_BOUA", "G48_road_BOUA"])
    expect(supplementalSheetKeys(source, "H48_build_BOUA", { west: 107.5, south: 27.5, east: 108.5, north: 28.5 })).toEqual(["H49_build_BOUA", "H48_build_BOUA", "G48_build_BOUA"])
    expect(supplementalAssetBounds("G48_build_BOUA")).toEqual({ west: 102, south: 24, east: 108, north: 28 })
    const explicit = { href: "https://example.invalid/source", "proj:epsg": 4326, "proj:bbox": [103, 27, 104, 29] }
    expect(supplementalAssetBounds("H48_build_BOUA", explicit)).toEqual({ west: 103, south: 27, east: 104, north: 29 })
    expect(() => supplementalAssetBounds("H48_build_BOUA", { ...explicit, "proj:epsg": 3857 })).toThrow("不猜测")
    expect(supplementalAssetBounds("unknown")).toBeUndefined()
  })
  it("joins intersecting sheets, retains provenance and namespaces identical feature IDs", () => {
    const source = item("SP-swchina-basegeo-250k", ["I48_build_BOUA", "H48_build_BOUA"])
    const crossed = { west: 103, south: 31.5, east: 104, north: 32.5 }
    const keys = supplementalSheetKeys(source, "H48_build_BOUA", crossed)
    expect(keys).toEqual(["I48_build_BOUA", "H48_build_BOUA"])
    const north = { ...polygon, id: 1, geometry: { type: "Polygon", coordinates: [[[103.2, 32.1], [103.8, 32.1], [103.8, 32.4], [103.2, 32.1]]] } }
    const south = { ...polygon, id: 1, geometry: { type: "Polygon", coordinates: [[[103.2, 31.6], [103.8, 31.6], [103.8, 31.9], [103.2, 31.6]]] } }
    const merged = mergeSupplementalSheets([readSupplementalVector(collection([north]), source, keys[0], crossed), readSupplementalVector(collection([south]), source, keys[1], crossed)], keys)
    expect(new Set(merged.features.map(f => f.id)).size).toBe(2)
    expect(merged.metadata.sourceAssets).toEqual(keys)
    expect(merged.metadata.sourceCoverages).toHaveLength(2)
    expect(merged.metadata.sourceBounds).toEqual({ west: 102, south: 28, east: 108, north: 36 })
  })
  it("does not invent a boundary along the rectangle when clipping a source polygon", () => {
    const source = item("SP-swchina-basegeo-250k", ["I48_build_BOUA"])
    const raw = collection([{ ...polygon, geometry: { type: "Polygon", coordinates: [[[102, 32], [105, 32], [105, 35], [102, 35], [102, 32]]] } }])
    const document = readSupplementalVector(raw, source, "I48_build_BOUA", scope)
    expect(document.features).toHaveLength(1)
    expect(document.features[0].geometry.type).toBe("Polygon")
    expect(document.features[0].properties.cartographyOutline).toEqual([])
    expect(presentSupplementalVector(source, "I48_build_BOUA", document).mapDocument.features).toEqual([])
  })
  it("keeps a single fully enclosed source ring after Turf normalizes it to LineString", () => {
    const source = item("SP-jiuzhaigou2017-intensity")
    const coordinates = [[103.2, 33.1], [103.8, 33.1], [103.8, 33.6], [103.2, 33.6], [103.2, 33.1]]
    const raw = collection([{ ...polygon, properties: { INTY: 7 }, geometry: { type: "Polygon", coordinates: [coordinates] } }])
    const document = readSupplementalVector(raw, source, "data", scope)
    expect(document.features[0].properties.cartographyOutline).toEqual([coordinates])
    const result = presentSupplementalVector(source, "data", document)
    expect(result.mapDocument.features).toHaveLength(1)
    expect(result.mapDocument.features[0].geometry).toEqual({ type: "MultiLineString", coordinates: [coordinates] })
  })
  it("keeps a single clipped source boundary without joining along the selection edge", () => {
    const source = item("SP-swchina-basegeo-250k", ["I48_build_BOUA"])
    const raw = collection([{ ...polygon, geometry: { type: "Polygon", coordinates: [[[102, 32], [103.5, 32], [103.5, 35], [102, 35], [102, 32]]] } }])
    const document = readSupplementalVector(raw, source, "I48_build_BOUA", scope)
    expect(document.features[0].properties.cartographyOutline).toEqual([[[103.5, scope.south], [103.5, scope.north]]])
    expect(presentSupplementalVector(source, "I48_build_BOUA", document).mapDocument.features).toHaveLength(1)
  })
  it("treats annotation anchor points as labels rather than invented settlement dots", () => {
    const source = item("SP-swchina-basegeo-250k", ["I48_build_AGNP"])
    const document = readSupplementalVector(collection([{ type: "Feature", properties: { NAME: "真实地名" }, geometry: { type: "Point", coordinates: [104, 33] } }]), source, "I48_build_AGNP", scope)
    const style = presentSupplementalVector(source, "I48_build_AGNP", document)
    expect(style.document.features[0].properties.annotationOnly).toBe(true)
    expect(style.symbol.styleOptions.opacity).toBe(0)
    expect(style.document.features[0].properties.label).toBe("真实地名")
  })
  it("does not apply polygon-style outlines or close disconnected provincial boundary paths", () => {
    const source = item("SP-china-province-border")
    const coordinates = [[[103, 33], [104, 33.5]], [[104.2, 33.7], [104.4, 33.8]]]
    const document = readSupplementalVector(collection([{ type: "Feature", properties: { NAME: "界线" }, geometry: { type: "MultiLineString", coordinates } }]), source, "data", scope)
    const result = presentSupplementalVector(source, "data", document)
    expect(result.symbol.styleOptions).toMatchObject({ outline: false, closure: false })
    expect(result.mapDocument.features[0].geometry.coordinates).toEqual(coordinates)
  })
  it("exposes real assessment times without treating MapGIS or an event note as a map layer", () => {
    const source = item("SP-jiuzhaigou2017-intensity", ["data", "auto_2h_initial", "auto_2h", "auto_6h", "auto_12h", "auto_1d", "auto_3d", "mapgis", "event_note"])
    source.assets.mapgis = { href: "http://192.168.10.15:9002/rs-products/intensity_mapgis.rar", type: "application/octet-stream" }
    source.assets.event_note = { href: "http://192.168.10.15:9002/rs-products/event_note.png", type: "image/png" }
    expect(remoteLayerAssets(source).map(asset => asset.key)).toEqual(["data", "auto_2h_initial", "auto_2h", "auto_6h", "auto_12h", "auto_1d", "auto_3d"])
    expect(matchesWorkflowItem(source, "assessment-intensity")).toBe(true)
    expect(matchesWorkflowItem(source, "population")).toBe(false)
    expect(remoteItemNotice(source)).toContain("不能认定为正式调查")
  })
  it("filters by role and intersecting sheet, omitting byte-identical road copies", () => {
    const source = item("SP-swchina-basegeo-250k", ["data", "I48_build_BOUA", "I48_build_LRDL", "I48_road_LRDL", "H48_build_LRDL", "I48_build_AGNP"])
    expect(supplementalAssetKeys(source)).not.toContain("I48_road_LRDL")
    expect(workflowAssets(source, "road-line", scope).map(asset => asset.key)).toEqual(["I48_build_LRDL"])
    expect(workflowAssets(source, "admin-area", scope).map(asset => asset.key)).toEqual(["I48_build_BOUA"])
    expect(workflowAssets(source, "water-line", scope)).toEqual([])
  })
  it("keeps multiple same-level assessment faces intact and exposes their missing scenario grouping", () => {
    const source = item("SP-jiuzhaigou2017-intensity", ["data", "auto_2h"])
    const raw = collection([polygon, structuredClone(polygon)])
    const document = readSupplementalVector(raw, source, "auto_2h", scope)
    expect(document.features).toHaveLength(2)
    expect(document.metadata.assessmentWarning).toContain("未提供方案或批次")
    expect(readSupplementalVector(collection([polygon]), source, "data", scope).metadata.assessmentWarning).toBe("")
  })
  it("retains the true source values and geometry and does not manufacture formal event fields", () => {
    const source = item("SP-jiuzhaigou2017-intensity")
    const raw = collection([structuredClone(polygon)])
    const before = structuredClone(raw)
    const document = readSupplementalVector(raw, source, "data", scope)
    const result = presentSupplementalVector(source, "data", document)
    expect(raw).toEqual(before)
    expect(result.document.features[0].geometry).toEqual(polygon.geometry)
    expect(result.document.features[0].properties).toMatchObject({ INTY: 7, intensity: 7, label: "Ⅶ度" })
    expect(result.symbol.styleOptions.fill).toBe(false)
    expect(document.metadata.referenceOnly).toBe(true)
    expect(workflowMissing("T30201000", ["intensity", "fault"])).toContain("地震事件参数")
    expect(workflowRequirements("T30201000").find(entry => entry.key === "event")?.adapter).toBe("event-parameters")
  })
  it("scopes before applying the local feature budget instead of rejecting a national source", () => {
    const source = item("SP-china-active-faults")
    const outside = Array.from({ length: 2100 }, () => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[110, 30], [111, 31]] } }))
    const inside = { type: "Feature", properties: { FN_Ch: "源断层名" }, geometry: { type: "LineString", coordinates: [[103.1, 33], [104, 33.2]] } }
    const document = readSupplementalVector(collection([...outside, inside]), source, "data", scope)
    expect(document.features).toHaveLength(1)
    expect(document.metadata).toMatchObject({ sourceCount: 2101, outsideCount: 2100, rejectedCount: 0 })
    expect(presentSupplementalVector(source, "data", document).document.features[0].properties.label).toBe("源断层名")
  })
  it("reports degenerate source geometry rather than drawing it or repairing it silently", () => {
    const source = item("SP-swchina-basegeo-250k", ["I48_build_BOUA"])
    const degenerate = { ...polygon, id: "edge", geometry: { type: "Polygon", coordinates: [[[103, 33], [103, 33], [103, 33], [103, 33]]] } }
    const document = readSupplementalVector(collection([degenerate, polygon, null]), source, "I48_build_BOUA", scope)
    expect(document.features).toHaveLength(1)
    expect(document.metadata.rejectedCount).toBe(2)
    expect(document.metadata.rejectedFeatures[0]).toMatchObject({ id: "edge", reason: "图幅边缘退化面" })
    expect(document.metadata.scaleDenominator).toBe(250000)
  })
  it("does not render archives, add missing damage fields or coerce unknown intensity", () => {
    const buildings = item("SP-yunnan-buildings")
    buildings.assets.data = { href: "http://192.168.10.15:9002/rs-products/buildings.zip", type: "application/zip" }
    expect(remoteLayerAssets(buildings)).toEqual([])
    expect(matchesWorkflowItem(buildings, "admin-area")).toBe(false)
    const intensity = item("SP-jiuzhaigou2017-intensity")
    const document = readSupplementalVector(collection([{ ...polygon, properties: { INTY: "7" } }]), intensity, "data", scope)
    expect(() => presentSupplementalVector(intensity, "data", document)).toThrow("后台烈度值")
  })
  it("refuses an oversized AOI instead of silently truncating or inventing values", () => {
    const source = item("SP-swchina-basegeo-250k", ["I48_build_AGNP"])
    const points = Array.from({ length: 2001 }, (_, i) => ({ type: "Feature", properties: { NAME: `点${i}` }, geometry: { type: "Point", coordinates: [103.5, 33] } }))
    expect(() => readSupplementalVector(collection(points), source, "I48_build_AGNP", scope)).toThrow("未截断")
  })
  it("correctly splits concave geometry and distinguishes no intersection from source defects", () => {
    const source = item("SP-jiuzhaigou2017-intensity")
    const concave = { ...polygon, geometry: { type: "Polygon", coordinates: [[[103, 33], [104, 33], [104, 34], [103.7, 34], [103.7, 33.3], [103.3, 33.3], [103.3, 34], [103, 34], [103, 33]]] } }
    const result = readSupplementalVector(collection([concave]), source, "data", { west: 103, south: 33.5, east: 104, north: 33.9 })
    expect(result.features[0].geometry.type).toBe("MultiPolygon")
    expect(result.metadata.rejectedCount).toBe(0)
    const triangle = { ...polygon, geometry: { type: "Polygon", coordinates: [[[103, 33], [104, 33], [103, 34], [103, 33]]] } }
    expect(() => readSupplementalVector(collection([triangle]), source, "data", { west: 103.9, south: 33.9, east: 104, north: 34 })).toThrow(EmptyScopedVectorError)
  })
  it("does not turn unverified online assessment fragments into formal impact statistics", () => {
    const doc = emptyDbtDocument(); doc.usage = "reference"
    const layer = { role: "intensity", onlineSource: { itemId: "SP-jiuzhaigou2017-intensity" }, data: collection([{ ...polygon, properties: { intensity: 7 } }]) } as any
    const statistics = dbtStatistics(doc, "T30201000", [layer])
    expect(statistics.map(row => row.label)).toEqual(["最高评估烈度", "选区评估要素数"])
    expect(statistics[0].value).toBe(7)
    expect(statistics[1].note).toContain("不计算正式影响面积")
    doc.layers = [{ ...layer, id: "online:assessment", name: "评估分区", data: collection(Array.from({ length: 120 }, () => structuredClone(layer.data.features[0]))) }]
    expect(inspectDbtDocument(doc, "T30201000").some(issue => issue.message.includes("zonePopulation"))).toBe(true)
    doc.layers[0].data.features.forEach(feature => { feature.properties!.zonePopulation = 0 })
    expect(inspectDbtDocument(doc, "T30201000").some(issue => issue.message.includes("zonePopulation"))).toBe(false)
  })
})
