import { area, bbox, bboxClip, bboxPolygon, featureCollection, intersect, coordEach } from "@turf/turf"
import { validVectorGeometry } from "./geometry-validation"
import type { RemoteItem, RemoteAsset } from "./remote-cartography-source"
import type { RectInfo } from "./map"
import type { TemplateDocument, TemplateFeature } from "./template-renderer"
import { readBusinessDocument } from "./business-map-data"
import type { Feature, LineString, MultiLineString, Polygon, MultiPolygon } from "geojson"
import { basegeoFeatureSymbol, basegeoSchema, basegeoFallback, fallbackNames, nativeVectorPaint, vectorPaint } from "./cartography-vector-style"
import { dbtSymbolDefinitions, type DbtSymbolKind } from "./dbt116-symbols"

export const supplementalItemIds = ["SP-jiuzhaigou2017-intensity", "SP-china-active-faults", "SP-china-province-border", "SP-swchina-basegeo-250k", "SP-yunnan-buildings"]
export type SupplementalAdapter = "assessment-intensity" | "active-faults" | "admin-area" | "border-line" | "settlement-name" | "settlement-area" | "water-line" | "water-area" | "road-line" | "rail-line"
const codes: Partial<Record<SupplementalAdapter, string>> = { "admin-area": "BOUA", "border-line": "BOUL", "settlement-name": "AGNP", "settlement-area": "RESA", "water-line": "HYDL", "water-area": "HYDA", "road-line": "LRDL", "rail-line": "LRRL" }
export class EmptyScopedVectorError extends Error { readonly code = "EMPTY_SCOPED_VECTOR" }
export function isEmptyScopedVector(error: unknown): error is EmptyScopedVectorError { return !!error && typeof error === "object" && "code" in error && error.code === "EMPTY_SCOPED_VECTOR" }
export function supplementalItem(item: RemoteItem) { return item.collection === "spatial-thematic" && supplementalItemIds.includes(item.id) }
export function supplementalAssetBounds(key: string, asset?: RemoteAsset): RectInfo | undefined {
  if (asset?.["proj:bbox"]) {
    const box = asset["proj:bbox"]
    if (asset["proj:epsg"] !== 4326 || box.length !== 4 || !box.every(Number.isFinite) || box[0] < -180 || box[2] > 180 || box[1] < -90 || box[3] > 90 || box[0] >= box[2] || box[1] >= box[3]) { throw new Error("图幅资产覆盖坐标无效，需提供 EPSG:4326 的 proj:bbox；不猜测覆盖范围") }
    return { west: box[0], south: box[1], east: box[2], north: box[3] }
  }
  // The documented China basegeo archive groups data by 6° x 4° parent sheets.
  // Restrict the legacy fallback to non-polar northern sheets; explicit metadata wins.
  const match = /^([A-O])(\d{2})_(?:build|road)_/.exec(key)
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 60) { return }
  const west = (Number(match[2]) - 1) * 6 - 180; const south = (match[1].charCodeAt(0) - 65) * 4
  return { west, south, east: west + 6, north: south + 4 }
}
export function supplementalAssetKeys(item: RemoteItem) {
  if (!supplementalItem(item)) { return [] }
  if (item.id === "SP-jiuzhaigou2017-intensity") { return ["data", "auto_2h_initial", "auto_2h", "auto_6h", "auto_12h", "auto_1d", "auto_3d"].filter(key => item.assets[key]) }
  if (item.id === "SP-swchina-basegeo-250k") { return Object.keys(item.assets).filter(key => /^[A-O]\d{2}_build_(BOUA|BOUL|LRDL|LRRL|HYDA|HYDL|RESA|RESP|AGNP)$/.test(key)).sort((a, b) => b.slice(0, 3).localeCompare(a.slice(0, 3)) || a.localeCompare(b)) }
  return item.id === "SP-yunnan-buildings" ? [] : ["data"].filter(key => item.assets[key])
}
export function supplementalSheetKeys(item: RemoteItem, key: string, scope: RectInfo) {
  const code = key.match(/^[A-O]\d{2}_(?:build|road)_(\w+)$/)?.[1]
  if (item.id !== "SP-swchina-basegeo-250k" || !code) { return [key] }
  const family = key.split("_")[1]
  const keys = Object.keys(item.assets).filter(candidate => new RegExp(`^[A-O]\\d{2}_${family}_${code}$`).test(candidate)).sort((a, b) => b.slice(0, 3).localeCompare(a.slice(0, 3)) || a.localeCompare(b))
  return keys.filter(candidate => candidate.endsWith(`_${code}`) && (() => {
    const bounds = supplementalAssetBounds(candidate, item.assets[candidate])!
    return bounds.west < scope.east && bounds.east > scope.west && bounds.south < scope.north && bounds.north > scope.south
  })())
}
export function mergeSupplementalSheets(documents: TemplateDocument[], keys: string[], item?: RemoteItem): TemplateDocument {
  const features = documents.flatMap(document => document.features.map(feature => ({ ...feature, id: `${document.metadata.sourceAsset}:${feature.id ?? feature.properties.sourceFeatureId}`, properties: { ...feature.properties, sourceAsset: document.metadata.sourceAsset, sourceFeatureId: `${document.metadata.sourceAsset}:${feature.properties.sourceFeatureId}` } })))
  let vertices = 0; features.forEach(feature => coordEach(feature as Feature, () => { vertices++ }))
  if (features.length > 2000 || vertices > 250000) { throw new Error("拼接后的选区矢量超过 2000 要素或 25 万顶点，请缩小范围；未截断任何图幅") }
  const sourceCoverages = keys.flatMap(key => supplementalAssetBounds(key, item?.assets[key]) ? [supplementalAssetBounds(key, item?.assets[key])!] : [])
  const sourceBounds = sourceCoverages.length ? { west: Math.min(...sourceCoverages.map(c => c.west)), south: Math.min(...sourceCoverages.map(c => c.south)), east: Math.max(...sourceCoverages.map(c => c.east)), north: Math.max(...sourceCoverages.map(c => c.north)) } : undefined
  return {
 ...documents[0],
features,
metadata: {
 ...documents[0].metadata,
sourceAssets: keys,
sourceCoverages,
sourceBounds,
    sourceCount: documents.reduce((sum, doc) => sum + Number(doc.metadata.sourceCount || 0), 0),
    rejectedCount: documents.reduce((sum, doc) => sum + Number(doc.metadata.rejectedCount || 0), 0),
    rejectedFeatures: documents.flatMap(doc => (doc.metadata.rejectedFeatures || []).map((entry: any) => ({ ...entry, sourceAsset: doc.metadata.sourceAsset }))),
    normalizedFeatures: documents.flatMap(doc => (doc.metadata.normalizedFeatures || []).map((entry: any) => ({ ...entry, sourceAsset: doc.metadata.sourceAsset })))
  } 
}
}

