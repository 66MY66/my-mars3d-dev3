import type { AxiosRequestConfig } from "axios"
import { dataManagementHttp, requestJeecg, requestJeecgPage } from "./client"
import type { JeecgPage, SatelliteRecord } from "./types"

type ResourceName =
  | "satelliteDataPool"
  | "satelliteMetadata"
  | "satelliteDataCatalog"
  | "satelliteDataQuery"
  | "satelliteDataShare"

function createCrudService(resource: ResourceName) {
  const base = `/ai2/${resource}`
  return {
    list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
      return requestJeecgPage({ url: `${base}/list`, method: "get", params })
    },
    get(id: string): Promise<SatelliteRecord> {
      return requestJeecg({ url: `${base}/queryById`, method: "get", params: { id } })
    },
    add(data: SatelliteRecord): Promise<string> {
      return requestJeecg({ url: `${base}/add`, method: "post", data })
    },
    edit(data: SatelliteRecord): Promise<string> {
      return requestJeecg({ url: `${base}/edit`, method: "put", data })
    },
    remove(id: string): Promise<string> {
      return requestJeecg({ url: `${base}/delete`, method: "delete", params: { id } })
    },
    removeBatch(ids: string[]): Promise<string> {
      return requestJeecg({ url: `${base}/deleteBatch`, method: "delete", params: { ids: ids.join(",") } })
    },
    importExcel(file: File): Promise<unknown> {
      const data = new FormData()
      data.append("file", file)
      return requestJeecg({ url: `${base}/importExcel`, method: "post", data })
    },
    async exportExcel(params: Record<string, unknown> = {}): Promise<Blob> {
      const config: AxiosRequestConfig = { url: `${base}/exportXls`, method: "get", params, responseType: "blob" }
      const response = await dataManagementHttp.request<Blob>(config)
      return response.data
    }
  }
}

export const poolApi = createCrudService("satelliteDataPool")
export const metadataApi = createCrudService("satelliteMetadata")
export const catalogApi = createCrudService("satelliteDataCatalog")
export const queryTaskApi = createCrudService("satelliteDataQuery")
export const shareApi = createCrudService("satelliteDataShare")

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
