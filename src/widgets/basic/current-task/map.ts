import * as mars3d from "mars3d"
import type { Manifest } from "../dataset-repository/types/eoapi-types"
import { restoreWorkspace } from "../dataset-repository/workspace"

export type DatasetSessionSource = "repository" | "my-repository" | "unknown"

export type DatasetSession = {
  datasetId: string
  groupId: string
  openedAt: number
  source: DatasetSessionSource
  groupName?: string
}

export const eventTarget = new mars3d.BaseClass()

let map: mars3d.Map | null = null
const SESSION_STORAGE_KEY = "mars_current_task_session_root_v1"
const FOCUS_HIGHLIGHT_LAYER_ID = "current_task_focus_highlight"
let focusHighlightGraphicLayer: any | null = null
let timeExtentHandler: ((evt: Event) => void) | null = null

export function onMounted(mapInstance: mars3d.Map) {
  map = mapInstance
  if (!timeExtentHandler) {
    timeExtentHandler = (evt: Event) => {
      const detail = (evt as CustomEvent).detail || {}
      applyTimeExtentToLayers(detail)
    }
    window.addEventListener("mars3d:timeExtentChange", timeExtentHandler as any)
  }
}

export function onUnmounted() {
  map = null
  focusHighlightGraphicLayer = null
  if (timeExtentHandler) {
    try {
      window.removeEventListener("mars3d:timeExtentChange", timeExtentHandler as any)
    } catch {
    }
    timeExtentHandler = null
  }
}

export function getMap(): mars3d.Map | null {
  return map
}

export function getLayrsTree(params: any) {
  return map?.getLayrsTree(params)
}

export function getLayerById(id: string | number): any | null {
  if (!map) {
    return null
  }
  const direct = map.getLayerById(id as any)
  if (direct) {
    return direct
  }
  if (typeof id === "string") {
    const n = Number(id)
    if (!Number.isNaN(n)) {
      return map.getLayerById(n as any)
    }
  } else if (typeof id === "number") {
    return map.getLayerById(String(id) as any)
  }
  return null
}

export function getAllLayers(): any[] {
  if (!map) {
    return []
  }
  try {
    return map.getLayers?.({ basemaps: false }) || map.getLayers?.() || []
  } catch {
    try {
      return map.getLayers?.() || []
    } catch {
      return []
    }
  }
}

export function listDatasetSessions(datasetId: string): DatasetSession[] {
  if (!datasetId) {
    return []
  }
  const layers = getAllLayers()
  const sessions: DatasetSession[] = []

  const eoPrefix = `eoapi_group_${datasetId}_`
  const myPrefix = `myrepo_group_${datasetId}_`

  for (const layer of layers) {
    const id = layer?.id
    if (typeof id !== "string") {
      continue
    }
    if (id.startsWith(eoPrefix)) {
      const openedAt = Number(id.slice(eoPrefix.length))
      if (Number.isFinite(openedAt) && openedAt > 0) {
        sessions.push({
          datasetId,
          groupId: id,
          openedAt,
          source: "repository",
          groupName: typeof layer?.name === "string" ? layer.name : undefined
        })
      }
      continue
    }
    if (id.startsWith(myPrefix)) {
      const openedAt = Number(id.slice(myPrefix.length))
      if (Number.isFinite(openedAt) && openedAt > 0) {
        sessions.push({
          datasetId,
          groupId: id,
          openedAt,
          source: "my-repository",
          groupName: typeof layer?.name === "string" ? layer.name : undefined
        })
      }
    }
  }

  sessions.sort((a, b) => b.openedAt - a.openedAt)
  return sessions.slice(0, 20)
}

export function isLayerUnderGroup(layer: any, groupId: string): boolean {
  if (!map || !layer || !groupId) {
    return false
  }
  const id = layer?.id
  if (String(id) === String(groupId)) {
    return true
  }
  let cur: any = layer
  for (let i = 0; i < 20 && cur; i++) {
    const pid = cur?.pid ?? cur?.options?.pid
    if (pid === null || pid === undefined || pid === "") {
      return false
    }
    if (String(pid) === String(groupId)) {
      return true
    }
    cur = getLayerById(pid)
  }
  return false
}

