/**
 * eoAPI 附件管理 API
 * @description 封面、报告、导出物等附件的上传和管理
 */

import { eoapiGet, eoapiPost, eoapiDelete, eoapiClient, resolveEoapiHref } from "./eoapi-client"
import { emitDatasetSync } from "./dataset-sync"
import { createStore, del as idbDel, get as idbGet, set as idbSet } from "idb-keyval"
import * as SparkMD5 from "spark-md5"
import {
  ApiResponse,
  Artifact,
  ArtifactType,
  ChunkedUploadState,
  CompleteChunkedUploadResponse,
  InitChunkedUploadResponse,
  UploadProgressInfo,
  UploadArtifactParams,
  UploadArtifactResponse,
  PresignedUploadParams,
  PresignedUploadResponse
} from "../types/eoapi-types"

const LOCAL_ARTIFACTS_KEY = "eoapi_local_artifacts_v1"
const CHUNKED_UPLOADS_KEY = "eoapi_chunked_uploads_v1"
const localBlobStore = createStore("mars3d-eoapi-artifacts-db", "artifact-blobs")
const MAX_LOCAL_STORE_BYTES = 15 * 1024 * 1024
const DEFAULT_CHUNK_THRESHOLD = 50 * 1024 * 1024
export const LARGE_ARTIFACT_UPLOAD_THRESHOLD_BYTES = DEFAULT_CHUNK_THRESHOLD
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024
const MAX_CHUNK_RETRIES = 3
const MAX_UPLOAD_CONCURRENCY = 5
const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024 * 1024

type LocalArtifactRecord = Artifact & {
  datasetId?: string
  revisionId?: string
  jobId?: string
}

type PersistedChunkedUploadState = ChunkedUploadState & {
  fileFingerprint?: string
}

export type UploadRuntimeControl = {
  isPauseRequested?: () => boolean
  waitForResume?: () => Promise<void>
  onStateChange?: (state: "hashing" | "uploading" | "paused" | "completed" | "failed") => void
}

function readLocalMap(): Record<string, LocalArtifactRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_ARTIFACTS_KEY) || ""
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") {
      return {}
    }
    return parsed as Record<string, LocalArtifactRecord>
  } catch {
    return {}
  }
}

function writeLocalMap(map: Record<string, LocalArtifactRecord>): void {
  try {
    localStorage.setItem(LOCAL_ARTIFACTS_KEY, JSON.stringify(map))
  } catch {
  }
}

