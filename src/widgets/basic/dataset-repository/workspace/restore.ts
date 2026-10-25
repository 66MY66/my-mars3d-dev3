/**
 * 工作区恢复模块
 * @description 将 Manifest 成果包恢复到 Mars3D 工作区
 */

import * as mars3d from "mars3d"
import { Manifest } from "../types/eoapi-types"
import { RestoreStrategy, applyRestoreStrategy, ConflictResolution } from "./strategies"
import { applyDefaultRasterStyleOptions } from "../services/layer-style-defaults"
import { ensureUniqueMapLayerId, normalizeLayerIdToken } from "../services/layer-id"
import { findSourceRegistryEntry } from "../services/source-registry"

const Cesium = mars3d.Cesium

/**
 * 恢复选项
 */
export interface RestoreOptions {
  /** 恢复策略：replace（替换）或 overlay（叠加） */
  strategy?: RestoreStrategy
  /** 冲突处理方式 */
  conflictResolution?: ConflictResolution
  /** 图层ID前缀（用于避免与现有图层冲突） */
  layerIdPrefix?: string
  /** 图层名称前缀（用于在图层树中体现来源分组） */
  layerNamePrefix?: string
  /** 图层父节点ID（用于图层树分组） */
  layerParentId?: string | number
  /** 绘制要素ID前缀（用于避免与现有绘制要素冲突） */
  drawIdPrefix?: string
  /** 是否恢复视角 */
  restoreView?: boolean
  /** 是否恢复图层 */
  restoreLayers?: boolean
  /** 是否恢复绘制要素 */
  restoreDrawFeatures?: boolean
  /** 是否在恢复绘制要素前清空现有绘制要素 */
  clearExistingDrawFeatures?: boolean
  /** 飞行动画时长（秒） */
  flyDuration?: number
  /** 回放时间戳（用于动态层 datetime 注入） */
  timeAt?: number
  /** 恢复完成回调 */
  onComplete?: () => void
  /** 恢复失败回调 */
  onError?: (error: Error) => void
}

/**
 * 恢复 Manifest 到 Mars3D 工作区
 * @param map Mars3D 地图实例
 * @param manifest 成果包
 * @param options 恢复选项
 */
export async function restoreWorkspace(
  map: mars3d.Map,
  manifest: Manifest,
  options: RestoreOptions = {}
): Promise<void> {
  const {
    strategy = "overlay",
    conflictResolution = "rename",
    layerIdPrefix = "",
    layerNamePrefix = "",
    layerParentId,
    drawIdPrefix = "",
    restoreView = true,
    restoreLayers = true,
    restoreDrawFeatures = true,
    clearExistingDrawFeatures = strategy === "replace",
    flyDuration = 1.5,
    timeAt,
    onComplete,
    onError
  } = options

  try {
    if (strategy !== "replace" && Array.isArray(manifest.layers)) {
      const source = manifest.layers
        .map((layer: any) => layer?.options)
        .find((layerOptions: any) => String(layerOptions?.sourceRegistryKey || "").trim())
      const sourceKey = String(source?.sourceRegistryKey || "").trim()
      if (sourceKey) {
        const existing = findSourceRegistryEntry(map, sourceKey)
        if (existing) {
          const label = String(source?.sourceRegistryLabel || existing.label || sourceKey).trim()
          throw new Error(`${label}已在地图中加载，禁止重复实例化`)
        }
      }
    }

    // 应用恢复策略（准备工作区）
    await applyRestoreStrategy(map, strategy, manifest)

    // 恢复视角
    if (restoreView && manifest.viewState) {
      await restoreViewState(map, manifest.viewState, flyDuration)
    }

    // 恢复图层
    if (restoreLayers && manifest.layers) {
      await restoreLayersState(map, manifest.layers, {
        conflictResolution,
        layerIdPrefix,
        layerNamePrefix,
        layerParentId,
        timeAt: typeof timeAt === "number" ? timeAt : (manifest.viewState?.timestamp || manifest.createdAt || Date.now())
      })
    }

    // 恢复绘制要素
    if (restoreDrawFeatures && manifest.drawFeatures) {
      if (clearExistingDrawFeatures) {
        try {
          map.graphicLayer?.clear?.()
        } catch {
        }
        try {
          const restoredLayer: any = map.getLayerById?.("restored_features")
          if (restoredLayer?.clear) {
            restoredLayer.clear()
          }
        } catch {
        }
        try {
          const legacy: any = map.getLayerById?.("mars3d_draw_layer")
          if (legacy?.clear) {
            legacy.clear()
          }
        } catch {
        }
      }
      await restoreDrawFeaturesState(map, manifest.drawFeatures, drawIdPrefix)
    }

    // 执行完成回调
    onComplete?.()
  } catch (error) {
    onError?.(error as Error)
    throw error
  }
}

