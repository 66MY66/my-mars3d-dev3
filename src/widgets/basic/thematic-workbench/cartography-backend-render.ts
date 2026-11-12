import { remoteBounds, remoteCatalogUnit, remoteItemPath, remoteRaster, remoteRasterParams, type RemoteItem, type RemoteLayerAsset, type RemoteRenderOptions } from "./remote-cartography-source"
import { printRasterPlan } from "./cartography-print-source"
import type { CartographySourceWindow, SourceWindowOptions } from "./cartography-source-window"
import type { RectInfo } from "./map"

export type BackendDisplay = "rgb" | "preset" | "surface" | "reflectance" | "brightness" | "temperature" | "population" | "economy" | "rate" | "scalar"
export function backendDisplay(item: RemoteItem, asset: RemoteLayerAsset): BackendDisplay {
  if (asset.key === "surface" && !asset.numeric) { return "surface" }
  if (asset.key === "visual" && !asset.numeric && (item.collection === "insar-deformation" || /^SP-china-(pop|gdp)2020$/.test(item.id))) { return "preset" }
  if (!asset.numeric) { return "rgb" }
  if (asset.quantity) { return asset.quantity }
  if (item.id === "SP-landsat-lst-20260216") { return "temperature" }
  if (item.collection === "fy3-mersi-l1" && asset.key === "visible") { return "reflectance" }
  if (item.collection === "fy3-mersi-l1" && asset.key === "thermal") { return "brightness" }
  if (item.collection === "insar-deformation") { return "rate" }
  const role = item.properties["cartography:role"]
  if (role === "population" || /^SP-(china|luding)-pop2020$/.test(item.id)) { return "population" }
  if (role === "economy" || /^SP-(china|luding)-gdp2020$/.test(item.id)) { return "economy" }
  return "scalar"
}
export function backendRange(item: RemoteItem, asset: RemoteLayerAsset, band = 1): [number, number] {
  const source = item.assets[asset.key]
  const metadata = source?.bands?.[band - 1] || source?.["raster:bands"]?.[band - 1] || item.properties["raster:bands"]?.[band - 1]
  if (metadata && Number.isFinite(metadata.min) && Number.isFinite(metadata.max) && metadata.min! < metadata.max!) { return [metadata.min!, metadata.max!] }
  if (backendDisplay(item, asset) === "rate") {
    const limit = Math.max(Math.abs(Number(item.properties["deformation:min_rate"])), Math.abs(Number(item.properties["deformation:max_rate"])))
    if (Number.isFinite(limit) && limit > 0) { return [-limit, limit] }
  }
  return asset.range
}
export function classifiedDisplay(item: RemoteItem, asset: RemoteLayerAsset, topic: string) {
  return asset.numeric && ["population", "economy"].includes(backendDisplay(item, asset)) && !["raster-ramp", "raster-threshold"].includes(topic)
}
export function backendRenderPlan(item: RemoteItem, asset: RemoteLayerAsset, topic: string, options: SourceWindowOptions, raw: CartographySourceWindow | null) {
  const kind = backendDisplay(item, asset)
  const unit = remoteCatalogUnit(item, asset.key)
  const params: RemoteRenderOptions = { band: options.band, minimum: options.minimum, maximum: options.maximum }
  let label = "后台真彩色影像"
  if (kind === "surface") { label = "后台三维成果设色栅格 · 平面叠加（非实际地形）" }
  if (kind === "preset") { label = "后台预设设色栅格 · 分级阈值与完整图例待核验" }
  let legend: Array<{ label: string; color: string }> = []
  if (kind === "reflectance") { params.colormapName = "gray"; label = "单波段反射率 · 灰度线性拉伸" }
  if (kind === "scalar") {
    params.colormapName = "gray"; label = "原始数值 · 灰度线性拉伸（不推断业务物理量）"
    if (options.automatic !== false && raw?.statistics?.minimum != null && raw.statistics.maximum != null) {
      params.minimum = raw.statistics.minimum; params.maximum = raw.statistics.maximum
      if (params.minimum === params.maximum) { params.maximum = params.minimum + Math.max(1, Math.abs(params.minimum) * Number.EPSILON * 2) }
    }
  }
  if (kind === "brightness") { params.colormapName = "inferno"; label = "单波段亮温 · 连续色带（非地表温度）" }
  if (kind === "temperature") {
    params.colormapName = "inferno"; label = "Landsat 地表温度原值 · 连续色带（单位待核验）"
    if (options.automatic !== false) {
      if (raw?.statistics?.minimum == null || raw.statistics.maximum == null) { throw new Error("地表温度自动拉伸需要选区有效原值，不能生成示意温度") }
      params.minimum = raw.statistics.minimum; params.maximum = raw.statistics.maximum
      if (params.minimum === params.maximum) { params.maximum = params.minimum + Math.max(1, Math.abs(params.minimum) * Number.EPSILON * 2) }
    }
  }
  if (kind === "rate") { params.colormapName = "rdbu_r"; label = "形变速率 · 零中心发散色带"; const limit = Math.max(Math.abs(params.minimum), Math.abs(params.maximum)); params.minimum = -limit; params.maximum = limit }
  if (["population", "economy", "temperature"].includes(kind)) {
    if (kind !== "temperature") { params.colormapName = kind === "population" ? "blues" : "greens"; label = `${kind === "population" ? "人口" : "GDP"}原值 · 连续色带` }
    if (topic === "raster-threshold") {
      if (!Number.isFinite(options.threshold)) { throw new Error("请先填写有依据的原值分类阈值，不默认生成预警阈值") }
      const low: [number, number, number, number] = [238, 242, 246, 255]
      let high: [number, number, number, number] = [0, 109, 44, 255]; let highColor = "#006d2c"
      if (kind === "population") { high = [8, 81, 156, 255]; highColor = "#08519c" } else if (kind === "temperature") { high = [188, 55, 84, 255]; highColor = "#bc3754" }
      params.colormap = [[[-Number.MAX_VALUE, options.threshold!], low], [[options.threshold!, Number.MAX_VALUE], high]]
      delete params.colormapName; label = "原值阈值二分类 · 非业务预警结论"
      legend = [{ color: "#eef2f6", label: `< ${options.threshold} ${unit}` }, { color: highColor, label: `≥ ${options.threshold} ${unit}` }]
    }
    if (classifiedDisplay(item, asset, topic)) {
      if (!raw?.breaks?.length) { throw new Error("分级设色需要选区原始数值断点，请缩小范围后重试；不会用示意断点代替") }
      const colors = raw.legend.filter(row => !row.label.includes("NoData"))
      params.colormap = raw.breaks.map((end, i) => {
        const rgb = colors[i].color.slice(1).match(/../g)!.map(v => parseInt(v, 16))
        // rio-tiler intervals are [lower, upper); match the frontend's <= class endpoints.
        const upper = i === raw.breaks!.length - 1 ? Number.MAX_VALUE : end + Math.max(Number.MIN_VALUE, Math.abs(end) * Number.EPSILON * 2)
        const lower = i ? raw.breaks![i - 1] + Math.max(Number.MIN_VALUE, Math.abs(raw.breaks![i - 1]) * Number.EPSILON * 2) : -Number.MAX_VALUE
        return [[lower, upper], [...rgb, 255]] as [[number, number], [number, number, number, number]]
      })
      delete params.colormapName; legend = raw.legend; label = `${kind === "population" ? "人口" : "GDP"}原值 · 选区分级设色`
    }
  }
  if (asset.numeric && !legend.length) {
    const palettes = { gray: ["#000000", "#808080", "#ffffff"], inferno: ["#000004", "#bc3754", "#fcffa4"], rdbu_r: ["#053061", "#f7f7f7", "#67001f"], blues: ["#f7fbff", "#6baed6", "#08306b"], greens: ["#f7fcf5", "#74c476", "#00441b"] }
    legend = palettes[params.colormapName as keyof typeof palettes].map((color, i) => ({ color, label: `${Number((params.minimum + (params.maximum - params.minimum) * i / 2).toPrecision(6))} ${unit}` }))
  }
  return { kind, label, params, legend, unit }
}

