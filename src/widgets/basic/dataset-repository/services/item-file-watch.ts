import type { StacAsset, StacItem } from "../types/eoapi-types"
import { resolveEoapiHref } from "./eoapi-client"

export type ItemFileWatchSource = {
  id: string
  name: string
  url: string
}

function getItemLabel(item: StacItem): string {
  return String(item?.properties?.title || item?.id || "数据文件")
}

function getAssetUrl(asset: StacAsset): string {
  const publicHref = String((asset as any)?.alternate?.public?.href || "").trim()
  const href = String(asset?.href || "").trim()
  return publicHref || href
}

export function collectWatchableItemFiles(
  items: StacItem[] = [],
  options: {
    selectedItemId?: string
    limit?: number
  } = {}
): ItemFileWatchSource[] {
  const limit = Math.max(1, Number(options.limit) || 20)
  const selectedItemId = String(options.selectedItemId || "").trim()
  const orderedItems = [...items].sort((a, b) => {
    const aSelected = String(a?.id || "") === selectedItemId ? 1 : 0
    const bSelected = String(b?.id || "") === selectedItemId ? 1 : 0
    return bSelected - aSelected
  })

  const result: ItemFileWatchSource[] = []
  const seen = new Set<string>()

  orderedItems.forEach((item) => {
    const itemId = String(item?.id || "").trim()
    const assets = item?.assets && typeof item.assets === "object" ? Object.entries(item.assets) : []
    assets.forEach(([assetKey, asset]) => {
      const assetRecord = asset as StacAsset
      const rawUrl = getAssetUrl(assetRecord)
      if (!rawUrl) {
        return
      }
      const url = resolveEoapiHref(rawUrl)
      const watchId = `item:${itemId}:${assetKey}`
      if (!url || seen.has(watchId)) {
        return
      }
      seen.add(watchId)
      result.push({
        id: watchId,
        name: `${getItemLabel(item)} / ${String(assetRecord?.title || assetKey || "资源")}`,
        url
      })
    })
  })

  return result.slice(0, limit)
}
