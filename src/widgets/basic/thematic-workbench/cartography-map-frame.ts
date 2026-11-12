import type { DbtBounds } from "./dbt116-standard"

export function referenceMapFrame(bounds: DbtBounds, slot: { x: number; y: number; w: number; h: number }, align: "center" | "top" = "center") {
  const ratio = (bounds.east - bounds.west) / (bounds.north - bounds.south)
  const w = Math.min(slot.w, slot.h * ratio); const h = w / ratio
  return { x: slot.x + (slot.w - w) / 2, y: align === "top" ? slot.y : slot.y + (slot.h - h) / 2, w, h }
}
