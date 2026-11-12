import { pointOnFeature } from "@turf/turf"
import type { Feature, Position } from "geojson"
import { compositionSymbolImage } from "./composition-symbols"
import { dbtSymbolDefinitions, type DbtSymbolKind } from "./dbt116-symbols"
import { dbtTitle, dbtFeatureSymbol, dbtScopedLayers, inspectDbtDocument, intensityLabel, intensityThreshold, standardBounds, dbtDrawingBounds, type DbtBounds, type DbtDocument, type DbtLayer, type DbtTemplateId } from "./dbt116-standard"
import { dbtMapCode, dbtStatistics, fitDbtBounds, intensityBands } from "./dbt-cartography-rules"
import { layerEventParameters } from "./backend-event-parameters"
import { drawDbtDraft, type DbtMapPreview, type DbtCatalogPlate } from "./dbt-draft-preview"
import { styleSocioeconomicLayer } from "./socioeconomic-style"
import { populationColor, populationDensity, populationLegend } from "./population-grid"
import { layoutDbtInformation } from "./dbt-information-layout"
import { annotationIssueSummary } from "./cartography-release-checks"
import { layerCoverageGaps, needsCoverageCheck } from "./cartography-coverage"
import { referenceMapFrame } from "./cartography-map-frame"
import { drawCartographyText, measureCartographyText } from "./cartography-text"
import { remoteReferenceStyle } from "./remote-reference-style"
import { cartographyScale } from "./cartography-scale"
import { referenceGridStyle } from "./source-reference-grid"
import { sortedCartographyLayers } from "./cartography-layer-order"
import { cartographyLabel, placeCartographyLabels, type LabelCandidate } from "./cartography-labels"
import { vectorPaint, strokeCartographyLine, type VectorPaint } from "./cartography-vector-style"
import { uniqueLegendRows } from "./cartography-legend"
import { replayExpression, type ExpressionPresentation } from "./expression-presentation"
import { layerStyleDocument } from "./layer-style-options"

export const DBT_PAGE = { width: 1680, height: 1188, millimeters: [420, 297] as const, map: { x: 88, y: 196, w: 1076, h: 802 } }
const symbols = new Map<DbtSymbolKind, Promise<HTMLImageElement>>()
function symbolImage(kind: DbtSymbolKind) {
  if (!symbols.has(kind)) {
    symbols.set(kind, new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image); image.onerror = () => { symbols.delete(kind); reject(new Error(`标准符号加载失败：${kind}`)) }
      image.src = compositionSymbolImage(kind, "#202020")
    }))
  }
  return symbols.get(kind)!
}
export function fittedDbtBounds(bounds: DbtBounds): DbtBounds {
  return fitDbtBounds(bounds)
}
export async function renderDbtMap(canvas: HTMLCanvasElement, doc: DbtDocument | null, id: DbtTemplateId, options: { dpi?: number; draft?: boolean; layoutOnly?: boolean; mapPreview?: DbtMapPreview | null; catalogPlate?: DbtCatalogPlate; onProgress?: (stage: string) => void } = {}) {
  options.onProgress?.("正在准备地图版面")
  const dpi = options.dpi || 0
  canvas.width = dpi ? Math.round(420 / 25.4 * dpi) : DBT_PAGE.width
  canvas.height = dpi ? Math.round(297 / 25.4 * dpi) : DBT_PAGE.height
  const ctx = canvas.getContext("2d")!
  ctx.scale(canvas.width / DBT_PAGE.width, canvas.height / DBT_PAGE.height)
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, DBT_PAGE.width, DBT_PAGE.height)
  const issues: string[] = []
  const text = (value: string, x: number, y: number, w: number, h: number, size = 22, bold = false, center = false, halo = false, ink?: string) => {
    const layout = measureCartographyText(ctx, value, w, h, size, bold, Math.min(size, Math.max(12, Math.floor(size * 0.75))))
    if (!layout.fits) { throw new Error(`文字内容超出版面，请调整图幅或文字长度：${value.slice(0, 40)}`) }
    drawCartographyText(ctx, layout, x, y, w, h, bold, center, halo, ink)
  }
  const normativeBounds = doc && standardBounds(doc, id)
  const bounds = doc && (options.draft === false ? normativeBounds : dbtDrawingBounds(doc, id))
  const dataExtent = !!bounds && !normativeBounds && doc?.usage !== "reference"
  if (!bounds || options.layoutOnly) {
    await drawDbtDraft(ctx, doc, id, options.mapPreview, options.catalogPlate)
    return { bounds: null, issues: ["当前为底图草稿；正式出图仍需有效震情、快速评估烈度面及规范制图范围"], statistics: [], bands: [], legendCount: 0, legendY: 895, width: canvas.width, height: canvas.height }
  }
  const map = doc?.usage === "reference" ? referenceMapFrame(bounds, DBT_PAGE.map, "top") : DBT_PAGE.map
  if (map.w < 260 || map.h < 220) { throw new Error("当前选区长宽比无法在 A3 图件区清晰排布，请调整范围或分幅；未拉伸地图") }
  const project = (p: Position) => [map.x + (p[0] - bounds.west) / (bounds.east - bounds.west) * map.w, map.y + (bounds.north - p[1]) / (bounds.north - bounds.south) * map.h]
  const title = dataExtent && !doc?.event.time ? "人口栅格数据预览 · 正式震情与规范范围待补齐" : dbtTitle(doc!, id)
  text(title, 60, 38, 1560, 110, 36, true, true)
  ctx.fillStyle = "#f7f9f9"; ctx.fillRect(map.x, map.y, map.w, map.h)
  const used = new Set<DbtSymbolKind>()
  const missingTile = document.createElement("canvas"); missingTile.width = 8; missingTile.height = 8
  const missingContext = missingTile.getContext("2d")!; missingContext.fillStyle = "#d9dee5"; missingContext.fillRect(0, 0, 8, 8)
  missingContext.strokeStyle = "#8b969d"; missingContext.lineWidth = 1; missingContext.beginPath(); missingContext.moveTo(0, 8); missingContext.lineTo(8, 0); missingContext.stroke()
  const missingPattern = ctx.createPattern(missingTile, "repeat")!
  const validEvent = !!doc?.event.time && !!doc.event.place && doc.event.magnitude > 0
  const hasEpicenter = validEvent && doc!.event.longitude >= bounds.west && doc!.event.longitude <= bounds.east && doc!.event.latitude >= bounds.south && doc!.event.latitude <= bounds.north
  if (validEvent && !hasEpicenter) { issues.push("真实震中位于当前参考选区外，未在图廓外绘制震中；请核对事件与制图范围") }
  if (hasEpicenter) { used.add("dbt-current-epicenter") }
  const visible = doc
