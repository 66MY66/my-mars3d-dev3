import type { Rect2D } from "./cartography-layout"

export function workbenchDock(preferred: { left: number; top: number }, viewport: { width: number; height: number }, composerOpen: boolean) {
  const margin = 12
  const maxLeft = Math.max(margin, viewport.width - 400 - margin)
  const maxTop = Math.max(margin, viewport.height - 600 - margin)
  return {
    left: composerOpen ? maxLeft : Math.min(maxLeft, Math.max(margin, preferred.left)),
    top: Math.min(maxTop, Math.max(margin, preferred.top))
  }
}

export function composerDock(anchor: Rect2D, viewport: { width: number; height: number }): Rect2D {
  const gap = 12
  if (viewport.width <= 900) {
    const y = anchor.y + anchor.h + gap
    return { x: 12, y, w: Math.max(0, viewport.width - 24), h: Math.max(0, viewport.height - y - 12) }
  }
  const right = anchor.x - gap
  const w = Math.min(1120, Math.max(0, right - 72))
  return { x: right - w, y: anchor.y, w, h: Math.min(anchor.h, Math.max(0, viewport.height - anchor.y - 12)) }
}
