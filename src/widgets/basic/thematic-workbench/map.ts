import * as mars3d from "mars3d"

export const eventTarget = new mars3d.BaseClass()

type RectInfo = { west: number; south: number; east: number; north: number }

let map: mars3d.Map | undefined
let drawLayer: mars3d.layer.GraphicLayer | undefined
let startPoint: mars3d.LngLatPoint | null = null
let currentGraphic: any = null
let currentRectInfo: RectInfo | null = null
let screenSpaceHandler: any | null = null
let lastLeftClickAt = 0
let lastLeftClickPosition: { x: number; y: number } | null = null

const DOUBLE_CLICK_DELAY = 320
const DOUBLE_CLICK_DISTANCE = 12

function ensureDrawLayer() {
  if (!map) {
    return null
  }
  if (!drawLayer) {
    drawLayer = new mars3d.layer.GraphicLayer({ id: "thematic-workbench-draw-layer" })
    map.addLayer(drawLayer)
  }
  return drawLayer
}

function clearCurrentGraphic() {
  try {
    drawLayer?.clear?.()
  } catch {}
  currentGraphic = null
  currentRectInfo = null
  startPoint = null
  lastLeftClickAt = 0
  lastLeftClickPosition = null
}

function stopRectangleSelectionListener() {
  if (screenSpaceHandler) {
    try {
      screenSpaceHandler.destroy()
    } catch {}
  }
  screenSpaceHandler = null
  try {
    map?.setCursor?.("")
  } catch {}
}

function getLngLatPointFromWindowPosition(position: any) {
  if (!map || !position) {
    return null
  }
  const Cesium = mars3d.Cesium
  const scene = map.scene
  let cartesian = null
  try {
    if (scene.pickPositionSupported) {
      cartesian = scene.pickPosition(position)
    }
  } catch {}
  if (!cartesian) {
    try {
      const ray = map.camera?.getPickRay?.(position)
      cartesian = ray ? scene.globe?.pick?.(ray, scene) : null
    } catch {}
  }
  if (!cartesian) {
    return null
  }
  const point = mars3d.LngLatPoint.fromCartesian(cartesian)
  if (!point) {
    return null
  }
  point.format?.()
  return point
}

function isDoubleClickGesture(position: any) {
  const now = Date.now()
  const x = Number(position?.x ?? position?.clientX ?? 0)
  const y = Number(position?.y ?? position?.clientY ?? 0)
  const prev = lastLeftClickPosition
  const withinDelay = now - lastLeftClickAt <= DOUBLE_CLICK_DELAY
  const withinDistance = !!prev && Math.abs(prev.x - x) <= DOUBLE_CLICK_DISTANCE && Math.abs(prev.y - y) <= DOUBLE_CLICK_DISTANCE
  lastLeftClickAt = now
  lastLeftClickPosition = { x, y }
  return withinDelay && withinDistance
}

function getRectInfoFromPoints(a: mars3d.LngLatPoint, b: mars3d.LngLatPoint): RectInfo {
  return {
    west: Math.min(a.lng, b.lng),
    south: Math.min(a.lat, b.lat),
    east: Math.max(a.lng, b.lng),
    north: Math.max(a.lat, b.lat)
  }
}

function getToolbarAnchor(rectInfo: RectInfo) {
  if (!map) {
    return { left: window.innerWidth / 2, top: window.innerHeight / 2 }
  }
  const Cesium = mars3d.Cesium
  const lng = (rectInfo.west + rectInfo.east) / 2
  const lat = rectInfo.south
  const cartesian = Cesium.Cartesian3.fromDegrees(lng, lat)
  const screen = map.scene?.cartesianToCanvasCoordinates?.(cartesian)
  if (!screen) {
    return { left: window.innerWidth / 2, top: window.innerHeight / 2 }
  }
  return {
    left: Number(screen.x),
    top: Number(screen.y) + 18
  }
}

function emitSelectionCreated(rectInfo: RectInfo) {
  const anchor = getToolbarAnchor(rectInfo)
  eventTarget.fire("selectionCreated", {
    rectangle: rectInfo,
    anchor
  })
}

function drawRectangleByPoints(a: mars3d.LngLatPoint, b: mars3d.LngLatPoint) {
  const layer = ensureDrawLayer()
  if (!layer) {
    return null
  }
  const rectInfo = getRectInfoFromPoints(a, b)
  const positions = [
    [rectInfo.west, rectInfo.north, 0],
    [rectInfo.east, rectInfo.north, 0],
    [rectInfo.east, rectInfo.south, 0],
    [rectInfo.west, rectInfo.south, 0]
  ]
  const graphic = new mars3d.graphic.PolygonEntity({
    positions,
    style: {
      fill: true,
      color: "rgba(65,168,255,0.18)",
      outline: true,
      outlineWidth: 2,
      outlineColor: "rgba(65,168,255,0.95)"
    }
  })
  layer.addGraphic(graphic)
  currentGraphic = graphic
  currentRectInfo = rectInfo
  emitSelectionCreated(rectInfo)
  return graphic
}

