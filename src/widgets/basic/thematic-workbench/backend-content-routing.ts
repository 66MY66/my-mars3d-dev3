import { inspectJsonContent, inspectRasterContent, recommendExpression, type ContentProfile, type ContentRecommendation } from "./content-routing"
import { listRemoteCollections, remoteLayerAssets, remoteProxyUrl, searchStacPage, type RemoteItem, type RemoteLayerAsset } from "./remote-cartography-source"
import { cartographyFingerprint } from "./cartography-fingerprint"
import type { RectInfo } from "./map"
import type { WorkflowRequirement } from "./cartography-workflow"
import { eventParametersAsset, readBackendEventParameters } from "./backend-event-parameters"
import { isAssessmentKind, recommendAssessment } from "./assessment-products"
import { imageryPairs } from "./imagery-comparison"

export type InspectedSource = { item: RemoteItem; asset: RemoteLayerAsset; profile: ContentProfile; fingerprint: string }
export type ContentBinding = InspectedSource & { recommendation?: ContentRecommendation; evidence: string[]; score: number }
export type ContentCatalog = { sources: InspectedSource[]; items?: RemoteItem[]; scope?: RectInfo; problems: string[]; complete: boolean }
const cache = new Map<string, { raw: any; fingerprint: string; at: number }>()

