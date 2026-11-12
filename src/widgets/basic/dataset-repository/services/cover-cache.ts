import { createStore, del as idbDel, get as idbGet, set as idbSet } from "idb-keyval"

type CacheEntry = {
  key: string
  dataUrl: string
  createdAt: number
}

const storageKey = "ksh002_cover_cache_v1"
const persistedStorageKey = "ksh002_dataset_cover_store_v1"
const datasetCoverTtlMs = 365 * 24 * 60 * 60 * 1000
const persistedCoverDb = createStore("ksh002-dataset-cover-db", "covers")

function datasetCoverKey(datasetId: string): string {
  // v2: 旧键被 OSM 失败期的灰色占位图污染，升版本使其整体失效重新生成
  return `ksh002:dataset-cover:v2:${datasetId}`
}

type PersistedCoverEntry = {
  url: string
  createdAt: number
}

function readLegacyPersistedCoverMap(): Record<string, PersistedCoverEntry> {
  try {
    const raw = localStorage.getItem(persistedStorageKey)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, PersistedCoverEntry>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeLegacyPersistedCoverMap(next: Record<string, PersistedCoverEntry>): void {
  try {
    if (Object.keys(next).length === 0) {
      localStorage.removeItem(persistedStorageKey)
      return
    }
    localStorage.setItem(persistedStorageKey, JSON.stringify(next))
  } catch {
  }
}

function readAll(): CacheEntry[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as CacheEntry[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((x) => x && typeof x.key === "string" && typeof x.dataUrl === "string" && typeof x.createdAt === "number")
  } catch {
    return []
  }
}

function writeAll(list: CacheEntry[]) {
  localStorage.setItem(storageKey, JSON.stringify(list.slice(0, 30)))
}

export function getCoverCache(key: string, ttlMs = 10 * 60 * 1000): string | null {
  const all = readAll()
  const now = Date.now()
  const hit = all.find((x) => x.key === key && now - x.createdAt <= ttlMs)
  return hit?.dataUrl || null
}

export function setCoverCache(key: string, dataUrl: string) {
  const all = readAll().filter((x) => x.key !== key)
  all.unshift({ key, dataUrl, createdAt: Date.now() })
  writeAll(all)
}

export async function getPersistedDatasetCover(datasetId: string): Promise<string | null> {
  if (!datasetId) {
    return null
  }
  try {
    const entry = await idbGet<PersistedCoverEntry>(datasetCoverKey(datasetId), persistedCoverDb)
    if (!entry || typeof entry.url !== "string" || !entry.url) {
      const legacy = readLegacyPersistedCoverMap()[datasetCoverKey(datasetId)]
      if (!legacy || typeof legacy.url !== "string" || !legacy.url) {
        return null
      }
      if (typeof legacy.createdAt !== "number" || Date.now() - legacy.createdAt > datasetCoverTtlMs) {
        const next = readLegacyPersistedCoverMap()
        delete next[datasetCoverKey(datasetId)]
        writeLegacyPersistedCoverMap(next)
        return null
      }
      await idbSet(datasetCoverKey(datasetId), legacy, persistedCoverDb)
      const next = readLegacyPersistedCoverMap()
      delete next[datasetCoverKey(datasetId)]
      writeLegacyPersistedCoverMap(next)
      return legacy.url
    }
    if (typeof entry.createdAt !== "number" || Date.now() - entry.createdAt > datasetCoverTtlMs) {
      try {
        await idbDel(datasetCoverKey(datasetId), persistedCoverDb)
      } catch {
      }
      return null
    }
    return entry.url
  } catch {
  }
  return null
}

export async function setPersistedDatasetCover(datasetId: string, coverUrl: string): Promise<void> {
  if (!datasetId || !coverUrl) {
    return
  }
  try {
    await idbSet(datasetCoverKey(datasetId), { url: coverUrl, createdAt: Date.now() }, persistedCoverDb)
    const next = readLegacyPersistedCoverMap()
    if (next[datasetCoverKey(datasetId)]) {
      delete next[datasetCoverKey(datasetId)]
      writeLegacyPersistedCoverMap(next)
    }
  } catch {
  }
}

/**
 * 服务端封面：取 collection 第一个 item 的可视化资产，由 titiler-pgstac 渲染缩略图。
 * MAXAR 等自带影像的数据集走这条路（一次请求出真影像封面），无资产/失败返回 null 走天地图生成。
 */
export async function fetchServerCover(collectionId: string): Promise<string | null> {
  if (!collectionId || collectionId.startsWith("local_")) {
    return null
  }
  try {
    const itemsRes = await fetch(`/api/eoapi/collections/${encodeURIComponent(collectionId)}/items?limit=1`)
    if (!itemsRes.ok) {
      return null
    }
    const items = await itemsRes.json()
    const itemId = items?.features?.[0]?.id
    if (!itemId) {
      return null
    }
    const url = `/api/titiler/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}/preview.png?assets=visual&max_size=256`
    const blob = await fetchTitilerPreview(url)
    if (!blob) {
      return null
    }
    return await blobToDataUrl(blob) 
} catch {
    return null
  }
}

async function fetchTitilerPreview(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return null
    }
    const blob = await res.blob()
    return blob.type.startsWith("image/") ? blob : null
  } catch {
    return null
  }
}

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  return await new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || "") || null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