function getSelectionCanvasBounds(rectInfo: RectInfo) {
  if (!map) {
    return null
  }
  const Cesium = mars3d.Cesium
  const points = [
    Cesium.Cartesian3.fromDegrees(rectInfo.west, rectInfo.north),
    Cesium.Cartesian3.fromDegrees(rectInfo.east, rectInfo.north),
    Cesium.Cartesian3.fromDegrees(rectInfo.east, rectInfo.south),
    Cesium.Cartesian3.fromDegrees(rectInfo.west, rectInfo.south)
  ]
  const screens = points
    .map((item) => map?.scene?.cartesianToCanvasCoordinates?.(item))
    .filter(Boolean)
  if (screens.length < 4) {
    return null
  }
  const xs = screens.map((item: any) => Number(item.x))
  const ys = screens.map((item: any) => Number(item.y))
  const left = Math.max(0, Math.floor(Math.min(...xs)))
  const top = Math.max(0, Math.floor(Math.min(...ys)))
  const right = Math.ceil(Math.max(...xs))
  const bottom = Math.ceil(Math.max(...ys))
  const width = Math.max(1, right - left)
  const height = Math.max(1, bottom - top)
  return { left, top, width, height }
}

async function nextFrame() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b || new Blob([], { type: mime })),
      mime,
      mime === "image/jpeg" ? quality : undefined
    )
  })
}

export function onMounted(mapInstance: mars3d.Map): void {
  map = mapInstance
}

export function onUnmounted(): void {
  stopRectangleSelectionListener()
  clearCurrentGraphic()
  if (drawLayer) {
    try {
      map?.removeLayer?.(drawLayer, true)
    } catch {}
  }
  drawLayer = undefined
  map = undefined
  eventTarget.off()
}

export function beginRectangleSelection() {
  const layer = ensureDrawLayer()
  if (!layer || !map) {
    return
  }
  clearCurrentGraphic()
  stopRectangleSelectionListener()
  map.setCursor("crosshair")
  const Cesium = mars3d.Cesium
  const canvas = map.scene?.canvas
  if (!canvas) {
    eventTarget.fire("selectionCanceled", {})
    return
  }
  screenSpaceHandler = new Cesium.ScreenSpaceEventHandler(canvas)
  screenSpaceHandler.setInputAction((event: any) => {
    if (!isDoubleClickGesture(event?.position)) {
      return
    }
    const point = getLngLatPointFromWindowPosition(event?.position)
    if (!point) {
      return
    }
    if (!startPoint) {
      startPoint = point
      eventTarget.fire("selectionHint", { step: 1 })
      return
    }
    const firstPoint = startPoint
    clearCurrentGraphic()
    drawRectangleByPoints(firstPoint, point)
    stopRectangleSelectionListener()
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  screenSpaceHandler.setInputAction(() => {
    cancelRectangleSelection()
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
}

export function redrawRectangleSelection() {
  beginRectangleSelection()
}

export function cancelRectangleSelection() {
  stopRectangleSelectionListener()
  clearCurrentGraphic()
  eventTarget.fire("selectionCanceled", {})
}

export function confirmRectangleSelection() {
  if (!currentRectInfo) {
    return
  }
  eventTarget.fire("selectionConfirmed", {
    rectangle: currentRectInfo
  })
}

export async function captureSelectionImage(options?: {
  targetWidth?: number
  targetHeight?: number
  mime?: "image/jpeg" | "image/png"
  quality?: number
}): Promise<Blob | null> {
  if (!map || !currentRectInfo) {
    return null
  }
  const canvas = map.scene?.canvas as HTMLCanvasElement | undefined
  if (!canvas) {
    return null
  }
  try {
    map.scene.requestRender?.()
  } catch {}
  await nextFrame()
  await nextFrame()

  const bounds = getSelectionCanvasBounds(currentRectInfo)
  if (!bounds) {
    return null
  }

  const mime = options?.mime || "image/jpeg"
  const quality = typeof options?.quality === "number" ? options.quality : 0.9
  const sourceWidth = canvas.width || canvas.clientWidth
  const sourceHeight = canvas.height || canvas.clientHeight
  if (!sourceWidth || !sourceHeight) {
    return null
  }

  const scaleX = sourceWidth / Math.max(1, canvas.clientWidth || sourceWidth)
  const scaleY = sourceHeight / Math.max(1, canvas.clientHeight || sourceHeight)
  const sx = Math.max(0, Math.floor(bounds.left * scaleX))
  const sy = Math.max(0, Math.floor(bounds.top * scaleY))
  const sw = Math.max(1, Math.min(sourceWidth - sx, Math.floor(bounds.width * scaleX)))
  const sh = Math.max(1, Math.min(sourceHeight - sy, Math.floor(bounds.height * scaleY)))

  const targetWidth = options?.targetWidth || sw
  const targetHeight = options?.targetHeight || sh
  const out = document.createElement("canvas")
  out.width = targetWidth
  out.height = targetHeight
  const ctx = out.getContext("2d")
  if (!ctx) {
    return null
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  const scale = Math.min(targetWidth / sw, targetHeight / sh)
  const dw = Math.round(sw * scale)
  const dh = Math.round(sh * scale)
  const dx = Math.round((targetWidth - dw) / 2)
  const dy = Math.round((targetHeight - dh) / 2)
  ctx.fillStyle = "#0f1720"
  ctx.fillRect(0, 0, targetWidth, targetHeight)
  ctx.drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh)
  return await canvasToBlob(out, mime, quality)
}
