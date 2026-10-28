/**
 * eoAPI STAC 服务 + 成果管理 API
 * @description 符合 STAC 规范的 API 调用 + eoAPI 数据集版本管理
 */

import { eoapiDelete, eoapiGet, eoapiPost } from "./eoapi-client"
import { emitDatasetSync } from "./dataset-sync"
import { resolveRasterStyleProfile } from "./layer-style-defaults"
import {
  StacCollection,
  StacItem,
  StacCollectionsResponse,
  StacItemsResponse,
  ApiResponse,
  Manifest,
  DatasetVisibility
} from "../types/eoapi-types"
import { pickManifestHrefFromStacItem } from "./manifest-resolver"
import { setPersistedDatasetCover } from "./cover-cache"
import { eoApiConfig } from "./eoapi-config"

// ============ Collection (数据集) API ============

/**
 * 获取所有 Collections
 */
export async function getCollections(params?: {
  bbox?: [number, number, number, number]
  limit?: number
}): Promise<ApiResponse<StacCollection[]>> {
  const result = await eoapiGet<StacCollectionsResponse>("/collections", { params })

  if (result.success && result.data) {
    return {
      success: true,
      data: result.data.collections || []
    }
  }

  return {
    success: false,
    message: result.message || "获取数据集列表失败"
  }
}

function getNextLinkHref(links: any[] | undefined | null): string | null {
  const list = Array.isArray(links) ? links : []
  const next = list.find((l: any) => String(l?.rel || "").toLowerCase() === "next" && typeof l?.href === "string")
  return next?.href ? String(next.href) : null
}

function normalizeStacHrefToProxy(href: string): string {
  const raw = String(href || "").trim()
  if (!raw) {
    return ""
  }
  const prefix = String(eoApiConfig.apiPrefix || "").replace(/\/+$/, "")
  if (prefix && raw.startsWith(prefix)) {
    const rest = raw.slice(prefix.length)
    return rest || "/"
  }
  if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
    try {
      const url = new URL(raw.startsWith("//") ? `http:${raw}` : raw)
      const path = `${url.pathname || ""}${url.search || ""}`
      if (prefix && path.startsWith(prefix)) {
        const rest = path.slice(prefix.length)
        return rest || "/"
      }
      return path
    } catch {
      return raw
    }
  }
  return raw
}

export async function getCollectionsAll(params?: {
  bbox?: [number, number, number, number]
  limit?: number
}): Promise<ApiResponse<StacCollection[]>> {
  const all: StacCollection[] = []
  const firstLimit = typeof params?.limit === "number" ? params!.limit! : 200

  let nextUrl: string | null = "/collections"
  let isFirst = true
  let guard = 0

  while (nextUrl && guard < 200) {
    guard += 1
    const res = await eoapiGet<StacCollectionsResponse>(nextUrl, isFirst ? { params: { ...params, limit: firstLimit } } : undefined)
    isFirst = false
    if (!res.success || !res.data) {
      return res as any
    }
    const cols = Array.isArray(res.data.collections) ? res.data.collections : []
    all.push(...cols)
    const nextHref = getNextLinkHref(res.data.links)
    nextUrl = nextHref ? normalizeStacHrefToProxy(nextHref) : null
  }

  return { success: true, data: all }
}

/**
 * 获取单个 Collection 详情
 */
export async function getCollection(collectionId: string): Promise<ApiResponse<StacCollection>> {
  if (collectionId.startsWith("local_")) {
    try {
      const saved = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
      const dataset = saved?.[collectionId]
      if (!dataset) {
        return { success: false, code: 404, message: "未找到本地数据集" }
      }
      const manifest = dataset?.manifest as Manifest | undefined
      const bbox =
        Array.isArray((manifest as any)?.viewState?.bbox) && (manifest as any).viewState.bbox.length === 4
          ? ((manifest as any).viewState.bbox as [number, number, number, number])
          : ([0, 0, 0, 0] as [number, number, number, number])

      const out: StacCollection = {
        id: collectionId,
        type: "Collection",
        title: String(dataset?.name || collectionId),
        description: String(dataset?.description || "本地保存的数据集"),
        keywords: ["本地"],
        license: "local",
        extent: {
          spatial: { bbox: [bbox] },
          temporal: { interval: [[null, null]] as any }
        } as any,
        links: [],
        summaries: {
          visibility: dataset?.visibility || "private",
          source: "localStorage",
          createdAt: Number(dataset?.createdAt) || Date.now(),
          updatedAt: Number(dataset?.updatedAt) || undefined,
          createdBy: typeof dataset?.createdBy === "string" ? dataset.createdBy : undefined,
          owner: typeof dataset?.owner === "string" ? dataset.owner : undefined,
          coverUrl: dataset?.coverUrl,
          parentDatasetId: dataset?.parentDatasetId,
          sourceDatasetId: dataset?.sourceDatasetId,
          sourceRevisionId: dataset?.sourceRevisionId
        } as any
      }
      return { success: true, data: out }
    } catch {
      return { success: false, code: 404, message: "未找到本地数据集" }
    }
  }
  const result = await eoapiGet<StacCollection>(`/collections/${collectionId}`)
  const draft = remoteDatasetDrafts.get(collectionId)
  if (result.success && result.data && draft) {
    result.data = {
      ...result.data,
      description: draft.description ?? result.data.description,
      keywords: draft.tags ?? result.data.keywords,
      summaries: { ...(result.data.summaries || {}), updatedAt: draft.updatedAt || result.data.summaries?.updatedAt }
    }
  }
  return result
}

// ============ Item (条目/产品) API ============

function extractDatasetApiRevisionRows(payload: any): any[] {
  if (!payload) {
    return []
  }
  if (Array.isArray(payload)) {
    return payload
  }
  const revisions = (payload as any)?.revisions
  if (Array.isArray(revisions)) {
    return revisions
  }
  const items = (payload as any)?.items
  if (Array.isArray(items)) {
    return items
  }
  const data = (payload as any)?.data
  if (Array.isArray(data)) {
    return data
  }
  return []
}

function normalizeDatasetApiRevisionRowToStacItem(collectionId: string, row: any): StacItem | null {
  const revisionId = String(row?.revisionId || row?.id || "").trim()
  if (!revisionId) {
    return null
  }
  const createdAtMs = (() => {
    const v = row?.createdAtMs ?? row?.created_at_ms ?? row?.createdAt ?? row?.created_at
    const n = typeof v === "string" ? Date.parse(v) : Number(v)
    return Number.isFinite(n) ? n : Date.now()
  })()
  const message = typeof row?.message === "string" && row.message.trim() ? row.message.trim() : revisionId
  const manifestHref = `/datasets/${encodeURIComponent(collectionId)}/revisions/${encodeURIComponent(revisionId)}/manifest`

  return {
    type: "Feature",
    id: revisionId,
    collection: collectionId,
    geometry: null,
    properties: {
      datetime: new Date(createdAtMs).toISOString(),
      title: message
    },
    links: [{ rel: "manifest", href: manifestHref }],
    assets: {
      manifest: {
        href: manifestHref,
        title: "manifest",
        type: "application/json",
        roles: ["metadata"]
      } as any
    }
  } as any
}

export function normalizeDatasetApiRevisionsToStacItems(
  collectionId: string,
  payload: any
): { items: StacItem[]; total?: number } {
  const rows = extractDatasetApiRevisionRows(payload)
  const items = rows
    .map((r) => normalizeDatasetApiRevisionRowToStacItem(collectionId, r))
    .filter(Boolean) as StacItem[]
  const totalRaw = (payload as any)?.total ?? (payload as any)?.count
  const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : undefined
  return { items, total }
}

async function tryGetDatasetApiRevisionsPage(
  collectionId: string,
  params?: { limit?: number; offset?: number }
): Promise<ApiResponse<{ items: StacItem[]; total?: number }>> {
  const res = await eoapiGet<any>(`/datasets/${collectionId}/revisions`, { params })
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  return { success: true, data: normalizeDatasetApiRevisionsToStacItems(collectionId, res.data) }
}

/**
 * 获取 Collection 中的 Items
 */
