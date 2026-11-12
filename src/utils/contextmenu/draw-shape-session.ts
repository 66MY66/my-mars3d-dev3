import * as mars3d from "mars3d"
import {
  acceptPulledPoint,
  baselineParameter,
  createShapeBaseline,
  pointOnBaseline,
  shapeVertices,
  type LngLat,
  type ShapeBaseline
} from "./draw-shape"

type Toast = (message: string, type?: "success" | "error" | "info") => void

export type ShapeEditSource = {
  graphic: any
  baseline: [LngLat, LngLat]
  pulls: LngLat[]
}

type Session = {
  stop: () => void
}

const LINE_HIT_PX = 14
const PULL_AWAY_PX = 22

let activeSession: Session | null = null

function toLngLat(cartesian: unknown): LngLat | null {
  const point = mars3d.LngLatPoint.fromCartesian(cartesian as any)
  if (!point || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
    return null
  }
  return { lng: point.lng, lat: point.lat }
}

function plainPoint(point: LngLat): LngLat {
  return { lng: point.lng, lat: point.lat }
}

function pick(map: mars3d.Map, event: MouseEvent): LngLat | null {
  const canvas = map.viewer.canvas
  const rect = canvas.getBoundingClientRect()
  const windowPosition = new mars3d.Cesium.Cartesian2(event.clientX - rect.left, event.clientY - rect.top)
  const cartesian = map.viewer.camera.pickEllipsoid(windowPosition, map.viewer.scene.globe.ellipsoid)
  return cartesian ? toLngLat(cartesian) : null
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

function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
}

