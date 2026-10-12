/**
 * 上下文检测工具
 * 用于判断右键点击的对象类型
 */
import * as mars3d from "mars3d"
import type { ContextType, MarkerType } from "./types"

const Cesium = mars3d.Cesium

/** 判断图形类型 */
export function getGraphicType(graphic: any): MarkerType | null {
  if (!graphic) {
    return null
  }

  const type = String(graphic.type || "").toLowerCase()

  if (type.includes("point") || type.includes("billboard")) {
    return "point"
  }
  if (type.includes("label") || type.includes("text")) {
    return "label"
  }
  if (type.includes("polyline") || type.includes("line")) {
    return "polyline"
  }
  if (type.includes("polygon") || type.includes("area")) {
    return "polygon"
  }
  if (type.includes("rectangle")) {
    return "rectangle"
  }
  if (type.includes("circle")) {
    return "circle"
  }

  return null
}

/** 判断是否为告警对象 */
export function isAlertObject(graphic: any): boolean {
  if (!graphic) {
    return false
  }
  const attr = graphic.attr || graphic.properties || {}
  return !!(attr.alertType || attr.alertId || attr.alert_status || attr.alertStatus)
}

/** 判断是否为 graphicLayer 中的标记对象 */
export function isMarkerGraphic(graphic: any, map: mars3d.Map): boolean {
  if (!graphic || !map) {
    return false
  }

  const graphicLayer = map.graphicLayer
  if (!graphicLayer) {
    return false
  }

  // 检查图形是否属于 graphicLayer
  if (graphic._layer === graphicLayer || graphic.layer === graphicLayer) {
    return true
  }

  // 通过 ID 检查
  if (graphic.id != null && typeof graphicLayer.getGraphicById === "function") {
    return graphicLayer.getGraphicById(graphic.id) != null
  }

  return false
}

/** 判断是否为测量结果 */
export function isMeasureGraphic(graphic: any, map: mars3d.Map): boolean {
  if (!graphic) {
    return false
  }

  // 测量结果通常有特定的属性
  if (graphic.attr?.measure === true || graphic._measure === true) {
    return true
  }

  // 检查是否属于测量图层
  const measure = (map as any).thing?.measure
  if (measure && graphic._layer === measure) {
    return true
  }

  return false
}

/** 检测右键上下文类型 */
export function detectContext(e: any, map: mars3d.Map): {
  type: ContextType
  graphic?: any
  layer?: any
} {
  const graphic = e?.graphic
  const layer = e?.layer

  // 1. 检查是否为告警对象
  if (graphic && isAlertObject(graphic)) {
    return { type: "alert", graphic }
  }

  // 2. 检查是否为测量结果
  if (graphic && isMeasureGraphic(graphic, map)) {
    return { type: "measure", graphic }
  }

  // 3. 检查是否为标记对象
  if (graphic && isMarkerGraphic(graphic, map)) {
    return { type: "marker", graphic }
  }

  // 4. 检查是否为图层对象（非 graphicLayer）
  if (layer && layer !== map.graphicLayer) {
    return { type: "layer", layer }
  }

  // 5. 默认为空白处
  return { type: "blank" }
}

/** 获取图形中心点坐标 */
export function getGraphicCenter(graphic: any): { lng: number; lat: number; alt?: number } | null {
  if (!graphic) {
    return null
  }

  try {
    // 尝试获取位置
    if (graphic.position) {
      const pt = mars3d.LngLatPoint.fromCartesian(graphic.position)
      return { lng: pt.lng, lat: pt.lat, alt: pt.alt }
    }

    // 尝试获取中心点
    if (graphic.center) {
      const pt = mars3d.LngLatPoint.fromCartesian(graphic.center)
      return { lng: pt.lng, lat: pt.lat, alt: pt.alt }
    }

    // 从坐标数组计算中心
    const coords = graphic.coord || graphic.coordinates || graphic.positions
    if (Array.isArray(coords) && coords.length > 0) {
      let sumLng = 0
      let sumLat = 0
      let count = 0

      for (const c of coords) {
        if (Array.isArray(c) && c.length >= 2 && typeof c[0] === "number") {
          sumLng += c[0]
          sumLat += c[1]
          count++
        } else if (c && typeof c.x === "number") {
          // Cartesian3
          const pt = mars3d.LngLatPoint.fromCartesian(c)
          sumLng += pt.lng
          sumLat += pt.lat
          count++
        }
      }

      if (count > 0) {
        return { lng: sumLng / count, lat: sumLat / count }
      }
    }

    return null
  } catch {
    return null
  }
}

/** 获取线长度（米） */
export function getLineLength(graphic: any): number | null {
  if (!graphic) {
    return null
  }

  try {
    if (typeof graphic.distance === "number") {
      return graphic.distance
    }

    const positions = graphic.positions || graphic.coordinates
    if (!Array.isArray(positions) || positions.length < 2) {
      return null
    }

    let totalDistance = 0
    for (let i = 0; i < positions.length - 1; i++) {
      totalDistance += mars3d.MeasureUtil.getDistance(positions[i], positions[i + 1])
    }

    return totalDistance
  } catch {
    return null
  }
}

/** 获取面面积（平方米） */
export function getPolygonArea(graphic: any): number | null {
  if (!graphic) {
    return null
  }

  try {
    if (typeof graphic.area === "number") {
      return graphic.area
    }

    const positions = graphic.positions || graphic.coordinates
    if (!Array.isArray(positions) || positions.length < 3) {
      return null
    }

    return mars3d.MeasureUtil.getArea(positions)
  } catch {
    return null
  }
}

