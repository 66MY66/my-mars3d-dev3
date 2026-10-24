import { PAGE, normalizeRotation } from "./composition-model"
import type { Rect2D } from "./cartography-layout"

export function snapRotation(degrees: number, shift = false, free = false) {
  if (shift) { return normalizeRotation(Math.round(degrees / 15) * 15) }
  const nearest = Math.round(degrees / 45) * 45
  return normalizeRotation(Math.round(!free && Math.abs(nearest - degrees) <= 3 ? nearest : degrees))
}

// Pick an external handle position inside the paper, independent of the element's transform.
export function rotationHandle(rect: Rect2D, rotation: number, zoom: number) {
  const angle = rotation * Math.PI / 180
  const cos = Math.cos(angle); const sin = Math.sin(angle)
  const center = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
  const gap = 40 / zoom; const inset = 24 / zoom
  const candidates = [[0, -rect.h / 2], [0, rect.h / 2], [rect.w / 2, 0], [-rect.w / 2, 0]].map(([x, y]) => {
    const length = Math.hypot(x, y)
    const dx = x * cos - y * sin; const dy = x * sin + y * cos
    return { x: center.x + dx * (1 + gap / length), y: center.y + dy * (1 + gap / length), anchorX: center.x + dx, anchorY: center.y + dy }
  })
  return candidates.find(point => point.x >= inset && point.x <= PAGE.width - inset && point.y >= inset && point.y <= PAGE.height - inset) ?? candidates[0]
}
