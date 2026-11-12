import { refreshRemoteItem, remoteProxyUrl, remoteBounds, remoteItemPath, readRemoteVector, type RemoteItem, type RemoteRenderOptions, type RemoteLayerAsset, type RemoteRaster } from "./remote-cartography-source"
import { runThematicFlow, getThematicFlow, getThematicJob } from "./thematic-backend"
import { clipWorkflowVector, scopeFingerprint, productionItem } from "./cartography-workflow"
import { comparisonBounds } from "./imagery-comparison"
import { supplementalItem, supplementalSheetKeys, mergeSupplementalSheets, presentSupplementalVector, isEmptyScopedVector } from "./supplemental-cartography"
import { presentBackendResult, backendResultFields } from "./backend-result-layers"
import { remoteReferenceStyle } from "./remote-reference-style"
import { layerGeographicLabels, type GeographicLabel } from "./cartography-labels"
import type { DbtLayer, DbtBounds } from "./dbt116-standard"
import type { TemplateDocument, TemplateScene } from "./template-renderer"
import { replayExpression, type ExpressionPresentation } from "./expression-presentation"
import { cartographyFingerprint } from "./cartography-fingerprint"
import { internalMapBlockers, internalReviewProblems, internalReviewSubject, type InternalMapReview } from "./internal-map-review"
import { readBackendEventVector } from "./backend-event-parameters"
import { selectContentRole } from "./content-role-selection"
import { compositionSymbolImage } from "./composition-symbols"

const collection = "thematic-map"
const snapshotVersion = "mars3d.map-view.v1"
type MapPart = { id: string; asset: string; sha256?: string }
type MapLayer = { layer: Omit<DbtLayer, "data" | "raster" | "grid" | "sourceGrid">; source: RemoteItem; parts: MapPart[]; numeric: boolean; params?: RemoteRenderOptions; derived?: "stac-event-parameters" }
export type MapSnapshot = { version: typeof snapshotVersion; id: string; title: string; topic: string; bounds: DbtBounds; usage: "internal-proof" | "internal-reviewed" | "operational"; createdAt: string; layers: MapLayer[]; internalReview?: InternalMapReview; formalReview?: { code: string; revision: number; dataSha256: string } }
export type PreparedMapPublication = { snapshot: MapSnapshot; fingerprint: string; args: Record<string, unknown> }
export type PublishedMapLayer = { key: string; layer: DbtLayer; raster?: RemoteRaster; document?: TemplateDocument; scene?: TemplateScene; symbol?: { styleOptions: Record<string, any>; type?: string; callback?: (attr: Record<string, any>) => Record<string, any> }; labels?: GeographicLabel[]; vectorStyle?: { color: string; outlineColor: string } }
export type VerifiedPublishedMap = { snapshot: MapSnapshot; fingerprint: string; layers: PublishedMapLayer[]; catalogUrl: string; verifiedAt: string }