function makeLocalArtifactId(): string {
  return `local_art_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function readChunkedUploadMap(): Record<string, PersistedChunkedUploadState> {
  try {
    const raw = localStorage.getItem(CHUNKED_UPLOADS_KEY) || ""
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") {
      return {}
    }
    return parsed as Record<string, PersistedChunkedUploadState>
  } catch {
    return {}
  }
}

function writeChunkedUploadMap(map: Record<string, PersistedChunkedUploadState>): void {
  try {
    localStorage.setItem(CHUNKED_UPLOADS_KEY, JSON.stringify(map))
  } catch {
  }
}

function saveChunkedUploadState(state: PersistedChunkedUploadState): void {
  const map = readChunkedUploadMap()
  map[state.uploadId] = state
  writeChunkedUploadMap(map)
}

function removeChunkedUploadState(uploadId: string): void {
  const map = readChunkedUploadMap()
  if (!map[uploadId]) {
    return
  }
  delete map[uploadId]
  writeChunkedUploadMap(map)
}

function getFileFingerprint(file: File, type: ArtifactType): string {
  return [file.name, file.size, file.type, file.lastModified, type].join(":")
}

async function computeFileMd5(
  file: File,
  options?: {
    chunkSize?: number
    onProgress?: (percent: number) => void
    control?: UploadRuntimeControl
  }
): Promise<string> {
  const chunkSize = Math.max(1024 * 1024, Math.floor(options?.chunkSize || 8 * 1024 * 1024))
  const chunkCount = Math.max(1, Math.ceil(file.size / chunkSize))
  const hasher = new SparkMD5.ArrayBuffer()
  options?.control?.onStateChange?.("hashing")

  for (let index = 0; index < chunkCount; index++) {
    if (options?.control?.isPauseRequested?.()) {
      options.control.onStateChange?.("paused")
      await options.control.waitForResume?.()
      options.control.onStateChange?.("hashing")
    }
    const start = index * chunkSize
    const end = Math.min(file.size, start + chunkSize)
    const buf = await file.slice(start, end).arrayBuffer()
    hasher.append(buf)
    if (typeof options?.onProgress === "function") {
      try {
        const p = Math.min(99, Number((((index + 1) / chunkCount) * 100).toFixed(2)))
        options.onProgress(p)
      } catch {
      }
    }
    if ((index + 1) % 4 === 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    }
  }
  return hasher.end()
}

async function waitForUploadResume(
  control: UploadRuntimeControl | undefined,
  buildPausedState: () => PersistedChunkedUploadState
): Promise<void> {
  if (!control?.isPauseRequested?.()) {
    return
  }
  saveChunkedUploadState(buildPausedState())
  control.onStateChange?.("paused")
  if (typeof control.waitForResume === "function") {
    await control.waitForResume()
  }
  control.onStateChange?.("uploading")
}

function sleep(ms: number): Promise<void> {
  const duration = Math.max(0, Math.floor(ms))
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration)
  })
}

function jitterDelay(ms: number, ratio = 0.2): number {
  const r = Math.max(0, Math.min(0.9, Number(ratio)))
  const base = Math.max(0, Math.floor(ms))
  if (!base || r === 0) {
    return base
  }
  const factor = 1 - r + Math.random() * 2 * r
  return Math.max(0, Math.floor(base * factor))
}

async function sleepWithPause(
  control: UploadRuntimeControl | undefined,
  ms: number,
  buildPausedState: () => PersistedChunkedUploadState
): Promise<void> {
  let remaining = Math.max(0, Math.floor(ms))
  const step = 250
  while (remaining > 0) {
    await waitForUploadResume(control, buildPausedState)
    const slice = Math.min(step, remaining)
    await sleep(slice)
    remaining -= slice
  }
}

async function dedupCheckArtifact(params: { md5: string; size: number; mime: string }): Promise<ApiResponse<UploadArtifactResponse>> {
  return eoapiPost<UploadArtifactResponse>("/artifacts/dedup-check", params)
}

function chunkByteSize(totalBytes: number, chunkSize: number, chunkIndex: number): number {
  const start = chunkIndex * chunkSize
  return Math.max(0, Math.min(chunkSize, totalBytes - start))
}

function toChunkedUploadState(
  data: InitChunkedUploadResponse,
  params: UploadArtifactParams,
  file: File,
  chunkSize: number,
  uploadedChunks: number[] = []
): PersistedChunkedUploadState {
  return {
    uploadId: String(data.uploadId || ""),
    artifactId: String(data.artifactId || ""),
    fileName: params.name,
    fileType: params.type,
    fileSize: file.size,
    mime: file.type || "application/octet-stream",
    chunkSize,
    chunkCount: Math.max(1, Math.ceil(file.size / chunkSize)),
    uploadedChunks: [...uploadedChunks].sort((a, b) => a - b),
    lastProgress: uploadedChunks.length ? Math.round((uploadedChunks.length / Math.max(1, Math.ceil(file.size / chunkSize))) * 100) : 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    datasetId: params.datasetId,
    revisionId: params.revisionId,
    jobId: params.jobId,
    status: "uploading",
    fileFingerprint: getFileFingerprint(file, params.type)
  }
}

function isLocalContext(params?: { datasetId?: string; revisionId?: string; jobId?: string }): boolean {
  const datasetId = String(params?.datasetId || "")
  const revisionId = String(params?.revisionId || "")
  const jobId = String(params?.jobId || "")
  if (datasetId.startsWith("local_")) {
    return true
  }
  if (revisionId.startsWith("local_")) {
    return true
  }
  if (jobId.startsWith("local_")) {
    return true
  }
  return false
}

function toUploadResponse(a: Artifact): UploadArtifactResponse {
  return {
    artifactId: a.artifactId,
    url: a.url,
    name: a.name,
    type: a.type,
    mime: a.mime,
    size: a.size || 0,
    createdAt: a.createdAt
  }
}

async function upsertLocalArtifact(
  record: LocalArtifactRecord,
  blob?: Blob | null
): Promise<void> {
  const map = readLocalMap()
  map[record.artifactId] = record
  writeLocalMap(map)
  if (blob) {
    try {
      const toStore = blob.size > MAX_LOCAL_STORE_BYTES ? blob.slice(0, MAX_LOCAL_STORE_BYTES) : blob
      await idbSet(record.artifactId, toStore, localBlobStore)
      if (blob.size > MAX_LOCAL_STORE_BYTES) {
        const cur = readLocalMap()
        const r = cur[record.artifactId]
        if (r) {
          r.metadata = { ...(r.metadata || {}), localPartial: true, localStoredBytes: toStore.size, localOriginalBytes: blob.size }
          cur[record.artifactId] = r
          writeLocalMap(cur)
        }
      }
    } catch {
    }
  }
}

function listLocalArtifacts(params?: {
  datasetId?: string
  revisionId?: string
  jobId?: string
  type?: ArtifactType
  limit?: number
  offset?: number
}): Artifact[] {
  const map = readLocalMap()
  const all = Object.values(map)
  const datasetId = params?.datasetId ? String(params.datasetId) : ""
  const revisionId = params?.revisionId ? String(params.revisionId) : ""
  const jobId = params?.jobId ? String(params.jobId) : ""
  const type = params?.type

  const filtered = all.filter((a) => {
    if (type && a.type !== type) {
      return false
    }
    if (datasetId && String((a as any).datasetId || "") !== datasetId) {
      return false
    }
    if (revisionId && String((a as any).revisionId || "") !== revisionId) {
      return false
    }
    if (jobId && String((a as any).jobId || "") !== jobId) {
      return false
    }
    return true
  })

  filtered.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0))

  const offset = typeof params?.offset === "number" ? Math.max(0, Math.floor(params.offset)) : 0
  const limit = typeof params?.limit === "number" ? Math.max(1, Math.floor(params.limit)) : filtered.length
  return filtered.slice(offset, offset + limit)
}

// ============ 附件查询 API ============

/**
 * 获取附件列表
 * @param params 查询参数
 */
export async function getArtifacts(params?: {
  datasetId?: string
  revisionId?: string
  jobId?: string
  type?: ArtifactType
  limit?: number
  offset?: number
}): Promise<ApiResponse<Artifact[]>> {
  const result = await eoapiGet<Artifact[]>("/artifacts", { params })
  if (result.success) {
    return result
  }
  if (isLocalContext(params)) {
    return { success: true, data: listLocalArtifacts(params) }
  }
  return { success: true, data: listLocalArtifacts(params) }
}

/**
 * 获取单个附件详情
 * @param artifactId 附件 ID
 */
export async function getArtifact(artifactId: string): Promise<ApiResponse<Artifact>> {
  return eoapiGet<Artifact>(`/artifacts/${artifactId}`)
}

/**
 * 获取附件下载链接
 * @param artifactId 附件 ID
 */
export async function getArtifactDownloadUrl(artifactId: string): Promise<ApiResponse<{
  downloadUrl: string
  expiresAt: number
}>> {
  const result = await eoapiGet<{ downloadUrl: string; expiresAt: number }>(`/artifacts/${artifactId}/download`)
  if (result.success) {
    return result
  }
  const map = readLocalMap()
  const record = map[String(artifactId)]
  if (!record) {
    return result
  }
  try {
    const blob = await idbGet<Blob>(record.artifactId, localBlobStore)
    if (blob) {
      const url = URL.createObjectURL(blob)
      return { success: true, data: { downloadUrl: url, expiresAt: Date.now() + 10 * 60 * 1000 } }
    }
  } catch {
  }
  return { success: true, data: { downloadUrl: record.url, expiresAt: Date.now() + 10 * 60 * 1000 } }
}

// ============ 附件上传 API ============

/**
 * 获取预签名上传 URL（用于大文件直传）
 * @param params 预签名参数
 */
export async function getPresignedUploadUrl(
  params: PresignedUploadParams
): Promise<ApiResponse<PresignedUploadResponse>> {
  const result = await eoapiPost<PresignedUploadResponse>("/artifacts/presigned", {
    name: params.name,
    type: params.type,
    mime: params.mime,
    size: params.size
  })
  if (result.success && result.data) {
    return result
  }
  const artifactId = makeLocalArtifactId()
  const createdAt = Date.now()
  const record: LocalArtifactRecord = {
    artifactId,
    name: params.name,
    type: params.type,
    url: `local://artifact/${artifactId}`,
    mime: params.mime,
    size: params.size,
    createdAt,
    metadata: { localPresigned: true }
  }
  await upsertLocalArtifact(record, null)
  return {
    success: true,
    data: {
      uploadUrl: `local-presigned://${artifactId}`,
      artifactId,
      expiresAt: Date.now() + 10 * 60 * 1000
    }
  }
}