/** 获取图形的环坐标 */
export function getGraphicRing(graphic: any): Array<[number, number]> | null {
  if (!graphic) {
    return null
  }

  try {
    const coords = graphic.coord || graphic.coordinates || graphic.positions
    if (!Array.isArray(coords) || coords.length < 3) {
      return null
    }

    const ring: Array<[number, number]> = []

    for (const c of coords) {
      if (Array.isArray(c) && c.length >= 2 && typeof c[0] === "number") {
        ring.push([c[0], c[1]])
      } else if (c && typeof c.x === "number") {
        // Cartesian3
        const pt = mars3d.LngLatPoint.fromCartesian(c)
        ring.push([pt.lng, pt.lat])
      }
    }

    return ring.length >= 3 ? ring : null
  } catch {
    return null
  }
}

/** 获取线的起点和终点坐标 */
export function getLineEndpoints(graphic: any): { start: { lng: number; lat: number }; end: { lng: number; lat: number } } | null {
  if (!graphic) {
    return null
  }

  try {
    const positions = graphic.positions || graphic.coordinates
    if (!Array.isArray(positions) || positions.length < 2) {
      return null
    }

    const startPt = mars3d.LngLatPoint.fromCartesian(positions[0])
    const endPt = mars3d.LngLatPoint.fromCartesian(positions[positions.length - 1])

    return {
      start: { lng: startPt.lng, lat: startPt.lat },
      end: { lng: endPt.lng, lat: endPt.lat }
    }
  } catch {
    return null
  }
}

/** 获取多边形顶点坐标 */
export function getPolygonVertices(graphic: any): Array<{ lng: number; lat: number }> | null {
  if (!graphic) {
    return null
  }

  try {
    const positions = graphic.positions || graphic.coordinates
    if (!Array.isArray(positions) || positions.length < 3) {
      return null
    }

    const vertices: Array<{ lng: number; lat: number }> = []
    for (const pos of positions) {
      const pt = mars3d.LngLatPoint.fromCartesian(pos)
      vertices.push({ lng: pt.lng, lat: pt.lat })
    }

    return vertices
  } catch {
    return null
  }
}

/** 获取圆的极点坐标（北、南、东、西） */
export function getCircleExtremes(graphic: any): {
  center: { lng: number; lat: number }
  north: { lng: number; lat: number }
  south: { lng: number; lat: number }
  east: { lng: number; lat: number }
  west: { lng: number; lat: number }
} | null {
  if (!graphic) {
    return null
  }

  try {
    // 圆的中心点
    const centerPos = graphic.position || graphic.center
    if (!centerPos) {
      return null
    }

    const centerPt = mars3d.LngLatPoint.fromCartesian(centerPos)

    // 获取圆的半径（米）
    const radius = graphic.style?.radius || graphic.radius
    if (radius == null) {
      return null
    }

    // 计算极点坐标（经纬度偏移）
    const earthRadius = 6371000 // 地球半径（米）
    const latRad = centerPt.lat * Math.PI / 180

    // 南北方向：只有纬度变化
    const latOffset = radius / earthRadius * 180 / Math.PI

    // 东西方向：经度变化需要考虑纬度
    const lngOffset = radius / (earthRadius * Math.cos(latRad)) * 180 / Math.PI

    return {
      center: { lng: centerPt.lng, lat: centerPt.lat },
      north: { lng: centerPt.lng, lat: centerPt.lat + latOffset },
      south: { lng: centerPt.lng, lat: centerPt.lat - latOffset },
      east: { lng: centerPt.lng + lngOffset, lat: centerPt.lat },
      west: { lng: centerPt.lng - lngOffset, lat: centerPt.lat }
    }
  } catch {
    return null
  }
}

/** 从地图获取所有多边形环 */
export function getPolygonRingsFromMap(
  map: mars3d.Map,
  filter?: (feature: any) => boolean
): Array<{ ring: Array<[number, number]>; id: string }> {
  const rings: Array<{ ring: Array<[number, number]>; id: string }> = []

  const json: any = map.graphicLayer?.toJSON?.()
  if (!json) {
    return rings
  }

  let features: any[] = []
  if (Array.isArray(json)) {
    features = json
  } else if (json.features) {
    features = json.features
  } else if (json.graphics) {
    features = json.graphics
  }

  for (const f of features) {
    if (filter && !filter(f)) {
      continue
    }
    let ring: Array<[number, number]> = []

    if (f?.type === "polygon" && Array.isArray(f?.coordinates)) {
      ring = f.coordinates
    } else if (f?.geometry?.type === "Polygon" && Array.isArray(f?.geometry?.coordinates)) {
      ring = f.geometry.coordinates[0] || []
    } else if (Array.isArray(f?.coord)) {
      ring = f.coord[0] || f.coord
    }

    // 过滤有效坐标
    const validRing: Array<[number, number]> = []
    for (const c of ring) {
      if (Array.isArray(c) && c.length >= 2 && typeof c[0] === "number") {
        validRing.push([c[0], c[1]])
      }
    }

    if (validRing.length >= 3) {
      rings.push({ ring: validRing, id: String(f?.id || `ring_${rings.length}`) })
    }
  }

  return rings
}