export async function backendRasterLayer(item: RemoteItem, asset: RemoteLayerAsset, scope: RectInfo, plan: ReturnType<typeof backendRenderPlan>, signal: AbortSignal, dpi = 300) {
  const raster = await remoteRaster(item, asset, plan.params, signal)
  const output = printRasterPlan(scope, raster.bounds, dpi)
  const { bounds, width, height } = output
  const controller = new AbortController(); const abort = () => controller.abort()
  signal.throwIfAborted(); signal.addEventListener("abort", abort, { once: true }); const timer = setTimeout(abort, 120000)
  try {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height
    const context = canvas.getContext("2d")!; const urls: string[] = []
    context.imageSmoothingEnabled = false
    for (const tile of output.tiles) {
      controller.signal.throwIfAborted()
      const query = remoteRasterParams(asset, plan.params)
      query.set("coord_crs", "EPSG:4326"); query.set("dst_crs", "EPSG:4326"); query.set("width", String(tile.width)); query.set("height", String(tile.height))
      const b = tile.bounds
      const url = `/api/thematic/tiles${remoteItemPath(item)}/bbox/${[b.west, b.south, b.east, b.north].join(",")}.png?${query}`
      const response = await fetch(url, { signal: controller.signal, credentials: "omit", cache: "no-store" })
      if (!response.ok || !response.headers.get("content-type")?.includes("image/png")) { throw new Error(`后端制图裁剪失败（HTTP ${response.status}），未生成替代图片`) }
      const blob = await response.blob()
      if (!blob.size || blob.size > 12 * 1024 * 1024) { throw new Error("后端校样分块图片大小无效") }
      const signature = new Uint8Array((await blob.arrayBuffer()).slice(0, 8))
      if (signature.join(",") !== "137,80,78,71,13,10,26,10") { throw new Error("后端未返回有效 PNG，未伪造校样") }
      const bitmap = await createImageBitmap(blob)
      try {
        if (bitmap.width !== tile.width || bitmap.height !== tile.height) { throw new Error("后台未保留请求的分块尺寸，地理定位未通过核对") }
        context.drawImage(bitmap, tile.x, tile.y)
      } finally { bitmap.close() }
      urls.push(url)
    }
    const pixels = context.getImageData(0, 0, width, height).data
    if (!pixels.some((v, i) => i % 4 === 3 && v > 0)) { throw new Error("后台返回的选区像元全部缺测，未标记为已渲染") }
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("后端校样拼接失败")), "image/png"))
    if (blob.size > 25_000_000) { throw new Error("源图文件过大，请降低源图 DPI 或拆分图幅") }
    const bytes = await blob.arrayBuffer()
    const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("后端校样读取失败")); reader.readAsDataURL(blob) })
    signal.throwIfAborted(); controller.signal.throwIfAborted()
    const identity = JSON.stringify({ item: item.id, collection: item.collection, asset: asset.key, updated: item.properties.updated, scope, plan, urls, dpi, tileUrl: raster.url })
    const identityBytes = new TextEncoder().encode(identity); const combined = new Uint8Array(identityBytes.length + bytes.byteLength); combined.set(identityBytes); combined.set(new Uint8Array(bytes), identityBytes.length)
    const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", combined)), b => b.toString(16).padStart(2, "0")).join("")
    canvas.width = 0; canvas.height = 0
    return { raster: { ...raster, bounds }, image, bounds, coverage: remoteBounds(item.bbox), fingerprint, url: urls[0], urls, dpi, tileUrl: raster.url, width, height }
  } catch (error) {
    signal.throwIfAborted()
    if (controller.signal.aborted) { throw new Error("后端校样请求超时，请检查内网/VPN") }
    throw error
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort) }
}

export async function backendMapLayer(item: RemoteItem, asset: RemoteLayerAsset, scope: RectInfo, plan: ReturnType<typeof backendRenderPlan>, signal: AbortSignal) {
  const source = await remoteRaster(item, asset, plan.params, signal)
  const bounds = { west: Math.max(scope.west, source.bounds.west), south: Math.max(scope.south, source.bounds.south), east: Math.min(scope.east, source.bounds.east), north: Math.min(scope.north, source.bounds.north) }
  if (bounds.west >= bounds.east || bounds.south >= bounds.north) { throw new Error("当前范围没有可显示的源数据，不移动或拉伸图层填满选区") }
  const identity = JSON.stringify({ collection: item.collection, itemId: item.id, asset: asset.key, revision: item.properties.updated || "", scope, plan, tileUrl: source.url })
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity))), b => b.toString(16).padStart(2, "0")).join("")
  signal.throwIfAborted()
  return { raster: { ...source, bounds }, bounds, fingerprint, tileUrl: source.url }
}