export async function getItems(
  collectionId: string,
  params?: {
    limit?: number
    offset?: number
    bbox?: [number, number, number, number]
    datetime?: string
  }
): Promise<ApiResponse<StacItem[]>> {
  if (collectionId.startsWith("local_")) {
    try {
      const saved = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
      const dataset = saved?.[collectionId]
      const rawRevisions = Array.isArray(dataset?.revisions) ? dataset.revisions : []
      const byId = new Map<string, any>()
      for (const r of rawRevisions) {
        const rid = String(r?.revisionId || "")
        if (!rid) {
          continue
        }
        const nextAt = Number(r?.createdAt) || 0
        const prev = byId.get(rid)
        if (!prev) {
          byId.set(rid, r)
          continue
        }
        const prevAt = Number(prev?.createdAt) || 0
        if (nextAt >= prevAt) {
          byId.set(rid, r)
        }
      }
      const revisions = Array.from(byId.values()).sort((a, b) => (Number(b?.createdAt) || 0) - (Number(a?.createdAt) || 0))
      const manifest = dataset?.manifest as Manifest | undefined
      const bbox =
        Array.isArray((manifest as any)?.viewState?.bbox) && (manifest as any).viewState.bbox.length === 4
          ? ((manifest as any).viewState.bbox as [number, number, number, number])
          : ([0, 0, 0, 0] as [number, number, number, number])

      const items: StacItem[] = revisions.map((r: any, idx: number) => {
        const createdAt = Number(r?.createdAt) || Date.now()
        const revisionId = String(r?.revisionId || `rev_${createdAt}_${idx}`)
        const revisionManifest = dataset?.revisionManifests?.[revisionId] as Manifest | undefined
        const revisionLayers = Array.isArray((revisionManifest as any)?.layers) ? (revisionManifest as any).layers : []
        const geoLayer = revisionLayers.find((layer: any) => String(layer?.sourceType || "") === "geojson" && layer?.sourceRef)
        const tileLayer = revisionLayers.find((layer: any) => {
          const sourceType = String(layer?.sourceType || "")
          return ["xyz", "wmts", "tms", "tile"].includes(sourceType) && /\{z\}/.test(String(layer?.sourceRef || ""))
        })
        const revisionBbox = Array.isArray((revisionManifest as any)?.viewState?.bbox) && (revisionManifest as any).viewState.bbox.length === 4
          ? (revisionManifest as any).viewState.bbox
          : bbox
        const assets: Record<string, any> = {}
        if (geoLayer) {
          assets.data = {
            href: String(geoLayer.sourceRef),
            type: "application/geo+json",
            title: String(geoLayer.name || revisionId),
            roles: ["data"]
          }
        }
        if (tileLayer) {
          assets.visual = {
            href: String(tileLayer.sourceRef),
            type: "image/jpeg",
            title: String(tileLayer.name || revisionId),
            roles: ["visual"]
          }
        }
        return {
          type: "Feature",
          id: revisionId,
          bbox: revisionBbox,
          geometry: null as any,
          properties: {
            datetime: new Date(createdAt).toISOString(),
            title: String(r?.message || revisionId)
          } as any,
          links: [],
          assets
        } as any
      })

      const limit = typeof params?.limit === "number" ? Math.max(1, Math.floor(params!.limit!)) : items.length
      const offset = typeof params?.offset === "number" ? Math.max(0, Math.floor(params!.offset!)) : 0
      const sliced = items.slice(offset, offset + limit)
      return { success: true, data: sliced, code: sliced.length }
    } catch {
      return { success: true, data: [], code: 0 }
    }
  }

  const apiRes = await tryGetDatasetApiRevisionsPage(collectionId, {
    limit: params?.limit,
    offset: params?.offset
  })
  if (apiRes.success && apiRes.data) {
    return { success: true, data: apiRes.data.items, code: apiRes.data.items.length }
  }

  const result = await eoapiGet<StacItemsResponse>(
    `/collections/${collectionId}/items`,
    { params }
  )

  if (result.success && result.data) {
    return {
      success: true,
      data: result.data.features || [],
      code: result.data.numberReturned
    }
  }

  return {
    success: false,
    message: result.message || "获取条目列表失败"
  }
}

export async function getItemsAll(
  collectionId: string,
  params?: {
    limit?: number
    bbox?: [number, number, number, number]
    datetime?: string
  }
): Promise<ApiResponse<StacItem[]>> {
  if (collectionId.startsWith("local_")) {
    return getItems(collectionId, { limit: params?.limit })
  }

  const apiAll: StacItem[] = []
  const apiFirstLimit = typeof params?.limit === "number" ? Math.max(1, Math.floor(params.limit)) : 200
  let apiOffset = 0
  let apiGuard = 0
  while (apiGuard < 400) {
    apiGuard += 1
    const apiRes = await tryGetDatasetApiRevisionsPage(collectionId, { limit: apiFirstLimit, offset: apiOffset })
    if (!apiRes.success) {
      if (apiRes.code === 404) {
        break
      }
      apiOffset = 0
      apiAll.length = 0
      break
    }
    const pageItems = apiRes.data?.items || []
    if (!pageItems.length) {
      break
    }
    apiAll.push(...pageItems)
    apiOffset += pageItems.length
    if (pageItems.length < apiFirstLimit) {
      break
    }
    const total = apiRes.data?.total
    if (typeof total === "number" && apiOffset >= total) {
      break
    }
  }
  if (apiAll.length) {
    const byId = new Map<string, StacItem>()
    for (const it of apiAll) {
      const id = String((it as any)?.id || "")
      if (!id) {
        continue
      }
      if (!byId.has(id)) {
        byId.set(id, it)
      }
    }
    const toMs = (x: any) => {
      const dt = x?.properties?.datetime
      const n = Date.parse(String(dt || ""))
      return Number.isFinite(n) ? n : 0
    }
    const uniq = Array.from(byId.values()).sort((a, b) => toMs(b) - toMs(a))
    return { success: true, data: uniq, code: uniq.length }
  }

  const all: StacItem[] = []
  const firstLimit = typeof params?.limit === "number" ? params!.limit! : 200

  let nextUrl: string | null = `/collections/${encodeURIComponent(collectionId)}/items`
  let isFirst = true
  let guard = 0

  while (nextUrl && guard < 400) {
    guard += 1
    const res = await eoapiGet<StacItemsResponse>(nextUrl, isFirst ? { params: { ...params, limit: firstLimit } } : undefined)
    isFirst = false
    if (!res.success || !res.data) {
      return { success: false, message: res.message || "获取条目列表失败", code: res.code }
    }
    const feats = Array.isArray(res.data.features) ? res.data.features : []
    all.push(...feats)
    const nextHref = getNextLinkHref(res.data.links)
    nextUrl = nextHref ? normalizeStacHrefToProxy(nextHref) : null
  }

  const byId = new Map<string, StacItem>()
  for (const it of all) {
    const id = String((it as any)?.id || "")
    if (!id) {
      continue
    }
    if (!byId.has(id)) {
      byId.set(id, it)
    }
  }
  const toMs = (x: any) => {
    const dt = x?.properties?.datetime
    const n = Date.parse(String(dt || ""))
    return Number.isFinite(n) ? n : 0
  }
  const uniq = Array.from(byId.values()).sort((a, b) => toMs(b) - toMs(a))
  return { success: true, data: uniq, code: uniq.length }
}

/**
 * 获取单个 Item 详情
 */
export async function getItem(
  collectionId: string,
  itemId: string
): Promise<ApiResponse<StacItem>> {
  if (collectionId.startsWith("local_")) {
    try {
      const saved = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
      const dataset = saved?.[collectionId]
      const revisions = Array.isArray(dataset?.revisions) ? dataset.revisions : []
      const found = revisions.find((r: any) => String(r?.revisionId || "") === String(itemId)) || null
      const manifest = dataset?.manifest as Manifest | undefined
      const bbox =
        Array.isArray((manifest as any)?.viewState?.bbox) && (manifest as any).viewState.bbox.length === 4
          ? ((manifest as any).viewState.bbox as [number, number, number, number])
          : ([0, 0, 0, 0] as [number, number, number, number])
      const createdAt = Number(found?.createdAt) || Date.now()
      const out: StacItem = {
        type: "Feature",
        id: String(itemId),
        bbox,
        geometry: null as any,
        properties: {
          datetime: new Date(createdAt).toISOString(),
          title: String(found?.message || itemId)
        } as any,
        links: [],
        assets: {}
      } as any
      return { success: true, data: out }
    } catch {
      return { success: false, code: 404, message: "未找到本地版本信息" }
    }
  }
  return eoapiGet<StacItem>(`/collections/${collectionId}/items/${itemId}`)
}

// ============ Search API ============

/**
 * 搜索 Items
 */
export async function searchItems(params: {
  collections?: string[]
  bbox?: [number, number, number, number]
  datetime?: string
  limit?: number
  query?: Record<string, any>
}): Promise<ApiResponse<StacItem[]>> {
  const searchParams: Record<string, any> = {}

  if (params.collections) {
    searchParams.collections = params.collections.join(",")
  }
  if (params.bbox) {
    searchParams.bbox = params.bbox.join(",")
  }
  if (params.datetime) {
    searchParams.datetime = params.datetime
  }
  if (params.limit) {
    searchParams.limit = params.limit
  }
  if (params.query) {
    searchParams.query = JSON.stringify(params.query)
  }

  const result = await eoapiGet<StacItemsResponse>("/search", { params: searchParams })

  if (result.success && result.data) {
    return {
      success: true,
      data: result.data.features || []
    }
  }

  return {
    success: false,
    message: result.message || "搜索失败"
  }
}

// ============ 兼容旧代码的函数别名 ============

/** 获取数据集列表 (映射到 getCollections) */
export const getDatasets = getCollections

/** 获取数据集详情 (映射到 getCollection) */
export const getDataset = getCollection

/** 获取版本列表 (映射到 getItems) */
export const getRevisions = getItems

/** 获取版本详情 (映射到 getItem) */
export const getRevision = getItem

// ============ eoAPI 数据集版本管理 API ============

/**
 * 创建数据集请求参数
 */
export interface CreateDatasetParams {
  name: string
  description?: string
  visibility?: DatasetVisibility
  tags?: string[]
}

/**
 * 创建数据集响应
 */
export interface CreateDatasetResponse {
  datasetId: string
  name: string
  visibility: DatasetVisibility
  createdAt: number
}

/**
 * 创建版本请求参数
 */
export interface CreateRevisionParams {
  /** 版本说明 */
  message?: string
  /** 成果包 */
  manifest: Manifest
  /** 附件引用列表 */
  artifactRefs?: string[]
}

/**
 * 创建版本响应
 */
export interface CreateRevisionResponse {
  revisionId: string
  datasetId: string
  message?: string
  createdAt: number
  manifestUrl?: string
}

export interface DeleteDatasetResponse {
  success: boolean
  deletedArtifactCount?: number
}

