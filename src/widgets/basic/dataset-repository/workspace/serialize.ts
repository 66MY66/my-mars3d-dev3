/**
 * 工作区序列化模块
 * @description 将 Mars3D 工作区状态序列化为 Manifest 成果包
 */

import * as mars3d from "mars3d"
import { LayerType, Manifest } from "../types/eoapi-types"

const Cesium = mars3d.Cesium

/**
 * 序列化选项
 */
export interface SerializeOptions {
  /** 是否包含视角状态 */
  includeViewState?: boolean
  /** 是否包含图层状态 */
  includeLayers?: boolean
  /** 是否包含绘制要素 */
  includeDrawFeatures?: boolean
  /** 是否生成封面截图 */
  generateThumbnail?: boolean
  /** 过滤图层 ID 列表（只序列化指定图层） */
  layerFilter?: string[]
  /** 绘制要素范围过滤（bbox 或 polygon） */
  drawFeatureFilter?: {
    bbox?: [number, number, number, number]
    polygon?: Array<[number, number]>
  }
}

/**
 * 序列化 Mars3D 工作区为 Manifest
 * @param map Mars3D 地图实例
 * @param options 序列化选项
 */
export function serializeWorkspace(
  map: mars3d.Map,
  options: SerializeOptions = {}
): Manifest {
  const {
    includeViewState = true,
    includeLayers = true,
    includeDrawFeatures = true,
    layerFilter,
    drawFeatureFilter
  } = options

  const manifest: Manifest = {
    manifestVersion: "1.0",
    createdAt: Date.now()
  }

  // 序列化视角状态
  if (includeViewState) {
    manifest.viewState = serializeViewState(map)
  }

  // 序列化图层状态
  if (includeLayers) {
    manifest.layers = serializeLayers(map, layerFilter, manifest.createdAt || Date.now())
  }

  // 序列化绘制要素
  if (includeDrawFeatures) {
    manifest.drawFeatures = serializeDrawFeatures(map, drawFeatureFilter)
  }

  const coverageBbox = resolveManifestCoverageBBox(manifest)
  if (coverageBbox) {
    manifest.viewState = {
      ...(manifest.viewState || {}),
      bbox: coverageBbox
    }
  }

  return manifest
}

/**
 * 序列化视角状态
 */
function serializeViewState(map: mars3d.Map): Manifest["viewState"] {
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
    : undefined

  return {
    center: {
      longitude: Cesium.Math.toDegrees(center.longitude),
      latitude: Cesium.Math.toDegrees(center.latitude)
    },
    zoom: getZoomFromHeight(center.height),
    heading: Cesium.Math.toDegrees(camera.heading),
    pitch: Cesium.Math.toDegrees(camera.pitch),
    bbox,
    timestamp: Date.now()
  }
}

function normalizeBBoxCandidate(input: any): [number, number, number, number] | null {
  if (!input) {
    return null
  }

  let values: number[] | null = null

  if (Array.isArray(input)) {
    if (input.length >= 4 && input.every((v) => Number.isFinite(Number(v)))) {
      values = [Number(input[0]), Number(input[1]), Number(input[2]), Number(input[3])]
    } else if (input.length > 0 && Array.isArray(input[0])) {
      return normalizeBBoxCandidate(input[0])
    }
  } else if (typeof input === "object") {
    const obj = input as Record<string, any>
    if (["west", "south", "east", "north"].every((key) => obj[key] !== undefined)) {
      values = [Number(obj.west), Number(obj.south), Number(obj.east), Number(obj.north)]
      const looksLikeRadians =
        Math.abs(values[0]) <= Math.PI * 2 &&
        Math.abs(values[2]) <= Math.PI * 2 &&
        Math.abs(values[1]) <= Math.PI &&
        Math.abs(values[3]) <= Math.PI
      if (looksLikeRadians) {
        values = values.map((value, index) => {
          const isLat = index === 1 || index === 3
          const limit = isLat ? 90 : 180
          const degrees = Cesium.Math.toDegrees(value)
          return Math.abs(degrees) <= limit ? degrees : value
        })
      }
    } else if (["xmin", "ymin", "xmax", "ymax"].every((key) => obj[key] !== undefined)) {
      values = [Number(obj.xmin), Number(obj.ymin), Number(obj.xmax), Number(obj.ymax)]
    } else if (["minx", "miny", "maxx", "maxy"].every((key) => obj[key] !== undefined)) {
      values = [Number(obj.minx), Number(obj.miny), Number(obj.maxx), Number(obj.maxy)]
    } else if (obj.spatial?.bbox) {
      return normalizeBBoxCandidate(obj.spatial.bbox)
    }
  }

  if (!values || values.some((value) => !Number.isFinite(value))) {
    return null
  }

  const [west, south, east, north] = values
  if (west < east && south < north && west >= -180 && east <= 180 && south >= -90 && north <= 90) {
    return [west, south, east, north]
  }
  return null
}

