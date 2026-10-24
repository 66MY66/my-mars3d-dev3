import { niceScale, type LegendEntry } from "./display-model"
import { ADORNMENT_KEYS, validScale, type AdornmentKey, type Corner, type ElementStyle, type AdornmentSettings, type AdornmentMetrics } from "./cartography-layout"
export type { AdornmentSettings, AdornmentMetrics } from "./cartography-layout"

export function validateAdornments(settings: AdornmentSettings, legend: LegendEntry[], metrics: AdornmentMetrics | null) {
  return [
    { label: "标题", valid: !!settings.title.trim() },
    { label: "图例", valid: !!settings.legendTitle.trim() && legend.length > 0 },
    { label: "比例尺", valid: validScale(settings.scaleDenominator) && !!metrics && metrics.selectionWidth > 0 && !!niceScale(metrics.metersPerPixel) },
    { label: "指北针", valid: !!metrics && Number.isFinite(metrics.northAngle) },
    { label: "时间", valid: !!settings.time.trim() && Number.isFinite(Date.parse(settings.time)) },
    { label: "来源", valid: !!settings.source.trim() }
  ].map((item, index) => ({ ...item, valid: settings.enabled?.[ADORNMENT_KEYS[index]] === false || item.valid }))
}

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  let line = ""
  for (const letter of Array.from(text)) {
    if (letter === "\n") { lines.push(line); line = ""; continue }
    if (context.measureText(line + letter).width > maxWidth && line) { lines.push(line); line = "" }
    line += letter
  }
  if (line) { lines.push(line) }
  return lines
}
function font(style: ElementStyle) { return `${style.fontSize}px ${style.font === "serif" ? "SimSun, serif" : "Microsoft YaHei, sans-serif"}` }
function alignmentOffset(align: ElementStyle["align"], width: number) {
  if (align === "center") { return width / 2 }
  return align === "right" ? width : 0
}
type Block = { key: AdornmentKey; style: ElementStyle; lines: string[][]; height: number }