// Clip source rings as lines: a clipped polygon's new rectangle edges are not real boundaries.
export function clippedSourceOutline(source: Feature<Polygon | MultiPolygon>, extent: [number, number, number, number]) {
  const rings = source.geometry.type === "Polygon" ? source.geometry.coordinates : source.geometry.coordinates.flat()
  const outline = bboxClip({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: rings } }, extent) as Feature<LineString | MultiLineString>
  // Turf reduces a single retained path to LineString, including fully enclosed rings.
  const lines = outline.geometry.type === "LineString" ? [outline.geometry.coordinates] : outline.geometry.coordinates
  return lines.filter(line => line.length >= 2 && line.some(c => c[0] !== line[0][0] || c[1] !== line[0][1]))
}

function withoutRepeatedVertices(source: TemplateFeature) {
  const prepared = structuredClone(source)
  let removed = 0
  const clean = (value: any): any => {
    if (!Array.isArray(value) || !value.length || typeof value[0] === "number") { return value }
    if (Array.isArray(value[0]) && typeof value[0][0] === "number") {
      return value.filter((position: number[], index: number) => {
        const previous = value[index - 1]
        const repeat = index > 0 && position.length === previous.length && position.every((v, i) => v === previous[i])
        if (repeat) { removed++ }
        return !repeat
      })
    }
    return value.map(clean)
  }
  prepared.geometry.coordinates = clean(prepared.geometry.coordinates)
  return { prepared, removed }
}

