import { distance, point, pointOnFeature } from "@turf/turf"
import type { Feature, Position } from "geojson"
import { compositionSymbolImage } from "./composition-symbols"
import { dbtSymbolDefinitions, type DbtSymbolKind } from "./dbt116-symbols"
import { dbtTitle, dbtFeatureSymbol, dbtScopedLayers, inspectDbtDocument, intensityLabel, intensityThreshold, standardBounds, type DbtBounds, type DbtDocument, type DbtLayer, type DbtTemplateId } from "./dbt116-standard"
import { dbtMapCode, dbtStatistics, fitDbtBounds, intensityBands } from "./dbt-cartography-rules"
import { drawDbtDraft, type DbtMapPreview } from "./dbt-draft-preview"

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
export async function renderDbtMap(canvas: HTMLCanvasElement, doc: DbtDocument | null, id: DbtTemplateId, options: { dpi?: number; draft?: boolean; layoutOnly?: boolean; mapPreview?: DbtMapPreview | null } = {}) {
  const dpi = options.dpi || 0
  canvas.width = dpi ? Math.round(420 / 25.4 * dpi) : DBT_PAGE.width
  canvas.height = dpi ? Math.round(297 / 25.4 * dpi) : DBT_PAGE.height
  const ctx = canvas.getContext("2d")!
  ctx.scale(canvas.width / DBT_PAGE.width, canvas.height / DBT_PAGE.height)
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, DBT_PAGE.width, DBT_PAGE.height)
  const issues: string[] = []
  const text = (value: string, x: number, y: number, w: number, h: number, size = 22, bold = false, center = false, halo = false) => {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
    ctx.font = `${bold ? "bold " : ""}${size}px "Microsoft YaHei", sans-serif`; ctx.fillStyle = "#171717"; ctx.textBaseline = "top"; ctx.textAlign = center ? "center" : "left"
    let row = ""; let line = 0
    const emit = () => {
      if ((line + 1) * size * 1.5 > h) { issues.push(`文字超出版面：${value.slice(0, 30)}`); return }
      if (halo) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.strokeText(row, center ? x + w / 2 : x, y + line * size * 1.5) }
      ctx.fillText(row, center ? x + w / 2 : x, y + line * size * 1.5); line++
    }
    for (const character of value) {
      if (character === "\n") { emit(); row = ""; continue }
      if (row && ctx.measureText(row + character).width > w) { emit(); row = "" }
      row += character
    }
    if (row) { emit() }; ctx.restore()
  }
  const bounds = doc && standardBounds(doc, id)
  if (!bounds || options.layoutOnly) {
    await drawDbtDraft(ctx, doc, id, options.mapPreview)
    return { bounds: null, issues: ["当前为底图草稿；正式出图仍需有效震情、快速评估烈度面及规范制图范围"], statistics: [], bands: [], legendCount: 0, legendY: 895, width: canvas.width, height: canvas.height }
  }
  const map = DBT_PAGE.map
  const project = (p: Position) => [map.x + (p[0] - bounds.west) / (bounds.east - bounds.west) * map.w, map.y + (bounds.north - p[1]) / (bounds.north - bounds.south) * map.h]
  text(doc ? dbtTitle(doc, id) : "[发震日期] [震中地名] [震级]级地震专题图", 60, 38, 1560, 110, 36, true, true)
  ctx.fillStyle = "#f7f9f9"; ctx.fillRect(map.x, map.y, map.w, map.h)
  const used = new Set<DbtSymbolKind>()
  if (doc) { used.add("dbt-current-epicenter") }
  const visible = doc ? dbtScopedLayers(doc, id) : []
  visible.forEach(layer => layer.data.features.forEach(feature => { const symbol = dbtFeatureSymbol(layer, feature); if (symbol) { used.add(symbol) } }))
  const images = new Map<DbtSymbolKind, HTMLImageElement>()
  for (const kind of used) { images.set(kind, await symbolImage(kind)) }
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
  const lineStyle = (symbol?: DbtSymbolKind) => {
    ctx.setLineDash([]); ctx.lineWidth = 1.4; ctx.strokeStyle = "#454545"
    if (symbol === "dbt-fault" || symbol === "dbt-isoseismal" || symbol === "dbt-pga") { ctx.strokeStyle = "#ee1c25"; ctx.lineWidth = 2.5 }
    if (["dbt-river", "dbt-lake", "dbt-reservoir"].includes(symbol || "")) { ctx.strokeStyle = "#2193ce"; ctx.lineWidth = 2 }
    if (symbol === "dbt-rescue-area") { ctx.strokeStyle = "#c2175b"; ctx.lineWidth = 2 }
    const dashes: Partial<Record<DbtSymbolKind, number[]>> = { "dbt-national-boundary": [12, 3, 2, 3], "dbt-province-boundary": [18, 4, 2, 4, 2, 4], "dbt-city-boundary": [18, 6, 18, 6, 2, 6], "dbt-county-boundary": [14, 4, 2, 4], "dbt-town-boundary": [10, 3, 2, 3, 2, 3], "dbt-town-road": [6, 3], "dbt-village-road": [3, 3] }
    ctx.setLineDash(dashes[symbol!] || [])
  }
  const strokeLine = (kind?: DbtSymbolKind) => {
    if (kind && ["dbt-railway", "dbt-expressway", "dbt-national-road", "dbt-province-road"].includes(kind)) {
      ctx.lineWidth = kind === "dbt-expressway" ? 5 : 4; ctx.stroke()
      ctx.lineWidth = 2; ctx.strokeStyle = kind === "dbt-expressway" ? "#979da0" : "#fff"
      if (kind === "dbt-railway") { ctx.setLineDash([12, 12]) }; ctx.stroke()
    } else { ctx.stroke() }
  }
  const occupied: Array<{ x: number; y: number; w: number; h: number }> = [{ x: map.x + 20, y: map.y + 15, w: 65, h: 100 }]
  if (doc) { const [x, y] = project([doc.event.longitude, doc.event.latitude]); occupied.push({ x: x - 20, y: y - 30, w: 322, h: 74 }) }
  const label = (layer: DbtLayer, feature: Feature, anchor: Position) => {
    let value = String(feature.properties?.label || "")
    if (layer.role === "intensity") { value = intensityLabel(Number(feature.properties?.intensity)) }
    if (layer.role === "pga") { value = `${feature.properties?.pga ?? "?"} gₙ · ${feature.properties?.designIntensity ?? "?"}度` }
    if (layer.role === "distance" && feature.geometry.type === "LineString") { const coordinates = feature.geometry.coordinates; value = `${value} ${distance(point(coordinates[0]), point(coordinates[coordinates.length - 1])).toFixed(1)} km` }
    if (["history", "aftershock"].includes(layer.role)) { value = `${feature.properties?.occurredAt || ""} ${feature.properties?.magnitude || "?"}级 ${value}` }
    if (!value) { return }
    const [x, y] = project(anchor)
    const kind = dbtFeatureSymbol(layer, feature)
    const sizes: Partial<Record<DbtSymbolKind, number>> = { "dbt-capital": 25, "dbt-province-seat": 23, "dbt-city-seat": 21, "dbt-county-seat": 19, "dbt-town-seat": 17, "dbt-village": 15 }
    const size = sizes[kind!] || 18
    if (x < map.x || x > map.x + map.w || y < map.y || y > map.y + map.h) { return }
    ctx.font = `${layer.role === "intensity" ? "bold " : ""}${size}px "Microsoft YaHei", sans-serif`
    const w = Math.min(220, ctx.measureText(value).width + 8); const h = Math.ceil(ctx.measureText(value).width / w) * size * 1.5
    const positions = [[15, -12], [15, 14], [-w - 15, -12], [-w - 15, 14], [-w / 2, -h - 16], [-w / 2, 25]]
    for (const radius of [45, 75, 105]) { positions.push([-w / 2, -h - radius], [-w / 2, radius], [radius, -h / 2], [-w - radius, -h / 2], [radius, -h - radius], [-w - radius, radius]) }
    const candidate = positions.map(([dx, dy]) => ({ x: x + dx, y: y + dy, w, h })).find(rect => rect.x >= map.x + 3 && rect.y >= map.y + 3 && rect.x + w <= map.x + map.w - 3 && rect.y + h <= map.y + map.h - 3 && !occupied.some(other => rect.x < other.x + other.w + 4 && rect.x + w + 4 > other.x && rect.y < other.y + other.h + 4 && rect.y + h + 4 > other.y))
    if (!candidate) { issues.push(`注记拥挤需调整数据密度或分幅：${value}`); return }
    occupied.push(candidate)
    const edgeX = Math.max(candidate.x, Math.min(x, candidate.x + w)); const edgeY = Math.max(candidate.y, Math.min(y, candidate.y + h))
    if (Math.hypot(x - edgeX, y - edgeY) > 30) { ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = "#65716c"; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(edgeX, edgeY); ctx.stroke(); ctx.restore() }
    text(value, candidate.x, candidate.y, w, h + 1, size, layer.role === "intensity", false, true)
  }
  const drawFeature = (layer: DbtLayer, feature: Feature) => {
    const geometry = feature.geometry; const kind = dbtFeatureSymbol(layer, feature)
    ctx.save(); lineStyle(kind)
    if (layer.role === "boundary") {
      const rank = boundaryOrder.indexOf(kind || "")
      for (const line of boundaryPaths(feature)) {
        for (let i = 1; i < line.length; i++) {
          const key = segmentKey(line[i - 1], line[i])
          if (drawnBoundaries.has(key) || boundaryWinners.get(key) !== (rank < 0 ? 99 : rank)) { continue }
          drawnBoundaries.add(key); ctx.beginPath(); path([line[i - 1], line[i]]); ctx.stroke()
        }
      }
      label(layer, feature, pointOnFeature(feature).geometry.coordinates); ctx.restore(); return
    }
    const rawColor = feature.properties?.color || layer.color
    const defaultColor = layer.role === "water" ? "#c5e9f4" : "#dce6e8"
    const color = /^#[\da-f]{6}$/i.test(rawColor || "") ? rawColor : defaultColor
    if (geometry.type === "Point" || geometry.type === "MultiPoint") {
      const positions = geometry.type === "Point" ? [geometry.coordinates] : geometry.coordinates
      for (const p of positions) { const [x, y] = project(p); if (kind) { drawSymbol(kind, x, y, ["history", "aftershock"].includes(layer.role) ? Math.max(12, Math.min(38, Number(feature.properties?.magnitude) * 5)) : 24) }; label(layer, feature, p) }
    } else if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates
      for (const line of lines) {
        ctx.beginPath(); path(line)
        strokeLine(kind)
        label(layer, feature, line[Math.floor(line.length / 2)])
      }
    } else if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
      for (const polygon of polygons) {
        ctx.beginPath(); polygon.forEach(ring => path(ring, true))
        // Administrative areas and parameter envelopes are line layers, not opaque background fills.
        if (!["intensity", "boundary", "pga", "rescue-area"].includes(layer.role)) { ctx.fillStyle = color; ctx.fill("evenodd") }
        ctx.stroke()
        if (kind === "dbt-rescue-area") {
          ctx.save(); ctx.clip("evenodd"); ctx.strokeStyle = "#ee1c25"; ctx.lineWidth = 1
          for (let x = map.x - map.h; x < map.x + map.w; x += 12) { ctx.beginPath(); ctx.moveTo(x, map.y + map.h); ctx.lineTo(x + map.h, map.y); ctx.stroke() }; ctx.restore()
        }
        label(layer, feature, layer.role === "intensity" ? polygon[0][Math.floor(polygon[0].length / 2)] : pointOnFeature({ ...feature, geometry: { type: "Polygon", coordinates: polygon } }).geometry.coordinates)
      }
    }
    ctx.restore()
  }
  ctx.save(); ctx.beginPath(); ctx.rect(map.x, map.y, map.w, map.h); ctx.clip()
  const ranks: Record<string, number> = { dem: -5, imagery: -4, water: -3, boundary: -2, transport: -1, settlement: 1, fault: 5, intensity: 6 }
  const layers = [...visible].sort((a, b) => (ranks[a.role] || 0) - (ranks[b.role] || 0))
  for (const layer of layers) {
    if (layer.raster) {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error(`${layer.name} 栅格无法解码`)); img.src = layer.raster!.image })
      if (image.naturalWidth * image.naturalHeight > 40_000_000) { throw new Error(`${layer.name} 栅格超过 4000 万像素限制`) }
      const r = layer.raster.bounds; const [left, top] = project([r.west, r.north]); const [right, bottom] = project([r.east, r.south])
      ctx.drawImage(image, left, top, right - left, bottom - top)
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
    } else { layer.data.features.forEach(feature => drawFeature(layer, feature)) }
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
  if (doc) { const [x, y] = project([doc.event.longitude, doc.event.latitude]); drawSymbol("dbt-current-epicenter", x, y, 34); text(`${doc.event.place} ${doc.event.magnitude}级`, Math.max(map.x, Math.min(x + 22, map.x + map.w - 290)), Math.max(map.y, y - 28), 280, 70, 24, true, false, true) }
  // N is tied to the geographic-coordinate map, never to the underlying 3D camera.
  text("N", map.x + 25, map.y + 20, 44, 40, 26, true, true, true)
  ctx.beginPath(); ctx.moveTo(map.x + 47, map.y + 58); ctx.lineTo(map.x + 34, map.y + 105); ctx.lineTo(map.x + 47, map.y + 91); ctx.lineTo(map.x + 60, map.y + 105); ctx.closePath(); ctx.fillStyle = "#222"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.stroke()
  text("内容说明", 1230, 181, 388, 45, 27, true)
  const statistics = doc ? dbtStatistics(doc, id, visible) : []
  const bands = id === "T30201000" ? intensityBands(visible) : []
  const numeric = (value: number | null) => value === null ? "待核实" : Number(value.toFixed(1)).toLocaleString("zh-CN")
  text(doc?.description || "[当前类别的内容说明]", 1230, 239, 388, statistics.length ? 165 : 360, 20)
  let statY = 411
  for (const stat of statistics.slice(0, 6)) { text(`${stat.label}：${numeric(stat.value)} ${stat.unit}`, 1230, statY, 388, 28, 17); statY += 27 }
  if (statistics.length > 6) { issues.push("统计项目超过说明区容量，请分幅或精简至 6 项") }
  if (bands.length) {
    text("烈度 / 面积(km²) / 人口(人) / 密度(人/km²)", 1230, statY, 388, 24, 14, true); statY += 23
    bands.forEach(band => { text(`${intensityLabel(band.intensity)}  ${numeric(band.areaKm2)} / ${numeric(band.population)} / ${numeric(band.population === null || !band.areaKm2 ? null : band.population / band.areaKm2)}`, 1230, statY, 388, 24, 14); statY += 22 })
  }
  const legendY = Math.max(654, statY + 15)
  text("图例", 1230, legendY, 388, 40, 25, true)
  type Entry = { kind?: DbtSymbolKind; color?: string; label: string; order: number }
  const entries: Entry[] = [...used].map(kind => {
    const definition = dbtSymbolDefinitions[kind]
    return { kind, label: definition.shortLabel, order: ["point", "line", "area"].indexOf(definition.geometry) * 100 + (definition.family === "earthquake" ? 0 : 40) + Object.keys(dbtSymbolDefinitions).indexOf(kind) }
  })
  for (const layer of visible) {
    const custom = layer.legend || (layer.data.features.some(f => /Polygon$/.test(f.geometry.type)) && !layer.data.features.some(f => dbtFeatureSymbol(layer, f)) ? [...new Map(layer.data.features.map(f => [f.properties?.color || layer.color || "#dce6e8", { label: String(f.properties?.label || layer.name), color: f.properties?.color || layer.color || "#dce6e8" }])).values()] : [])
    for (const item of custom) { entries.push({ color: item.color, label: item.label, order: layer.raster ? 400 : 230 }) }
    if (layer.role === "distance" && layer.data.features.length) { entries.push({ color: "#454545", label: "震中距连线", order: 105 }) }
    if (layer.raster && !custom.length) { issues.push(`${layer.name} 栅格缺少图例`) }
  }
  entries.sort((a, b) => a.order - b.order)
  const rows = Math.max(1, Math.floor((1028 - legendY - 45) / 28))
  if (entries.length > rows * 2) { issues.push(`图例超过 ${rows * 2} 项，请分幅或精简专题要素`) }
  entries.slice(0, rows * 2).forEach((entry, i) => {
    const column = entries.length > rows ? Math.floor(i / rows) : 0
    const x = 1230 + column * 195; const y = legendY + 45 + i % rows * 28
    if (entry.kind && dbtSymbolDefinitions[entry.kind].geometry === "line") { ctx.save(); lineStyle(entry.kind); ctx.beginPath(); ctx.moveTo(x + 1, y + 11); ctx.lineTo(x + 25, y + 11); strokeLine(entry.kind); ctx.restore() } else if (entry.kind) { drawSymbol(entry.kind, x + 13, y + 11, 23) } else { ctx.fillStyle = entry.color!; ctx.fillRect(x + 1, y + 4, 24, 14); ctx.strokeStyle = "#68757b"; ctx.lineWidth = 0.6; ctx.strokeRect(x + 1, y + 4, 24, 14) }
    text(entry.label, x + 32, y, entries.length > rows ? 158 : 345, 25, 15)
  })
  const km = distance(point([bounds.west, (bounds.north + bounds.south) / 2]), point([bounds.east, (bounds.north + bounds.south) / 2]))
  const stepKm = Math.floor(km * 240 / map.w / 2 / 5) * 5
  if (stepKm >= 5) {
    const width = stepKm * 2 / km * map.w; const x = 90; const y = 1090
    ctx.strokeStyle = "#222"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + width, y)
    for (let i = 0; i <= 2; i++) { const at = x + width * i / 2; ctx.moveTo(at, y - 8); ctx.lineTo(at, y) }; ctx.stroke()
    for (let i = 0; i <= 2; i++) { const at = x + width * i / 2; text(`${i * stepKm}${i === 2 ? " km" : ""}`, at - 16, y - 37, 95, 28, 18) }
  } else { issues.push("范围过小，无法容纳以 5 km 倍数标记的比例尺"); text("比例尺待调整", 90, 1055, 270, 40, 18) }
  const sources = [...new Set(visible.map(layer => layer.authority).filter(Boolean))].join("、")
  text(`数据来源：${sources || "[待核验]"}`, 400, 1065, 690, 73, 17)
  text(`制作单位：${doc?.agency || "[待填写]"}\n制图时间：${doc?.createdAt || "[待填写]"}`, 1150, 1065, 480, 80, 18)
  text(`${DBT_PAGE.millimeters.join(" × ")} mm · A3 · ${dpi || "预览"}${dpi ? " DPI" : ""}    ${doc?.crs === "EPSG:4490" ? "CGCS2000 · 地理坐标 · 度" : "坐标系统待核验"}`, 90, 1140, 1450, 35, 16)
  let code = "分类编码待核验"
  try { code = dbtMapCode(id, doc?.classification?.instance, doc?.classification?.spatial) } catch { issues.push(code) }
  text(code, 1460, 1140, 190, 26, 16)
  const invalidFormal = options.draft === false && inspectDbtDocument(doc, id).some(issue => issue.severity === "error")
  if (invalidFormal) { issues.push("数据检查未通过，不能生成无校样标识的正式图件") }
  if (options.draft !== false || doc?.usage !== "operational" || invalidFormal || issues.length) {
    ctx.save(); ctx.translate(630, 590); ctx.rotate(-0.3); ctx.fillStyle = "rgba(159, 29, 29, 0.18)"; ctx.font = "bold 66px sans-serif"; ctx.textAlign = "center"; ctx.fillText(doc?.usage === "test" ? "合成测试 · 禁止业务使用" : "校样 · 未完成质量审核", 0, 0); ctx.restore()
  }
  return { bounds, issues: [...new Set(issues)], statistics, bands, legendCount: entries.length, legendY, width: canvas.width, height: canvas.height }
}
