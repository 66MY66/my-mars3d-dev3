export type EoapiI18nText = {
  title?: string
  description?: string
}

export type EoapiI18nConfig = {
  collections?: Record<string, EoapiI18nText & { keywords?: string[] }>
  items?: Record<string, Record<string, EoapiI18nText>>
  assets?: Record<string, Record<string, Record<string, EoapiI18nText>>>
  summaryKeyLabels?: Record<string, string>
  summaryValueLabels?: Record<string, string>
}

const defaultKeyLabels: Record<string, string> = {
  platform: "平台",
  instruments: "传感器",
  constellation: "星座",
  region: "区域",
  data_type: "数据类型",
  gsd: "分辨率",
  cloud_cover: "云量"
}

const defaultValueLabels: Record<string, string> = {
  raster: "栅格",
  vector: "矢量",
  document: "文档",
  "sentinel-1": "哨兵-1",
  "sentinel-2": "哨兵-2"
}

let cachedConfig: EoapiI18nConfig | null = null
let loadingPromise: Promise<EoapiI18nConfig> | null = null

function getAppBaseUrl(): string {
  // 优先使用 import.meta.env.BASE_URL，如果为空或只是 "/" 则尝试从当前页面路径推断
  const viteBase = String((import.meta as any)?.env?.BASE_URL || "")
  if (viteBase && viteBase !== "/" && viteBase.length > 1) {
    return viteBase.endsWith("/") ? viteBase : `${viteBase}/`
  }
  // 从当前页面 URL 推断 base path（适用于开发环境）
  try {
    const path = window.location.pathname
    // 常见的 base path 格式如 /mars3d/
    const match = path.match(/^\/[^/]+\//)
    if (match) {
      return match[0]
    }
  } catch {}
  return "/"
}

async function loadFromAppConfig(): Promise<EoapiI18nConfig> {
  try {
    const base = getAppBaseUrl()
    const res = await fetch(`${base}config/config.json?time=${Date.now()}`, { cache: "no-store" })
    if (!res.ok) {
      return {}
    }
    const json = (await res.json()) as any
    const cfg = (json?.eoapiI18n || {}) as EoapiI18nConfig
    return cfg && typeof cfg === "object" ? cfg : {}
  } catch {
    return {}
  }
}

export async function ensureEoapiI18nConfig(): Promise<EoapiI18nConfig> {
  if (cachedConfig) {
    return cachedConfig
  }
  if (!loadingPromise) {
    loadingPromise = loadFromAppConfig().then((c) => {
      cachedConfig = c
      return c
    })
  }
  return loadingPromise
}

export function translateSummaryKey(key: string, cfg?: EoapiI18nConfig | null): string {
  const k = String(key || "")
  if (!k) {
    return k
  }
  const map = { ...defaultKeyLabels, ...((cfg?.summaryKeyLabels as any) || {}) }
  return map[k] || k
}

export function translateSummaryValue(value: any, cfg?: EoapiI18nConfig | null): any {
  if (typeof value !== "string") {
    return value
  }
  const map = { ...defaultValueLabels, ...((cfg?.summaryValueLabels as any) || {}) }
  return map[value] || value
}

export function pickCollectionText(collectionId: string, rawTitle?: string, rawDesc?: string, cfg?: EoapiI18nConfig | null): EoapiI18nText {
  const id = String(collectionId || "")
  const mapped = (cfg?.collections || {})[id]
  return {
    title: mapped?.title || rawTitle || id,
    description: mapped?.description || rawDesc
  }
}

export function pickItemText(collectionId: string, itemId: string, rawTitle?: string, rawDesc?: string, cfg?: EoapiI18nConfig | null): EoapiI18nText {
  const cid = String(collectionId || "")
  const iid = String(itemId || "")
  const mapped = (cfg?.items || {})[cid]?.[iid]
  return {
    title: mapped?.title || rawTitle || iid,
    description: mapped?.description || rawDesc
  }
}

export function pickAssetText(collectionId: string, itemId: string, assetKey: string, rawTitle?: string, rawDesc?: string, cfg?: EoapiI18nConfig | null): EoapiI18nText {
  const cid = String(collectionId || "")
  const iid = String(itemId || "")
  const key = String(assetKey || "")
  const mapped = (cfg?.assets || {})[cid]?.[iid]?.[key]
  return {
    title: mapped?.title || rawTitle || key,
    description: mapped?.description || rawDesc
  }
}