/**
 * 后端共享封面：存于 datasets-api /covers/{id}，所有浏览器共用一份。
 * 返回封面 http url；后端没有（404）返回 null，由调用方生成后 putServerCover 上传。
 */
export async function getServerCover(collectionId: string): Promise<string | null> {
  if (!collectionId || collectionId.startsWith("local_")) {
    return null
  }
  try {
    const res = await fetch(`/api/eoapi/covers/${encodeURIComponent(collectionId)}`)
    return res.ok ? `/api/eoapi/covers/${encodeURIComponent(collectionId)}` : null
  } catch {
    return null
  }
}

export async function putServerCover(collectionId: string, dataUrl: string): Promise<void> {
  if (!collectionId || collectionId.startsWith("local_") || !dataUrl) {
    return
  }
  try {
    const [meta, b64] = dataUrl.split(",")
    if (!b64) {
      return
    }
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i)
    }
    const mime = meta?.match(/data:(image\/\w+)/)?.[1] || "image/png"
    await fetch(`/api/eoapi/covers/${encodeURIComponent(collectionId)}`, {
      method: "PUT",
      headers: { "Content-Type": mime },
      body: bytes
    })
  } catch {
    // 上传失败不影响本地展示，下次打开会再试
  }
}

export function computeCoverCacheKey(input: {
  bbox?: [number, number, number, number]
  center?: { longitude: number; latitude: number }
  zoom?: number
  heading?: number
  pitch?: number
}): string {
  const b = input.bbox || [0, 0, 0, 0]
  const z = typeof input.zoom === "number" ? input.zoom : 0
  const h = typeof input.heading === "number" ? input.heading : 0
  const p = typeof input.pitch === "number" ? input.pitch : 0
  return `bbox:${b.map((n) => n.toFixed(5)).join(",")};z:${z.toFixed(2)};h:${h.toFixed(1)};p:${p.toFixed(1)}`
}

export async function getOrCreateBboxCover(params: {
  datasetId: string
  title?: string
  bbox?: [number, number, number, number]
  width?: number
  height?: number
}): Promise<string> {
  const bbox = params.bbox || [0, 0, 0, 0]
  // ponytail: v3 —— v2 时代 OSM 外网不通，大量灰色占位图被持久化；升键使其全部失效。
  // 用户手动上传的封面走 dataset-cover 独立键，不受影响
  const key = `bbox-cover-v3:${params.datasetId}:${bbox.map((n) => n.toFixed(4)).join(",")}`
  const cached = getCoverCache(key, 24 * 60 * 60 * 1000)
  if (cached) {
    return cached
  }

  const width = Math.max(320, params.width || 640)
  const height = Math.max(180, params.height || 360)
  const dataUrl =
    (await renderTileMiniMap({
      title: params.title || params.datasetId,
      bbox,
      width,
      height
    })) ||
    drawFallbackMiniMap({
      title: params.title || params.datasetId,
      bbox,
      width,
      height
    })
  setCoverCache(key, dataUrl)
  return dataUrl
}

