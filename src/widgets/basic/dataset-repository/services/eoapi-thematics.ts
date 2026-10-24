/**
 * eoAPI 专题图生成/发布/归档 API
 * @description 专题图模板管理、任务生成、服务发布与归档推送
 */

import { eoapiGet, eoapiPost } from "./eoapi-client"
import {
  ApiResponse,
  ThematicTemplate,
  ThematicTemplatesResponse,
  ThematicJob,
  CreateJobParams,
  ThematicJobResult,
  JobStatus,
  ArchivePushParams,
  ArchivePushResponse,
  LogsResponse
} from "../types/eoapi-types"

function makeMockJobId(datasetId?: string): string {
  const d = String(datasetId || "").trim() || "unknown"
  return `local_job_${d}`
}

function makeMockArtifactId(jobId: string, type: string): string {
  return `local_art_${jobId}_${type}`
}

function buildDataUrlSvg(title: string): string {
  const safe = String(title || "").slice(0, 40)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#0f172a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="28" fill="#e2e8f0">${safe}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function buildMockGeoJson(bounds?: [number, number, number, number]) {
  const b = Array.isArray(bounds) && bounds.length === 4 ? bounds : ([102.6, 24.7, 103.2, 25.2] as [number, number, number, number])
  const [w, s, e, n] = b
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "专题成果" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [w, s],
              [e, s],
              [e, n],
              [w, n],
              [w, s]
            ]
          ]
        }
      }
    ]
  }
}

function buildLocalMock(datasetId?: string): { job: ThematicJob; result: ThematicJobResult; templates: ThematicTemplate[] } {
  const jobId = makeMockJobId(datasetId)
  const createdAt = Date.now() - 60 * 1000
  const bounds: [number, number, number, number] = [102.6, 24.7, 103.2, 25.2]
  const geojson = buildMockGeoJson(bounds)
  const geoUrl = `data:application/geo+json;charset=utf-8,${encodeURIComponent(JSON.stringify(geojson))}`

  const job: ThematicJob = {
    jobId,
    templateId: "local_mock_template",
    templateVersion: "1.0",
    datasetId,
    status: "succeeded",
    progress: { percent: 100, stage: "done", message: "本地模拟结果", startTime: createdAt, endTime: createdAt + 10 * 1000 },
    outputFormat: "png",
    createdAt
  }

  const artifacts = [
    {
      artifactId: makeMockArtifactId(jobId, "thumbnail"),
      name: "预览图",
      type: "thumbnail",
      url: buildDataUrlSvg("专题预览"),
      mime: "image/svg+xml",
      size: 1024,
      createdAt
    },
    {
      artifactId: makeMockArtifactId(jobId, "export"),
      name: "导出文件.txt",
      type: "export",
      url: `data:text/plain;charset=utf-8,${encodeURIComponent("专题导出内容（本地模拟）")}`,
      mime: "text/plain",
      size: 64,
      createdAt
    },
    {
      artifactId: makeMockArtifactId(jobId, "report"),
      name: "报告.html",
      type: "report",
      url: `data:text/html;charset=utf-8,${encodeURIComponent("<html><body><h3>专题报告（本地模拟）</h3></body></html>")}`,
      mime: "text/html",
      size: 128,
      createdAt
    },
    {
      artifactId: makeMockArtifactId(jobId, "log"),
      name: "日志.txt",
      type: "log",
      url: `data:text/plain;charset=utf-8,${encodeURIComponent("log: ok")}`,
      mime: "text/plain",
      size: 32,
      createdAt
    }
  ] as any

  const result: ThematicJobResult = {
    jobId,
    status: "succeeded",
    artifacts,
    serviceRef: {
      type: "xyz",
      serviceId: "local_service_geojson",
      urlTemplate: geoUrl,
      minZoom: 0,
      maxZoom: 22,
      bounds,
      format: "geojson",
      createdAt
    } as any,
    createdAt,
    completedAt: createdAt + 10 * 1000
  }

  const templates: ThematicTemplate[] = [
    {
      templateId: "local_mock_template",
      version: "1.0",
      name: "本地模拟专题",
      category: "local",
      description: "用于无后端环境验收的模拟专题任务",
      parameters: [],
      outputFormats: ["png"],
      createdAt
    } as any
  ]

  return { job, result, templates }
}

// ============ 模板 API ============

/**
 * 获取专题图模板列表
 */
export async function getTemplates(params?: {
  category?: string
  limit?: number
}, options: { localFallback?: boolean } = {}): Promise<ApiResponse<ThematicTemplatesResponse>> {
  const result = await eoapiGet<ThematicTemplatesResponse>("/thematics/templates", { params })
  if (result.success) {
    return result
  }
  if (options.localFallback === false) { return result }
  const mock = buildLocalMock(undefined)
  return { success: true, data: { templates: mock.templates, total: mock.templates.length } }
}

/**
 * 获取单个模板详情
 * @param templateId 模板 ID
 * @param version 模板版本（可选）
 */
export async function getTemplate(
  templateId: string,
  version?: string
): Promise<ApiResponse<ThematicTemplate>> {
  const url = version
    ? `/thematics/templates/${templateId}?version=${version}`
    : `/thematics/templates/${templateId}`
  return eoapiGet<ThematicTemplate>(url)
}

// ============ 任务 API ============

/**
 * 创建专题图生成任务
 * @param params 任务参数
 */