export function startDrawShapeSession(map: mars3d.Map, onToast: Toast, edit?: ShapeEditSource) {
  activeSession?.stop()

  const canvas = map.viewer.canvas
  const Cesium = mars3d.Cesium
  let phase: "line" | "pull" = "line"
  let anchors: LngLat[] = []
  let pulls: LngLat[] = []
  let draft: LngLat | null = null
  let baseline: ShapeBaseline | null = null
  let hover: LngLat | null = null
  let following = false
  let followMode: "slide" | "pull" = "slide"
  let ignoreNextClick = false
  let lineGraphic: any = null
  let previewGraphic: any = null
  let handleGraphics: any[] = []
  let hiddenGraphics: any[] = []
  let saved = false
  let stopped = false

  const removeGraphic = (graphic: any) => {
    if (!graphic) {
      return
    }
    try {
      map.graphicLayer.removeGraphic(graphic)
    } catch {
      // The layer may already have dropped the temporary graphic.
    }
  }

  const setVisible = (graphic: any, visible: boolean) => {
    if (!graphic) {
      return
    }
    try {
      graphic.show = visible
    } catch {
      // A graphic can already have been removed.
    }
  }

  const screenOf = (point: LngLat) => {
    const cartesian = Cesium.Cartesian3.fromDegrees(point.lng, point.lat)
    const windowPosition = map.viewer.scene.cartesianToCanvasCoordinates(cartesian)
    return windowPosition ? { x: windowPosition.x, y: windowPosition.y } : null
  }

  const canvasPoint = (event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const hitsBaseline = (event: MouseEvent) => {
    if (!baseline) {
      return false
    }
    const start = screenOf(baseline.a)
    const end = screenOf(baseline.b)
    if (!start || !end) {
      return false
    }
    return distanceToSegment(canvasPoint(event), start, end) <= LINE_HIT_PX
  }

  const ensureLine = (positions: LngLat[]) => {
    const coords = positions.map((point) => [point.lng, point.lat, 0])
    if (coords.length < 2) {
      removeGraphic(lineGraphic)
      lineGraphic = null
      return
    }
    if (!lineGraphic) {
      lineGraphic = new mars3d.graphic.PolylineEntity({
        positions: coords,
        style: { color: "#00ffff", width: 2, clampToGround: true },
        attr: { drawShapeGuide: true }
      })
      map.graphicLayer.addGraphic(lineGraphic)
      return
    }
    lineGraphic.positions = coords
  }

  const ensurePreview = (positions: LngLat[] | null) => {
    if (!positions || positions.length < 3) {
      removeGraphic(previewGraphic)
      previewGraphic = null
      return
    }
    const coords = positions.map((point) => [point.lng, point.lat, 0])
    if (!previewGraphic) {
      previewGraphic = new mars3d.graphic.PolygonEntity({
        positions: coords,
        style: {
          color: "#00ffff",
          opacity: 0.25,
          outline: true,
          outlineWidth: 2,
          outlineColor: "#00ffff",
          clampToGround: true
        },
        attr: { drawShapePreview: true }
      })
      map.graphicLayer.addGraphic(previewGraphic)
      return
    }
    previewGraphic.positions = coords
  }

  const syncHandles = (points: LngLat[]) => {
    while (handleGraphics.length > points.length) {
      removeGraphic(handleGraphics.pop())
    }
    points.forEach((point, index) => {
      const position = [point.lng, point.lat, 0]
      if (!handleGraphics[index]) {
        handleGraphics[index] = new mars3d.graphic.PointEntity({
          position,
          style: {
            pixelSize: 12,
            color: "#00ffff",
            outline: true,
            outlineColor: "#ffffff",
            outlineWidth: 2,
            clampToGround: true
          },
          attr: { drawShapeHandle: true }
        })
        map.graphicLayer.addGraphic(handleGraphics[index])
        return
      }
      handleGraphics[index].position = position
    })
  }

  const refresh = () => {
    if (phase === "line") {
      ensureLine(hover && anchors.length === 1 ? [...anchors, hover] : anchors)
      ensurePreview(null)
      syncHandles([])
      return
    }
    ensureLine(anchors)
    const previewPulls = baseline && draft && acceptPulledPoint(baseline, pulls, draft).ok ? [...pulls, draft] : pulls
    ensurePreview(baseline && previewPulls.length ? shapeVertices(baseline, previewPulls) : null)
    syncHandles(draft ? [...pulls, draft] : pulls)
  }

  const restoreHidden = () => {
    hiddenGraphics.forEach((graphic) => setVisible(graphic, true))
    hiddenGraphics = []
  }

  const stop = () => {
    if (stopped) {
      return
    }
    stopped = true
    canvas.removeEventListener("click", onClick, true)
    canvas.removeEventListener("dblclick", onDoubleClick, true)
    canvas.removeEventListener("contextmenu", onRightClick, true)
    canvas.removeEventListener("mousemove", onMouseMove, true)
    canvas.removeEventListener("pointerdown", onPointerDown, true)
    window.removeEventListener("keydown", onKeyDown, true)
    removeGraphic(lineGraphic)
    removeGraphic(previewGraphic)
    handleGraphics.forEach(removeGraphic)
    lineGraphic = null
    previewGraphic = null
    handleGraphics = []
    if (!saved) {
      restoreHidden()
    }
    if (activeSession?.stop === stop) {
      activeSession = null
    }
  }

  const beginPull = () => {
    baseline = createShapeBaseline(anchors[0], anchors[1])
    if (!baseline) {
      anchors = anchors.slice(0, 1)
      onToast("两个点距离过近，请重新单击结束点", "error")
      refresh()
      return
    }
    phase = "pull"
    hover = null
    onToast("单击底边出现圆点，先沿线滑动，再向外拉", "info")
    refresh()
  }

  const confirmDraft = () => {
    if (!baseline || !draft) {
      return
    }
    const accepted = acceptPulledPoint(baseline, pulls, draft)
    if (!accepted.ok) {
      onToast(accepted.reason, "info")
      refresh()
      return
    }
    pulls = [...pulls, accepted.point]
    draft = null
    following = false
    followMode = "slide"
    refresh()
    onToast(pulls.length === 1 ? "已确认这个面，可在另一侧再选一点；双击可直接结束" : "已确认第二个点，单击或双击结束", "info")
  }

  const commit = () => {
    if (stopped) {
      return
    }
    if (!baseline || !pulls.length) {
      onToast("请先把点向外拉出底边", "info")
      return
    }
    const ring = shapeVertices(baseline, pulls)
    const positions = ring.map((point) => Cesium.Cartesian3.fromDegrees(point.lng, point.lat))
    const polygon = new mars3d.graphic.PolygonEntity({
      positions: ring.map((point) => [point.lng, point.lat, 0]),
      style: {
        color: "#00ffff",
        opacity: 0.4,
        outline: true,
        outlineWidth: 2,
        outlineColor: "#00ffff",
        clampToGround: true
      },
      attr: {
        drawShape: true,
        drawShapeBaseline: { a: plainPoint(baseline.a), b: plainPoint(baseline.b) },
        drawShapePulls: pulls.map(plainPoint)
      }
    })
    map.graphicLayer.addGraphic(polygon)
    let areaText = ""
    try {
      const area = mars3d.MeasureUtil.getArea(positions)
      const center = mars3d.PolyUtil.centerOfMass(positions)
      areaText = formatArea(area)
      map.graphicLayer.addGraphic(new mars3d.graphic.LabelPrimitive({
        position: center,
        style: {
          text: areaText,
          font_size: 14,
          font_family: "微软雅黑",
          fillColor: "#ffffff",
          outlineColor: "#000000",
          outlineWidth: 2,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffsetY: -10
        },
        attr: { measure: true, parentId: polygon.id }
      }))
    } catch {
      areaText = ""
    }
    if (edit?.graphic) {
      const oldId = edit.graphic.id
      ;(map.graphicLayer.getGraphics?.() || []).forEach((graphic: any) => {
        if (graphic?.attr?.parentId === oldId) {
          removeGraphic(graphic)
        }
      })
      removeGraphic(edit.graphic)
      hiddenGraphics = hiddenGraphics.filter((graphic) => graphic !== edit.graphic)
    }
    saved = true
    hiddenGraphics = []
    stop()
    onToast(areaText ? `绘制完成，面积: ${areaText}` : "绘制形已完成", "success")
  }

  const onClick = (event: MouseEvent) => {
    if (event.button !== 0) {
      return
    }
    if (ignoreNextClick) {
      ignoreNextClick = false
      return
    }
    const point = pick(map, event)
    if (!point) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    if (phase === "line") {
      if (event.detail > 1 || anchors.length >= 2) {
        return
      }
      anchors = [...anchors, point]
      refresh()
      if (anchors.length === 2) {
        beginPull()
      }
      return
    }
    if (!following && pulls.length >= 2) {
      commit()
      return
    }
    if (following) {
      confirmDraft()
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (phase !== "pull" || event.button !== 0 || following || !baseline || pulls.length >= 2) {
      return
    }
    const point = pick(map, event)
    if (!point || !hitsBaseline(event)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    ignoreNextClick = true
    following = true
    followMode = "slide"
    draft = pointOnBaseline(baseline, baselineParameter(baseline, point))
    refresh()
  }

  const onDoubleClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    ignoreNextClick = false
    if (phase === "line" || (!following && pulls.length === 0)) {
      return
    }
    if (following && baseline && draft) {
      const accepted = acceptPulledPoint(baseline, pulls, draft)
      if (accepted.ok) {
        pulls = [...pulls, accepted.point]
      }
    }
    draft = null
    following = false
    followMode = "slide"
    commit()
  }

  const onRightClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    ignoreNextClick = false
    if (following || draft) {
      draft = null
      following = false
      followMode = "slide"
      refresh()
      return
    }
    if (phase === "line") {
      if (!anchors.length) {
        stop()
        onToast(edit ? "已取消编辑" : "已取消绘制形", "info")
        return
      }
      anchors = anchors.slice(0, -1)
      refresh()
      return
    }
    if (pulls.length) {
      pulls = pulls.slice(0, -1)
      refresh()
      return
    }
    if (edit) {
      stop()
      onToast("已取消编辑", "info")
      return
    }
    anchors = anchors.slice(0, 1)
    baseline = null
    phase = "line"
    refresh()
  }

  const onMouseMove = (event: MouseEvent) => {
    const point = pick(map, event)
    if (following && baseline) {
      event.preventDefault()
      event.stopPropagation()
      if (!point) {
        return
      }
      const cursor = canvasPoint(event)
      const start = screenOf(baseline.a)
      const end = screenOf(baseline.b)
      const away = start && end ? distanceToSegment(cursor, start, end) : PULL_AWAY_PX
      if (followMode === "slide" && away > PULL_AWAY_PX) {
        followMode = "pull"
      }
      draft = followMode === "slide" ? pointOnBaseline(baseline, baselineParameter(baseline, point)) : point
      refresh()
      return
    }
    hover = point
    if (phase === "line") {
      refresh()
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") {
      return
    }
    stop()
    onToast(edit ? "已取消编辑" : "已取消绘制形", "info")
  }

  canvas.addEventListener("click", onClick, true)
  canvas.addEventListener("dblclick", onDoubleClick, true)
  canvas.addEventListener("contextmenu", onRightClick, true)
  canvas.addEventListener("mousemove", onMouseMove, true)
  canvas.addEventListener("pointerdown", onPointerDown, true)
  window.addEventListener("keydown", onKeyDown, true)

  if (edit?.baseline?.length === 2) {
    anchors = [plainPoint(edit.baseline[0]), plainPoint(edit.baseline[1])]
    baseline = createShapeBaseline(anchors[0], anchors[1])
    pulls = (edit.pulls || []).map(plainPoint).slice(0, 2)
    if (baseline) {
      phase = "pull"
      hiddenGraphics = [edit.graphic, ...(map.graphicLayer.getGraphics?.() || []).filter((graphic: any) => graphic?.attr?.parentId === edit.graphic?.id)]
      hiddenGraphics.forEach((graphic) => setVisible(graphic, false))
      onToast("沿原来的底边修改：单击确认拉出点，双击结束", "info")
      refresh()
    } else {
      onToast("原来的底边无效，请重新绘制", "error")
    }
  } else {
    onToast("绘制形：左键单击两个点成线，右键撤销上一点", "info")
  }

  const session = { stop }
  activeSession = session
}
