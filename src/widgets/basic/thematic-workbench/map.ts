import * as mars3d from "mars3d"
import { compositionSymbolImage } from "./composition-symbols"
import { SNAP_DISTANCE, snapToFeatures, type Point2D } from "./cartography-layout"
import type { EarthquakePoint } from "./earthquake-analysis"
import { earthquakeLegend, type EarthquakePalette } from "./earthquake-palette"
import type { CartographySymbolKind, TemplateIconBinding } from "./template-icon-registry"
import type { DisplayPoint, DisplayPolygon, EffectSettings, LegendEntry } from "./display-model"
import { inBounds, uniqueLegend } from "./display-model"
import type { Thematic3D } from "./thematic-3d"
import type { TemplateScene } from "./template-renderer"
import { mapTemplatePalettes, templateHeatGradient } from "./template-palettes"
import type { DbtMapPreview } from "./dbt-draft-preview"

export const eventTarget = new mars3d.BaseClass()

export type RectInfo = { west: number; south: number; east: number; north: number }
export type CartographySymbolStyle = { size: number; rotation: number; opacity: number; color: string }
type SelectionViewportBounds = { left: number; top: number; width: number; height: number }
type RectangleSelectionOptions = { rightReserve?: number }

export const SELECTION_FRAME_WIDTH = 10

let map: mars3d.Map | undefined
let drawLayer: mars3d.layer.GraphicLayer | undefined
let rasterResultLayer: mars3d.layer.GraphicLayer | undefined
let templateHeatLayer: mars3d.layer.HeatLayer | undefined
let earthquakeResultLayer: mars3d.layer.GraphicLayer | undefined
let cartographySymbolLayer: mars3d.layer.GraphicLayer | undefined
let threeEffects: Thematic3D | undefined
let threeRevision = 0
let rasterGraphic: mars3d.graphic.RectangleEntity | undefined
let pointGraphics: mars3d.graphic.PointEntity[] = []
let displaySettings: EffectSettings | null = null
export type DisplaySource = {
  kind: "points" | "raster" | "polygons"; points: DisplayPoint[]; image: string; rectangle: RectInfo
  name: string; source: string; time: string; unit: string; legend: LegendEntry[]
  polygons?: DisplayPolygon[]
  flatPolygons?: boolean
  opacity?: number
  businessPalette?: EarthquakePalette
  templateInput?: string
  templateKind?: string
}
let displaySource: DisplaySource | null = null
let displayMetadata: Pick<DisplaySource, "name" | "source" | "time" | "unit" | "businessPalette"> = { name: "专题分析图", source: "当前地图截图（RGB 像元）", time: "", unit: "RGB 亮度" }
let symbolPlacementHandler: ((event: any) => void) | null = null
let symbolDragCleanup: (() => void) | null = null
let nextSymbolId = 1
let symbolSnapping = true
const cartographySymbols = new Map<string, { graphic: mars3d.graphic.DivGraphic; binding: TemplateIconBinding; style: CartographySymbolStyle }>()
let startPoint: mars3d.LngLatPoint | null = null
let currentGraphic: any = null
let currentRectInfo: RectInfo | null = null
let selectionLocked = false
let screenSpaceHandler: any | null = null
let selectionBoundsCleanup: (() => void) | null = null
let lastSelectionBoundsKey = ""
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

function ensureRasterResultLayer() {
  if (!map) {
    return null
  }
  if (!rasterResultLayer) {
    rasterResultLayer = new mars3d.layer.GraphicLayer({
      id: "thematic-workbench-raster-result-layer",
      name: "栅格计算结果"
    })
    map.addLayer(rasterResultLayer)
  }
  return rasterResultLayer
}

function ensureEarthquakeResultLayer() {
  if (!map) { return null }
  if (!earthquakeResultLayer) {
    earthquakeResultLayer = new mars3d.layer.GraphicLayer({ id: "thematic-workbench-earthquake-result-layer", name: "地震专题观测结果" })
    map.addLayer(earthquakeResultLayer)
  }
  return earthquakeResultLayer
}

function symbolSvg(binding: TemplateIconBinding, style: CartographySymbolStyle) {
  return `<img src="${compositionSymbolImage(binding.kind as CartographySymbolKind, style.color)}" alt="" style="width:100%;height:100%;object-fit:contain;pointer-events:none" />`
}
function symbolHtml(id: string, binding: TemplateIconBinding, style: CartographySymbolStyle) {
  const color = /^#[\da-f]{6}$/i.test(style.color) ? style.color : binding.accent
  const svg = symbolSvg(binding, style)
  const size = Math.max(22, Math.min(64, style.size))
  const rotation = Math.max(-180, Math.min(180, style.rotation))
  const opacity = Math.max(0.2, Math.min(1, style.opacity))
  return `<div class="thematic-map-symbol" role="button" tabindex="0" aria-label="${binding.label}图标，双击删除" title="${binding.label} · 拖动调整位置，双击删除" data-symbol-id="${id}" style="--symbol-color:${color};--symbol-size:${size}px;--symbol-opacity:${opacity};--symbol-rotation:${rotation}deg"><span class="thematic-map-symbol-core">${svg}</span></div>`
}