/**
 * 使用预签名 URL 上传文件
 * @param uploadUrl 预签名 URL
 * @param file 文件
 */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File
): Promise<{ success: boolean; message?: string }> {
  if (String(uploadUrl || "").startsWith("local-presigned://")) {
    const artifactId = String(uploadUrl || "").replace("local-presigned://", "")
    if (!artifactId) {
      return { success: false, message: "无效上传地址" }
    }
    try {
      await idbSet(artifactId, file.size > MAX_LOCAL_STORE_BYTES ? file.slice(0, MAX_LOCAL_STORE_BYTES) : file, localBlobStore)
      const map = readLocalMap()
      const record = map[artifactId]
      if (record) {
        record.mime = file.type || record.mime
        record.size = file.size
        record.metadata = { ...(record.metadata || {}), localUploaded: true }
        map[artifactId] = record
        writeLocalMap(map)
      }
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message || "上传失败" }
    }
  }
  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type
      }
    })

    if (!response.ok) {
      return {
        success: false,
        message: `上传失败: ${response.statusText}`
      }
    }

    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "上传失败"
    }
  }
}

export async function initChunkedUpload(params: {
  name: string
  type: ArtifactType
  mime: string
  size: number
  chunkCount: number
  chunkSize: number
}): Promise<ApiResponse<InitChunkedUploadResponse>> {
  return eoapiPost<InitChunkedUploadResponse>("/artifacts/chunked/init", params)
}

