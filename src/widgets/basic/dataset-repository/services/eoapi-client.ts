/**
 * eoAPI HTTP 客户端
 * @description 统一的 API 请求封装
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from "axios"
import { eoApiConfig } from "./eoapi-config"
import { ApiResponse, EoApiServiceStatus } from "../types/eoapi-types"

// #region debug-point eoapi-console-errors
type TraeDebugEvent = {
  t: number
  sessionId: string
  level: "info" | "warn" | "error"
  type: string
  message: string
  data?: Record<string, unknown>
}

const TRAE_DEBUG_ENDPOINT =
  (import.meta.env as any).VITE_DEBUG_SERVER_URL ||
  new URLSearchParams(location.search).get("traeDebug") ||
  localStorage.getItem("TRAE_DEBUG_SERVER_URL") ||
  ""
const TRAE_DEBUG_SESSION_ID =
  (import.meta.env as any).VITE_DEBUG_SESSION_ID ||
  new URLSearchParams(location.search).get("traeSession") ||
  localStorage.getItem("TRAE_DEBUG_SESSION_ID") ||
  "eoapi-console-errors"

const traeBaseFetch = window.fetch.bind(window)

async function reportTraeDebugEvent(event: TraeDebugEvent): Promise<void> {
  if (!TRAE_DEBUG_ENDPOINT) {
    return
  }
  try {
    await traeBaseFetch(TRAE_DEBUG_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify(event),
      keepalive: true
    })
  } catch {
  }
}

function fireAndForget(p: Promise<unknown>): void {
  p.catch(() => {})
}

function isManagementApiPath(url: string): boolean {
  return url.startsWith("/favorites") || url.startsWith("/metrics") || url.startsWith("/datasets")
}

function isLockApiPath(url: string): boolean {
  return url.startsWith("/locks/directories")
}

type DegradedApiBucket = "management" | "directory-locks"

const degradedApiCooldownMs = 60_000
const degradedManagementRequestTimeoutMs = 5000
const degradedApiStorageKey = "eoapi_degraded_api_cooldown_v1"
const degradedApiHealthyStorageKey = "eoapi_degraded_api_health_v1"
const degradedApiCooldownMap = new Map<DegradedApiBucket, number>()
const degradedApiHealthyBuckets = new Set<DegradedApiBucket>()

function getDegradedApiBucket(url: string): DegradedApiBucket | null {
  if (isManagementApiPath(url)) {
    return "management"
  }
  if (isLockApiPath(url)) {
    return "directory-locks"
  }
  return null
}

function readStoredCooldowns(): Record<string, number> {
  try {
    const raw = localStorage.getItem(degradedApiStorageKey)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeStoredCooldowns(next: Record<string, number>): void {
  try {
    localStorage.setItem(degradedApiStorageKey, JSON.stringify(next))
  } catch {
  }
}

function readStoredHealthyBuckets(): string[] {
  try {
    const raw = localStorage.getItem(degradedApiHealthyStorageKey)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "")) : []
  } catch {
    return []
  }
}

function writeStoredHealthyBuckets(next: string[]): void {
  try {
    localStorage.setItem(degradedApiHealthyStorageKey, JSON.stringify(next))
  } catch {
  }
}

function getDegradedApiUnavailableUntil(bucket: DegradedApiBucket): number {
  const memoryValue = degradedApiCooldownMap.get(bucket) || 0
  const storedValue = Number(readStoredCooldowns()[bucket] || 0)
  const next = Math.max(memoryValue, storedValue)
  if (next > memoryValue) {
    degradedApiCooldownMap.set(bucket, next)
  }
  return next
}

function markDegradedApiUnavailable(bucket: DegradedApiBucket): void {
  const next = Date.now() + degradedApiCooldownMs
  degradedApiCooldownMap.set(bucket, next)
  const stored = readStoredCooldowns()
  stored[bucket] = next
  writeStoredCooldowns(stored)
}

function markDegradedApiHealthy(bucket: DegradedApiBucket): void {
  degradedApiHealthyBuckets.add(bucket)
  const nextHealthy = Array.from(new Set([...readStoredHealthyBuckets(), bucket]))
  writeStoredHealthyBuckets(nextHealthy)
  degradedApiCooldownMap.delete(bucket)
  const stored = readStoredCooldowns()
  delete stored[bucket]
  writeStoredCooldowns(stored)
}

function hasStoredHealthyBucket(bucket: DegradedApiBucket): boolean {
  if (degradedApiHealthyBuckets.has(bucket)) {
    return true
  }
  const stored = readStoredHealthyBuckets()
  if (stored.includes(bucket)) {
    degradedApiHealthyBuckets.add(bucket)
    return true
  }
  return false
}

function shouldSkipDegradedApiRequest(url: string): boolean {
  const bucket = getDegradedApiBucket(url)
  if (!bucket) {
    return false
  }
  return Date.now() < getDegradedApiUnavailableUntil(bucket)
}

function updateDegradedApiState(url: string, status?: number, success?: boolean): void {
  const bucket = getDegradedApiBucket(url)
  if (!bucket) {
    return
  }
  if (success) {
    markDegradedApiHealthy(bucket)
    return
  }
  if (bucket === "management" && status != null && status >= 500) {
    markDegradedApiUnavailable(bucket)
    return
  }
  if (bucket === "directory-locks" && (status === 404 || (status != null && status >= 500))) {
    markDegradedApiUnavailable(bucket)
  }
}

function shouldSilenceConsoleError(url: string, status?: number): boolean {
  if (isManagementApiPath(url) && status != null && status >= 500) {
    return true
  }
  if (isLockApiPath(url) && status === 404) {
    return true
  }
  return false
}
// #endregion debug-point eoapi-console-errors

/** eoAPI Axios 客户端实例 */
export const eoapiClient: AxiosInstance = axios.create({
  baseURL: eoApiConfig.apiPrefix,
  timeout: eoApiConfig.timeout,
  headers: {
    "Content-Type": "application/json"
  }
})