/**
 * 恢复视角状态
 */
async function restoreViewState(
  map: mars3d.Map,
  viewState: Manifest["viewState"],
  flyDuration: number
): Promise<void> {
  if (!viewState) { return }

  const { center, zoom, heading, pitch, bbox } = viewState

  // 如果有 bbox，优先使用 bbox 飞行
  if (bbox && bbox.length === 4) {
    const [west, south, east, north] = bbox

    map.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
      duration: flyDuration
    })
    return
  }

  // 使用 center + zoom
  if (center) {
    const height = getHeightFromZoom(zoom || 12)

    map.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        center.longitude,
        center.latitude,
        height
      ),
      orientation: {
        heading: Cesium.Math.toRadians(heading || 0),
        pitch: Cesium.Math.toRadians(pitch || -45),
        roll: 0
      },
      duration: flyDuration
    })
  }
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
 * 恢复图层状态
 */
async function restoreLayersState(
  map: mars3d.Map,
  layers: Manifest["layers"],
  options: {
    conflictResolution: ConflictResolution
    layerIdPrefix: string
    layerNamePrefix: string
    layerParentId?: string | number
    timeAt: number
  }
): Promise<void> {
  if (!layers || layers.length === 0) { return }

  const sorted = [...layers].sort((a, b) => {
    const ag = a.sourceType === "group" ? 0 : 1
    const bg = b.sourceType === "group" ? 0 : 1
    if (ag !== bg) {
      return ag - bg
    }
    return (a.order ?? 0) - (b.order ?? 0)
  })
  const pref = options.layerIdPrefix || ""
  const knownIds = new Set<string>(
    sorted.map((l) => {
      const base = normalizeLayerIdToken((l as any)?.id, "layer")
      return `${pref}${base}`
    })
  )

  // 按顺序恢复图层
  for (const layerInfo of sorted) {
    const baseId = normalizeLayerIdToken(layerInfo.id, "layer")
    const desiredId = `${options.layerIdPrefix || ""}${baseId}`
    const existingLayer = map.getLayerById(desiredId)

    // 处理冲突
    let layerId = desiredId
    if (existingLayer) {
      if (options.conflictResolution === "skip") {
        continue
      } else if (options.conflictResolution === "replace") {
        map.removeLayer(existingLayer, true)
      } else if (options.conflictResolution === "rename") {
        layerId = ensureUniqueMapLayerId(map as any, desiredId)
      }
    }

    const rawPid = (layerInfo as any)?.pid
    const hasPid = rawPid !== null && rawPid !== undefined && String(rawPid) !== ""
    const normalizedPid = (() => {
      if (!hasPid || String(rawPid) === String(baseId)) {
        return options.layerParentId
      }
      const candidate = `${pref}${normalizeLayerIdToken(rawPid, "group")}`
      if (knownIds.has(candidate)) {
        return candidate
      }
      return options.layerParentId
    })()

    // 根据类型创建图层
    await createLayerFromInfo(map, layerId, layerInfo, {
      namePrefix: options.layerNamePrefix,
      pid: normalizedPid,
      timeAt: options.timeAt
    })
  }
}

/**
 * 根据图层信息创建图层
 */