export async function getChunkedUploadStatus(uploadId: string): Promise<ApiResponse<ChunkedUploadState>> {
  return eoapiGet<ChunkedUploadState>(`/artifacts/chunked/${uploadId}`)
}

export async function cancelChunkedUpload(uploadId: string): Promise<ApiResponse<{ success: boolean }>> {
  const result = await eoapiDelete<{ success: boolean }>(`/artifacts/chunked/${uploadId}`)
  if (result.success) {
    removeChunkedUploadState(uploadId)
  }
  return result
}

async function putChunk(uploadUrl: string, chunk: Blob): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(resolveEoapiHref(uploadUrl), {
      method: "PUT",
      body: chunk,
      headers: {
        "Content-Type": "application/octet-stream"
      }
    })
    if (!response.ok) {
      return {
        success: false,
        message: `分片上传失败: ${response.status} ${response.statusText}`
      }
    }
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "分片上传失败"
    }
  }
}

async function createOrResumeChunkedState(
  params: UploadArtifactParams,
  file: File,
  chunkSize: number
): Promise<ApiResponse<PersistedChunkedUploadState>> {
  const fingerprint = getFileFingerprint(file, params.type)
  const existing = Object.values(readChunkedUploadMap()).find((item) =>
    item.fileFingerprint === fingerprint && item.status !== "completed"
  )

  if (existing?.uploadId) {
    const statusResult = await getChunkedUploadStatus(existing.uploadId)
    if (statusResult.success && statusResult.data) {
      const resumed: PersistedChunkedUploadState = {
        ...existing,
        ...statusResult.data,
        datasetId: params.datasetId,
        revisionId: params.revisionId,
        jobId: params.jobId,
        fileFingerprint: fingerprint
      }
      saveChunkedUploadState(resumed)
      return { success: true, data: resumed }
    }
    removeChunkedUploadState(existing.uploadId)
  }

  const chunkCount = Math.max(1, Math.ceil(file.size / chunkSize))
  const initResult = await initChunkedUpload({
    name: params.name,
    type: params.type,
    mime: file.type || "application/octet-stream",
    size: file.size,
    chunkCount,
    chunkSize
  })

  if (!initResult.success || !initResult.data) {
    return {
      success: false,
      message: initResult.message || "初始化分片上传失败"
    }
  }

  const nextState = toChunkedUploadState(initResult.data, params, file, chunkSize)
  saveChunkedUploadState(nextState)
  return {
    success: true,
    data: nextState
  }
}

