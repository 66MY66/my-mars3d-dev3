/**
 * eoAPI 工作台地图交互层
 * @description 所有涉及 Mars3D/Cesium API 调用的代码
 */

import * as mars3d from "mars3d"
import { applyDefaultRasterStyleOptions } from "./services/layer-style-defaults"
import { buildThermalHeatLayerOptions, shouldRenderThermalHeatmap } from "./services/thermal-heatmap"
import { createMvtLayer } from "./services/mvt-layer"
const Cesium = mars3d.Cesium

let map: mars3d.Map // 地图对象
let viewChangeCallback: ((viewState: any) => void) | null = null
let pickCoordinateHandler: any | null = null
let pickCoordinateCallback: ((coord: any) => void) | null = null
let viewChangeLastAt = 0
let viewChangeTimer: number | null = null
const TITILER_RGB_BIDX_QUERY = "bidx=1&bidx=2&bidx=3"
const EOAPI_TITILER_URL = import.meta.env.VITE_EOAPI_TITILER_URL || "http://192.168.10.15:5955"

function appendRasterRenderingHints(url: string, options: any): { url: string; options: any } {
  const profile = String(options?.styleProfile || "").toLowerCase()
  if (!profile || !url) {
    return { url, options }
  }

  const nextOptions = { ...(options || {}) }
  const params = new URLSearchParams()
  const queryIndex = url.indexOf("?")
  const base = queryIndex >= 0 ? url.slice(0, queryIndex) : url
  const query = queryIndex >= 0 ? new URLSearchParams(url.slice(queryIndex + 1)) : params

  if (profile === "sar") {
    if (!query.has("bidx") && !query.has("asset_bidx")) {
      query.set("bidx", "1")
    }
    if (!query.has("colormap_name")) {
      query.set("colormap_name", "gray")
    }
    nextOptions.colorRamp = nextOptions.colorRamp || "gray"
  } else if (profile === "deformation") {
    if (!query.has("colormap_name")) {
      query.set("colormap_name", "rdbu")
    }
    nextOptions.colorRamp = nextOptions.colorRamp || "blue-red"
  } else if (profile === "thermal") {
    if (!query.has("colormap_name")) {
      query.set("colormap_name", "inferno")
    }
    nextOptions.colorRamp = nextOptions.colorRamp || "inferno"
  }

  const suffix = query.toString()
  return { url: suffix ? `${base}?${suffix}` : base, options: nextOptions }
}

// #region debug-point dataset-cover-stac-load
type TraeDebugEvent = {
  t: number
  sessionId: string
  level: "info" | "warn" | "error"
  type: string
  message: string
  data?: Record<string, unknown>
}

const TRAE_DEBUG_ENDPOINT =
  (import.meta.env as any).VITE_DEBUG_SERVER_URL ||
  new URLSearchParams(location.search).get("traeDebug") ||
  localStorage.getItem("TRAE_DEBUG_SERVER_URL") ||
  ""
const TRAE_DEBUG_SESSION_ID =
  (import.meta.env as any).VITE_DEBUG_SESSION_ID ||
  new URLSearchParams(location.search).get("traeSession") ||
  localStorage.getItem("TRAE_DEBUG_SESSION_ID") ||
  "dataset-cover-stac-load"

const traeBaseFetch = window.fetch.bind(window)
const stacDebugOnceByLayerId = new Map<string, number>()

async function reportTraeDebugEvent(event: TraeDebugEvent): Promise<void> {
  if (!TRAE_DEBUG_ENDPOINT) {
    return
  }
  try {
    await traeBaseFetch(TRAE_DEBUG_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify(event),
      keepalive: true
    })
  } catch {
  }
}

function dbgOnce(layerId: string, type: string, message: string, data?: Record<string, unknown>) {
  const id = String(layerId || "").trim()
  if (!id) {
    return
  }
  const now = Date.now()
  const lastAt = stacDebugOnceByLayerId.get(id) || 0
  if (now - lastAt < 60_000) {
    return
  }
  stacDebugOnceByLayerId.set(id, now)
  reportTraeDebugEvent({
    t: now,
    sessionId: TRAE_DEBUG_SESSION_ID,
    level: "info",
    type,
    message,
    data: { layerId: id, ...(data || {}) }
  }).catch(() => {})
}
// #endregion debug-point dataset-cover-stac-load

function stringifyStyleHint(value: any): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "")).join(",")
  }
  return String(value || "")
}

function resolvePublicVisualHref(item: any): string {
  const href =
    item?.assets?.visual?.alternate?.public?.href ||
    item?.assets?.visual?.href ||
    item?.assets?.preview?.alternate?.public?.href ||
    item?.assets?.preview?.href
  return typeof href === "string" && /^https?:\/\//i.test(href) ? href : ""
}

