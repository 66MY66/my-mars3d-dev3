import type { Rect2D } from "./cartography-layout"

export const STANDARD_SHEET = { width: 1680, height: 1188, margin: 40 }
export const STANDARD_SLOTS = {
  title: { x: 50, y: 40, w: 1580, h: 95 },
  map: { x: 72, y: 178, w: 1100, h: 816 },
  north: { x: 1070, y: 196, w: 80, h: 106 },
  description: { x: 1230, y: 155, w: 400, h: 250 },
  legend: { x: 1230, y: 430, w: 400, h: 564 },
  scale: { x: 60, y: 1040, w: 330, h: 75 },
  source: { x: 420, y: 1040, w: 660, h: 98 },
  agency: { x: 1110, y: 1040, w: 520, h: 44 },
  time: { x: 1110, y: 1090, w: 520, h: 44 }
} satisfies Record<string, Rect2D>

export function standardChartSlots(count: number): Rect2D[] {
  if (!count) { return [] }
  const rows = Math.min(count, 3); const columns = Math.ceil(count / 3)
  const w = (400 - (columns - 1) * 14) / columns
  const h = (364 - (rows - 1) * 12) / rows
  return Array.from({ length: count }, (_, index) => ({ x: 1230 + Math.floor(index / 3) * (w + 14), y: 630 + index % 3 * (h + 12), w, h }))
}

export function standardScale(metersPerPixel: number, maxWidth: number) {
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) { return null }
  const stepKm = Math.floor(metersPerPixel * maxWidth / 1000 / 2 / 5) * 5
  return stepKm >= 5 ? { stepKm, pixels: stepKm * 2000 / metersPerPixel } : null
}

export function drawStandardFrame(ctx: CanvasRenderingContext2D, rect: Rect2D) {
  ctx.save(); ctx.setLineDash([]); ctx.lineWidth = 1.2; ctx.strokeStyle = "#222222"
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  ctx.strokeRect(rect.x - 20, rect.y - 20, rect.w + 40, rect.h + 40)
  ctx.restore()
}

export function drawStandardScale(ctx: CanvasRenderingContext2D, rect: Rect2D, metersPerPixel: number, color = "#222222") {
  const scale = standardScale(metersPerPixel, rect.w - 30)
  if (!scale) { return false }
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2
  ctx.font = '18px "Microsoft YaHei",sans-serif'; ctx.textBaseline = "top"
  const x = rect.x + 10; const y = rect.y + 44
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + scale.pixels, y)
  for (let i = 0; i < 3; i++) {
    const px = x + scale.pixels * i / 2
    ctx.moveTo(px, y); ctx.lineTo(px, y - 12)
    ctx.textAlign = (["left", "center", "right"] as const)[i]
    ctx.fillText(`${scale.stepKm * i}${i === 2 ? " km" : ""}`, px, rect.y + 4)
  }
  ctx.stroke(); ctx.restore(); return true
}
