export type MetadataRefreshReason = "manual" | "artifact" | "saved" | "revision" | "refresh" | "import" | "delete" | "fork" | "share"

export type MetadataRefreshContext = {
  datasetId?: string
  layerId?: string
  reason?: MetadataRefreshReason
}

export type MetadataRefreshHandlers = {
  loadCollectionDetail?: () => Promise<any> | any
  loadArtifacts?: () => Promise<any> | any
  loadItems?: () => Promise<any> | any
}

const refreshers = new Map<string, MetadataRefreshHandlers>()
const invalidatedDatasets = new Set<string>()

export function registerMetadataRefresher(datasetId: string, handlers: MetadataRefreshHandlers) {
  const key = String(datasetId || "").trim()
  if (!key) {
    return () => {}
  }
  refreshers.set(key, handlers)
  return () => {
    refreshers.delete(key)
  }
}

export function invalidateMetadataCache(context: MetadataRefreshContext = {}) {
  const datasetId = String(context.datasetId || "").trim()
  if (datasetId) {
    invalidatedDatasets.add(datasetId)
  }
}

export function hasInvalidatedMetadata(datasetId?: string) {
  const key = String(datasetId || "").trim()
  return key ? invalidatedDatasets.has(key) : false
}

export async function refreshMetadata(context: MetadataRefreshContext = {}) {
  const datasetId = String(context.datasetId || "").trim()
  const handlers = datasetId ? refreshers.get(datasetId) : undefined
  if (!handlers) {
    throw new Error("未找到可用的元数据刷新处理器")
  }

  invalidateMetadataCache(context)

  const reason = context.reason || "manual"
  if (reason === "artifact") {
    await Promise.allSettled([
      handlers.loadArtifacts?.(),
      handlers.loadCollectionDetail?.()
    ])
  } else {
    await Promise.allSettled([
      handlers.loadItems?.(),
      handlers.loadCollectionDetail?.(),
      handlers.loadArtifacts?.()
    ])
  }

  invalidatedDatasets.delete(datasetId)
}
