import { eoApiConfig } from "./eoapi-config"

export type DatasetSyncReason =
  | "saved"
  | "revision"
  | "artifact"
  | "share"
  | "delete"
  | "fork"
  | "refresh"
  | "import"
  | "lock"

export type DatasetSyncDetail = {
  datasetId?: string
  reason: DatasetSyncReason
  source?: string
  at: number
  payload?: Record<string, any>
}

export const DATASET_SYNC_EVENT = "ksh002:dataset:sync"
export const LEGACY_DATASET_SAVED_EVENT = "ksh002:dataset:saved"
export const DATASET_SYNC_STATUS_EVENT = "ksh002:dataset:sync-status"

export type DatasetSyncConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | "error"

export type DatasetSyncStatusDetail = {
  datasetId?: string
  status: DatasetSyncConnectionStatus
  message?: string
  retryInMs?: number
  updatedAt: number
}

let datasetSyncSocket: WebSocket | null = null
let socketDatasetId = ""
let reconnectTimer: number | null = null
let reconnectAttempt = 0
let manualClose = false

export function emitDatasetSync(input: {
  datasetId?: string
  reason: DatasetSyncReason
  source?: string
  payload?: Record<string, any>
}): void {
  const detail: DatasetSyncDetail = {
    datasetId: typeof input.datasetId === "string" ? input.datasetId.trim() : "",
    reason: input.reason,
    source: typeof input.source === "string" ? input.source.trim() : undefined,
    at: Date.now(),
    payload: input.payload && typeof input.payload === "object" ? input.payload : undefined
  }

  window.dispatchEvent(new CustomEvent(DATASET_SYNC_EVENT, { detail }))

  // 兼容现有监听方，避免旧入口继续失效。
  if (detail.reason === "saved") {
    window.dispatchEvent(new CustomEvent(LEGACY_DATASET_SAVED_EVENT, { detail }))
  }
}

function emitDatasetSyncStatus(detail: DatasetSyncStatusDetail): void {
  window.dispatchEvent(new CustomEvent(DATASET_SYNC_STATUS_EVENT, { detail }))
}

function resolveDatasetSyncWsUrl(datasetId: string): string {
  const rawBase = String(eoApiConfig.apiPrefix || "").trim() || "/api/eoapi"
  const baseUrl = new URL(rawBase, window.location.origin)
  const protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:"
  const path = baseUrl.pathname.replace(/\/+$/, "")
  return `${protocol}//${baseUrl.host}${path}/ws/dataset-sync?datasetId=${encodeURIComponent(datasetId)}`
}

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect(datasetId: string, message?: string) {
  clearReconnectTimer()
  reconnectAttempt += 1
  const retryInMs = Math.min(30000, Math.max(1000, 1000 * Math.pow(2, Math.min(reconnectAttempt, 5))))
  emitDatasetSyncStatus({
    datasetId,
    status: navigator.onLine ? "reconnecting" : "offline",
    message: message || (navigator.onLine ? "同步连接已断开，准备重连" : "网络已断开，等待恢复"),
    retryInMs,
    updatedAt: Date.now()
  })
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    if (!manualClose && socketDatasetId === datasetId) {
      openDatasetSyncSocket(datasetId, true)
    }
  }, retryInMs)
}

function handleSocketMessage(datasetId: string, raw: string) {
  try {
    const parsed = JSON.parse(raw || "{}")
    if (parsed?.type === "dataset_sync" && parsed?.detail?.reason) {
      emitDatasetSync({
        datasetId: String(parsed.detail.datasetId || datasetId || ""),
        reason: parsed.detail.reason as DatasetSyncReason,
        source: String(parsed.detail.source || "ws").trim() || "ws",
        payload: parsed.detail.payload && typeof parsed.detail.payload === "object" ? parsed.detail.payload : undefined
      })
      return
    }
    if (parsed?.type === "sync_status") {
      emitDatasetSyncStatus({
        datasetId: String(parsed?.datasetId || datasetId || ""),
        status: (parsed?.status || "connected") as DatasetSyncConnectionStatus,
        message: typeof parsed?.message === "string" ? parsed.message : "",
        updatedAt: Date.now()
      })
    }
  } catch {
  }
}

