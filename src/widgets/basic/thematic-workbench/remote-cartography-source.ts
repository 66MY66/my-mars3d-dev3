import type { TemplateDocument } from "./template-renderer"
import { readBusinessDocument } from "./business-map-data"
import type { RectInfo } from "./map"
import { backendResultKind } from "./backend-result-layers"
import { supplementalItem, supplementalNotice, readSupplementalVector } from "./supplemental-cartography"
import { validThematicObjectPath } from "./thematic-services"
import { normalizeContentGeometry } from "./content-geometry"
import { packageProduct } from "./package-product-catalog"

export type RemoteAsset = { href: string; type?: string; title?: string; roles?: string[]; unit?: string; "proj:epsg"?: number; "proj:bbox"?: number[]; bands?: Array<{ name?: string; min?: number; max?: number }>; "raster:bands"?: Array<{ name?: string; min?: number; max?: number; statistics?: { minimum?: number; maximum?: number } }> }
export type RemoteItem = { type: "Feature"; id: string; collection: string; bbox: number[]; properties: Record<string, any>; assets: Record<string, RemoteAsset> }
export type RemoteRasterQuantity = "population" | "economy" | "rate" | "temperature" | "reflectance" | "brightness"
export type RemoteLayerAsset = { key: string; title: string; kind: "raster" | "vector"; numeric: boolean; bands: string[]; range: [number, number]; quantity?: RemoteRasterQuantity }
export type RemoteRaster = { url: string; bounds: RectInfo; minZoom: number; maxZoom: number }
export type RemotePoint = { longitude: number; latitude: number; value: number | null; band: string }
export type RemoteColorInterval = [[number, number], [number, number, number, number]]
export type RemoteRenderOptions = { band: number; minimum: number; maximum: number; colormapName?: string; colormap?: RemoteColorInterval[] }

const routes = { stac: "/api/thematic/stac", tiles: "/api/thematic/tiles", files: "/api/thematic/files" }
const origins = { stac: "http://192.168.10.15:5951", tiles: "http://192.168.10.15:5952", files: "http://192.168.10.15:9002" }
export const remoteCollections = [
  { id: "spatial-thematic", name: "人口、GDP、地表温度与参考矢量" },
  { id: "insar-deformation", name: "InSAR 形变速率" },
  { id: "fy3-mersi-l1", name: "风云 MERSI 影像" },
  { id: "fy-thermal", name: "风云地表温度" },
  { id: "geohazard-spot", name: "待核查隐患图斑" },
  { id: "gf-optical", name: "高分光学影像" },
  { id: "thermal-background", name: "后台背景网格" }, { id: "thermal-anomaly", name: "后台异常要素" }, { id: "thematic-map", name: "后台图层成果" }
] as const
const scalarCollections = new Set(["spatial-thematic", "insar-deformation", "fy-thermal"])

export function remoteBounds(value: unknown): RectInfo {
  if (!Array.isArray(value) || value.length !== 4 || value.some(v => typeof v !== "number" || !Number.isFinite(v))) { throw new Error("数据缺少有效的经纬度覆盖范围") }
  const [west, south, east, north] = value
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) { throw new Error("数据范围无效或跨越日期变更线，需先适配") }
  return { west, south, east, north }
}
export function pointInside(bounds: RectInfo, longitude: number, latitude: number) {
  return Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= bounds.west && longitude <= bounds.east && latitude >= bounds.south && latitude <= bounds.north
}
function segment(value: string) {
  if (!value || value === "." || value === ".." || /[\\/?#]/.test(value) || Array.from(value).some(c => c.charCodeAt(0) < 32)) { throw new Error("目录标识无效") }
  return encodeURIComponent(value)
}
export function remoteItemPath(item: Pick<RemoteItem, "collection" | "id">) { return `/collections/${segment(item.collection)}/items/${segment(item.id)}` }

// Only the documented read services may supply browser-visible resource URLs.
export function remoteProxyUrl(service: keyof typeof routes, href: string): string {
  let url: URL
  try { url = new URL(href, window.location.origin) } catch { throw new Error("资产地址无效") }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.hash) { throw new Error("资产必须是无凭据的 HTTP 地址，不能直接打开 s3/minio 地址") }
  let pathname = url.pathname
  if (url.origin === window.location.origin && pathname.startsWith(`${routes[service]}/`)) { pathname = pathname.slice(routes[service].length) } else if (url.origin !== origins[service]) { throw new Error("资产地址不属于已配置的数据服务，未加载外部地址") }
  if (service === "files" && !validThematicObjectPath(pathname)) { throw new Error("文件地址不是有效的 MinIO 对象路径") }
  if (service === "tiles" && !pathname.startsWith("/collections/")) { throw new Error("无效的目录瓦片地址") }
  return `${routes[service]}${pathname}${url.search}`.replace(/%7B(z|x|y)%7D/gi, "{$1}")
}

async function requestJson(url: string, init: RequestInit = {}, signal?: AbortSignal, maxBytes = 10 * 1024 * 1024): Promise<any> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.throwIfAborted()
  signal?.addEventListener("abort", abort, { once: true })
  const timer = setTimeout(abort, 20000)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, credentials: "omit", cache: "no-store" })
    if (!response.ok) { throw new Error(`数据读取失败（HTTP ${response.status}），请核查服务、资产及内网连接`) }
    if (Number(response.headers.get("content-length")) > maxBytes) { await response.body?.cancel(); throw new Error(`数据超过 ${maxBytes / 1024 / 1024} MB，请由后端按范围裁切后返回`) }
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > maxBytes) { throw new Error(`数据超过 ${maxBytes / 1024 / 1024} MB，请缩小查询范围`) }
    const result = JSON.parse(text)
    controller.signal.throwIfAborted()
    return result
  } catch (error) {
    signal?.throwIfAborted()
    if (controller.signal.aborted) { throw new Error("数据服务请求超时，请检查内网/VPN 后重试") }
    if (error instanceof TypeError) { throw new Error("无法连接数据服务，请检查内网/VPN 和专题数据代理配置") }
    throw error
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort) }
}