function mergeBboxes(
  ...candidates: Array<[number, number, number, number] | null | undefined>
): [number, number, number, number] | null {
  const valid = candidates.filter((bbox): bbox is [number, number, number, number] => Array.isArray(bbox))
  if (!valid.length) {
    return null
  }

  let west = valid[0][0]
  let south = valid[0][1]
  let east = valid[0][2]
  let north = valid[0][3]

  for (let i = 1; i < valid.length; i++) {
    const bbox = valid[i]
    west = Math.min(west, bbox[0])
    south = Math.min(south, bbox[1])
    east = Math.max(east, bbox[2])
    north = Math.max(north, bbox[3])
  }

  return [west, south, east, north]
}

function extractLayerBBox(layer: NonNullable<Manifest["layers"]>[number]): [number, number, number, number] | null {
  const sources = [
    layer?.options?.bbox,
    layer?.options?.bounds,
    layer?.options?.extent,
    layer?.options?.rectangle,
    layer?.options?.rect,
    layer?.options?.imageBounds,
    layer?.data?.bbox,
    layer?.data?.bounds,
    layer?.data?.extent,
    layer?.data?.rectangle,
    layer?.data?.imageBounds
  ]

  for (const source of sources) {
    const bbox = normalizeBBoxCandidate(source)
    if (bbox) {
      return bbox
    }
  }

  return null
}

function collectLngLatPoints(input: any, out: Array<[number, number]>) {
  if (Array.isArray(input)) {
    if (input.length >= 2 && Number.isFinite(Number(input[0])) && Number.isFinite(Number(input[1]))) {
      out.push([Number(input[0]), Number(input[1])])
      return
    }
    for (const item of input) {
      collectLngLatPoints(item, out)
    }
  }
}

function extractDrawFeatureBBox(feature: NonNullable<Manifest["drawFeatures"]>[number]): [number, number, number, number] | null {
  const points: Array<[number, number]> = []
  collectLngLatPoints(feature?.coordinates, points)
  return getLngLatBbox(points)
}

export function resolveManifestCoverageBBox(manifest: Manifest): [number, number, number, number] | undefined {
  const candidates: Array<[number, number, number, number] | null> = [
    normalizeBBoxCandidate(manifest.viewState?.bbox)
  ]

  for (const layer of manifest.layers || []) {
    candidates.push(extractLayerBBox(layer))
  }

  for (const feature of manifest.drawFeatures || []) {
    candidates.push(extractDrawFeatureBBox(feature))
  }

  return mergeBboxes(...candidates) || undefined
}

/**
 * 从高度计算缩放级别
 */
function getZoomFromHeight(height: number): number {
  const A = 40487.57
  const B = 0.703125

  if (height < 1000) {
    return Math.round(12.37 * Math.log(height / 1000) + 20)
  } else {
    return Math.round(A / (height * B))
  }
}

/**
 * 序列化图层状态
 */