function normalizeXyzLayerOptions(id: string, url: string, options?: any): any {
  const merged = {
    id,
    name: options?.name || id,
    url,
    minimumTerrainLevel: 0,
    maximumTerrainLevel: 18,
    show: true,
    opacity: options?.opacity ?? 1,
    ...options
  }
  return applyDefaultRasterStyleOptions(
    merged,
    {
      name: merged.name,
      sourceRef: url,
      sourceType: "xyz",
      data: {
        styleProfile: options?.styleProfile,
        assetKey: options?.assetKey,
        layerKey: options?.layerKey,
        collectionId: options?.collectionId,
        itemId: options?.itemId
      }
    },
    "xyz"
  )
}

// ============ 生命周期钩子 ============

/**
 * 初始化地图业务
 * 框架在地图初始化完成后自动调用该函数
 */
export function onMounted(mapInstance: mars3d.Map) {
  map = mapInstance
}

/**
 * 释放当前地图业务
 * 具体项目中时必须写 onMounted 的反向操作
 */
export function onUnmounted() {
  map = null
  offMapViewChange()
  stopPickCoordinate()
}

// ============ 视图状态获取 ============

/**
 * 获取地图实例
 */
export function getMap(): mars3d.Map | null {
  return map
}

export function ensureGroupLayer(groupId: string, groupName: string, pid?: string | number | null): void {
  if (!map) {
    return
  }
  const existed = map.getLayerById(groupId)
  if (existed) {
    try {
      ;(existed as any).name = groupName
    } catch {
    }
    if (pid !== undefined) {
      setLayerPid(groupId, pid)
    }
    return
  }
  const anyMars: any = mars3d as any
  const GroupLayer = anyMars?.layer?.GroupLayer
  if (typeof GroupLayer === "function") {
    try {
      const groupLayer = new GroupLayer({
        id: groupId,
        name: groupName,
        type: "group",
        show: true,
        open: true,
        pid: pid ?? undefined
      })
      map.addLayer(groupLayer)
      if (pid !== undefined) {
        setLayerPid(groupId, pid)
      }
    } catch {
    }
  }
}

/**
 * 获取当前地图视角状态
 */
export function getViewState(): any {
  if (!map) { return null }

  const camera = map.camera
  const center = camera.positionCartographic

  // 计算当前视野范围
  const rectangle = camera.computeViewRectangle()
  const bbox: [number, number, number, number] = rectangle
    ? [
        Cesium.Math.toDegrees(rectangle.west),
        Cesium.Math.toDegrees(rectangle.south),
        Cesium.Math.toDegrees(rectangle.east),
        Cesium.Math.toDegrees(rectangle.north)
      ]
    : [0, 0, 0, 0]

  return {
    center: {
      longitude: Cesium.Math.toDegrees(center.longitude),
      latitude: Cesium.Math.toDegrees(center.latitude)
    },
    zoom: getZoomFromHeight(camera.positionCartographic.height),
    heading: Cesium.Math.toDegrees(camera.heading),
    pitch: Cesium.Math.toDegrees(camera.pitch),
    bbox,
    timestamp: Date.now()
  }
}

/**
 * 获取当前地图范围
 */
export function getCurrentBounds(): [number, number, number, number] | null {
  if (!map) { return null }

  const rectangle = map.camera.computeViewRectangle()
  if (!rectangle) { return null }

  return [
    Cesium.Math.toDegrees(rectangle.west),
    Cesium.Math.toDegrees(rectangle.south),
    Cesium.Math.toDegrees(rectangle.east),
    Cesium.Math.toDegrees(rectangle.north)
  ]
}

/**
 * 从高度计算缩放级别
 */
function getZoomFromHeight(height: number): number {
  // A rough approximation
  const A = 40487.57
  const B = 0.703125
  const C = 12.37
  const D = 1000

  if (height < D) {
    return Math.round(C * Math.log(height / D) + 20)
  } else {
    return Math.round(A / (height * B))
  }
}

// ============ 视图变化监听 ============

/**
 * 监听地图视图变化
 */
export function onMapViewChange(callback: (viewState: any) => void) {
  if (!map) { return }

  viewChangeCallback = callback

  // 使用相机变化事件
  map.camera.changed.addEventListener(onCameraChanged)
}

/**
 * 相机变化处理
 */
function onCameraChanged() {
  if (!viewChangeCallback) {
    return
  }

  const throttleMs = 120
  const now = Date.now()
  const elapsed = now - viewChangeLastAt

  const emit = () => {
    if (!viewChangeCallback) {
      return
    }
    const viewState = getViewState()
    viewChangeCallback(viewState)
  }

  if (elapsed >= throttleMs) {
    viewChangeLastAt = now
    if (viewChangeTimer != null) {
      window.clearTimeout(viewChangeTimer)
      viewChangeTimer = null
    }
    emit()
    return
  }

  if (viewChangeTimer != null) {
    return
  }

  viewChangeTimer = window.setTimeout(() => {
    viewChangeTimer = null
    viewChangeLastAt = Date.now()
    emit()
  }, throttleMs - elapsed)
}

