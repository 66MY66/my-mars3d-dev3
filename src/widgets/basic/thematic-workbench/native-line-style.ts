type NativeGraphic = {
  type: string
  eachGraphic?: (visit: (graphic: NativeGraphic) => void) => void
  setStyle?: (style: Record<string, unknown>) => unknown
}

// Polyline outlines in the installed renderer can introduce a closing chord.
// Keep source paths, including explicitly closed rings, without inventing an edge.
export function preserveNativeLinePaths(layer: { graphics: NativeGraphic[] }) {
  const visit = (graphic: NativeGraphic) => {
    if (graphic.type === "group") { graphic.eachGraphic?.(visit); return }
    // A line's fill is its stroke material; inherited polygon fill:false hides the whole line.
    if (["polyline", "polylineP"].includes(graphic.type)) { graphic.setStyle?.({ fill: true, outline: false, closure: false }) }
  }
  layer.graphics.forEach(visit)
}