function drawFallbackMiniMap(input: {
  title: string
  bbox: [number, number, number, number]
  width: number
  height: number
}): string {
  const canvas = document.createElement("canvas")
  canvas.width = input.width
  canvas.height = input.height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return ""
  }

  const bg = ctx.createLinearGradient(0, 0, input.width, input.height)
  bg.addColorStop(0, "#163047")
  bg.addColorStop(1, "#0d1a28")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, input.width, input.height)

  // Draw map-like grid to keep the "small map" visual cue
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = 1
  for (let x = 0; x <= input.width; x += 32) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, input.height)
    ctx.stroke()
  }
  for (let y = 0; y <= input.height; y += 24) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(input.width, y)
    ctx.stroke()
  }

  // Project bbox to thumbnail space (lon/lat: [-180,180],[-90,90])
  const [w, s, e, n] = input.bbox
  const x1 = ((w + 180) / 360) * input.width
  const x2 = ((e + 180) / 360) * input.width
  const y1 = ((90 - n) / 180) * input.height
  const y2 = ((90 - s) / 180) * input.height

  const rx = Math.max(8, Math.min(x1, x2))
  const ry = Math.max(8, Math.min(y1, y2))
  const rw = Math.max(18, Math.min(input.width - 16 - rx, Math.abs(x2 - x1)))
  const rh = Math.max(14, Math.min(input.height - 16 - ry, Math.abs(y2 - y1)))

  ctx.fillStyle = "rgba(65,168,255,0.28)"
  ctx.strokeStyle = "rgba(105,190,255,0.95)"
  ctx.lineWidth = 2
  roundRect(ctx, rx, ry, rw, rh, 6)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = "rgba(255,255,255,0.92)"
  ctx.font = "600 16px system-ui, -apple-system, Segoe UI, Roboto, PingFang SC, Microsoft YaHei"
  ctx.textBaseline = "top"
  ctx.fillText(input.title.slice(0, 20), 12, 10)
  ctx.fillStyle = "rgba(255,255,255,0.6)"
  ctx.font = "400 11px system-ui, -apple-system, Segoe UI, Roboto, PingFang SC, Microsoft YaHei"
  ctx.fillText("示意封面", input.width - 64, 14)
  ctx.fillStyle = "rgba(255,255,255,0.65)"
  ctx.font = "400 11px system-ui, -apple-system, Segoe UI, Roboto, PingFang SC, Microsoft YaHei"
  ctx.fillText(`${w.toFixed(2)}, ${s.toFixed(2)} - ${e.toFixed(2)}, ${n.toFixed(2)}`, 12, input.height - 20)

  return canvas.toDataURL("image/jpeg", 0.86)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

async function renderTileMiniMap(input: {
  title: string
  bbox: [number, number, number, number]
  width: number
  height: number
}): Promise<string> {
  // 天地图底图。token 是"服务器端"类型 key（浏览器直连返回 301013 权限类型错误），
  // 必须经 5954 代理服务端转发（与 eoapi-basemaps.ts 的底图走法一致），不能直连 t{s}.tianditu.gov.cn
  const template =
    (import.meta as any).env?.VITE_EOAPI_COVER_TILE_TEMPLATE ||
    "http://192.168.10.15:5954/tianditu/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=120a6aeb42bd1b1e181cbe4116e6185a"

  const bbox = normalizeBbox(input.bbox)
  const padded = padBbox(bbox, 0.08)
  const zoom = chooseZoomForBbox(padded, input.width, input.height)

  const canvas = document.createElement("canvas")
  canvas.width = input.width
  canvas.height = input.height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return ""
  }
  ctx.fillStyle = "#eef2f6"
  ctx.fillRect(0, 0, input.width, input.height)

  const center = bboxCenter(padded)
  const centerPx = lngLatToPixel(center.lng, center.lat, zoom)
  const topLeftPx = { x: centerPx.x - input.width / 2, y: centerPx.y - input.height / 2 }

  const tileSize = 256
  const x0 = Math.floor(topLeftPx.x / tileSize)
  const y0 = Math.floor(topLeftPx.y / tileSize)
  const x1 = Math.floor((topLeftPx.x + input.width) / tileSize)
  const y1 = Math.floor((topLeftPx.y + input.height) / tileSize)
  const max = 1 << zoom

  const tiles: Array<{ x: number; y: number }> = []
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= max) {
      continue
    }
    for (let tx = x0; tx <= x1; tx++) {
      const wrapped = ((tx % max) + max) % max
      tiles.push({ x: wrapped, y: ty })
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)
  let drewAnyTile = false
  try {
    await runWithConcurrency(6, tiles, async (t) => {
      const url = buildTileUrl(template, zoom, t.x, t.y)
      const img = await loadTile(url, controller.signal)
      if (!img) {
        return
      }
      drewAnyTile = true
      const px = { x: t.x * tileSize, y: t.y * tileSize }
      const dx = Math.round(px.x - topLeftPx.x)
      const dy = Math.round(px.y - topLeftPx.y)
      ctx.drawImage(img, dx, dy, tileSize, tileSize)
    })
  } catch {
    return ""
  } finally {
    clearTimeout(timeout)
  }
  // 瓦片一张都没画上（网络不通/超时）→ 返回空串走 fallback 占位图，
  // 避免"浅色假地图"被当作真封面持久化一年
  if (!drewAnyTile) {
    return ""
  }

  const [w, s, e, n] = bbox
  const p1 = lngLatToPixel(w, n, zoom)
  const p2 = lngLatToPixel(e, s, zoom)
  const rx = Math.min(p1.x, p2.x) - topLeftPx.x
  const ry = Math.min(p1.y, p2.y) - topLeftPx.y
  const rw = Math.abs(p2.x - p1.x)
  const rh = Math.abs(p2.y - p1.y)

  ctx.fillStyle = "rgba(65,168,255,0.14)"
  ctx.strokeStyle = "rgba(105,190,255,0.92)"
  ctx.lineWidth = 2
  roundRect(ctx, clamp(rx, 6, input.width - 12), clamp(ry, 6, input.height - 12), clamp(rw, 16, input.width - 12), clamp(rh, 16, input.height - 12), 6)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = "rgba(0,0,0,0.25)"
  ctx.fillRect(0, 0, input.width, 44)
  ctx.fillStyle = "rgba(255,255,255,0.94)"
  ctx.font = "600 16px system-ui, -apple-system, Segoe UI, Roboto, PingFang SC, Microsoft YaHei"
  ctx.textBaseline = "top"
  ctx.fillText(input.title.slice(0, 20), 12, 10)

  ctx.fillStyle = "rgba(0,0,0,0.25)"
  ctx.fillRect(0, input.height - 24, input.width, 24)
  ctx.fillStyle = "rgba(255,255,255,0.78)"
  ctx.font = "400 11px system-ui, -apple-system, Segoe UI, Roboto, PingFang SC, Microsoft YaHei"
  ctx.fillText(`${w.toFixed(2)}, ${s.toFixed(2)} - ${e.toFixed(2)}, ${n.toFixed(2)}`, 12, input.height - 18)

  return canvas.toDataURL("image/jpeg", 0.82)
}