export function matchesSupplementalAsset(item: RemoteItem, key: string, adapter: string, bounds?: RectInfo | null) {
  if (!supplementalAssetKeys(item).includes(key)) { return false }
  const sheet = supplementalAssetBounds(key, item.assets[key])
  if (sheet && bounds && (sheet.west >= bounds.east || sheet.east <= bounds.west || sheet.south >= bounds.north || sheet.north <= bounds.south)) { return false }
  if (adapter === "assessment-intensity") { return item.id === "SP-jiuzhaigou2017-intensity" }
  if (adapter === "active-faults") { return item.id === "SP-china-active-faults" }
  if (adapter === "border-line" && item.id === "SP-china-province-border") { return true }
  return item.id === "SP-swchina-basegeo-250k" && !!codes[adapter as SupplementalAdapter] && key.endsWith(`_${codes[adapter as SupplementalAdapter]}`)
}
export function supplementalNotice(item: RemoteItem) {
  if (item.id === "SP-jiuzhaigou2017-intensity") { return "九寨沟评估矢量及分时次成果；发布烈度取自文件名或原始指标。缺评估方法、来源单位和版本，不能认定为正式调查等震线；随包事件参数不是正式目录事件。" }
  if (item.id === "SP-china-active-faults") { return "GMT 中国地理数据集 v0.4.0 全国汇编活动断层线，不是九寨沟专项调查。" }
  if (item.id === "SP-china-province-border") { return "全国国界与省界参考线，含南海相关要素；不是可直接统计的行政区面，不以线属性认定完整行政区划。" }
  if (item.id === "SP-swchina-basegeo-250k") { return "后台已发布图幅的 1:25 万基础地理；按选区拼接同类图幅，未发布区域不补造。原图年份未注明，无 DEM。PAC 为县级代码，GNID 注记点不等于乡镇或村界；退化几何会报告并排除。" }
  if (item.id === "SP-yunnan-buildings") { return "云南建筑仅提供 Shapefile 压缩包和说明；没有损毁类别或程度，当前不可直接叠加。" }
  return ""
}