async function createLayerFromInfo(
  map: mars3d.Map,
  layerId: string,
  layerInfo: Manifest["layers"] extends Array<infer T> ? T : never,
  options?: { namePrefix?: string; pid?: string | number; timeAt?: number }
): Promise<void> {
  const { sourceType, sourceRef, name, visible, opacity } = layerInfo
  const nextName = `${options?.namePrefix || ""}${name || layerId}`
  const pid = options?.pid
  const timeAt = typeof options?.timeAt === "number" ? options?.timeAt : Date.now()
  const resolvedSourceRef = applyTemporalToUrl(String(sourceRef || ""), (layerInfo as any)?.temporal, timeAt, (layerInfo as any)?.timeExtent)
  const storedOptions = (layerInfo as any)?.options
  const withRasterDefaults = <T extends Record<string, any>>(input: T): T =>
    applyDefaultRasterStyleOptions(input, layerInfo, effectiveSourceType)

  let effectiveSourceType = String(sourceType || "").trim() || "unknown"
  if (shouldInferSourceType(effectiveSourceType)) {
    const inferred = inferSourceTypeFromUrl(resolvedSourceRef, storedOptions)
    if (inferred) {
      effectiveSourceType = inferred
    }
  }

  if (storedOptions && typeof storedOptions === "object") {
    const opt = cloneJson(storedOptions) || {}
    opt.id = layerId
    opt.name = nextName
    if (pid !== null && pid !== undefined && String(pid) !== "") {
      opt.pid = pid
    }
    if (visible !== null && visible !== undefined) {
      opt.show = visible
    }
    if (opacity !== null && opacity !== undefined) {
      opt.opacity = opacity
    }
    if (resolvedSourceRef && (typeof opt.url === "string" || opt.url === undefined || opt.url === null)) {
      opt.url = resolvedSourceRef
    }
    if (!opt.type && effectiveSourceType) {
      opt.type = effectiveSourceType
    }
    if ((layerInfo as any)?.zIndex !== undefined && opt.zIndex === undefined) {
      opt.zIndex = (layerInfo as any).zIndex
    }
    try {
      const LayerUtil = (mars3d as any)?.LayerUtil
      if (LayerUtil && typeof LayerUtil.create === "function") {
        const layer = LayerUtil.create(withRasterDefaults(opt))
        if (layer) {
          map.addLayer(layer)
          return
        }
      }
    } catch {
    }
  }

  // 根据来源类型创建对应图层
  switch (effectiveSourceType) {
    case "group": {
      const anyMars: any = mars3d as any
      const GroupLayer = anyMars?.layer?.GroupLayer
      if (typeof GroupLayer === "function") {
        try {
          const groupLayer = new GroupLayer({
            id: layerId,
            name: nextName,
            type: "group",
            show: visible ?? true,
            open: true,
            pid
          })
          map.addLayer(groupLayer)
        } catch {
        }
      }
      break
    }

    case "xyz":
    case "tile":
    case "tms": {
      const layer = new mars3d.layer.XyzLayer(withRasterDefaults({
        id: layerId,
        name: nextName,
        url: resolvedSourceRef,
        show: visible ?? true,
        opacity: opacity ?? 1,
        minimumTerrainLevel: 0,
        maximumTerrainLevel: 18,
        pid
      }))
      map.addLayer(layer)
      break
    }

    case "wms": {
      let created: any = null
      try {
        const LayerUtil = (mars3d as any)?.LayerUtil
        if (LayerUtil && typeof LayerUtil.create === "function") {
          created = LayerUtil.create(withRasterDefaults({
            id: layerId,
            name: nextName,
            type: "wms",
            url: resolvedSourceRef,
            show: visible ?? true,
            opacity: opacity ?? 1,
            pid,
            ...(layerInfo as any)?.options
          }))
        }
      } catch {
        created = null
      }
      if (created) {
        map.addLayer(created)
        break
      }
      if (resolvedSourceRef) {
        const layer = new mars3d.layer.XyzLayer(withRasterDefaults({
          id: layerId,
          name: nextName,
          url: resolvedSourceRef,
          show: visible ?? true,
          opacity: opacity ?? 1,
          pid
        }))
        map.addLayer(layer)
      }
      break
    }

    case "wmts": {
      let created: any = null
      try {
        const LayerUtil = (mars3d as any)?.LayerUtil
        if (LayerUtil && typeof LayerUtil.create === "function") {
          created = LayerUtil.create(withRasterDefaults({
            id: layerId,
            name: nextName,
            type: "wmts",
            url: resolvedSourceRef,
            show: visible ?? true,
            opacity: opacity ?? 1,
            pid,
            ...(layerInfo as any)?.options
          }))
        }
      } catch {
        created = null
      }
      if (created) {
        map.addLayer(created)
        break
      }
      if (resolvedSourceRef) {
        const layer = new mars3d.layer.XyzLayer(withRasterDefaults({
          id: layerId,
          name: nextName,
          url: resolvedSourceRef,
          show: visible ?? true,
          opacity: opacity ?? 1,
          pid
        }))
        map.addLayer(layer)
      }
      break
    }

    case "arcgis": {
      const layer = new mars3d.layer.ArcGisLayer(withRasterDefaults({
        id: layerId,
        name: nextName,
        url: resolvedSourceRef,
        show: visible ?? true,
        pid
      }))
      map.addLayer(layer)
      break
    }

    case "3dtiles": {
      const layer = new mars3d.layer.TilesetLayer({
        id: layerId,
        name: nextName,
        url: resolvedSourceRef,
        show: visible ?? true,
        pid
      })
      map.addLayer(layer)
      break
    }

    case "geojson": {
      const data = (layerInfo as any)?.data
      const extra = ((layerInfo as any)?.options || {}) as Record<string, any>
      const symbol = (layerInfo as any)?.symbol || extra.symbol
      const popup = (layerInfo as any)?.popup || extra.popup
      const layer = new mars3d.layer.GeoJsonLayer({
        id: layerId,
        name: nextName,
        url: data ? undefined : resolvedSourceRef,
        data: data || undefined,
        show: visible ?? true,
        pid,
        ...(symbol ? { symbol } : {}),
        ...(popup ? { popup } : {})
      })
      map.addLayer(layer)
      break
    }

    case "image": {
      let created: any = null
      try {
        const LayerUtil = (mars3d as any)?.LayerUtil
        if (LayerUtil && typeof LayerUtil.create === "function") {
          created = LayerUtil.create(withRasterDefaults({
            id: layerId,
            name: nextName,
            type: "image",
            url: resolvedSourceRef,
            show: visible ?? true,
            opacity: opacity ?? 1,
            pid,
            ...(layerInfo as any)?.options
          }))
        }
      } catch {
        created = null
      }
      if (created) {
        map.addLayer(created)
        break
      }
      if (resolvedSourceRef && /\{x\}|\{y\}|\{z\}/.test(resolvedSourceRef)) {
        const layer = new mars3d.layer.XyzLayer(withRasterDefaults({
          id: layerId,
          name: nextName,
          url: resolvedSourceRef,
          show: visible ?? true,
          opacity: opacity ?? 1,
          pid
        }))
        map.addLayer(layer)
      }
      break
    }

    case "geotiff":
    case "geotif":
    case "cog": {
      let created: any = null
      try {
        const LayerUtil = (mars3d as any)?.LayerUtil
        if (LayerUtil && typeof LayerUtil.create === "function") {
          created = LayerUtil.create(withRasterDefaults({
            id: layerId,
            name: nextName,
            type: "geotiff",
            url: resolvedSourceRef,
            show: visible ?? true,
            opacity: opacity ?? 1,
            pid,
            ...(layerInfo as any)?.options
          }))
        }
      } catch {
        created = null
      }
      if (created) {
        map.addLayer(created)
        break
      }
      const anyMars: any = mars3d as any
      const GeoTiffLayer = anyMars?.layer?.GeoTiffLayer || anyMars?.layer?.GeoTifLayer
      if (typeof GeoTiffLayer === "function") {
        try {
          const layer = new GeoTiffLayer(withRasterDefaults({
            id: layerId,
            name: nextName,
            url: resolvedSourceRef,
            show: visible ?? true,
            opacity: opacity ?? 1,
            pid
          }))
          map.addLayer(layer)
          break
        } catch {
        }
      }
      if (resolvedSourceRef && /\{x\}|\{y\}|\{z\}/.test(resolvedSourceRef)) {
        const layer = new mars3d.layer.XyzLayer(withRasterDefaults({
          id: layerId,
          name: nextName,
          url: resolvedSourceRef,
          show: visible ?? true,
          opacity: opacity ?? 1,
          pid
        }))
        map.addLayer(layer)
      }
      break
    }

    default:
      // 未知类型，尝试使用通用图层
      if (resolvedSourceRef) {
        const layer = new mars3d.layer.XyzLayer(withRasterDefaults({
          id: layerId,
          name: nextName,
          url: resolvedSourceRef,
          show: visible ?? true,
          opacity: opacity ?? 1,
          pid
        }))
        map.addLayer(layer)
      }
      break
  }
}