function buildTileUrl(template: string, z: number, x: number, y: number): string {
  // DataServer 代理走单域，x/y 交错请求即可，无需子域轮换
  return template
    .replaceAll("{z}", String(z))
    .replaceAll("{x}", String(x))
    .replaceAll("{y}", String(y))
}

async function loadTile(url: string, signal: AbortSignal): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    const res = await fetch(url, { signal, mode: "cors" as RequestMode })
    if (!res.ok) {
      return null
    }
    const blob = await res.blob()
    if ((globalThis as any).createImageBitmap) {
      return await createImageBitmap(blob)
    }
    return await new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = URL.createObjectURL(blob)
    })
  } catch {
    return null
  }
}

async function runWithConcurrency<T>(limit: number, items: T[], worker: (item: T) => Promise<void>) {
  const queue = items.slice()
  const runners = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (!item) {
        return
      }
      await worker(item)
    }
  })
  await Promise.all(runners)
}

function normalizeBbox(b: [number, number, number, number]): [number, number, number, number] {
  const w = clamp(b[0], -180, 180)
  const s = clamp(b[1], -85, 85)
  const e = clamp(b[2], -180, 180)
  const n = clamp(b[3], -85, 85)
  if (e < w) {
    return [w, s, e + 360, n]
  }
  return [w, s, e, n]
}

function padBbox(b: [number, number, number, number], ratio: number): [number, number, number, number] {
  const [w, s, e, n] = b
  const dx = Math.max(0.01, (e - w) * ratio)
  const dy = Math.max(0.01, (n - s) * ratio)
  return [w - dx, s - dy, e + dx, n + dy]
}

function bboxCenter(b: [number, number, number, number]) {
  const [w, s, e, n] = b
  return { lng: (w + e) / 2, lat: (s + n) / 2 }
}

function chooseZoomForBbox(b: [number, number, number, number], width: number, height: number): number {
  const tileSize = 256
  for (let z = 18; z >= 2; z--) {
    const p1 = lngLatToPixel(b[0], b[3], z)
    const p2 = lngLatToPixel(b[2], b[1], z)
    const bw = Math.abs(p2.x - p1.x)
    const bh = Math.abs(p2.y - p1.y)
    if (bw <= width * 0.86 && bh <= height * 0.72) {
      return z
    }
    if (bw < tileSize && bh < tileSize && z <= 6) {
      return z
    }
  }
  return 2
}

function lngLatToPixel(lng: number, lat: number, zoom: number) {
  const tileSize = 256
  const scale = tileSize * (1 << zoom)
  const x = ((lng + 180) / 360) * scale
  const sin = Math.sin((lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
  return { x, y }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}
