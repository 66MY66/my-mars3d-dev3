/**
 * eoAPI 工作台地图交互层
 * @description 所有涉及 Mars3D/Cesium API 调用的代码
 */

import * as mars3d from "mars3d"
const Cesium = mars3d.Cesium

let map: mars3d.Map // 地图对象
let viewChangeCallback: ((viewState: any) => void) | null = null
let pickCoordinateHandler: any | null = null
let pickCoordinateCallback: ((coord: any) => void) | null = null
let viewChangeLastAt = 0
let viewChangeTimer: number | null = null

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
  const layer = new mars3d.layer.XyzLayer({
    id,
    name: options?.name || id,
    url,
    minimumTerrainLevel: 0,
    maximumTerrainLevel: 18,
    show: true,
    opacity: options?.opacity ?? 1,
    ...options
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
export function addStacTileLayer(id: string, collectionId: string, itemId: string, titilerBaseUrl?: string) {
  if (!map) { return null }

  const titilerUrl = titilerBaseUrl || "/api/titiler"

  // TiTiler-PgSTAC tiles URL 格式
  // /collections/{collection_id}/items/{item_id}/tiles/WebMercatorQuad/{z}/{x}/{y}
  const xyzUrl = `${titilerUrl}/collections/${collectionId}/items/${itemId}/tiles/WebMercatorQuad/{z}/{x}/{y}`

  return addXyzLayer(id, xyzUrl, {
    name: id,
    opacity: 1
  })
}

/**
 * 添加 TiTiler COG 图层（用于外部 COG URL）
 * @param id 图层ID
 * @param cogUrl COG 文件 URL
 * @param titilerBaseUrl TiTiler 服务地址
 */
export function addCogLayer(id: string, cogUrl: string, titilerBaseUrl?: string) {
  if (!map) { return null }

  const titilerUrl = titilerBaseUrl || "/api/titiler"
  const encodedCogUrl = encodeURIComponent(cogUrl)

  // TiTiler XYZ Tiles URL 格式
  const xyzUrl = `${titilerUrl}/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${encodedCogUrl}&bidx=1,2,3`

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
const EOAPI_TIANDITU_PROXY = import.meta.env.VITE_EOAPI_TIANDITU_PROXY || "http://192.168.0.15:5954"
const EOAPI_TIPG_URL = import.meta.env.VITE_EOAPI_TIPG_URL || "http://192.168.0.15:5953"
const EOAPI_TITILER_URL = import.meta.env.VITE_EOAPI_TITILER_URL || "http://192.168.0.15:5955"
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