export async function uploadArtifactInChunks(
  params: UploadArtifactParams,
  options?: {
    chunkSize?: number
    concurrency?: number
    onProgress?: (progress: UploadProgressInfo) => void
    control?: UploadRuntimeControl
  }
): Promise<ApiResponse<UploadArtifactResponse>> {
  const file = params.file
  if (!file) {
    return { success: false, message: "缺少文件" }
  }

  const chunkSize = Math.max(1024 * 1024, options?.chunkSize || DEFAULT_CHUNK_SIZE)
  const stateResult = await createOrResumeChunkedState(params, file, chunkSize)
  if (!stateResult.success || !stateResult.data) {
    return { success: false, message: stateResult.message || "初始化分片上传失败" }
  }

  const uploadState = stateResult.data
  const startedAt = Date.now()
  const completedChunks = new Set<number>(uploadState.uploadedChunks || [])
  let uploadedBytes = Array.from(completedChunks).reduce((sum, idx) => (
    sum + chunkByteSize(file.size, uploadState.chunkSize, idx)
  ), 0)

  const concurrency = Math.max(1, Math.min(MAX_UPLOAD_CONCURRENCY, Math.floor(options?.concurrency || MAX_UPLOAD_CONCURRENCY)))
  const pending: number[] = []
  for (let index = 0; index < uploadState.chunkCount; index++) {
    if (!completedChunks.has(index)) {
      pending.push(index)
    }
  }

  const flushProgress = (indexForMeta: number) => {
    const percent = Math.min(100, Number(((uploadedBytes / Math.max(1, file.size)) * 100).toFixed(2)))
    const nextState: PersistedChunkedUploadState = {
      ...uploadState,
      uploadedChunks: Array.from(completedChunks).sort((a, b) => a - b),
      lastProgress: percent,
      updatedAt: Date.now(),
      status: "uploading"
    }
    saveChunkedUploadState(nextState)

    if (typeof options?.onProgress === "function") {
      try {
        options.onProgress({
          uploadedBytes,
          totalBytes: file.size,
          percent,
          currentChunk: Math.min(uploadState.chunkCount, Math.max(1, indexForMeta + 1)),
          totalChunks: uploadState.chunkCount,
          speed: Number(((uploadedBytes / 1024) / Math.max(1, (Date.now() - startedAt) / 1000)).toFixed(2)),
          elapsed: Date.now() - startedAt
        })
      } catch {
      }
    }
  }

  const buildRuntimeState = (status: PersistedChunkedUploadState["status"] = "uploading"): PersistedChunkedUploadState => ({
    ...uploadState,
    uploadedChunks: Array.from(completedChunks).sort((a, b) => a - b),
    lastProgress: Math.min(100, Number(((uploadedBytes / Math.max(1, file.size)) * 100).toFixed(2))),
    updatedAt: Date.now(),
    status
  })

  let fatalError = ""
  let aborted = false

  const uploadOne = async (index: number) => {
    await waitForUploadResume(options?.control, () => buildRuntimeState("paused"))
    const start = index * uploadState.chunkSize
    const end = Math.min(file.size, start + uploadState.chunkSize)
    const chunk = file.slice(start, end)
    const uploadUrl = `/artifacts/chunked/${uploadState.uploadId}/chunks/${index}`

    let lastError = ""
    for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
      await waitForUploadResume(options?.control, () => buildRuntimeState("paused"))
      if (aborted) {
        return
      }
      if (attempt > 0) {
        const baseDelayMs = 500
        const maxDelayMs = 8000
        const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)))
        const delayMs = jitterDelay(expDelay)
        await sleepWithPause(options?.control, delayMs, () => buildRuntimeState("paused"))
        if (aborted) {
          return
        }
      }
      const result = await putChunk(uploadUrl, chunk)
      if (result.success) {
        completedChunks.add(index)
        uploadedBytes += chunk.size
        flushProgress(index)
        return
      }
      lastError = result.message || "分片上传失败"
    }
    fatalError = lastError || `分片 ${index + 1} 上传失败`
    aborted = true
  }

  const workers: Promise<void>[] = []
  options?.control?.onStateChange?.("uploading")
  for (let w = 0; w < concurrency; w++) {
    workers.push(
      (async () => {
        while (true) {
          await waitForUploadResume(options?.control, () => buildRuntimeState("paused"))
          if (aborted) {
            return
          }
          const next = pending.shift()
          if (next === undefined) {
            return
          }
          await uploadOne(next)
        }
      })()
    )
  }
  await Promise.all(workers)

  if (aborted) {
    saveChunkedUploadState(buildRuntimeState("failed"))
    options?.control?.onStateChange?.("failed")
    return { success: false, message: fatalError || "分片上传失败" }
  }

  const completeResult = await eoapiPost<CompleteChunkedUploadResponse>("/artifacts/chunked/complete", {
    uploadId: uploadState.uploadId,
    artifactId: uploadState.artifactId,
    name: params.name,
    type: params.type,
    mime: file.type || "application/octet-stream",
    size: file.size,
    datasetId: params.datasetId,
    revisionId: params.revisionId,
    jobId: params.jobId
  })

  if (!completeResult.success || !completeResult.data) {
    saveChunkedUploadState(buildRuntimeState("failed"))
    options?.control?.onStateChange?.("failed")
    return {
      success: false,
      message: completeResult.message || "完成分片上传失败"
    }
  }

  removeChunkedUploadState(uploadState.uploadId)
  options?.control?.onStateChange?.("completed")
  return {
    success: true,
    data: completeResult.data
  }
}