/**
 * 移除视图变化监听
 */
export function offMapViewChange() {
  if (map && viewChangeCallback) {
    map.camera.changed.removeEventListener(onCameraChanged)
    viewChangeCallback = null
  }
  if (viewChangeTimer != null) {
    window.clearTimeout(viewChangeTimer)
    viewChangeTimer = null
  }
  viewChangeLastAt = 0
}

// ============ 坐标选取 ============

/**
 * 开启坐标选取模式
 */
export function startPickCoordinate(callback: (coord: any) => void) {
  if (!map) { return }

  pickCoordinateCallback = callback

  // 创建屏幕空间事件处理器
  const handler = new Cesium.ScreenSpaceEventHandler(map.scene.canvas)
  pickCoordinateHandler = handler

  // 监听左键点击事件
  handler.setInputAction((event: any) => {
    const position = event.position
    const cartesian = map.scene.pick(position)

    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
      const coord = {
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        height: cartographic.height
      }
      if (pickCoordinateCallback) {
        pickCoordinateCallback(coord)
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  // 改变鼠标样式为十字
  map.scene.canvas.style.cursor = "crosshair"
}

/**
 * 停止坐标选取模式
 */
export function stopPickCoordinate() {
  if (pickCoordinateHandler) {
    pickCoordinateHandler.destroy()
    pickCoordinateHandler = null
  }
  pickCoordinateCallback = null

  if (map) {
    map.scene.canvas.style.cursor = "default"
  }
}

// ============ 视角恢复 ============

/**
 * 飞到指定视角
 */
export function flyToViewState(viewState: any, duration?: number) {
  if (!map || !viewState) { return }

  const { center, zoom, heading, pitch } = viewState

  map.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, getHeightFromZoom(zoom)),
    orientation: {
      heading: Cesium.Math.toRadians(heading),
      pitch: Cesium.Math.toRadians(pitch),
      roll: 0
    },
    duration: duration ?? 1.0
  })
}

/**
 * 飞到指定的 bbox 范围
 * @param bbox [west, south, east, north] 经纬度范围
 * @param duration 飞行时间（秒）
 */
export function flyToBbox(bbox: [number, number, number, number], duration?: number) {
  if (!map || !bbox || bbox.length < 4) { return }

  const [west, south, east, north] = bbox

  // 使用 Rectangle 飞到指定范围
  map.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
    duration: duration ?? 1.5
  })
}

/**
 * 从缩放级别计算高度
 */
function getHeightFromZoom(zoom: number): number {
  const A = 40487.57
  const B = 0.703125

  return Math.round(A / (zoom * B))
}

/**
 * 设置视角（立即，不带飞行动画）
 */
export function setViewState(viewState: any) {
  if (!map || !viewState) { return }

  const { center, zoom, heading, pitch } = viewState

  map.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, getHeightFromZoom(zoom)),
    orientation: {
      heading: Cesium.Math.toRadians(heading),
      pitch: Cesium.Math.toRadians(pitch),
      roll: 0
    }
  })
}

// ============ 图层操作辅助 ============

/**
 * 获取所有业务图层
 */
export function getBusinessLayers() {
  if (!map) { return [] }
  return map.getLayers({ basemaps: false })
}

export function getLayerById(id: string | number) {
  if (!map) {
    return null
  }
  return map.getLayerById(id as any) || null
}

export function setLayerName(id: string | number, name: string): boolean {
  const layer: any = getLayerById(id)
  if (!layer) {
    return false
  }
  try {
    layer.name = name
    return true
  } catch {
    return false
  }
}

export function setLayerPid(id: string | number, pid: string | number | null): boolean {
  const layer: any = getLayerById(id)
  if (!layer) {
    return false
  }
  try {
    if (pid === null || pid === undefined || pid === "") {
      delete layer.pid
      if (layer.options) {
        delete layer.options.pid
      }
    } else {
      layer.pid = pid
      layer.options = layer.options || {}
      layer.options.pid = pid
    }
    return true
  } catch {
    return false
  }
}

/**
 * 获取图层树状态（用于序列化）
 */
export function getLayersState() {
  if (!map) { return [] }

  const layers = getBusinessLayers()
  return layers.map((layer, index) => ({
    id: layer.id,
    name: layer.name,
    sourceType: layer.type,
    sourceRef: layer.options?.url || "",
    visible: layer.show,
    opacity: layer.opacity ?? 1,
    order: index,
    options: layer.options
  }))
}