function canonical(value: any): string {
  if (Array.isArray(value)) { return `[${value.map(canonical).join(",")}]` }
  if (value && typeof value === "object") { return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` }
  return JSON.stringify(value)
}
export const mapPublicationHash = cartographyFingerprint
export const mapRootId = (snapshot: MapSnapshot) => snapshot.layers.flatMap(layer => layer.parts)[0]?.id || ""
const box = (bounds: DbtBounds) => [bounds.west, bounds.south, bounds.east, bounds.north]
function fileUri(href: string) {
  const path = remoteProxyUrl("files", href).slice("/api/thematic/files".length)
  if (!path.startsWith("/rs-products/") || path.includes("?")) { throw new Error("成果汇交仅接受 rs-products 中的后端资产，不能使用本机文件或成果库地址") }
  return `minio://rs-products/${decodeURIComponent(path.slice("/rs-products/".length))}`
}
async function json(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal: signal || AbortSignal.timeout(20000), credentials: "omit", cache: "no-store" })
  if (!response.ok) { throw new Error(`发布校验失败（HTTP ${response.status}）：${url.split("?")[0]}`) }
  if (Number(response.headers.get("content-length")) > 25_000_000) { await response.body?.cancel(); throw new Error("发布校验文件超过 25 MB，需按范围交付") }
  const text = await response.text()
  if (new TextEncoder().encode(text).length > 25_000_000) { throw new Error("发布校验文件超过 25 MB") }
  return JSON.parse(text)
}
function descriptor(layer: DbtLayer) {
  const { data, raster, grid, sourceGrid, ...view } = layer
  return JSON.parse(JSON.stringify(view)) as MapLayer["layer"]
}
export async function prepareResultMap(input: { title: string; topic: string; bounds: DbtBounds; layers: DbtLayer[]; formal: boolean; formalReview?: MapSnapshot["formalReview"]; internalReview?: InternalMapReview; documentRevision?: number }, signal?: AbortSignal): Promise<PreparedMapPublication> {
  remoteBounds(box(input.bounds))
  if (!input.title.trim() || !input.topic) { throw new Error("请填写图件标题并选择专题") }
  if (input.formal && (!/^[a-f\d]{64}$/.test(input.formalReview?.dataSha256 || "") || !input.formalReview?.code || !Number.isInteger(input.formalReview.revision))) { throw new Error("正式图层汇交必须绑定本次已复核图件及数据指纹") }
  if (!input.formal) {
    const problems = [...internalMapBlockers(input), ...internalReviewProblems(input.internalReview, await mapPublicationHash(internalReviewSubject(input)))]
    if (problems.length) { throw new Error(problems.join("；")) }
  }
  const layers = input.layers.filter(layer => layer.enabled !== false && (layer.opacity ?? 1) > 0)
  if (layers.some(layer => layer.onlineSource?.rendering?.parameters?.inputOnly)) { throw new Error("存在尚未应用表达方法的专题输入，不能将未渲染数据发布成地图效果") }
  if (!layers.length || layers.length > 12) { throw new Error("在线地图需要 1 至 12 个已叠加的真实后台图层") }
  const id = `MAP-${crypto.randomUUID()}`
  const snapshot: MapSnapshot = { version: snapshotVersion, id, title: input.title.trim(), topic: input.topic, bounds: { ...input.bounds }, usage: input.formal ? "operational" : "internal-reviewed", createdAt: new Date().toISOString(), layers: [] }
  if (input.formal) { snapshot.formalReview = input.formalReview } else { snapshot.internalReview = JSON.parse(JSON.stringify(input.internalReview)) }
  let partIndex = 0
  for (const layer of layers) {
    const binding = layer.onlineSource
    if (!binding || !/^[a-f\d]{64}$/.test(binding.sourceItemSha256 || "") || scopeFingerprint(binding.scope) !== scopeFingerprint(input.bounds)) { throw new Error(`${layer.name} 缺少当前范围的后台来源版本，请重新叠加后发布`) }
    const current = await refreshRemoteItem({ collection: binding.collection, id: binding.itemId } as RemoteItem, signal)
    if (await mapPublicationHash(current) !== binding.sourceItemSha256) { throw new Error(`${layer.name} 后台版本已变化，请重新叠加`) }
    if (!productionItem(current)) { throw new Error(`${layer.name} 后台条目结构无效，请重新读取`) }
    const restrictions = [layer.security, current.properties["security:classification"], current.properties["data:security"]]
    if (restrictions.some(value => /^(secret|top[_ -]?secret|classified|confidential|秘密|机密|绝密|涉密)$/i.test(String(value || "")))) { throw new Error(`${layer.name} 明确限制共享，不能通过人工勾选解除`) }
    if (layer.role === "event") {
      if (input.formal) { throw new Error("当前震中不是可发布的事件图层；不能将目录摘要冒充正式事件成果") }
      const document = readBackendEventVector(current, input.bounds)
      if (await mapPublicationHash(document.features) !== await mapPublicationHash(layer.data.features)) { throw new Error("震中摘要与后台当前参数不一致，请重新叠加") }
      snapshot.layers.push({ layer: descriptor(layer), source: current, parts: [], numeric: false, derived: "stac-event-parameters" })
      continue
    }
    let keys = [binding.asset]
    if (!layer.raster && supplementalItem(current)) { keys = supplementalSheetKeys(current, binding.asset, input.bounds) }
    const source = { ...current, assets: Object.fromEntries(keys.map(key => [key, current.assets[key]])) }
    const parts: MapPart[] = []
    for (const key of keys) {
      const asset = current.assets[key]
      if (!asset?.href) { throw new Error(`${layer.name} 缺少后台资产 ${key}`) }
      fileUri(asset.href)
      const raster = /\.tiff?$/i.test(new URL(asset.href).pathname)
      const vector = /\.geojson$/i.test(new URL(asset.href).pathname)
      if (!raster && !vector) { throw new Error(`${layer.name} 不是可上图的 GeoTIFF/GeoJSON，普通文件不算地图服务`) }
      if (raster !== !!layer.raster) { throw new Error("图层类型与当前地图不一致，请重新叠加") }
      const sha256 = vector ? await mapPublicationHash(await json(remoteProxyUrl("files", asset.href), signal)) : undefined
      parts.push({ id: `${id}-${++partIndex}`, asset: key, sha256 })
    }
    const params = binding.rendering?.parameters as RemoteRenderOptions | undefined
    if (layer.raster && (!binding.rendering?.tileUrl || !params || !Number.isInteger(params.band))) { throw new Error(`${layer.name} 缺少当前地图渲染参数`) }
    snapshot.layers.push({ layer: descriptor(layer), source, parts, numeric: !!layer.raster && !["visual", "surface"].includes(binding.asset), params })
  }
  if (!partIndex || partIndex > 48) { throw new Error("发布需要 1 至 48 个真实图幅，不能仅发布震中摘要") }
  const fingerprint = await mapPublicationHash(snapshot)
  const args = mapFlowArgs(snapshot, fingerprint)
  if (new TextEncoder().encode(JSON.stringify(args)).length > 250000) { throw new Error("地图配置超过后台请求限制，请减少图层或图幅") }
  return { snapshot, fingerprint, args }
}
function mapFlowArgs(snapshot: MapSnapshot, fingerprint: string) {
  const formal = snapshot.usage === "operational"
  return {
    receive_type: "batch_import",
source_system: "mars3d-thematic-workbench",
visibility: "internal",
    batch_data: snapshot.layers.flatMap(entry => entry.parts.map(part => ({
      result_id: part.id,
result_type: "generic",
collection_id: collection,
    title: `${snapshot.title}${formal ? "" : " · 内部审核成果"} · ${entry.layer.name} · ${part.asset}`,
      file: fileUri(entry.source.assets[part.asset].href),
bbox: entry.source.bbox,
datetime: entry.source.properties.datetime || snapshot.createdAt,
      description: formal ? "当前专题地图图层汇交；纸质版式文件单独入库" : "已由操作者完成人工审核的内部业务地图；保留源坐标及资料限制，不声明为行业规范正式应急图件",
      properties: { "cartography:map_id": snapshot.id, "cartography:map_sha256": fingerprint, "cartography:map_view": snapshot, "cartography:usage": snapshot.usage }
    })))
  }
}
export async function submitResultMap(token: string, prepared: PreparedMapPublication, assertCurrent: () => void, signal?: AbortSignal, onDispatch?: () => void) {
  if (prepared.snapshot.usage !== "operational") {
    const source = { ...prepared.snapshot, layers: prepared.snapshot.layers.map(entry => ({ ...entry.layer, data: { type: "FeatureCollection" as const, features: [] } })), documentRevision: prepared.snapshot.internalReview?.documentRevision }
    const problems = internalReviewProblems(prepared.snapshot.internalReview, await mapPublicationHash(internalReviewSubject(source)))
    if (prepared.snapshot.usage !== "internal-reviewed" || problems.length) { throw new Error(problems.join("；") || "请完成人工审核后发布，旧校样不能直接重新提交") }
  }
  const ids = prepared.snapshot.layers.flatMap(layer => layer.parts.map(part => part.id))
  if (!/^MAP-[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(prepared.snapshot.id) || !ids.length || ids.length > 48 || ids.some((id, i) => id !== `${prepared.snapshot.id}-${i + 1}`)) { throw new Error("成果编号必须为本次独立 MAP 版本，禁止复用已有业务编号") }
  if (await mapPublicationHash(prepared.snapshot) !== prepared.fingerprint || canonical(prepared.args) !== canonical(mapFlowArgs(prepared.snapshot, prepared.fingerprint))) { throw new Error("发布配置指纹或提交参数不一致") }
  const definition = await getThematicFlow(token, "result_flow", signal)
  if (!definition.schema?.properties?.batch_data || !definition.schema.properties.receive_type?.enum?.includes("batch_import")) { throw new Error("当前成果汇交流程未提供批量成果参数") }
  assertCurrent()
  // UUID-scoped result IDs never reuse the canonical population/GDP/background IDs.
  for (const entry of prepared.snapshot.layers) {
    for (const part of entry.parts) {
      const response = await fetch(`/api/thematic/stac/collections/${collection}/items/${part.id}`, { signal, credentials: "omit", cache: "no-store" })
      if (response.status !== 404) { throw new Error(response.ok ? "成果编号已存在，已阻止覆盖和重复提交" : `无法排除编号冲突（HTTP ${response.status}），未提交`) }
    }
  }
  assertCurrent()
  onDispatch?.()
  return runThematicFlow(token, "result_flow", prepared.args, true, signal)
}
export async function queryResultMap(token: string, jobId: string, prepared: PreparedMapPublication, signal?: AbortSignal) {
  const job = await getThematicJob(token, jobId, signal)
  if (job.state !== "succeeded") { return { state: job.state, map: null } }
  try {
  const ids = prepared.snapshot.layers.flatMap(layer => layer.parts.map(part => part.id))
  const output = job.result
  if (output?.received !== ids.length || output.published !== ids.length || output.failed !== 0 || !Array.isArray(output.results) || output.results.length !== ids.length || new Set(output.results.map((entry: any) => entry.result_id)).size !== ids.length || output.results.some((entry: any) => !ids.includes(entry.result_id) || entry.status !== "published")) { throw new Error("汇交任务未完整发布本次成果；不能凭任务成功或统计回执确认地图可用") }
  const map = await loadPublishedMap(ids[0], prepared.fingerprint, signal)
  return { state: "verified" as const, map }
  } catch (error) {
    throw Object.assign(new Error(error instanceof Error ? error.message : "已完成任务的地图校验失败"), { jobCompleted: true })
  }
}
async function tileAvailable(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal: signal || AbortSignal.timeout(20000), credentials: "omit", cache: "no-store" })
  const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase()
  if (!response.ok || !["image/png", "image/jpeg", "image/webp"].includes(type || "")) { throw new Error(`实际地图瓦片不可用（HTTP ${response.status}）`) }
  const blob = await response.blob()
  const signature = new Uint8Array((await blob.arrayBuffer()).slice(0, 12))
  const png = signature.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
  const jpeg = signature.slice(0, 3).join(",") === "255,216,255"
  const webp = String.fromCharCode(...signature.slice(0, 4)) === "RIFF" && String.fromCharCode(...signature.slice(8, 12)) === "WEBP"
  if (!blob.size || blob.size > 8_000_000 || !({ "image/png": png, "image/jpeg": jpeg, "image/webp": webp } as Record<string, boolean>)[type!]) { throw new Error("切片服务未返回与媒体类型一致的有效图片") }
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height
    const ctx = canvas.getContext("2d")!; ctx.drawImage(bitmap, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data.some((alpha, i) => i % 4 === 3 && alpha > 0)
  } finally { bitmap.close() }
}
async function publishedRaster(item: RemoteItem, entry: MapLayer, bounds: DbtBounds, signal?: AbortSignal): Promise<RemoteRaster> {
  const file = await fetch(remoteProxyUrl("files", item.assets.data.href), { headers: { Range: "bytes=0-15" }, signal: signal || AbortSignal.timeout(20000), credentials: "omit", cache: "no-store" })
  if (!file.ok || !file.body) { throw new Error(`MinIO 发布文件读取失败（HTTP ${file.status}）`) }
  const reader = file.body.getReader(); const bytes: number[] = []
  try {
    while (bytes.length < 4) { const part = await reader.read(); if (part.done) { break }; bytes.push(...part.value.slice(0, 4 - bytes.length)) }
  } finally { await reader.cancel() }
  if (!["73,73,42,0", "77,77,0,42", "73,73,43,0", "77,77,0,43"].includes(bytes.join(","))) { throw new Error("MinIO 未返回实际 GeoTIFF 文件，不能用网页或下载回执替代") }
  const original = entry.layer.onlineSource!.rendering!.tileUrl!
  const params = new URL(remoteProxyUrl("tiles", original), window.location.origin).searchParams
  params.set("assets", "data")
  if (params.has("asset_bidx")) { params.set("asset_bidx", `data|${entry.params!.band}`) }
  const path = remoteItemPath(item)
  const tilejson = await json(`/api/thematic/tiles${path}/WebMercatorQuad/tilejson.json?${params}`, signal)
  if (!Array.isArray(tilejson.tiles) || !tilejson.tiles.length || (tilejson.scheme && tilejson.scheme !== "xyz") || !Number.isInteger(tilejson.minzoom) || !Number.isInteger(tilejson.maxzoom) || tilejson.minzoom < 0 || tilejson.maxzoom > 24 || tilejson.maxzoom < tilejson.minzoom) { throw new Error("发布的瓦片目录无效") }
  const url = remoteProxyUrl("tiles", tilejson.tiles[0])
  if (!url.startsWith(`/api/thematic/tiles${path}/tiles/`) || !["{z}", "{x}", "{y}"].every(tag => url.includes(tag))) { throw new Error("发布瓦片不属于当前成果") }
  const returned = new URL(url, window.location.origin).searchParams
  for (const [key, value] of params) { if (returned.get(key) !== value) { throw new Error("发布切片未保留地图渲染参数") } }
  const source = remoteBounds(tilejson.bounds)
  const clip = { west: Math.max(bounds.west, source.west), south: Math.max(bounds.south, source.south), east: Math.min(bounds.east, source.east), north: Math.min(bounds.north, source.north) }
  remoteBounds(box(clip))
  const z = Math.min(tilejson.maxzoom, Math.max(tilejson.minzoom, Math.ceil(Math.log2(360 / (clip.east - clip.west)))))
  let visible = false
  for (const f of [0.5, 0.25, 0.75]) {
    const x = Math.floor(((clip.west + (clip.east - clip.west) * f + 180) / 360) * 2 ** z)
    const lat = (clip.south + (clip.north - clip.south) * f) * Math.PI / 180
    const y = Math.floor((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * 2 ** z)
    if (await tileAvailable(url.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)), signal)) { visible = true; break }
  }
  if (!visible) { throw new Error("发布的抽检瓦片全部透明，不能确认当前选区地图可见") }
  return { url, bounds: clip, minZoom: tilejson.minzoom, maxZoom: tilejson.maxzoom }
}
export async function loadPublishedMap(rootId: string, expectedFingerprint?: string, signal?: AbortSignal): Promise<VerifiedPublishedMap> {
  if (!/^MAP-[a-f\d-]{36}-\d+$/i.test(rootId)) { throw new Error("请输入本工作台汇交产生的 MAP 成果编号") }
  const root = await refreshRemoteItem({ collection, id: rootId } as RemoteItem, signal)
  const snapshot = root.properties["cartography:map_view"] as MapSnapshot
  const fingerprint = root.properties["cartography:map_sha256"]
  if (!snapshot || snapshot.version !== snapshotVersion || !["internal-proof", "internal-reviewed", "operational"].includes(snapshot.usage) || !snapshot.title || !Array.isArray(snapshot.layers) || !snapshot.layers.length || snapshot.layers.length > 12 || snapshot.layers.reduce((n, layer) => n + (layer.parts?.length || 0), 0) > 48 || await mapPublicationHash(snapshot) !== fingerprint || (expectedFingerprint && fingerprint !== expectedFingerprint)) { throw new Error("STAC 地图配置或数据指纹不匹配") }
  remoteBounds(box(snapshot.bounds))
  if (mapRootId(snapshot) !== rootId) { throw new Error("目录不是该地图的主成果") }
  if (snapshot.usage === "internal-reviewed") {
    const source = { ...snapshot, layers: snapshot.layers.map(entry => ({ ...entry.layer, data: { type: "FeatureCollection" as const, features: [] } })), documentRevision: snapshot.internalReview?.documentRevision }
    const problems = internalReviewProblems(snapshot.internalReview, await mapPublicationHash(internalReviewSubject(source)))
    if (problems.length) { throw new Error(problems.join("；")) }
  }
  const layers: PublishedMapLayer[] = []
  for (const entry of snapshot.layers) {
    if (entry.derived === "stac-event-parameters") {
      if (snapshot.usage !== "internal-reviewed" || entry.parts.length || entry.layer.role !== "event" || !entry.layer.onlineSource || await mapPublicationHash(entry.source) !== entry.layer.onlineSource.sourceItemSha256) { throw new Error("震中摘要的来源或审核绑定无效") }
      const document = readBackendEventVector(entry.source, snapshot.bounds)
      const layer: DbtLayer = { ...entry.layer, data: document }
      layers.push({ key: layer.id, layer, document, labels: layerGeographicLabels(layer), symbol: { type: "billboard", styleOptions: { image: compositionSymbolImage("dbt-current-epicenter", "#202020"), width: 28, height: 28, clampToGround: true } } })
      continue
    }
    if (!entry.parts?.length || !entry.layer.onlineSource || entry.parts.some(part => !part.id.startsWith(`${snapshot.id}-`))) { throw new Error("地图图层绑定无效") }
    const documents: TemplateDocument[] = []
    let raster: RemoteRaster | undefined
    for (const part of entry.parts) {
      const published = part.id === rootId ? root : await refreshRemoteItem({ collection, id: part.id } as RemoteItem, signal)
      if (published.properties["cartography:map_sha256"] !== fingerprint || await mapPublicationHash(published.properties["cartography:map_view"]) !== fingerprint) { throw new Error("发布成果不属于当前地图版本") }
      const asset = published.assets.data
      if (!asset?.href || !new URL(asset.href).pathname.startsWith(`/rs-products/results/generic/${part.id}/`)) { throw new Error("成果未位于本次汇交的 MinIO 路径") }
      remoteProxyUrl("files", asset.href)
      if (entry.layer.onlineSource.rendering?.tileUrl) {
        if (!/\.tiff?$/i.test(new URL(asset.href).pathname)) { throw new Error("发布的栅格资产类型错误") }
        raster = await publishedRaster(published, entry, comparisonBounds(snapshot.bounds, entry.layer.onlineSource.rendering?.parameters?.comparison), signal)
      } else {
        if (!/\.geojson$/i.test(new URL(asset.href).pathname)) { throw new Error("普通下载文件不能作为在线矢量地图") }
        const data = await json(remoteProxyUrl("files", asset.href), signal)
        if (await mapPublicationHash(data) !== part.sha256) { throw new Error("MinIO 发布矢量与原始后台文件指纹不一致") }
        const source = { ...entry.source, assets: { ...entry.source.assets, [part.asset]: { ...entry.source.assets[part.asset], href: asset.href } } }
        const descriptor: RemoteLayerAsset = { key: part.asset, title: entry.layer.name, kind: "vector", numeric: false, bands: [], range: [0, 1] }
        try { documents.push(readRemoteVector(data, source, descriptor, snapshot.bounds)) } catch (error) { if (!isEmptyScopedVector(error)) { throw error } }
      }
    }
    let document = documents[0]
    if (documents.length > 1) { document = mergeSupplementalSheets(documents, entry.parts.map(part => part.asset), entry.source) }
    if (document && !supplementalItem(entry.source)) { document = clipWorkflowVector(document, snapshot.bounds) }
    const contentRole = entry.layer.onlineSource.rendering?.parameters?.contentRole
    if (document && typeof contentRole === "string") { document = selectContentRole(document, contentRole) }
    if (!raster && !document?.features.length) { throw new Error("发布矢量在当前框选范围内没有可绘制要素") }
    const expression = entry.layer.onlineSource.rendering?.parameters?.expression as ExpressionPresentation | undefined
    if (expression && document) {
      const scene = replayExpression(document, snapshot.bounds, expression)
      layers.push({ key: entry.layer.id, layer: { ...entry.layer, data: document, legend: scene.legend, unit: scene.unit }, document, scene })
      continue
    }
    const field = String(entry.layer.onlineSource.rendering?.parameters?.vectorField || "")
    const display = entry.layer.onlineSource.rendering?.parameters?.resultDisplay === "fill" ? "fill" : "grid"
    const resultStyle = document && backendResultFields(entry.source).length ? presentBackendResult(entry.source, document, field, display) : undefined
    if (resultStyle) { document = resultStyle.document }
    const style = document && supplementalItem(entry.source) ? presentSupplementalVector(entry.source, entry.parts[0].asset, document) : undefined
    const layer: DbtLayer = { ...entry.layer, order: entry.layer.order ?? (raster ? 30 : 70), data: style?.document || document || { type: "FeatureCollection", features: [] } }
    if (resultStyle) {
      layer.legend = resultStyle.legend; layer.unit = resultStyle.unit; layer.colorStandard = `${resultStyle.label}；${resultStyle.note}`
      layer.onlineSource = { ...layer.onlineSource!, rendering: { ...layer.onlineSource!.rendering!, parameters: { ...layer.onlineSource!.rendering?.parameters, resultDisplay: resultStyle.display } } }
    }
    layers.push({ key: entry.layer.id, layer, raster, document: style?.mapDocument || document, symbol: style?.symbol || resultStyle?.symbol, labels: (style || resultStyle) && document ? layerGeographicLabels(layer) : undefined, vectorStyle: remoteReferenceStyle({ collection: entry.source.collection, itemId: entry.source.id }) })
  }
  return { snapshot, fingerprint, layers, catalogUrl: `http://192.168.10.15:5951/collections/${collection}/items/${rootId}`, verifiedAt: new Date().toISOString() }
}
