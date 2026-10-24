import { distance, pointOnFeature } from "@turf/turf"
import type { Position } from "geojson"
import HeatmapLayer from "echarts/lib/chart/heatmap/HeatmapLayer.js"
import { color as echartsColor } from "echarts"
import { sampleTemplatePalette } from "./template-palettes"
import { renderTemplateDocument, TEMPLATE_CONTRACTS, type TemplateDocument, type TemplateScene } from "./template-renderer"
import { STANDARD_SHEET, STANDARD_SLOTS, drawStandardFrame, drawStandardScale } from "./cartography-standard-layout"
import { CATALOG_SAMPLE_BOUNDS, loadTemplateSample } from "./catalog-template-samples"
import { compositionSymbolImage } from "./composition-symbols"
import type { CartographySymbolKind } from "./template-icon-registry"

const defaultPalettes: Record<string, string> = { "point-heat": "heat", "unique-value": "categorical", "raster-ramp": "terrain", "raster-threshold": "threshold" }
const symbols = new Map<string, Promise<HTMLImageElement>>()
function symbolImage(kind: string) {
  if (!symbols.has(kind)) {
    const image = new Image(); image.src = compositionSymbolImage(kind as CartographySymbolKind, "#222")
    symbols.set(kind, image.decode().then(() => image).catch(error => { symbols.delete(kind); throw error }))
  }
  return symbols.get(kind)!
}
const map = STANDARD_SLOTS.map
const project = (p: Position) => [map.x + (p[0] - CATALOG_SAMPLE_BOUNDS.west) / (CATALOG_SAMPLE_BOUNDS.east - CATALOG_SAMPLE_BOUNDS.west) * map.w, map.y + (CATALOG_SAMPLE_BOUNDS.north - p[1]) / (CATALOG_SAMPLE_BOUNDS.north - CATALOG_SAMPLE_BOUNDS.south) * map.h]
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 20) {
  ctx.save(); ctx.font = `${size}px "Microsoft YaHei",sans-serif`; ctx.lineWidth = 5; ctx.strokeStyle = "#fff"; ctx.fillStyle = "#273732"
  const width = Math.min(ctx.measureText(text).width, map.w - 16)
  x = Math.max(map.x + 8, Math.min(x, map.x + map.w - width - 8))
  y = Math.max(map.y + size + 8, Math.min(y, map.y + map.h - 8))
  ctx.strokeText(text, x, y, width); ctx.fillText(text, x, y, width); ctx.restore()
}
function path(ctx: CanvasRenderingContext2D, coordinates: Position[]) {
  coordinates.forEach((p, i) => { const [x, y] = project(p); if (i) { ctx.lineTo(x, y) } else { ctx.moveTo(x, y) } })
}
function drawContext(ctx: CanvasRenderingContext2D, document: TemplateDocument) {
  for (const f of document.metadata.context || []) {
    if (f.geometry.type === "LineString") {
      ctx.strokeStyle = f.properties.role === "river" ? "#90c9dc" : "#b9b3a9"; ctx.lineWidth = f.properties.role === "river" ? 5 : 3
      ctx.beginPath(); path(ctx, f.geometry.coordinates); ctx.stroke()
    } else if (f.geometry.type === "Point") {
      const [x, y] = project(f.geometry.coordinates)
      ctx.fillStyle = "#667a74"; ctx.fillRect(x - 3, y - 3, 6, 6); label(ctx, f.properties.name, x + 7, y - 9, 17)
    }
  }
}