function serializeLayers(
  map: mars3d.Map,
  layerFilter?: string[],
  savedAt?: number
): Manifest["layers"] {
  const layers: Manifest["layers"] = []

  const isBasemapLayer = (layer: any): boolean => {
    if (!layer) {
      return true
    }
    const opt = layer?.options || {}
    return !!(
      opt.basemap ||
      opt.isBasemap ||
      opt.isBaseMap ||
      layer.basemap ||
      layer.isBasemap ||
      layer.isBaseMap
    )
  }

  // 获取所有业务图层（排除底图）
  // 说明：不同 Mars3D 版本对 getLayers({ basemaps:false }) 的支持不完全一致，
  // 这里用 getLayers() + 自己过滤来保证“回放图层”不丢失。
  const allLayers = (typeof (map as any).getLayers === "function" ? (map as any).getLayers() : []) || []
  const mapLayers = allLayers.filter((layer: any) => !isBasemapLayer(layer))
  const allow = layerFilter ? new Set(layerFilter.map(String)) : null

  const layerById = new Map<string, any>()
  const pidById = new Map<string, string | number | null>()
  const orderById = new Map<string, number>()
  mapLayers.forEach((layer: any, index: number) => {
    const isGraphicLayer = layer?.type === "graphic" || layer?.constructor?.name === "GraphicLayer"
    if (isGraphicLayer) {
      return
    }
    const id = String(layer?.id ?? `layer_${index}`)
    layerById.set(id, layer)
    orderById.set(id, index)
    const pidRaw = (layer as any)?.pid ?? layer?.options?.pid
    const pid = pidRaw === null || pidRaw === undefined || pidRaw === "" ? null : (pidRaw as any)
    pidById.set(id, pid)
  })

  if (allow) {
    const queue = Array.from(allow)
    for (const id of queue) {
      let curPid = pidById.get(id)
      for (let i = 0; i < 20 && curPid !== null && curPid !== undefined && String(curPid) !== ""; i++) {
        const pidId = String(curPid)
        if (!layerById.has(pidId)) {
          break
        }
        if (!allow.has(pidId)) {
          allow.add(pidId)
          queue.push(pidId)
        }
        curPid = pidById.get(pidId)
      }
    }
  }

  const childrenByPid = new Map<string, string[]>()
  for (const [id, pid] of pidById.entries()) {
    const key = pid === null ? "" : String(pid)
    const arr = childrenByPid.get(key) || []
    arr.push(id)
    childrenByPid.set(key, arr)
  }
  for (const [k, arr] of childrenByPid.entries()) {
    arr.sort((a, b) => (orderById.get(a) ?? 0) - (orderById.get(b) ?? 0))
    childrenByPid.set(k, arr)
  }

  const roots: string[] = []
  for (const [id, pid] of pidById.entries()) {
    if (pid === null) {
      roots.push(id)
      continue
    }
    const pidKey = String(pid)
    if (!layerById.has(pidKey)) {
      roots.push(id)
    }
  }
  roots.sort((a, b) => (orderById.get(a) ?? 0) - (orderById.get(b) ?? 0))

  const visited = new Set<string>()
  const emit = (id: string) => {
    if (visited.has(id)) {
      return
    }
    visited.add(id)

    if (!allow || allow.has(id)) {
      const layer = layerById.get(id)
      const pid = pidById.get(id)
      const index = orderById.get(id) ?? 0
      const src = serializeLayerSource(layer, typeof savedAt === "number" ? savedAt : Date.now())
      const layerOptions = safeLayerToJSON(layer)
      const zIndex = Number.isFinite(Number(layer?.options?.zIndex)) ? Number(layer.options.zIndex) : undefined
      const timeExtent = resolveTimeExtentFromOptions(layer?.options || layerOptions)
      const layerInfo = {
        id,
        name: layer?.name,
        sourceType: getLayerSourceType(layer),
        sourceRef: src.sourceRef,
        pid: pid === null ? undefined : (pid as any),
        data: src.data,
        options: layerOptions,
        temporal: src.temporal,
        timeExtent,
        visible: layer?.show,
        opacity: layer?.opacity ?? 1,
        order: index,
        zIndex
      }
      layers.push(layerInfo)
    }

    const children = childrenByPid.get(id) || []
    children.forEach((cid) => emit(cid))
  }

  roots.forEach((id) => emit(id))

  return layers
}

function safeLayerToJSON(layer: any): any {
  if (!layer) {
    return undefined
  }
  if (typeof layer.toJSON === "function") {
    try {
      return layer.toJSON({ full: true, stopEdit: true })
    } catch {
    }
  }
  const utilClone = (mars3d as any)?.Util?.clone
  if (typeof utilClone === "function") {
    try {
      return utilClone(layer?.options || {})
    } catch {
    }
  }
  try {
    return JSON.parse(JSON.stringify(layer?.options || {}))
  } catch {
    return undefined
  }
}

/**
 * 获取图层来源类型
 */
function getLayerSourceType(layer: any): LayerType {
  const layerType = layer.type

  if (layerType === "group" || layer?.options?.type === "group" || layer?.constructor?.name === "GroupLayer") {
    return "group"
  }

  // Mars3D 图层类型映射
  const typeMap: Record<string, LayerType> = {
    xyz: "xyz",
    wms: "wms",
    wmts: "wmts",
    tms: "tms",
    tile: "tile",
    arcgis: "arcgis",
    "3dtiles": "3dtiles",
    geojson: "geojson",
    wfs: "wfs",
    vector: "vector",
    img: "image"
  }

  const mapped = typeMap[layerType]
  if (mapped) {
    return mapped
  }
  return (layerType || "unknown") as LayerType
}

