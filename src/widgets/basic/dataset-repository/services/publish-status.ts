import type { DatasetStatus } from "../types/eoapi-types"

export type DatasetPublishStatus = DatasetStatus

export interface DatasetPublishEntry {
  status: DatasetPublishStatus
  requestedVisibility?: "shared" | "public"
  rejectionReason?: string
  rejectedAt?: number
  updatedAt: number
}

const STORAGE_KEY = "eoapi_publish_status_v1"

function readMap(): Record<string, DatasetPublishEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, DatasetPublishEntry>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: Record<string, DatasetPublishEntry>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function getDatasetPublishEntry(datasetId: string): DatasetPublishEntry | null {
  const map = readMap()
  return map[datasetId] || null
}

export function getDatasetPublishStatus(datasetId: string): DatasetPublishStatus {
  return getDatasetPublishEntry(datasetId)?.status || "private"
}

export function requestDatasetShare(datasetId: string, requestedVisibility: "shared" | "public" = "shared"): void {
  const map = readMap()
  map[datasetId] = {
    status: "reviewing",
    requestedVisibility,
    rejectionReason: undefined,
    rejectedAt: undefined,
    updatedAt: Date.now()
  }
  writeMap(map)
}

export function withdrawDatasetShare(datasetId: string): void {
  const map = readMap()
  map[datasetId] = {
    status: "private",
    rejectionReason: undefined,
    rejectedAt: undefined,
    updatedAt: Date.now()
  }
  writeMap(map)
}

export function setDatasetPublished(datasetId: string, visibility: "shared" | "public" = "shared"): void {
  const map = readMap()
  map[datasetId] = {
    status: "published",
    requestedVisibility: visibility,
    rejectionReason: undefined,
    rejectedAt: undefined,
    updatedAt: Date.now()
  }
  writeMap(map)
}

export function setDatasetRejected(datasetId: string, reason: string): void {
  const map = readMap()
  map[datasetId] = {
    status: "private",
    rejectionReason: String(reason || "").trim() || "未填写原因",
    rejectedAt: Date.now(),
    updatedAt: Date.now()
  }
  writeMap(map)
}

export function clearDatasetRejection(datasetId: string): void {
  const map = readMap()
  const cur = map[datasetId]
  if (!cur) {
    return
  }
  map[datasetId] = {
    ...cur,
    rejectionReason: undefined,
    rejectedAt: undefined,
    updatedAt: Date.now()
  }
  writeMap(map)
}

export function clearDatasetPublishEntry(datasetId: string): void {
  const map = readMap()
  if (map[datasetId]) {
    delete map[datasetId]
    writeMap(map)
  }
}