export function readRemoteItem(raw: any): RemoteItem {
  if (raw?.type !== "Feature" || typeof raw.id !== "string" || typeof raw.collection !== "string" || !raw.properties || typeof raw.properties !== "object" || !raw.assets || typeof raw.assets !== "object") { throw new Error("STAC 条目结构无效") }
  segment(raw.collection); segment(raw.id); remoteBounds(raw.bbox)
  return raw
}
export async function searchStacPage(body: Record<string, unknown>, signal?: AbortSignal, token?: string) {
  if (token !== undefined && (typeof token !== "string" || !token || token.length > 4096)) { throw new Error("无效的目录分页令牌") }
  const raw = await requestJson(`${routes.stac}/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...(token ? { token } : {}) }) }, signal)
  if (raw?.type !== "FeatureCollection" || !Array.isArray(raw.features)) { throw new Error("STAC 检索结果无效") }
  const link = Array.isArray(raw.links) ? raw.links.find((link: any) => link.rel === "next") : undefined
  let nextToken: string | undefined
  if (link?.method === "POST" && typeof link.body?.token === "string" && link.body.token.length <= 4096) {
    try {
      const url = new URL(link.href, origins.stac)
      if (url.origin === origins.stac && url.pathname === "/search" && !url.username && !url.password && !url.search && !url.hash && link.body.token !== token) { nextToken = link.body.token }
    } catch { /* Unknown continuation links are reported, never followed to another origin. */ }
  }
  return { items: raw.features.map(readRemoteItem) as RemoteItem[], hasMore: !!link, nextToken }
}
export async function searchRemoteItems(collection: string, bounds?: RectInfo | null, signal?: AbortSignal, token?: string) {
  segment(collection)
  const body: Record<string, unknown> = { collections: [collection], limit: 50 }
  if (bounds) { const b = remoteBounds([bounds.west, bounds.south, bounds.east, bounds.north]); body.bbox = [b.west, b.south, b.east, b.north] }
  const result = await searchStacPage(body, signal, token)
  const all = result.items
  if (all.some(item => item.collection !== collection)) { throw new Error("目录返回了不匹配的数据集") }
  return { items: all, excluded: 0, hasMore: result.hasMore, nextToken: result.nextToken }
}
export async function listRemoteCollections(signal?: AbortSignal): Promise<Array<{ id: string; name: string }>> {
  const result = await requestJson(`${routes.stac}/collections?limit=1000`, {}, signal)
  if (!Array.isArray(result.collections)) { throw new Error("后台数据集目录格式无效") }
  return result.collections.map((entry: any) => { segment(entry.id); return { id: entry.id, name: String(entry.title || entry.id) } })
}
export async function refreshRemoteItem(item: RemoteItem, signal?: AbortSignal) {
  const current = readRemoteItem(await requestJson(`${routes.stac}${remoteItemPath(item)}`, {}, signal))
  if (current.id !== item.id || current.collection !== item.collection) { throw new Error("目录条目身份已改变，请重新查询") }
  return current
}
export function remoteItemTitle(item: RemoteItem) { return String(item.properties.title || item.id) }
export function remoteItemNotice(item: RemoteItem) {
  const packaged = packageProduct(item.id)
  if (packaged?.kind === "population") { return "整合包已提供的人口密度原始视觉资产；不替代正式人口统计汇总。" }
  if (packaged?.kind === "gdp") { return "整合包已提供的 GDP 密度原始视觉资产；不替代正式经济统计汇总。" }
  if (item.id === "SP-landsat-lst-20260216") { return "Landsat SR LST 原始参考网格，仅 9×9 像元，约 0.28°；资料时段为 2026-02-16 至 2026-04-15，并非逐日序列。单位未注明，不推定为 ℃ 或 K，不作为历史基线或地震热异常结论；位置以原始网格为准。" }
  if (supplementalItem(item)) { return supplementalNotice(item) }
  if (backendResultKind(item)) { return `${String(item.properties["background:method"] || item.properties["thermal_anomaly:method"] || "后台已有计算成果")}；仅显示后台实际指标，非正式地震烈度、灾损或预测结论；来源和单位仍需核验。` }
  if (item.id === "SP-luding-intensity") { return "后台已提供烈度矢量，可直接叠加；来源说明将其标为示意椭圆，保留该说明，不自动认定为调查等震线。" }
  if (/pop2020|gdp2020/.test(item.id)) { return "2020 年历史参考数据；目录单位尚待原始来源确认。不使用预览中烧入的示意烈度和震中，不生成正式总量或经济损失。" }
  if (item.id === "SP-fault_zones_shp") { return "断裂带范围面参考数据，不是活动断层线；来源与精度待核验。" }
  if (item.collection === "insar-deformation") { return "形变速率参考数据，不是累计 LOS 位移；缺少相干性，不用于现有 LOS 分析或灾损结论。" }
  if (item.collection === "geohazard-spot") { return "隐患图斑仅作参考，核查状态以属性为准；未核查、缺等级的成果不能作为已确认次生灾害。" }
  if (item.collection === "fy3-mersi-l1") { return "后台 MERSI 影像；热红外资产为亮温，不等于地表温度或地震热异常。" }
  return String(item.properties.description || "后台目录数据；按原始资产渲染，来源、单位及用途以数据说明和本次审核为准。")
}
export function remoteItemBlock(_item: RemoteItem) {
  return ""
}
export function remoteItemTime(item: RemoteItem) {
  if (item.id === "SP-landsat-lst-20260216" && typeof item.properties.datetime_range_start === "string" && typeof item.properties.datetime === "string") { return `${item.properties.datetime_range_start.slice(0, 10)} 至 ${item.properties.datetime.slice(0, 10)}（资料时段）` }
  return item.properties["grid:year"] ? `${item.properties["grid:year"]} 年` : String(item.properties.datetime || item.properties.start_datetime || "时间未提供")
}
export function remoteCatalogUnit(item: RemoteItem, assetKey: string) {
  if (item.id === "SP-landsat-lst-20260216") { return item.assets[assetKey]?.unit || "原始值（单位待核验）" }
  return String(item.assets[assetKey]?.unit || item.properties["grid:unit"] || item.properties["deformation:unit"] || "未提供")
}
export function remoteLayerAssets(item: RemoteItem): RemoteLayerAsset[] {
  const preferred = ["grid", "data", "visual", "surface", "thermal", "visible", "source"]
  const keys = [...new Set([...preferred.filter(key => item.assets[key]), ...Object.keys(item.assets)])]
  return keys.flatMap(key => {
    const asset = item.assets[key]
    if (!asset || typeof asset.href !== "string") { return [] }
    const vector = /geo\+json|geojson/i.test(asset.type || "") || /\.geojson(?:\?|$)/i.test(asset.href)
    const raster = /image\/tiff/i.test(asset.type || "") || /\.tiff?(?:\?|$)/i.test(asset.href)
    if (!vector && !raster) { return [] }
    const numeric = raster && (item.id === "SP-landsat-lst-20260216" || !["visual", "surface"].includes(key))
    let range: [number, number] = [200, 330]
    if (item.collection === "insar-deformation") { range = [-50, 50] } else if (/gdp2020/.test(item.id)) { range = [0, 50000] } else if (/pop2020/.test(item.id)) { range = [0, 5000] } else if (key === "visible") { range = [0, 1] }
    if (item.id === "SP-landsat-lst-20260216") { range = [0, 50] }
    const bands = asset.bands || asset["raster:bands"] || item.properties["raster:bands"] || Array.from({ length: Math.min(256, Math.max(1, Number(item.properties["eo:band_count"]) || 1)) }, () => ({}))
    const first = bands[0]; const minimum = first?.min ?? first?.statistics?.minimum; const maximum = first?.max ?? first?.statistics?.maximum
    if (Number.isFinite(minimum) && Number.isFinite(maximum) && minimum < maximum) { range = [minimum, maximum] }
    return [{ key, title: String(asset.title || key), kind: vector ? "vector" as const : "raster" as const, numeric, bands: bands.map((b: any, i: number) => b.name || `波段 ${i + 1}`), range }]
  })
}
function numericOptions(asset: RemoteLayerAsset, options: RemoteRenderOptions) {
  if (!Number.isInteger(options.band) || options.band < 1 || options.band > asset.bands.length) { throw new Error("请选择有效波段") }
  if (![options.minimum, options.maximum].every(Number.isFinite) || options.minimum >= options.maximum) { throw new Error("显示拉伸上限必须大于下限") }
}
function assetParams(asset: RemoteLayerAsset, band: number) {
  const params = new URLSearchParams({ assets: asset.key })
  if (asset.numeric) { params.set("asset_bidx", `${asset.key}|${band}`) }
  return params
}
export function remoteRasterParams(asset: RemoteLayerAsset, options: RemoteRenderOptions) {
  if (asset.numeric) { numericOptions(asset, options) }
  const params = assetParams(asset, options.band)
  if (asset.numeric) {
    if (options.colormap) {
      if (!options.colormap.length || options.colormap.length > 20 || options.colormap.some(([range, rgba], i, all) => range.length !== 2 || !range.every(Number.isFinite) || range[0] >= range[1] || (i > 0 && range[0] !== all[i - 1][0][1]) || rgba.length !== 4 || rgba.some(v => !Number.isInteger(v) || v < 0 || v > 255))) { throw new Error("后端分类色带区间无效或不连续") }
      params.set("colormap", JSON.stringify(options.colormap))
    } else {
      const name = options.colormapName || "gray"
      if (!["gray", "inferno", "blues", "greens", "rdbu_r", "viridis"].includes(name)) { throw new Error("尚未适配该后端色带") }
      params.set("rescale", `${options.minimum},${options.maximum}`); params.set("colormap_name", name)
    }
  }
  params.set("resampling", "nearest"); params.set("reproject", "nearest"); params.set("return_mask", "true")
  return params
}
export async function remoteRaster(item: RemoteItem, asset: RemoteLayerAsset, options: RemoteRenderOptions, signal?: AbortSignal): Promise<RemoteRaster> {
  if (asset.kind !== "raster" || !remoteLayerAssets(item).some(a => a.key === asset.key)) { throw new Error("不是可显示的栅格资产") }
  const params = remoteRasterParams(asset, options)
  const raw = await requestJson(`${routes.tiles}${remoteItemPath(item)}/WebMercatorQuad/tilejson.json?${params}`, {}, signal)
  if (raw.scheme && raw.scheme !== "xyz") { throw new Error("当前只支持 XYZ 瓦片方案") }
  if (!Array.isArray(raw.tiles) || !raw.tiles.length || !Number.isInteger(raw.minzoom) || !Number.isInteger(raw.maxzoom) || raw.minzoom < 0 || raw.maxzoom < raw.minzoom || raw.maxzoom > 24) { throw new Error("瓦片目录缺少有效地址或层级") }
  const url = remoteProxyUrl("tiles", raw.tiles[0])
  if (!["{z}", "{x}", "{y}"].every(tag => url.includes(tag)) || !url.startsWith(`${routes.tiles}${remoteItemPath(item)}/tiles/`)) { throw new Error("瓦片地址与当前条目不匹配") }
  const tileParams = new URL(url, window.location.origin).searchParams
  if (tileParams.get("assets") !== asset.key || (asset.numeric && tileParams.get("asset_bidx") !== `${asset.key}|${options.band}`)) { throw new Error("瓦片返回了不匹配的资产或波段") }
  for (const key of ["rescale", "colormap_name", "colormap"]) {
    if (params.has(key) && tileParams.get(key) !== params.get(key)) { throw new Error("瓦片服务未保留请求的渲染参数，未使用不匹配的图层") }
  }
  const bounds = remoteBounds(raw.bounds || item.bbox)
  const original = remoteBounds(item.bbox)
  if (bounds.west >= original.east || bounds.east <= original.west || bounds.south >= original.north || bounds.north <= original.south) { throw new Error("瓦片覆盖范围与目录不相交，不会移动图层填充选区") }
  return { url, bounds, minZoom: raw.minzoom, maxZoom: raw.maxzoom }
}
export async function remoteVector(item: RemoteItem, asset: RemoteLayerAsset, signal?: AbortSignal, bounds?: RectInfo): Promise<TemplateDocument> {
  checkRemoteVector(item, asset, bounds)
  const raw = await requestJson(remoteProxyUrl("files", item.assets[asset.key].href), {}, signal, supplementalItem(item) ? 25 * 1024 * 1024 : undefined)
  return readRemoteVector(raw, item, asset, bounds)
}
function checkRemoteVector(item: RemoteItem, asset: RemoteLayerAsset, bounds?: RectInfo) {
  if (asset.kind !== "vector" || !remoteLayerAssets(item).some(a => a.key === asset.key)) { throw new Error("不是可读取的矢量资产") }
  const epsg = item.properties["proj:epsg"]
  if (epsg !== undefined && ![4326, 4490].includes(epsg)) { throw new Error("矢量坐标需先进行有依据的转换") }
  if (supplementalItem(item) && epsg !== 4326) { throw new Error("此批新增矢量需后台确认已发布为 WGS84，不直接改写坐标标签") }
  if (supplementalItem(item) && !bounds) { throw new Error("新接入基础矢量必须先确认框选范围") }
}
export function readRemoteVector(raw: unknown, item: RemoteItem, asset: RemoteLayerAsset, bounds?: RectInfo): TemplateDocument {
  checkRemoteVector(item, asset, bounds)
  const epsg = item.properties["proj:epsg"]
  if (supplementalItem(item)) { return readSupplementalVector(raw, item, asset.key, bounds!) }
  const value = normalizeContentGeometry(raw) as Record<string, any>
  const document = readBusinessDocument({ ...value, metadata: { ...value?.metadata, crs: epsg ? `EPSG:${epsg}` : "CRS84", source: item.assets[asset.key].href, usage: "reference", referenceOnly: true, collection: item.collection, itemId: item.id, revisionId: item.properties.updated || "", notice: remoteItemNotice(item) } }, remoteItemTitle(item))
  if (document.features.length > 10000) { throw new Error("矢量要素超过 10000，请先按范围裁切") }
  return document
}
export async function remotePoint(item: RemoteItem, asset: RemoteLayerAsset, band: number, longitude: number, latitude: number, signal?: AbortSignal): Promise<RemotePoint> {
  if (!asset.numeric || asset.kind !== "raster") { throw new Error("彩色影像不能作为定量指标点查") }
  if (!pointInside(remoteBounds(item.bbox), longitude, latitude)) { throw new Error("点位不在数据覆盖范围内，不会挪移或补值") }
  numericOptions(asset, { band, minimum: 0, maximum: 1 })
  const raw = await requestJson(`${routes.tiles}${remoteItemPath(item)}/point/${longitude},${latitude}?${assetParams(asset, band)}`, {}, signal)
  if (!Array.isArray(raw.values) || raw.values.length !== 1 || !Array.isArray(raw.band_names) || raw.band_names[0] !== `${asset.key}_b${band}`) { throw new Error("点查返回的波段不匹配，未采用该数值") }
  let value = raw.values[0]
  if (Array.isArray(value) && value.length === 1) { value = value[0] }
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) { throw new Error("点查返回的数值无效") }
  // These scalar products were independently inspected with NoData=-9999.
  if (value === -9999 && scalarCollections.has(item.collection)) { value = null }
  return { longitude, latitude, value, band: raw.band_names[0] }
}
export async function remoteHeightPoint(item: RemoteItem, longitude: number, latitude: number, signal?: AbortSignal) {
  if (!/^SP-china-(pop|gdp)2020$/.test(item.id) || !/\.tiff?(?:\?|$)/i.test(item.assets.height?.href || "")) { throw new Error("此条目没有已适配的派生高度资产") }
  return remotePoint(item, { key: "height", title: "派生高度（非实际地形）", kind: "raster", numeric: true, bands: ["派生高度"], range: [0, 1] }, 1, longitude, latitude, signal)
}
