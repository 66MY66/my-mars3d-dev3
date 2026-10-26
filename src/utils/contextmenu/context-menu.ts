/**
 * 右键菜单配置（V1.3）
 * 统一菜单数组，使用 show 函数控制各菜单项在不同上下文中的可见性
 */
import * as mars3d from "mars3d"
import type { MenuItem, ContextMenuOptions } from "./types"
import {
  detectContext,
  getGraphicType,
  getGraphicCenter,
  getGraphicRing,
  getLineLength,
  getPolygonArea,
  getPolygonRingsFromMap,
  getLineEndpoints,
  getPolygonVertices,
  getCircleExtremes
} from "./context-detector"

const Cesium = mars3d.Cesium
const { downloadFile } = mars3d.Util

async function copyCoordinate(lng: number, lat: number, alt?: number): Promise<boolean> {
  const text = alt !== undefined && alt !== null
    ? `${lng.toFixed(6)}, ${lat.toFixed(6)}, ${Number(alt).toFixed(2)}`
    : `${lng.toFixed(6)}, ${lat.toFixed(6)}`
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
  }

  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.position = "fixed"
    ta.style.left = "-9999px"
    ta.style.top = "-9999px"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) {
    return "-"
  }
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }
  return `${meters.toFixed(2)} m`
}

function formatArea(m2: number): string {
  if (!Number.isFinite(m2)) {
    return "-"
  }
  if (m2 >= 1_000_000) {
    return `${(m2 / 1_000_000).toFixed(2)} km²`
  }
  return `${m2.toFixed(2)} m²`
}

/** Droplet marker URL */
const dropletMarkerUrl = new URL("../../components/mars-ui/assets/images/query-site-text_num.png", import.meta.url).href

/** Red anomaly marker SVG data URL (with glow effect) */
const anomalyMarkerDataUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDMyIDQ4Ij48ZGVmcz48ZmlsdGVyIGlkPSJnbG93IiB4PSItNTAlIiB5PSItNTAlIiB3aWR0aD0iMjAwJSIgaGVpZ2h0PSIyMDAlIj48ZmVHYXVzc2lhbkJsdXIgaW49IlNvdXJjZUdyYXBoaWMiIHN0ZERldmlhdGlvbj0iMi41IiByZXN1bHQ9ImJsdXIiLz48ZmVDb2xvck1hdHJpeCBpbj0iYmx1ciIgdHlwZT0ibWF0cml4IiB2YWx1ZXM9IjEgMCAwIDAgMC4yICAwIDAuMiAwIDAgMCAgMCAwIDEgMCAwICAwIDAgMCAxIDAiIHJlc3VsdD0iY29sb3JCbHVyIi8+PGZlTWVyZ2U+PGZlTWVyZ2VOb2RlIGluPSJjb2xvckJsdXIiLz48ZmVNZXJnZU5vZGUgaW49IlNvdXJjZUdyYXBoaWMiLz48L2ZlTWVyZ2U+PC9maWx0ZXI+PC9kZWZzPjxwYXRoIGQ9Ik0xNiAwQzcuMTYzIDAgMCA3LjE2MyAwIDE2YzAgMTIgMTYgMzIgMTYgMzJzMTYtMjAgMTYtMzJDMzIgNy4xNjMgMjQuODM3IDAgMTYgMHoiIGZpbGw9IiNmZjAwMDAiIGZpbHRlcj0idXJsKCNnbG93KSIgb3BhY2l0eT0iMC45Ii8+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNCIgcj0iNiIgZmlsbD0iI2ZmZmZmZiIvPjwvc3ZnPg=="

/** 缓存异常点脉冲动画的定时器，避免重复创建 */
const anomalyPulseTimers = new WeakMap<any, any>()

/** 启动异常点缩放脉冲动画 */
function startAnomalyPulse(graphic: any) {
  // 避免重复启动
  if (anomalyPulseTimers.has(graphic)) {
    return
  }

  const baseScale = graphic.style?.scale ?? 0.78
  const minScale = baseScale * 0.88
  const maxScale = baseScale * 1.12
  let growing = true
  let currentScale = baseScale

  const timer = setInterval(() => {
    if (growing) {
      currentScale += 0.008
      if (currentScale >= maxScale) {
        currentScale = maxScale
        growing = false
      }
    } else {
      currentScale -= 0.008
      if (currentScale <= minScale) {
        currentScale = minScale
        growing = true
      }
    }
    try {
      graphic.setStyle({ scale: currentScale })
    } catch {
      // 图形可能已被移除，停止动画
      stopAnomalyPulse(graphic)
    }
  }, 50)

  anomalyPulseTimers.set(graphic, timer)
}

/** 停止异常点缩放脉冲动画 */
function stopAnomalyPulse(graphic: any) {
  const timer = anomalyPulseTimers.get(graphic)
  if (timer) {
    clearInterval(timer)
    anomalyPulseTimers.delete(graphic)
  }
}

/**
 * 获取右键菜单配置
 */