export interface DeleteRevisionResponse {
  success: boolean
  deletedArtifactCount?: number
}

/**
 * 共享设置参数
 */
export interface ShareParams {
  visibility: DatasetVisibility
  /** 允许派生 */
  allowFork?: boolean
  /** 允许查看 */
  allowView?: boolean
}

/**
 * 派生响应
 */
export interface ForkResponse {
  datasetId: string
  sourceDatasetId: string
  sourceRevisionId: string
  createdAt: number
}

export interface LineageNode {
  id: string
  name?: string
  createdAt?: number
  forkedAt?: number
}

export interface DatasetLineageResponse {
  datasetId: string
  parent?: LineageNode | null
  sources: LineageNode[]
  forks: LineageNode[]
}

let datasetsRevisionApiAvailable: boolean | null = null

async function ensureDatasetsRevisionApiAvailable(): Promise<boolean> {
  if (datasetsRevisionApiAvailable !== null) {
    return datasetsRevisionApiAvailable
  }

  const probe = await eoapiGet<any>("/datasets")
  if (probe.success) {
    // 检查返回的数据是否是有效的数组（即使是空数组也认为 API 可用）
    // 但需要区分：API 存在但无数据 vs API 不存在
    const isValidResponse = probe.data !== undefined && (Array.isArray(probe.data) || typeof probe.data === "object")
    datasetsRevisionApiAvailable = isValidResponse
    return isValidResponse
  }

  if (probe.code === 404) {
    datasetsRevisionApiAvailable = false
    return false
  }

  if (probe.code === 401 || probe.code === 403) {
    datasetsRevisionApiAvailable = true
    return true
  }

  return true
}

/**
 * 创建新数据集
 * @param params 数据集参数
 */
export async function createDataset(
  params: CreateDatasetParams
): Promise<ApiResponse<CreateDatasetResponse>> {
  return eoapiPost<CreateDatasetResponse>("/datasets", {
    name: params.name,
    description: params.description,
    visibility: params.visibility || "private",
    tags: params.tags || []
  })
}

/**
 * 保存成果为数据集新版本
 * @param datasetId 数据集 ID
 * @param params 版本参数（包含 manifest）
 */
export async function createRevision(
  datasetId: string,
  params: CreateRevisionParams
): Promise<ApiResponse<CreateRevisionResponse>> {
  const result = await eoapiPost<CreateRevisionResponse>(
    `/datasets/${datasetId}/revisions`,
    {
      message: params.message,
      manifest: params.manifest,
      artifactRefs: params.artifactRefs
    }
  )
  if (result.success) {
    emitDatasetSync({ datasetId, reason: "revision", source: "createRevision" })
  }
  return result
}

export async function deleteDataset(datasetId: string): Promise<ApiResponse<DeleteDatasetResponse>> {
  if (!datasetId) {
    return {
      success: false,
      message: "缺少数据集 ID"
    }
  }

  if (datasetId.startsWith("local_")) {
    const ok = deleteLocalManifest(datasetId)
    if (ok) {
      emitDatasetSync({ datasetId, reason: "delete", source: "deleteDataset:local" })
      return {
        success: true,
        data: { success: true }
      }
    }
    return {
      success: false,
      message: "删除本地成果失败"
    }
  }

  const result = await eoapiDelete<DeleteDatasetResponse>(`/datasets/${datasetId}`)
  if (result.success) {
    emitDatasetSync({ datasetId, reason: "delete", source: "deleteDataset" })
  }
  return result
}

export async function saveDatasetRevision(
  datasetId: string,
  params: CreateRevisionParams
): Promise<ApiResponse<CreateRevisionResponse>> {
  if (datasetId.startsWith("local_")) {
    const ok = updateLocalDataset(datasetId, {
      manifest: params.manifest,
      createNewVersion: true,
      message: params.message || "更新"
    })
    if (!ok) {
      return { success: false, message: "本地保存失败" }
    }
    const ds = getLocalDataset(datasetId) as any
    const latest = Array.isArray(ds?.revisions) && ds.revisions.length ? ds.revisions[0] : null
    return {
      success: true,
      data: {
        datasetId,
        revisionId: String(latest?.revisionId || ""),
        message: params.message,
        createdAt: Number(latest?.createdAt) || Date.now()
      }
    }
  }

  const canUseDatasetsApi = await ensureDatasetsRevisionApiAvailable()
  if (!canUseDatasetsApi) {
    return { success: false, code: 404, message: "后端未提供版本管理 API" }
  }
  return createRevision(datasetId, params)
}

export async function deleteDatasetRevision(
  datasetId: string,
  revisionId: string
): Promise<ApiResponse<DeleteRevisionResponse>> {
  if (!datasetId || !revisionId) {
    return { success: false, message: "缺少版本信息" }
  }

  if (datasetId.startsWith("local_")) {
    try {
      const savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
      const dataset = savedManifests[datasetId]
      if (!dataset) {
        return { success: false, code: 404, message: "未找到本地数据集" }
      }
      const revisions = Array.isArray(dataset.revisions) ? dataset.revisions : []
      if (revisions.length <= 1) {
        return { success: false, code: 409, message: "至少保留一个版本" }
      }
      const nextRevisions = revisions.filter((r: any) => String(r?.revisionId || "") !== revisionId)
      if (nextRevisions.length === revisions.length) {
        return { success: false, code: 404, message: "未找到目标版本" }
      }
      dataset.revisions = nextRevisions
      if (dataset.revisionManifests && typeof dataset.revisionManifests === "object") {
        delete dataset.revisionManifests[revisionId]
        const latestRevisionId = String(nextRevisions[0]?.revisionId || "")
        if (latestRevisionId && dataset.revisionManifests[latestRevisionId]) {
          dataset.manifest = dataset.revisionManifests[latestRevisionId]
        }
      }
      dataset.updatedAt = Date.now()
      savedManifests[datasetId] = dataset
      localStorage.setItem("eoapi_manifests", JSON.stringify(savedManifests))
      emitDatasetSync({ datasetId, reason: "revision", source: "deleteDatasetRevision:local" })
      return { success: true, data: { success: true, deletedArtifactCount: 0 } }
    } catch {
      return { success: false, message: "删除本地版本失败" }
    }
  }

  const result = await eoapiDelete<DeleteRevisionResponse>(`/datasets/${datasetId}/revisions/${revisionId}`)
  if (result.success) {
    emitDatasetSync({ datasetId, reason: "revision", source: "deleteDatasetRevision" })
  }
  return result
}

export async function rollbackDatasetRevision(
  datasetId: string,
  targetRevisionId: string,
  message?: string
): Promise<ApiResponse<CreateRevisionResponse>> {
  const manRes = await getRevisionManifest(datasetId, targetRevisionId)
  if (!manRes.success || !manRes.data) {
    return { success: false, code: manRes.code, message: manRes.message || "无法获取目标版本成果包" }
  }
  return saveDatasetRevision(datasetId, {
    message: message || `回滚到 ${targetRevisionId}`,
    manifest: manRes.data
  })
}

/**
 * 设置数据集共享策略
 * @param datasetId 数据集 ID
 * @param params 共享参数
 */
export async function setDatasetShare(
  datasetId: string,
  params: ShareParams
): Promise<ApiResponse<{ success: boolean }>> {
  const result = await eoapiPost<{ success: boolean }>(
    `/datasets/${datasetId}/share`,
    params
  )

  // 如果 API 不可用，保存到本地存储
  if (!result.success && result.code === 404) {
    const savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
    const dataset = savedManifests[datasetId]

    if (dataset) {
      dataset.visibility = params.visibility
      dataset.permissions = {
        allowFork: params.allowFork,
        allowView: params.allowView
      }
      dataset.updatedAt = Date.now()
      localStorage.setItem("eoapi_manifests", JSON.stringify(savedManifests))
      emitDatasetSync({ datasetId, reason: "share", source: "setDatasetShare:local" })

      return {
        success: true,
        data: { success: true }
      }
    }

    return {
      success: false,
      message: "未找到本地数据集"
    }
  }

  if (result.success) {
    emitDatasetSync({ datasetId, reason: "share", source: "setDatasetShare" })
  }
  return result
}

export async function submitDatasetPublishRequest(
  datasetId: string
): Promise<ApiResponse<{ success: boolean }>> {
  const result = await eoapiPost<{ success: boolean }>(`/datasets/${encodeURIComponent(datasetId)}/publish-request`, {})
  if (result.success) {
    emitDatasetSync({ datasetId, reason: "share", source: "submitDatasetPublishRequest" })
  }
  return result
}

export async function cancelDatasetPublishRequest(
  datasetId: string
): Promise<ApiResponse<{ success: boolean }>> {
  const result = await eoapiPost<{ success: boolean }>(`/datasets/${encodeURIComponent(datasetId)}/cancel-request`, {})
  if (result.success) {
    emitDatasetSync({ datasetId, reason: "share", source: "cancelDatasetPublishRequest" })
  }
  return result
}

export async function withdrawDatasetPublish(
  datasetId: string
): Promise<ApiResponse<{ success: boolean }>> {
  const result = await eoapiPost<{ success: boolean }>(`/datasets/${encodeURIComponent(datasetId)}/withdraw`, {})
  if (result.success) {
    emitDatasetSync({ datasetId, reason: "share", source: "withdrawDatasetPublish" })
  }
  return result
}

