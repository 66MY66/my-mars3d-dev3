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
  return `ksh002:dataset-cover:${datasetId}`
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
  const key = `bbox-cover-v2:${params.datasetId}:${bbox.map((n) => n.toFixed(4)).join(",")}`
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
  const template =
    (import.meta as any).env?.VITE_EOAPI_COVER_TILE_TEMPLATE ||
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

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
  try {
    await runWithConcurrency(6, tiles, async (t) => {
      const url = buildTileUrl(template, zoom, t.x, t.y)
      const img = await loadTile(url, controller.signal)
      if (!img) {
        return
      }
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
  return template.replaceAll("{z}", String(z)).replaceAll("{x}", String(x)).replaceAll("{y}", String(y))
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
