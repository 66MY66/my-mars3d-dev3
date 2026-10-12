import type { ApiResponse, EoapiDataset, EoapiRevision, Manifest } from "../types/eoapi-types"
import { eoapiGet, eoapiPost } from "./eoapi-client"

type AnyRecord = Record<string, any>

function normalizeDataset(raw: any): EoapiDataset {
  const r: AnyRecord = raw || {}
  const datasetId = String(r.datasetId || r.id || "")
  const name = String(r.name || r.title || datasetId)
  let tags: any[] | undefined
  if (Array.isArray(r.tags)) {
    tags = r.tags
  } else if (Array.isArray(r.keywords)) {
    tags = r.keywords
  }
  return {
    datasetId,
    name,
    description: typeof r.description === "string" ? r.description : undefined,
    visibility: r.visibility,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
    tags
  }
}

function normalizeRevision(raw: any): EoapiRevision {
  const r: AnyRecord = raw || {}
  const revisionId = String(r.revisionId || r.id || "")
  let message: string | undefined
  if (typeof r.message === "string") {
    message = r.message
  } else if (typeof r.description === "string") {
    message = r.description
  }
  return {
    revisionId,
    message,
    createdAt: r.createdAt ?? r.created_at ?? r.time
  }
}

export async function getDatasets(params?: { scope?: string; q?: string; limit?: number }): Promise<ApiResponse<EoapiDataset[]>> {
  const res = await eoapiGet<any>("/datasets", params)
  if (res.success) {
    const data: any = res.data
    let list: any[] = []
    if (Array.isArray(data)) {
      list = data
    } else if (Array.isArray(data?.items)) {
      list = data.items
    } else if (Array.isArray(data?.datasets)) {
      list = data.datasets
    }
    return { success: true, data: list.map(normalizeDataset) }
  }

  const stac = await eoapiGet<any>("/collections", { limit: params?.limit || 50 })
  if (!stac.success) {
    return res
  }
  let list: any[] = []
  if (Array.isArray(stac.data?.collections)) {
    list = stac.data.collections
  } else if (Array.isArray(stac.data)) {
    list = stac.data
  }
  return { success: true, data: list.map(normalizeDataset) }
}

export async function getDataset(datasetId: string): Promise<ApiResponse<EoapiDataset>> {
  const id = String(datasetId || "").trim()
  const res = await eoapiGet<any>(`/datasets/${encodeURIComponent(id)}`)
  if (res.success && res.data) {
    return { success: true, data: normalizeDataset(res.data) }
  }
  const stac = await eoapiGet<any>(`/collections/${encodeURIComponent(id)}`)
  if (stac.success && stac.data) {
    return { success: true, data: normalizeDataset(stac.data) }
  }
  return { success: false, message: res.message || stac.message || "加载失败", code: res.code || stac.code }
}

export async function getRevisions(datasetId: string): Promise<ApiResponse<EoapiRevision[]>> {
  const id = String(datasetId || "").trim()
  const res = await eoapiGet<any>(`/datasets/${encodeURIComponent(id)}/revisions`)
  if (res.success) {
    const data: any = res.data
    let list: any[] = []
    if (Array.isArray(data)) {
      list = data
    } else if (Array.isArray(data?.items)) {
      list = data.items
    } else if (Array.isArray(data?.revisions)) {
      list = data.revisions
    }
    return { success: true, data: list.map(normalizeRevision) }
  }

  const stac = await eoapiGet<any>(`/collections/${encodeURIComponent(id)}/items`, { limit: 50 })
  if (!stac.success) {
    return res
  }
  let list: any[] = []
  if (Array.isArray(stac.data?.features)) {
    list = stac.data.features
  } else if (Array.isArray(stac.data)) {
    list = stac.data
  }
  return { success: true, data: list.map((it: any) => normalizeRevision({ id: it?.id, createdAt: it?.properties?.datetime })) }
}

export async function getRevisionManifest(datasetId: string, revisionId: string): Promise<ApiResponse<Manifest>> {
  const did = String(datasetId || "").trim()
  const rid = String(revisionId || "").trim()
  const res = await eoapiGet<Manifest>(`/datasets/${encodeURIComponent(did)}/revisions/${encodeURIComponent(rid)}/manifest`)
  if (res.success) {
    return res
  }
  const alt = await eoapiGet<Manifest>(`/datasets/${encodeURIComponent(did)}/revisions/${encodeURIComponent(rid)}/manifest.json`)
  if (alt.success) {
    return alt
  }
  return res
}

export async function createDataset(body: {
  name: string
  description?: string
  visibility?: string
  tags?: string[]
}): Promise<ApiResponse<EoapiDataset>> {
  const res = await eoapiPost<any>("/datasets", body)
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  return { success: true, data: normalizeDataset(res.data) }
}

export async function createRevision(
  datasetId: string,
  body: { message?: string; manifest: Manifest; artifacts?: any[] }
): Promise<ApiResponse<EoapiRevision>> {
  const did = String(datasetId || "").trim()
  if (!did) {
    return { success: false, message: "datasetId 不能为空" }
  }
  const res = await eoapiPost<any>(`/datasets/${encodeURIComponent(did)}/revisions`, body)
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  const raw = res.data
  const rev = raw?.revision ? raw.revision : raw
  return { success: true, data: normalizeRevision(rev) }
}

export async function setDatasetShare(datasetId: string, body: { visibility: string }): Promise<ApiResponse<any>> {
  const did = String(datasetId || "").trim()
  if (!did) {
    return { success: false, message: "datasetId 不能为空" }
  }
  const res = await eoapiPost<any>(`/datasets/${encodeURIComponent(did)}/share`, body)
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  return { success: true, data: res.data }
}

export async function forkDataset(datasetId: string, body: { revisionId?: string; name?: string }): Promise<ApiResponse<EoapiDataset>> {
  const did = String(datasetId || "").trim()
  if (!did) {
    return { success: false, message: "datasetId 不能为空" }
  }
  const res = await eoapiPost<any>(`/datasets/${encodeURIComponent(did)}/fork`, body)
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  return { success: true, data: normalizeDataset(res.data) }
}