export function setLayerName(id: string | number, name: string): boolean {
  const layer = getLayerById(id)
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

export function removeLayerById(id: string | number): boolean {
  if (!map) {
    return false
  }
  const layer = getLayerById(id)
  if (!layer) {
    return false
  }
  try {
    map.removeLayer(layer, true)
    return true
  } catch {
    try {
      map.removeLayer(layer)
      return true
    } catch {
      return false
    }
  }
}

export function updateLayerShowOnly(layer: any, show: boolean) {
  if (!map || !layer) {
    return
  }
  try {
    if (show) {
      if (!layer.isAdded) {
        map.addLayer(layer)
      }
      layer.show = true
    } else {
      layer.show = false
    }
  } catch {
  }
  try {
    map.scene?.requestRender?.()
  } catch {
  }
}

export function flyToLayer(layerId: string | number) {
  const layer = getLayerById(layerId)
  if (!layer) {
    return
  }
  try {
    if (typeof layer.flyTo === "function") {
      layer.flyTo()
      return
    }
  } catch {
  }
  try {
    map?.flyTo?.(layer)
  } catch {
  }
}

export async function flashLayer(layerId: string | number, options?: { times?: number; intervalMs?: number }) {
  const layer: any = getLayerById(layerId)
  if (!layer) {
    return
  }
  const times = Math.max(1, Math.floor(options?.times ?? 3))
  const intervalMs = Math.max(120, Math.floor(options?.intervalMs ?? 500))
  const originalShow = !!layer.show

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), ms)
    })

  const setShow = (v: boolean) => {
    try {
      layer.show = v
    } catch {
    }
    try {
      map?.scene?.requestRender?.()
    } catch {
    }
  }

  for (let i = 0; i < times; i++) {
    const didHighlight = await flashHighlightForLayer(layer, { intervalMs })
    if (didHighlight) {
      await sleep(intervalMs)
      continue
    }
    setShow(false)
    await sleep(intervalMs)
    setShow(true)
    await sleep(intervalMs)
  }
  setShow(originalShow)
}

function getLayerBbox(layer: any): [number, number, number, number] | null {
  const pick4 = (v: any): [number, number, number, number] | null => {
    if (!v) {
      return null
    }
    if (Array.isArray(v) && v.length >= 4) {
      const w = Number(v[0])
      const s = Number(v[1])
      const e = Number(v[2])
      const n = Number(v[3])
      if ([w, s, e, n].every((x) => Number.isFinite(x))) {
        return [w, s, e, n]
      }
    }
    if (typeof v === "object") {
      const w = Number((v as any).west ?? (v as any).xmin)
      const s = Number((v as any).south ?? (v as any).ymin)
      const e = Number((v as any).east ?? (v as any).xmax)
      const n = Number((v as any).north ?? (v as any).ymax)
      if ([w, s, e, n].every((x) => Number.isFinite(x))) {
        return [w, s, e, n]
      }
    }
    return null
  }

  const candidates = [
    (layer as any)?.bbox,
    (layer as any)?.extent,
    (layer as any)?.rectangle,
    (layer as any)?.options?.bbox,
    (layer as any)?.options?.extent,
    (layer as any)?.options?.rectangle,
    (layer as any)?.options?.bounds,
    (layer as any)?.options?.imageBounds
  ]
  for (const c of candidates) {
    const hit = pick4(c)
    if (hit) {
      return hit
    }
  }
  try {
    const r = (layer as any)?.getRectangle?.()
    const hit = pick4(r)
    if (hit) {
      return hit
    }
  } catch {
  }
  return null
}

function ensureFocusHighlightLayer(): any | null {
  if (!map) {
    return null
  }
  if (focusHighlightGraphicLayer) {
    return focusHighlightGraphicLayer
  }
  const existed = getLayerById(FOCUS_HIGHLIGHT_LAYER_ID)
  if (existed && (existed.type === "graphic" || existed.constructor?.name === "GraphicLayer")) {
    focusHighlightGraphicLayer = existed
    return focusHighlightGraphicLayer
  }
  focusHighlightGraphicLayer = createGraphicLayer({ id: FOCUS_HIGHLIGHT_LAYER_ID, name: "定位高亮" })
  return focusHighlightGraphicLayer
}