/**
 * 获取图层来源引用（URL 或数据引用）
 */
function serializeLayerSource(
  layer: any,
  savedAt: number
): {
  sourceRef: string
  data?: any
  temporal?: Manifest["layers"] extends Array<infer T> ? (T extends { temporal?: infer R } ? R : never) : never
} {
  const data = layer?.options?.data
  const pickUrl = (v: any): string => (typeof v === "string" ? v : "")
  const options = layer?.options || {}
  let url =
    pickUrl(options.url) ||
    pickUrl(options.sourceRef) ||
    pickUrl(options.urlTemplate) ||
    pickUrl(options.template) ||
    pickUrl(options.tiles) ||
    ""

  if (!url && typeof layer?.toJSON === "function") {
    try {
      const json = layer.toJSON({ full: true, stopEdit: true })
      url = pickUrl(json?.url) || pickUrl(json?.sourceRef) || pickUrl(json?.urlTemplate) || ""
    } catch {
    }
  }

  if (data && typeof data === "object") {
    return {
      sourceRef: "",
      data,
      temporal: { mode: "static", savedAt }
    }
  }

  const temporal = detectTemporalFromUrl(url, savedAt, layer?.options)
  return { sourceRef: url || "", temporal }
}

function resolveTimeExtentFromOptions(options: any): { start?: string; end?: string } | undefined {
  if (!options || typeof options !== "object") {
    return undefined
  }
  const raw = (options as any).timeExtent
  if (raw && typeof raw === "object") {
    const start = typeof raw.start === "string" ? raw.start.trim() : ""
    const end = typeof raw.end === "string" ? raw.end.trim() : ""
    if (start || end) {
      return { start: start || undefined, end: end || undefined }
    }
  }
  const start2 = typeof (options as any).startTime === "string" ? String((options as any).startTime).trim() : ""
  const end2 = typeof (options as any).endTime === "string" ? String((options as any).endTime).trim() : ""
  if (start2 || end2) {
    return { start: start2 || undefined, end: end2 || undefined }
  }
  return undefined
}

function detectTemporalFromUrl(
  url: string,
  savedAt: number,
  options?: any
): Manifest["layers"] extends Array<infer T> ? (T extends { temporal?: infer R } ? R : never) : never {
  const raw = String(url || "")
  const hint = !!options?.timeDynamic || !!options?.isDynamic || options?.dynamic === true

  let placeholderKey = ""
  if (raw.includes("{datetime}")) {
    placeholderKey = "datetime"
  } else if (raw.includes("{time}")) {
    placeholderKey = "time"
  } else if (raw.includes("{timestamp}")) {
    placeholderKey = "timestamp"
  }

  if (placeholderKey) {
    return {
      mode: "dynamic",
      savedAt,
      datetimeParam: { kind: "path", key: placeholderKey }
    } as any
  }

  try {
    const u = new URL(raw, window.location.origin)
    let key = ""
    if (u.searchParams.has("datetime")) {
      key = "datetime"
    } else if (u.searchParams.has("time")) {
      key = "time"
    } else if (u.searchParams.has("timestamp")) {
      key = "timestamp"
    }
    if (key) {
      return {
        mode: "dynamic",
        savedAt,
        datetimeParam: { kind: "query", key }
      } as any
    }
  } catch {
  }

  if (hint && raw) {
    return { mode: "dynamic", savedAt, datetimeParam: { kind: "query", key: "datetime" } } as any
  }

  return undefined as any
}

