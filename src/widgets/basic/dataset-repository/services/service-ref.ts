import type { ServiceRef } from "../types/eoapi-types"

function normalizeText(value: unknown): string {
  return String(value || "").trim().toLowerCase()
}

export function isLikely3DServiceRef(serviceRef: Partial<ServiceRef> | null | undefined): boolean {
  const anyRef: any = serviceRef as any
  const type = normalizeText(anyRef?.type)
  const format = normalizeText(anyRef?.format)
  const url = normalizeText(anyRef?.urlTemplate || anyRef?.url)
  if (type.includes("3d") || format.includes("3d")) {
    return true
  }
  if (url.includes("tileset.json")) {
    return true
  }
  if (/\.(gltf|glb)(\?.*)?$/.test(url)) {
    return true
  }
  return false
}

export function resolveServiceRefUrl(
  serviceRef: Partial<ServiceRef> | null | undefined,
  options: { prefer2D?: boolean } = {}
): string {
  const anyRef: any = serviceRef as any
  const prefer2D = options.prefer2D !== false
  if (prefer2D && isLikely3DServiceRef(serviceRef)) {
    const fallbackCandidates = [
      anyRef?.fallbackUrlTemplate,
      anyRef?.fallbackUrl,
      anyRef?.url2dTemplate,
      anyRef?.url2d,
      anyRef?.fallback2d?.urlTemplate,
      anyRef?.fallback2d?.url,
      anyRef?.metadata?.url2dTemplate,
      anyRef?.metadata?.url2d,
      anyRef?.metadata?.fallbackUrlTemplate,
      anyRef?.metadata?.fallbackUrl,
      anyRef?.metadata?.fallback2d?.urlTemplate,
      anyRef?.metadata?.fallback2d?.url
    ]
    const fallback = fallbackCandidates.find((value) => typeof value === "string" && value.trim())
    if (fallback) {
      return String(fallback).trim()
    }
    return ""
  }

  return String(anyRef?.urlTemplate || anyRef?.url || "").trim()
}

export function canAddServiceRefToMap(serviceRef: Partial<ServiceRef> | null | undefined): boolean {
  const type = resolveServiceRefType(serviceRef)
  const url = resolveServiceRefUrl(serviceRef)
  if (!url) { return false }
  return ["xyz", "wms", "wmts", "mvt"].includes(type)
}

export function resolveServiceRefType(serviceRef: Partial<ServiceRef> | null | undefined): string {
  if (!isLikely3DServiceRef(serviceRef)) { return normalizeText(serviceRef?.type) }
  const ref = serviceRef as any
  const declared = normalizeText(ref?.fallback2d?.type || ref?.metadata?.fallback2d?.type || ref?.metadata?.type2d)
  if (declared) { return declared }
  const url = resolveServiceRefUrl(serviceRef)
  if (/service=wmts/i.test(url)) { return "wmts" }
  if (/service=wms/i.test(url)) { return "wms" }
  if (/\{[zxy]\}/i.test(url)) { return /\.(pbf|mvt)(\?|$)/i.test(url) ? "mvt" : "xyz" }
  return ""
}

export async function copyServiceRefUrl(serviceRef: Partial<ServiceRef> | null | undefined): Promise<boolean> {
  const url = resolveServiceRefUrl(serviceRef, { prefer2D: true })
  if (!url) {
    return false
  }
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return true
    }
  } catch {
  }
  try {
    const ta = document.createElement("textarea")
    ta.value = url
    ta.style.position = "fixed"
    ta.style.left = "-9999px"
    ta.style.top = "-9999px"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function openServiceRefUrl(serviceRef: Partial<ServiceRef> | null | undefined): boolean {
  const url = resolveServiceRefUrl(serviceRef, { prefer2D: true })
  if (!url) {
    return false
  }
  window.open(url, "_blank", "noopener,noreferrer")
  return true
}
