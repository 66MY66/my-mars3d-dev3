/**
 * 数据管理 API 服务（eoAPI 版）
 * @description 五个板块映射到项目二 eoAPI：
 *  - 资源池 pool      → /datasets（按 tags/dataType 分组聚合的"存储池"视图）
 *  - 元数据 metadata  → /collections + /collections/{id}/items（STAC）
 *  - 数据目录 catalog → /collections（collection 即目录节点，父子按关键字分组）
 *  - 查询任务 query   → /search（STAC search，七组条件真生效）
 *  - 数据共享 share   → /datasets 的 visibility/publishStatus
 */
import {
  getCollectionsAll,
  getCollection,
  getItems,
  searchItems,
  createDataset,
  deleteDataset
} from "@mars/widgets/basic/dataset-repository/services/eoapi-datasets"
import { eoapiGet } from "./client"
import type { JeecgPage, SatelliteRecord } from "./types"

function ok<T>(data: T): { success: true; data: T } {
  return { success: true, data }
}

function pageOf(records: SatelliteRecord[], pageNo = 1, pageSize = 10): JeecgPage<SatelliteRecord> {
  const start = (pageNo - 1) * pageSize
  return {
    records: records.slice(start, start + pageSize),
    total: records.length,
    current: pageNo,
    size: pageSize
  }
}

// ============ 资源池：以 eoAPI 数据集聚合出"池"视图 ============

export const poolApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const res = await eoapiGet<SatelliteRecord[]>("/datasets", { params: { limit: 500 } })
    if (!res.success || !res.data) { throw new Error(res.message || "数据集列表获取失败") }
    const datasets = res.data as SatelliteRecord[]
    // 按第一个 tag 聚合成池；无 tag 的归"默认池"
    const byTag = new Map<string, SatelliteRecord[]>()
    for (const d of datasets) {
      const tags = Array.isArray(d.tags) ? (d.tags as string[]) : []
      const key = tags[0] || "默认池"
      const list = byTag.get(key) || []
      list.push(d)
      byTag.set(key, list)
    }
    const pools: SatelliteRecord[] = Array.from(byTag.entries()).map(([tag, list]) => ({
      id: `pool_${tag}`,
      poolName: tag,
      totalCapacity: Math.max(list.length, 10),
      usedCapacity: list.length,
      dataFormat: "多源",
      satellites: Array.from(new Set(list.map((d) => String(d.name || "").split("-")[0]).filter(Boolean))).join(","),
      status: "正常",
      dataType: "光学",
      createdAt: Math.min(...list.map((d) => Number(d.createdAt) || Date.now()))
    }))
    return pageOf(pools, Number(params.pageNo) || 1, Number(params.pageSize) || 10)
  },
  async get(id: string): Promise<SatelliteRecord> {
    const page = await poolApi.list({ pageNo: 1, pageSize: 500 })
    const found = page.records.find((r) => r.id === id)
    if (!found) { throw new Error("资源池不存在") }
    return found
  },
  /** 创建"池"= 创建一个带池名 tag 的 eoAPI 数据集 */
  async add(data: SatelliteRecord): Promise<string> {
    const res = await createDataset({
      name: `池-${String(data.poolName || "未命名")}`,
      description: `数据资源池：${String(data.poolName || "")}`,
      visibility: "private",
      tags: [String(data.poolName || "默认池")]
    })
    if (!res.success || !res.data) { throw new Error(res.message || "资源池创建失败") }
    return (res.data as unknown as SatelliteRecord).datasetId as string
  },
  async edit(): Promise<string> { throw new Error("eoAPI 暂不支持池编辑，请通过数据集管理") },
  async remove(): Promise<string> { throw new Error("eoAPI 暂不支持池删除，请通过数据集管理") },
  async removeBatch(): Promise<string> { throw new Error("eoAPI 暂不支持池删除，请通过数据集管理") },
  async exportExcel(): Promise<Blob> { throw new Error("导出功能开发中") }
}

// ============ 元数据：STAC items ============