export async function drawCatalogScene(ctx: CanvasRenderingContext2D, scene: TemplateScene, document: TemplateDocument) {
  const symbolKinds = [...new Set(scene.features.map(f => f.properties.symbolKind).filter(Boolean))] as string[]
  for (const annotation of scene.annotations || []) { if (annotation.symbolKind) { symbolKinds.push(annotation.symbolKind) } }
  const images = new Map(await Promise.all(symbolKinds.map(async kind => [kind, await symbolImage(kind)] as const)))
  ctx.save(); ctx.beginPath(); ctx.rect(map.x, map.y, map.w, map.h); ctx.clip()
  ctx.fillStyle = "#f3f6f4"; ctx.fillRect(map.x, map.y, map.w, map.h)
  drawContext(ctx, document)
  if (scene.heat) {
    const layer = new HeatmapLayer()
    layer.pointSize = 45; layer.blurSize = 40; layer.maxOpacity = 0.9; layer.minOpacity = 0.1
    const maximum = Math.max(...scene.heat.map(p => p.value), 1)
    const color = (value: number, _normalized: boolean, out: number[]) => echartsColor.parse(sampleTemplatePalette(scene.heatColors!, value))!.forEach((channel, i) => { out[i] = channel })
    layer.update(scene.heat.map(p => { const [x, y] = project([p.lng, p.lat]); return [x - map.x, y - map.y, p.value] }), map.w, map.h, value => value / maximum, { inRange: color, outOfRange: color }, () => true)
    ctx.drawImage(layer.canvas, map.x, map.y)
  } else {
    for (const f of scene.features) {
      const p = f.properties; const g = f.geometry
        ctx.fillStyle = p.color; ctx.strokeStyle = p.color; ctx.lineWidth = p.width || 2
      if (g.type === "Point") {
        const [x, y] = project(g.coordinates)
        if (["raster-ramp", "raster-threshold"].includes(scene.kind)) {
          const grid = document.metadata.grid
          const w = map.w / (grid.columns - 1); const h = map.h / (grid.rows - 1)
          ctx.fillRect(x - w / 2, y - h / 2, w + 1, h + 1)
        } else if (p.symbolKind && images.has(p.symbolKind)) {
          const size = (p.pixelSize || 20) * 1.8
          ctx.drawImage(images.get(p.symbolKind)!, x - size / 2, y - size / 2, size, size)
          if (scene.kind === "emergency-command") { ctx.lineWidth = 3; ctx.strokeRect(x - size / 2 - 3, y - size / 2 - 3, size + 6, size + 6) }
        } else {
          const radius = (p.pixelSize || 14) * 0.8
          ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1
          if (!["thermal-infrared", "insar-deformation"].includes(scene.kind)) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke() }
        }
      } else if (g.type === "LineString" || g.type === "MultiLineString") {
        const lines = g.type === "LineString" ? [g.coordinates] : g.coordinates
        lines.forEach(line => {
          ctx.beginPath(); path(ctx, line); ctx.stroke()
          if (p.arrow && line.length > 1) {
            const [x, y] = project(line[line.length - 1]); const [px, py] = project(line[line.length - 2])
            ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(y - py, x - px))
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-15, -7); ctx.lineTo(-15, 7); ctx.closePath(); ctx.fill(); ctx.restore()
          }
        })
      } else if (g.type === "Polygon" || g.type === "MultiPolygon") {
        const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates
        polygons.forEach(rings => {
          ctx.beginPath(); rings.forEach(ring => { path(ctx, ring); ctx.closePath() })
          ctx.globalAlpha = 0.75
          if (scene.kind === "intensity-distribution") { ctx.globalAlpha = 0.25 }
          if (scene.kind.startsWith("raster-")) { ctx.globalAlpha = 1 }
          ctx.fill("evenodd"); ctx.globalAlpha = 1
          if (scene.kind.startsWith("raster-")) { return }
          ctx.strokeStyle = ["intensity-distribution", "secondary-hazard", "building-resilience"].includes(scene.kind) ? p.color : "#fff"; ctx.stroke()
        })
      }
    }
  }
  if (["secondary-hazard", "emergency-command", "chart-linkage"].includes(scene.kind)) {
    scene.features.filter(f => !f.properties.arrow).slice(0, scene.kind === "chart-linkage" ? 6 : 9).forEach(f => {
      const [x, y] = project(pointOnFeature(f).geometry.coordinates)
      label(ctx, String(f.properties.name).split(" · ")[0], x + 14, y - 16, 17)
    })
  }
  for (const annotation of scene.annotations || []) {
    const [x, y] = project(annotation.position)
    if (annotation.symbolKind) { ctx.drawImage(images.get(annotation.symbolKind)!, x - 16, y - 16, 32, 32) }
    label(ctx, annotation.label, x + (annotation.symbolKind ? 22 : -45), y - 15, annotation.symbolKind ? 22 : 20)
  }
  ctx.restore()
}

function drawCoordinates(ctx: CanvasRenderingContext2D) {
  const b = CATALOG_SAMPLE_BOUNDS
  ctx.save(); ctx.strokeStyle = "#687978"; ctx.fillStyle = "#222"; ctx.lineWidth = 0.5
  ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  for (let i = 1; i < 4; i++) {
    const x = map.x + map.w * i / 4; const y = map.y + map.h * i / 4
    const longitude = `${(b.west + (b.east - b.west) * i / 4).toFixed(2)}°E`; const latitude = `${(b.north - (b.north - b.south) * i / 4).toFixed(2)}°N`
    ctx.beginPath(); ctx.moveTo(x, map.y - 4); ctx.lineTo(x, map.y + 5); ctx.moveTo(x, map.y + map.h - 5); ctx.lineTo(x, map.y + map.h + 4); ctx.stroke()
    ctx.fillText(longitude, x, map.y - 12); ctx.fillText(longitude, x, map.y + map.h + 12)
    ctx.save(); ctx.translate(map.x - 12, y); ctx.rotate(-Math.PI / 2); ctx.fillText(latitude, 0, 0); ctx.restore()
    ctx.save(); ctx.translate(map.x + map.w + 12, y); ctx.rotate(Math.PI / 2); ctx.fillText(latitude, 0, 0); ctx.restore()
  }
  ctx.restore()
}