export function setCartographySnapping(enabled: boolean) { symbolSnapping = enabled }
export function getCartographySymbols() {
  return Array.from(cartographySymbols.values()).map(item => ({ kind: item.binding.kind, family: item.binding.family, lon: item.graphic.point.lng, lat: item.graphic.point.lat, style: { ...item.style } }))
}
function snapSymbol(point: mars3d.LngLatPoint, size: number, excludeId?: string) {
  if (!map || !currentRectInfo) { return point }
  const C = mars3d.Cesium
  const project = (lng: number, lat: number): Point2D | null => map?.scene?.cartesianToCanvasCoordinates?.(C.Cartesian3.fromDegrees(lng, lat)) || null
  const origin = project(point.lng, point.lat)
  const bounds = getSelectionCanvasBounds(currentRectInfo)
  if (!origin || !bounds) { return point }
  const canvas = map.scene.canvas
  const factor = canvas.getBoundingClientRect().width / (canvas.clientWidth || 1)
  const threshold = SNAP_DISTANCE / (factor || 1)
  const points: Point2D[] = []
  const segments: Array<[Point2D, Point2D]> = []
  if (symbolSnapping) {
    for (const candidate of displaySource?.points || []) {
      if (!inBounds(candidate, currentRectInfo)) { continue }
      const screen = project(candidate.lon, candidate.lat)
      if (screen) { points.push(screen) }
    }
    for (const [id, item] of cartographySymbols) {
      if (id === excludeId) { continue }
      const screen = project(item.graphic.point.lng, item.graphic.point.lat)
      if (screen) { points.push(screen) }
    }
    for (const polygon of displaySource?.polygons || []) {
      for (const ring of polygon.rings) {
        for (let i = 1; i < ring.length; i++) {
          const a = project(ring[i - 1][0], ring[i - 1][1]); const b = project(ring[i][0], ring[i][1])
          if (a && b) { segments.push([a, b]) }
        }
      }
    }
  }
  let target: Point2D = symbolSnapping ? snapToFeatures(origin, points, segments, threshold) : origin
  const radius = size / (factor || 1) / 2 + 2
  const left = bounds.left + radius; const right = bounds.left + bounds.width - radius
  const top = bounds.top + radius; const bottom = bounds.top + bounds.height - radius
  if (left > right || top > bottom) { return point }
  let x = Math.max(left, Math.min(right, target.x)); let y = Math.max(top, Math.min(bottom, target.y))
  if (symbolSnapping && target.x === origin.x && target.y === origin.y) {
    if (Math.abs(x - left) <= threshold) { x = left } else if (Math.abs(x - right) <= threshold) { x = right }
    if (Math.abs(y - top) <= threshold) { y = top } else if (Math.abs(y - bottom) <= threshold) { y = bottom }
  }
  target = { x, y }
  const snapped = getLngLatPointFromWindowPosition(new C.Cartesian2(target.x, target.y))
  return snapped && inBounds({ lon: snapped.lng, lat: snapped.lat }, currentRectInfo) ? snapped : point
}

function symbolTarget(event: Event): HTMLElement | null {
  return (event.target as HTMLElement | null)?.closest?.(".thematic-map-symbol") || null
}

function finishSymbolDrag() {
  symbolDragCleanup?.()
  symbolDragCleanup = null
}

function ensureCartographySymbolLayer() {
  if (!map) { return null }
  if (!cartographySymbolLayer) {
    cartographySymbolLayer = new mars3d.layer.GraphicLayer({ id: "thematic-workbench-symbol-layer", name: "专题制图标注" })
    map.addLayer(cartographySymbolLayer)
    const container = cartographySymbolLayer.container
    container.addEventListener("click", (event: MouseEvent) => {
      if (symbolTarget(event)) { event.stopPropagation() }
    })
    container.addEventListener("pointerdown", (event: PointerEvent) => {
      if (event.button !== 0) { return }
      const target = symbolTarget(event)
      const id = target?.dataset.symbolId
      const item = id ? cartographySymbols.get(id) : null
      if (!item || !currentRectInfo || !selectionLocked) { return }
      event.preventDefault()
      event.stopPropagation()
      eventTarget.fire("symbolSelected", { id })
      finishSymbolDrag()
      const controls = map?.scene?.screenSpaceCameraController
      const previousInputs = controls?.enableInputs
      if (controls) { controls.enableInputs = false }
      const onMove = (move: PointerEvent) => {
        const canvas = map?.scene?.canvas as HTMLCanvasElement | undefined
        if (!canvas || !currentRectInfo) { return }
        const rect = canvas.getBoundingClientRect()
        const position = new mars3d.Cesium.Cartesian2(
          (move.clientX - rect.left) * (canvas.clientWidth / rect.width),
          (move.clientY - rect.top) * (canvas.clientHeight / rect.height)
        )
        let point = getLngLatPointFromWindowPosition(position)
        if (!point || point.lng < currentRectInfo.west || point.lng > currentRectInfo.east || point.lat < currentRectInfo.south || point.lat > currentRectInfo.north) { return }
        point = snapSymbol(point, item.style.size, id)
        item.graphic.position = mars3d.Cesium.Cartesian3.fromDegrees(point.lng, point.lat, 0)
        map?.scene?.requestRender?.()
      }
      const onUp = () => {
        finishSymbolDrag()
        eventTarget.fire("symbolMoved", { id, point: item.graphic.point })
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp, { once: true })
      window.addEventListener("pointercancel", onUp, { once: true })
      window.addEventListener("blur", onUp, { once: true })
      symbolDragCleanup = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onUp)
        window.removeEventListener("blur", onUp)
        if (controls && previousInputs !== undefined) { controls.enableInputs = previousInputs }
      }
    })
    container.addEventListener("dblclick", (event: MouseEvent) => {
      const id = symbolTarget(event)?.dataset.symbolId
      if (!id) { return }
      event.preventDefault()
      event.stopPropagation()
      removeCartographySymbol(id)
    })
    container.addEventListener("keydown", (event: KeyboardEvent) => {
      const id = symbolTarget(event)?.dataset.symbolId
      if (!id) { return }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        removeCartographySymbol(id)
      }
    })
  }
  return cartographySymbolLayer
}