/**
 * 上传附件（小文件直接上传）
 * @param params 上传参数
 */
export async function uploadArtifact(
  params: UploadArtifactParams
): Promise<ApiResponse<UploadArtifactResponse>> {
  if (!params.file) {
    return {
      success: false,
      message: "缺少文件"
    }
  }

  const formData = new FormData()
  formData.append("file", params.file)
  formData.append("name", params.name)
  formData.append("type", params.type)
  if (params.description) {
    formData.append("description", params.description)
  }
  if (params.datasetId) {
    formData.append("datasetId", params.datasetId)
  }
  if (params.revisionId) {
    formData.append("revisionId", params.revisionId)
  }
  if (params.jobId) {
    formData.append("jobId", params.jobId)
  }

  try {
    const response = await eoapiClient.post<UploadArtifactResponse>(
      "/artifacts/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      }
    )

    return {
      success: true,
      data: response.data
    }
  } catch (error: any) {
    const createdAt = Date.now()
    const artifactId = makeLocalArtifactId()
    const record: LocalArtifactRecord = {
      artifactId,
      name: params.name,
      type: params.type,
      url: `local://artifact/${artifactId}`,
      mime: params.file.type || "application/octet-stream",
      size: params.file.size,
      createdAt,
      datasetId: params.datasetId,
      revisionId: params.revisionId,
      jobId: params.jobId
    }
    await upsertLocalArtifact(record, params.file)
    return { success: true, data: toUploadResponse(record) }
  }
}

/**
 * 智能上传附件（自动选择上传方式）
 * @param params 上传参数
 * @param options 上传选项
 */
