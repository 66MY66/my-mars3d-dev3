/**
 * 数据管理 API 客户端（eoAPI 版）
 * @description 数据管理子系统直连项目二 eoAPI（STAC + datasets），不再依赖项目一 jeecg。
 * 复用 dataset-repository 的 eoapi-client（统一 baseURL /api/eoapi、超时、错误处理）。
 */
import type { AxiosRequestConfig } from "axios"
import { eoapiGet, eoapiPost, eoapiPut, eoapiDelete } from "@mars/widgets/basic/dataset-repository/services/eoapi-client"
import type { ApiResponse } from "@mars/widgets/basic/dataset-repository/types/eoapi-types"
import type { JeecgPage } from "./types"

export const DATA_MANAGEMENT_API_PREFIX = import.meta.env.VITE_EOAPI_API_PREFIX || "/api/eoapi"

/** 兼容旧 JeecgPage 分页契约：offset/limit → records/total/current/size */
export function toJeecgPage<T>(items: T[], offset: number, limit: number, total?: number): JeecgPage<T> {
  return {
    records: items,
    total: total ?? items.length,
    current: Math.floor(offset / Math.max(limit, 1)) + 1,
    size: limit
  }
}

export async function eoapiRequest<T>(config: AxiosRequestConfig & { url: string }): Promise<T> {
  const { url, data, method = "get", ...rest } = config
  const m = String(method).toLowerCase()
  let res: ApiResponse<T>
  if (m === "get") {
    res = await eoapiGet<T>(url, { params: (rest as any).params, ...rest })
  } else if (m === "post") {
    res = await eoapiPost<T>(url, data, rest)
  } else if (m === "put") {
    res = await eoapiPut<T>(url, data, rest)
  } else {
    res = await eoapiDelete<T>(url, rest)
  }
  if (!res.success) { throw new Error(res.message || "数据管理接口请求失败") }
  return res.data as T
}

export { eoapiGet, eoapiPost, eoapiPut, eoapiDelete }
export type { ApiResponse }
