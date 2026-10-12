import axios, { AxiosError, AxiosInstance } from "axios"
import eoApiConfig from "./eoapi-config"
import type { ApiResponse } from "../types/eoapi-types"

export const eoapi: AxiosInstance = axios.create({
  baseURL: eoApiConfig.apiPrefix,
  timeout: eoApiConfig.timeout
})

function toMessage(error: unknown): string {
  const err = error as AxiosError<any>
  const data: any = (err as any)?.response?.data
  return (
    String(data?.message || data?.detail || (err as any)?.message || "请求失败").trim() ||
    "请求失败"
  )
}

function toCode(error: unknown): number | undefined {
  const err = error as AxiosError<any>
  const code = (err as any)?.response?.status
  return typeof code === "number" ? code : undefined
}

export async function eoapiGet<T>(url: string, params?: any, config?: any): Promise<ApiResponse<T>> {
  try {
    const res = await eoapi.get(url, { params, ...(config || {}) })
    return { success: true, data: res.data as T }
  } catch (e) {
    return { success: false, message: toMessage(e), code: toCode(e) }
  }
}

export async function eoapiPost<T>(url: string, body?: any, config?: any): Promise<ApiResponse<T>> {
  try {
    const res = await eoapi.post(url, body, config || {})
    return { success: true, data: res.data as T }
  } catch (e) {
    return { success: false, message: toMessage(e), code: toCode(e) }
  }
}

export default eoapi

