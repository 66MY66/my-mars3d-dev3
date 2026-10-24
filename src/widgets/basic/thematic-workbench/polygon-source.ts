import { bbox, bboxClip, featureCollection, booleanValid } from "@turf/turf"
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson"
import type { GeoBounds } from "./earthquake-analysis"
import type { DisplayPolygon } from "./display-model"
import { interpolateColor } from "./render-style"

type PolygonFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>
type PolygonDocument = FeatureCollection<Polygon | MultiPolygon, Record<string, unknown>>

function isCoordinate(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number" &&
    Number.isFinite(value[0]) && Number.isFinite(value[1]) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90
}

export function readPolygonDocument(input: unknown, includeCategories = false): { document: PolygonDocument; fields: string[] } {
  if (!input || typeof input !== "object" || (input as any).type !== "FeatureCollection" || !Array.isArray((input as any).features)) {
    throw new Error("请选择 GeoJSON FeatureCollection 文件")
  }
  const features = (input as any).features as unknown[]
  if (!features.length || features.length > 500) { throw new Error("面要素数量应为 1-500 个") }
  let vertices = 0
  const parsed: PolygonFeature[] = features.map((raw, index) => {
    const item = raw as PolygonFeature
    const geometry = item?.geometry
    if (item?.type !== "Feature" || !geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) { throw new Error(`第 ${index + 1} 个要素不是 Polygon/MultiPolygon`) }
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
    if (!polygons.length) { throw new Error(`第 ${index + 1} 个要素没有面坐标`) }
    for (const rings of polygons) {
      if (!rings.length) { throw new Error(`第 ${index + 1} 个要素没有外环`) }
      for (const ring of rings) {
        vertices += ring.length
        if (ring.length < 4 || !ring.every(isCoordinate) || ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
          throw new Error(`第 ${index + 1} 个要素的坐标无效或环未闭合；请使用 WGS84 经纬度`)
        }
      }
    }
    if (vertices > 20000) { throw new Error("顶点数超过 20000，请先简化面数据") }
    if (!booleanValid(item)) { throw new Error(`第 ${index + 1} 个面要素自相交或拓扑无效`) }
    return item
  })
  const fields = [...new Set(parsed.flatMap((item) => Object.entries(item.properties || {}).filter(([, value]) => (typeof value === "number" && Number.isFinite(value)) || (includeCategories && typeof value === "string" && value.trim())).map(([key]) => key)))].sort()
  if (!fields.length) { throw new Error("GeoJSON 缺少数值属性，无法映射挤出高度") }
  return { document: featureCollection(parsed), fields }
}

export function clipPolygons(document: PolygonDocument, field: string, bounds: GeoBounds): DisplayPolygon[] {
  if (!(bounds.west < bounds.east && bounds.south < bounds.north)) { throw new Error("请先锁定有效的框选范围") }
  const candidates: Array<{ rings: number[][][]; value: number; label: string }> = []
  for (const feature of document.features) {
    const value = feature.properties?.[field]
    if (typeof value !== "number" || !Number.isFinite(value)) { continue }
    const extent = bbox(feature)
    if (extent[2] < bounds.west || extent[0] > bounds.east || extent[3] < bounds.south || extent[1] > bounds.north) { continue }
    const clipped = bboxClip(feature, [bounds.west, bounds.south, bounds.east, bounds.north])
    const polygons: number[][][][] = clipped.geometry.type === "Polygon"
      ? [clipped.geometry.coordinates as number[][][]]
      : clipped.geometry.coordinates as number[][][][]
    for (const rings of polygons) {
      if (rings[0]?.length >= 4) { candidates.push({ rings, value, label: String(feature.properties?.name || feature.id || field) }) }
    }
  }
  if (!candidates.length) { throw new Error("锁定范围内没有含该数值字段的面要素") }
  const values = candidates.map((item) => item.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  return candidates.map(({ rings, value, label }) => ({
    rings,
    value,
    label,
    band: `${field}: ${value}`,
    color: interpolateColor("#217f99", "#dc7b38", max === min ? 0.5 : (value - min) / (max - min))
  }))
}