export function readSupplementalVector(raw: any, item: RemoteItem, key: string, scope: RectInfo): TemplateDocument {
  if (raw?.type !== "FeatureCollection" || !Array.isArray(raw.features) || raw.features.length > 50000) { throw new Error("后台矢量结构无效或源要素超过 50000，请后端按范围提供") }
  const rejected: Array<{ id: string; reason: string }> = []; let outside = 0; let vertices = 0
  const normalized: Array<{ id: string; removedVertices: number }> = []
  const features: TemplateFeature[] = []
  const extent: [number, number, number, number] = [scope.west, scope.south, scope.east, scope.north]
  const clipArea = bboxPolygon(extent)
  for (const [index, source] of raw.features.entries()) {
    const id = String(source?.id ?? source?.properties?.OBJECTID ?? index)
    try {
      if (source.type !== "Feature" || !source.geometry || !source.properties || !["Point", "LineString", "MultiLineString", "Polygon", "MultiPolygon"].includes(source.geometry.type)) { throw new Error("几何或属性无效") }
      coordEach(source, c => { if (!Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) { throw new Error("经纬度无效") } })
      const box = bbox(source)
      if (box[0] > scope.east || box[2] < scope.west || box[1] > scope.north || box[3] < scope.south) { outside++; continue }
      const polygonal = /Polygon$/.test(source.geometry.type)
      if (polygonal && (box[0] === box[2] || box[1] === box[3] || area(source) <= 0)) { throw new Error("图幅边缘退化面") }
      const { prepared, removed } = withoutRepeatedVertices(source)
      if (!validVectorGeometry(prepared)) { throw new Error("源几何拓扑无效，未自动修复") }
      if (removed) { normalized.push({ id, removedVertices: removed }) }
      const linesHaveLength = (lines: number[][][]) => lines.some(line => line.some(c => c[0] !== line[0][0] || c[1] !== line[0][1]))
      if (/LineString$/.test(source.geometry.type) && !linesHaveLength(source.geometry.type === "LineString" ? [source.geometry.coordinates] : source.geometry.coordinates)) { throw new Error("退化线") }
      let clipped: TemplateFeature | null = prepared
      if (!(box[0] >= scope.west && box[2] <= scope.east && box[1] >= scope.south && box[3] <= scope.north)) {
        clipped = (polygonal ? intersect(featureCollection([prepared as Feature<Polygon | MultiPolygon>, clipArea])) : bboxClip(prepared as any, extent)) as TemplateFeature | null
        if (!clipped) { outside++; continue }
        clipped.properties = { ...source.properties }
      }
      const geometry = clipped.geometry
      if (geometry.type === "MultiPolygon") { geometry.coordinates = geometry.coordinates.filter((rings: any) => rings[0]?.length >= 4 && area({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: rings } }) > 0) }
      if (!geometry.coordinates.length) { outside++; continue }
      if (/Polygon$/.test(geometry.type) && area(clipped) <= 0) { outside++; continue }
      if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
        const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates
        if (!linesHaveLength(lines)) { outside++; continue }
      }
      if (!validVectorGeometry(clipped)) { throw new Error("裁切后几何无效") }
      let count = 0; coordEach(clipped, () => { count++ })
      vertices += count; clipped.properties = { ...clipped.properties, sourceFeatureId: id }
      if (polygonal && (key.endsWith("_BOUA") || item.id === "SP-jiuzhaigou2017-intensity")) { clipped.properties.cartographyOutline = clippedSourceOutline(prepared as Feature<Polygon | MultiPolygon>, extent) }
      features.push(clipped)
    } catch (error) { rejected.push({ id, reason: error instanceof Error ? error.message : "源几何无效" }) }
    if (features.length > 2000 || vertices > 250000) { throw new Error("选区矢量超过 2000 要素或 25 万顶点，请缩小框选范围；未截断图层") }
  }
  if (!features.length && !rejected.length) { throw new EmptyScopedVectorError("后台文件读取正常，当前框选范围内没有对应矢量要素") }
  if (!features.length) { throw new Error(`选区内没有有效矢量要素（退化或无效 ${rejected.length} 个）`) }
  const multipleAssessmentFaces = item.id === "SP-jiuzhaigou2017-intensity" && key.startsWith("auto_") && raw.features.length > new Set(raw.features.map((feature: any) => feature?.properties?.intensity ?? feature?.properties?.INTY ?? feature?.properties?.INTENSITY)).size
  const assessmentWarning = multipleAssessmentFaces ? "该时次包含多个同级评估面，接口未提供方案或批次字段。仅按原始面参考显示，不自动合并或选定最终分区。" : ""
  const sourceBounds = supplementalAssetBounds(key, item.assets[key])
  return readBusinessDocument({ type: "FeatureCollection", features, metadata: { ...raw.metadata, source: item.assets[key].href, crs: "EPSG:4326", usage: "reference", referenceOnly: true, collection: item.collection, itemId: item.id, sourceAsset: key, revisionId: item.properties.updated || "", notice: supplementalNotice(item), assessmentWarning, sourceCount: raw.features.length, outsideCount: outside, rejectedCount: rejected.length, rejectedFeatures: rejected, normalizedFeatures: normalized, sourceBounds, sourceCoverages: sourceBounds ? [sourceBounds] : undefined, scaleDenominator: item.id === "SP-swchina-basegeo-250k" ? 250000 : undefined } }, item.properties.title, { maxFeatures: 2000, maxVertices: 250000 })
}