export function cancelCartographySymbolPlacement() {
  if (map && symbolPlacementHandler) { map.off(mars3d.EventType.click, symbolPlacementHandler) }
  symbolPlacementHandler = null
  map?.setCursor?.("")
}

export function beginCartographySymbolPlacement(binding: TemplateIconBinding, style: CartographySymbolStyle) {
  const layer = ensureCartographySymbolLayer()
  if (!layer || !map || !selectionLocked || !currentRectInfo) { return false }
  cancelCartographySymbolPlacement()
  map.setCursor("crosshair")
  symbolPlacementHandler = (event: any) => {
    let point = event?.cartesian ? mars3d.LngLatPoint.fromCartesian(event.cartesian) : null
    cancelCartographySymbolPlacement()
    const rectangle = currentRectInfo
    if (!point || !rectangle || point.lng < rectangle.west || point.lng > rectangle.east || point.lat < rectangle.south || point.lat > rectangle.north) {
      eventTarget.fire("symbolPlacementRejected", {})
      return
    }
    point = snapSymbol(point, style.size)
    const id = `thematic-symbol-${nextSymbolId++}`
    const graphic = new mars3d.graphic.DivGraphic({
      position: [point.lng, point.lat, 0],
      pointerEvents: true,
      depthTest: false,
      style: { html: symbolHtml(id, binding, style), horizontalOrigin: mars3d.Cesium.HorizontalOrigin.CENTER, verticalOrigin: mars3d.Cesium.VerticalOrigin.CENTER },
      attr: { name: binding.label, kind: binding.kind, family: binding.family }
    })
    layer.addGraphic(graphic)
    cartographySymbols.set(id, { graphic, binding, style: { ...style } })
    eventTarget.fire("symbolPlaced", { id, binding, point })
  }
  map.once(mars3d.EventType.click, symbolPlacementHandler)
  return true
}

export function updateCartographySymbolStyle(id: string, style: CartographySymbolStyle) {
  const item = cartographySymbols.get(id)
  if (!item) { return false }
  item.style = { ...style }
  const point = snapSymbol(item.graphic.point, style.size, id)
  item.graphic.position = mars3d.Cesium.Cartesian3.fromDegrees(point.lng, point.lat, 0)
  item.graphic.setStyle({ html: symbolHtml(id, item.binding, style) })
  eventTarget.fire("symbolMoved", { id, point: item.graphic.point })
  map?.scene?.requestRender?.()
  return true
}

export function removeCartographySymbol(id: string) {
  const item = cartographySymbols.get(id)
  if (!item) { return false }
  finishSymbolDrag()
  cartographySymbolLayer?.removeGraphic(item.graphic, true)
  cartographySymbols.delete(id)
  eventTarget.fire("symbolRemoved", { id })
  return true
}

export function clearCartographySymbols() {
  cancelCartographySymbolPlacement()
  finishSymbolDrag()
  cartographySymbolLayer?.clear()
  cartographySymbols.clear()
  eventTarget.fire("symbolsCleared", {})
}

function clearCurrentGraphic() {
  try {
    drawLayer?.clear?.()
  } catch {}
  currentGraphic = null
  currentRectInfo = null
  selectionLocked = false
  startPoint = null
  lastLeftClickAt = 0
  lastLeftClickPosition = null
  stopSelectionBoundsListener()
}

function stopSelectionBoundsListener() {
  selectionBoundsCleanup?.()
  selectionBoundsCleanup = null
  lastSelectionBoundsKey = ""
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

function getSelectionViewportBounds(rectInfo: RectInfo): SelectionViewportBounds | null {
  const bounds = getSelectionCanvasBounds(rectInfo)
  const canvas = map?.scene?.canvas as HTMLCanvasElement | undefined
  if (!bounds || !canvas) {
    return null
  }
  const canvasRect = canvas.getBoundingClientRect()
  const coordinateWidth = Math.max(1, canvas.clientWidth || canvasRect.width)
  const coordinateHeight = Math.max(1, canvas.clientHeight || canvasRect.height)
  const scaleX = canvasRect.width / coordinateWidth
  const scaleY = canvasRect.height / coordinateHeight
  return {
    left: canvasRect.left + bounds.left * scaleX,
    top: canvasRect.top + bounds.top * scaleY,
    width: bounds.width * scaleX,
    height: bounds.height * scaleY
  }
}

function getCanvasViewportBounds(): SelectionViewportBounds | null {
  const canvas = map?.scene?.canvas as HTMLCanvasElement | undefined
  if (!canvas) {
    return null
  }
  const rect = canvas.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  }
}

function getToolbarAnchor(bounds: SelectionViewportBounds | null) {
  if (!bounds) {
    return { left: window.innerWidth / 2, top: window.innerHeight / 2 }
  }
  const toolbarOffset = SELECTION_FRAME_WIDTH + 10
  const below = bounds.top + bounds.height + toolbarOffset
  return {
    left: bounds.left + bounds.width / 2,
    top: below <= window.innerHeight - 62 ? below : Math.max(8, bounds.top - 62)
  }
}

function emitSelectionBounds(rectInfo: RectInfo, eventName: "selectionCreated" | "selectionBoundsChanged", changedOnly = false) {
  const bounds = getSelectionViewportBounds(rectInfo)
  const canvasBounds = getCanvasViewportBounds()
  const anchor = getToolbarAnchor(bounds)
  const key = [bounds?.left, bounds?.top, bounds?.width, bounds?.height,
    canvasBounds?.left, canvasBounds?.top, canvasBounds?.width, canvasBounds?.height, anchor.left, anchor.top].join(",")
  if (changedOnly && key === lastSelectionBoundsKey) { return }
  lastSelectionBoundsKey = key
  threeEffects?.setClip(bounds)
  eventTarget.fire(eventName, {
    rectangle: rectInfo,
    bounds,
    canvasBounds,
    anchor
  })
}