function shouldInferSourceType(type: string): boolean {
  const t = String(type || "").trim().toLowerCase()
  if (!t || t === "unknown") {
    return true
  }
  if (t === "xyz" || t === "tile" || t === "tms") {
    return true
  }
  return false
}

function inferSourceTypeFromUrl(url: string, layerOptions?: any): string {
  const u = String(url || "").trim()
  if (!u) {
    return ""
  }
  const lower = u.toLowerCase()

  const hasTilePlaceholder = /\{x\}|\{y\}|\{z\}|\{s\}|\{a-c\}/i.test(u)
  if (hasTilePlaceholder) {
    return "xyz"
  }

  const isWmts = /service=wmts|request=gettile/i.test(lower) || /\/wmts(\b|\/|\?)/i.test(lower)
  if (isWmts) {
    return "wmts"
  }

  const isWms = /service=wms|request=getmap/i.test(lower) || /\/wms(\b|\/|\?)/i.test(lower)
  if (isWms) {
    return "wms"
  }

  if (/\.geojson(\?.*)?$/.test(lower)) {
    return "geojson"
  }

  const isTiff = /\.tiff?(\?.*)?$/.test(lower)
  if (isTiff) {
    return "geotiff"
  }

  const hasBounds =
    !!layerOptions &&
    typeof layerOptions === "object" &&
    (layerOptions.rectangle ||
      layerOptions.rect ||
      layerOptions.bbox ||
      layerOptions.bounds ||
      layerOptions.extent ||
      layerOptions.imageBounds)
  const isImage = /\.(png|jpg|jpeg|webp)(\?.*)?$/.test(lower)
  if (isImage && hasBounds) {
    return "image"
  }

  return ""
}