function serializeDrawFeatures(
  map: mars3d.Map,
  drawFeatureFilter?: {
    bbox?: [number, number, number, number]
    polygon?: Array<[number, number]>
  }
): Manifest["drawFeatures"] {
  const features: Manifest["drawFeatures"] = []
  const now = Date.now()

  const graphicLayers = collectGraphicLayers(map)
  for (const layer of graphicLayers) {
    const graphics = getGraphicsFromGraphicLayer(layer)
    if (!graphics.length) {
      continue
    }
    const layerId = layer?.id !== null && layer?.id !== undefined ? String(layer.id) : ""
    const layerName = typeof layer?.name === "string" ? layer.name : undefined

    for (const graphic of graphics) {
      if (drawFeatureFilter && !shouldIncludeGraphic(graphic, drawFeatureFilter)) {
        continue
      }

      let raw: any
      if (typeof graphic?.toJSON === "function") {
        try {
          raw = graphic.toJSON()
        } catch {
        }
      }

      const fallback = raw ? null : serializeGraphic(graphic)
      const id = String(
        raw?.id ||
          fallback?.id ||
          graphic?.id ||
          `feature_${Date.now()}_${Math.random().toString(36).slice(2)}`
      )
      const type = String(raw?.type || fallback?.type || graphic?.type || "unknown")
      const coordinates = raw?.positions ?? raw?.position ?? raw?.coordinates ?? fallback?.coordinates ?? null
      const style = raw?.style ?? fallback?.style ?? graphic?.style ?? undefined

      const createdAtCandidate =
        raw?.attr?.createdAt ??
        raw?.attr?.time ??
        raw?.createdAt ??
        raw?.time ??
        graphic?.attr?.createdAt ??
        graphic?.attr?.time
      const createdAt = Number.isFinite(Number(createdAtCandidate)) ? Number(createdAtCandidate) : now

      features.push({
        id,
        type,
        coordinates,
        style,
        raw,
        createdAt,
        layerId: layerId || undefined,
        layerName
      } as any)
    }
  }

  return features
}

function collectGraphicLayers(map: mars3d.Map): any[] {
  const out: any[] = []
  const seen = new Set<any>()
  const push = (layer: any) => {
    if (!layer || seen.has(layer)) {
      return
    }
    seen.add(layer)
    out.push(layer)
  }

  push((map as any).graphicLayer)
  const layers = (typeof (map as any).getLayers === "function" ? (map as any).getLayers() : []) || []
  for (const layer of layers) {
    if (!layer) {
      continue
    }
    if (layer.type === "graphic" || layer.constructor?.name === "GraphicLayer") {
      push(layer)
    }
  }
  return out
}

function getGraphicsFromGraphicLayer(graphicLayer: any): any[] {
  if (!graphicLayer) {
    return []
  }
  let graphics: any[] = []
  if (typeof graphicLayer.getGraphics === "function") {
    try {
      graphics = graphicLayer.getGraphics() || []
    } catch {
      graphics = []
    }
  }
  if (graphics.length === 0 && Array.isArray(graphicLayer._graphics_arr)) {
    graphics = graphicLayer._graphics_arr
  }
  if (graphics.length === 0 && typeof graphicLayer.eachGraphic === "function") {
    graphicLayer.eachGraphic((g: any) => graphics.push(g))
  }
  if (graphics.length === 0 && Array.isArray(graphicLayer.graphics)) {
    graphics = graphicLayer.graphics
  }
  return Array.isArray(graphics) ? graphics : []
}

function shouldIncludeGraphic(
  graphic: any,
  filter?: { bbox?: [number, number, number, number]; polygon?: Array<[number, number]> }
): boolean {
  if (!filter) {
    return true
  }

  const coords = getGraphicLngLatPositions(graphic)
  if (!coords || coords.length === 0) {
    return true
  }

  const bbox = getLngLatBbox(coords)
  if (!bbox) {
    return true
  }

  if (filter.bbox) {
    const intersects = bboxIntersects(bbox, filter.bbox)
    return intersects
  }

  if (filter.polygon && filter.polygon.length >= 3) {
    const polyBbox = getLngLatBbox(filter.polygon)
    if (polyBbox && !bboxIntersects(bbox, polyBbox)) {
      return false
    }

    if (coords.length === 1) {
      return pointInPolygon(coords[0], filter.polygon)
    }

    for (const p of coords) {
      if (pointInPolygon(p, filter.polygon)) {
        return true
      }
    }

    return polyBbox ? bboxIntersects(bbox, polyBbox) : true
  }

  return true
}

