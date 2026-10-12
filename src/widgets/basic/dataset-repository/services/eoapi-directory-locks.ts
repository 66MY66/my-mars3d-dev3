import { eoapiGet, eoapiPost } from "./eoapi-client"
import type { ApiResponse } from "../types/eoapi-types"
import { emitDatasetSync } from "./dataset-sync"
import { isSuperAdmin } from "@/shell/permission"

// #region debug-point eoapi-console-errors:directory-locks
type TraeDebugEvent = {
  t: number
  sessionId: string
  level: "info" | "warn" | "error"
  type: string
  message: string
  data?: Record<string, unknown>
}

const TRAE_DEBUG_ENDPOINT =
  (import.meta.env as any).VITE_DEBUG_SERVER_URL ||
  new URLSearchParams(location.search).get("traeDebug") ||
  localStorage.getItem("TRAE_DEBUG_SERVER_URL") ||
  ""
const TRAE_DEBUG_SESSION_ID =
  (import.meta.env as any).VITE_DEBUG_SESSION_ID ||
  new URLSearchParams(location.search).get("traeSession") ||
  localStorage.getItem("TRAE_DEBUG_SESSION_ID") ||
  "eoapi-console-errors"

const traeBaseFetch = window.fetch.bind(window)

async function reportTraeDebugEvent(event: TraeDebugEvent): Promise<void> {
  if (!TRAE_DEBUG_ENDPOINT) {
    return
  }
  try {
    await traeBaseFetch(TRAE_DEBUG_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify(event),
      keepalive: true
    })
  } catch {
  }
}

function fireAndForget(p: Promise<unknown>): void {
  p.catch(() => {})
}
// #endregion debug-point eoapi-console-errors:directory-locks

export type DirectoryLockType = "alert" | "thematic" | "task" | "generic"

export type DirectoryLockRecord = {
  directoryId: string
  datasetId: string
  directoryType: DirectoryLockType | string
  locked: boolean
  reason?: string
  metadata?: Record<string, any>
  updatedBy: string
  createdAt: number
  updatedAt: number
}

const lockApiCooldownMs = 60_000
let lockApiUnavailableUntil = 0

function isDirectoryLockApiAvailable(): boolean {
  return Date.now() >= lockApiUnavailableUntil
}

function markDirectoryLockApiUnavailable(): void {
  lockApiUnavailableUntil = Math.max(lockApiUnavailableUntil, Date.now() + lockApiCooldownMs)
}

function markDirectoryLockApiHealthy(): void {
  lockApiUnavailableUntil = 0
}

function resolveDirectoryLockDebugLevel(result: { success: boolean; code?: number }): "info" | "warn" | "error" {
  if (result.success) {
    return "info"
  }
  if (result.code === 404) {
    return "warn"
  }
  return "error"
}

function resolveLockUserId(): string {
  if (isSuperAdmin()) {
    const rawRole = String(localStorage.getItem("user_role") || localStorage.getItem("userRole") || "").trim().toLowerCase()
    if (rawRole === "admin") {
      return "admin"
    }
    return "super-admin"
  }
  return "anonymous"
}

export async function getDirectoryLocks(datasetId: string): Promise<ApiResponse<DirectoryLockRecord[]>> {
  if (!isDirectoryLockApiAvailable()) {
    fireAndForget(
      reportTraeDebugEvent({
        t: Date.now(),
        sessionId: TRAE_DEBUG_SESSION_ID,
        level: "info",
        type: "directory-locks.fetch.skip",
        message: "directory-locks.fetch.skip",
        data: {
          datasetId,
          unavailableUntil: lockApiUnavailableUntil
        }
      })
    )
    return { success: true, data: [] }
  }
  fireAndForget(
    reportTraeDebugEvent({
      t: Date.now(),
      sessionId: TRAE_DEBUG_SESSION_ID,
      level: "info",
      type: "directory-locks.fetch.start",
      message: "directory-locks.fetch.start",
      data: {
        datasetId
      }
    })
  )
  const result = await eoapiGet<DirectoryLockRecord[]>("/locks/directories", {
    params: { datasetId }
  })
  if (result.success) {
    markDirectoryLockApiHealthy()
  } else if (result.code === 404 || (result.code || 0) >= 500 || result.code == null) {
    markDirectoryLockApiUnavailable()
  }
  fireAndForget(
    reportTraeDebugEvent({
      t: Date.now(),
      sessionId: TRAE_DEBUG_SESSION_ID,
      level: resolveDirectoryLockDebugLevel(result),
      type: result.success ? "directory-locks.fetch.success" : "directory-locks.fetch.fail",
      message: result.success ? "directory-locks.fetch.success" : "directory-locks.fetch.fail",
      data: {
        datasetId,
        code: result.code ?? null,
        rows: Array.isArray(result.data) ? result.data.length : null,
        detail: result.message || ""
      }
    })
  )
  return result
}

export async function upsertDirectoryLock(
  directoryId: string,
  params: {
    datasetId: string
    directoryType?: DirectoryLockType
    locked: boolean
    reason?: string
    metadata?: Record<string, any>
  }
): Promise<ApiResponse<DirectoryLockRecord>> {
  if (!isDirectoryLockApiAvailable()) {
    fireAndForget(
      reportTraeDebugEvent({
        t: Date.now(),
        sessionId: TRAE_DEBUG_SESSION_ID,
        level: "info",
        type: "directory-locks.upsert.skip",
        message: "directory-locks.upsert.skip",
        data: {
          directoryId,
          datasetId: params.datasetId,
          locked: params.locked,
          unavailableUntil: lockApiUnavailableUntil
        }
      })
    )
    return {
      success: false,
      code: 503,
      message: "目录锁服务暂不可用"
    }
  }
  const result = await eoapiPost<DirectoryLockRecord>(
    `/locks/directories/${encodeURIComponent(directoryId)}?user_id=${encodeURIComponent(resolveLockUserId())}`,
    {
      datasetId: params.datasetId,
      directoryType: params.directoryType || "task",
      locked: params.locked,
      reason: params.reason,
      metadata: params.metadata || {}
    }
  )
  if (result.success) {
    markDirectoryLockApiHealthy()
  } else if (result.code === 404 || (result.code || 0) >= 500 || result.code == null) {
    markDirectoryLockApiUnavailable()
  }
  fireAndForget(
    reportTraeDebugEvent({
      t: Date.now(),
      sessionId: TRAE_DEBUG_SESSION_ID,
      level: resolveDirectoryLockDebugLevel(result),
      type: result.success ? "directory-locks.upsert.success" : "directory-locks.upsert.fail",
      message: result.success ? "directory-locks.upsert.success" : "directory-locks.upsert.fail",
      data: {
        directoryId,
        datasetId: params.datasetId,
        locked: params.locked,
        directoryType: params.directoryType || "task",
        code: result.code ?? null,
        detail: result.message || ""
      }
    })
  )
  if (result.success && params.datasetId) {
    emitDatasetSync({
      datasetId: params.datasetId,
      reason: "lock",
      source: "directory-lock",
      payload: {
        directoryId,
        locked: params.locked,
        directoryType: params.directoryType || "task"
      }
    })
  }
  return result
}

export default {
  getDirectoryLocks,
  upsertDirectoryLock
}

export function __resetDirectoryLockApiStateForTest(): void {
  lockApiUnavailableUntil = 0
}