export async function getLatestDatasetManifest(
  datasetId: string
): Promise<ApiResponse<{ manifest: Manifest; revisionId?: string }>> {
  if (datasetId.startsWith("local_")) {
    const savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
    const dataset = savedManifests[datasetId]
    const manifest = dataset?.manifest as Manifest | undefined
    if (manifest) {
      const revisions = (Array.isArray(dataset?.revisions) ? [...dataset.revisions] : []).sort(
        (a, b) => (Number(b?.createdAt) || 0) - (Number(a?.createdAt) || 0)
      )
      const latest = revisions.length ? revisions[0] : null
      return { success: true, data: { manifest, revisionId: latest?.revisionId } }
    }
    return { success: false, code: 404, message: "未找到本地成果内容" }
  }

  const canUseDatasetsApi = await ensureDatasetsRevisionApiAvailable()
  if (!canUseDatasetsApi) {
    return { success: false, code: 404, message: "后端未提供版本管理 API" }
  }

  const listRes = await eoapiGet<any>(`/datasets/${datasetId}/revisions`, { params: { limit: 1, offset: 0 } })
  if (!listRes.success) {
    return { success: false, code: listRes.code, message: listRes.message || "获取版本列表失败" }
  }

  let rows: any[] = []
  if (Array.isArray(listRes.data)) {
    rows = listRes.data
  } else if (Array.isArray(listRes.data?.revisions)) {
    rows = listRes.data.revisions
  }

  const first = rows && rows.length ? rows[0] : null
  const revisionId = String(first?.revisionId || first?.id || "").trim()
  if (!revisionId) {
    return { success: false, code: 404, message: "未找到最新版本" }
  }

  const manRes = await getRevisionManifest(datasetId, revisionId)
  if (!manRes.success || !manRes.data) {
    return { success: false, code: manRes.code, message: manRes.message || "获取最新版本成果包失败" }
  }

  return { success: true, data: { manifest: manRes.data, revisionId } }
}

/**
 * 从指定版本派生新数据集（Fork）
 * @param datasetId 源数据集 ID
 * @param revisionId 源版本 ID（可选，默认最新版本）
 * @param newName 新数据集名称（可选）
 */
export async function forkDataset(
  datasetId: string,
  revisionId?: string,
  newName?: string
): Promise<ApiResponse<ForkResponse>> {
  const result = await eoapiPost<ForkResponse>(
    `/datasets/${datasetId}/fork`,
    {
      revisionId,
      newName
    }
  )

  // 如果 API 不可用，从本地存储派生
  if (!result.success && result.code === 404) {
    const savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
    const sourceDataset = savedManifests[datasetId]

    if (sourceDataset) {
      const resolvedRevisionId = String(revisionId || sourceDataset?.revisions?.[0]?.revisionId || "").trim()
      const revisionManifest =
        sourceDataset?.revisionManifests && typeof sourceDataset.revisionManifests === "object"
          ? sourceDataset.revisionManifests[resolvedRevisionId]
          : undefined
      const sourceManifest = revisionManifest || sourceDataset.manifest
      const forkedDatasetId = `local_${Date.now()}`
      const forkedRevisionId = `rev_${Date.now()}`

      // 创建派生副本
      savedManifests[forkedDatasetId] = {
        name: newName || `${sourceDataset.name} - 副本`,
        description: sourceDataset.description,
        visibility: "private",
        manifest: sourceManifest,
        revisionManifests: {
          [forkedRevisionId]: sourceManifest
        },
        revisions: [{
          revisionId: forkedRevisionId,
          message: "派生版本",
          createdAt: Date.now()
        }],
        parentDatasetId: datasetId,
        sourceDatasetId: sourceDataset.sourceDatasetId || datasetId,
        sourceRevisionId: resolvedRevisionId,
        createdAt: Date.now()
      }

      // 更新源数据集的派生记录
      if (!sourceDataset.forks) {
        sourceDataset.forks = []
      }
      sourceDataset.forks.push({
        datasetId: forkedDatasetId,
        name: newName || `${sourceDataset.name} - 副本`,
        createdAt: Date.now()
      })

      localStorage.setItem("eoapi_manifests", JSON.stringify(savedManifests))
      emitDatasetSync({ datasetId: forkedDatasetId, reason: "fork", source: "forkDataset:local" })

      return {
        success: true,
        data: {
          datasetId: forkedDatasetId,
          sourceDatasetId: datasetId,
          sourceRevisionId: resolvedRevisionId,
          createdAt: Date.now()
        }
      }
    }

    return {
      success: false,
      message: "未找到源数据集"
    }
  }

  if (result.success && result.data?.datasetId) {
    emitDatasetSync({ datasetId: result.data.datasetId, reason: "fork", source: "forkDataset" })
  }
  return result
}

export async function getDatasetLineage(datasetId: string): Promise<ApiResponse<DatasetLineageResponse>> {
  if (!datasetId) {
    return { success: false, message: "缺少数据集 ID" }
  }
  if (datasetId.startsWith("local_")) {
    return { success: false, code: 404, message: "本地数据集使用本地血缘信息" }
  }
  return eoapiGet<DatasetLineageResponse>(`/datasets/${datasetId}/lineage`)
}

/**
 * 获取版本的 manifest
 * @param datasetId 数据集 ID
 * @param revisionId 版本 ID
 */
export async function getRevisionManifest(
  datasetId: string,
  revisionId: string
): Promise<ApiResponse<Manifest>> {
  // 如果是本地存储的数据集
  if (datasetId.startsWith("local_")) {
    const savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
    const dataset = savedManifests[datasetId]

    const fromRevision = dataset?.revisionManifests?.[revisionId] as Manifest | undefined
    const fromLatest = dataset?.manifest as Manifest | undefined
    const picked = fromRevision || fromLatest
    if (dataset && picked) {
      return {
        success: true,
        data: picked
      }
    }

    return {
      success: false,
      message: "未找到本地成果"
    }
  }

  const canUseDatasetsApi = await ensureDatasetsRevisionApiAvailable()
  if (!canUseDatasetsApi) {
    const itemRes = await getItem(datasetId, revisionId)
    if (itemRes.success && itemRes.data) {
      const href = pickManifestHrefFromStacItem(itemRes.data)
      if (href) {
        const fromAsset = await eoapiGet<Manifest>(href)
        if (fromAsset.success && fromAsset.data) {
          return fromAsset
        }
      }
      const fallback = buildFallbackManifestFromStacItem(datasetId, itemRes.data)
      if (fallback) {
        return { success: true, data: fallback }
      }
      return {
        success: false,
        code: 404,
        message: "未找到成果包(manifest)：当前后端仅提供 STAC 接口，且该版本未提供 manifest 链接/资产（links.rel=manifest 或 assets.manifest）。该版本无法导入到工作空间。"
      }
    }
    return {
      success: false,
      message: itemRes.message || "无法获取版本信息"
    }
  }

  // 从 API 获取（版本管理 API）
  const result = await eoapiGet<Manifest>(`/datasets/${datasetId}/revisions/${revisionId}/manifest`)
  if (result.success && result.data) {
    // 检查 manifest 是否有效（有 layers）
    const hasValidLayers = Array.isArray(result.data.layers) && result.data.layers.length > 0
    if (hasValidLayers) {
      return result
    }
    // manifest 为空，尝试从 STAC Item 构建 fallback
    if (import.meta.env.DEV) {
      console.debug("[eoAPI] manifest 无 layers，尝试 fallback:", datasetId, revisionId)
    }
  }

  // 兼容：部分 eoAPI 仅提供 STAC Items，不提供 /datasets/.../manifest 端点
  // 或 manifest 为空时，尝试从 STAC Item 构建 fallback
  if (!result.success || result.code === 404 || (result.success && result.data && (!result.data.layers || result.data.layers.length === 0))) {
    // 尝试 manifest.json 端点
    if (!result.success) {
      const alt = await eoapiGet<Manifest>(`/datasets/${datasetId}/revisions/${revisionId}/manifest.json`)
      if (alt.success && alt.data && Array.isArray(alt.data.layers) && alt.data.layers.length > 0) {
        return alt
      }
    }

    // 从 STAC Item 构建 fallback manifest
    const itemRes = await getItem(datasetId, revisionId)
    if (itemRes.success && itemRes.data) {
      const href = pickManifestHrefFromStacItem(itemRes.data)
      if (href) {
        const fromAsset = await eoapiGet<Manifest>(href)
        if (fromAsset.success && fromAsset.data && Array.isArray(fromAsset.data.layers) && fromAsset.data.layers.length > 0) {
          return fromAsset
        }
      }
      // 尝试从 STAC Item 构建 fallback manifest
      const fallback = buildFallbackManifestFromStacItem(datasetId, itemRes.data)
      if (fallback) {
        return { success: true, data: fallback }
      }
    }
    return {
      success: false,
      code: 404,
      message: "未找到成果包(manifest)：该版本未提供 manifest 链接/资产，请后端补齐 STAC Item 的 links.rel=manifest 或 assets.manifest，或实现 /datasets/.../manifest 接口"
    }
  }

  // 如果 API 不可用，尝试本地存储
  if (!result.success && result.code === 404) {
    const savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
    const dataset = savedManifests[datasetId]

    if (dataset && dataset.manifest) {
      return {
        success: true,
        data: dataset.manifest
      }
    }

    return {
      success: false,
      code: 404,
      message: "未找到成果包(manifest)：后端未提供该版本的成果包，且本地无降级数据"
    }
  }

  return result
}