export async function smartUploadArtifact(
  params: UploadArtifactParams,
  options?: {
    /** 使用分片上传的阈值（字节），默认 20MB */
    presignedThreshold?: number
    /** 分片大小（字节），默认 5MB */
    chunkSize?: number
    /** 分片并发数（默认 5，最大 5） */
    concurrency?: number
    /** 上传进度回调 */
    onProgress?: (percent: number) => void
    /** 运行时控制 */
    control?: UploadRuntimeControl
  }
): Promise<ApiResponse<UploadArtifactResponse>> {
  const threshold = options?.presignedThreshold || DEFAULT_CHUNK_THRESHOLD
  const file = params.file

  if (!file) {
    return {
      success: false,
      message: "缺少文件"
    }
  }
  if (file.size > MAX_ARTIFACT_BYTES) {
    return {
      success: false,
      message: "文件过大（最大支持 10GB）"
    }
  }

  const shouldComputeMd5 = !isLocalContext(params) && file.size >= threshold
  const md5 = shouldComputeMd5
    ? await computeFileMd5(file, {
        onProgress: (p) => {
          if (typeof options?.onProgress === "function") {
            try {
              options.onProgress(Math.min(99, p))
            } catch {
            }
          }
        },
        control: options?.control
      }).catch(() => "")
    : ""

  if (md5) {
    const dedup = await dedupCheckArtifact({ md5, size: file.size, mime: file.type || "application/octet-stream" })
    if (dedup.success && dedup.data?.artifactId) {
      if (typeof options?.onProgress === "function") {
        try {
          options.onProgress(100)
        } catch {
        }
      }
      if (params.datasetId) {
        emitDatasetSync({ datasetId: params.datasetId, reason: "artifact", source: "smartUploadArtifact:dedup" })
      }
      return dedup
    }
  }

  // 小文件直接上传
  if (file.size < threshold) {
    const result = await uploadArtifact(params)
    if (result.success && result.data?.artifactId && md5) {
      await updateArtifactMetadata(result.data.artifactId, { md5, originalName: file.name, lastModified: file.lastModified }).catch(() => {})
    }
    if (result.success && params.datasetId) {
      emitDatasetSync({ datasetId: params.datasetId, reason: "artifact", source: "smartUploadArtifact:direct" })
    }
    return result
  }

  if (!isLocalContext(params)) {
    const result = await uploadArtifactInChunks(params, {
      chunkSize: options?.chunkSize,
      concurrency: options?.concurrency,
      onProgress: (progress) => {
        if (typeof options?.onProgress === "function") {
          options.onProgress(progress.percent)
        }
      },
      control: options?.control
    })
    if (result.success && result.data?.artifactId && md5) {
      await updateArtifactMetadata(result.data.artifactId, { md5, originalName: file.name, lastModified: file.lastModified }).catch(() => {})
    }
    if (result.success && params.datasetId) {
      emitDatasetSync({ datasetId: params.datasetId, reason: "artifact", source: "smartUploadArtifact:chunked" })
    }
    return result
  }

  // 兜底：保留原预签名直传逻辑，兼容不支持分片的环境与本地模式
  const presignedResult = await getPresignedUploadUrl({
    name: params.name,
    type: params.type,
    mime: file.type,
    size: file.size
  })

  if (!presignedResult.success || !presignedResult.data) {
    return {
      success: false,
      message: presignedResult.message || "获取上传地址失败"
    }
  }

  const uploadResult = await uploadToPresignedUrl(
    presignedResult.data.uploadUrl,
    file
  )

  if (!uploadResult.success) {
    return {
      success: false,
      message: uploadResult.message || "上传失败"
    }
  }

  if (typeof options?.onProgress === "function") {
    try {
      options.onProgress(100)
    } catch {
    }
  }

  if (String(presignedResult.data.uploadUrl || "").startsWith("local-presigned://")) {
    const map = readLocalMap()
    const record = map[String(presignedResult.data.artifactId)]
    if (!record) {
      return { success: false, message: "本地上传确认失败" }
    }
    record.name = params.name
    record.type = params.type
    record.mime = file.type || record.mime
    record.size = file.size
    record.datasetId = params.datasetId
    record.revisionId = params.revisionId
    record.jobId = params.jobId
    record.metadata = { ...(record.metadata || {}), localConfirmed: true }
    map[record.artifactId] = record
    writeLocalMap(map)
    if (params.datasetId) {
      emitDatasetSync({ datasetId: params.datasetId, reason: "artifact", source: "smartUploadArtifact:local-presigned" })
    }
    return { success: true, data: toUploadResponse(record) }
  }

  const result = await eoapiPost<UploadArtifactResponse>("/artifacts/confirm", {
    artifactId: presignedResult.data.artifactId,
    name: params.name,
    type: params.type,
    datasetId: params.datasetId,
    revisionId: params.revisionId,
    jobId: params.jobId
  })
  if (result.success && params.datasetId) {
    emitDatasetSync({ datasetId: params.datasetId, reason: "artifact", source: "smartUploadArtifact:confirm" })
  }
  return result
}

// ============ 附件管理 API ============

/**
 * 删除附件
 * @param artifactId 附件 ID
 */
export async function deleteArtifact(artifactId: string): Promise<ApiResponse<{ success: boolean }>> {
  const remoteArtifactDatasetId = getArtifact(artifactId)
    .then((res) => {
      const datasetId = res.success ? String((res.data as any)?.datasetId || "") : ""
      return datasetId
    })
    .catch(() => "")
  const result = await eoapiDelete<{ success: boolean }>(`/artifacts/${artifactId}`)
  if (result.success) {
    const datasetId = await remoteArtifactDatasetId
    if (datasetId) {
      emitDatasetSync({ datasetId, reason: "artifact", source: "deleteArtifact" })
    }
    return result
  }
  const map = readLocalMap()
  const id = String(artifactId)
  if (map[id]) {
    const datasetId = String(map[id].datasetId || "")
    delete map[id]
    writeLocalMap(map)
    try {
      await idbDel(id, localBlobStore)
    } catch {
    }
    if (datasetId) {
      emitDatasetSync({ datasetId, reason: "artifact", source: "deleteArtifact:local" })
    }
    return { success: true, data: { success: true } }
  }
  return result
}

