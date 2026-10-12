/**
 * 底图控制
 * @copyright 火星科技 mars3d.cn
 * @author 火星渣渣灰 2022-01-10
 */
import * as mars3d from "mars3d"
import { retryLoad } from "../dataset-repository/services/layer-retry"

const Cesium = mars3d.Cesium
let map: mars3d.Map // 地图对象

// 初始化当前业务
export function onMounted(mapInstance: mars3d.Map): void {
  map = mapInstance // 记录map
}

// 释放当前业务
export function onUnmounted(): void {
  map = null
}

function notify(msg: string, type: "success" | "info" | "warning" | "error" = "info") {
  const gm = (window as any)?.globalMsg
  if (typeof gm === "function") {
    gm(msg, type)
    return
  }
  if (type === "error") {
    window.alert(msg)
  }
}

function formatTileUrl(urlTemplate: string, x: number, y: number, z: number) {
  let url = urlTemplate
  url = url.replaceAll("{x}", String(x)).replaceAll("{y}", String(y)).replaceAll("{z}", String(z))
  url = url.replaceAll("{s}", "a").replaceAll("{a-c}", "a")
  if (url.startsWith("//")) {
    url = `${location.protocol}${url}`
  }
  return url
}

async function canLoadTile(urlTemplate: string, timeoutMs = 3000) {
  const testUrl = formatTileUrl(urlTemplate, 0, 0, 1)
  return await new Promise<boolean>((resolve) => {
    const img = new Image()
    const timer = window.setTimeout(() => resolve(false), timeoutMs)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(true)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve(false)
    }
    img.src = testUrl
  })
}

function getCurrentBasemapId() {
  try {
    const basemaps = map?.getBasemaps(true) || []
    const active = basemaps.find((b: any) => b && b.isAdded && b.show)
    return active?.id ?? ""
  } catch {
    return ""
  }
}

export function applyExclusiveBasemapState(basemaps: any[], activeId: string): void {
  for (const basemap of basemaps || []) {
    if (!basemap) {
      continue
    }
    const isActive = String(basemap.id || "") === String(activeId || "")
    try {
      basemap.show = isActive
    } catch {
    }
  }
}

async function ensureTileReachableWithRetry(urlTemplate: string): Promise<void> {
  await retryLoad(
    async () => {
      const ok = await canLoadTile(urlTemplate, 2500)
      if (!ok) {
        throw new Error("tile unreachable")
      }
      return true
    },
    {
      maxRetries: 3,
      delays: [3000, 6000, 12000]
    }
  )
}

export async function changeBaseMaps(item: any): Promise<boolean> {
  if (!map) {
    return false
  }

  const id = item?.id ?? item
  if (!id) {
    return false
  }

  const options = item?.options || {}
  const type = options?.type
  const oldId = getCurrentBasemapId()

  if (type === "bing") {
    const bingKey = (mars3d.Cesium as any)?.BingMapsApi?.defaultKey
    if (!bingKey) {
      notify("微软影像底图需要配置 Bing Key（且需要可访问外网）", "error")
      return false
    }
  }

  if (type === "xyz" && typeof options?.url === "string") {
    try {
      await ensureTileReachableWithRetry(options.url)
    } catch {
      notify("该底图瓦片服务不可达（可能需要外网/代理）", "error")
      if (oldId) {
        map.basemap = oldId
        triggerMapRender()
      }
      return false
    }
  }

  if (type === "group" && Array.isArray(options?.layers) && options.layers.length > 0) {
    const first = options.layers.find((l: any) => l && typeof l.url === "string")?.url
    if (first) {
      try {
        await ensureTileReachableWithRetry(first)
      } catch {
        notify("该底图瓦片服务不可达（可能需要外网/代理）", "error")
        if (oldId) {
          map.basemap = oldId
          triggerMapRender()
        }
        return false
      }
    }
  }

  const mapAny = map as any
  mapAny._lastUserBasemapId = id
  mapAny._lastUserBasemapChangeAt = Date.now()
  map.basemap = id
  applyExclusiveBasemapState(map.getBasemaps(true) || [], id)
  try {
    localStorage.setItem("mars3d_basemap_state_v1", JSON.stringify({ id, ts: Date.now() }))
  } catch {
  }
  triggerMapRender()
  return true
}

export function changeTerrain(value: boolean) {
  map.hasTerrain = value
  // 触发地图重渲染，解决按需渲染模式下地形切换后地图不更新的问题
  triggerMapRender()
}

/**
 * 触发地图重渲染
 * 解决 requestRenderMode 启用时，底图/地形切换后地图不更新的问题
 */
function triggerMapRender() {
  if (!map) {
    return
  }

  const scene = map.scene
  if (scene) {
    // 方式1：请求一次渲染（适用于 requestRenderMode）
    scene.requestRender()

    // 方式2：如果方式1不生效，强制触发下一帧渲染
    if (map.viewer && map.viewer.clock) {
      map.viewer.clock.tick()
    }
  }
}

export function getLayers() {
  return {
    baseMaps: map.getBasemaps(true),
    hasTerrain: map.hasTerrain
  }
}

/** 重新加载当前底图并触发渲染 */
export function refreshBasemap(): void {
  if (!map) {
    return
  }
  const id = getCurrentBasemapId()
  if (id) {
    map.basemap = id
    applyExclusiveBasemapState(map.getBasemaps(true) || [], id)
  }
  triggerMapRender()
}