export function buildFallbackManifestFromStacItem(datasetId: string, item: StacItem, opts?: { order?: number }): Manifest | null {
  const bbox = Array.isArray((item as any)?.bbox) ? ((item as any).bbox as any[]) : null
  if (!bbox || bbox.length < 4) {
    return null
  }
  const nums = [Number(bbox[0]), Number(bbox[1]), Number(bbox[2]), Number(bbox[3])]
  if (nums.some((n) => !Number.isFinite(n))) {
    return null
  }
  const itemId = String((item as any)?.id || "")
  if (!itemId) {
    return null
  }
  const itemTitle = String((item as any)?.properties?.title || itemId)

  const rawAssets = ((item as any)?.assets || {}) as Record<string, any>
  const entries = Object.entries(rawAssets).filter(([k, a]) => {
    const key = String(k || "").trim()
    if (!key) {
      return false
    }
    if (!a || typeof a !== "object") {
      return false
    }
    const href = String((a as any)?.href || "")
    if (!href) {
      return false
    }
    const type = String((a as any)?.type || "").toLowerCase()
    const roles = Array.isArray((a as any)?.roles) ? (a as any).roles.map((r: any) => String(r).toLowerCase()) : []
    const looksLikeRaster = type.includes("image/") || type.includes("geotiff") || roles.includes("data") || roles.includes("visual")
    const looksLikePreview = roles.includes("thumbnail") || roles.includes("overview") || key.toLowerCase().includes("thumbnail")
    return looksLikeRaster && !looksLikePreview
  })

  if (!entries.length) {
    return null
  }

  const orderedEntries = (() => {
    const visual = entries.filter(([k]) => String(k).toLowerCase() === "visual")
    const rest = entries.filter(([k]) => String(k).toLowerCase() !== "visual").sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    return [...visual, ...rest]
  })()

  const safeId = (v: string) => v.replace(/[^a-zA-Z0-9_-]/g, "_")
  const baseOrder = Number.isFinite(opts?.order) ? Number(opts?.order) : 0
  const hasMultiple = orderedEntries.length > 1
  const layers = orderedEntries.map(([assetKey, asset], idx) => {
    const key = String(assetKey)
    const assetTitle = String((asset as any)?.title || key)
    const tilesUrl = `/api/titiler/collections/${encodeURIComponent(datasetId)}/items/${encodeURIComponent(itemId)}/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=${encodeURIComponent(key)}`
    const styleProfile = resolveRasterStyleProfile({
      name: `${itemTitle}/${assetTitle}`,
      sourceRef: tilesUrl,
      sourceType: "xyz",
      data: {
        tileType: "stac-item-asset",
        assetKey: key,
        title: assetTitle
      }
    }, "xyz")
    return {
      id: safeId(`stac_layer_${datasetId}_${itemId}_${key}`),
      name: `${itemTitle}/${assetTitle}`,
      sourceType: "xyz" as any,
      sourceRef: tilesUrl,
      visible: true,
      opacity: hasMultiple ? 0.7 : 1,
      order: baseOrder * 1000 + idx,
      data: {
        tileType: "stac-item-asset",
        collectionId: datasetId,
        itemId,
        versionId: itemId,
        layerKey: key,
        assetKey: key,
        styleProfile: styleProfile || undefined
      }
    } as any
  })

  return {
    manifestVersion: "1.0",
    createdAt: Date.now(),
    viewState: {
      bbox: [nums[0], nums[1], nums[2], nums[3]]
    },
    layers
  }
}

export function buildFallbackManifestFromStacItems(datasetId: string, items: StacItem[], collectionBbox?: number[]): Manifest {
  const layers: any[] = []
  let globalBbox = Array.isArray(collectionBbox) && collectionBbox.length >= 4
    ? [Number(collectionBbox[0]), Number(collectionBbox[1]), Number(collectionBbox[2]), Number(collectionBbox[3])]
    : null

  const mergeBBox = (next: any) => {
    if (!Array.isArray(next) || next.length < 4) {
      return
    }
    const nums = [Number(next[0]), Number(next[1]), Number(next[2]), Number(next[3])]
    if (nums.some((n) => !Number.isFinite(n))) {
      return
    }
    if (!globalBbox) {
      globalBbox = nums
      return
    }
    globalBbox = [
      Math.min(globalBbox[0], nums[0]),
      Math.min(globalBbox[1], nums[1]),
      Math.max(globalBbox[2], nums[2]),
      Math.max(globalBbox[3], nums[3])
    ]
  }

  items.forEach((item, index) => {
    const single = buildFallbackManifestFromStacItem(datasetId, item, { order: index })
    if (single?.layers?.length) {
      const layersWithOpacity = single.layers.map((l: any) => {
        const baseOpacity = Number.isFinite(Number(l?.opacity)) ? Number(l.opacity) : 1
        const nextOpacity = items.length > 1 ? Math.min(0.7, baseOpacity) : baseOpacity
        return { ...l, opacity: nextOpacity }
      })
      layers.push(...layersWithOpacity)
    }
    mergeBBox((item as any).bbox)
  })

  const finalBbox = Array.isArray(globalBbox) && globalBbox.length >= 4 ? globalBbox : [0, 0, 0, 0]

  return {
    manifestVersion: "1.0",
    createdAt: Date.now(),
    viewState: {
      bbox: finalBbox as [number, number, number, number]
    },
    layers
  }
}

/**
 * 快速保存成果（新建数据集 + 创建首个版本）
 * @param name 数据集名称
 * @param manifest 成果包
 * @param description 描述
 * @param visibility 可见性
 */
export async function quickSaveManifest(
  name: string,
  manifest: Manifest,
  description?: string,
  visibility?: DatasetVisibility
): Promise<ApiResponse<{
  datasetId: string
  revisionId: string
}>> {
  // 先尝试创建数据集
  const createResult = await createDataset({
    name,
    description,
    visibility: visibility || "private"
  })

  // 如果 API 调用失败（任何错误），降级到 localStorage
  if (!createResult.success || !createResult.data) {
    console.warn("[eoAPI] 数据集管理 API 不可用，保存到本地存储")
    const savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
    const existingId = Object.keys(savedManifests).find((id) => {
      const d = savedManifests[id]
      return id.startsWith("local_") && String(d?.name || "") === name
    })

    const localRevisionId = `rev_${Date.now()}`

    if (existingId && savedManifests[existingId]) {
      const dataset = savedManifests[existingId]
      dataset.description = description ?? dataset.description
      dataset.visibility = visibility ?? dataset.visibility
      dataset.manifest = manifest
      dataset.revisions = Array.isArray(dataset.revisions) ? dataset.revisions : []
      dataset.revisions.push({
        revisionId: localRevisionId,
        message: description || "覆盖保存",
        createdAt: Date.now()
      })
      dataset.revisionManifests = dataset.revisionManifests && typeof dataset.revisionManifests === "object" ? dataset.revisionManifests : {}
      dataset.revisionManifests[localRevisionId] = manifest
      dataset.updatedAt = Date.now()
      localStorage.setItem("eoapi_manifests", JSON.stringify(savedManifests))
      return {
        success: true,
        data: {
          datasetId: existingId,
          revisionId: localRevisionId
        }
      }
    }

    const localDatasetId = `local_${Date.now()}`
    savedManifests[localDatasetId] = {
      name,
      description,
      visibility,
      manifest,
      revisionManifests: {
        [localRevisionId]: manifest
      },
      revisions: [{
        revisionId: localRevisionId,
        message: description || "初始版本",
        createdAt: Date.now()
      }],
      createdAt: Date.now()
    }
    localStorage.setItem("eoapi_manifests", JSON.stringify(savedManifests))

    return {
      success: true,
      data: {
        datasetId: localDatasetId,
        revisionId: localRevisionId
      }
    }
  }

  const datasetId = createResult.data.datasetId

  // 创建首个版本
  const revisionResult = await createRevision(datasetId, {
    message: description || "初始版本",
    manifest
  })

  if (!revisionResult.success || !revisionResult.data) {
    // 即使版本创建失败，数据集已创建，也返回成功
    return {
      success: true,
      data: {
        datasetId,
        revisionId: ""
      }
    }
  }

  return {
    success: true,
    data: {
      datasetId,
      revisionId: revisionResult.data.revisionId
    }
  }
}

export async function createImportSession(params: {
  datasetId: string
  groupId: string
  sourceType: "revision" | "local" | "api" | "thirdparty"
  artifactIds?: string[]
  revisionId?: string
  metadata?: Record<string, any>
}): Promise<ApiResponse<{ groupId: string; status: string }>> {
  return eoapiPost(`/imports/sessions`, {
    datasetId: params.datasetId,
    groupId: params.groupId,
    sourceType: params.sourceType,
    artifactIds: params.artifactIds || [],
    revisionId: params.revisionId,
    metadata: params.metadata || {}
  })
}

export function assertSuccessfulImportSessionResponse<T>(response: ApiResponse<T>):
  { success: true; mode: "remote" } | { success: false; mode: "local-only" } {
  if (!response.success && response.code === 404) {
    return { success: false, mode: "local-only" }
  }
  if (!response.success) {
    throw new Error(response.message || `HTTP ${response.code || "未知错误"}`)
  }
  return { success: true, mode: "remote" }
}

export async function undoImportSession(
  groupId: string,
  params?: { datasetId?: string; clearArtifacts?: boolean }
): Promise<ApiResponse<{ success: boolean; status: string; deletedArtifactCount: number }>> {
  return eoapiPost(`/imports/sessions/${encodeURIComponent(groupId)}/undo`, {
    datasetId: params?.datasetId,
    clearArtifacts: params?.clearArtifacts !== false
  })
}

