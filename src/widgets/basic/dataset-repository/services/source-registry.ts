import type * as mars3d from "mars3d"
import type { Manifest } from "../types/eoapi-types"

export type SourceRegistryKind =
  | "revision"
  | "local"
  | "api"
  | "thirdparty"
  | "artifact"
  | "playback"
  | "stac"
  | "unknown"

export type SourceRegistryMeta = {
  key: string
  label?: string
  kind?: SourceRegistryKind
  groupId?: string
}

export type SourceRegistryEntry = SourceRegistryMeta & {
  layerIds: string[]
  layerNames: string[]
}

export type SourceRegistryPrepareResult = {
  ok: boolean
  shouldReplace: boolean
  existing?: SourceRegistryEntry
}

function normalizeText(value: any): string {
  return String(value || "").trim()
}

function getBusinessLayers(map: mars3d.Map): any[] {
  try {
    return (map.getLayers({ basemaps: false }) || []) as any[]
  } catch {
    return []
  }
}

function getLayerRegistryMeta(layer: any): SourceRegistryMeta | null {
  const options = layer?.options && typeof layer.options === "object" ? layer.options : {}
  const key = normalizeText(options.sourceRegistryKey || layer?.sourceRegistryKey)
  if (!key) {
    return null
  }
  return {
    key,
    label: normalizeText(options.sourceRegistryLabel || layer?.sourceRegistryLabel) || undefined,
    kind: (normalizeText(options.sourceRegistryKind || layer?.sourceRegistryKind) || "unknown") as SourceRegistryKind,
    groupId: normalizeText(options.sourceRegistryGroupId || layer?.sourceRegistryGroupId || layer?.pid) || undefined
  }
}

function appendLayer(entry: SourceRegistryEntry, layer: any) {
  const layerId = normalizeText(layer?.id)
  if (layerId && !entry.layerIds.includes(layerId)) {
    entry.layerIds.push(layerId)
  }
  const layerName = normalizeText(layer?.name)
  if (layerName && !entry.layerNames.includes(layerName)) {
    entry.layerNames.push(layerName)
  }
}

export function buildSourceRegistryKey(...parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join("::")
}

export function attachSourceRegistryToManifest(manifest: Manifest, meta: SourceRegistryMeta): Manifest {
  const sourceKey = normalizeText(meta.key)
  if (!sourceKey) {
    return manifest
  }
  const sourceLabel = normalizeText(meta.label)
  const sourceKind = normalizeText(meta.kind || "unknown")
  const sourceGroupId = normalizeText(meta.groupId)
  return {
    ...manifest,
    layers: Array.isArray(manifest.layers)
      ? manifest.layers.map((layer) => ({
          ...layer,
          options: {
            ...(layer?.options || {}),
            sourceRegistryKey: sourceKey,
            sourceRegistryLabel: sourceLabel,
            sourceRegistryKind: sourceKind,
            sourceRegistryGroupId: sourceGroupId
          }
        }))
      : manifest.layers
  }
}

export function tagLayerSourceRegistry(layer: any, meta: SourceRegistryMeta): void {
  if (!layer) {
    return
  }
  const sourceKey = normalizeText(meta.key)
  if (!sourceKey) {
    return
  }
  const sourceLabel = normalizeText(meta.label)
  const sourceKind = normalizeText(meta.kind || "unknown")
  const sourceGroupId = normalizeText(meta.groupId)
  try {
    layer.options = layer.options || {}
    layer.options.sourceRegistryKey = sourceKey
    layer.options.sourceRegistryLabel = sourceLabel
    layer.options.sourceRegistryKind = sourceKind
    layer.options.sourceRegistryGroupId = sourceGroupId
  } catch {
  }
  try {
    layer.sourceRegistryKey = sourceKey
    layer.sourceRegistryLabel = sourceLabel
    layer.sourceRegistryKind = sourceKind
    layer.sourceRegistryGroupId = sourceGroupId
  } catch {
  }
}

export function collectSourceRegistryEntries(map: mars3d.Map): SourceRegistryEntry[] {
  const grouped = new Map<string, SourceRegistryEntry>()
  getBusinessLayers(map).forEach((layer: any) => {
    const meta = getLayerRegistryMeta(layer)
    if (!meta) {
      return
    }
    const current = grouped.get(meta.key) || {
      key: meta.key,
      label: meta.label,
      kind: meta.kind,
      groupId: meta.groupId,
      layerIds: [],
      layerNames: []
    }
    if (!current.label && meta.label) {
      current.label = meta.label
    }
    if ((!current.kind || current.kind === "unknown") && meta.kind) {
      current.kind = meta.kind
    }
    if (!current.groupId && meta.groupId) {
      current.groupId = meta.groupId
    }
    appendLayer(current, layer)
    grouped.set(meta.key, current)
  })
  return Array.from(grouped.values())
}

export function findSourceRegistryEntry(map: mars3d.Map, key: string): SourceRegistryEntry | null {
  const normalized = normalizeText(key)
  if (!normalized) {
    return null
  }
  return collectSourceRegistryEntries(map).find((entry) => entry.key === normalized) || null
}

export function prepareSingleSourceLoad(
  map: mars3d.Map,
  meta: SourceRegistryMeta,
  strategy: "block" | "replace" = "block"
): SourceRegistryPrepareResult {
  const sourceKey = normalizeText(meta.key)
  if (!sourceKey) {
    return { ok: true, shouldReplace: false }
  }
  const existing = findSourceRegistryEntry(map, sourceKey)
  if (!existing) {
    return { ok: true, shouldReplace: false }
  }
  if (strategy === "replace") {
    return { ok: true, shouldReplace: true, existing }
  }
  return { ok: false, shouldReplace: false, existing }
}
