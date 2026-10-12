import { eoapiPost, eoapiGet, eoapiDelete } from "./eoapi-client"

export type DatasetMetric = {
  datasetId: string
  favorite: boolean
  browseCount: number
  importCount: number
  favoriteCount: number
  lastUsedAt?: number
}

type MetricMap = Record<string, DatasetMetric>

const storageKey = "ksh002_dataset_metrics_v1"
const eventName = "datasetMetricsChange"
const managementApiCooldownMs = 60_000

let managementApiUnavailableUntil = 0
let syncMetricsInFlight: Promise<void> | null = null

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback
  }
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase()
    if (v === "true" || v === "1") { return true }
    if (v === "false" || v === "0") { return false }
  }
  if (typeof value === "number") {
    return value !== 0
  }
  return Boolean(value)
}

function normalizeMetric(key: string, raw: any): DatasetMetric {
  const datasetId = String(raw?.datasetId || key || "").trim() || String(key || "").trim()
  const favorite = toBoolean(raw?.favorite)
  const browseCount = toFiniteNumber(raw?.browseCount, 0)
  const importCount = toFiniteNumber(raw?.importCount, 0)
  const favoriteCount = toFiniteNumber(raw?.favoriteCount, 0)
  const lastUsedAtRaw = raw?.lastUsedAt
  const lastUsedAt = toFiniteNumber(lastUsedAtRaw, NaN)

  return {
    datasetId,
    favorite,
    browseCount,
    importCount,
    favoriteCount,
    lastUsedAt: Number.isFinite(lastUsedAt) ? lastUsedAt : undefined
  }
}

function readMap(): MetricMap {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as any
    if (!parsed || typeof parsed !== "object") {
      return {}
    }
    const next: MetricMap = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") {
        continue
      }
      const metric = normalizeMetric(String(key), value)
      if (metric.datasetId) {
        next[metric.datasetId] = metric
      }
    }
    return next
  } catch {
    return {}
  }
}

function writeMap(map: MetricMap) {
  localStorage.setItem(storageKey, JSON.stringify(map))
  window.dispatchEvent(new CustomEvent(eventName))
}

function now(): number {
  return Date.now()
}

function isManagementApiAvailable(): boolean {
  return now() >= managementApiUnavailableUntil
}

function markManagementApiUnavailable(): void {
  managementApiUnavailableUntil = Math.max(managementApiUnavailableUntil, now() + managementApiCooldownMs)
}

function markManagementApiHealthy(): void {
  managementApiUnavailableUntil = 0
}

async function callManagementApi<T>(request: () => Promise<{ success: boolean; data?: T; code?: number }>): Promise<T | null> {
  if (!isManagementApiAvailable()) {
    return null
  }
  const res = await request().catch(() => ({ success: false, code: 500 } as any))
  if (!res?.success) {
    if ((res?.code || 0) >= 500 || res?.code == null) {
      markManagementApiUnavailable()
    }
    return null
  }
  markManagementApiHealthy()
  return (res.data ?? null) as T | null
}

function ensure(map: MetricMap, datasetId: string): DatasetMetric {
  const existing = map[datasetId]
  if (existing) {
    return existing
  }
  const next: DatasetMetric = {
    datasetId,
    favorite: false,
    browseCount: 0,
    importCount: 0,
    favoriteCount: 0
  }
  map[datasetId] = next
  return next
}

export function getDatasetMetric(datasetId: string): DatasetMetric {
  const map = readMap()
  return ensure(map, datasetId)
}

export function isDatasetFavorite(datasetId: string): boolean {
  return getDatasetMetric(datasetId).favorite
}

export function setDatasetFavorite(datasetId: string, favorite: boolean) {
  const map = readMap()
  const metric = ensure(map, datasetId)
  metric.favorite = favorite
  if (favorite) {
    metric.lastUsedAt = Date.now()
  }
  writeMap(map)

  // Fire-and-forget: 同步到后端
  if (favorite) {
    callManagementApi(() => eoapiPost(`/favorites/${encodeURIComponent(datasetId)}`)).catch(() => {})
  } else {
    callManagementApi(() => eoapiDelete(`/favorites/${encodeURIComponent(datasetId)}`)).catch(() => {})
  }
}

export function toggleDatasetFavorite(datasetId: string): boolean {
  const next = !isDatasetFavorite(datasetId)
  setDatasetFavorite(datasetId, next)
  return next
}

export function recordDatasetBrowse(datasetId: string) {
  const map = readMap()
  const metric = ensure(map, datasetId)
  metric.browseCount += 1
  metric.lastUsedAt = Date.now()
  writeMap(map)

  // Fire-and-forget: 上报浏览事件
  callManagementApi(() =>
    eoapiPost("/metrics/events", {
      datasetId,
      eventType: "browse"
    })
  ).catch(() => {})
}