? dbtScopedLayers(doc, id).map(layer => {
    const expression = layer.onlineSource?.rendering?.parameters?.expression as ExpressionPresentation | undefined
    if (expression) {
      const scene = replayExpression(layerStyleDocument(layer), bounds, expression)
      return { ...layer, data: { type: "FeatureCollection" as const, features: scene.features }, legend: scene.legend }
    }
    if (layer.sourceGrid) { return { ...layer, legend: referenceGridStyle(layer.sourceGrid).legend } }
    return layer.grid ? { ...layer, legend: populationLegend() } : styleSocioeconomicLayer(layer)
  })
: []
  visible.forEach(layer => layer.data.features.forEach(feature => { const symbol = dbtFeatureSymbol(layer, feature); if (symbol) { used.add(symbol) } }))
  const images = new Map<DbtSymbolKind, HTMLImageElement>()
  options.onProgress?.("正在载入图例符号")
  for (const kind of used) { images.set(kind, await symbolImage(kind)) }
  options.onProgress?.("正在绘制专题图层")
  const drawSymbol = (kind: DbtSymbolKind, x: number, y: number, size = 24) => {
    const image = images.get(kind)
    if (image) { const ratio = Math.min(size / image.naturalWidth, size / image.naturalHeight); const width = image.naturalWidth * ratio; const height = image.naturalHeight * ratio; ctx.drawImage(image, x - width / 2, y - height / 2, width, height) }
  }
  const path = (points: Position[], close = false) => {
    points.forEach((p, i) => { const [x, y] = project(p); if (i) { ctx.lineTo(x, y) } else { ctx.moveTo(x, y) } })
    if (close) { ctx.closePath() }
  }
  const boundaryOrder = ["dbt-national-boundary", "dbt-province-boundary", "dbt-city-boundary", "dbt-county-boundary", "dbt-town-boundary"]
  const segmentKey = (a: Position, b: Position) => [a.slice(0, 2).map(v => v.toFixed(9)).join(","), b.slice(0, 2).map(v => v.toFixed(9)).join(",")].sort().join(";")
  const boundaryWinners = new Map<string, number>()
  const boundaryPaths = (feature: Feature): Position[][] => {
    if (Array.isArray(feature.properties?.cartographyOutline)) { return feature.properties.cartographyOutline }
    const g = feature.geometry
    if (g.type === "LineString") { return [g.coordinates] }
    if (g.type === "MultiLineString" || g.type === "Polygon") { return g.coordinates }
    return g.type === "MultiPolygon" ? g.coordinates.flat() : []
  }
  for (const layer of visible.filter(item => item.role === "boundary")) {
    for (const feature of layer.data.features) {
      const rank = boundaryOrder.indexOf(dbtFeatureSymbol(layer, feature) || "")
      for (const line of boundaryPaths(feature)) { for (let i = 1; i < line.length; i++) { const key = segmentKey(line[i - 1], line[i]); boundaryWinners.set(key, Math.min(boundaryWinners.get(key) ?? 99, rank < 0 ? 99 : rank)) } }
    }
  }
  const drawnBoundaries = new Set<string>()
  const labelQueue = new Map<string, LabelCandidate & { size: number; bold: boolean; opacity: number; color?: string }>()
  const featureKeys = new WeakMap<Feature, string>()
  visible.forEach(layer => layer.data.features.forEach((feature, index) => featureKeys.set(feature, `${layer.id}:${feature.id ?? index}`)))
  const symbolObstacles: Array<{ x: number; y: number; w: number; h: number; symbol: boolean }> = []
  const label = (layer: DbtLayer, feature: Feature, anchor: Position) => {
    const entry = cartographyLabel(layer, feature, anchor, `${featureKeys.get(feature) || layer.id}:${anchor.slice(0, 2).join(",")}`, doc?.event)
    if (!entry) { return }
    const [x, y] = project(anchor)
    ctx.font = `${entry.bold ? "bold " : ""}${entry.size}px "Microsoft YaHei", sans-serif`
    const w = Math.min(layer.role === "event" ? 280 : 220, ctx.measureText(entry.text).width + 12)
    const layout = measureCartographyText(ctx, entry.text, w, map.h - 6, entry.size, entry.bold)
    labelQueue.set(entry.id, { ...entry, x, y, w, h: layout.height, opacity: layer.opacity ?? 1 })
  }
  const drawFeature = (layer: DbtLayer, feature: Feature) => {
    if (layer.onlineSource?.rendering?.parameters?.expression) {
      const p = feature.properties!; const geometry = feature.geometry
      ctx.save(); ctx.globalAlpha *= p.opacity ?? 0.84; ctx.fillStyle = p.color; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.7; ctx.setLineDash([])
      if (geometry.type === "Point" && p.pixelSize > 0) { const [x, y] = project(geometry.coordinates); ctx.beginPath(); ctx.arc(x, y, p.pixelSize / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
      if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") { for (const rings of geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) { ctx.beginPath(); rings.forEach(ring => path(ring, true)); ctx.fill("evenodd"); ctx.stroke() } }
      if (geometry.type === "LineString" || geometry.type === "MultiLineString") { ctx.strokeStyle = p.color; ctx.lineWidth = p.width || 2; for (const line of geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates) { ctx.beginPath(); path(line); ctx.stroke() } }
      ctx.restore(); return
    }
    const geometry = feature.geometry; const kind = dbtFeatureSymbol(layer, feature)
    const paint: VectorPaint = { ...vectorPaint(kind, feature.properties?.cartographyFallback || layer.role) }
    const reference = remoteReferenceStyle(layer.onlineSource)
    if (reference) { paint.color = reference.outlineColor } else if (!kind && !feature.properties?.cartographySchema && /^#[\da-f]{6}$/i.test(feature.properties?.color || layer.color || "")) { paint.color = feature.properties?.color || layer.color! }
    ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = paint.color; ctx.lineWidth = paint.width
    if (layer.role === "boundary") {
      const rank = boundaryOrder.indexOf(kind || "")
      for (const line of boundaryPaths(feature)) {
        let run: Position[] = []
        const flush = () => { if (run.length > 1) { ctx.beginPath(); path(run); strokeCartographyLine(ctx, paint) }; run = [] }
        for (let i = 1; i < line.length; i++) {
          const key = segmentKey(line[i - 1], line[i])
          if (drawnBoundaries.has(key) || boundaryWinners.get(key) !== (rank < 0 ? 99 : rank)) { flush(); continue }
          drawnBoundaries.add(key)
          if (!run.length) { run.push(line[i - 1]) }; run.push(line[i])
        }
        flush()
      }
      label(layer, feature, pointOnFeature(feature).geometry.coordinates); ctx.restore(); return
    }
    const rawColor = reference?.color || feature.properties?.color || layer.color
    const defaultColor = layer.role === "water" ? "#c5e9f4" : "#dce6e8"
    const color = /^#[\da-f]{6}$/i.test(rawColor || "") ? rawColor : defaultColor
    if (geometry.type === "Point" || geometry.type === "MultiPoint") {
      const positions = geometry.type === "Point" ? [geometry.coordinates] : geometry.coordinates
      for (const p of positions) {
        const [x, y] = project(p)
        const radius = Math.max(12, Number(feature.properties?.thematicRadius) || 0)
        if (kind || ["population", "economy"].includes(layer.role)) { symbolObstacles.push({ x: x - radius, y: y - radius, w: radius * 2, h: radius * 2, symbol: true }) }
        if (kind) { drawSymbol(kind, x, y, ["history", "aftershock"].includes(layer.role) ? Math.max(12, Math.min(38, Number(feature.properties?.magnitude) * 5)) : 24) } else if (["population", "economy"].includes(layer.role)) { ctx.beginPath(); ctx.arc(x, y, feature.properties?.thematicNoData ? 4 : feature.properties!.thematicRadius, 0, Math.PI * 2); ctx.fillStyle = feature.properties?.thematicNoData ? missingPattern : color; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke() }
        label(layer, feature, p)
      }
    } else if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates
      for (const line of lines) {
        ctx.beginPath(); path(line)
        strokeCartographyLine(ctx, paint, line.map(project))
        label(layer, feature, line[Math.floor(line.length / 2)])
      }
    } else if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
      const proportional = ["population", "economy"].includes(layer.role) && feature.properties?.thematicMode === "total"
      for (const polygon of polygons) {
        ctx.beginPath(); polygon.forEach(ring => path(ring, true))
        // Administrative areas and parameter envelopes are line layers, not opaque background fills.
        const backgroundPresentation = (layer.data as any)?.metadata?.backendResultPresentation
        const referenceOutline = ["thermal-background", "insar-background"].includes(backgroundPresentation?.kind) && backgroundPresentation.display === "grid" && layer.onlineSource?.rendering?.parameters?.resultDisplay === "grid"
        if (feature.properties?.thematicNoData) { ctx.fillStyle = missingPattern; ctx.fill("evenodd") } else if (!referenceOutline && !proportional && !["intensity", "boundary", "pga", "rescue-area"].includes(layer.role)) { ctx.fillStyle = color; ctx.fill("evenodd") }
        if (["population", "economy"].includes(layer.role)) { ctx.strokeStyle = proportional ? "#a1adb1" : "rgba(255,255,255,0.45)"; ctx.lineWidth = 0.5 }
        if (Array.isArray(feature.properties?.cartographyOutline)) {
          ctx.beginPath(); feature.properties.cartographyOutline.forEach((line: Position[]) => path(line)); strokeCartographyLine(ctx, paint)
        } else { strokeCartographyLine(ctx, paint) }
        if (kind === "dbt-rescue-area") {
          ctx.save(); ctx.clip("evenodd"); ctx.strokeStyle = "#ee1c25"; ctx.lineWidth = 1
          for (let x = map.x - map.h; x < map.x + map.w; x += 12) { ctx.beginPath(); ctx.moveTo(x, map.y + map.h); ctx.lineTo(x + map.h, map.y); ctx.stroke() }; ctx.restore()
        }
        if (!proportional) { label(layer, feature, layer.role === "intensity" ? polygon[0][Math.floor(polygon[0].length / 2)] : pointOnFeature({ ...feature, geometry: { type: "Polygon", coordinates: polygon } }).geometry.coordinates) }
      }
      if (proportional && !feature.properties?.thematicNoData) {
        const anchor = pointOnFeature(feature).geometry.coordinates; const [x, y] = project(anchor)
        ctx.beginPath(); ctx.arc(x, y, feature.properties!.thematicRadius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke()
        label(layer, feature, anchor)
      }
    }
    ctx.restore()
  }
  ctx.save(); ctx.beginPath(); ctx.rect(map.x, map.y, map.w, map.h); ctx.clip()
  const layers = sortedCartographyLayers(visible, id)
  for (const layer of layers) {
    ctx.save(); ctx.globalAlpha *= layer.opacity ?? 1
    if (layer.grid || layer.sourceGrid) {
      const grid = (layer.grid || layer.sourceGrid)!
      const rawStyle = layer.sourceGrid && referenceGridStyle(layer.sourceGrid)
      const raster = document.createElement("canvas"); raster.width = grid.width; raster.height = grid.height
      const buffer = raster.getContext("2d")!.createImageData(grid.width, grid.height)
      for (let i = 0; i < grid.values.length; i++) {
        const color = rawStyle ? rawStyle.color(grid.values[i]) : populationColor(populationDensity(layer.grid!, i))
        const offset = i * 4
        buffer.data[offset] = parseInt(color.slice(1, 3), 16); buffer.data[offset + 1] = parseInt(color.slice(3, 5), 16); buffer.data[offset + 2] = parseInt(color.slice(5, 7), 16); buffer.data[offset + 3] = 255
      }
      raster.getContext("2d")!.putImageData(buffer, 0, 0)
      const [left, top] = project([grid.bounds.west, grid.bounds.north]); const [right, bottom] = project([grid.bounds.east, grid.bounds.south])
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(raster, left, top, right - left, bottom - top); ctx.restore()
    }
    if (layer.raster) {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error(`${layer.name} 栅格无法解码`)); img.src = layer.raster!.image })
      if (image.naturalWidth * image.naturalHeight > 40_000_000) { throw new Error(`${layer.name} 栅格超过 4000 万像素限制`) }
      const r = layer.raster.bounds; const [left, top] = project([r.west, r.north]); const [right, bottom] = project([r.east, r.south])
      ctx.save(); if (id === "T30102000" && layer.role === "dem") { ctx.globalAlpha *= 0.2 }; ctx.drawImage(image, left, top, right - left, bottom - top); ctx.restore()
      if (dpi && (image.naturalWidth / (right - left) * 101.6 < dpi - 1 || image.naturalHeight / (bottom - top) * 101.6 < dpi - 1)) { issues.push(`${layer.name} 原始栅格在当前幅面不足 ${dpi} DPI，放大输出不能增加原始精度`) }
    }
    if (doc?.region.zone === "R3" && layer.role === "intensity") {
      ctx.save(); ctx.beginPath()
      for (const feature of doc.layers.filter(item => item.role === "land").flatMap(item => item.data.features)) {
        const geometry = feature.geometry
        const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : []
        if (geometry.type === "Polygon") { polygons.push(geometry.coordinates) }
        polygons.forEach(polygon => polygon.forEach(ring => path(ring, true)))
      }
      ctx.clip("evenodd")
      const originals = doc.layers.find(item => item.id === layer.id)?.data.features || []
      originals.filter(f => Number(f.properties?.intensity) >= intensityThreshold(doc, id)).forEach(f => drawFeature(layer, f))
      ctx.restore()
    } else {
      const features = [...layer.data.features]
      if (["population", "economy"].includes(layer.role)) { features.sort((a, b) => (Number(b.properties?.thematicRadius) || 0) - (Number(a.properties?.thematicRadius) || 0)) }
      features.forEach(feature => drawFeature(layer, feature))
    }
    ctx.restore()
  }
  const coverageObstacles: Array<{ x: number; y: number; w: number; h: number }> = []
  const partialBase = doc?.reference && visible.find(layer => layer.onlineSource && needsCoverageCheck(layer) && ["boundary", "settlement", "water", "transport", "dem"].includes(layer.role) && layerCoverageGaps(layer, doc.reference!.bounds).length)
  if (partialBase && doc?.reference) {
    const gaps = layerCoverageGaps(partialBase, doc.reference.bounds)
    ctx.save(); ctx.beginPath(); ctx.rect(map.x, map.y, map.w, map.h); ctx.clip()
    for (const gap of gaps) {
      const [x, y] = project([gap.west, gap.north]); const [right, bottom] = project([gap.east, gap.south])
      coverageObstacles.push({ x, y, w: right - x, h: bottom - y })
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, right - x, bottom - y); ctx.clip()
      ctx.fillStyle = "rgba(244,236,226,0.6)"; ctx.fillRect(x, y, right - x, bottom - y)
      ctx.strokeStyle = "#bb9d7b"; ctx.lineWidth = 0.8; ctx.setLineDash([])
      for (let at = x - (bottom - y); at < right; at += 24) { ctx.beginPath(); ctx.moveTo(at, bottom); ctx.lineTo(at + bottom - y, y); ctx.stroke() }
      if (right - x > 240 && bottom - y > 70) { text("基础地理未覆盖 · 需补齐图幅", x + 8, y + (bottom - y) / 2 - 24, right - x - 16, 48, 22, true, true, true) }
      ctx.restore()
    }
    ctx.restore()
    if (gaps.length) { issues.push("基础地理数据未覆盖全部框选范围；斜线区为未交付区域，不代表不存在地物，需补齐图幅后正式出图") }
  }
  ctx.restore()
  const tick = (v: number) => `${v.toFixed(2)}°`
  for (let i = 0; i <= 4; i++) {
    const x = map.x + map.w * i / 4; const y = map.y + map.h * i / 4
    ctx.save(); ctx.strokeStyle = "#728187"; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.6; ctx.setLineDash([3, 5])
    ctx.beginPath(); ctx.moveTo(x, map.y); ctx.lineTo(x, map.y + map.h); ctx.moveTo(map.x, y); ctx.lineTo(map.x + map.w, y); ctx.stroke(); ctx.restore()
    text(tick(bounds.west + (bounds.east - bounds.west) * i / 4), x - 50, map.y - 25, 100, 25, 16, false, true)
    text(tick(bounds.west + (bounds.east - bounds.west) * i / 4), x - 50, map.y + map.h + 7, 100, 25, 16, false, true)
    let latitudeOffset = -48
    if (i === 0) { latitudeOffset = -96 }; if (i === 4) { latitudeOffset = 0 }
    ctx.save(); ctx.translate(map.x - 9, y); ctx.rotate(-Math.PI / 2); text(tick(bounds.north - (bounds.north - bounds.south) * i / 4), latitudeOffset, -21, 96, 24, 16, false, true); ctx.restore()
    ctx.save(); ctx.translate(map.x + map.w + 28, y); ctx.rotate(-Math.PI / 2); text(tick(bounds.north - (bounds.north - bounds.south) * i / 4), latitudeOffset, -21, 96, 24, 16, false, true); ctx.restore()
  }
  ctx.strokeStyle = "#222"; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.strokeRect(map.x, map.y, map.w, map.h); ctx.strokeRect(map.x - 32, map.y - 32, map.w + 64, map.h + 64)
  // The epicenter stays above the thematic layers and graticule (4.3).
  if (hasEpicenter) {
    const anchor = [doc!.event.longitude, doc!.event.latitude]; const [x, y] = project(anchor)
    drawSymbol("dbt-current-epicenter", x, y, 34)
    const eventLabel = layerEventParameters(doc!.layers)?.name || `${doc!.event.place} ${doc!.event.magnitudeType}${doc!.event.magnitude}`
    label({ id: "event-label", role: "event", data: { type: "FeatureCollection", features: [] } } as unknown as DbtLayer, { type: "Feature", geometry: { type: "Point", coordinates: anchor }, properties: { label: eventLabel } }, anchor)
  }
  const annotationLayout = placeCartographyLabels([...labelQueue.values()], { x: map.x, y: map.y, w: map.w, h: map.h }, [{ x: map.x + 20, y: map.y + 15, w: 65, h: 100 }, ...symbolObstacles, ...coverageObstacles])
  ctx.save(); ctx.beginPath(); ctx.rect(map.x, map.y, map.w, map.h); ctx.clip()
  for (const placement of annotationLayout.placed) {
    const entry = labelQueue.get(placement.id)!; const box = placement.box
    ctx.save(); ctx.globalAlpha = entry.opacity
    if (placement.leader) { const [x, y, endX, endY] = placement.leader; ctx.setLineDash([]); ctx.strokeStyle = "#65716c"; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, endY); ctx.stroke() }
    text(entry.text, box.x, box.y, box.w, box.h, entry.size, entry.bold, false, true, entry.color); ctx.restore()
  }
  ctx.restore()
  issues.push(...annotationIssueSummary(annotationLayout.skipped))
  // N is tied to the geographic-coordinate map, never to the underlying 3D camera.
  text("N", map.x + 25, map.y + 20, 44, 40, 26, true, true, true)
  ctx.beginPath(); ctx.moveTo(map.x + 47, map.y + 58); ctx.lineTo(map.x + 34, map.y + 105); ctx.lineTo(map.x + 47, map.y + 91); ctx.lineTo(map.x + 60, map.y + 105); ctx.closePath(); ctx.fillStyle = "#222"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.stroke()
  options.onProgress?.("正在核对图例与统计")
  const statistics = doc ? dbtStatistics(doc, id, visible, bounds) : []
  const onlineAssessmentReference = doc?.usage === "reference" && visible.some(layer => layer.role === "intensity" && layer.onlineSource)
  const bands = id === "T30201000" && !onlineAssessmentReference ? intensityBands(visible) : []
  const numeric = (value: number | null) => value === null ? "待核实" : Number(value.toFixed(1)).toLocaleString("zh-CN")
  type Entry = { kind?: DbtSymbolKind; color?: string; label: string; radius?: number; noData?: boolean; order: number; group?: string; shape?: string; styleKey?: string }
  const entries: Entry[] = [...used].map(kind => {
    const definition = dbtSymbolDefinitions[kind]
    return { kind, label: definition.shortLabel, order: ["point", "line", "area"].indexOf(definition.geometry) * 100 + (definition.family === "earthquake" ? 0 : 40) + Object.keys(dbtSymbolDefinitions).indexOf(kind) }
  })
  for (const layer of visible) {
    const reference = remoteReferenceStyle(layer.onlineSource)
    let custom: Entry[] = []
    if (reference) {
      custom = [{ label: reference.label, color: reference.color, order: 0 }]
    } else if (layer.legend) {
      custom = layer.legend as unknown as Entry[]
    } else if (layer.data.features.some(f => /Polygon$/.test(f.geometry.type)) && !layer.data.features.some(f => dbtFeatureSymbol(layer, f))) {
      custom = [...new Map(layer.data.features.map(f => [String(f.properties?.color || layer.color || "#dce6e8"), { label: String(f.properties?.label || layer.name), color: String(f.properties?.color || layer.color || "#dce6e8"), order: 0 }])).values()] as Entry[]
    }
    let group: string | undefined
    if (id === "T30102000" && ["population", "economy"].includes(layer.role)) {
      group = `${layer.name} · ${layer.data.features[0]?.properties?.thematicMetric || "专题指标"}`
      if (layer.sourceGrid) { group = "原始数值 · 分位数分级" } else if (layer.grid) { group = "人口密度（人/km²）" }
    }
    let order = 230
    if (layer.raster || layer.grid || layer.sourceGrid) { order = layer.role === "dem" ? 400 : 350 }
    for (const item of custom) {
      if ("kind" in item && item.kind && used.has(item.kind as DbtSymbolKind)) { continue }
      entries.push({ color: item.color, label: item.label, radius: "radius" in item ? item.radius as number : undefined, noData: "noData" in item ? item.noData as boolean : undefined, shape: "shape" in item ? item.shape as string : undefined, styleKey: "styleKey" in item ? item.styleKey as string : undefined, order, group })
    }
    if (layer.role === "distance" && layer.data.features.length) { entries.push({ color: "#454545", label: "震中距连线", order: 105 }) }
    if (layer.raster && layer.raster.rendering !== "imagery" && !custom.length) { issues.push(`${layer.name} 栅格缺少图例`) }
  }
  const statRows = statistics.map(stat => `${stat.label}：${numeric(stat.value)} ${stat.unit}`)
  if (bands.length) {
    statRows.push("烈度 / 面积(km²) / 人口(人) / 密度(人/km²)")
    for (const band of bands) { statRows.push(`${intensityLabel(band.intensity)}  ${numeric(band.areaKm2)} / ${numeric(band.population)} / ${numeric(band.population === null || !band.areaKm2 ? null : band.population / band.areaKm2)}`) }
  }
  const measure = (value: string, width: number, size: number) => measureCartographyText(ctx, value, width, Infinity, size).height
  const completeLegend = uniqueLegendRows(entries)
  const information = layoutDbtInformation(doc?.description || "[当前类别的内容说明]", statRows, completeLegend, (value, width, height, size, bold) => measureCartographyText(ctx, value, width, height, size, bold))
  const { legend, legendY } = information
  text("内容说明", 1230, 181, 388, 45, 27, true)
  drawCartographyText(ctx, information.description.layout, 1230, information.description.y, 388, information.description.layout.height)
  for (const row of information.rows) { drawCartographyText(ctx, row.layout, 1230, row.y, 388, row.layout.height) }
  text("图例", 1230, legendY, 388, 44, 25, true)
  for (const heading of legend.headings) { text(heading.label, heading.x ?? 1230, heading.y, heading.width ?? 388, heading.height, legend.headingSize, true) }
  for (const { entry, x, y, width, height } of legend.rows) {
    const center = y + height / 2
    const labelWidth = width
    const labelHeight = measure(entry.label, labelWidth, legend.fontSize)
    const labelY = y + Math.max(0, (height - labelHeight) / 2)
    if (entry.radius !== undefined) { ctx.beginPath(); ctx.arc(x + 30, center, entry.radius, 0, Math.PI * 2); ctx.fillStyle = entry.color!; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.stroke(); text(entry.label, x + 70, labelY, labelWidth, labelHeight, legend.fontSize); continue }
    if (entry.shape === "line" || (entry.kind && dbtSymbolDefinitions[entry.kind].geometry === "line")) {
      const paint = vectorPaint(entry.kind, entry.styleKey)
      if (!entry.kind && entry.color) { paint.color = entry.color }
      ctx.save(); ctx.beginPath(); ctx.moveTo(x + 1, center); ctx.lineTo(x + 61, center); strokeCartographyLine(ctx, paint, [[x + 1, center], [x + 61, center]]); ctx.restore()
    } else if (entry.kind && dbtSymbolDefinitions[entry.kind].geometry === "point") { drawSymbol(entry.kind, x + 30, center, 27) } else {
      const paint = vectorPaint(entry.kind)
      ctx.fillStyle = entry.noData ? missingPattern : entry.color || paint.fill || paint.color; ctx.fillRect(x + 14, center - 9, 32, 18); ctx.strokeStyle = entry.kind ? paint.color : "#68757b"; ctx.lineWidth = 0.8; ctx.strokeRect(x + 14, center - 9, 32, 18)
    }
    text(entry.label, x + 70, labelY, width, labelHeight, legend.fontSize)
  }
  const scale = cartographyScale(bounds, doc!.crs, map.w)
  if (scale) {
    const { stepKm, width, segments } = scale; const x = 90; const y = 1090
    ctx.strokeStyle = "#222"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + width, y)
    for (let i = 0; i <= segments; i++) { const at = x + width * i / segments; ctx.moveTo(at, y - 8); ctx.lineTo(at, y) }; ctx.stroke()
    for (let i = 0; i <= segments; i++) { const at = x + width * i / segments; text(`${i * stepKm}${i === segments ? " km" : ""}`, i === 0 ? x : at - 16, y - 37, 95, 28, 18) }
    text(`参考纬度 ${scale.latitude.toFixed(2)}°`, 90, 1093, 300, 26, 13)
  } else { issues.push("当前坐标未核验或图幅过小，无法绘制以 5 km 倍数标记的比例尺"); text("比例尺待核验", 90, 1055, 270, 40, 18) }
  const sources = [...new Set(visible.map(layer => layer.authority || layer.onlineSource?.itemId || (layer.sourceReference ? layer.sourceReference.catalogId : "")).filter(Boolean))].join("、")
  text(`数据来源：${sources || "[待核验]"}`, 400, 1065, 690, 48, 14)
  text(`制作单位：${doc?.agency || "[待填写]"}`, 1150, 1065, 480, 44, 18)
  const timestamp = doc?.createdAt && Number.isFinite(Date.parse(doc.createdAt)) ? `${new Date(doc.createdAt).toISOString().slice(0, 19).replace("T", " ")} UTC` : "[待填写]"
  text(`制图时间：${timestamp}`, 1150, 1109, 480, 28, 16)
  const coordinateLabel = { "EPSG:4490": "CGCS2000 · 地理坐标 · 度", "EPSG:4326": "WGS84 · 非 CGCS2000 正式图件", "EPSG:4024": "原 Krassowsky 椭球经纬度 · 基准未核验" }[doc?.crs || ""] || "坐标系统待核验"
  text(`${DBT_PAGE.millimeters.join(" × ")} mm · A3 · ${dpi || "预览"}${dpi ? " DPI" : ""}    ${coordinateLabel}`, 90, 1140, 1450, 35, 16)
  let code = "分类编码待核验"
  try { code = dbtMapCode(id, doc?.classification?.instance, doc?.classification?.spatial) } catch { issues.push(code) }
  text(code, 1460, 1140, 190, 26, 16)
  const invalidFormal = options.draft === false && inspectDbtDocument(doc, id).some(issue => issue.severity === "error")
  if (invalidFormal) { issues.push("数据检查未通过，不能生成无校样标识的正式图件") }
  if (dataExtent) {
    issues.push("当前采用人口数据覆盖范围预览，缺少快速评估烈度面，尚非规范制图范围")
    ctx.fillStyle = "#7e2924"; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "left"; ctx.fillText("人口数据预览 · 规范范围待评估 · 禁止正式使用", 90, 1132)
  } else if (doc?.usage === "reference") {
    let label = "历史模型数据参考 · 非正式应急图件 · 不含虚构震情或等震线"
    if (doc.layers.some(layer => layer.sourceReference)) { label = "本地数据参考 · 坐标/精度/单位限制见说明 · 非正式应急图件" }
    if (doc.layers.some(layer => layer.onlineSource)) { label = "在线原始数据校样 · 来源/单位/坐标依据待核验 · 非正式图件" }
    ctx.fillStyle = "#7e2924"; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "left"; ctx.fillText(label, 90, 1132)
  } else if (options.draft !== false || doc?.usage !== "operational" || invalidFormal || issues.length) {
    ctx.save(); ctx.translate(630, 590); ctx.rotate(-0.3); ctx.fillStyle = "rgba(159, 29, 29, 0.18)"; ctx.font = "bold 66px sans-serif"; ctx.textAlign = "center"; ctx.fillText(doc?.usage === "test" ? "合成测试 · 禁止业务使用" : "校样 · 未完成质量审核", 0, 0); ctx.restore()
  }
  return { bounds, mapFrame: map, issues: [...new Set(issues)], statistics, bands, annotations: annotationLayout, legendEntries: completeLegend, legendCount: completeLegend.length, legendY, width: canvas.width, height: canvas.height }
}