export function presentSupplementalVector(item: RemoteItem, key: string, document: TemplateDocument) {
  const intensity = item.id === "SP-jiuzhaigou2017-intensity"
  const point = key.endsWith("_AGNP") || key.endsWith("_RESP")
  const outlineOnly = intensity || item.id === "SP-china-active-faults" || item.id === "SP-china-province-border" || /_(BOUA|BOUL|LRDL|LRRL|HYDL)$/.test(key)
  let color = "#465866"
  if (intensity) { color = "#ee1c25" } else if (item.id === "SP-china-active-faults") { color = "#b3323b" } else if (/_HYD[AL]$/.test(key)) { color = "#438fc0" } else if (/_LRDL$/.test(key)) { color = "#ac6940" }
  const sourceKeys = document.metadata.sourceAssets as string[] | undefined
  const sheetNames: Record<string, string> = { BOUA: "行政区面", BOUL: "行政区界线", LRDL: "公路", LRRL: "铁路", HYDA: "水面", HYDL: "河流", RESA: "居民地面", RESP: "居民地点", AGNP: "居民地名称" }
  const label = sourceKeys && sourceKeys.length > 1 ? `${sourceKeys.map(asset => asset.split("_")[0]).join(" / ")} ${sheetNames[key.split("_").at(-1)!]}` : String(item.assets[key].title || key)
  const styled: TemplateDocument = {
    ...document,
    features: document.features.map(feature => {
    const properties = feature.properties
    const degree = properties.intensity ?? properties.INTY ?? properties.INTENSITY
    if (intensity && (!Number.isInteger(degree) || degree < 1 || degree > 12)) { throw new Error("烈度要素缺少有效的后台烈度值，未按位置推算") }
    const name = String(properties.NAME || properties.FN_Ch || properties.RN || "")
    let kind: DbtSymbolKind | undefined
    if (item.id === "SP-swchina-basegeo-250k") { kind = basegeoFeatureSymbol(key, properties) }
    if (intensity) { kind = "dbt-isoseismal" }
    if (item.id === "SP-china-active-faults") { kind = "dbt-fault" }
    const fallback = basegeoFallback(key, properties)
    const paint = vectorPaint(kind, fallback)
    return { ...feature, properties: { ...properties, ...(intensity ? { intensity: degree } : {}), ...(key.endsWith("_AGNP") ? { annotationOnly: true } : {}), cartographyKind: kind, cartographySchema: basegeoSchema, cartographyFallback: fallback, cartographyLine: outlineOnly || /LineString$/.test(feature.geometry.type), color: paint.fill || paint.color, label: intensity ? `${["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ", "Ⅺ", "Ⅻ"][degree - 1]}度` : name, name } }
    })
  }
  const mapDocument: TemplateDocument = { ...styled, features: styled.features.map(feature => Array.isArray(feature.properties.cartographyOutline) ? { ...feature, geometry: { type: "MultiLineString" as const, coordinates: feature.properties.cartographyOutline } } : feature).filter(feature => feature.geometry.type !== "MultiLineString" || feature.geometry.coordinates.length > 0) }
  const lineOnly = mapDocument.features.every(feature => /LineString$/.test(feature.geometry.type))
  const kinds = [...new Map(styled.features.map(feature => [feature.properties.cartographyKind || feature.properties.cartographyFallback, { kind: feature.properties.cartographyKind as DbtSymbolKind | undefined, fallback: feature.properties.cartographyFallback as string }])).values()]
  const legend = key.endsWith("_AGNP")
? []
: kinds.map(({ kind, fallback }) => {
    const paint = vectorPaint(kind, fallback)
    const definition = kind && dbtSymbolDefinitions[kind]
    return { kind, label: definition ? `${definition.shortLabel}${intensity ? "（评估）" : ""}` : fallbackNames[fallback] || `${sheetNames[key.split("_").at(-1)!] || label}（未分级参考）`, color: paint.fill || paint.color, shape: outlineOnly || lineOnly ? "line" as const : "area" as const, styleKey: fallback }
  })
  return {
 document: styled,
mapDocument,
color,
label,
legend,
symbol: {
    ...(point ? { type: "point" } : {}),
    styleOptions: { color, fill: !outlineOnly, opacity: key.endsWith("_AGNP") ? 0 : 1, width: 2, outline: !point && !lineOnly, ...(lineOnly ? { closure: false } : {}), outlineColor: color, outlineWidth: 1.5, pixelSize: key.endsWith("_AGNP") ? 1 : 5, clampToGround: true },
    callback: (attr: Record<string, unknown>) => nativeVectorPaint(vectorPaint(String(attr.cartographyKind || ""), String(attr.cartographyFallback || "")), attr.cartographyLine === true)
  } 
}
}