export async function captureCoverImage(options?: {
  minWidth?: number
  minHeight?: number
  targetWidth?: number
  targetHeight?: number
  mime?: "image/jpeg" | "image/png"
  quality?: number
  title?: string
}, mapInstance?: mars3d.Map | null): Promise<Blob> {
  const minWidth = options?.minWidth || 800
  const minHeight = options?.minHeight || 600
  const targetWidth = options?.targetWidth || 1024
  const targetHeight = options?.targetHeight || 768
  const mime = options?.mime || "image/jpeg"
  const quality = typeof options?.quality === "number" ? options.quality : 0.88

  const fallback = async () => {
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(minWidth, targetWidth)
    canvas.height = Math.max(minHeight, targetHeight)
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      return new Blob([], { type: mime })
    }
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    g.addColorStop(0, "rgba(25, 35, 45, 1)")
    g.addColorStop(1, "rgba(10, 12, 16, 1)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const title = options?.title || "成果封面"
    ctx.fillStyle = "rgba(255,255,255,0.86)"
    ctx.font = "600 40px system-ui, -apple-system, Segoe UI, Roboto, PingFang SC, Microsoft YaHei"
    ctx.textBaseline = "top"
    ctx.fillText(title.slice(0, 18), 36, 36)
    ctx.fillStyle = "rgba(255,255,255,0.55)"
    ctx.font = "400 18px system-ui, -apple-system, Segoe UI, Roboto, PingFang SC, Microsoft YaHei"
    ctx.fillText(new Date().toLocaleString(), 36, 92)

    return await canvasToBlob(canvas, mime, quality)
  }

  try {
    const m = mapInstance || map
    if (!m) {
      return await fallback()
    }
    const canvas = m.scene?.canvas as HTMLCanvasElement | undefined
    if (!canvas) {
      return await fallback()
    }

    try {
      m.scene.requestRender?.()
    } catch {}
    await nextFrame()
    await nextFrame()

    const blob = await renderCanvasCover(canvas, {
      targetWidth: Math.max(minWidth, targetWidth),
      targetHeight: Math.max(minHeight, targetHeight),
      mime,
      quality
    })
    if (blob.size === 0) {
      return await fallback()
    }
    return blob
  } catch {
    return await fallback()
  }
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

async function renderCanvasCover(
  src: HTMLCanvasElement,
  options: { targetWidth: number; targetHeight: number; mime: "image/jpeg" | "image/png"; quality: number }
): Promise<Blob> {
  const out = document.createElement("canvas")
  out.width = options.targetWidth
  out.height = options.targetHeight
  const ctx = out.getContext("2d")
  if (!ctx) {
    return new Blob([], { type: options.mime })
  }

  const sw = src.width || src.clientWidth
  const sh = src.height || src.clientHeight
  if (!sw || !sh) {
    return new Blob([], { type: options.mime })
  }

  const scale = Math.max(options.targetWidth / sw, options.targetHeight / sh)
  const dw = Math.ceil(sw * scale)
  const dh = Math.ceil(sh * scale)
  const dx = Math.floor((options.targetWidth - dw) / 2)
  const dy = Math.floor((options.targetHeight - dh) / 2)

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(src, dx, dy, dw, dh)

  return await canvasToBlob(out, options.mime, options.quality)
}

// ============ eoAPI 影像图层 ============

/**
 * 添加 XYZ Tiles 图层
 * @param id 图层ID
 * @param url XYZ Tiles URL 模板
 * @param options 图层选项
 */
export function addXyzLayer(id: string, url: string, options?: any) {
  if (!map) { return null }

  // 检查图层是否已存在
  const existingLayer = map.getLayerById(id)
  if (existingLayer) {
    existingLayer.show = true
    return existingLayer
  }

  // 创建 XYZ 图层
  const normalized = normalizeXyzLayerOptions(id, url, options)
  const rendered = appendRasterRenderingHints(url, normalized)
  const layer = new mars3d.layer.XyzLayer({ ...rendered.options, url: rendered.url })

  map.addLayer(layer)
  return layer
}

export async function addThematicProtocolLayer(id: string, type: string, url: string, options: any = {}) {
  if (!map) { throw new Error("地图尚未初始化") }
  const existing = map.getLayerById(id)
  if (existing) { existing.show = true; return existing }
  let layer: any
  if (type === "wms") {
    if (!options.layers) { throw new Error("WMS 服务缺少 layers 元数据") }
    layer = new mars3d.layer.WmsLayer({ ...options, id, url, layers: options.layers, parameters: { transparent: true, format: "image/png", ...options.parameters } })
  } else if (type === "wmts") {
    if (!options.layer || !options.tileMatrixSetID) { throw new Error("WMTS 服务缺少 layer 或 tileMatrixSetID 元数据") }
    layer = new mars3d.layer.WmtsLayer({ ...options, id, url })
  } else if (type === "mvt") {
    layer = createMvtLayer({ ...options, id, url })
  } else { throw new Error(`不支持的服务类型：${type}`) }
  map.addLayer(layer)
  return layer
}

export function addGeoJsonLayer(id: string, data: any, options?: any) {
  if (!map) {
    return null
  }
  const existingLayer = map.getLayerById(id)
  if (existingLayer) {
    try {
      existingLayer.show = true
    } catch {
    }
    return existingLayer
  }
  if (shouldRenderThermalHeatmap(data, options?.name, options?.styleProfile, options?.renderProfile)) {
    const heatOptions = buildThermalHeatLayerOptions(id, data, options)
    const layer = new mars3d.layer.HeatLayer(heatOptions as any)
    map.addLayer(layer)
    return layer
  }
  const layer = new mars3d.layer.GeoJsonLayer({
    id,
    name: options?.name || id,
    ...(data != null ? { data } : {}),
    ...(options?.url ? { url: options.url } : {}),
    pid: options?.pid ?? undefined,
    symbol: options?.symbol || {
      type: "polygon",
      styleOptions: {
        color: "rgba(92,173,255,0.25)",
        outline: true,
        outlineColor: "rgba(92,173,255,1)",
        outlineWidth: 2
      }
    },
    show: true
  })
  map.addLayer(layer)
  return layer
}

/**
 * 添加 TiTiler-PgSTAC 影像图层
 * @param id 图层ID
 * @param collectionId STAC Collection ID
 * @param itemId STAC Item ID
 * @param titilerBaseUrl TiTiler 服务地址
 */
export function addStacTileLayer(
  id: string,
  collectionId: string,
  itemIdOrItem: string | { id: string },
  optionsOrTitilerBaseUrl?: any,
  titilerBaseUrl?: string
) {
  if (!map) { return null }

  const itemId =
    typeof itemIdOrItem === "string"
      ? itemIdOrItem
      : String((itemIdOrItem as any)?.id || "").trim()

  const options = optionsOrTitilerBaseUrl && typeof optionsOrTitilerBaseUrl === "object" ? optionsOrTitilerBaseUrl : undefined
  const titilerUrl =
    (typeof optionsOrTitilerBaseUrl === "string" ? optionsOrTitilerBaseUrl : titilerBaseUrl) || "/api/titiler"
  const item = typeof itemIdOrItem === "string" ? null : itemIdOrItem
  const publicVisualHref = resolvePublicVisualHref(item)

  const nextOptions: any = {
    name: options?.name || id,
    opacity: options?.opacity ?? 1,
    pid: options?.pid,
    collectionId,
    itemId,
    ...options
  }

  const assetsHint = stringifyStyleHint(nextOptions.assets)
  const assetBidxHint = stringifyStyleHint(nextOptions.assetBidx)
  dbgOnce(id, "stac.layer", "addStacTileLayer(build)", {
    collectionId,
    itemId,
    titilerUrl,
    EOAPI_TITILER_URL,
    hasPublicVisualHref: !!publicVisualHref,
    assetsHint,
    assetBidxHint
  })
  if (!nextOptions.styleProfile && (publicVisualHref || assetsHint.includes("visual") || assetBidxHint.includes("visual"))) {
    nextOptions.styleProfile = "optical"
  }
  if (!nextOptions.assetKey && (publicVisualHref || assetsHint.includes("visual"))) {
    nextOptions.assetKey = "visual"
  }

  if (publicVisualHref) {
    const cogBaseUrl = "/api/titiler-cog"
    const xyzUrl = `${cogBaseUrl}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${encodeURIComponent(publicVisualHref)}&${TITILER_RGB_BIDX_QUERY}`
    dbgOnce(id, "stac.layer", "addStacTileLayer(public->cog)", { collectionId, itemId, publicVisualHref, xyzUrl, cogBaseUrl })
    return addXyzLayer(id, xyzUrl, nextOptions)
  }

  const query = new URLSearchParams()
  if (assetsHint) {
    query.set("assets", assetsHint)
  }
  if (assetBidxHint) {
    query.set("asset_bidx", assetBidxHint)
  }

  // TiTiler-PgSTAC tiles URL 格式
  // /collections/{collection_id}/items/{item_id}/tiles/WebMercatorQuad/{z}/{x}/{y}
  const querySuffix = query.toString()
  const xyzUrl = `${titilerUrl}/collections/${collectionId}/items/${itemId}/tiles/WebMercatorQuad/{z}/{x}/{y}${querySuffix ? `?${querySuffix}` : ""}`
  dbgOnce(id, "stac.layer", "addStacTileLayer(pgstac)", { collectionId, itemId, xyzUrl })

  return addXyzLayer(id, xyzUrl, {
    ...nextOptions
  })
}

export function addStacItemLayer(
  id: string,
  collectionId: string,
  itemIdOrItem: string | { id: string },
  optionsOrTitilerBaseUrl?: any,
  titilerBaseUrl?: string
) {
  return addStacTileLayer(id, collectionId, itemIdOrItem, optionsOrTitilerBaseUrl, titilerBaseUrl)
}

/**
 * 添加 TiTiler COG 图层（用于外部 COG URL）
 * @param id 图层ID
 * @param cogUrl COG 文件 URL
 * @param titilerBaseUrl TiTiler 服务地址
 */
export function addCogLayer(id: string, cogUrl: string, titilerBaseUrl?: string) {
  if (!map) { return null }

  const titilerUrl = titilerBaseUrl || "/api/titiler-cog"
  const encodedCogUrl = encodeURIComponent(cogUrl)

  // TiTiler XYZ Tiles URL 格式
  const xyzUrl = `${titilerUrl}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${encodedCogUrl}&${TITILER_RGB_BIDX_QUERY}`
  dbgOnce(id, "stac.layer", "addCogLayer", { cogUrl, titilerUrl, xyzUrl })

  return addXyzLayer(id, xyzUrl, {
    name: id,
    opacity: 1
  })
}

/**
 * 移除图层
 */
export function removeLayer(id: string) {
  if (!map) { return }

  const layer = map.getLayerById(id)
  if (layer) {
    map.removeLayer(layer, true)
  }
}

export function removeLayersByPid(rootPid: string | number): void {
  if (!map) {
    return
  }
  const root = String(rootPid ?? "").trim()
  if (!root) {
    return
  }
  const layers: any[] = map.getLayers({ basemaps: false }) || []
  const pidById = new Map<string, string>()
  layers.forEach((layer: any) => {
    const id = String(layer?.id || "")
    if (!id) {
      return
    }
    const pidRaw = (layer as any)?.pid ?? layer?.options?.pid
    const pid = pidRaw === null || pidRaw === undefined || String(pidRaw) === "" ? "" : String(pidRaw)
    pidById.set(id, pid)
  })

  const toRemove = new Set<string>()
  const queue: string[] = [root]
  const visitedPid = new Set<string>()
  while (queue.length) {
    const pid = queue.shift() as string
    if (!pid || visitedPid.has(pid)) {
      continue
    }
    visitedPid.add(pid)
    for (const [id, p] of pidById.entries()) {
      if (p !== pid) {
        continue
      }
      if (!toRemove.has(id)) {
        toRemove.add(id)
        queue.push(id)
      }
    }
  }

  toRemove.forEach((id) => {
    const layer = map.getLayerById(id as any)
    if (layer) {
      try {
        map.removeLayer(layer, true)
      } catch {
        try {
          map.removeLayer(layer)
        } catch {
        }
      }
    }
  })
}

export function removeLayersByIdPrefix(prefix: string, extraIds?: string[]): void {
  if (!map) {
    return
  }
  const p = String(prefix || "")
  const extra = Array.isArray(extraIds) ? extraIds.map((x) => String(x || "")).filter(Boolean) : []
  if (!p && extra.length === 0) {
    return
  }
  const layerList: any[] = map.getLayers({ basemaps: false }) || []
  layerList.forEach((layer: any) => {
    const id = String(layer?.id || "")
    if (!id) {
      return
    }
    if (p && id.startsWith(p)) {
      try {
        map.removeLayer(layer, true)
      } catch {
        try {
          map.removeLayer(layer)
        } catch {
        }
      }
    }
  })
  extra.forEach((id) => {
    const layer = map.getLayerById(id as any)
    if (layer) {
      try {
        map.removeLayer(layer, true)
      } catch {
        try {
          map.removeLayer(layer)
        } catch {
        }
      }
    }
  })
}

export function removeGraphicsByIdPrefix(prefix: string): void {
  if (!map) {
    return
  }
  const p = String(prefix || "")
  if (!p) {
    return
  }
  const gl: any = (map as any).graphicLayer
  const graphics: any[] = gl?.getGraphics?.() || []
  graphics.forEach((g: any) => {
    const id = String(g?.id || "")
    if (!id || !id.startsWith(p)) {
      return
    }
    try {
      gl.removeGraphic?.(g)
    } catch {
      try {
        gl.remove?.(g)
      } catch {
      }
    }
  })
}

/**
 * 移除所有 eoAPI 图层
 */
export function removeAllEoapiLayers() {
  if (!map) { return }

  const layers = getBusinessLayers()
  layers.forEach((layer: any) => {
    if (layer.id && (layer.id.startsWith("eoapi_") || layer.id.startsWith("stac_"))) {
      map.removeLayer(layer, true)
    }
  })
}

// ============ eoAPI 底图管理 ============

/** eoAPI 服务地址 */
const EOAPI_TIANDITU_PROXY = import.meta.env.VITE_EOAPI_TIANDITU_PROXY || "http://192.168.10.15:5954"
const EOAPI_TIPG_URL = import.meta.env.VITE_EOAPI_TIPG_URL || "http://192.168.10.15:5953"
const TIANDITU_TOKEN = import.meta.env.VITE_TIANDITU_TOKEN || ""

/**
 * 构建天地图瓦片URL
 */
function buildTiandituUrl(layerType: string): string {
  return `${EOAPI_TIANDITU_PROXY}/tianditu/DataServer?T=${layerType}&x={x}&y={y}&l={z}&tk=${TIANDITU_TOKEN}`
}

/**
 * 切换到 eoAPI 本地天地图底图
 * @param type 底图类型：imagery/vector/terrain
 */
export function switchToEoapiBasemap(type: "imagery" | "vector" | "terrain"): void {
  if (!map) {
    console.warn("[eoapi] 地图实例不存在")
    return
  }

  const layerConfigs: Record<string, { base: string; label: string; name: string }> = {
    imagery: {
      base: buildTiandituUrl("img_w"),
      label: buildTiandituUrl("cia_w"),
      name: "天地图影像"
    },
    vector: {
      base: buildTiandituUrl("vec_w"),
      label: buildTiandituUrl("cva_w"),
      name: "天地图矢量"
    },
    terrain: {
      base: buildTiandituUrl("ter_w"),
      label: buildTiandituUrl("cta_w"),
      name: "天地图地形"
    }
  }

  const config = layerConfigs[type]
  if (!config) {
    console.error("[eoapi] 无效的底图类型:", type)
    return
  }

  // 创建底图图层组
  const baseLayer = new mars3d.layer.XyzLayer({
    url: config.base,
    name: "底图"
  })
  const labelLayer = new mars3d.layer.XyzLayer({
    url: config.label,
    name: "注记"
  })

  const eoapiBasemapGroup = new (mars3d.layer as any).GroupLayer({
    name: config.name,
    layers: [baseLayer, labelLayer],
    show: true
  })

  // 设置为新底图（使用类型断言，Mars3D 实际支持 GroupLayer 作为底图）
  const mapAny = map as any
  mapAny.basemap = eoapiBasemapGroup
  console.log(`[eoapi] 已切换到底图: ${config.name}`)
}

/**
 * 加载 eoAPI 叠加图层（行政边界）
 */
export async function loadEoapiOverlays(): Promise<void> {
  if (!map) {
    console.warn("[eoapi] 地图实例不存在")
    return
  }

  const boundaries = [
    {
      collectionId: "public.china_province_boundaries",
      name: "中国省级行政区边界",
      strokeColor: "#FF0000",
      strokeWidth: 2,
      fillColor: "rgba(255,0,0,0.1)"
    },
    {
      collectionId: "public.yunnan_city_boundaries",
      name: "云南州市级边界",
      strokeColor: "#0000FF",
      strokeWidth: 1.5,
      fillColor: "rgba(0,0,255,0.05)"
    }
  ]

  for (const boundary of boundaries) {
    const url = `${EOAPI_TIPG_URL}/collections/${boundary.collectionId}/items?f=geojson`

    const layer = new mars3d.layer.GeoJsonLayer({
      id: `vector_${boundary.collectionId}`,
      name: boundary.name,
      url,
      symbol: {
        type: "polygon",
        styleOptions: {
          color: boundary.fillColor,
          outline: true,
          outlineColor: boundary.strokeColor,
          outlineWidth: boundary.strokeWidth
        }
      },
      show: true
    })

    map.addLayer(layer)
  }

  console.log("[eoapi] 已加载 eoAPI 叠加图层")
}

/**
 * 加载本地 DEM 地形阴影
 */
export function loadDemHillshade(): mars3d.layer.XyzLayer | null {
  if (!map) {
    console.warn("[eoapi] 地图实例不存在")
    return null
  }

  const url = `${EOAPI_TITILER_URL}/cog/tiles/{z}/{x}/{y}@1x?url=/data/dem/yunnan_hillshade_cog.tif&rescale=0,255`

  const layer = new mars3d.layer.XyzLayer({
    id: "dem_hillshade",
    name: "云南地形阴影",
    url,
    minimumTerrainLevel: 8,
    maximumTerrainLevel: 15,
    show: true,
    opacity: 0.7
  })

  map.addLayer(layer)
  console.log("[eoapi] 已加载 DEM 地形阴影图层")
  return layer
}

/**
 * 移除 DEM 地形阴影图层
 */
export function removeDemHillshade(): void {
  if (!map) {
    return
  }

  const layer = map.getLayerById("dem_hillshade")
  if (layer) {
    map.removeLayer(layer, true)
    console.log("[eoapi] 已移除 DEM 地形阴影图层")
  }
}

/**
 * 检查 eoAPI 服务可用性
 */
export async function checkEoapiServices(): Promise<{
  tipg: { available: boolean; latency: number }
  titiler: { available: boolean; latency: number }
}> {
  const checkService = async (url: string): Promise<{ available: boolean; latency: number }> => {
    const startTime = Date.now()
    try {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 5000)
      const response = await fetch(url, { method: "HEAD", signal: controller.signal })
      return { available: response.ok, latency: Date.now() - startTime }
    } catch {
      return { available: false, latency: Date.now() - startTime }
    }
  }

  const [tipg, titiler] = await Promise.all([
    checkService(`${EOAPI_TIPG_URL}/collections`),
    checkService(EOAPI_TITILER_URL)
  ])

  return { tipg, titiler }
}