async function flashHighlightForLayer(layer: any, input: { intervalMs: number }): Promise<boolean> {
  const bbox = getLayerBbox(layer)
  if (!bbox) {
    return false
  }
  const gLayer = ensureFocusHighlightLayer()
  if (!gLayer) {
    return false
  }
  try {
    gLayer.clear?.()
  } catch {
  }
  const ring = [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[1]],
    [bbox[2], bbox[3]],
    [bbox[0], bbox[3]],
    [bbox[0], bbox[1]]
  ]
  let graphic: any = null
  try {
    graphic = new (mars3d as any).graphic.PolygonEntity({
      positions: ring,
      style: {
        fill: true,
        color: "rgba(255,255,0,0.8)",
        outline: true,
        outlineWidth: 2,
        outlineColor: "rgba(255,255,0,1)"
      }
    })
    gLayer.addGraphic?.(graphic)
  } catch {
    return false
  }

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), ms)
    })

  const seq = [
    "rgba(255,255,0,0.8)",
    "rgba(255,255,0,0.45)",
    "rgba(255,255,0,0.2)",
    "rgba(255,255,0,0)"
  ]
  for (const c of seq) {
    try {
      graphic?.setStyle?.({ color: c })
    } catch {
    }
    try {
      map?.scene?.requestRender?.()
    } catch {
    }
    await sleep(Math.max(80, Math.floor(input.intervalMs / 4)))
  }
  return true
}

function applyTimeExtentToLayers(input: { start?: string; end?: string; current?: string }) {
  if (!map) {
    return
  }
  const start = typeof input?.start === "string" ? input.start.trim() : ""
  const end = typeof input?.end === "string" ? input.end.trim() : ""
  const current = typeof input?.current === "string" ? input.current.trim() : ""
  const range = start && end ? `${start}/${end}` : start || end
  const fallback = current || range || new Date().toISOString()

  const applyToUrl = (rawUrl: string): string => {
    const raw = String(rawUrl || "")
    if (!raw) {
      return raw
    }
    const value = range || fallback
    const hasPlaceholder = raw.includes("{datetime}") || raw.includes("{time}") || raw.includes("{timestamp}")
    if (hasPlaceholder) {
      const ts = Date.now()
      return raw
        .replaceAll("{datetime}", encodeURIComponent(value))
        .replaceAll("{time}", encodeURIComponent(value))
        .replaceAll("{timestamp}", encodeURIComponent(String(ts)))
    }
    try {
      const u = new URL(raw, window.location.origin)
      if (u.searchParams.has("datetime") || u.searchParams.has("time") || u.searchParams.has("timestamp")) {
        let key = "datetime"
        if (u.searchParams.has("time")) {
          key = "time"
        } else if (u.searchParams.has("timestamp")) {
          key = "timestamp"
        }
        u.searchParams.delete("datetime")
        u.searchParams.delete("time")
        u.searchParams.delete("timestamp")
        u.searchParams.set(key, key === "timestamp" ? String(Date.now()) : value)
        return u.toString()
      }
    } catch {
    }
    return raw
  }

  const layers = getAllLayers()
  for (const layer of layers) {
    if (!layer || String(layer?.type) === "group") {
      continue
    }
    const opt = layer?.options || {}
    let url = ""
    if (typeof opt.url === "string") {
      url = opt.url
    } else if (typeof layer?.url === "string") {
      url = layer.url
    }
    if (!url) {
      continue
    }
    const should =
      url.includes("{datetime}") ||
      url.includes("{time}") ||
      url.includes("{timestamp}") ||
      /[?&](datetime|time|timestamp)=/i.test(url) ||
      !!opt.timeDynamic ||
      !!opt.isDynamic ||
      opt.dynamic === true
    if (!should) {
      continue
    }
    const nextUrl = applyToUrl(url)
    if (nextUrl === url) {
      continue
    }
    try {
      layer.options = layer.options || {}
      layer.options.url = nextUrl
      layer.options.timeExtent = { start: start || undefined, end: end || undefined }
    } catch {
    }
    try {
      if (typeof layer.setUrl === "function") {
        layer.setUrl(nextUrl)
      } else {
        layer.url = nextUrl
      }
    } catch {
    }
    try {
      layer.reload?.()
    } catch {
    }
  }
  try {
    map.scene?.requestRender?.()
  } catch {
  }
}

export function setLayerOpacity(layerId: string | number, opacity: number) {
  const layer = getLayerById(layerId)
  if (!layer) {
    return
  }
  try {
    layer.opacity = opacity
  } catch {
  }
  try {
    map?.scene?.requestRender?.()
  } catch {
  }
}