export async function clearImportSession(
  groupId: string,
  params?: { datasetId?: string; clearArtifacts?: boolean }
): Promise<ApiResponse<{ success: boolean; status: string; deletedArtifactCount: number }>> {
  return eoapiPost(`/imports/sessions/${encodeURIComponent(groupId)}/clear`, {
    datasetId: params?.datasetId,
    clearArtifacts: params?.clearArtifacts !== false
  })
}

export default {
  getCollections,
  getCollection,
  getItems,
  getItem,
  searchItems,
  getItemsAll,
  // 兼容旧名称
  getDatasets,
  getDataset,
  getRevisions,
  getRevision,
  // eoAPI 数据集版本管理
  createDataset,
  createRevision,
  deleteDataset,
  saveDatasetRevision,
  deleteDatasetRevision,
  setDatasetShare,
  forkDataset,
  getDatasetLineage,
  getRevisionManifest,
  rollbackDatasetRevision,
  quickSaveManifest,
  createImportSession,
  assertSuccessfulImportSessionResponse,
  undoImportSession,
  clearImportSession,
  // 本地存储管理
  getLocalManifests,
  getLocalDataset,
  deleteLocalManifest,
  // STAC 到 Manifest 降级构建
  buildFallbackManifestFromStacItem,
  buildFallbackManifestFromStacItems
}

// ============ 本地存储管理 ============

const BUNDLED_YUNNAN_EQ_ID = "local_yunnan_usgs_eq"

function bundledDemoAsset(fileName: string) {
  const base = String(import.meta.env.BASE_URL || "/")
  const prefix = base.endsWith("/") ? base : `${base}/`
  return `${prefix}data/demo/${fileName}`
}

function bundledEarthquakeLayer(year: number) {
  return {
    id: `yunnan_usgs_eq_${year}`,
    name: `${year}年地震事件（M≥3.0）`,
    sourceType: "geojson",
    sourceRef: bundledDemoAsset(`yunnan-earthquakes-${year}.geojson`),
    visible: true,
    opacity: 1,
    order: 0,
    popup: "震级：{mag}<br/>地点：{place}<br/>时间：{time}<br/>深度：{depth_km} km<br/>来源：{source}",
    symbol: {
      type: "point",
      styleOptions: {
        color: "#ff4d4f",
        pixelSize: 10,
        outline: true,
        outlineColor: "#ffffff",
        outlineWidth: 1,
        clampToGround: true,
        label: {
          text: "{mag}",
          font_size: 13,
          color: "#ffffff",
          outline: true,
          outlineColor: "#000000",
          pixelOffsetY: -18
        }
      }
    }
  }
}

function bundledEarthquakeManifest(year: number): Manifest {
  return {
    manifestVersion: "1.0",
    createdAt: Date.parse(`${year}-12-31T00:00:00Z`),
    viewState: {
      bbox: [97.5, 21, 105.5, 32]
    },
    layers: [bundledEarthquakeLayer(year)]
  } as Manifest
}

const YUNNAN_BBOX = [97.5, 21, 105.5, 32]

const MODIS_TRUECOLOR_APRIL = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-04-15/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg"
const MODIS_TRUECOLOR_OCTOBER = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-10-15/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg"
const ESRI_WORLD_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
const MULTI_LAYER_DATASET_ID = "local_multi_layer_test"
const LAYER_LOADING_ACCEPTANCE_DATASET_ID = "local_layer_loading_acceptance"

function bundledLayerLoadingAcceptanceManifest(): Manifest {
  return {
    manifestVersion: "1.0",
    createdAt: Date.parse("2026-10-28T00:00:00Z"),
    viewState: { center: { longitude: 0, latitude: 20 }, zoom: 2, heading: 0, pitch: -45 },
    layers: [
      {
        id: "acceptance-cog",
        name: "COG 在线样例",
        sourceType: "cog" as any,
        sourceRef: "https://raw.githubusercontent.com/cogeotiff/rio-tiler/main/tests/fixtures/cog.tif",
        visible: false,
        opacity: 0.85,
        order: 0
      },
      {
        id: "acceptance-image",
        name: "JPG 全球投影地理影像",
        sourceType: "image",
        sourceRef: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Equirectangular_projection_SW.jpg/1280px-Equirectangular_projection_SW.jpg",
        visible: false,
        opacity: 0.8,
        order: 1,
        options: { bounds: [-180, -90, 180, 90] }
      },
      {
        id: "acceptance-xyz",
        name: "OpenStreetMap XYZ",
        sourceType: "xyz",
        sourceRef: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        visible: true,
        opacity: 1,
        order: 2
      },
      {
        id: "acceptance-wms",
        name: "NASA GIBS WMS 真彩色",
        sourceType: "wms",
        sourceRef: "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
        visible: false,
        opacity: 0.85,
        order: 3,
        options: {
          layers: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
          format: "image/png",
          transparent: true,
          parameters: { time: "2025-01-01" }
        }
      },
      {
        id: "acceptance-mvt",
        name: "Esri World Basemap MVT",
        sourceType: "mvt" as any,
        sourceRef: "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf",
        visible: false,
        opacity: 0.9,
        order: 4,
        options: { maximumLevel: 16, lineColor: "#4da3ff", fillColor: "rgba(77, 163, 255, 0.18)" }
      },
      {
        id: "acceptance-unknown",
        name: "未知类型（应进入临时图层）",
        sourceType: "custom-unknown" as any,
        sourceRef: "",
        visible: true,
        opacity: 1,
        order: 5
      }
    ]
  }
}

function bundledMultiLayerManifest(): Manifest {
  return {
    manifestVersion: "1.0",
    viewState: { center: { longitude: 104.0665, latitude: 30.5728 }, zoom: 8, heading: 0, pitch: -45 },
    layers: [
      { id: "group-base-map", name: "Base Maps", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 0 },
      { id: "layer-osm", name: "Street Map", sourceType: "xyz", sourceRef: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", pid: "group-base-map", visible: true, opacity: 1, order: 0 },
      { id: "layer-esri-world", name: "Satellite Imagery", sourceType: "xyz", sourceRef: ESRI_WORLD_IMAGERY, pid: "group-base-map", visible: false, opacity: 1, order: 1 },
      { id: "group-analysis", name: "Thematic Analysis", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 1 },
      {
        id: "layer-analysis-area",
name: "Focus Analysis Area",
sourceType: "geojson",
sourceRef: "",
pid: "group-analysis",
visible: true,
opacity: 0.65,
order: 0,
        data: { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Chengdu Focus Area", level: "focus", risk: 0.82 }, geometry: { type: "Polygon", coordinates: [[[103.85, 30.75], [104.25, 30.75], [104.25, 30.4], [103.85, 30.4], [103.85, 30.75]]] } }] }
      },
      {
        id: "layer-monitor-points",
name: "Monitoring Points",
sourceType: "geojson",
sourceRef: "",
pid: "group-analysis",
visible: true,
opacity: 1,
order: 1,
        data: {
 type: "FeatureCollection",
features: [
          { type: "Feature", properties: { name: "Chengdu Point A", status: "normal", value: 12.6 }, geometry: { type: "Point", coordinates: [104.0665, 30.5728] } },
          { type: "Feature", properties: { name: "Dujiangyan Point B", status: "watch", value: 28.4 }, geometry: { type: "Point", coordinates: [103.619, 30.996] } },
          { type: "Feature", properties: { name: "Meishan Point C", status: "alert", value: 46.8 }, geometry: { type: "Point", coordinates: [103.848, 30.075] } }
        ] 
}
      },
      { id: "group-results", name: "Monitoring Results", sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 2 },
      {
        id: "layer-result-line",
name: "Deformation Trend",
sourceType: "geojson",
sourceRef: "",
pid: "group-results",
visible: true,
opacity: 0.9,
order: 0,
        data: { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Northern Trend", rate: 3.8, unit: "mm/year" }, geometry: { type: "LineString", coordinates: [[103.72, 30.85], [103.95, 30.72], [104.18, 30.62], [104.42, 30.48]] } }] }
      },
      {
        id: "layer-result-zone",
name: "Risk Zone",
sourceType: "geojson",
sourceRef: "",
pid: "group-results",
visible: true,
opacity: 0.5,
order: 1,
        data: { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "High Risk Zone", level: "high", score: 91 }, geometry: { type: "Polygon", coordinates: [[[104, 30.66], [104.15, 30.66], [104.15, 30.5], [104, 30.5], [104, 30.66]]] } }] }
      }
    ]
  }
}

function bundledViewManifest(createdAt: number, layers: any[]): Manifest {
  return {
    manifestVersion: "1.0",
    createdAt,
    viewState: { bbox: YUNNAN_BBOX },
    layers
  } as Manifest
}

function bundledPointLayer(id: string, name: string, fileName: string, popup: string, color: string, labelText: string) {
  return {
    id,
    name,
    sourceType: "geojson",
    sourceRef: bundledDemoAsset(fileName),
    visible: true,
    opacity: 1,
    order: 1,
    popup,
    symbol: {
      type: "point",
      styleOptions: {
        color,
        pixelSize: 9,
        outline: true,
        outlineColor: "#ffffff",
        outlineWidth: 1,
        clampToGround: true,
        ...(labelText
          ? {
              label: {
                text: labelText,
                font_size: 13,
                color: "#ffffff",
                outline: true,
                outlineColor: "#000000",
                pixelOffsetY: -16
              }
            }
          : {})
      }
    }
  }
}