export const metadataApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const limit = Number(params.pageSize) || 10
    const offset = ((Number(params.pageNo) || 1) - 1) * limit
    // 未指定 collection 时跨全部数据集检索（STAC /search）
    const collectionId = String(params.collectionId || "")
    let records: SatelliteRecord[]
    if (collectionId) {
      const res = await getItems(collectionId, { limit, offset })
      if (!res.success || !res.data) { throw new Error(res.message || "元数据获取失败") }
      records = res.data as unknown as SatelliteRecord[]
    } else {
      const res = await searchItems({ limit, query: params.query as Record<string, any> | undefined })
      if (!res.success || !res.data) { throw new Error(res.message || "元数据获取失败") }
      records = res.data as unknown as SatelliteRecord[]
    }
    return { records, total: records.length, current: 1, size: limit }
  },
  async get(collectionId: string, itemId: string): Promise<SatelliteRecord> {
    const { getItem } = await import("@mars/widgets/basic/dataset-repository/services/eoapi-datasets")
    const res = await getItem(collectionId, itemId)
    if (!res.success || !res.data) { throw new Error(res.message || "元数据获取失败") }
    return res.data as unknown as SatelliteRecord
  },
  async add(): Promise<string> { throw new Error("元数据由数据集版本自动生成，不支持手工新增") },
  async edit(): Promise<string> { throw new Error("元数据由数据集版本自动生成，不支持手工编辑") },
  async remove(): Promise<string> { throw new Error("元数据由数据集版本自动生成，不支持手工删除") },
  async exportExcel(): Promise<Blob> { throw new Error("导出功能开发中") }
}

// ============ 数据目录：STAC collections ============

export const catalogApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const res = await getCollectionsAll({ limit: 500 })
    if (!res.success || !res.data) { throw new Error(res.message || "目录获取失败") }
    const nodes: SatelliteRecord[] = (res.data as unknown as SatelliteRecord[]).map((c) => ({
      id: c.id,
      name: c.title || c.id,
      parentId: "",
      level: 0,
      dataCount: 0,
      status: "正常",
      isLeaf: true,
      description: c.description || "",
      createdAt: (c.summaries as SatelliteRecord)?.createdAt || 0
    }))
    return pageOf(nodes, Number(params.pageNo) || 1, Number(params.pageSize) || 500)
  },
  async get(id: string): Promise<SatelliteRecord> {
    const res = await getCollection(id)
    if (!res.success || !res.data) { throw new Error(res.message || "目录获取失败") }
    return res.data as unknown as SatelliteRecord
  },
  async add(): Promise<string> { throw new Error("eoAPI 中目录即数据集，请通过数据集管理创建") },
  async edit(): Promise<string> { throw new Error("eoAPI 暂不支持目录编辑") },
  async remove(): Promise<string> { throw new Error("eoAPI 暂不支持目录删除") },
  async exportExcel(): Promise<Blob> { throw new Error("导出功能开发中") }
}

// ============ 查询任务：STAC search（条件真生效） ============

export const queryTaskApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const res = await searchItems({
      collections: params.collectionId ? [String(params.collectionId)] : undefined,
      bbox: Array.isArray(params.bbox) && params.bbox.length === 4 ? (params.bbox as [number, number, number, number]) : undefined,
      datetime: params.datetime ? String(params.datetime) : undefined,
      limit: Number(params.pageSize) || 50,
      query: params.query as Record<string, any> | undefined
    })
    if (!res.success || !res.data) { throw new Error(res.message || "查询失败") }
    return { records: res.data as unknown as SatelliteRecord[], total: (res.data as unknown as SatelliteRecord[]).length, current: 1, size: Number(params.pageSize) || 50 }
  },
  async add(): Promise<string> { throw new Error("查询由 /search 即时执行，不保存任务") },
  async exportExcel(): Promise<Blob> { throw new Error("导出功能开发中") }
}

// ============ 数据共享：datasets visibility ============

export const shareApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const res = await eoapiGet<SatelliteRecord[]>("/datasets", { params: { limit: 500 } })
    if (!res.success || !res.data) { throw new Error(res.message || "数据集列表获取失败") }
    const shares: SatelliteRecord[] = (res.data as unknown as SatelliteRecord[])
      .filter((d) => String(d.visibility || "") !== "")
      .map((d) => ({
        id: d.datasetId,
        dataId: d.datasetId,
        dataName: d.name,
        shareType: d.visibility === "public" ? "公开" : "私有",
        permissions: d.visibility === "public" ? ["查看"] : [],
        authTarget: [],
        status: d.publishStatus === "published" ? "已发布" : "未发布",
        createdAt: d.createdAt
      }))
    return pageOf(shares, Number(params.pageNo) || 1, Number(params.pageSize) || 10)
  },
  async add(): Promise<string> { throw new Error("共享通过数据集可见性设置管理") },
  async edit(): Promise<string> { throw new Error("共享通过数据集可见性设置管理") },
  async remove(): Promise<string> { throw new Error("共享通过数据集可见性设置管理") },
  async exportExcel(): Promise<Blob> { throw new Error("导出功能开发中") }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
