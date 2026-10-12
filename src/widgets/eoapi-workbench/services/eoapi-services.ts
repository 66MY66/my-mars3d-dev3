import type { ApiResponse, ServiceRef } from "../types/eoapi-types"
import { eoapiGet } from "./eoapi-client"

export async function getService(serviceId: string): Promise<ApiResponse<ServiceRef>> {
  const id = String(serviceId || "").trim()
  const res = await eoapiGet<any>(`/services/${encodeURIComponent(id)}`)
  if (!res.success) {
    return { success: false, message: res.message, code: res.code }
  }
  return { success: true, data: res.data as ServiceRef }
}

export function createLayerIdFromService(service: any): string {
  const type = String(service?.type || "service").toLowerCase()
  const raw =
    String(service?.serviceId || "").trim() ||
    String(service?.id || "").trim() ||
    String(service?.name || "").trim() ||
    String(service?.urlTemplate || service?.url || "").trim()

  const safe = raw ? raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) : "unknown"
  return `eoapi_${type}_${safe}`
}

export function buildLayerConfig(service: any): {
  url: string
  minZoom?: number
  maxZoom?: number
  bounds?: [number, number, number, number]
} {
  const url = String((service as any)?.urlTemplate || (service as any)?.url || "")
  const bounds = Array.isArray((service as any)?.bounds) && (service as any).bounds.length === 4 ? ((service as any).bounds as [number, number, number, number]) : undefined
  const minZoom = typeof (service as any)?.minZoom === "number" ? (service as any).minZoom : undefined
  const maxZoom = typeof (service as any)?.maxZoom === "number" ? (service as any).maxZoom : undefined
  return { url, minZoom, maxZoom, bounds }
}

export function buildXyzLayerOptions(service: ServiceRef): any {
  const bounds = Array.isArray(service.bounds) && service.bounds.length === 4 ? service.bounds : null
  const url = (service as any).urlTemplate || service.url
  return {
    type: "xyz",
    name: service.name || "eoAPI 服务",
    url,
    minimumLevel: typeof service.minZoom === "number" ? service.minZoom : undefined,
    maximumLevel: typeof service.maxZoom === "number" ? service.maxZoom : undefined,
    rectangle: bounds ? { xmin: bounds[0], ymin: bounds[1], xmax: bounds[2], ymax: bounds[3] } : undefined
  }
}
