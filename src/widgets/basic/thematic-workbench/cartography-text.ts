export type CartographyTextLayout = { lines: string[]; size: number; lineHeight: number; height: number; fits: boolean }

export function layoutCartographyText(value: string, width: number, height: number, size: number, measure: (text: string, size: number) => number, minimumSize = size): CartographyTextLayout {
  for (let fontSize = size; ; fontSize--) {
    const lines: string[] = []
    for (const paragraph of value.replace(/\r\n?/g, "\n").split("\n")) {
      let line = ""
      for (const character of paragraph) {
        if (line && measure(line + character, fontSize) > width) { lines.push(line); line = "" }
        line += character
      }
      lines.push(line)
    }
    const lineHeight = fontSize * 1.5
    const required = lines.length * lineHeight + 4
    const fits = required <= height && lines.every(line => measure(line, fontSize) <= width)
    if (fits || fontSize <= minimumSize) { return { lines, size: fontSize, lineHeight, height: required, fits } }
  }
}

export function measureCartographyText(ctx: CanvasRenderingContext2D, value: string, width: number, height: number, size: number, bold = false, minimumSize = size) {
  ctx.save()
  try {
    return layoutCartographyText(value, width - 4, height, size, (line, fontSize) => {
      ctx.font = `${bold ? "bold " : ""}${fontSize}px "Microsoft YaHei", sans-serif`
      return ctx.measureText(line).width
    }, minimumSize)
  } finally { ctx.restore() }
}

export function drawCartographyText(ctx: CanvasRenderingContext2D, layout: CartographyTextLayout, x: number, y: number, width: number, height: number, bold = false, center = false, halo = false, ink = "#171717") {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip()
  ctx.font = `${bold ? "bold " : ""}${layout.size}px "Microsoft YaHei", sans-serif`
  ctx.fillStyle = ink; ctx.textBaseline = "alphabetic"; ctx.textAlign = center ? "center" : "left"
  const ascent = Math.max(layout.size, ...layout.lines.map(line => ctx.measureText(line).actualBoundingBoxAscent || 0))
  const left = center ? x + width / 2 : x + 2
  layout.lines.forEach((line, index) => {
    const baseline = y + 2 + ascent + index * layout.lineHeight
    if (halo) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.strokeText(line, left, baseline) }
    ctx.fillText(line, left, baseline)
  })
  ctx.restore()
}