function applyTemporalToUrl(
  url: string,
  temporal: any,
  timeAt: number,
  timeExtent?: { start?: string; end?: string }
): string {
  const raw = String(url || "")
  if (!raw) {
    return raw
  }

  const mode = String(temporal?.mode || "")
  const isDynamicByMode = mode === "dynamic"
  const hasPlaceholder = raw.includes("{datetime}") || raw.includes("{time}") || raw.includes("{timestamp}")
  const hasQueryKey = (() => {
    try {
      const u = new URL(raw, window.location.origin)
      return u.searchParams.has("datetime") || u.searchParams.has("time") || u.searchParams.has("timestamp")
    } catch {
      return false
    }
  })()

  if (!isDynamicByMode && !hasPlaceholder && !hasQueryKey) {
    return raw
  }

  const paramKind = String(temporal?.datetimeParam?.kind || "")
  const paramKey = String(temporal?.datetimeParam?.key || "")

  const ts = Number.isFinite(timeAt) ? timeAt : Date.now()
  const iso = new Date(ts).toISOString()
  const start = typeof timeExtent?.start === "string" ? timeExtent!.start!.trim() : ""
  const end = typeof timeExtent?.end === "string" ? timeExtent!.end!.trim() : ""
  const range = start && end ? `${start}/${end}` : start || end
  const value =
    paramKey === "timestamp"
      ? String(ts)
      : (range || iso)

  if (paramKind === "path" && paramKey) {
    return raw
      .replaceAll(`{${paramKey}}`, encodeURIComponent(value))
      .replaceAll("{datetime}", encodeURIComponent(range || iso))
      .replaceAll("{time}", encodeURIComponent(range || iso))
      .replaceAll("{timestamp}", encodeURIComponent(String(ts)))
  }

  try {
    const u = new URL(raw, window.location.origin)
    let preferredKey = paramKey
    if (!preferredKey) {
      if (u.searchParams.has("time")) {
        preferredKey = "time"
      } else if (u.searchParams.has("timestamp")) {
        preferredKey = "timestamp"
      } else {
        preferredKey = "datetime"
      }
    }
    u.searchParams.delete("datetime")
    u.searchParams.delete("time")
    u.searchParams.delete("timestamp")
    u.searchParams.set(preferredKey, value)
    return u.toString()
  } catch {
    return raw
  }
}

/**
 * 恢复绘制要素状态
 */