export function resolveEoapiHref(href: string): string {
  const raw = String(href || "").trim()
  if (!raw) {
    return ""
  }
  if (/^(data:|blob:|https?:\/\/|\/\/)/i.test(raw)) {
    return raw
  }
  const base = String(eoApiConfig.apiPrefix || "").replace(/\/+$/, "")
  if (!base) {
    return raw
  }
  if (raw.startsWith(base)) {
    return raw
  }
  if (raw.startsWith("/")) {
    return `${base}${raw}`
  }
  return `${base}/${raw}`
}

// 请求拦截器
eoapiClient.interceptors.request.use(
  (config) => {
    const lang = String(eoApiConfig.language || "").trim()
    if (lang) {
      config.headers = (config.headers || {}) as any
      if (!(config.headers as any)["Accept-Language"]) {
        ;(config.headers as any)["Accept-Language"] = `${lang},zh;q=0.9,en;q=0.7`
      }
      if ((config.method || "get").toLowerCase() === "get") {
        const url = String(config.url || "")
        const isStac =
          url === "/" ||
          url.startsWith("/collections") ||
          url.startsWith("/search") ||
          url.includes("/items") ||
          url.startsWith("/conformance")
        if (isStac) {
          config.params = (config.params || {}) as any
          if ((config.params as any).language == null) {
            ;(config.params as any).language = lang
          }
        }
      }
    }
    // 可在此添加认证 token 等
    const token = localStorage.getItem("eoapi_token")
    if (token) {
      config.headers = (config.headers || {}) as any
      ;(config.headers as any).Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
eoapiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error: AxiosError) => {
    const status = error.response?.status
    const url = (error.config?.url || "").toString()
    const errorData = error.response?.data as any
    const message = errorData?.detail || errorData?.message || error.message || "请求失败"

    if (isManagementApiPath(url)) {
      fireAndForget(
        reportTraeDebugEvent({
          t: Date.now(),
          sessionId: TRAE_DEBUG_SESSION_ID,
          level: status && status >= 500 ? "error" : "warn",
          type: "eoapi-client.management-error",
          message: "eoapi-client.management-error",
          data: {
            url,
            method: String(error.config?.method || "get").toUpperCase(),
            status: status ?? null,
            detail: message
          }
        })
      )
    }

    if (shouldSilenceConsoleError(url, status)) {
      if (import.meta.env.DEV) {
        console.debug("[eoAPI] 已降级接口异常:", status, url, message)
      }
    } else if (status === 404) {
      if (import.meta.env.DEV) {
        console.debug("[eoAPI] 404:", url)
      }
    } else if (status && status >= 500) {
      console.error("[eoAPI] 服务错误:", message, error)
    } else {
      console.warn("[eoAPI] 请求失败:", message)
    }
    return Promise.reject(error)
  }
)

/**
 * 通用 GET 请求
 */
export async function eoapiGet<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  if (shouldSkipDegradedApiRequest(url)) {
    return {
      success: false,
      message: "接口处于降级冷却中",
      code: 503
    }
  }
  try {
    const requestConfig = getManagementRequestConfig(url, config)
    const response: AxiosResponse<T> = await eoapiClient.get(url, requestConfig)
    updateDegradedApiState(url, response.status, true)
    return {
      success: true,
      data: response.data
    }
  } catch (error: any) {
    if (isManagementApiPath(url) && (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT")) {
      markDegradedApiUnavailable("management")
    }
    updateDegradedApiState(url, error.response?.status, false)
    return {
      success: false,
      message: error.response?.data?.detail || error.response?.data?.message || error.message || "请求失败",
      code: error.response?.status
    }
  }
}

function getManagementRequestConfig(url: string, config?: AxiosRequestConfig): AxiosRequestConfig | undefined {
  if (!isManagementApiPath(url)) {
    return config
  }
  return {
    ...(config || {}),
    timeout: Math.min(Number(config?.timeout) || eoApiConfig.timeout, degradedManagementRequestTimeoutMs)
  }
}

/**
 * 通用 POST 请求
 */
export async function eoapiPost<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  if (shouldSkipDegradedApiRequest(url)) {
    return {
      success: false,
      message: "接口处于降级冷却中",
      code: 503
    }
  }
  try {
    const response: AxiosResponse<T> = await eoapiClient.post(url, data, config)
    updateDegradedApiState(url, response.status, true)
    return {
      success: true,
      data: response.data
    }
  } catch (error: any) {
    updateDegradedApiState(url, error.response?.status, false)
    return {
      success: false,
      message: error.response?.data?.detail || error.response?.data?.message || error.message || "请求失败",
      code: error.response?.status
    }
  }
}

