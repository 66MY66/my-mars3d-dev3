import { VectorTile } from "@mapbox/vector-tile"
import { PbfReader } from "pbf"

export function paintVectorTile(buffer: ArrayBuffer, options: { fillColor?: string; lineColor?: string; sourceLayer?: string } = {}) {
  const tile = new VectorTile(new PbfReader(buffer))
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = options.fillColor || "rgba(44, 159, 184, 0.45)"
  ctx.strokeStyle = options.lineColor || "#2872a3"
  ctx.lineWidth = 1.5
  for (const [name, layer] of Object.entries(tile.layers)) {
    if (options.sourceLayer && name !== options.sourceLayer) { continue }
    for (let index = 0; index < layer.length; index++) {
      const feature = layer.feature(index)
      const factor = 256 / feature.extent
      ctx.beginPath()
      for (const ring of feature.loadGeometry()) {
        ring.forEach((point, position) => {
          const x = point.x * factor; const y = point.y * factor
          if (feature.type === 1) { ctx.moveTo(x + 3, y); ctx.arc(x, y, 3, 0, Math.PI * 2) } else if (position === 0) { ctx.moveTo(x, y) } else { ctx.lineTo(x, y) }
        })
        if (feature.type === 3) { ctx.closePath() }
      }
      if (feature.type !== 2) { ctx.fill("evenodd") }
      ctx.stroke()
    }
  }
  return canvas
}