export function moveLayerZIndex(layerId: string | number, action: "top" | "bottom" | "up" | "down") {
  if (!map) {
    return
  }
  const layer: any = getLayerById(layerId)
  if (!layer || typeof layer.zIndex !== "number") {
    return
  }
  const layers = getAllLayers().filter((l) => typeof l?.zIndex === "number")
  if (layers.length === 0) {
    return
  }
  const zValues = layers.map((l) => l.zIndex)
  const minZ = Math.min(...zValues)
  const maxZ = Math.max(...zValues)

  if (action === "top") {
    layer.zIndex = maxZ + 1
  } else if (action === "bottom") {
    layer.zIndex = minZ - 1
  } else if (action === "up") {
    layer.zIndex = layer.zIndex + 1
  } else if (action === "down") {
    layer.zIndex = layer.zIndex - 1
  }
  try {
    map.scene?.requestRender?.()
  } catch {
  }
}

export function exchangeLayerZIndex(aId: string | number, bId: string | number): boolean {
  if (!map) {
    return false
  }
  const a: any = getLayerById(aId)
  const b: any = getLayerById(bId)
  if (!a || !b || typeof a.zIndex !== "number" || typeof b.zIndex !== "number") {
    return false
  }
  const tmp = a.zIndex
  a.zIndex = b.zIndex
  b.zIndex = tmp
  try {
    map.scene?.requestRender?.()
  } catch {
  }
  return true
}

export function ensureGroupLayer(groupId: string, groupName: string, pid?: string | number | null) {
  if (!map) {
    return
  }
  const existed = getLayerById(groupId)
  if (existed) {
    try {
      existed.name = groupName
    } catch {
    }
    if (pid !== undefined) {
      setLayerPid(groupId, pid)
    }
    return
  }
  const anyMars: any = mars3d as any
  const GroupLayer = anyMars?.layer?.GroupLayer
  if (typeof GroupLayer !== "function") {
    return
  }
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
  } catch {
  }
}

export function batchSetLayerShow(layerIds: Array<string | number>, show: boolean) {
  if (!map) {
    return
  }
  const ids = Array.isArray(layerIds) ? layerIds : []
  for (const id of ids) {
    const layer = getLayerById(id)
    if (!layer) {
      continue
    }
    try {
      if (show) {
        if (!layer.isAdded) {
          map.addLayer(layer)
        }
        layer.show = true
      } else {
        layer.show = false
      }
    } catch {
    }
  }
  try {
    map.scene?.requestRender?.()
  } catch {
  }
}

type PersistedSession = {
  datasetId: string
  groupId: string
  openedAt: number
  source: DatasetSessionSource
  groupName?: string
  layerIdPrefix?: string
  manifest: Manifest
}

function readPersistedSessions(): PersistedSession[] {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY) || ""
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PersistedSession[]) : []
  } catch {
    return []
  }
}

function writePersistedSessions(list: PersistedSession[]) {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(list))
  } catch {
  }
}

export function persistSession(input: PersistedSession) {
  const datasetId = String(input?.datasetId || "")
  const groupId = String(input?.groupId || "")
  if (!datasetId || !groupId || !input?.manifest) {
    return
  }
  const openedAt = Number(input.openedAt) || Date.now()
  const list = readPersistedSessions()
  const kept = list.filter((x) => !(String(x.datasetId) === datasetId && String(x.groupId) === groupId))
  kept.unshift({
    datasetId,
    groupId,
    openedAt,
    source: input.source || "unknown",
    groupName: input.groupName,
    layerIdPrefix: input.layerIdPrefix,
    manifest: input.manifest
  })
  writePersistedSessions(kept.slice(0, 20))
}

export function getPersistedSession(groupId: string): PersistedSession | null {
  const gid = String(groupId || "")
  if (!gid) {
    return null
  }
  const list = readPersistedSessions()
  return list.find((item) => String(item.groupId) === gid) || null
}

export function removePersistedSession(groupId: string) {
  const gid = String(groupId || "")
  if (!gid) {
    return
  }
  const list = readPersistedSessions()
  const next = list.filter((x) => String(x.groupId) !== gid)
  if (next.length === list.length) {
    return
  }
  writePersistedSessions(next)
}

export function clearPersistedSessions(datasetId: string) {
  const id = String(datasetId || "")
  if (!id) {
    return
  }
  const list = readPersistedSessions()
  const next = list.filter((x) => String(x.datasetId) !== id)
  writePersistedSessions(next)
}

