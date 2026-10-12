type LayerLookupMap = {
  getLayerById: (id: any) => any
}

function sanitizeToken(value: any, fallback: string): string {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
  return normalized || fallback
}

function normalizeOpenedAt(openedAt?: number): number {
  return Number.isFinite(openedAt) && Number(openedAt) > 0 ? Math.floor(Number(openedAt)) : Date.now()
}

export function normalizeLayerIdToken(value: any, fallback = "layer"): string {
  return sanitizeToken(value, fallback)
}

export function buildScopedGroupId(scope: string, datasetId: string, openedAt?: number): string {
  return `${sanitizeToken(scope, "group")}_group_${sanitizeToken(datasetId, "dataset")}_${normalizeOpenedAt(openedAt)}`
}

export function buildScopedLayerPrefix(scope: string, datasetId: string, openedAt?: number): string {
  return `${sanitizeToken(scope, "layer")}_${sanitizeToken(datasetId, "dataset")}_${normalizeOpenedAt(openedAt)}_`
}

export function buildScopedLayerId(scope: string, datasetId: string, openedAt: number, baseId: string): string {
  return `${buildScopedLayerPrefix(scope, datasetId, openedAt)}${sanitizeToken(baseId, "layer")}`
}

export function ensureUniqueMapLayerId(
  map: LayerLookupMap | null | undefined,
  desiredId: string,
  options?: { fallbackBase?: string; maxAttempts?: number }
): string {
  const baseId = sanitizeToken(desiredId, options?.fallbackBase || "layer")
  if (!map || typeof map.getLayerById !== "function") {
    return baseId
  }
  if (!map.getLayerById(baseId as any)) {
    return baseId
  }
  const maxAttempts = Math.max(1, Math.floor(options?.maxAttempts ?? 1000))
  for (let i = 2; i <= maxAttempts + 1; i += 1) {
    const candidate = `${baseId}_${i}`
    if (!map.getLayerById(candidate as any)) {
      return candidate
    }
  }
  return `${baseId}_${Date.now()}`
}
