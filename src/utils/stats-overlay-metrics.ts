export type StatsOverlayLod = "hidden" | "region" | "columns" | "labels"

export const STATS_OVERLAY_LOD_HEIGHTS = {
  hideRegionAbove: 300_000,
  showColumnsBelow: 10_000,
  showLabelsBelow: 2_500
} as const

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount
}

/**
 * Calculates world-space dimensions for the statistics peaks without changing
 * the map camera. The camera height only constrains visual footprint.
 */
export function getAdaptiveStatsPeakMetrics(areaM2: number, cameraHeight = 50000) {
  const safeArea = Math.max(0, Number(areaM2) || 0)
  const side = Math.sqrt(safeArea)
  const areaRadius = clamp((side / 110) * 12, 18, 1440)
  const height = Math.max(1800, Math.min(side / 1.6, 18000))
  const safeCameraHeight = clamp(Number(cameraHeight) || 50000, 100, 280000)
  // Keep close-range columns readable without allowing their bases to fill the view.
  const viewRadius = clamp(safeCameraHeight * 0.035, 18, 360)
  // At 500m the chart intentionally becomes slim/tall; by 10km it returns
  // to the normal proportion. Interpolation avoids visible jumps while zooming.
  const closeFactor = 1 - clamp((safeCameraHeight - 500) / 9500, 0, 1)
  const widthScale = lerp(1, 0.33, closeFactor)
  const heightScale = lerp(1, 1.5, closeFactor)
  const radius = Math.min(areaRadius, viewRadius) * widthScale
  const tipRadius = Math.max(6, radius * 0.18)
  const dotSize = Math.max(4, Math.min(radius * 0.18, 10))
  return {
    radius,
    tipRadius,
    dotSize,
    maxHeight: height * heightScale,
    areaM2: safeArea,
    widthScale,
    heightScale
  }
}

export function getStatsOverlayLod(cameraHeight: number): StatsOverlayLod {
  const height = Math.max(0, Number(cameraHeight) || 0)
  if (height > STATS_OVERLAY_LOD_HEIGHTS.hideRegionAbove) {
    return "hidden"
  }
  if (height >= STATS_OVERLAY_LOD_HEIGHTS.showColumnsBelow) {
    return "region"
  }
  if (height >= STATS_OVERLAY_LOD_HEIGHTS.showLabelsBelow) {
    return "columns"
  }
  return "labels"
}
