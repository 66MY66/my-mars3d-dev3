import type { StacItem } from "../types/eoapi-types"

export function pickManifestHrefFromStacItem(item: StacItem): string | null {
  const links = item.links || []
  const directLink = links.find((l: any) => l?.rel === "manifest" && typeof l.href === "string")
  if (directLink?.href) {
    return directLink.href
  }

  const assets = (item as any).assets || {}
  if (assets.manifest?.href && typeof assets.manifest.href === "string") {
    return assets.manifest.href
  }

  const entries = Object.entries(assets) as Array<[string, any]>
  const candidates = entries
    .filter(([k, a]) => {
      const href = a?.href
      if (typeof href !== "string" || !href) {
        return false
      }
      const key = String(k).toLowerCase()
      const title = String(a?.title || "").toLowerCase()
      const type = String(a?.type || "").toLowerCase()
      if (key.includes("manifest") || title.includes("manifest")) {
        return true
      }
      if (type.includes("json") && (key.includes("workspace") || title.includes("workspace"))) {
        return true
      }
      return false
    })
    .map(([, a]) => a)

  const best = candidates.find((a: any) => String(a?.href || "").toLowerCase().includes("manifest"))
  if (best?.href) {
    return best.href
  }

  const anyJson = candidates.find((a: any) => String(a?.type || "").toLowerCase().includes("json"))
  if (anyJson?.href) {
    return anyJson.href
  }

  return null
}