export async function createJob(
  params: CreateJobParams
): Promise<ApiResponse<ThematicJob>> {
  return eoapiPost<ThematicJob>("/thematics/jobs", {
    templateId: params.templateId,
    templateVersion: params.templateVersion,
    datasetId: params.datasetId,
    revisionId: params.revisionId,
    dataRefs: params.dataRefs,
    parameters: params.parameters,
    outputFormat: params.outputFormat,
    publish: params.publish
  })
}

/**
 * 获取任务列表
 * @param params 查询参数
 */
export async function getJobs(params?: {
  status?: JobStatus
  templateId?: string
  datasetId?: string
  limit?: number
  offset?: number
}): Promise<ApiResponse<ThematicJob[]>> {
  const result = await eoapiGet<ThematicJob[]>("/thematics/jobs", { params })
  if (result.success) {
    return result
  }
  return result
}

/**
 * 获取单个任务详情
 * @param jobId 任务 ID
 */
export async function getJob(jobId: string): Promise<ApiResponse<ThematicJob>> {
  const result = await eoapiGet<ThematicJob>(`/thematics/jobs/${jobId}`)
  if (result.success) {
    return result
  }
  return result
}

/**
 * 取消任务
 * @param jobId 任务 ID
 */
export async function cancelJob(jobId: string): Promise<ApiResponse<{ success: boolean }>> {
  return eoapiPost<{ success: boolean }>(`/thematics/jobs/${jobId}/cancel`)
}

/**
 * 获取任务结果
 * @param jobId 任务 ID
 */
export async function getJobResult(jobId: string): Promise<ApiResponse<ThematicJobResult>> {
  const result = await eoapiGet<ThematicJobResult>(`/thematics/jobs/${jobId}/result`)
  if (result.success) {
    return result
  }
  return result
}

/**
 * 重试失败的任务
 * @param jobId 任务 ID
 */
export async function retryJob(jobId: string): Promise<ApiResponse<ThematicJob>> {
  return eoapiPost<ThematicJob>(`/thematics/jobs/${jobId}/retry`)
}

// ============ 归档 API ============

/**
 * 推送成果到归档系统
 * @param params 归档参数
 */
export async function pushToArchive(
  params: ArchivePushParams
): Promise<ApiResponse<ArchivePushResponse>> {
  return eoapiPost<ArchivePushResponse>("/archive/push", {
    datasetId: params.datasetId,
    revisionId: params.revisionId,
    jobId: params.jobId,
    artifacts: params.artifacts,
    metadata: params.metadata
  })
}

/**
 * 查询归档状态
 * @param archiveId 归档 ID
 */
export async function getArchiveStatus(
  archiveId: string
): Promise<ApiResponse<ArchivePushResponse>> {
  return eoapiGet<ArchivePushResponse>(`/archive/${archiveId}`)
}

// ============ 日志 API ============

/**
 * 获取任务日志
 * @param jobId 任务 ID
 * @param params 过滤参数
 */
export async function getJobLogs(
  jobId: string,
  params?: {
    level?: "info" | "warn" | "error" | "debug"
    stage?: string
    startTime?: number
    endTime?: number
    limit?: number
  }
): Promise<ApiResponse<LogsResponse>> {
  return eoapiGet<LogsResponse>(`/thematics/jobs/${jobId}/logs`, { params })
}

/**
 * 获取单个日志详情
 * @param logId 日志 ID
 */
export async function getLogDetails(logId: string): Promise<ApiResponse<LogsResponse>> {
  return eoapiGet<LogsResponse>(`/logs/${logId}`)
}

// ============ 辅助函数 ============

/**
 * 等待任务完成（轮询）
 * @param jobId 任务 ID
 * @param options 轮询选项
 */
export async function waitForJob(
  jobId: string,
  options?: {
    interval?: number
    timeout?: number
    onProgress?: (job: ThematicJob) => void
  }
): Promise<ApiResponse<ThematicJobResult>> {
  const interval = options?.interval || 2000
  const timeout = options?.timeout || 60000
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const jobResult = await getJob(jobId)
    if (!jobResult.success || !jobResult.data) {
      return {
        success: false,
        message: jobResult.message || "获取任务状态失败"
      }
    }

    const job = jobResult.data
    options?.onProgress?.(job)

    if (job.status === "succeeded") {
      return getJobResult(jobId)
    }

    if (job.status === "failed") {
      return {
        success: false,
        message: `任务失败: ${job.progress.message || "未知错误"}`
      }
    }

    if (job.status === "cancelled") {
      return {
        success: false,
        message: "任务已取消"
      }
    }

    await new Promise(resolve => setTimeout(resolve, interval))
  }

  return {
    success: false,
    message: "等待任务超时"
  }
}

/**
 * 快速生成并发布专题图（一键完成）
 * @param params 任务参数
 * @param onProgress 进度回调
 */
export async function quickGenerateThematic(
  params: CreateJobParams,
  onProgress?: (job: ThematicJob) => void
): Promise<ApiResponse<ThematicJobResult>> {
  // 创建任务
  const createResult = await createJob(params)
  if (!createResult.success || !createResult.data) {
    return {
      success: false,
      message: createResult.message || "创建任务失败"
    }
  }

  const jobId = createResult.data.jobId

  // 等待完成
  return waitForJob(jobId, {
    interval: 2000,
    timeout: 120000,
    onProgress
  })
}

export default {
  getTemplates,
  getTemplate,
  createJob,
  getJobs,
  getJob,
  cancelJob,
  getJobResult,
  retryJob,
  pushToArchive,
  getArchiveStatus,
  getJobLogs,
  getLogDetails,
  waitForJob,
  quickGenerateThematic
}