export function recordDatasetImport(datasetId: string) {
  const map = readMap()
  const metric = ensure(map, datasetId)
  metric.importCount += 1
  metric.lastUsedAt = Date.now()
  writeMap(map)

  // Fire-and-forget: 上报导入事件
  callManagementApi(() =>
    eoapiPost("/metrics/events", {
      datasetId,
      eventType: "import"
    })
  ).catch(() => {})
}

export function recordDatasetEvent(input: {
  datasetId: string
  eventType: string
  revisionId?: string
  context?: Record<string, any>
}) {
  const datasetId = String(input?.datasetId || "").trim()
  const eventType = String(input?.eventType || "").trim()
  if (!datasetId || !eventType) {
    return
  }
  callManagementApi(() =>
    eoapiPost("/metrics/events", {
      datasetId,
      revisionId: input?.revisionId,
      eventType,
      context: input?.context || {}
    })
  ).catch(() => {})
}

export function getFavoriteDatasetIds(): string[] {
  const map = readMap()
  return Object.values(map)
    .filter((m) => m.favorite)
    .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
    .map((m) => m.datasetId)
}

export function getRecentDatasetIds(limit = 5): string[] {
  const map = readMap()
  return Object.values(map)
    .filter((m) => typeof m.lastUsedAt === "number")
    .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
    .slice(0, limit)
    .map((m) => m.datasetId)
}

export function onDatasetMetricsChange(cb: () => void) {
  const handler = () => cb()
  window.addEventListener(eventName, handler as any)
  return () => window.removeEventListener(eventName, handler as any)
}

export function clearDatasetMetric(datasetId: string): void {
  const id = String(datasetId || "").trim()
  if (!id) {
    return
  }
  const map = readMap()
  if (!map[id]) {
    return
  }
  delete map[id]
  writeMap(map)
}

// ============ 服务端同步 ============

type ServerFavoriteRow = {
  datasetId: string
  name?: string
  createdAt: number
}

type ServerMetricsRow = {
  datasetId: string
  browseCount: number
  importCount: number
  downloadCount: number
  favoriteCount: number
  isFavorite: boolean
}

/**
 * 从服务端拉取收藏和统计数据，合并到 localStorage
 * - 收藏状态以服务端为准
 * - 统计计数取服务端全局值（覆盖本地）
 * - 调用失败时静默忽略，localStorage 保持原值
 */
export async function syncMetricsFromServer(): Promise<void> {
  if (!isManagementApiAvailable()) {
    return
  }
  if (syncMetricsInFlight) {
    return syncMetricsInFlight
  }
  syncMetricsInFlight = (async () => {
    try {
      // 1. 拉取收藏列表
      const favorites = await callManagementApi(() => eoapiGet<ServerFavoriteRow[]>("/favorites"))
      if (!favorites) {
        return
      }

      const serverFavIds = new Set<string>()
      for (const f of favorites) {
        serverFavIds.add(f.datasetId)
      }

      // 2. 拉取已知数据集的统计
      const map = readMap()
      const knownIds = [...new Set([...Object.keys(map), ...serverFavIds])]
      const metricsMap: Record<string, ServerMetricsRow> = {}
      if (knownIds.length > 0) {
        const metricsRows = await callManagementApi(() =>
          eoapiGet<ServerMetricsRow[]>(
            `/metrics/datasets?ids=${knownIds.map(encodeURIComponent).join(",")}`
          )
        )
        if (!metricsRows) {
          return
        }
        for (const m of metricsRows) {
          metricsMap[m.datasetId] = m
        }
      }

      // 3. 合并到 localStorage
      for (const id of knownIds) {
        const metric = ensure(map, id)
        const serverMetrics = metricsMap[id]

        // 收藏状态以服务端为准
        metric.favorite = serverFavIds.has(id)

        // 统计计数取服务端全局值
        if (serverMetrics) {
          metric.browseCount = serverMetrics.browseCount
          metric.importCount = serverMetrics.importCount
          metric.favoriteCount = serverMetrics.favoriteCount
        }

        // 补充 lastUsedAt（从收藏记录中取）
        if (metric.favorite && !metric.lastUsedAt) {
          const favEntry = favorites.find((f) => f.datasetId === id)
          if (favEntry) {
            metric.lastUsedAt = favEntry.createdAt
          }
        }
      }

      writeMap(map)
    } catch {
      markManagementApiUnavailable()
    } finally {
      syncMetricsInFlight = null
    }
  })()
  return syncMetricsInFlight
}

export function __resetManagementApiStateForTest(): void {
  managementApiUnavailableUntil = 0
  syncMetricsInFlight = null
}