export function composeMap(image: HTMLImageElement, settings: AdornmentSettings, legend: LegendEntry[], metrics: AdornmentMetrics, options: { width?: number; picture?: HTMLImageElement | null } = {}) {
  const missing = validateAdornments(settings, legend, metrics).filter(item => !item.valid)
  if (missing.length) { throw new Error(`整饰不完整：${missing.map(item => item.label).join("、")}`) }
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")!
  const mapWidth = 1100
  const mapHeight = Math.max(1, Math.round(image.naturalHeight * mapWidth / image.naturalWidth))
  const margin = Math.max(20, settings.safeMargin)
  const gap = 20
  const columnWidth = (mapWidth - gap) / 2
  const text: Record<AdornmentKey, string[]> = {
    title: [settings.title],
legend: [settings.legendTitle, ...legend.map(item => item.label)],
    scale: [`出图档位 1:${settings.scaleDenominator}`, "中心比例尺"],
north: ["N"],
time: [`制图时间：${settings.time}`],
source: [`数据来源：${settings.source}`]
  }
  const blocks: Block[] = ADORNMENT_KEYS.filter(key => settings.enabled?.[key] !== false).map(key => {
    const style = settings.elements[key]
    context.font = font(style)
    const lines = text[key].map(line => wrap(context, line, columnWidth - (key === "legend" ? 38 : 0)))
    const height = key === "north" ? 112 : lines.reduce((sum, rows) => sum + rows.length * (style.fontSize + 8), 0) + (key === "scale" ? 62 : 0)
    return { key, style, lines, height }
  })
  const corners: Corner[] = ["top-left", "top-right", "bottom-left", "bottom-right"]
  const cornerHeight = (corner: Corner) => blocks.filter(block => block.style.corner === corner).reduce((height, block) => height + block.height + gap, 0)
  const topHeight = Math.max(cornerHeight("top-left"), cornerHeight("top-right"))
  const bottomHeight = Math.max(cornerHeight("bottom-left"), cornerHeight("bottom-right"))
  context.font = font(settings.elements.source)
  const noteLines = settings.enabled?.text ? wrap(context, settings.text || "", mapWidth) : []
  const noteHeight = noteLines.length * (settings.elements.source.fontSize + 8)
  const pictureHeight = settings.enabled?.image && options.picture ? Math.min(220, options.picture.naturalHeight * mapWidth / options.picture.naturalWidth) + gap : 0
  const width = mapWidth + margin * 2
  const height = margin * 2 + topHeight + mapHeight + gap + bottomHeight + noteHeight + pictureHeight
  const resolution = (options.width || width) / width
  if (height * resolution > 16000 || width * height * resolution ** 2 > 32_000_000) { throw new Error("整饰内容超过单张图幅容量，请降低清晰度或缩短文字") }
  canvas.width = Math.round(width * resolution)
  canvas.height = Math.round(height * resolution)
  context.scale(resolution, resolution)
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, margin, margin + topHeight, mapWidth, mapHeight)
  context.strokeStyle = "#344451"
  context.lineWidth = 1
  context.strokeRect(margin, margin + topHeight, mapWidth, mapHeight)
  for (const corner of corners) {
    const left = corner.endsWith("right") ? margin + columnWidth + gap : margin
    let y = corner.startsWith("bottom") ? margin + topHeight + mapHeight + gap : margin
    for (const block of blocks.filter(item => item.style.corner === corner)) {
      const { key, style, lines } = block
      const originY = y
      context.fillStyle = style.color
      context.font = font(style)
      context.textBaseline = "top"
      context.textAlign = style.align
      const x = left + alignmentOffset(style.align, columnWidth)
      if (key === "north") {
        context.save()
        context.translate(left + 56 + alignmentOffset(style.align, columnWidth - 112), y + 56)
        context.rotate(metrics.northAngle)
        context.textAlign = "center"
        context.fillText("N", 0, -50)
        context.beginPath(); context.moveTo(0, -20); context.lineTo(-13, 28); context.lineTo(0, 16); context.lineTo(13, 28); context.closePath(); context.fill()
        context.restore()
      } else {
        lines.forEach((rows, index) => {
          if (key === "legend" && index > 0) {
            context.fillStyle = legend[index - 1].color
            context.fillRect(left, y + 3, 22, 16)
            context.fillStyle = style.color
          }
          const textX = key === "legend" && index > 0 ? left + 34 + alignmentOffset(style.align, columnWidth - 34) : x
          rows.forEach(line => { context.fillText(line, textX, y); y += style.fontSize + 8 })
        })
        if (key === "scale") {
          const scale = niceScale(metrics.metersPerPixel * metrics.selectionWidth / mapWidth, 180)!
          const sx = left + alignmentOffset(style.align, columnWidth - scale.pixels)
          context.fillRect(sx, y + 5, scale.pixels / 2, 9)
          context.strokeStyle = style.color
          context.strokeRect(sx, y + 5, scale.pixels, 9)
          context.textAlign = "left"; context.fillText("0", sx, y + 23)
          context.textAlign = "right"; context.fillText(scale.label, sx + scale.pixels, y + 23)
        }
      }
      y = originY + block.height + gap
    }
  }
  let footerY = margin + topHeight + mapHeight + gap + bottomHeight
  context.font = font(settings.elements.source); context.fillStyle = settings.elements.source.color; context.textAlign = "left"
  for (const line of noteLines) { context.fillText(line, margin, footerY); footerY += settings.elements.source.fontSize + 8 }
  if (pictureHeight && options.picture) {
    const h = pictureHeight - gap
    const w = h * options.picture.naturalWidth / options.picture.naturalHeight
    context.drawImage(options.picture, margin, footerY, w, h)
  }
  return canvas
}