export function getContextMenu(map: mars3d.Map, options: ContextMenuOptions): MenuItem[] {
  const { onToast, onAlert, onConfirm, activateWidget, startQuickIdentify, openDisasterStats, updateAlertStatus, hasPermission } = options

  // ==================== 上下文判断函数 ====================

  /** 是否为空白处或图层对象（统一菜单） */
  const isBlankOrLayer = (e: any): boolean => {
    if (!Cesium.defined(e?.cartesian)) {
      return false
    }
    const ctx = detectContext(e, map)
    return ctx.type === "blank" || ctx.type === "layer"
  }

  /** 是否为空白处 */
  const isBlank = (e: any): boolean => {
    const ctx = detectContext(e, map)
    return ctx.type === "blank"
  }

  /** 是否为图层对象 */
  const isLayer = (e: any): boolean => {
    const ctx = detectContext(e, map)
    return ctx.type === "layer"
  }

  /** 是否为标记对象（点） */
  const isPointMarker = (e: any): boolean => {
    const ctx = detectContext(e, map)
    if (ctx.type !== "marker") {
      return false
    }
    const type = getGraphicType(ctx.graphic)
    return type === "point" || type === "label"
  }

  /** 是否为标记对象（线） */
  const isLineMarker = (e: any): boolean => {
    const ctx = detectContext(e, map)
    if (ctx.type !== "marker") {
      return false
    }
    return getGraphicType(ctx.graphic) === "polyline"
  }

  /** 是否为标记对象（面） */
  const isPolygonMarker = (e: any): boolean => {
    const ctx = detectContext(e, map)
    if (ctx.type !== "marker") {
      return false
    }
    const type = getGraphicType(ctx.graphic)
    return type === "polygon" || type === "rectangle" || type === "circle"
  }

  /** 是否为圆 */
  const isCircleMarker = (e: any): boolean => {
    const ctx = detectContext(e, map)
    if (ctx.type !== "marker") {
      return false
    }
    return getGraphicType(ctx.graphic) === "circle"
  }

  /** 是否为告警对象 */
  const isAlert = (e: any): boolean => {
    const ctx = detectContext(e, map)
    return ctx.type === "alert"
  }

  /** 是否为测量结果 */
  const isMeasure = (e: any): boolean => {
    const ctx = detectContext(e, map)
    return ctx.type === "measure"
  }

  /** 是否为测量面 */
  const isMeasurePolygon = (e: any): boolean => {
    const ctx = detectContext(e, map)
    if (ctx.type !== "measure") {
      return false
    }
    const type = getGraphicType(ctx.graphic)
    return type === "polygon" || type === "rectangle" || type === "circle"
  }

  /** 是否为标记对象（任意类型，含测量） */
  const isAnyMarker = (e: any): boolean => {
    if (!Cesium.defined(e?.cartesian)) {
      return false
    }
    const ctx = detectContext(e, map)
    return ctx.type === "marker" || ctx.type === "measure"
  }

  /** 是否为面状对象（标记或测量面） */
  const isAnyPolygon = (e: any): boolean => {
    return isPolygonMarker(e) || isMeasurePolygon(e)
  }

  const isBlankOrLayerAny = (e: any): boolean => {
    if (!Cesium.defined(e?.cartesian)) {
      return false
    }
    const ctx = detectContext(e, map)
    return ctx.type === "blank" || ctx.type === "layer"
  }

  const canUse = (code: string) => {
    if (!hasPermission) {
      return true
    }
    try {
      return hasPermission(code)
    } catch {
      return true
    }
  }

  const reasonNoSelection = "请先圈选区域或右键标记面"
  const reasonNoPermission = "当前账号无权限使用该功能"
  const reasonServiceUnavailable = "功能暂不可用，请稍后重试"

  function hasServiceForAnalysis(): boolean {
    return typeof activateWidget === "function"
  }

  function hasServiceForStats(): boolean {
    return typeof openDisasterStats === "function"
  }

  function hasServiceForWorkbench(): boolean {
    return typeof activateWidget === "function"
  }

  function resolveThematicTargetName(e: any): string {
    const ctx = detectContext(e, map)
    if (ctx.type === "blank") {
      return "地图场景"
    }
    if (ctx.type === "layer") {
      return "图层场景"
    }
    const graphic: any = ctx.graphic
    return String(graphic?.attr?.name || graphic?.name || graphic?.id || "当前对象")
  }

  function metersToDegLat(m: number) {
    return m / 111_320
  }

  function metersToDegLng(m: number, latDeg: number) {
    const lat = (latDeg * Math.PI) / 180
    return m / (111_320 * Math.max(0.1, Math.cos(lat)))
  }

  function circleRing(center: { lng: number; lat: number }, radiusM: number, steps = 48): Array<[number, number]> {
    const dLat = metersToDegLat(radiusM)
    const dLng = metersToDegLng(radiusM, center.lat)
    const out: Array<[number, number]> = []
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2
      out.push([center.lng + Math.cos(a) * dLng, center.lat + Math.sin(a) * dLat])
    }
    return out
  }

  function bboxRingOfLonLatPoints(points: Array<{ lng: number; lat: number }>, padM: number): Array<[number, number]> | null {
    if (!points.length) {
      return null
    }
    let minLng = Infinity
    let minLat = Infinity
    let maxLng = -Infinity
    let maxLat = -Infinity
    let sumLat = 0
    for (const p of points) {
      minLng = Math.min(minLng, p.lng)
      minLat = Math.min(minLat, p.lat)
      maxLng = Math.max(maxLng, p.lng)
      maxLat = Math.max(maxLat, p.lat)
      sumLat += p.lat
    }
    const latMid = sumLat / points.length
    const dLat = metersToDegLat(padM)
    const dLng = metersToDegLng(padM, latMid)
    const a = { lng: minLng - dLng, lat: minLat - dLat }
    const b = { lng: maxLng + dLng, lat: minLat - dLat }
    const c = { lng: maxLng + dLng, lat: maxLat + dLat }
    const d = { lng: minLng - dLng, lat: maxLat + dLat }
    return [
      [a.lng, a.lat],
      [b.lng, b.lat],
      [c.lng, c.lat],
      [d.lng, d.lat]
    ]
  }

  function resolvePolygonRingFromMap(): Array<[number, number]> | null {
    const rings = typeof options.getPolygonRings === "function" ? options.getPolygonRings() : getPolygonRingsFromMap(map)
    if (!rings || rings.length === 0) {
      return null
    }
    return rings[rings.length - 1]?.ring || null
  }

  function resolveTargetRingForAnalysis(e: any): Array<[number, number]> | null {
    if (isAnyPolygon(e)) {
      return resolvePolygonLikeRing(e.graphic)
    }
    if (isPointMarker(e)) {
      const center = getGraphicCenter(e.graphic)
      if (!center) {
        return null
      }
      return circleRing({ lng: center.lng, lat: center.lat }, 10, 48)
    }
    if (isLineMarker(e)) {
      const coords = e.graphic?.positions || e.graphic?.coordinates
      if (!Array.isArray(coords) || coords.length < 2) {
        return null
      }
      const pts: Array<{ lng: number; lat: number }> = []
      for (const c of coords) {
        try {
          const pt = mars3d.LngLatPoint.fromCartesian(c)
          pts.push({ lng: pt.lng, lat: pt.lat })
        } catch {
        }
      }
      return bboxRingOfLonLatPoints(pts, 10)
    }
    return resolvePolygonRingFromMap()
  }

  function resolveSelectedLine(e: any): any | null {
    if (!isLineMarker(e)) {
      return null
    }
    return e.graphic || null
  }

  function resolveSelectedPolygonRing(e: any): Array<[number, number]> | null {
    if (isAnyPolygon(e)) {
      return resolvePolygonLikeRing(e.graphic)
    }
    return resolvePolygonRingFromMap()
  }

  function resolvePolygonLikeRing(graphic: any): Array<[number, number]> | null {
    try {
      const gj = graphic?.toGeoJSON?.()
      const coords = gj?.geometry?.coordinates
      if (Array.isArray(coords) && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        const ring = coords[0].filter((c: any) => Array.isArray(c) && c.length >= 2).map((c: any) => [Number(c[0]), Number(c[1])] as [number, number])
        if (ring.length >= 3) {
          return ring
        }
      }
    } catch {
    }

    const direct = getGraphicRing(graphic)
    if (direct && direct.length >= 3) {
      return direct
    }
    const type = getGraphicType(graphic)
    if (type === "circle") {
      const extremes = getCircleExtremes(graphic)
      const center = extremes?.center
      if (!center) {
        return null
      }
      let radiusM: number | null = null
      const rawRadius = (graphic?.style?.radius ?? graphic?.radius) as any
      const n = Number(rawRadius)
      if (Number.isFinite(n) && n > 0) {
        radiusM = n
      } else if (extremes?.north) {
        radiusM = Math.abs(extremes.north.lat - center.lat) * 111_320
      }
      if (!radiusM || radiusM <= 0) {
        return null
      }
      return circleRing(center, radiusM, 64)
    }
    if (type === "rectangle" || type === "polygon") {
      const vs = getPolygonVertices(graphic)
      if (vs && vs.length >= 3) {
        return vs.map((p) => [p.lng, p.lat] as [number, number])
      }
      const coords = graphic?.positions || graphic?.coordinates
      if (Array.isArray(coords) && coords.length === 2) {
        try {
          const a = mars3d.LngLatPoint.fromCartesian(coords[0])
          const b = mars3d.LngLatPoint.fromCartesian(coords[1])
          return [
            [a.lng, a.lat],
            [b.lng, a.lat],
            [b.lng, b.lat],
            [a.lng, b.lat]
          ]
        } catch {
        }
      }
    }
    return null
  }

  function canUsePolygonSelection(e: any): boolean {
    if (isAnyPolygon(e)) {
      return true
    }
    if (isBlankOrLayerAny(e)) {
      const ring = resolvePolygonRingFromMap()
      return !!(ring && ring.length >= 3)
    }
    return false
  }

  // ==================== 回调函数 ====================

  /** 复制坐标（空白处/图层） */
  const handleCopyCoordinate = async (e: any) => {
    let lng: number, lat: number, alt: number | undefined

    if (e.cartesian) {
      const pt = mars3d.LngLatPoint.fromCartesian(e.cartesian)
      lng = pt.lng
      lat = pt.lat
      alt = pt.alt
    } else if (e.graphic) {
      const center = getGraphicCenter(e.graphic)
      if (center) {
        lng = center.lng
        lat = center.lat
        alt = center.alt
      }
    }

    if (lng !== undefined && lat !== undefined) {
      const success = await copyCoordinate(lng, lat, alt)
      if (success) {
        onToast(`已复制: ${lng.toFixed(6)}, ${lat.toFixed(6)}`, "success")
      } else {
        onToast("复制失败", "error")
      }
    } else {
      onToast("无法获取坐标", "error")
    }
  }

  /** 复制线坐标（起点-终点+长度格式） */
  const handleCopyLineCoordinates = async (e: any) => {
    const endpoints = getLineEndpoints(e.graphic)
    if (!endpoints) {
      onToast("无法获取线坐标", "error")
      return
    }

    const length = getLineLength(e.graphic)
    const lengthText = length !== null ? formatDistance(length) : "未知"

    const text = `起点: ${endpoints.start.lng.toFixed(6)}, ${endpoints.start.lat.toFixed(6)}
终点: ${endpoints.end.lng.toFixed(6)}, ${endpoints.end.lat.toFixed(6)}
长度: ${lengthText}`

    try {
      await navigator.clipboard.writeText(text)
      onToast("已复制坐标和长度", "success")
    } catch {
      onToast("复制失败", "error")
    }
  }

  /** 复制面坐标（中心+顶点+面积格式） */
  const handleCopyPolygonCoordinates = async (e: any) => {
    const center = getGraphicCenter(e.graphic)
    if (!center) {
      onToast("无法获取面坐标", "error")
      return
    }

    const area = getPolygonArea(e.graphic)
    const areaText = area !== null ? formatArea(area) : "未知"

    let text = ""
    if (isCircleMarker(e)) {
      // 圆：中心+极点+面积
      const extremes = getCircleExtremes(e.graphic)
      if (!extremes) {
        onToast("无法获取圆坐标", "error")
        return
      }
      text = `中心: ${extremes.center.lng.toFixed(6)}, ${extremes.center.lat.toFixed(6)}
面积: ${areaText}
极点:
  北: ${extremes.north.lng.toFixed(6)}, ${extremes.north.lat.toFixed(6)}
  南: ${extremes.south.lng.toFixed(6)}, ${extremes.south.lat.toFixed(6)}
  东: ${extremes.east.lng.toFixed(6)}, ${extremes.east.lat.toFixed(6)}
  西: ${extremes.west.lng.toFixed(6)}, ${extremes.west.lat.toFixed(6)}`
    } else {
      // 多边形：中心+顶点+面积
      const vertices = getPolygonVertices(e.graphic)
      if (!vertices || vertices.length < 3) {
        onToast("无法获取面顶点坐标", "error")
        return
      }
      text = `中心: ${center.lng.toFixed(6)}, ${center.lat.toFixed(6)}
面积: ${areaText}
顶点:
${vertices.map((v) => `  ${v.lng.toFixed(6)}, ${v.lat.toFixed(6)}`).join("\n")}`
    }

    try {
      await navigator.clipboard.writeText(text)
      onToast("已复制坐标和面积", "success")
    } catch {
      onToast("复制失败", "error")
    }
  }

  /** 在此标记 */
  const handleMarkHere = (e: any) => {
    if (!e.cartesian) {
      onToast("无法在此位置标记", "error")
      return
    }

    // 直接在点击位置创建标记，不需要进入绘制模式
    const graphic = new mars3d.graphic.BillboardPrimitive({
      position: e.cartesian,
      style: {
        image: dropletMarkerUrl,
        scale: 0.65,
        hasPixelOffset: true,
        pixelOffsetY: -10,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        clampToGround: true,
        visibleDepth: false
      },
      attr: { markerType: "point" }
    })
    map.graphicLayer.addGraphic(graphic)
    onToast(`已添加标记`, "success")
  }

  /** 绘制线 */
  const handleDrawLine = () => {
    map.graphicLayer.startDraw({
      type: "polyline",
      style: {
        color: "#00ffff",
        width: 2,
        clampToGround: true
      },
      success: (graphic: any) => {
        const positions = graphic.positions
        if (positions && positions.length >= 2) {
          const distance = mars3d.MeasureUtil.getDistance(positions)
          const center = positions[Math.floor(positions.length / 2)]

          // 添加距离标签
          const labelGraphic = new mars3d.graphic.LabelPrimitive({
            position: center,
            style: {
              text: formatDistance(distance),
              font_size: 14,
              font_family: "微软雅黑",
              fillColor: "#ffffff",
              outlineColor: "#000000",
              outlineWidth: 2,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffsetY: -10
            },
            attr: { measure: true, parentId: graphic.id }
          })
          map.graphicLayer.addGraphic(labelGraphic)

          onToast(`绘制完成，距离: ${formatDistance(distance)}`, "success")
        }
      }
    })
  }

  /** 绘制面 */
  const handleDrawPolygon = () => {
    map.graphicLayer.startDraw({
      type: "polygon",
      style: {
        color: "#00ffff",
        opacity: 0.4,
        outline: true,
        outlineWidth: 2,
        outlineColor: "#00ffff",
        clampToGround: true
      },
      success: (graphic: any) => {
        const positions = graphic.positions
        if (positions && positions.length >= 3) {
          const area = mars3d.MeasureUtil.getArea(positions)
          const center = mars3d.PolyUtil.centerOfMass(positions)

          // 添加面积标签
          const labelGraphic = new mars3d.graphic.LabelPrimitive({
            position: center,
            style: {
              text: formatArea(area),
              font_size: 14,
              font_family: "微软雅黑",
              fillColor: "#ffffff",
              outlineColor: "#000000",
              outlineWidth: 2,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffsetY: -10
            },
            attr: { measure: true, parentId: graphic.id }
          })
          map.graphicLayer.addGraphic(labelGraphic)

          onToast(`绘制完成，面积: ${formatArea(area)}`, "success")
        }
      }
    })
  }

  /** 绘制矩形 */
  const handleDrawRectangle = () => {
    map.graphicLayer.startDraw({
      type: "rectangle",
      style: {
        color: "#00ffff",
        opacity: 0.4,
        outline: true,
        outlineWidth: 2,
        outlineColor: "#00ffff",
        clampToGround: true
      },
      success: () => onToast("矩形绘制完成", "success")
    })
  }

  /** 添加文字注记 */
  const handleAddLabel = () => {
    const text = prompt("请输入标注文字", "Mars3D")
    if (!text) {
      return
    }

    map.graphicLayer.startDraw({
      type: "label",
      style: {
        text,
        color: "#ffffff",
        opacity: 1,
        font_size: 30,
        font_family: "微软雅黑",
        outline: true,
        outlineColor: "#000000",
        outlineWidth: 2,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
      },
      success: () => onToast("文字标注已添加", "success")
    })
  }

  /** 异常检测（空白处/图层） */
  const handleAnomalyDetection = async () => {
    const rings = getPolygonRingsFromMap(map)

    if (rings.length === 0) {
      const confirmed = await onConfirm("异常检测", "当前没有可用的分析区域，是否绘制分析区域？")
      if (confirmed) {
        map.graphicLayer.startDraw({
          type: "polygon",
          style: {
            color: "#00ffff",
            opacity: 0.4,
            outline: true,
            outlineWidth: 2,
            outlineColor: "#00ffff",
            clampToGround: true
          },
          success: (graphic: any) => {
            try {
              graphic.attr = { ...(graphic.attr || {}), analysisType: "anomaly", time: Date.now() }
            } catch {}
            const positions = graphic.positions
            if (positions && positions.length >= 3) {
              const area = mars3d.MeasureUtil.getArea(positions)
              const center = mars3d.PolyUtil.centerOfMass(positions)

              const labelGraphic = new mars3d.graphic.LabelPrimitive({
                position: center,
                style: {
                  text: formatArea(area),
                  font_size: 14,
                  font_family: "微软雅黑",
                  fillColor: "#ffffff",
                  outlineColor: "#000000",
                  outlineWidth: 2,
                  horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                  pixelOffsetY: -10
                },
                attr: { measure: true, parentId: graphic.id }
              })
              map.graphicLayer.addGraphic(labelGraphic)

              onToast(`绘制完成，面积: ${formatArea(area)}`, "success")

              // 构建 ring 坐标并启动异常检测
              const ring: Array<[number, number]> = []
              for (const pos of positions) {
                const pt = mars3d.LngLatPoint.fromCartesian(pos)
                ring.push([pt.lng, pt.lat])
              }

              if (ring.length >= 3 && startQuickIdentify) {
                console.log("[ContextMenu] 自动启动异常检测，ring:", ring)
                startQuickIdentify(ring)
              }
            }
          }
        })
      }
      return
    }

    if (rings.length === 1) {
      if (startQuickIdentify) {
        startQuickIdentify(rings[0].ring)
      }
      return
    }

    // 多个面，使用第一个
    if (startQuickIdentify) {
      startQuickIdentify(rings[0].ring)
    }
  }

  /** 异常检测（对象） */
  const handleAnomalyDetectionObject = (e: any) => {
    const ring = getGraphicRing(e.graphic)
    if (!ring) {
      onToast("无法获取区域范围", "error")
      return
    }
    if (startQuickIdentify) {
      startQuickIdentify(ring)
    }
  }

  /** 清理临时要素 */
  const handleCleanup = async () => {
    const graphicCount = map.graphicLayer?.length || 0

    const content = `将清理以下内容：
• ${graphicCount} 个标记点/面

此操作不可撤销`

    const confirmed = await onConfirm("确认清理", content)
    if (confirmed) {
      if (map.graphicLayer) {
        map.graphicLayer.clear()
      }
      onToast("已清理临时要素", "success")
    }
  }

  const handleClearWorkspaceLayers = async () => {
    const content = `将清理以下内容：
• 所有业务图层（不包含底图）
• 所有临时标记点/线/面

此操作不可撤销`
    const confirmed = await onConfirm("确认清理工作区", content)
    if (!confirmed) {
      return
    }
    window.dispatchEvent(new CustomEvent("mars3d:workspace-clear", { detail: { clearStorage: false } }))
    onToast("已清理工作区图层", "success")
  }

  const handleClearWorkspaceAndCache = async () => {
    /* analysis-results-only reset; keep the existing menu label */
/*
    const content = "清除当前异常监测结果、统计上图结果，并恢复到绘制区域视图；不会删除当前绘制面。"
    const content = `清除当前异常监测结果、统计上图结果，并恢复到绘制区域视图；不会删除当前绘制面。`
    const confirmed = await onConfirm("确认清理缓存并重置", content)
    if (!confirmed) {
      return
    }
    window.dispatchEvent(new CustomEvent("mars3d:workspace-clear", { detail: { clearStorage: true } }))
    onToast("已清理缓存并重置", "success")
    return
//
    const content = `将清理以下内容：
• 所有业务图层（不包含底图）
• 所有临时标记点/线/面
• 相关本地缓存（图层树状态、分屏对比偏好等）

此操作不可撤销`
    const confirmed = await onConfirm("确认清理缓存并重置", content)
    if (!confirmed) {
      return
    }
    window.dispatchEvent(new CustomEvent("mars3d:workspace-clear", { detail: { clearStorage: true } }))
    onToast("已清理缓存并重置", "success")
  }
*/

  /** 定位 */
    const content = "清除当前异常监测结果、统计上图结果，并恢复到绘制区域视图；不会删除当前绘制面。"
    const confirmed = await onConfirm("确认清理缓存并重置", content)
    if (!confirmed) {
      return
    }
    window.dispatchEvent(new CustomEvent("mars3d:workspace-clear", { detail: { clearStorage: true } }))
    onToast("已清理缓存并重置", "success")
  }

  const handleLocate = (e: any) => {
    if (e.graphic?.flyTo) {
      e.graphic.flyTo({ radius: 1000 })
    } else if (e.graphic?.zoomTo) {
      e.graphic.zoomTo()
    } else if (e.layer?.flyTo) {
      e.layer.flyTo()
    }
  }

  /** 定位到图层 */
  const handleLocateLayer = (e: any) => {
    if (e.layer?.flyTo) {
      e.layer.flyTo()
    }
  }

  /** 编辑 */
  const handleEdit = (e: any) => {
    if (e.graphic?.editing) {
      e.graphic.stopEditing()
    } else {
      e.graphic?.startEditing?.()
    }
  }

  /** 标记为异常点 */
  const handleMarkAsAnomaly = (e: any) => {
    const graphic = e.graphic
    if (!graphic) {
      onToast("无法标记", "error")
      return
    }

    // 获取当前图形类型
    const graphicType = getGraphicType(graphic)

    // 定义异常点颜色（红色）
    const anomalyColorHex = "#ff0000"

    // 根据图形类型设置不同的样式
    if (graphicType === "point" || graphicType === "label") {
      // BillboardPrimitive 类型：更换为红色标记图标
      graphic.setStyle({
        ...graphic.style,
        image: anomalyMarkerDataUrl,
        scale: (graphic.style?.scale || 0.65) * 1.2
      })
    } else if (graphicType === "polyline") {
      // 线标记：修改线条颜色
      graphic.setStyle({
        color: anomalyColorHex,
        width: graphic.style?.width || 3,
        opacity: 1
      })
    } else if (graphicType === "polygon" || graphicType === "rectangle" || graphicType === "circle") {
      // 面标记：修改填充颜色
      graphic.setStyle({
        color: anomalyColorHex,
        opacity: 0.5,
        outline: true,
        outlineWidth: 2,
        outlineColor: anomalyColorHex
      })
    }

    // 设置异常点标识属性
    graphic.attr = {
      ...graphic.attr,
      isAnomaly: true,
      anomalyTime: Date.now(),
      markerType: "anomaly"
    }

    // 启动缩放脉冲动画（仅点类型/标签类型）
    if (graphicType === "point" || graphicType === "label") {
      startAnomalyPulse(graphic)
    }

    onToast("已标记为异常点", "success")
  }

  /** 取消异常标记 */
  const handleUnmarkAnomaly = (e: any) => {
    const graphic = e.graphic
    if (!graphic) {
      onToast("无法取消标记", "error")
      return
    }

    // 恢复默认样式
    const graphicType = getGraphicType(graphic)

    // 停止脉冲动画
    stopAnomalyPulse(graphic)

    if (graphicType === "point" || graphicType === "label") {
      // BillboardPrimitive 类型：恢复原始图标
      graphic.setStyle({
        ...graphic.style,
        image: dropletMarkerUrl,
        scale: 0.65
      })
    } else if (graphicType === "polyline") {
      graphic.setStyle({
        color: "#ffff00",
        width: 3,
        opacity: 1
      })
    } else if (graphicType === "polygon" || graphicType === "rectangle" || graphicType === "circle") {
      graphic.setStyle({
        color: "#00ffff",
        opacity: 0.4,
        outline: true,
        outlineWidth: 2,
        outlineColor: "#00ffff"
      })
    }

    // 移除异常点标识
    graphic.attr = {
      ...graphic.attr,
      isAnomaly: false
    }
    delete graphic.attr.anomalyTime
    delete graphic.attr.markerType

    onToast("已取消异常标记", "success")
  }

  /** 判断是否为异常标记 */
  const isAnomalyMarker = (e: any): boolean => {
    const ctx = detectContext(e, map)
    if (ctx.type !== "marker") {
      return false
    }
    return ctx.graphic?.attr?.isAnomaly === true
  }

  /** 剖面分析 */
  const handleProfileAnalysis = (e: any) => {
    if (!hasServiceForAnalysis()) {
      onToast(reasonServiceUnavailable, "error")
      return
    }
    if (!canUse("analysis:profile")) {
      onToast(reasonNoPermission, "error")
      return
    }
    const graphic = resolveSelectedLine(e)
    if (!graphic) {
      onToast("请先选择线对象或生成剖面线", "info")
      return
    }
    activateWidget!("insar-profile", { graphic })
  }

  /** 缓冲区分析 */
  const handleBufferAnalysis = (e: any) => {
    if (!hasServiceForAnalysis()) {
      onToast(reasonServiceUnavailable, "error")
      return
    }
    if (!canUse("analysis:buffer")) {
      onToast(reasonNoPermission, "error")
      return
    }
    let target: any = null
    if (isPointMarker(e)) {
      const center = getGraphicCenter(e.graphic)
      if (center) {
        target = { type: "point", coordinates: [center.lng, center.lat], source: "marker", sourceId: e.graphic?.id }
      }
    } else if (isLineMarker(e)) {
      const coordinates = (e.graphic?.positions || e.graphic?.coordinates || []).map((position: any) => {
        try {
          const point = mars3d.LngLatPoint.fromCartesian(position)
          return [point.lng, point.lat]
        } catch {
          return Array.isArray(position) ? [Number(position[0]), Number(position[1])] : null
        }
      }).filter((position: any) => Array.isArray(position) && position.every(Number.isFinite))
      if (coordinates.length >= 2) {
        target = { type: "polyline", coordinates, source: "marker", sourceId: e.graphic?.id }
      }
    } else {
      const ring = resolveTargetRingForAnalysis(e)
      if (ring && ring.length >= 3) {
        target = { type: "polygon", ring, source: isAnyPolygon(e) ? "marker" : "selection", sourceId: e.graphic?.id }
      }
    }
    if (!target) {
      onToast(reasonNoSelection, "info")
      return
    }
    activateWidget!("spatial-analysis", { type: "buffer", target, sourceGraphic: e.graphic })
  }

  /** 叠加分析 */
  const handleOverlayAnalysis = (e: any) => {
    if (!hasServiceForAnalysis()) {
      onToast(reasonServiceUnavailable, "error")
      return
    }
    if (!canUse("analysis:overlay")) {
      onToast(reasonNoPermission, "error")
      return
    }
    const ring = resolveSelectedPolygonRing(e)
    if (!ring || ring.length < 3) {
      onToast(reasonNoSelection, "info")
      return
    }
    if (!canUsePolygonSelection(e)) {
      onToast("请先选择面对象", "info")
      return
    }
    activateWidget!("spatial-analysis", { type: "overlay", target: { type: "polygon", ring } })
  }

  /** 邻域分析 */
  const handleNeighborhoodAnalysis = (e: any) => {
    if (!hasServiceForAnalysis()) {
      onToast(reasonServiceUnavailable, "error")
      return
    }
    if (!canUse("analysis:neighbor")) {
      onToast(reasonNoPermission, "error")
      return
    }
    if (!canUsePolygonSelection(e)) {
      onToast("请先选择面对象", "info")
      return
    }
    const ring = resolveSelectedPolygonRing(e)
    if (!ring || ring.length < 3) {
      onToast(reasonNoSelection, "info")
      return
    }
    activateWidget!("spatial-analysis", { type: "neighbor", target: { type: "polygon", ring } })
  }

  /** 可视域分析（预留） */
  const handleViewshedAnalysis = () => {
    onToast("功能暂未开放", "info")
  }

  /** 生成圆形缓冲区环坐标 */
  const generateBufferRing = (center: { lng: number; lat: number }, radiusMeters: number): Array<[number, number]> => {
    const ring: Array<[number, number]> = []
    const earthRadius = 6371000 // 地球半径（米）
    const segments = 64 // 圆的分段数

    const latRad = center.lat * Math.PI / 180
    const lngOffset = radiusMeters / (earthRadius * Math.cos(latRad)) * 180 / Math.PI
    const latOffset = radiusMeters / earthRadius * 180 / Math.PI

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * 2 * Math.PI
      const lng = center.lng + lngOffset * Math.cos(angle)
      const lat = center.lat + latOffset * Math.sin(angle)
      ring.push([lng, lat])
    }

    return ring
  }

  /** 查看统计（点：缓冲区统计，面：面内统计） */
  const handleViewStats = async (e: any) => {
    if (!hasServiceForStats()) {
      onToast(reasonServiceUnavailable, "error")
      return
    }
    if (!canUse("analysis:stats")) {
      onToast(reasonNoPermission, "error")
      return
    }

    if (isPointMarker(e)) {
      const center = getGraphicCenter(e.graphic)
      if (!center) {
        onToast("无法获取点坐标", "error")
        return
      }

      // 选择缓冲区半径
      let radius = 1000 // 默认 1km
      if (options.onSelectBufferRadius) {
        const selectedRadius = await options.onSelectBufferRadius(1000)
        if (selectedRadius === null) {
          return // 用户取消
        }
        radius = selectedRadius
      }

      // 生成缓冲区环坐标
      const ring = generateBufferRing(center, radius)
      openDisasterStats(ring)
      return
    }

    const ring = resolveSelectedPolygonRing(e)
    if (!ring || ring.length < 3) {
      onToast(reasonNoSelection, "info")
      return
    }
    openDisasterStats!(ring)
  }

  /** 专题制图工作台 */
  const handleOpenThematicWorkbench = (e: any) => {
    if (!activateWidget) {
      onToast("专题制图工作台暂不可用", "error")
      return
    }
    activateWidget("thematic-workbench", {
      props: {
        source: "context-menu",
        targetName: resolveThematicTargetName(e),
        initialTab: "template"
      }
    })
  }

  /** 导出 */
  const handleExport = (e: any) => {
    try {
      const json = e.graphic?.toJSON?.() || e.graphic?.toGeoJSON?.() || e.graphic
      downloadFile(`feature_${Date.now()}.geojson`, JSON.stringify(json, null, 2))
      onToast("导出成功", "success")
    } catch {
      onToast("导出失败", "error")
    }
  }

  /** 删除 */
  const handleDelete = (e: any) => {
    e.graphic?.remove?.() || e.graphic?.destroy?.()
    onToast("已删除", "success")
  }

  /** 图层信息 */
  const handleLayerInfo = (e: any) => {
    const layer = e.layer
    const info = {
      name: layer?.name || layer?.options?.name || "未知图层",
      type: layer?.type || "未知类型",
      source: layer?.options?.url || "-"
    }
    onAlert(`名称：${info.name}\n类型：${info.type}\n来源：${info.source}`, "图层信息")
  }

  /** 设置透明度 */
  const handleSetOpacity = (opacity: number) => (e: any) => {
    const layer = e.layer
    if (layer?.opacity !== undefined) {
      layer.opacity = opacity
    } else if (layer?.setStyle) {
      layer.setStyle({ opacity })
    }
    onToast(`透明度已设置为 ${Math.round(opacity * 100)}%`, "success")
  }

  /** 打开告警确认 */
  const handleOpenAlertConfirm = (e: any) => {
    if (activateWidget) {
      const attr = e.graphic?.attr || {}
      activateWidget("alert-confirm", {
        graphic: e.graphic,
        alertId: attr.alertId || attr.alert_id,
        alertType: attr.alertType || attr.alert_type
      })
    } else {
      onToast("告警确认功能未初始化", "error")
    }
  }

  /** 快速分析 */
  const handleQuickAnalysis = (e: any) => {
    if (activateWidget) {
      const attr = e.graphic?.attr || {}
      activateWidget("quick-analysis", {
        graphic: e.graphic,
        alertId: attr.alertId || attr.alert_id
      })
    } else {
      onToast("快速分析功能未初始化", "error")
    }
  }

  /** 忽略此告警 */
  const handleIgnoreAlert = async (e: any) => {
    const attr = e.graphic?.attr || {}
    const alertId = attr.alertId || attr.alert_id

    if (!alertId) {
      onToast("无法获取告警ID", "error")
      return
    }

    if (updateAlertStatus) {
      const success = await updateAlertStatus(alertId, "ignored")
      if (success) {
        onToast("告警已忽略", "success")
        // 可选：删除或隐藏告警图形
        e.graphic?.remove?.()
      } else {
        onToast("操作失败", "error")
      }
    } else {
      onToast("告警状态更新功能未初始化", "error")
    }
  }

  // ==================== 菜单配置 ====================

  return [
    {
      text: "空间分析",
      icon: "fa fa-flask",
      show: function (e: any) {
        return isAnyPolygon(e)
      },
      children: [
        {
          text: "缓冲区分析",
          icon: "fa fa-bullseye",
          show: function (e: any) {
            return isAnyPolygon(e)
          },
          disabled: function (e: any) {
            if (!canUse("analysis:buffer")) {
              return true
            }
            if (!hasServiceForAnalysis()) {
              return true
            }
            const ring = resolveTargetRingForAnalysis(e)
            return !ring || ring.length < 3
          },
          disabledReason: function (e: any) {
            if (!canUse("analysis:buffer")) {
              return reasonNoPermission
            }
            if (!hasServiceForAnalysis()) {
              return reasonServiceUnavailable
            }
            return reasonNoSelection
          },
          callback: handleBufferAnalysis
        },
        {
          text: "叠加分析",
          icon: "fa fa-object-group",
          show: function (e: any) {
            return isAnyPolygon(e)
          },
          disabled: function (e: any) {
            if (!canUse("analysis:overlay")) {
              return true
            }
            if (!hasServiceForAnalysis()) {
              return true
            }
            const ring = resolveSelectedPolygonRing(e)
            return !ring || ring.length < 3 || !canUsePolygonSelection(e)
          },
          disabledReason: function (e: any) {
            if (!canUse("analysis:overlay")) {
              return reasonNoPermission
            }
            if (!hasServiceForAnalysis()) {
              return reasonServiceUnavailable
            }
            const ring = resolveSelectedPolygonRing(e)
            if (!ring || ring.length < 3) {
              return reasonNoSelection
            }
            return "请先选择面对象"
          },
          callback: handleOverlayAnalysis
        },
        {
          text: "邻域分析",
          icon: "fa fa-th",
          show: function (e: any) {
            return isAnyPolygon(e)
          },
          disabled: function (e: any) {
            if (!canUse("analysis:neighbor")) {
              return true
            }
            if (!hasServiceForAnalysis()) {
              return true
            }
            const ring = resolveSelectedPolygonRing(e)
            return !ring || ring.length < 3 || !canUsePolygonSelection(e)
          },
          disabledReason: function (e: any) {
            if (!canUse("analysis:neighbor")) {
              return reasonNoPermission
            }
            if (!hasServiceForAnalysis()) {
              return reasonServiceUnavailable
            }
            const ring = resolveSelectedPolygonRing(e)
            if (!ring || ring.length < 3) {
              return reasonNoSelection
            }
            return "请先选择面对象"
          },
          callback: handleNeighborhoodAnalysis
        },
        {
          text: "可视域分析",
          icon: "fa fa-eye",
          show: function (e: any) {
            return isAnyPolygon(e)
          },
          disabled: true,
          disabledReason: "功能暂未开放",
          callback: handleViewshedAnalysis
        }
      ]
    },
    {
      text: "查看统计",
      icon: "fa fa-bar-chart",
      show: function (e: any) {
        return isPointMarker(e) || isAnyPolygon(e)
      },
      disabled: function (e: any) {
        if (!canUse("analysis:stats")) {
          return true
        }
        if (!hasServiceForStats()) {
          return true
        }
        if (isPointMarker(e)) {
          return false
        }
        const ring = resolveSelectedPolygonRing(e)
        return !ring || ring.length < 3
      },
      disabledReason: function (e: any) {
        if (!canUse("analysis:stats")) {
          return reasonNoPermission
        }
        if (!hasServiceForStats()) {
          return reasonServiceUnavailable
        }
        if (isPointMarker(e)) {
          return ""
        }
        return reasonNoSelection
      },
      callback: handleViewStats
    },
    {
      text: "专题制图",
      icon: "fa fa-paint-brush",
      show: function (e: any) {
        return isBlankOrLayerAny(e) || isAnyMarker(e)
      },
      disabled: function () {
        return !hasServiceForWorkbench()
      },
      disabledReason: function () {
        return hasServiceForWorkbench() ? "" : reasonServiceUnavailable
      },
      callback: handleOpenThematicWorkbench
    },
    { type: "line", show: function (e: any) { return isAnyMarker(e) } },

    // ==================== 统一菜单（空白处/图层） ====================
    {
      text: "在此标记",
      icon: "fa fa-map-marker",
      show: function (e: any) {
        return isBlankOrLayer(e)
      },
      callback: handleMarkHere
    },
    {
      text: "复制坐标",
      icon: "fa fa-location-arrow",
      show: function (e: any) {
        return isBlankOrLayer(e)
      },
      callback: handleCopyCoordinate
    },
    {
      text: "绘制",
      icon: "fa fa-pencil",
      show: function (e: any) {
        return isBlankOrLayer(e)
      },
      children: [
        { text: "绘制线", callback: handleDrawLine },
        { text: "绘制面", callback: handleDrawPolygon },
        { text: "绘制矩形", callback: handleDrawRectangle },
        { text: "添加文字注记", callback: handleAddLabel }
      ]
    },
    {
      text: "定位到图层",
      icon: "fa fa-crosshairs",
      show: function (e: any) {
        return isLayer(e)
      },
      callback: handleLocateLayer
    },
    {
      text: "调整透明度",
      icon: "fa fa-adjust",
      show: function (e: any) {
        return isLayer(e)
      },
      children: [
        { text: "25%", callback: handleSetOpacity(0.25) },
        { text: "50%", callback: handleSetOpacity(0.5) },
        { text: "75%", callback: handleSetOpacity(0.75) },
        { text: "100%", callback: handleSetOpacity(1) }
      ]
    },
    {
      text: "图层信息",
      icon: "fa fa-info-circle",
      show: function (e: any) {
        return isLayer(e)
      },
      callback: handleLayerInfo
    },
    { type: "line", show: function (e: any) { return isBlankOrLayer(e) } },
    {
      text: "异常检测",
      icon: "fa fa-fire",
      show: function (e: any) {
        return isBlankOrLayer(e)
      },
      callback: handleAnomalyDetection
    },
    { type: "line", show: function (e: any) { return isBlankOrLayer(e) } },
    {
      text: "清理临时要素",
      icon: "fa fa-trash",
      show: function (e: any) {
        return isBlankOrLayer(e)
      },
      callback: handleCleanup
    },
    {
      text: "清理工作区图层",
      icon: "fa fa-trash-o",
      show: function (e: any) {
        return isBlankOrLayer(e)
      },
      callback: handleClearWorkspaceLayers
    },
    {
      text: "清理缓存并重置",
      icon: "fa fa-eraser",
      show: function (e: any) {
        return isBlankOrLayer(e)
      },
      callback: handleClearWorkspaceAndCache
    },

    // ==================== 点标记菜单 ====================
    {
      text: "定位",
      icon: "fa fa-crosshairs",
      show: function (e: any) {
        return isPointMarker(e)
      },
      callback: handleLocate
    },
    {
      text: "缓冲区分析",
      icon: "fa fa-bullseye",
      show: function (e: any) {
        return isPointMarker(e)
      },
      callback: handleBufferAnalysis
    },
    {
      text: "编辑",
      icon: "fa fa-edit",
      show: function (e: any) {
        return isPointMarker(e)
      },
      callback: handleEdit
    },
    {
      text: "标记为异常点",
      icon: "fa fa-exclamation-triangle",
      show: function (e: any) {
        return isPointMarker(e) && !isAnomalyMarker(e)
      },
      callback: handleMarkAsAnomaly
    },
    {
      text: "取消异常标记",
      icon: "fa fa-check-circle",
      show: function (e: any) {
        return isAnomalyMarker(e)
      },
      callback: handleUnmarkAnomaly
    },
    { type: "line", show: function (e: any) { return isPointMarker(e) } },
    {
      text: "复制坐标",
      icon: "fa fa-copy",
      show: function (e: any) {
        return isPointMarker(e)
      },
      callback: handleCopyCoordinate
    },
    { type: "line", show: function (e: any) { return isPointMarker(e) } },
    { type: "line", show: function (e: any) { return isPointMarker(e) } },
    {
      text: "导出",
      icon: "fa fa-download",
      show: function (e: any) {
        return isPointMarker(e)
      },
      callback: handleExport
    },
    { type: "line", show: function (e: any) { return isPointMarker(e) } },
    {
      text: "删除",
      icon: "fa fa-trash",
      show: function (e: any) {
        return isPointMarker(e)
      },
      callback: handleDelete
    },

    // ==================== 线标记菜单 ====================
    {
      text: "定位",
      icon: "fa fa-crosshairs",
      show: function (e: any) {
        return isLineMarker(e)
      },
      callback: handleLocate
    },
    {
      text: "剖面分析",
      icon: "fa fa-line-chart",
      show: function (e: any) {
        return isLineMarker(e)
      },
      disabled: function (e: any) {
        if (!canUse("analysis:profile")) {
          return true
        }
        if (!hasServiceForAnalysis()) {
          return true
        }
        const graphic = resolveSelectedLine(e)
        return !graphic
      },
      disabledReason: function (e: any) {
        if (!canUse("analysis:profile")) {
          return reasonNoPermission
        }
        if (!hasServiceForAnalysis()) {
          return reasonServiceUnavailable
        }
        const graphic = resolveSelectedLine(e)
        return graphic ? "" : "请先选择线对象或生成剖面线"
      },
      callback: handleProfileAnalysis
    },
    {
      text: "缓冲区分析",
      icon: "fa fa-bullseye",
      show: function (e: any) {
        return isLineMarker(e)
      },
      callback: handleBufferAnalysis
    },
    {
      text: "编辑",
      icon: "fa fa-edit",
      show: function (e: any) {
        return isLineMarker(e)
      },
      callback: handleEdit
    },
    { type: "line", show: function (e: any) { return isLineMarker(e) } },
    {
      text: "复制坐标",
      icon: "fa fa-copy",
      show: function (e: any) {
        return isLineMarker(e)
      },
      callback: handleCopyLineCoordinates
    },
    { type: "line", show: function (e: any) { return isLineMarker(e) } },
    {
      text: "导出",
      icon: "fa fa-download",
      show: function (e: any) {
        return isLineMarker(e)
      },
      callback: handleExport
    },
    { type: "line", show: function (e: any) { return isLineMarker(e) } },
    {
      text: "删除",
      icon: "fa fa-trash",
      show: function (e: any) {
        return isLineMarker(e)
      },
      callback: handleDelete
    },

    // ==================== 面标记菜单 ====================
    {
      text: "定位",
      icon: "fa fa-crosshairs",
      show: function (e: any) {
        return isPolygonMarker(e)
      },
      callback: handleLocate
    },
    {
      text: "编辑",
      icon: "fa fa-edit",
      show: function (e: any) {
        return isPolygonMarker(e)
      },
      callback: handleEdit
    },
    { type: "line", show: function (e: any) { return isPolygonMarker(e) } },
    {
      text: "复制坐标",
      icon: "fa fa-copy",
      show: function (e: any) {
        return isPolygonMarker(e)
      },
      callback: handleCopyPolygonCoordinates
    },
    {
      text: "复制面积",
      icon: "fa fa-expand",
      show: function (e: any) {
        return isPolygonMarker(e)
      },
      callback: async (e: any) => {
        const area = getPolygonArea(e.graphic)
        if (area === null) {
          onToast("无法获取面积", "error")
          return
        }
        const areaText = formatArea(area)
        try {
          await navigator.clipboard.writeText(areaText)
          onToast(`已复制: ${areaText}`, "success")
        } catch {
          onToast("复制失败", "error")
        }
      }
    },
    { type: "line", show: function (e: any) { return isPolygonMarker(e) } },
    {
      text: "异常检测",
      icon: "fa fa-fire",
      show: function (e: any) {
        return isPolygonMarker(e)
      },
      callback: handleAnomalyDetectionObject
    },
    { type: "line", show: function (e: any) { return isPolygonMarker(e) } },
    {
      text: "导出",
      icon: "fa fa-download",
      show: function (e: any) {
        return isPolygonMarker(e)
      },
      callback: handleExport
    },
    { type: "line", show: function (e: any) { return isPolygonMarker(e) } },
    {
      text: "删除",
      icon: "fa fa-trash",
      show: function (e: any) {
        return isPolygonMarker(e)
      },
      callback: handleDelete
    },

    // ==================== 告警对象菜单 ====================
    {
      text: "定位",
      icon: "fa fa-crosshairs",
      show: function (e: any) {
        return isAlert(e)
      },
      callback: handleLocate
    },
    { type: "line", show: function (e: any) { return isAlert(e) } },
    {
      text: "打开告警确认",
      icon: "fa fa-exclamation-circle",
      show: function (e: any) {
        return isAlert(e)
      },
      callback: handleOpenAlertConfirm
    },
    {
      text: "快速分析",
      icon: "fa fa-bolt",
      show: function (e: any) {
        return isAlert(e)
      },
      callback: handleQuickAnalysis
    },
    { type: "line", show: function (e: any) { return isAlert(e) } },
    {
      text: "忽略此告警",
      icon: "fa fa-bell-slash",
      show: function (e: any) {
        return isAlert(e)
      },
      callback: handleIgnoreAlert
    }
  ]
}
