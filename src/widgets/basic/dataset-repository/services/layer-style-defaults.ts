const OPTICAL_IMAGERY_SOURCE_TYPES = new Set([
  "xyz",
  "tile",
  "tms",
  "wms",
  "wmts",
  "arcgis",
  "image",
  "img",
  "geotiff",
  "geotif",
  "cog"
])

const PROFILE_KEYWORDS: Array<{ profile: string; keywords: string[] }> = [
  { profile: "deformation", keywords: ["deformation", "deform", "displacement", "insar", "形变"] },
  { profile: "sar", keywords: ["sar", "radar", "vv", "vh"] },
  { profile: "thermal", keywords: ["thermal", "heat", "temperature", "热异常", "热红外"] },
  { profile: "optical", keywords: ["optical", "visual", "rgb", "truecolor", "true_color", "真彩", "光学"] }
]

export const OPTICAL_IMAGERY_DEFAULT_STYLE = Object.freeze({
  brightness: 1.05,
  contrast: 1.08,
  gamma: 0.95,
  saturation: 1.03,
  hue: 0
})

export const SAR_IMAGERY_DEFAULT_STYLE = Object.freeze({
  brightness: 1.02,
  contrast: 1.35,
  gamma: 0.88,
  saturation: 0,
  hue: 0
})

export const DEFORMATION_IMAGERY_DEFAULT_STYLE = Object.freeze({
  brightness: 1.0,
  contrast: 1.12,
  gamma: 0.98,
  saturation: 1.08,
  hue: 0
})

export const THERMAL_IMAGERY_DEFAULT_STYLE = Object.freeze({
  brightness: 1.0,
  contrast: 1.18,
  gamma: 0.92,
  saturation: 1.12,
  hue: 0
})

function normalizeText(input: any): string {
  return typeof input === "string" ? input.trim().toLowerCase() : ""
}

function hasOwnDefinedValue(obj: Record<string, any>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null
}

export function isImageryRasterSourceType(sourceType: string): boolean {
  return OPTICAL_IMAGERY_SOURCE_TYPES.has(normalizeText(sourceType))
}

export function resolveRasterStyleProfile(
  layerInfo: any,
  sourceType?: string
): "optical" | "sar" | "deformation" | "thermal" | null {
  const explicitProfile = normalizeText(
    layerInfo?.options?.styleProfile ||
      layerInfo?.options?.renderProfile ||
      layerInfo?.data?.styleProfile ||
      layerInfo?.data?.renderProfile ||
      layerInfo?.styleProfile
  )

  if (explicitProfile === "optical" || explicitProfile === "sar" || explicitProfile === "deformation" || explicitProfile === "thermal") {
    return explicitProfile
  }

  const haystack = [
    sourceType,
    layerInfo?.name,
    layerInfo?.sourceRef,
    layerInfo?.data?.assetKey,
    layerInfo?.data?.layerKey,
    layerInfo?.data?.tileType,
    layerInfo?.data?.title,
    layerInfo?.options?.name,
    layerInfo?.options?.url,
    layerInfo?.options?.layer,
    layerInfo?.options?.layers
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ")

  for (const item of PROFILE_KEYWORDS) {
    if (item.keywords.some((keyword) => haystack.includes(keyword))) {
      return item.profile as any
    }
  }

  if (isImageryRasterSourceType(String(sourceType || layerInfo?.sourceType || ""))) {
    return "optical"
  }

  return null
}

export function applyDefaultRasterStyleOptions<T extends Record<string, any>>(
  baseOptions: T,
  layerInfo: any,
  sourceType?: string
): T {
  const effectiveSourceType = String(sourceType || baseOptions?.type || layerInfo?.sourceType || "")
  if (!isImageryRasterSourceType(effectiveSourceType)) {
    return baseOptions
  }

  const profile = resolveRasterStyleProfile(layerInfo, effectiveSourceType)
  if (!profile) {
    return baseOptions
  }

  let defaults: Record<string, any> = OPTICAL_IMAGERY_DEFAULT_STYLE
  if (profile === "sar") {
    defaults = SAR_IMAGERY_DEFAULT_STYLE
  } else if (profile === "deformation") {
    defaults = DEFORMATION_IMAGERY_DEFAULT_STYLE
  } else if (profile === "thermal") {
    defaults = THERMAL_IMAGERY_DEFAULT_STYLE
  }

  const next = { ...baseOptions } as Record<string, any>
  for (const [key, value] of Object.entries(defaults)) {
    if (!hasOwnDefinedValue(next, key)) {
      next[key] = value
    }
  }
  if (!hasOwnDefinedValue(next, "styleProfile")) {
    next.styleProfile = profile
  }
  return next as T
}