/**
 * 更新附件元数据
 * @param artifactId 附件 ID
 * @param metadata 元数据
 */
export async function updateArtifactMetadata(
  artifactId: string,
  metadata: Record<string, any>
): Promise<ApiResponse<Artifact>> {
  return eoapiPost<Artifact>(`/artifacts/${artifactId}/metadata`, metadata)
}

/**
 * 关联附件到数据集/版本
 * @param artifactId 附件 ID
 * @param params 关联参数
 */
export async function linkArtifactToDataset(
  artifactId: string,
  params: {
    datasetId?: string
    revisionId?: string
    jobId?: string
  }
): Promise<ApiResponse<{ success: boolean }>> {
  const result = await eoapiPost<{ success: boolean }>(`/artifacts/${artifactId}/link`, params)
  if (result.success) {
    if (params.datasetId) {
      emitDatasetSync({ datasetId: params.datasetId, reason: "artifact", source: "linkArtifactToDataset" })
    }
    return result
  }
  const map = readLocalMap()
  const id = String(artifactId)
  const record = map[id]
  if (!record) {
    return result
  }
  record.datasetId = params.datasetId
  record.revisionId = params.revisionId
  record.jobId = params.jobId
  record.metadata = { ...(record.metadata || {}), linkedAt: Date.now() }
  map[id] = record
  writeLocalMap(map)
  if (params.datasetId) {
    emitDatasetSync({ datasetId: params.datasetId, reason: "artifact", source: "linkArtifactToDataset:local" })
  }
  return { success: true, data: { success: true } }
}

// ============ 辅助函数 ============

/**
 * 创建封面截图附件
 * @param datasetId 数据集 ID
 * @param imageBlob 图片 Blob
 * @param revisionId 版本 ID（可选）
 */
export async function uploadThumbnail(
  datasetId: string,
  imageBlob: Blob,
  revisionId?: string
): Promise<ApiResponse<UploadArtifactResponse>> {
  const type = imageBlob.type || "image/png"
  const ext = type === "image/jpeg" ? "jpg" : "png"
  const file = new File([imageBlob], `thumbnail.${ext}`, { type })

  return smartUploadArtifact({
    file,
    name: "封面截图",
    type: "thumbnail",
    datasetId,
    revisionId
  })
}

/**
 * 创建导出文件附件
 * @param jobId 任务 ID
 * @param file 导出文件
 * @param name 文件名称
 */
export async function uploadExportFile(
  jobId: string,
  file: File,
  name: string
): Promise<ApiResponse<UploadArtifactResponse>> {
  return smartUploadArtifact({
    file,
    name,
    type: "export",
    jobId
  })
}

/**
 * 获取附件类型显示名称
 * @param type 附件类型
 */
export function getArtifactTypeName(type: ArtifactType): string {
  const names: Record<ArtifactType, string> = {
    thumbnail: "封面截图",
    report: "报告文档",
    export: "导出文件",
    log: "日志文件",
    data: "数据文件",
    other: "其他"
  }
  return names[type] || type
}

/**
 * 获取附件类型图标
 * @param type 附件类型
 */
export function getArtifactTypeIcon(type: ArtifactType): string {
  const icons: Record<ArtifactType, string> = {
    thumbnail: "image",
    report: "file-text",
    export: "download",
    log: "logs",
    data: "database",
    other: "file"
  }
  return icons[type] || "file"
}

/**
 * 格式化附件大小显示
 * @param bytes 字节数
 */
export function formatArtifactSize(bytes?: number): string {
  if (!bytes) {
    return ""
  }

  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

export default {
  getArtifacts,
  getArtifact,
  getArtifactDownloadUrl,
  getPresignedUploadUrl,
  initChunkedUpload,
  getChunkedUploadStatus,
  cancelChunkedUpload,
  uploadToPresignedUrl,
  uploadArtifactInChunks,
  uploadArtifact,
  smartUploadArtifact,
  deleteArtifact,
  updateArtifactMetadata,
  linkArtifactToDataset,
  uploadThumbnail,
  uploadExportFile,
  getArtifactTypeName,
  getArtifactTypeIcon,
  formatArtifactSize
}