function openDatasetSyncSocket(datasetId: string, isReconnect: boolean) {
  if (!datasetId) {
    return
  }
  if (!navigator.onLine) {
    scheduleReconnect(datasetId, "网络未连接")
    return
  }
  if (datasetSyncSocket) {
    try {
      datasetSyncSocket.close()
    } catch {
    }
    datasetSyncSocket = null
  }
  emitDatasetSyncStatus({
    datasetId,
    status: isReconnect ? "reconnecting" : "connecting",
    message: isReconnect ? "正在重连实时同步" : "正在建立实时同步连接",
    updatedAt: Date.now()
  })
  try {
    const socket = new WebSocket(resolveDatasetSyncWsUrl(datasetId))
    datasetSyncSocket = socket
    socket.onopen = () => {
      reconnectAttempt = 0
      clearReconnectTimer()
      emitDatasetSyncStatus({
        datasetId,
        status: "connected",
        message: "实时同步已连接",
        updatedAt: Date.now()
      })
    }
    socket.onmessage = (event) => {
      handleSocketMessage(datasetId, String(event.data || ""))
    }
    socket.onerror = () => {
      emitDatasetSyncStatus({
        datasetId,
        status: "error",
        message: "实时同步异常",
        updatedAt: Date.now()
      })
    }
    socket.onclose = () => {
      datasetSyncSocket = null
      if (manualClose || socketDatasetId !== datasetId) {
        emitDatasetSyncStatus({
          datasetId,
          status: "idle",
          message: "实时同步已关闭",
          updatedAt: Date.now()
        })
        return
      }
      scheduleReconnect(datasetId)
    }
  } catch {
    scheduleReconnect(datasetId, "实时同步连接初始化失败")
  }
}

export function connectDatasetSync(datasetId?: string): void {
  const nextDatasetId = String(datasetId || "").trim()
  if (!nextDatasetId) {
    return
  }
  if (
    datasetSyncSocket &&
    socketDatasetId === nextDatasetId &&
    datasetSyncSocket.readyState === WebSocket.OPEN
  ) {
    return
  }
  manualClose = false
  socketDatasetId = nextDatasetId
  clearReconnectTimer()
  openDatasetSyncSocket(nextDatasetId, false)
}

export function disconnectDatasetSync(datasetId?: string): void {
  const targetDatasetId = String(datasetId || socketDatasetId || "").trim()
  if (datasetId && targetDatasetId && socketDatasetId && targetDatasetId !== socketDatasetId) {
    return
  }
  manualClose = true
  clearReconnectTimer()
  socketDatasetId = ""
  reconnectAttempt = 0
  if (datasetSyncSocket) {
    try {
      datasetSyncSocket.close()
    } catch {
    }
    datasetSyncSocket = null
  }
  emitDatasetSyncStatus({
    datasetId: targetDatasetId,
    status: "idle",
    message: "实时同步已关闭",
    updatedAt: Date.now()
  })
}

export function onDatasetSync(cb: (detail: DatasetSyncDetail) => void): () => void {
  const handler = (evt: Event) => {
    const detail = (evt as CustomEvent<DatasetSyncDetail>).detail
    if (!detail || typeof detail.reason !== "string") {
      return
    }
    cb(detail)
  }

  window.addEventListener(DATASET_SYNC_EVENT, handler as EventListener)
  return () => window.removeEventListener(DATASET_SYNC_EVENT, handler as EventListener)
}

export function onDatasetSyncStatus(cb: (detail: DatasetSyncStatusDetail) => void): () => void {
  const handler = (evt: Event) => {
    const detail = (evt as CustomEvent<DatasetSyncStatusDetail>).detail
    if (!detail || typeof detail.status !== "string") {
      return
    }
    cb(detail)
  }
  window.addEventListener(DATASET_SYNC_STATUS_EVENT, handler as EventListener)
  return () => window.removeEventListener(DATASET_SYNC_STATUS_EVENT, handler as EventListener)
}