async function read(url: string, signal: AbortSignal) {
  const controller = new AbortController(); const abort = () => controller.abort()
  signal.throwIfAborted(); signal.addEventListener("abort", abort, { once: true }); const timer = setTimeout(abort, 20000)
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit", cache: "no-store" })
    if (!response.ok) { throw new Error(`HTTP ${response.status}`) }
    if (Number(response.headers.get("content-length")) > 25_000_000) { await response.body?.cancel(); throw new Error("文件超过 25 MB，需要后端裁切") }
    const text = await response.text()
    if (new TextEncoder().encode(text).length > 25_000_000) { throw new Error("文件超过 25 MB，需要后端裁切") }
    return JSON.parse(text)
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort) }
}
export async function inspectBackendSource(item: RemoteItem, asset: RemoteLayerAsset, bounds: RectInfo, signal: AbortSignal): Promise<InspectedSource> {
  const href = item.assets[asset.key]?.href
  if (!href) { throw new Error("资产地址缺失") }
  const proxy = remoteProxyUrl("files", href)
  const key = JSON.stringify([proxy, item.properties.updated, asset.kind])
  let entry = cache.get(key)
  if (!entry || Date.now() - entry.at > 60000) {
    const url = asset.kind === "raster" ? `/api/thematic/cog/cog/info?url=${encodeURIComponent(href)}` : proxy
    const raw = await read(url, signal)
    entry = { raw, fingerprint: await cartographyFingerprint(asset.kind === "raster" ? { href, revision: item.properties.updated, info: raw } : raw), at: Date.now() }
    if (cache.size >= 256) { cache.delete(cache.keys().next().value!) }
    cache.set(key, entry)
  }
  signal.throwIfAborted()
  const profile = asset.kind === "raster" ? inspectRasterContent(entry.raw, item.properties, item.assets[asset.key]) : inspectJsonContent(entry.raw, bounds)
  const inspectedAsset = profile.raster ? { ...asset, numeric: !profile.raster.rgb, quantity: profile.raster.quantity, bands: profile.raster.descriptions.map((name: string, index: number) => name || `b${index + 1}`) } : asset
  return { item, asset: inspectedAsset, profile, fingerprint: entry.fingerprint }
}
export async function inspectScopedCatalog(bounds: RectInfo, signal: AbortSignal, progress: (text: string) => void): Promise<ContentCatalog> {
  const items: RemoteItem[] = []; let complete = true
  const problems: string[] = []
  progress("正在查询框选范围内的后端目录")
  const collections = await listRemoteCollections(signal); let collectionIndex = 0
  const scan = async () => {
    while (collectionIndex < collections.length) {
      const collection = collections[collectionIndex++]; let token: string | undefined; let finished = false
      try {
        for (let page = 0; page < 10; page++) {
          signal.throwIfAborted()
          const result = await searchStacPage({ collections: [collection.id], bbox: [bounds.west, bounds.south, bounds.east, bounds.north], limit: 100 }, signal, token)
          items.push(...result.items)
          if (!result.hasMore) { finished = true; break }
          if (!result.nextToken || items.length >= 3000) { break }; token = result.nextToken
        }
        if (!finished) { complete = false; problems.push(`${collection.id}: 目录尚有未读取分页，请缩小范围`) }
      } catch (error) { signal.throwIfAborted(); complete = false; problems.push(`${collection.id}: ${error instanceof Error ? error.message : "查询失败"}`) }
    }
  }
  await Promise.all([scan(), scan(), scan()])
  const tasks = items.flatMap(item => remoteLayerAssets(item).map(asset => ({ item, asset })))
  const sources: InspectedSource[] = []; let next = 0; let finished = 0
  progress(`正在核对后端资料 0/${tasks.length}`)
  const worker = async () => {
    while (next < tasks.length) {
      signal.throwIfAborted()
      const { item, asset } = tasks[next++]
      try { sources.push(await inspectBackendSource(item, asset, bounds, signal)) } catch (error) {
        signal.throwIfAborted(); problems.push(`${item.collection}/${item.id}/${asset.key}: ${error instanceof Error ? error.message : "内容读取失败"}`)
      }
      finished++; progress(`正在核对后端资料 ${finished}/${tasks.length}`)
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return { sources, items, scope: bounds, problems, complete }
}
export function contentBindings(catalog: ContentCatalog, entry: WorkflowRequirement, topic: string): ContentBinding[] {
  const adapter = entry.adapter || entry.key
  if (topic === "imagery-comparison" && ["imagery-before", "imagery-after"].includes(entry.key)) {
    return imageryPairs(catalog.sources).map(pair => ({ ...(entry.key === "imagery-before" ? pair.before : pair.after), evidence: [`灾前 ${pair.comparison.beforeTime}；灾后 ${pair.comparison.afterTime}`, `同一配准依据 ${pair.comparison.registrationId}；分辨率、波段和处理级别一致`], score: 100 }))
  }
  if (adapter === "event-parameters") {
    return (catalog.items || []).flatMap(item => {
      try { const parameters = readBackendEventParameters(item); const e = parameters.event; const b = catalog.scope; if (b && (e.longitude < b.west || e.longitude > b.east || e.latitude < b.south || e.latitude > b.north)) { return [] }; return [{ item, asset: eventParametersAsset(item)[0], profile: { kind: "vector" as const, count: 1, groups: [], metadata: {} }, fingerprint: "", evidence: [`${e.time}；${e.place}；震级 ${e.magnitude}`], score: 100 }] } catch { return [] }
    }).sort((a, b) => String(b.item.properties.datetime || "").localeCompare(String(a.item.properties.datetime || "")))
  }
  const matches = catalog.sources.flatMap(source => {
    const { profile, item, asset } = source
    if ((profile.kind !== "vector" && profile.kind !== "raster") || (profile.kind === "vector" && !profile.count)) { return [] }
    let recommendation: ContentRecommendation | undefined; let score = 50; let evidence: string[] = []
    if (adapter === "assessment-product") {
      recommendation = isAssessmentKind(topic) ? recommendAssessment(profile, topic) || undefined : undefined
      if (!recommendation) { return [] }
      score = recommendation.score; evidence = recommendation.evidence
    } else if (adapter === "business-vector") {
      recommendation = recommendExpression(profile, topic) || undefined
      if (!recommendation) { return [] }
      score = recommendation.score; evidence = recommendation.evidence
    } else if (["population", "economy", "rate", "imagery", "lst"].includes(adapter)) {
      if (!profile.raster?.roles.includes(adapter)) { return [] }
      score = profile.raster.numeric ? 90 : 70
      if (adapter === "imagery" && profile.raster.reflective) { score = 95 }
      if (adapter === "imagery" && profile.raster.rgb && item.assets[asset.key]?.roles?.includes("visual")) { score = 100 }
      evidence = [`已读取 ${profile.raster.count} 个波段`, ...profile.raster.descriptions.filter(Boolean), ...(item.properties["grid:unit"] ? [`目录单位 ${item.properties["grid:unit"]}`] : [])]
    } else if (["thermal-background", "insar-background", "result-layer"].includes(adapter)) {
      const field = item.properties["background:field_type"]
      const expected = adapter === "thermal-background" ? "thermal" : "insar"
      if (field !== expected || !profile.groups.some(group => ["mean", "std", "count", "latest"].every(key => group.fields.some(f => f.key === key && f.numeric === group.count)))) { return [] }
      evidence = ["已核对背景均值、标准差、样本数与最近值", `实际背景类型 ${field}`]
    } else if (adapter === "thermal-anomaly") {
      if (!profile.groups.some(group => ["alice", "max_bt"].every(key => group.fields.some(f => f.key === key && f.numeric === group.count)))) { return [] }
      evidence = ["已读取异常指数与亮温字段；不作为地震烈度"]
    } else {
      if (!profile.groups.some(group => group.roles.includes(adapter))) { return [] }
      evidence = [`已核对${profile.groups.flatMap(group => group.fields.map(field => field.key)).slice(0, 5).join("、")}及实际几何`]
    }
    if (item.properties["cartography:map_view"]) { score -= 5 }
    if (profile.groups.some(group => group.fields.some(field => field.key === "stage"))) { score -= 5 }
    if (asset.kind === "raster" && asset.key === "height") { score -= 10 }
    return [{ ...source, recommendation, evidence, score }]
  })
  matches.sort((a, b) => b.score - a.score || String(b.item.properties.updated || "").localeCompare(String(a.item.properties.updated || "")) || a.fingerprint.localeCompare(b.fingerprint))
  const seen = new Set<string>()
  return matches.filter(source => { const key = JSON.stringify([source.fingerprint, source.recommendation?.field, source.profile.raster?.roles]); if (seen.has(key)) { return false }; seen.add(key); return true })
}