function startSelectionBoundsListener() {
  stopSelectionBoundsListener()
  if (!map?.scene) {
    return
  }
  // camera.changed has a movement threshold; screen overlays must track every rendered view.
  const update = () => {
    if (currentRectInfo) {
      emitSelectionBounds(currentRectInfo, "selectionBoundsChanged", true)
    }
  }
  selectionBoundsCleanup = map.scene.postRender.addEventListener(update)
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
      fill: false,
      outline: false
    }
  })
  layer.addGraphic(graphic)
  currentGraphic = graphic
  currentRectInfo = rectInfo
  selectionLocked = false
  emitSelectionBounds(rectInfo, "selectionCreated")
  startSelectionBoundsListener()
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
    .filter((item) => item && Number.isFinite(item.x) && Number.isFinite(item.y))
  if (screens.length < 4) {
    return null
  }
  const xs = screens.map((item: any) => Number(item.x))
  const ys = screens.map((item: any) => Number(item.y))
  const left = Math.floor(Math.min(...xs))
  const top = Math.floor(Math.min(...ys))
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
  clearTemplateHeat()
  disableDisplayEffects()
  displaySource = null
  rasterGraphic = undefined
  pointGraphics = []
  clearCartographySymbols()
  stopRectangleSelectionListener()
  clearCurrentGraphic()
  if (drawLayer) {
    try {
      map?.removeLayer?.(drawLayer, true)
    } catch {}
  }
  drawLayer = undefined
  if (rasterResultLayer) {
    try {
      map?.removeLayer?.(rasterResultLayer, true)
    } catch {}
  }
  rasterResultLayer = undefined
  if (earthquakeResultLayer) {
    try { map?.removeLayer?.(earthquakeResultLayer, true) } catch {}
  }
  earthquakeResultLayer = undefined
  if (cartographySymbolLayer) {
    try { map?.removeLayer?.(cartographySymbolLayer, true) } catch {}
  }
  cartographySymbolLayer = undefined
  map = undefined
  eventTarget.off()
}