function getGraphicLngLatPositions(graphic: any): Array<[number, number]> | null {
  if (!graphic) {
    return null
  }

  // 方式0: 优先使用 toJSON 方法（Mars3D 推荐的导出方式）
  // toJSON 返回的数据结构包含 positions 字段，是经纬度坐标数组
  if (typeof graphic.toJSON === "function") {
    try {
      const jsonData = graphic.toJSON()
      // toJSON 返回的对象中 positions 是经纬度坐标数组，如 [[lng, lat, alt], ...]
      if (jsonData?.positions && Array.isArray(jsonData.positions)) {
        const list: Array<[number, number]> = []
        for (const p of jsonData.positions) {
          // p 可能是 [lng, lat, alt] 或 LngLatPoint 对象
          if (Array.isArray(p) && p.length >= 2) {
            list.push([p[0], p[1]])
          } else if (typeof p.lng === "number" && typeof p.lat === "number") {
            list.push([p.lng, p.lat])
          }
        }
        console.log("[getGraphicLngLatPositions] from toJSON, positions:", jsonData.positions, "converted:", list)
        if (list.length > 0) {
          return list
        }
      }
    } catch (e) {
    }
  }

  // Mars3D polyline/polygon 的 positions 可能是特殊的内部类型（如 LngLatArray）
  // 尝试多种方式获取 positions
  let positions: any = null

  // 方式1: positions 是数组，直接使用
  if (Array.isArray(graphic.positions)) {
    positions = graphic.positions
  } else if (graphic.positions?.toArray) {
    // 方式2: positions 有 toArray 方法（Cesium.CallbackProperty）
    positions = graphic.positions.toArray()
  } else if (graphic.positions?._value) {
    // 方式3: positions 是 CallbackProperty，取 _value
    positions = graphic.positions._value
  } else if (graphic._positionsArr) {
    // 方式4: Mars3D 内部 _positionsArr 属性
    positions = graphic._positionsArr
  } else if (graphic.position) {
    // 方式5: position 属性（单点）
    positions = graphic.position
  } else if (graphic._positions) {
    // 方式6: 尝试 _positions 属性（内部属性）
    positions = graphic._positions
  }

  if (!positions) {
    return null
  }

  // 特殊处理：Mars3D 的 LngLatArray 等类型可能有特殊的 toArray 方法或 length 属性
  // 检查是否有 length 属性且可以像数组一样访问
  if (typeof positions.length === "number" && positions.length > 0) {
    const list: Array<[number, number]> = []
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      const ll = toLngLat(p)
      if (ll) {
        list.push(ll)
      }
    }
    return list.length ? list : null
  }

  // 处理嵌套数组（polygon 可能是 [[点1, 点2, ...]]）
  if (Array.isArray(positions)) {
    // 检查是否是嵌套数组
    if (positions.length > 0 && Array.isArray(positions[0])) {
      // 扁平化嵌套数组
      const flatPositions = positions.flat(Infinity)
      const list: Array<[number, number]> = []
      for (const p of flatPositions) {
        const ll = toLngLat(p)
        if (ll) {
          list.push(ll)
        }
      }
      return list.length ? list : null
    }

    // 普通数组
    const list: Array<[number, number]> = []
    for (const p of positions) {
      const ll = toLngLat(p)
      if (ll) {
        list.push(ll)
      }
    }
    return list.length ? list : null
  }

  // 单个位置
  const ll = toLngLat(positions)
  return ll ? [ll] : null
}

function toLngLat(pos: any): [number, number] | null {
  if (!pos) {
    return null
  }

  // 方式1: 直接有 lng/lat 属性
  if (typeof pos.lng === "number" && typeof pos.lat === "number") {
    return [pos.lng, pos.lat]
  }

  // 方式2: 有 longitude/latitude 属性（弧度或度）
  if (typeof pos.longitude === "number" && typeof pos.latitude === "number") {
    const lng = Math.abs(pos.longitude) <= Math.PI * 2 ? Cesium.Math.toDegrees(pos.longitude) : pos.longitude
    const lat = Math.abs(pos.latitude) <= Math.PI * 2 ? Cesium.Math.toDegrees(pos.latitude) : pos.latitude
    return [lng, lat]
  }

  // 方式3: Cesium.Cartesian3 对象
  if (pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
    try {
      const cartographic = Cesium.Cartographic.fromCartesian(pos)
      if (cartographic) {
        const lng = Cesium.Math.toDegrees(cartographic.longitude)
        const lat = Cesium.Math.toDegrees(cartographic.latitude)
        return [lng, lat]
      }
    } catch {
      // 继续尝试其他方式
    }
  }

  // 方式4: 使用 mars3d 的 LngLatPoint
  try {
    const pt = (mars3d as any).LngLatPoint?.fromCartesian?.(pos)
    if (pt && typeof pt.lng === "number" && typeof pt.lat === "number") {
      return [pt.lng, pt.lat]
    }
  } catch {
  }

  // 方式5: 尝试通过 positionCartographic
  if (pos.positionCartographic) {
    const carto = pos.positionCartographic
    const lng = Cesium.Math.toDegrees(carto.longitude)
    const lat = Cesium.Math.toDegrees(carto.latitude)
    return [lng, lat]
  }
  return null
}

