import type { ApiResponse, ServiceRef } from "../types/eoapi-types"
import { eoapiGet, eoapiPost } from "./eoapi-client"

export type ThematicTemplate = {
  templateId: string
  name?: string
  description?: string
  version?: string
  previewUrl?: string
}

export type ThematicJob = {
  jobId: string
  status: "queued" | "running" | "succeeded" | "failed"
  progress?: number
  createdAt?: number | string
  message?: string
}

export type ThematicJobResult = {
  artifacts?: any[]
  serviceRef?: ServiceRef
  logsRef?: any
  archiveRef?: any
}

export async function getTemplates(): Promise<ApiResponse<ThematicTemplate[]>> {
  const res = await eoapiGet<any>("/thematics/templates")
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  let list: any[] = []
  if (Array.isArray(res.data)) {
    list = res.data
  } else if (Array.isArray((res.data as any)?.items)) {
    list = (res.data as any).items
  }
  return { success: true, data: list as ThematicTemplate[] }
}

export async function getTemplate(templateId: string): Promise<ApiResponse<any>> {
  const id = String(templateId || "").trim()
  if (!id) {
    return { success: false, message: "templateId 不能为空" }
  }
  const res = await eoapiGet<any>(`/thematics/templates/${encodeURIComponent(id)}`)
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  return { success: true, data: res.data }
}

export async function createJob(body: any): Promise<ApiResponse<ThematicJob>> {
  const res = await eoapiPost<any>("/thematics/jobs", body)
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  return { success: true, data: res.data as ThematicJob }
}

export async function getJob(jobId: string): Promise<ApiResponse<ThematicJob>> {
  const id = String(jobId || "").trim()
  const res = await eoapiGet<any>(`/thematics/jobs/${encodeURIComponent(id)}`)
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  return { success: true, data: res.data as ThematicJob }
}

export async function getJobResult(jobId: string): Promise<ApiResponse<ThematicJobResult>> {
  const id = String(jobId || "").trim()
  const res = await eoapiGet<any>(`/thematics/jobs/${encodeURIComponent(id)}/result`)
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  return { success: true, data: res.data as ThematicJobResult }
}

export async function pushArchive(body: any): Promise<ApiResponse<any>> {
  const res = await eoapiPost<any>("/archive/push", body)
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  return { success: true, data: res.data }
}

export async function getLogs(logId: string): Promise<ApiResponse<any>> {
  const id = String(logId || "").trim()
  if (!id) {
    return { success: false, message: "logId 不能为空" }
  }
  const res = await eoapiGet<any>(`/logs/${encodeURIComponent(id)}`)
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  return { success: true, data: res.data }
}