// ============ 导出事件目标 ============

export const eventTarget = new mars3d.BaseClass()
let focusBlinkStyleInjected = false
const layerFlashDebounceMap = new Map<string, number>()

// ============ 图层定位与闪烁 ============

export function flyToLayer(layerId: string | number) {
  if (!map) { return }
  const layer = map.getLayerById(layerId as any)
  if (!layer) { return }
  try {
    if (typeof (layer as any).flyTo === "function") {
      ;(layer as any).flyTo()
      return
    }
  } catch {}
  try {
    ;(map as any).flyTo?.(layer)
  } catch {}
}

export async function flashLayer(layerId: string | number, options?: { times?: number; intervalMs?: number }) {
  if (!map) { return }
  const layer: any = map.getLayerById(layerId as any)
  if (!layer) { return }
  const normalizedId = String(layerId)
  const now = Date.now()
  const lastAt = layerFlashDebounceMap.get(normalizedId) || 0
  if (now - lastAt < 300) {
    return
  }
  layerFlashDebounceMap.set(normalizedId, now)
  const times = Math.max(1, Math.floor(options?.times ?? 3))
  const intervalMs = Math.max(16, Math.floor(options?.intervalMs ?? 16))
  const totalDuration = Math.max(360, times * 18 * intervalMs)

  const injectBlinkStyle = () => {
    if (focusBlinkStyleInjected || typeof document === "undefined") {
      return
    }
    const style = document.createElement("style")
    style.id = "eoapi-layer-focus-style"
    style.textContent = `
      .eoapi-layer-focus-ring {
        position: absolute;
        border: 2px solid rgba(255, 210, 0, 0.92);
        border-radius: 999px;
        box-shadow: 0 0 0 4px rgba(255, 210, 0, 0.12);
        pointer-events: none;
        transform-origin: center center;
        will-change: transform, opacity;
      }
    `
    document.head.appendChild(style)
    focusBlinkStyleInjected = true
  }

  const collectCoords = (geom: any, out: number[][]) => {
    if (!geom) {
      return
    }
    if (Array.isArray(geom) && typeof geom[0] === "number" && typeof geom[1] === "number") {
      out.push([Number(geom[0]), Number(geom[1])])
      return
    }
    if (Array.isArray(geom)) {
      geom.forEach((item) => collectCoords(item, out))
      return
    }
    if (geom.type && geom.coordinates) {
      collectCoords(geom.coordinates, out)
    }
  }

  const getGeojsonCenter = (): [number, number] | null => {
    const source = layer?.options?.data
    const features = source?.features
    if (!Array.isArray(features)) {
      return null
    }
    const coords: number[][] = []
    features.forEach((f: any) => collectCoords(f?.geometry, coords))
    if (!coords.length) {
      return null
    }
    const xs = coords.map((c) => c[0]).filter(Number.isFinite)
    const ys = coords.map((c) => c[1]).filter(Number.isFinite)
    if (!xs.length || !ys.length) {
      return null
    }
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  }

  const createOverlay = () => {
    injectBlinkStyle()
    const parent = (map as any)?.container || map.scene?.canvas?.parentElement || document.body
    const center = getGeojsonCenter()
    if (!parent || !center) {
      return null
    }
    const cart = Cesium.Cartesian3.fromDegrees(center[0], center[1], 0)
    const pos = Cesium.SceneTransforms.worldToWindowCoordinates(map.scene, cart)
    if (!pos) {
      return null
    }
    const el = document.createElement("div")
    el.className = "eoapi-layer-focus-ring"
    el.style.left = `${pos.x}px`
    el.style.top = `${pos.y}px`
    el.style.width = "84px"
    el.style.height = "84px"
    el.style.opacity = "0"
    parent.appendChild(el)
    return el
  }

  const overlay = createOverlay()
  if (!overlay) {
    try { map.scene?.requestRender?.() } catch {}
    return
  }

  const startedAt = performance.now()
  await new Promise<void>((resolve) => {
    const animate = (ts: number) => {
      const elapsed = ts - startedAt
      const progress = Math.max(0, Math.min(1, elapsed / totalDuration))
      const wave = Math.sin(progress * Math.PI * times)
      const opacity = Math.max(0, wave) * (1 - progress * 0.65)
      const scale = 0.82 + progress * 0.42
      overlay.style.opacity = opacity.toFixed(3)
      overlay.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`
      try { map.scene?.requestRender?.() } catch {}
      if (progress >= 1) {
        try { overlay.remove() } catch {}
        resolve()
        return
      }
      window.requestAnimationFrame(animate)
    }
    window.requestAnimationFrame(animate)
  })
}
