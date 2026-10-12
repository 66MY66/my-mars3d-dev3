import type { ApiResponse } from "../types/eoapi-types"
import { eoapiGet, eoapiPost } from "./eoapi-client"

export type Artifact = {
  id: string
  datasetId?: string
  revisionId?: string
  name?: string
  type?: string
  href?: string
  createdAt?: number | string
}

export async function getArtifacts(params: { datasetId: string; revisionId?: string; limit?: number }): Promise<ApiResponse<Artifact[]>> {
  const datasetId = String(params.datasetId || "").trim()
  if (!datasetId) {
    return { success: true, data: [] }
  }
  const res = await eoapiGet<any>("/artifacts", { ...params, datasetId })
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  let list: any[] = []
  if (Array.isArray(res.data)) {
    list = res.data
  } else if (Array.isArray((res.data as any)?.items)) {
    list = (res.data as any).items
  }
  return { success: true, data: list as Artifact[] }
}

export async function createArtifact(body: any): Promise<ApiResponse<Artifact>> {
  const res = await eoapiPost<any>("/artifacts", body)
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  return { success: true, data: res.data as Artifact }
}
