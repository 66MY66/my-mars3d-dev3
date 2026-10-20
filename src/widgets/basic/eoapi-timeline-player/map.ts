/**
 * 时间轴演化播放器地图交互层
 * @description 支持按时间顺序播放 STAC 数据集中的多个影像
 */

import * as mars3d from "mars3d"
const Cesium = mars3d.Cesium

let map: mars3d.Map
let currentLayer: any | null = null
const itemsCache: Map<string, any> = new Map()

// ============ 生命周期钩子 ============

export function onMounted(mapInstance: mars3d.Map) {
  map = mapInstance
}

export function onUnmounted() {
  clearTimelineLayer()
  itemsCache.clear()
  map = null
}

// ============ 时间轴播放核心功能 ============

/**
 * 加载指定时间点的影像
 * @param collectionId STAC Collection ID
 * @param itemId STAC Item ID
 */
export function loadTimelineItem(collectionId: string, itemId: string): boolean {
  if (!map) { return false }

  // 先清除当前图层
  clearTimelineLayer()

  // 创建图层
  const layerId = `timeline_${collectionId}_${itemId.replace(/[^a-zA-Z0-9_-]/g, "_")}`
  const cached = getCachedItem(itemId)
  const bbox = Array.isArray(cached?.bbox) && cached.bbox.length === 4 ? (cached.bbox as [number, number, number, number]) : null

  let layer: any = null
  const localGeojsonHref = String(cached?.assets?.data?.href || "")
  const localTileHref = String(cached?.assets?.visual?.href || "")
  if (String(collectionId || "").startsWith("local_") && localTileHref && !localGeojsonHref) {
    const levelMatch = /Level(\d+)/.exec(localTileHref)
    layer = new mars3d.layer.XyzLayer({
      id: layerId,
      name: `时间轴-${cached?.properties?.title || itemId}`,
      url: localTileHref,
      show: true,
      maximumLevel: levelMatch ? Number(levelMatch[1]) : 18
    })
    map.addLayer(layer)
    currentLayer = layer
    if (bbox) {
      flyToBbox(bbox, 1.0)
    }
    return true
  }

  if (String(collectionId || "").startsWith("local_") && localGeojsonHref) {
    const isQuake = localGeojsonHref.includes("earthquake")
    const isRiver = localGeojsonHref.includes("rivers")
    let popup = "名称：{name}"
    let symbol: any = {
      type: "polygon",
      styleOptions: {
        opacity: 0.45,
        outline: true,
        outlineColor: "#ffffff",
        outlineWidth: 2,
        clampToGround: true
      }
    }
    if (isQuake) {
      popup = "震级：{mag}<br/>地点：{place}<br/>时间：{time}<br/>深度：{depth_km} km<br/>来源：{source}"
      symbol = {
        type: "point",
        styleOptions: {
          color: "#ff4d4f",
          pixelSize: 8,
          outline: true,
          outlineColor: "#ffffff",
          outlineWidth: 1,
          clampToGround: true
        }
      }
    } else if (isRiver) {
      popup = "河流：{name}"
      symbol = {
        type: "polyline",
        styleOptions: {
          color: "#40a9ff",
          width: 3,
          clampToGround: true
        }
      }
    }
    layer = new mars3d.layer.GeoJsonLayer({
      id: layerId,
      name: `时间轴-${cached?.properties?.title || itemId}`,
      url: localGeojsonHref,
      show: true,
      popup,
      symbol
    })
    map.addLayer(layer)
    currentLayer = layer
    if (bbox) {
      flyToBbox(bbox, 1.0)
    }
    return true
  }

  if (String(collectionId || "").startsWith("local_") && bbox) {
    const [w, s, e, n] = bbox
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { id: itemId },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [w, s],
                [e, s],
                [e, n],
                [w, n],
                [w, s]
              ]
            ]
          }
        }
      ]
    }
    layer = new mars3d.layer.GeoJsonLayer({
      id: layerId,
      name: `时间轴-${itemId}`,
      data: geojson,
      symbol: {
        type: "polygon",
        styleOptions: {
          color: "rgba(255,153,0,0.18)",
          outline: true,
          outlineColor: "rgba(255,153,0,1)",
          outlineWidth: 2
        }
      },
      show: true
    })
    map.addLayer(layer)
    currentLayer = layer
    flyToBbox(bbox, 1.0)
    return true
  }

  const titilerUrl = "/api/titiler"
  const xyzUrl = `${titilerUrl}/collections/${collectionId}/items/${itemId}/tiles/WebMercatorQuad/{z}/{x}/{y}`
  layer = new mars3d.layer.XyzLayer({
    id: layerId,
    name: `时间轴-${itemId}`,
    url: xyzUrl,
    show: true,
    opacity: 1
  })

  map.addLayer(layer)
  currentLayer = layer

  return true
}

/**
 * 加载 COG 影像（通过外部 URL）
 * @param id 图层 ID
 * @param cogUrl COG 文件 URL
 */
export function loadTimelineCog(id: string, cogUrl: string): boolean {
  if (!map) { return false }

  clearTimelineLayer()

  const titilerUrl = "/api/titiler"
  const encodedCogUrl = encodeURIComponent(cogUrl)
  const xyzUrl = `${titilerUrl}/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${encodedCogUrl}&bidx=1,2,3`

  const layer = new mars3d.layer.XyzLayer({
    id: `timeline_${id}`,
    name: `时间轴-${id}`,
    url: xyzUrl,
    show: true,
    opacity: 1
  })

  map.addLayer(layer)
  currentLayer = layer

  return true
}

/**
 * 清除当前时间轴图层
 */
export function clearTimelineLayer() {
  if (currentLayer && map) {
    map.removeLayer(currentLayer, true)
    currentLayer = null
  }
}

/**
 * 设置图层透明度
 */
export function setTimelineOpacity(opacity: number) {
  if (!currentLayer) {
    return
  }
  try {
    if (typeof currentLayer.opacity === "number") {
      currentLayer.opacity = opacity
    }
  } catch {
  }
}

/**
 * 飞到指定 bbox 范围
 */
export function flyToBbox(bbox: [number, number, number, number], duration?: number) {
  if (!map || !bbox || bbox.length < 4) { return }

  const [west, south, east, north] = bbox

  map.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
    duration: duration ?? 1.0
  })
}

/**
 * 飞到当前位置的高处（俯视）
 */
export function flyToOverview() {
  if (!map) { return }

  const camera = map.camera
  const center = camera.positionCartographic

  map.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      Cesium.Math.toDegrees(center.longitude),
      Cesium.Math.toDegrees(center.latitude),
      500000 // 500km 高度
    ),
    duration: 1.0
  })
}

/**
 * 获取当前图层信息
 */
export function getTimelineLayerInfo() {
  return currentLayer
    ? {
        id: currentLayer.id,
        name: currentLayer.name,
        show: currentLayer.show,
        opacity: currentLayer.opacity
      }
    : null
}

/**
 * 缓存 Item 数据（用于快速切换）
 */
export function cacheItem(itemId: string, itemData: any) {
  itemsCache.set(itemId, itemData)
}

/**
 * 获取缓存的 Item 数据
 */
export function getCachedItem(itemId: string): any | null {
  return itemsCache.get(itemId) || null
}

/**
 * 清除缓存
 */
export function clearCache() {
  itemsCache.clear()
}

export function resizeMapView(): void {
  if (!map || !(map as any).viewer) {
    return
  }
  try {
    ;(map as any).viewer.resize()
    map.scene?.requestRender?.()
  } catch {
  }
}

// ============ 导出事件目标 ============

export const eventTarget = new mars3d.BaseClass()