/**
 * 通用 PUT 请求
 */
export async function eoapiPut<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  if (shouldSkipDegradedApiRequest(url)) {
    return {
      success: false,
      message: "接口处于降级冷却中",
      code: 503
    }
  }
  try {
    const response: AxiosResponse<T> = await eoapiClient.put(url, data, config)
    updateDegradedApiState(url, response.status, true)
    return {
      success: true,
      data: response.data
    }
  } catch (error: any) {
    updateDegradedApiState(url, error.response?.status, false)
    return {
      success: false,
      message: error.response?.data?.detail || error.response?.data?.message || error.message || "请求失败",
      code: error.response?.status
    }
  }
}

/**
 * 通用 DELETE 请求
 */
export async function eoapiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  if (shouldSkipDegradedApiRequest(url)) {
    return {
      success: false,
      message: "接口处于降级冷却中",
      code: 503
    }
  }
  try {
    const response: AxiosResponse<T> = await eoapiClient.delete(url, config)
    updateDegradedApiState(url, response.status, true)
    return {
      success: true,
      data: response.data
    }
  } catch (error: any) {
    updateDegradedApiState(url, error.response?.status, false)
    return {
      success: false,
      message: error.response?.data?.detail || error.response?.data?.message || error.message || "请求失败",
      code: error.response?.status
    }
  }
}

/**
 * 健康检查
 * @description 检测 eoAPI 服务可用性（通过访问 STAC 根路径）
 */
export async function checkHealth(): Promise<EoApiServiceStatus> {
  const startTime = Date.now()
  try {
    // STAC API 没有 /health 端点，使用根路径检查
    await eoapiClient.get("/", { timeout: 5000 })
    return {
      available: true,
      latency: Date.now() - startTime,
      lastCheck: startTime
    }
  } catch (error: any) {
    return {
      available: false,
      latency: Date.now() - startTime,
      lastCheck: startTime,
      message: error.message || "服务不可用"
    }
  }
}

export default eoapiClient

export function __resetDegradedApiStateForTest(): void {
  degradedApiCooldownMap.clear()
  degradedApiHealthyBuckets.clear()
  try {
    localStorage.removeItem(degradedApiStorageKey)
    localStorage.removeItem(degradedApiHealthyStorageKey)
  } catch {
  }
}

export function hasKnownHealthyManagementApi(): boolean {
  return hasStoredHealthyBucket("management")
}