function bundledImageryLayer(id: string, name: string, url: string) {
  return {
    id,
    name,
    sourceType: "xyz",
    sourceRef: url,
    visible: true,
    opacity: 1,
    order: 0
  }
}

function rememberDataset(saved: Record<string, any>, datasetId: string, record: Record<string, any>) {
  if (!saved[datasetId]) {
    saved[datasetId] = record
  }
}

function ensureBundledDemoDatasets() {
  if (typeof localStorage === "undefined") {
    return
  }
  let saved: Record<string, any> = {}
  try {
    saved = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
  } catch {
    saved = {}
  }

  const years = [2023, 2024, 2025]
  const multiLayerManifest = bundledMultiLayerManifest()
  rememberDataset(saved, MULTI_LAYER_DATASET_ID, {
    name: "Multi-layer UI Test Dataset",
    description: "Frontend test dataset with nested groups, XYZ basemaps and GeoJSON point/line/polygon layers.",
    visibility: "private",
    tags: ["test", "multi-layer", "drag-sort"],
    manifest: multiLayerManifest,
    revisionManifests: { "multi-layer-v1": multiLayerManifest },
    revisions: [{ revisionId: "multi-layer-v1", message: "Initial multi-layer test dataset", createdAt: Date.parse("2026-01-01T00:00:00Z") }],
    createdAt: Date.parse("2026-01-01T00:00:00Z"),
    updatedAt: Date.parse("2026-01-01T00:00:00Z")
  })
  const layerLoadingAcceptanceManifest = bundledLayerLoadingAcceptanceManifest()
  rememberDataset(saved, LAYER_LOADING_ACCEPTANCE_DATASET_ID, {
    name: "图层数据接入综合验收数据集",
    description: "用于验证 COG、JPG 地理影像、XYZ、WMS、MVT、未知类型临时归类，以及普通 JPG 报告附件展示。地图服务均为公开联网资源。",
    visibility: "private",
    tags: ["图层验收", "栅格", "MVT", "公开服务"],
    manifest: layerLoadingAcceptanceManifest,
    revisionManifests: { "layer-loading-acceptance-v1": layerLoadingAcceptanceManifest },
    revisions: [{ revisionId: "layer-loading-acceptance-v1", message: "公开服务综合验收数据", createdAt: Date.parse("2026-10-28T00:00:00Z") }],
    createdAt: Date.parse("2026-10-28T00:00:00Z"),
    updatedAt: Date.parse("2026-10-28T00:00:00Z")
  })
  const earthquakeRevisions: Record<string, Manifest> = {}
  const earthquakeRevisionRows = years.map((year) => {
    const revisionId = `eq-${year}`
    earthquakeRevisions[revisionId] = bundledEarthquakeManifest(year)
    return {
      revisionId,
      message: `${year}年云南及邻区地震（USGS，M≥3.0）`,
      createdAt: Date.parse(`${year}-12-31T00:00:00Z`)
    }
  })
  rememberDataset(saved, BUNDLED_YUNNAN_EQ_ID, {
    name: "云南及邻区地震目录（USGS）",
    description: "美国地质调查局（USGS）地震目录中，2023–2025年云南及邻区（东经97.5–105.5、北纬21–32）震级不小于3.0的事件。坐标、震级、深度和时间均为目录原值。导入后可在图层中查看，也可在时间轴演化中按年份播放。",
    visibility: "public",
    tags: ["地震", "云南", "矢量", "USGS"],
    manifest: bundledEarthquakeManifest(2025),
    revisionManifests: earthquakeRevisions,
    revisions: earthquakeRevisionRows,
    createdAt: Date.parse("2023-01-01T00:00:00Z"),
    updatedAt: Date.parse("2025-12-31T00:00:00Z")
  })

  const prefectureManifest = bundledViewManifest(Date.parse("2025-12-31T00:00:00Z"), [
    {
      id: "yunnan_prefectures",
      name: "云南州市界（按地震次数着色）",
      sourceType: "geojson",
      sourceRef: bundledDemoAsset("yunnan-prefectures.geojson"),
      visible: true,
      opacity: 0.85,
      order: 0,
      popup: "州市：{name}<br/>2023–2025年 M≥3.0 次数：{eq_count}<br/>最大震级：{eq_max_mag}<br/>分级：{level}",
      symbol: {
        type: "polygon",
        styleOptions: {
          opacity: 0.45,
          outline: true,
          outlineColor: "#ffffff",
          outlineWidth: 2,
          clampToGround: true,
          label: {
            text: "{name}",
            font_size: 14,
            color: "#ffffff",
            outline: true,
            outlineColor: "#000000"
          }
        }
      }
    },
    bundledPointLayer(
      "yunnan_eq_all",
      "2023–2025年地震事件",
      "yunnan-earthquakes-2023-2025.geojson",
      "震级：{mag}<br/>地点：{place}<br/>时间：{time}<br/>深度：{depth_km} km<br/>来源：{source}",
      "#ff4d4f",
      ""
    )
  ])
  rememberDataset(saved, "local_yunnan_prefecture_eq", {
    name: "云南州市地震分布",
    description: "云南省16个州市界线来自阿里云 DataV 行政区划。颜色和次数由 USGS 2023–2025年 M≥3.0 地震点落入各州市后统计：红色为较多（不少于8次，昭通13次、德宏9次），橙色为有记录，灰蓝为无记录。导入后可与地震点叠在同一组图层里查看。",
    visibility: "public",
    tags: ["地震", "云南", "州市", "统计"],
    manifest: prefectureManifest,
    revisionManifests: { "prefecture-2025": prefectureManifest },
    revisions: [{
      revisionId: "prefecture-2025",
      message: "云南州市界与2023–2025年地震点",
      createdAt: Date.parse("2025-12-31T00:00:00Z")
    }],
    createdAt: Date.parse("2025-01-01T00:00:00Z"),
    updatedAt: Date.parse("2025-12-31T00:00:00Z")
  })

  const baseManifest = bundledViewManifest(Date.parse("2024-01-01T00:00:00Z"), [
    {
      id: "yunnan_rivers",
      name: "主要河流",
      sourceType: "geojson",
      sourceRef: bundledDemoAsset("yunnan-rivers.geojson"),
      visible: true,
      opacity: 1,
      order: 0,
      popup: "河流：{name}<br/>来源：Natural Earth",
      symbol: {
        type: "polyline",
        styleOptions: {
          color: "#40a9ff",
          width: 3,
          clampToGround: true
        }
      }
    },
    bundledPointLayer(
      "yunnan_places",
      "主要城镇",
      "yunnan-places.geojson",
      "城镇：{name}<br/>人口：{population}<br/>所属：{admin}<br/>来源：Natural Earth",
      "#ffc53d",
      "{name}"
    )
  ])
  rememberDataset(saved, "local_yunnan_basegeo", {
    name: "云南及邻区城镇与河流",
    description: "地图范围内的主要河流（金沙江、澜沧江、怒江、红河、南盘江等）和人口5万以上的城镇（昆明、保山、个旧，以及范围内的成都、绵阳等邻区城市）。河流与城镇坐标来自 Natural Earth 公共数据，中文名为对应译名。",
    visibility: "public",
    tags: ["云南", "河流", "城镇", "矢量"],
    manifest: baseManifest,
    revisionManifests: { "basegeo-ne": baseManifest },
    revisions: [{
      revisionId: "basegeo-ne",
      message: "Natural Earth 城镇与河流",
      createdAt: Date.parse("2024-01-01T00:00:00Z")
    }],
    createdAt: Date.parse("2024-01-01T00:00:00Z"),
    updatedAt: Date.parse("2024-01-01T00:00:00Z")
  })

  const imageryRows = [
    {
      revisionId: "modis-2024-04-15",
      message: "MODIS 真彩色 2024-04-15",
      createdAt: Date.parse("2024-04-15T00:00:00Z"),
      layerId: "modis_truecolor_20240415",
      url: MODIS_TRUECOLOR_APRIL
    },
    {
      revisionId: "modis-2024-10-15",
      message: "MODIS 真彩色 2024-10-15",
      createdAt: Date.parse("2024-10-15T00:00:00Z"),
      layerId: "modis_truecolor_20241015",
      url: MODIS_TRUECOLOR_OCTOBER
    },
    {
      revisionId: "esri-world-imagery",
      message: "Esri 卫星影像",
      createdAt: Date.parse("2024-10-16T00:00:00Z"),
      layerId: "esri_world_imagery",
      url: ESRI_WORLD_IMAGERY
    }
  ]
  const imageryRevisions: Record<string, Manifest> = {}
  for (const row of imageryRows) {
    imageryRevisions[row.revisionId] = bundledViewManifest(row.createdAt, [
      bundledImageryLayer(row.layerId, row.message, row.url)
    ])
  }
  rememberDataset(saved, "local_yunnan_imagery", {
    name: "云南及邻区卫星影像",
    description: "三幅可直接加载的公开影像：NASA GIBS 的 MODIS Terra 真彩色（2024-04-15、2024-10-15，适合看区域），以及 Esri World Imagery 卫星影像（放大后更清晰）。在分屏对比里左右各选一幅即可对照；导入使用会把 Esri 卫星影像加到图层。影像版权分别属于 NASA 和 Esri，画面上请保留来源说明。",
    visibility: "public",
    tags: ["影像", "云南", "MODIS", "卫星"],
    manifest: imageryRevisions["esri-world-imagery"],
    revisionManifests: imageryRevisions,
    revisions: imageryRows.map((row) => ({
      revisionId: row.revisionId,
      message: row.message,
      createdAt: row.createdAt
    })),
    createdAt: Date.parse("2024-04-15T00:00:00Z"),
    updatedAt: Date.parse("2024-10-16T00:00:00Z")
  })

  const sarDemoCreatedAt = Date.parse("2026-10-26T00:00:00Z")
  const sarDemoManifest = bundledViewManifest(sarDemoCreatedAt, [
    {
      id: "synthetic_sar_backscatter",
      name: "合成 Sentinel-1 SAR 后向散射影像",
      sourceType: "image",
      sourceRef: "/data/sar/synthetic-sar-backscatter.png",
      visible: true,
      opacity: 1,
      order: 0,
      options: {
        styleProfile: "sar",
        bbox: [100.7, 24.2, 103.1, 26.1]
      }
    }
  ])
  const sarDemoRecord = {
    name: "合成 SAR 后向散射影像",
    description: "用于验证 SAR 默认黑白渲染与图层实时样式调节的离线合成栅格。画面模拟山地、河谷、城镇和雷达散斑，不代表真实 Sentinel-1 观测或业务成果。",
    visibility: "public",
    coverUrl: "/data/sar/synthetic-sar-backscatter.png",
    tags: ["SAR", "Sentinel-1", "栅格", "黑白渲染", "演示数据"],
    manifest: sarDemoManifest,
    revisionManifests: { "sar-demo-v1": sarDemoManifest },
    revisions: [{ revisionId: "sar-demo-v1", message: "合成 SAR 后向散射演示栅格", createdAt: sarDemoCreatedAt }],
    createdAt: sarDemoCreatedAt,
    updatedAt: sarDemoCreatedAt
  }
  const existingSarOptions = saved.local_sar_demo?.manifest?.layers?.[0]?.options
  if (!saved.local_sar_demo || (existingSarOptions?.imageBounds && !existingSarOptions?.bbox)) {
    saved.local_sar_demo = sarDemoRecord
  }

  try {
    localStorage.setItem("eoapi_manifests", JSON.stringify(saved))
  } catch {
  }
}