export async function restorePersistedSessions(datasetId: string): Promise<number> {
  if (!map) {
    return 0
  }
  const id = String(datasetId || "")
  if (!id) {
    return 0
  }
  const list = readPersistedSessions().filter((x) => String(x.datasetId) === id)
  let restored = 0
  for (const s of list) {
    const groupId = String(s.groupId || "")
    if (!groupId) {
      continue
    }
    if (getLayerById(groupId)) {
      continue
    }
    ensureGroupLayer(groupId, s.groupName || "本次导入")
    const prefix =
      s.layerIdPrefix !== null && s.layerIdPrefix !== undefined
        ? String(s.layerIdPrefix)
        : `eoapi_${id}_${s.openedAt}_`
    try {
      await restoreWorkspace(map, s.manifest, {
        strategy: "overlay",
        conflictResolution: "rename",
        restoreView: false,
        restoreLayers: true,
        restoreDrawFeatures: true,
        flyDuration: 0.0,
        layerIdPrefix: prefix,
        layerParentId: groupId,
        drawIdPrefix: prefix,
        clearExistingDrawFeatures: false
      })
      restored += 1
    } catch {
    }
  }
  return restored
}

export function createGraphicLayer(input: { id: string; name: string; pid?: string | number | null }) {
  if (!map) {
    return null
  }
  const anyMars: any = mars3d as any
  const GraphicLayer = anyMars?.layer?.GraphicLayer
  if (typeof GraphicLayer !== "function") {
    return null
  }
  try {
    const layer = new GraphicLayer({
      id: input.id,
      name: input.name,
      pid: input.pid ?? undefined,
      show: true
    })
    map.addLayer(layer)
    return layer
  } catch {
    return null
  }
}

export function detachGraphicFromMapDefaultLayer(graphic: any): boolean {
  if (!map || !graphic) {
    return false
  }
  try {
    map.graphicLayer?.removeGraphic?.(graphic)
    return true
  } catch {
  }
  try {
    map.graphicLayer?.remove?.(graphic)
    return true
  } catch {
  }
  return false
}

export function removeGroupTree(groupId: string) {
  if (!map || !groupId) {
    return
  }
  const layers = getAllLayers()
  const toRemove: any[] = []
  for (const layer of layers) {
    if (!layer) {
      continue
    }
    if (String(layer.id) === String(groupId)) {
      continue
    }
    if (isLayerUnderGroup(layer, groupId)) {
      toRemove.push(layer)
    }
  }
  for (const layer of toRemove) {
    try {
      map.removeLayer(layer, true)
    } catch {
      try {
        map.removeLayer(layer)
      } catch {
      }
    }
  }
  removeLayerById(groupId)
}

export function addGeoJsonLayer(id: string, data: any, options?: { name?: string; pid?: string | number | null }) {
  if (!map) {
    return null
  }
  try {
    const existing = getLayerById(id)
    if (existing) {
      try {
        existing.show = true
      } catch {
      }
      return existing
    }
    const layer = new mars3d.layer.GeoJsonLayer({
      id,
      name: options?.name || id,
      data,
      show: true,
      clampToGround: true,
      symbol: {
        type: "polygon",
        styleOptions: {
          color: "rgba(24,144,255,0.18)",
          outline: true,
          outlineColor: "rgba(24,144,255,0.9)",
          outlineWidth: 2
        }
      },
      pid: options?.pid ?? undefined
    } as any)
    map.addLayer(layer)
    return layer
  } catch {
    return null
  }
}

export function addXyzLayer(
  id: string,
  url: string,
  options?: { name?: string; minZoom?: number; maxZoom?: number; bounds?: [number, number, number, number]; pid?: string | number | null }
) {
  if (!map) {
    return null
  }
  try {
    const existing = getLayerById(id)
    if (existing) {
      try {
        existing.show = true
      } catch {
      }
      return existing
    }
    const layer = new mars3d.layer.XyzLayer({
      id,
      name: options?.name || id,
      url,
      minZoom: options?.minZoom,
      maxZoom: options?.maxZoom,
      rectangle: options?.bounds ? mars3d.Cesium.Rectangle.fromDegrees(...options.bounds) : undefined,
      show: true,
      pid: options?.pid ?? undefined
    } as any)
    map.addLayer(layer)
    return layer
  } catch {
    return null
  }
}

export function flyToBbox(bbox: [number, number, number, number], duration?: number) {
  if (!map || !bbox || bbox.length < 4) {
    return
  }
  const Cesium = mars3d.Cesium
  const [west, south, east, north] = bbox
  try {
    map.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
      duration: duration ?? 1.2
    })
  } catch {
  }
}
