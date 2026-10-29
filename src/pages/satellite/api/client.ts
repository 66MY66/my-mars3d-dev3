import axios from "axios"
import type { AxiosRequestConfig } from "axios"
import type { JeecgPage, JeecgResponse } from "./types"

export const DATA_MANAGEMENT_API_PREFIX = import.meta.env.VITE_DATA_MANAGEMENT_API_PREFIX || "/api/data-management"

const http = axios.create({
  baseURL: DATA_MANAGEMENT_API_PREFIX,
  timeout: 30000
})

export function unwrapJeecgResult<T>(response: JeecgResponse<T>): T {
  if (!response?.success) { throw new Error(response?.message || "数据管理接口请求失败") }
  return response.result as T
}

export function unwrapJeecgPage<T>(response: JeecgResponse<Partial<JeecgPage<T>>>): JeecgPage<T> {
  const page = unwrapJeecgResult(response)
  return {
    records: page?.records ?? [],
    total: Number(page?.total ?? 0),
    current: Number(page?.current ?? 1),
    size: Number(page?.size ?? 10)
  }
}

export async function requestJeecg<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<JeecgResponse<T>>(config)
  return unwrapJeecgResult(response.data)
}

export async function requestJeecgPage<T>(config: AxiosRequestConfig): Promise<JeecgPage<T>> {
  const response = await http.request<JeecgResponse<JeecgPage<T>>>(config)
  return unwrapJeecgPage(response.data)
}

export { http as dataManagementHttp }