async function restoreDrawFeaturesState(
  map: mars3d.Map,
  features: Manifest["drawFeatures"],
  drawIdPrefix: string
): Promise<void> {
  if (!features || features.length === 0) { return }

  let graphicLayer: any = null
  try {
    const existed = map.getLayerById?.("restored_features")
    if (existed && (existed.type === "graphic" || existed.constructor?.name === "GraphicLayer")) {
      graphicLayer = existed
    }
  } catch {
  }
  if (!graphicLayer) {
    try {
      graphicLayer = new (mars3d as any).layer.GraphicLayer({
        id: "restored_features",
        name: "标记",
        show: true
      })
      map.addLayer(graphicLayer)
    } catch {
      graphicLayer = map.graphicLayer
    }
  }
  if (!graphicLayer) {
    return
  }

  const rawList: any[] = []
  for (const feature of features as any[]) {
    const raw = feature?.raw
    if (raw && typeof raw === "object") {
      const cloned = cloneJson(raw)
      const baseId = String(cloned?.id || feature?.id || "")
      if (baseId) {
        cloned.id = `${drawIdPrefix || ""}${baseId}`
      }
      rawList.push(cloned)
    }
  }
  if (rawList.length > 0 && typeof graphicLayer.loadJSON === "function") {
    try {
      await graphicLayer.loadJSON(rawList, { clear: false, flyTo: false })
      return
    } catch {
    }
  }

  for (const feature of features) {
    const graphic = createGraphicFromFeature(feature, drawIdPrefix)
    if (graphic) {
      graphicLayer.addGraphic(graphic)
    }
  }
}

function cloneJson(v: any): any {
  const utilClone = (mars3d as any)?.Util?.clone
  if (typeof utilClone === "function") {
    try {
      return utilClone(v)
    } catch {
    }
  }
  try {
    return JSON.parse(JSON.stringify(v))
  } catch {
    return v
  }
}

/**
 * 根据要素信息创建图形
 */
function createGraphicFromFeature(
  feature: Manifest["drawFeatures"] extends Array<infer T> ? T : never,
  drawIdPrefix: string
): mars3d.graphic.BaseGraphic | null {
  if (!feature) { return null }

  const { type, coordinates, style, id } = feature
  const nextId = `${drawIdPrefix || ""}${String(id || "")}`

  // 根据类型创建对应的图形（使用 Entity 类型）
  switch (type) {
    case "point": {
      const position = [coordinates[0], coordinates[1]]

      return new mars3d.graphic.PointEntity({
        id: nextId,
        position,
        style: {
          pixelSize: style?.pixelSize || 10,
          color: style?.color || "#ff0000",
          opacity: style?.opacity || 1
        }
      })
    }

    case "polyline":
    case "line": {
      const positions = coordinates.map((coord: number[]) => [coord[0], coord[1]])

      return new mars3d.graphic.PolylineEntity({
        id: nextId,
        positions,
        style: {
          width: style?.lineWidth || 2,
          color: style?.color || "#00ff00",
          opacity: style?.opacity || 1
        }
      })
    }

    case "polygon": {
      // polygon coordinates 是三维数组，取第一环
      const ring = coordinates[0] || coordinates
      const positions = ring.map((coord: number[]) => [coord[0], coord[1]])

      return new mars3d.graphic.PolygonEntity({
        id: nextId,
        positions,
        style: {
          color: style?.color || "#0000ff",
          opacity: style?.opacity || 0.5,
          fill: true,
          fillColor: style?.fillColor || "#0000ff"
        }
      })
    }

    default:
      return null
  }
}

/**
 * 清除恢复的内容
 * @param map Mars3D 地图实例
 * @param manifest 要清除的成果包（可选，用于精确清除）
 */
export function clearRestoredContent(
  map: mars3d.Map,
  manifest?: Manifest
): void {
  // 清除恢复的绘制要素图层
  const featuresLayer = map.getLayerById("restored_features")
  if (featuresLayer) {
    map.removeLayer(featuresLayer, true)
  }

  // 如果提供了 manifest，清除指定的图层
  if (manifest?.layers) {
    for (const layerInfo of manifest.layers) {
      const layer = map.getLayerById(layerInfo.id)
      if (layer) {
        map.removeLayer(layer, true)
      }
    }
  }

  // 清除所有 eoAPI 相关图层（可选）
  const eoapiLayers = map.getLayers({ basemaps: false }).filter(
    (layer: any) => layer.id && (layer.id.startsWith("eoapi_") || layer.id.startsWith("restored_"))
  )
  eoapiLayers.forEach((layer: any) => {
    map.removeLayer(layer, true)
  })
}

export default {
  restoreWorkspace,
  clearRestoredContent
}