export function beginRectangleSelection(options: RectangleSelectionOptions = {}) {
  disableDisplayEffects()
  displaySource = null
  eventTarget.fire("displayDataChanged", { source: null })
  cancelCartographySymbolPlacement()
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
    const rawPosition = event?.position
    const rightReserve = Math.max(0, Number(options.rightReserve) || 0)
    const maxSelectableX = Math.max(1, (canvas.clientWidth || canvas.width || 1) - rightReserve)
    const position = rightReserve > 0
      ? new Cesium.Cartesian2(Math.min(Number(rawPosition?.x) || 0, maxSelectableX), Number(rawPosition?.y) || 0)
      : rawPosition
    const point = getLngLatPointFromWindowPosition(position)
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

export function endCartographySession() {
  // Closing hides the retained widget; unmount cleanup alone is not sufficient.
  stopRectangleSelectionListener()
  clearCurrentGraphic()
  clearCartographySymbols()
  clearRasterResult()
  clearEarthquakeResult()
  clearDisplaySource()
  map?.scene?.requestRender?.()
}

export function confirmRectangleSelection() {
  if (!currentRectInfo) {
    return
  }
  selectionLocked = true
  const bounds = getSelectionViewportBounds(currentRectInfo)
  eventTarget.fire("selectionConfirmed", {
    rectangle: currentRectInfo,
    bounds,
    canvasBounds: getCanvasViewportBounds()
  })
}

export function getLockedSelection(): RectInfo | null {
  if (!selectionLocked || !currentRectInfo) {
    return null
  }
  return { ...currentRectInfo }
}

export function refreshSelectionBounds() {
  if (!currentRectInfo) {
    return
  }
  emitSelectionBounds(currentRectInfo, "selectionBoundsChanged")
}

export function renderRasterResult(image: string, rectangle: RectInfo, opacity = 0.9, template?: { input: string; name: string; source: string; legend: LegendEntry[]; canvas: HTMLCanvasElement }) {
  clearTemplateHeat()
  const layer = ensureRasterResultLayer()
  if (!layer || !map || !image) {
    return false
  }
  if (rasterGraphic && JSON.stringify(rasterGraphic.attr.scope) === JSON.stringify(rectangle)) {
    rasterGraphic.setStyle({ image, opacity: Math.min(1, Math.max(0, opacity)) })
  } else {
    layer.clear()
    rasterGraphic = new mars3d.graphic.RectangleEntity({
    rectangle: mars3d.Cesium.Rectangle.fromDegrees(rectangle.west, rectangle.south, rectangle.east, rectangle.north),
    style: {
      image,
      opacity: Math.min(1, Math.max(0.1, opacity)),
      clampToGround: true,
      outline: true,
      outlineWidth: 1,
      outlineColor: "#d9f0ff",
      outlineOpacity: 0.9
    },
    attr: {
      name: "框选区栅格计算结果",
      scope: { ...rectangle }
    }
  })
    layer.addGraphic(rasterGraphic)
  }
  displaySource = { kind: "raster", points: [], image, opacity, rectangle: { ...rectangle }, name: "框选区栅格分析结果", source: "当前地图截图（RGB 像元）", time: new Date().toISOString(), unit: "RGB 亮度", legend: [] }
  if (template) {
    rasterGraphic.setStyle({ image: template.canvas })
    Object.assign(displaySource, { templateInput: template.input, name: template.name, source: template.source, legend: template.legend })
  }
  eventTarget.fire("displayDataChanged", { source: displaySource })
  try {
    map.scene?.requestRender?.()
  } catch {}
  return true
}

export function clearRasterResult() {
  clearTemplateHeat()
  try {
    rasterResultLayer?.clear?.()
    rasterGraphic = undefined
    if (displaySource?.kind === "raster" || displaySource?.flatPolygons || displaySource?.templateKind) { clearDisplaySource() }
    map?.scene?.requestRender?.()
  } catch {}
}

export function renderEarthquakePoints(points: EarthquakePoint[], rectangle: RectInfo) {
  const layer = ensureEarthquakeResultLayer()
  if (!layer || !map) { return false }
  const scoped = points.filter((point) => inBounds(point, rectangle))
  while (pointGraphics.length > scoped.length) { layer.removeGraphic(pointGraphics.pop()!, true) }
  scoped.forEach((point, index) => {
    if (pointGraphics[index]) {
      pointGraphics[index].position = mars3d.Cesium.Cartesian3.fromDegrees(point.lon, point.lat)
      pointGraphics[index].setStyle({ color: point.color })
      pointGraphics[index].attr = { label: point.label, band: point.band, value: point.value }
    } else {
      const graphic = new mars3d.graphic.PointEntity({
      position: [point.lon, point.lat, 0],
      style: { color: point.color, pixelSize: 9, outline: true, outlineColor: "#f4f8fa", outlineWidth: 2 },
      attr: { label: point.label, band: point.band, value: point.value }
      })
      layer.addGraphic(graphic)
      pointGraphics.push(graphic)
    }
  })
  displaySource = { kind: "points", points: scoped, image: "", rectangle: { ...rectangle }, ...displayMetadata, time: displayMetadata.time || new Date().toISOString(), legend: displayMetadata.businessPalette ? earthquakeLegend(displayMetadata.businessPalette) : uniqueLegend(scoped) }
  eventTarget.fire("displayDataChanged", { source: displaySource })
  try { map.scene?.requestRender?.() } catch {}
  return true
}

export function clearEarthquakeResult() {
  try { earthquakeResultLayer?.clear?.(); pointGraphics = []; map?.scene?.requestRender?.() } catch {}
  if (displaySource?.kind === "points") { clearDisplaySource() }
}

function clearDisplaySource() {
  displaySource = null
  disableDisplayEffects()
  eventTarget.fire("displayDataChanged", { source: null })
}

export function setDisplayMetadata(metadata: typeof displayMetadata) { displayMetadata = { ...metadata } }
export function getDisplaySource() { return displaySource }

export async function waitForTemplateRaster() {
  const source = displaySource
  await afterDisplayRender()
  await afterDisplayRender()
  const deadline = performance.now() + 10000
  while (performance.now() < deadline) {
    if (!map || displaySource !== source || map.viewer.dataSourceDisplay.ready) { break }
    await new Promise(resolve => setTimeout(resolve, 40))
    await afterDisplayRender()
  }
  if (!map || displaySource !== source) { throw new Error("地图图层已改变，请重新应用模板") }
  if (!map.viewer.dataSourceDisplay.ready) { throw new Error("栅格图层仍在加载，请稍后重新应用") }
  await afterDisplayRender()
}

export async function renderTemplatePolygons(polygons: DisplayPolygon[], legend: LegendEntry[], field: string, filename: string, sourceLabel = `本地文件：${filename}`) {
  clearTemplateHeat()
  const rectangle = getLockedSelection()
  const layer = ensureRasterResultLayer()
  if (!map || !rectangle || !layer || !polygons.length) { throw new Error("地图或框选分区不可用") }
  disableDisplayEffects()
  layer.clear(); rasterGraphic = undefined; layer.show = true
  const graphics: mars3d.graphic.PolygonPrimitive[] = []
  for (const polygon of polygons) {
    graphics.push(...layer.loadGeoJSON({ type: "Feature", geometry: { type: "Polygon", coordinates: polygon.rings }, properties: { name: polygon.label, value: polygon.value, band: polygon.band } }, {
      clear: false,
      flyTo: false,
      toPrimitive: true,
      style: { color: polygon.color, opacity: 0.82, clampToGround: true, outline: true, outlineColor: "#ecf6ff", outlineWidth: 1 }
    }) as mars3d.graphic.PolygonPrimitive[])
  }
  displaySource = { kind: "polygons", flatPolygons: true, polygons, points: [], image: "", rectangle, name: "分区模板制图", source: sourceLabel, unit: field, time: new Date().toISOString(), legend }
  eventTarget.fire("displayDataChanged", { source: displaySource })
  map.scene.requestRender()
  const source = displaySource
  // Wait for this layer's ground geometry, not the unrelated viewer data sources.
  await afterDisplayRender()
  await afterDisplayRender()
  const deadline = performance.now() + 10000
  while (performance.now() < deadline) {
    if (!map || displaySource !== source || graphics.every(graphic => graphic.ready)) { break }
    await new Promise(resolve => setTimeout(resolve, 40))
    await afterDisplayRender()
  }
  if (!map || displaySource !== source) { throw new Error("地图范围或图层已改变，请重新应用模板") }
  if (!graphics.every(graphic => graphic.ready)) { throw new Error("分区图层仍在加载，请稍后重新应用") }
  await afterDisplayRender()
}

export function setDisplayPolygonSource(polygons: DisplayPolygon[], field: string, filename: string) {
  const rectangle = getLockedSelection()
  if (!rectangle || !polygons.length) { throw new Error("请先锁定范围并导入范围内的面要素") }
  disableDisplayEffects()
  displaySource = {
    kind: "polygons",
    points: [],
    polygons,
    image: "",
    rectangle,
    name: "GeoJSON 面要素立体制图",
    source: `本地文件：${filename}`,
    time: new Date().toISOString(),
    unit: field,
    legend: [...new Map(polygons.map((item) => [item.band, item.color])).entries()].slice(0, 24).map(([label, color]) => ({ label, color }))
  }
  eventTarget.fire("displayDataChanged", { source: displaySource })
}

function clearTemplateHeat() {
  if (templateHeatLayer) { map?.removeLayer(templateHeatLayer, true); templateHeatLayer = undefined }
}

export async function captureTemplateBaseImage() {
  const layers = [rasterResultLayer, earthquakeResultLayer, templateHeatLayer].filter(Boolean) as Array<{ show: boolean }>
  const visibility = layers.map(layer => layer.show)
  try {
    layers.forEach(layer => { layer.show = false })
    await afterDisplayRender()
    return await captureSelectionImage({ targetWidth: 1280, fitAspect: true, frameWidth: 0, mime: "image/png" })
  } finally {
    layers.forEach((layer, i) => { layer.show = visibility[i] })
    map?.scene.requestRender()
  }
}

export async function renderTemplateScene(scene: TemplateScene, radius = 45, signal?: AbortSignal) {
  const rectangle = getLockedSelection()
  const layer = ensureRasterResultLayer()
  if (!map || !rectangle || !layer) { throw new Error("请先锁定地图范围") }
  if (scene.heat) { await import("mars3d-heatmap") }
  signal?.throwIfAborted()
  if (!map || JSON.stringify(rectangle) !== JSON.stringify(getLockedSelection())) { throw new Error("框选范围已改变，请重新渲染") }
  clearTemplateHeat(); disableDisplayEffects(); layer.clear(); rasterGraphic = undefined; layer.show = true
  earthquakeResultLayer?.clear(); pointGraphics = []
  const graphics: any[] = []
  if (scene.heat) {
    templateHeatLayer = new mars3d.layer.HeatLayer({
      positions: scene.heat,
      min: 0,
      max: Math.max(...scene.heat.map(p => p.value)),
      rectangle: { xmin: rectangle.west, xmax: rectangle.east, ymin: rectangle.south, ymax: rectangle.north },
      canvasSize: 1024,
      heatStyle: { radius, blur: 0.85, maxOpacity: 0.95, gradient: templateHeatGradient(scene.heatColors || mapTemplatePalettes.heat) },
      style: { type: "image", opacity: 1, clampToGround: true },
      flyTo: false
    })
    map.addLayer(templateHeatLayer)
  } else {
    for (const feature of scene.features) {
      const p = feature.properties
      if (feature.geometry.type === "Point" && p.symbolKind) {
        const size = (p.pixelSize || 20) * 1.8
        const graphic = new mars3d.graphic.BillboardEntity({
          position: feature.geometry.coordinates,
          style: {
            image: compositionSymbolImage(p.symbolKind, "#222222"),
width: size,
height: size,
clampToGround: true,
            label: { text: p.name, font_size: 14, color: p.color, outline: true, outlineColor: "#ffffff", outlineWidth: 3, pixelOffsetY: -size / 2 - 12 }
          },
          attr: p
        })
        layer.addGraphic(graphic); graphics.push(graphic)
        graphic.on(mars3d.EventType.click, () => eventTarget.fire("templateFeatureSelected", { id: p.templateId }))
        continue
      }
      const drawn = layer.loadGeoJSON(feature, {
 clear: false,
flyTo: false,
toPrimitive: true,
style: {
        color: p.color,
opacity: p.opacity ?? (p.rasterCell ? 1 : 0.84),
pixelSize: p.pixelSize || 14,
width: p.width || 3,
        clampToGround: true,
outline: !p.rasterCell,
outlineColor: scene.kind === "intensity-distribution" ? p.color : "#ecf6ff",
outlineWidth: 1,
        ...(p.arrow ? { materialType: mars3d.MaterialType.PolylineArrow, materialOptions: { color: p.color } } : {})
      } 
}) as any[]
      graphics.push(...drawn)
      for (const graphic of drawn) {
        graphic.on(mars3d.EventType.click, () => eventTarget.fire("templateFeatureSelected", { id: p.templateId }))
      }
    }
  }
  for (const annotation of scene.annotations || []) {
    const label = { text: annotation.label, font_size: 16, color: "#252525", outline: true, outlineColor: "#ffffff", outlineWidth: 3, pixelOffsetY: -20, clampToGround: true }
    const graphic = annotation.symbolKind
? new mars3d.graphic.BillboardEntity({
      position: annotation.position,
      style: { image: compositionSymbolImage(annotation.symbolKind as CartographySymbolKind, "#222222"), width: 28, height: 28, clampToGround: true, label }
    })
: new mars3d.graphic.LabelEntity({ position: annotation.position, style: label })
    layer.addGraphic(graphic); graphics.push(graphic)
  }
  displaySource = { kind: "points", points: scene.features.filter(f => f.geometry.type === "Point").map(f => ({ lon: (f.geometry as any).coordinates[0], lat: (f.geometry as any).coordinates[1], value: f.properties.value, label: f.properties.name, color: f.properties.color, band: scene.unit })), image: "", rectangle, name: scene.kind, templateKind: scene.kind, source: `${scene.source}${scene.note ? `；${scene.note}` : ""}`, time: scene.time, unit: scene.unit, legend: scene.legend }
  eventTarget.fire("displayDataChanged", { source: displaySource })
  const source = displaySource
  const deadline = performance.now() + 10000
  // Image heatmaps upload through globe tiles, not the graphic readiness queue.
  const pending = () => graphics.some(graphic => graphic.ready === false) || Boolean(scene.heat && map && !map.scene.globe.tilesLoaded)
  await afterDisplayRender(); await afterDisplayRender()
  while (pending() && performance.now() < deadline) {
    signal?.throwIfAborted()
    if (displaySource !== source) { break }
    await new Promise(resolve => setTimeout(resolve, 40)); await afterDisplayRender()
  }
  if (displaySource !== source) { throw new Error("范围或图层已改变，请重新渲染") }
  signal?.throwIfAborted()
  if (pending()) { throw new Error("模板图层加载超时，请重新应用") }
  await afterDisplayRender()
}

export function highlightTemplateFeature(id: string) {
  for (const graphic of rasterResultLayer?.getGraphics() || []) {
    const selected = graphic.attr?.templateId === id
    graphic.setStyle({ outlineColor: selected ? "#ffe773" : "#ecf6ff", outlineWidth: selected ? 4 : 1, opacity: !id || selected ? 0.94 : 0.4 })
  }
  map?.scene.requestRender()
}

export function applyPointDisplay(points: DisplayPoint[], options: { opacity: number; size: number; outlineWidth: number; outlineColor: string; labels: boolean }) {
  points.forEach((point, index) => {
    pointGraphics[index]?.setStyle({
 color: point.color,
opacity: options.opacity,
pixelSize: options.size,
outlineWidth: options.outlineWidth,
outlineColor: options.outlineColor,
      label: options.labels ? { text: point.label, font_size: 13, color: "#ffffff", outline: true, outlineColor: "#16232c", outlineWidth: 2, pixelOffsetY: -16 } : { text: "" } 
})
  })
  map?.scene.requestRender()
}

export function applyRasterDisplay(image: HTMLCanvasElement, opacity: number) {
  rasterGraphic?.setStyle({ image, opacity })
  map?.scene.requestRender()
}

export function afterDisplayRender(): Promise<void> {
  return new Promise((resolve) => {
    if (!map) { resolve(); return }
    const finish = () => { remove(); clearTimeout(timer); resolve() }
    const remove = map.scene.postRender.addEventListener(finish)
    const timer = setTimeout(finish, 1000)
    map.scene.requestRender()
  })
}

export async function updateDisplayEffects(points: DisplayPoint[], settings: EffectSettings) {
  const revision = ++threeRevision
  displaySettings = { ...settings }
  if (!settings.enabled || !displaySource || !map) { disableDisplayEffects(); return }
  if (!threeEffects) {
    const { Thematic3D } = await import("./thematic-3d")
    if (revision !== threeRevision || !map || !displaySource) { return }
    threeEffects = new Thematic3D(map, (status) => {
      if (status.error) {
        if (earthquakeResultLayer) { earthquakeResultLayer.show = true }
        if (rasterResultLayer) { rasterResultLayer.show = true }
      }
      eventTarget.fire("displayQualityChanged", status)
    })
  }
  threeEffects.update(points, displaySource.polygons || [], displaySource.rectangle, settings)
  threeEffects.setClip(getSelectionViewportBounds(displaySource.rectangle))
  if (earthquakeResultLayer) { earthquakeResultLayer.show = settings.blend !== "replace" || !settings.effects.length }
  if (rasterResultLayer) { rasterResultLayer.show = settings.blend !== "replace" || !settings.effects.length }
}

export function disableDisplayEffects() {
  threeRevision++
  threeEffects?.dispose()
  threeEffects = undefined
  displaySettings = null
  if (earthquakeResultLayer) { earthquakeResultLayer.show = true }
  if (rasterResultLayer) { rasterResultLayer.show = true }
}

export function setDisplayView(tilted: boolean) {
  if (!map || !displaySource) { return }
  const C = mars3d.Cesium
  const bounds = displaySource.rectangle
  const target = C.Cartesian3.fromDegrees((bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2)
  const span = C.Cartesian3.distance(C.Cartesian3.fromDegrees(bounds.west, bounds.south), C.Cartesian3.fromDegrees(bounds.east, bounds.north))
  map.camera.lookAt(target, new C.HeadingPitchRange(0, C.Math.toRadians(tilted ? -50 : -90), Math.max(1000, span * 1.3)))
  map.camera.lookAtTransform(C.Matrix4.IDENTITY)
  map.scene.requestRender()
  requestAnimationFrame(refreshSelectionBounds)
}

export function getMapAdornmentMetrics() {
  const rectangle = displaySource?.rectangle || (selectionLocked ? currentRectInfo : null)
  if (!map || !rectangle) { return null }
  const bounds = getSelectionCanvasBounds(rectangle)
  if (!bounds) { return null }
  const C = mars3d.Cesium
  const center = new C.Cartesian2(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
  const a = getLngLatPointFromWindowPosition(center)
  const sample = Math.max(1, Math.min(100, bounds.width / 4))
  const b = getLngLatPointFromWindowPosition(new C.Cartesian2(center.x + sample, center.y))
  if (!a || !b) { return null }
  const distance = new C.EllipsoidGeodesic(C.Cartographic.fromDegrees(a.lng, a.lat), C.Cartographic.fromDegrees(b.lng, b.lat)).surfaceDistance
  const north = C.SceneTransforms.worldToWindowCoordinates(map.scene, C.Cartesian3.fromDegrees(a.lng, Math.min(89.999, a.lat + 0.01)))
  if (!north || !Number.isFinite(distance) || distance <= 0) { return null }
  return { metersPerPixel: distance / sample, selectionWidth: bounds.width, northAngle: Math.atan2(north.x - center.x, center.y - north.y) }
}

export async function captureSelectionImage(options?: {
  targetWidth?: number
  targetHeight?: number
  fitAspect?: boolean
  mime?: "image/jpeg" | "image/png"
  quality?: number
  frameWidth?: number
}): Promise<Blob | null> {
  if (!map || !currentRectInfo || !selectionLocked) {
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
  if (bounds.left < -1 || bounds.top < -1 || bounds.left + bounds.width > canvas.clientWidth + 1 || bounds.top + bounds.height > canvas.clientHeight + 1) {
    throw new Error("制图范围超出当前视野，请让白色框完整进入视野后导出")
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
  const targetHeight = options?.fitAspect ? Math.max(1, Math.round(targetWidth * sh / sw)) : options?.targetHeight || sh
  const requestedFrameWidth = options?.frameWidth ?? SELECTION_FRAME_WIDTH
  const maxFrameWidth = Math.max(0, Math.floor((Math.min(targetWidth, targetHeight) - 1) / 2))
  const frameWidth = Math.min(maxFrameWidth, Math.max(0, Math.round(requestedFrameWidth)))
  const contentWidth = Math.max(1, targetWidth - frameWidth * 2)
  const contentHeight = Math.max(1, targetHeight - frameWidth * 2)
  const out = document.createElement("canvas")
  out.width = targetWidth
  out.height = targetHeight
  const ctx = out.getContext("2d")
  if (!ctx) {
    return null
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  const scale = Math.min(contentWidth / sw, contentHeight / sh)
  const dw = Math.round(sw * scale)
  const dh = Math.round(sh * scale)
  const dx = frameWidth + Math.round((contentWidth - dw) / 2)
  const dy = frameWidth + Math.round((contentHeight - dh) / 2)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, targetWidth, targetHeight)
  ctx.fillStyle = "#0f1720"
  ctx.fillRect(frameWidth, frameWidth, contentWidth, contentHeight)
  ctx.drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh)
  if (threeEffects && displaySettings?.enabled) {
    const overlay = threeEffects.canvas
    ctx.drawImage(overlay, sx * overlay.width / sourceWidth, sy * overlay.height / sourceHeight, sw * overlay.width / sourceWidth, sh * overlay.height / sourceHeight, dx, dy, dw, dh)
  }
  for (const item of cartographySymbols.values()) {
    const point = item.graphic.point
    if (!inBounds({ lon: point.lng, lat: point.lat }, currentRectInfo)) { continue }
    const screen = map.scene.cartesianToCanvasCoordinates(mars3d.Cesium.Cartesian3.fromDegrees(point.lng, point.lat))
    if (!screen) { continue }
    const image = new Image()
    image.src = compositionSymbolImage(item.binding.kind as CartographySymbolKind, item.style.color)
    await image.decode()
    const size = item.style.size * dw / bounds.width
    ctx.save()
    ctx.beginPath(); ctx.rect(dx, dy, dw, dh); ctx.clip()
    ctx.translate(dx + (screen.x - bounds.left) * dw / bounds.width, dy + (screen.y - bounds.top) * dh / bounds.height)
    ctx.globalAlpha = item.style.opacity
    ctx.rotate(item.style.rotation * Math.PI / 180)
    ctx.drawImage(image, -size / 2, -size / 2, size, size)
    ctx.restore()
  }
  return await canvasToBlob(out, mime, quality)
}

export async function captureStandardMapPreview(selection = false): Promise<DbtMapPreview> {
  const source = map?.scene?.canvas as HTMLCanvasElement | undefined
  if (!source || !source.width || !source.height) { throw new Error("地图尚未就绪，请稍后重新采集底图") }
  const rectangle = selection ? getLockedSelection() : null
  if (selection && !rectangle) { throw new Error("请先确认框选范围") }
  let image: string
  if (selection) {
    const blob = await captureSelectionImage({ targetWidth: 1600, fitAspect: true, frameWidth: 0, mime: "image/png" })
    if (!blob?.size) { throw new Error("框选底图采集失败，请重新框选") }
    image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("底图读取失败")); reader.readAsDataURL(blob)
    })
  } else {
    map!.scene.requestRender?.(); await nextFrame(); await nextFrame()
    const copy = document.createElement("canvas")
    copy.width = Math.min(1600, source.width); copy.height = Math.max(1, Math.round(source.height * copy.width / source.width))
    const context = copy.getContext("2d")
    if (!context) { throw new Error("浏览器无法采集地图画面") }
    context.drawImage(source, 0, 0, copy.width, copy.height); image = copy.toDataURL("image/png")
  }
  return { image, bounds: rectangle, capturedAt: new Date().toISOString(), view: selection ? "selection" : "viewport" }
}

export async function captureDisplayFrame(targetWidth = 1280): Promise<HTMLCanvasElement> {
  if (!map?.scene?.canvas) { throw new Error("地图尚未就绪") }
  map.scene.requestRender?.()
  await nextFrame(); await nextFrame()
  const source = map.scene.canvas as HTMLCanvasElement
  const out = document.createElement("canvas")
  out.width = Math.min(3840, Math.max(320, targetWidth))
  out.height = Math.max(2, Math.round(source.height * out.width / source.width / 2) * 2)
  const ctx = out.getContext("2d")!
  ctx.drawImage(source, 0, 0, out.width, out.height)
  if (threeEffects && displaySettings?.enabled) { ctx.drawImage(threeEffects.canvas, 0, 0, out.width, out.height) }
  return out
}
