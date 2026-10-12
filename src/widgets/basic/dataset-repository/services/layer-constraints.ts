import type * as mars3d from "mars3d"
import type { Manifest } from "../types/eoapi-types"

export const MAX_LAYERS = 15

export type LayerCapacityCheck = {
  ok: boolean
  limit: number
  currentCount: number
  incomingCount: number
  projectedCount: number
  remainingCount: number
}

function normalizeText(value: any): string {
  return String(value || "").trim().toLowerCase()
}

function isCountableLayer(layer: any): boolean {
  const id = String(layer?.id || "").trim()
  const sourceType = normalizeText(layer?.type || layer?.sourceType || layer?.options?.type)
  if (!id) {
    return false
  }
  if (sourceType === "group" || sourceType === "graphic") {
    return false
  }
  if (id === "restored_features" || id === "mars3d_draw_layer") {
    return false
  }
  return true
}

export function countMapLayers(map: mars3d.Map): number {
  try {
    return ((map.getLayers({ basemaps: false }) || []) as any[]).filter((layer) => isCountableLayer(layer)).length
  } catch {
    return 0
  }
}

export function countManifestLayers(manifest?: Manifest | null): number {
  if (!manifest?.layers?.length) {
    return 0
  }
  return manifest.layers.filter((layer) => normalizeText(layer?.sourceType) !== "group").length
}

export function checkLayerCapacity(
  map: mars3d.Map,
  options: {
    incomingCount: number
    strategy?: "overlay" | "replace"
    maxLayers?: number
  }
): LayerCapacityCheck {
  const limit = Math.max(1, Math.floor(options.maxLayers || MAX_LAYERS))
  const currentCount = countMapLayers(map)
  const incomingCount = Math.max(0, Math.floor(options.incomingCount || 0))
  const projectedCount = options.strategy === "replace" ? incomingCount : currentCount + incomingCount
  return {
    ok: projectedCount <= limit,
    limit,
    currentCount,
    incomingCount,
    projectedCount,
    remainingCount: Math.max(0, limit - currentCount)
  }
}

export function assertLayerCapacity(
  map: mars3d.Map,
  options: {
    incomingCount: number
    strategy?: "overlay" | "replace"
    maxLayers?: number
    actionLabel?: string
  }
): LayerCapacityCheck {
  const result = checkLayerCapacity(map, options)
  if (!result.ok) {
    const actionLabel = String(options.actionLabel || "加载").trim()
    throw new Error(
      `${actionLabel}后图层数将达到 ${result.projectedCount} 层，已超过上限 ${result.limit} 层，请先在图层管理中清理冗余图层后重试`
    )
  }
  return result
}