function getLngLatBbox(points: Array<[number, number]>): [number, number, number, number] | null {
  if (!Array.isArray(points) || points.length === 0) {
    return null
  }
  let west = Number.POSITIVE_INFINITY
  let south = Number.POSITIVE_INFINITY
  let east = Number.NEGATIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY

  for (const [lng, lat] of points) {
    if (typeof lng !== "number" || typeof lat !== "number") {
      continue
    }
    if (lng < west) { west = lng }
    if (lng > east) { east = lng }
    if (lat < south) { south = lat }
    if (lat > north) { north = lat }
  }

  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
    return null
  }
  return [west, south, east, north]
}

function bboxIntersects(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  const [aw, as, ae, an] = a
  const [bw, bs, be, bn] = b
  return !(ae < bw || be < aw || an < bs || bn < as)
}

function pointInPolygon(point: [number, number], polygon: Array<[number, number]>): boolean {
  const x = point[0]
  const y = point[1]
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi
    if (intersect) {
      inside = !inside
    }
  }
  return inside
}

/**
 * 序列化单个图形
 */
function serializeGraphic(graphic: any): Manifest["drawFeatures"] extends Array<infer T> ? T : never | null {
  if (!graphic) { return null }

  const positions = graphic.positions?.toArray?.() || graphic.positions || []

  // 获取坐标
  let coordinates: any = null
  const geometryType = graphic.type || "point"

  if (geometryType === "point" || positions.length === 1) {
    const pos = positions[0]
    coordinates = [
      Cesium.Math.toDegrees(pos.longitude || pos.lng || pos.x),
      Cesium.Math.toDegrees(pos.latitude || pos.lat || pos.y)
    ]
  } else if (geometryType === "polyline" || geometryType === "line") {
    coordinates = positions.map((pos: any) => [
      Cesium.Math.toDegrees(pos.longitude || pos.lng || pos.x),
      Cesium.Math.toDegrees(pos.latitude || pos.lat || pos.y)
    ])
  } else if (geometryType === "polygon") {
    coordinates = [
      positions.map((pos: any) => [
        Cesium.Math.toDegrees(pos.longitude || pos.lng || pos.x),
        Cesium.Math.toDegrees(pos.latitude || pos.lat || pos.y)
      ])
    ]
  }

  if (!coordinates) { return null }

  return {
    id: graphic.id || `feature_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type: geometryType,
    coordinates,
    style: {
      color: graphic.style?.color,
      opacity: graphic.style?.opacity,
      lineWidth: graphic.style?.width || graphic.style?.lineWidth,
      fillColor: graphic.style?.fill?.color || graphic.style?.fillColor,
      fillOpacity: graphic.style?.fill?.opacity || graphic.style?.fillOpacity,
      ...graphic.style
    }
  }
}

/**
 * 验证 Manifest 是否有效
 */
export function validateManifest(manifest: Manifest): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // 检查版本
  if (!manifest.manifestVersion) {
    errors.push("缺少 manifestVersion")
  }

  // 检查是否有有效内容
  const hasContent =
    (manifest.layers && manifest.layers.length > 0) ||
    (manifest.drawFeatures && manifest.drawFeatures.length > 0) ||
    manifest.viewState

  if (!hasContent) {
    errors.push("成果内容为空，至少需要图层、绘制要素或视角状态")
  }

  // 检查视角数据
  if (manifest.viewState?.center) {
    const { longitude, latitude } = manifest.viewState.center
    if (longitude < -180 || longitude > 180) {
      errors.push(`longitude 范围无效: ${longitude}`)
    }
    if (latitude < -90 || latitude > 90) {
      errors.push(`latitude 范围无效: ${latitude}`)
    }
  }

  // 检查 bbox
  if (manifest.viewState?.bbox) {
    const [west, south, east, north] = manifest.viewState.bbox
    if (west > east) {
      errors.push("bbox west > east，顺序错误")
    }
    if (south > north) {
      errors.push("bbox south > north，顺序错误")
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export default {
  serializeWorkspace,
  validateManifest
}
