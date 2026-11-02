/**
 * Windmill search_flow 检索客户端
 * @description 后端检索服务为 Windmill flow `u/fyt/earth/search_flow`（earth-data 工作区）。
 * 同步调用返回 { results, statistics, export, search_log_id }。
 */

export interface SearchFlowConditions {
  satellite?: string
  platform?: string
  instrument?: string
  collections?: string[]
  start?: string
  end?: string
  bbox?: number[]
  gsd_min?: number
  gsd_max?: number
  keyword?: string
  dir_id?: string
  limit?: number
}

export interface SearchFlowResult {
  item_id: string
  collection_id: string
  title: string
  datetime: string
  bbox: number[] | null
  gsd: number | null
  platform: string | null
  instruments: string[] | null
  visibility: string | null
  catalog_path: string | null
  stac_url: string
  preview: string | null
  map_layers: Record<string, { kind: "raster" | "vector"; geojson?: string; tiles?: string; preview?: string }> | null
  downloads: Record<string, unknown> | null
}

export interface SearchFlowStatistics {
  matched: number
  returned?: number
  response_ms: number
  total_ms?: number
  within_5s: boolean
  by_collection: Record<string, number>
  pages?: number
}

export interface SearchFlowResponse {
  results: SearchFlowResult[]
  statistics: SearchFlowStatistics
  export: { download_url?: string; expires_in?: number } | null
  search_log_id?: number
}

/** Windmill 基址与凭据（部署时可通过环境变量覆盖） */
export const WINDMILL_BASE = import.meta.env.VITE_WINDMILL_URL || "http://192.168.10.15:6080"
const WINDMILL_WORKSPACE = import.meta.env.VITE_WINDMILL_WORKSPACE || "earth-data"
const WINDMILL_FLOW = import.meta.env.VITE_WINDMILL_SEARCH_FLOW || "u/fyt/earth/search_flow"
const WINDMILL_TOKEN = import.meta.env.VITE_WINDMILL_TOKEN || ""

/** 运行 flow 并轮询至完成（flow 为异步 job，通常 1-3 秒） */
export async function runSearchFlow(conditions: SearchFlowConditions): Promise<SearchFlowResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (WINDMILL_TOKEN) { headers.Authorization = `Bearer ${WINDMILL_TOKEN}` }

  const runRes = await fetch(
    `${WINDMILL_BASE}/api/w/${WINDMILL_WORKSPACE}/jobs/run/f/${WINDMILL_FLOW}`,
    { method: "POST", headers, body: JSON.stringify(conditions) }
  )
  if (!runRes.ok) { throw new Error(`检索服务启动失败 (${runRes.status})`) }
  const jobId = (await runRes.text()).replace(/"/g, "")

  // 轮询 job 结果，最长等 10 秒（后端 SLA within_5s）
  const started = Date.now()
  while (Date.now() - started < 10_000) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    const poll = await fetch(
      `${WINDMILL_BASE}/api/w/${WINDMILL_WORKSPACE}/jobs_u/get/${jobId}`,
      { headers: WINDMILL_TOKEN ? { Authorization: `Bearer ${WINDMILL_TOKEN}` } : {} }
    )
    if (!poll.ok) { continue }
    const job = await poll.json()
    if (job.type === "CompletedFlow" || (job.result && job.success !== false && job.status === undefined)) {
      return job.result as SearchFlowResponse
    }
    if (job.type === "Failure") { throw new Error(job.error?.message || "检索执行失败") }
  }
  throw new Error("检索超时")
}