/**
 * 获取本地保存的成果列表
 */
export function getLocalManifests(): Array<{
  datasetId: string
  name: string
  description?: string
  visibility?: DatasetVisibility
  coverUrl?: string
  tags?: string[]
  createdAt: number
  updatedAt?: number
}> {
  ensureBundledDemoDatasets()
  let savedManifests: Record<string, any> = {}
  try {
    savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
  } catch {
    savedManifests = {}
  }

  return Object.entries(savedManifests).map(([datasetId, data]: [string, any]) => ({
    datasetId,
    name: data.name,
    description: data.description,
    visibility: data.visibility as DatasetVisibility,
    coverUrl: typeof data.coverUrl === "string" && data.coverUrl && data.coverUrl !== "__idb_cover__" ? data.coverUrl : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((t: any) => typeof t === "string") : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  }))
}

/**
 * 删除本地保存的成果
 */
export function deleteLocalManifest(datasetId: string): boolean {
  if (!datasetId.startsWith("local_")) {
    return false
  }

  try {
    const savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
    delete savedManifests[datasetId]
    localStorage.setItem("eoapi_manifests", JSON.stringify(savedManifests))
  } catch {
    return false
  }

  return true
}

/**
 * 获取单个本地数据集
 */
export function getLocalDataset(datasetId: string): {
  name: string
  description?: string
  visibility?: DatasetVisibility
  coverUrl?: string
  tags?: string[]
  manifest?: Manifest
  parentDatasetId?: string
  sourceDatasetId?: string
  sourceRevisionId?: string
  forks?: Array<{ datasetId: string; name: string; createdAt: number }>
  revisionManifests?: Record<string, Manifest>
  revisions?: Array<{ revisionId: string; message?: string; createdAt: number }>
  createdAt: number
} | null {
  if (!datasetId.startsWith("local_")) {
    return null
  }

  let savedManifests: Record<string, any> = {}
  try {
    savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
  } catch {
    savedManifests = {}
  }
  const dataset = savedManifests[datasetId]

  if (!dataset) {
    return null
  }

  return {
    name: dataset.name,
    description: dataset.description,
    visibility: dataset.visibility,
    coverUrl: typeof dataset.coverUrl === "string" && dataset.coverUrl && dataset.coverUrl !== "__idb_cover__" ? dataset.coverUrl : undefined,
    tags: Array.isArray(dataset.tags) ? dataset.tags.filter((t: any) => typeof t === "string") : undefined,
    manifest: dataset.manifest,
    parentDatasetId: dataset.parentDatasetId,
    sourceDatasetId: dataset.sourceDatasetId,
    sourceRevisionId: dataset.sourceRevisionId,
    forks: dataset.forks,
    revisionManifests: dataset.revisionManifests,
    revisions: Array.isArray(dataset.revisions) ? dataset.revisions : undefined,
    createdAt: dataset.createdAt
  }
}

export function updateLocalDataset(
  datasetId: string,
  payload: {
    manifest?: Manifest
    description?: string
    tags?: string[]
    coverUrl?: string
    createNewVersion?: boolean
    message?: string
  }
): boolean {
  if (!datasetId.startsWith("local_")) {
    return false
  }
  let savedManifests: Record<string, any> = {}
  try {
    savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
  } catch {
    savedManifests = {}
  }
  const dataset = savedManifests[datasetId]
  if (!dataset) {
    return false
  }
  if (payload.manifest) {
    dataset.manifest = payload.manifest
  }
  if (payload.description !== undefined) {
    dataset.description = payload.description
  }
  if (payload.coverUrl !== undefined) {
    const v = payload.coverUrl || ""
    if (typeof v === "string" && v) {
      setPersistedDatasetCover(datasetId, v).catch(() => {})
    }
    dataset.coverUrl = typeof v === "string" && v.startsWith("data:") && v.length > 4096 ? "__idb_cover__" : payload.coverUrl
  }
  if (payload.tags !== undefined) {
    dataset.tags = Array.isArray(payload.tags) ? payload.tags.filter((t: any) => typeof t === "string" && t.trim()) : []
  }
  const now = Date.now()
  dataset.updatedAt = now
  if (payload.createNewVersion) {
    const revId = `rev_${now}`
    const next = {
      revisionId: revId,
      message: payload.message || "更新",
      createdAt: now
    }
    if (!Array.isArray(dataset.revisions)) {
      dataset.revisions = []
    }
    dataset.revisions.unshift(next)
    const manifestSnapshot = payload.manifest || dataset.manifest
    if (manifestSnapshot) {
      dataset.revisionManifests = dataset.revisionManifests && typeof dataset.revisionManifests === "object" ? dataset.revisionManifests : {}
      dataset.revisionManifests[revId] = manifestSnapshot
    }
  }
  savedManifests[datasetId] = dataset
  try {
    localStorage.setItem("eoapi_manifests", JSON.stringify(savedManifests))
    return true
  } catch {
    return false
  }
}

type DatasetDraft = { description?: string; tags?: string[]; updatedAt?: number }
const remoteDatasetDrafts = new Map<string, DatasetDraft>()

export function __resetDatasetDraftStateForTest(): void {
  remoteDatasetDrafts.clear()
}

export function getRemoteDatasetDraft(datasetId: string): DatasetDraft | null {
  return remoteDatasetDrafts.get(String(datasetId)) || null
}

export async function updateDatasetContent(
  datasetId: string,
  payload: {
    manifest?: Manifest
    description?: string
    tags?: string[]
    coverUrl?: string
    createNewVersion?: boolean
    message?: string
    artifactRefs?: string[]
  }
): Promise<ApiResponse<{ mode: "local" | "remote"; createdNewVersion: boolean; metadataScope?: string; coverScope?: string; revisionId?: string }>> {
  const cleanTags = Array.isArray(payload.tags) ? payload.tags.filter((tag) => typeof tag === "string" && tag.trim()) : undefined
  if (datasetId.startsWith("local_")) {
    const ok = updateLocalDataset(datasetId, { ...payload, tags: cleanTags })
    if (!ok) {
      return { success: false, message: "未找到本地数据集" }
    }
    emitDatasetSync({ datasetId, reason: "refresh", source: "updateDatasetContent:local", payload: { metadataChanged: payload.description !== undefined || payload.tags !== undefined, coverChanged: payload.coverUrl !== undefined } })
    return { success: true, data: { mode: "local", createdNewVersion: !!payload.createNewVersion } }
  }

  // Probe the dataset collection endpoint before writing a remote revision so
  // callers can distinguish a remote dataset from a local overlay.
  await eoapiGet("/datasets")
  const revision = await createRevision(datasetId, {
    message: payload.message || "更新",
    manifest: payload.manifest,
    artifactRefs: payload.artifactRefs
  } as any)
  if (!revision.success || !revision.data) {
    return revision as any
  }
  const draft: DatasetDraft = { description: payload.description, tags: cleanTags, updatedAt: Date.now() }
  remoteDatasetDrafts.set(datasetId, draft)
  if (payload.coverUrl) {
    await setPersistedDatasetCover(datasetId, payload.coverUrl)
  }
  emitDatasetSync({ datasetId, reason: "refresh", source: "updateDatasetContent:remote", payload: { metadataScope: "local", coverScope: payload.coverUrl ? "local" : undefined } })
  return { success: true, data: { mode: "remote", createdNewVersion: true, metadataScope: "local", coverScope: payload.coverUrl ? "local" : undefined, revisionId: (revision.data as any).revisionId } }
}