export async function drawCatalogPreview(canvas: HTMLCanvasElement, kind: string, palette: string, imageUrl = "", title = "", description = "", legend?: TemplateScene["legend"]) {
  canvas.width = STANDARD_SHEET.width; canvas.height = STANDARD_SHEET.height
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
  let rows = legend || []; let unit = ""; let sampleCopy = ""; let scene: TemplateScene | undefined
  if (imageUrl) {
    const image = new Image(); image.src = imageUrl; await image.decode()
    const ratio = Math.min(map.w / image.width, map.h / image.height)
    ctx.drawImage(image, map.x + (map.w - image.width * ratio) / 2, map.y + (map.h - image.height * ratio) / 2, image.width * ratio, image.height * ratio)
  } else {
    const sample = await loadTemplateSample(kind)
    scene = renderTemplateDocument(kind, sample, CATALOG_SAMPLE_BOUNDS, { palette: palette || defaultPalettes[kind] || "sequential-blue", field: kind === "unique-value" ? "category" : "value", count: 5 })
    await drawCatalogScene(ctx, scene, sample); drawCoordinates(ctx); rows = scene.legend; unit = scene.unit; sampleCopy = sample.metadata.previewDescription
  }
  const text = (value: string, x: number, y: number, width: number, size = 22) => {
    ctx.fillStyle = "#222"; ctx.font = `${size}px "Microsoft YaHei",sans-serif`; ctx.textBaseline = "top"; ctx.fillText(value, x, y, width)
  }
  const slots = STANDARD_SLOTS
  ctx.textAlign = "center"; text(title || `${TEMPLATE_CONTRACTS[kind]?.name || "专题图"} · 合成测试样例`, slots.title.x + slots.title.w / 2, slots.title.y + 6, slots.title.w - 20, 36); ctx.textAlign = "left"
  drawStandardFrame(ctx, map)
  const nx = slots.north.x + slots.north.w / 2; const ny = slots.north.y
  text("N", nx - 10, ny + 6, 40, 28)
  ctx.beginPath(); ctx.moveTo(nx, ny + 40); ctx.lineTo(nx - 13, ny + 90); ctx.lineTo(nx, ny + 72); ctx.lineTo(nx + 13, ny + 90); ctx.closePath(); ctx.fill()
  text("内容说明", slots.description.x, slots.description.y + 6, slots.description.w, 26)
  const copy = imageUrl ? description || "当前框选范围的实际渲染结果" : sampleCopy
  const lines = copy.match(/[^\n]{1,17}/g) || []
  lines.slice(0, 6).forEach((line, i) => text(line, slots.description.x, slots.description.y + 50 + i * 29, slots.description.w - 10, 21))
  text(unit ? `图例（${unit}）` : "图例", slots.legend.x + 10, slots.legend.y + 6, slots.legend.w - 20, 22)
  rows.slice(0, 10).forEach((entry, i) => {
    ctx.fillStyle = entry.color; ctx.fillRect(slots.legend.x + 10, slots.legend.y + 47 + i * 32, 22, 22)
    text(entry.label, slots.legend.x + 46, slots.legend.y + 48 + i * 32, slots.legend.w - 60, 20)
  })
  if (scene?.kind === "chart-linkage") {
    const top = scene.rows.slice(0, 6); const maximum = Math.max(...top.map(row => row.value), 1)
    text("分区统计（同源数据）", 1240, 700, 365, 22)
    top.forEach((row, i) => {
      text(row.label, 1240, 743 + i * 37, 110, 16); ctx.fillStyle = row.color; ctx.fillRect(1360, 743 + i * 37, 165 * row.value / maximum, 21)
      text(String(row.value), 1540, 743 + i * 37, 65, 16)
    })
  }
  if (imageUrl) { text("比例尺见实际排版", slots.scale.x + 10, slots.scale.y + 6, slots.scale.w - 20, 18) } else {
    const b = CATALOG_SAMPLE_BOUNDS
    drawStandardScale(ctx, slots.scale, distance([b.west, (b.north + b.south) / 2], [b.east, (b.north + b.south) / 2], { units: "meters" }) / map.w)
  }
  text(imageUrl ? "数据来源：当前渲染数据" : "数据来源：本地合成测试数据（CRS84）", 420, 1054, 660, 20)
  text("制图单位：待填写", 1110, 1054, 520, 20); text("制图时间：待填写", 1110, 1100, 520, 20)
  if (!imageUrl) { text("合成测试 · 非真实事件 · 非正式标准成果", 420, 1096, 660, 20) }
}
