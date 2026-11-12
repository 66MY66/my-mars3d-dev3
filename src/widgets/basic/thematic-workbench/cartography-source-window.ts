import { remoteBounds, remoteProxyUrl, type RemoteItem, type RemoteLayerAsset, type RemoteRenderOptions } from "./remote-cartography-source"
import { intersectBounds } from "./cartography-workflow"
import type { RectInfo } from "./map"
import { classBreaks } from "./render-style"
import { sampleTemplatePalette } from "./template-palettes"

export type RawWindowStatistics = { valid: number; missing: number; outside: number; minimum: number | null; maximum: number | null; mean: number | null }
export type CartographySourceWindow = { image: string; bounds: RectInfo; sourceBounds: RectInfo; crs: string; width: number; height: number; sourceWindow: number[]; statistics: RawWindowStatistics | null; legend: Array<{ label: string; color: string }>; fingerprint: string; breaks?: number[] }
export type SourceWindowOptions = RemoteRenderOptions & { automatic?: boolean; method?: "equal" | "quantile" | "natural"; count?: number; statisticsOnly?: boolean; threshold?: number; fixedBreaks?: number[] }
export function summarizeRawValues(values: Array<number | null | undefined>): RawWindowStatistics {
  let valid = 0; let missing = 0; let outside = 0; let sum = 0; let minimum = Infinity; let maximum = -Infinity
  for (const value of values) {
    if (value === undefined) { outside++; continue }
    if (value === null) { missing++; continue }
    if (!Number.isFinite(value)) { throw new Error("原始栅格包含未声明为缺测的无效数值") }
    valid++; sum += value; minimum = Math.min(minimum, value); maximum = Math.max(maximum, value)
  }
  return { valid, missing, outside, minimum: valid ? minimum : null, maximum: valid ? maximum : null, mean: valid ? sum / valid : null }
}
export function originalWindow(width: number, height: number, source: RectInfo, scope: RectInfo) {
  const overlap = intersectBounds(source, scope)
  if (!overlap) { throw new Error("框选范围与原始栅格不相交") }
  const dx = (source.east - source.west) / width; const dy = (source.north - source.south) / height
  const window = [Math.max(0, Math.floor((overlap.west - source.west) / dx)), Math.max(0, Math.floor((source.north - overlap.north) / dy)), Math.min(width, Math.ceil((overlap.east - source.west) / dx)), Math.min(height, Math.ceil((source.north - overlap.south) / dy))]
  const w = window[2] - window[0]; const h = window[3] - window[1]
  if (!w || !h || w * h > 1_000_000) { throw new Error("选区超过 100 万原始像元，请缩小范围或接入后端裁剪；不会降采样冒充原始统计") }
  return { window, width: w, height: h, dx, dy, bounds: { west: source.west + window[0] * dx, east: source.west + window[2] * dx, north: source.north - window[1] * dy, south: source.north - window[3] * dy } }
}
export function displayWindow(geometry: ReturnType<typeof originalWindow>, scope: RectInfo) {
  const bounds = intersectBounds(geometry.bounds, scope)
  if (!bounds) { throw new Error("显示窗口与框选范围不相交") }
  return { bounds, x: (bounds.west - geometry.bounds.west) / geometry.dx, y: (geometry.bounds.north - bounds.north) / geometry.dy, width: (bounds.east - bounds.west) / geometry.dx, height: (bounds.north - bounds.south) / geometry.dy }
}
export function classifyRawValues(values: Array<number | null | undefined>, options: SourceWindowOptions, theme = "population") {
  const summary = summarizeRawValues(values)
  if (!summary.valid) { throw new Error("选区原始像元全部缺测，没有可渲染的有效数值") }
  const count = options.count ?? 5; const method = options.method || "quantile"
  if (!Number.isInteger(count) || count < 2 || count > 9 || !["equal", "quantile", "natural"].includes(method)) { throw new Error("分级方法或数量无效") }
  let low = options.minimum; let high = options.maximum
  if (options.automatic !== false && !options.fixedBreaks) { low = summary.minimum!; high = summary.maximum! }
  if (theme === "rate") { const maximum = Math.max(Math.abs(low), Math.abs(high)); low = -maximum; high = maximum }
  if (![low, high].every(Number.isFinite) || low > high) { throw new Error("显示范围无效") }
  const valid = values.filter((v): v is number => v !== null && v !== undefined)
  if (options.fixedBreaks && (!options.fixedBreaks.length || options.fixedBreaks.length > 9 || options.fixedBreaks.some((v, i, all) => !Number.isFinite(v) || (i > 0 && v <= all[i - 1])) || options.fixedBreaks[0] < low)) { throw new Error("固定断点须为不小于下限的递增有限数值，最多 9 级") }
  const calculated = () => options.automatic !== false && theme !== "rate" ? [...new Set(classBreaks(valid, method, count))] : Array.from({ length: low === high ? 1 : count }, (_, i) => low + (high - low) * (i + 1) / count)
  const breaks = options.fixedBreaks ? [...options.fixedBreaks] : calculated()
  let palette = ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"]
  if (theme === "economy") { palette = ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"] }
  if (theme === "rate") { palette = ["#2166ac", "#67a9cf", "#f7f7f7", "#ef8a62", "#b2182b"] }
  const colors = breaks.map((_, i) => sampleTemplatePalette(palette, i / Math.max(1, breaks.length - 1)))
  const format = (v: number) => Number(v.toPrecision(6))
  const legend = breaks.map((end, i) => ({ color: colors[i], label: `${i ? "(" : "["}${format(i ? breaks[i - 1] : low)}, ${format(end)}] 原始值` }))
  if (options.automatic === false) { legend[0].label += "（含下限以下）"; legend[legend.length - 1].label += "（含上限以上）" }
  if (summary.missing) { legend.push({ color: "#d9dee5", label: "NoData（缺测，非零值）" }) }
  return { summary, legend, breaks, color: (value: number) => { const index = breaks.findIndex(v => value <= v); return colors[index < 0 ? colors.length - 1 : index] } }
}
export async function readCartographyWindow(item: RemoteItem, asset: RemoteLayerAsset, scope: RectInfo, options: SourceWindowOptions, signal: AbortSignal): Promise<CartographySourceWindow> {
  const { fromUrl } = await import("geotiff")
  const file = await fromUrl(remoteProxyUrl("files", item.assets[asset.key].href), { allowFullFile: false }, signal)
  try {
    const image = await file.getImage(0)
    const keys = image.getGeoKeys(); const code = Number(keys?.GeographicTypeGeoKey)
    if (keys?.GTModelTypeGeoKey !== 2 || ![4326, 4490].includes(code)) { throw new Error("原始栅格不是已支持的地理坐标；请提供有依据的坐标转换成果") }
    if (item.properties["proj:epsg"] && item.properties["proj:epsg"] !== code) { throw new Error("目录坐标与原始 GeoTIFF 不一致，未改写标签") }
    const matrix = image.fileDirectory.getValue("ModelTransformation") as number[] | undefined
    if (matrix && (matrix[1] || matrix[4] || matrix[0] <= 0 || matrix[5] >= 0)) { throw new Error("旋转或翻转栅格需要先地理校正") }
    const origin = image.getOrigin(); const resolution = image.getResolution()
    if (!(resolution[0] > 0 && resolution[1] < 0)) { throw new Error("仅直接读取北向上的原始栅格") }
    const pointPixel = keys?.GTRasterTypeGeoKey === 2
    const west = origin[0] - (pointPixel ? resolution[0] / 2 : 0); const north = origin[1] - (pointPixel ? resolution[1] / 2 : 0)
    const sourceBounds = remoteBounds([west, north + image.getHeight() * resolution[1], west + image.getWidth() * resolution[0], north])
    if (!intersectBounds(sourceBounds, remoteBounds(item.bbox))) { throw new Error("目录范围与原始栅格不相交") }
    const geometry = originalWindow(image.getWidth(), image.getHeight(), sourceBounds, scope)
    if (!Number.isInteger(options.band) || options.band < 1 || options.band > image.getSamplesPerPixel()) { throw new Error("原始栅格缺少所选波段") }
    const samples = asset.numeric ? [options.band - 1] : [0, 1, 2]
    if (!asset.numeric && (image.getSamplesPerPixel() < 3 || samples.some(s => image.getBitsPerSample(s) !== 8))) { throw new Error("彩色预览需要明确的 8 位 RGB 资产，不能猜测多光谱显示参数") }
    const raw = await image.readRasters({ window: geometry.window, samples, interleave: true, signal })
    signal.throwIfAborted()
    const noData = image.getGDALNoData()
    const values: Array<number | null | undefined> = []
    const displayValues: Array<number | null> = []
    const numeric = asset.numeric
    if (numeric && options.automatic === false && (!Number.isFinite(options.minimum) || !Number.isFinite(options.maximum) || options.minimum >= options.maximum)) { throw new Error("显示范围上限必须大于下限") }
    for (let i = 0; i < geometry.width * geometry.height; i++) {
      const lon = geometry.bounds.west + (i % geometry.width + 0.5) * geometry.dx
      const lat = geometry.bounds.north - (Math.floor(i / geometry.width) + 0.5) * geometry.dy
      const value = Number(raw[i * samples.length])
      const missing = samples.every((_, j) => Number(raw[i * samples.length + j]) === noData || (Number.isNaN(Number(raw[i * samples.length + j])) && Number.isNaN(noData)))
      if (!missing && samples.some((_, j) => !Number.isFinite(Number(raw[i * samples.length + j])))) { throw new Error("原始栅格包含未声明的非有限数值") }
      displayValues.push(missing ? null : value)
      // Statistics use pixel centers; display retains the intersecting portion of edge cells.
      const inside = lon >= scope.west && lon <= scope.east && lat >= scope.south && lat <= scope.north
      values.push(inside ? displayValues[i] : undefined)
    }
    let theme = ["population", "economy", "rate"].includes(asset.quantity || "") ? asset.quantity! : ""
    if (!asset.quantity) {
      if (/pop2020/.test(item.id) || item.properties["cartography:role"] === "population") { theme = "population" }
      if (/gdp2020/.test(item.id) || item.properties["cartography:role"] === "economy") { theme = "economy" }
      if (item.collection === "insar-deformation") { theme = "rate" }
    }
    const classification = numeric && theme ? classifyRawValues(values, options, theme) : null
    const statistics = numeric ? summarizeRawValues(values) : null; const legend = classification?.legend || []
    if (classification && !statistics?.missing && displayValues.includes(null)) { legend.push({ color: "#d9dee5", label: "NoData（边界缺测，非零值）" }) }
    const display = displayWindow(geometry, scope)
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ renderer: "original-window-v3-content-quantity", collection: item.collection, id: item.id, asset: asset.key, quantity: asset.quantity, href: item.assets[asset.key].href, properties: item.properties, crs: code, sourceBounds, sourceWidth: image.getWidth(), sourceHeight: image.getHeight(), noData, pointPixel, scope, options, window: geometry.window, raw: Array.from(raw as ArrayLike<number>) })))
    const base = { bounds: display.bounds, sourceBounds, crs: `EPSG:${code}`, sourceWindow: geometry.window, statistics, legend, breaks: classification?.breaks, fingerprint: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("") }
    if (options.statisticsOnly) { return { ...base, image: "", width: geometry.width, height: geometry.height } }
    if (numeric && !classification) { throw new Error("此资产不使用人口分级色带，请通过后台瓦片和对应影像表达加载") }
    const canvas = document.createElement("canvas"); canvas.width = geometry.width; canvas.height = geometry.height
    const context = canvas.getContext("2d")!; const pixels = context.createImageData(canvas.width, canvas.height)
    for (let i = 0; i < displayValues.length; i++) {
      const value = displayValues[i]
      if (value === null) { pixels.data.set([217, 222, 229, 255], i * 4); continue }
      const rgb = classification ? classification.color(value).slice(1).match(/../g)!.map(v => parseInt(v, 16)) : samples.map((_, j) => Number(raw[i * 3 + j]))
      pixels.data.set([...rgb, 255], i * 4)
    }
    context.putImageData(pixels, 0, 0)
    const clipped = document.createElement("canvas"); clipped.width = Math.max(1, Math.ceil(display.width)); clipped.height = Math.max(1, Math.ceil(display.height))
    const clippedContext = clipped.getContext("2d")!; clippedContext.imageSmoothingEnabled = false
    clippedContext.drawImage(canvas, display.x, display.y, display.width, display.height, 0, 0, clipped.width, clipped.height)
    return { ...base, image: clipped.toDataURL("image/png"), width: clipped.width, height: clipped.height }
  } finally { await file.close() }
}
