export type BufferDistanceUnit = "m" | "km"
export type BufferMode = "single" | "multi"

export type BufferModelInput = {
  mode: BufferMode
  unit: BufferDistanceUnit
  distance: number
  ringDistances: number[]
  enabledRingIndexes: number[]
}

export function convertDistanceValue(value: number, from: BufferDistanceUnit, to: BufferDistanceUnit): number {
  const distance = Number(value)
  if (!Number.isFinite(distance) || from === to) {
    return Number.isFinite(distance) ? distance : 0
  }
  return from === "m" ? distance / 1000 : distance * 1000
}

export function buildBufferRequestParams(input: BufferModelInput): Record<string, any> {
  const toMeters = (value: number) => Math.max(0, convertDistanceValue(value, input.unit, "m"))
  if (input.mode === "single") {
    return { mode: "single", distanceUnit: "m", radiusM: toMeters(input.distance), opacity: 70, smooth: 64 }
  }

  const enabledDistances = new Set(input.enabledRingIndexes
    .map((index) => input.ringDistances[index])
    .filter((value) => Number.isFinite(Number(value)) && Number(value) > 0)
    .map(toMeters))
  const distancesM = [...new Set(input.ringDistances.map(toMeters).filter((value) => value > 0))].sort((a, b) => a - b)
  const enabledRingIndexes = distancesM
    .map((distance, index) => enabledDistances.has(distance) ? index : -1)
    .filter((index) => index >= 0)
  return { mode: "multi", distanceUnit: "m", distancesM, enabledRingIndexes, opacity: 70, smooth: 64 }
}

export type BufferRunToken = { id: number; kind: "preview" | "analysis" }

export function createBufferRunCoordinator() {
  let sequence = 0
  let activeAnalysisId: number | null = null

  return {
    beginPreview(): BufferRunToken | null {
      if (activeAnalysisId != null) {
        return null
      }
      return { id: ++sequence, kind: "preview" }
    },
    beginAnalysis(): BufferRunToken {
      const token = { id: ++sequence, kind: "analysis" } as const
      activeAnalysisId = token.id
      return token
    },
    isCurrent(token: BufferRunToken): boolean {
      return token.id === sequence && (token.kind !== "analysis" || activeAnalysisId === token.id)
    },
    finish(token: BufferRunToken): void {
      if (token.kind === "analysis" && activeAnalysisId === token.id) {
        activeAnalysisId = null
      }
    },
    cancel(): void {
      sequence += 1
      activeAnalysisId = null
    }
  }
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${Number((meters / 1000).toFixed(3))} km`
  }
  return `${Math.round(meters).toLocaleString()} m`
}

function formatArea(areaM2: number): string {
  if (areaM2 >= 100_000) {
    return `${Number((areaM2 / 1_000_000).toFixed(2))} km²`
  }
  return `${Math.round(areaM2).toLocaleString()} m²`
}

function formatRange(startM: number, endM: number): string {
  if (startM >= 1000 && endM >= 1000) {
    return `${Number((startM / 1000).toFixed(3))}–${Number((endM / 1000).toFixed(3))} km`
  }
  if (startM < 1000 && endM < 1000) {
    return `${Math.round(startM).toLocaleString()}–${Math.round(endM).toLocaleString()} m`
  }
  return `${startM === 0 ? "0" : formatDistance(startM)}–${formatDistance(endM)}`
}

export function buildBufferResultView(summary: Record<string, any>) {
  const sourceNames: Record<string, string> = { point: "点", polyline: "线", polygon: "面" }
  const distances = Array.isArray(summary.distancesM) ? summary.distancesM.map(Number).filter(Number.isFinite) : []
  const maxDistance = summary.radiusM != null ? Number(summary.radiusM) : Math.max(0, ...distances)
  const cards = [
    { key: "source", label: "分析对象", value: sourceNames[summary.sourceType] || "未知" },
    { key: "mode", label: "缓冲方式", value: summary.mode === "multi" ? "多环缓冲" : "单环缓冲" },
    { key: "distance", label: "最大距离", value: formatDistance(maxDistance) },
    { key: "area", label: "覆盖面积", value: formatArea(Number(summary.totalAreaM2 ?? summary.areaM2 ?? 0)) }
  ]
  const rings = (Array.isArray(summary.ringStats) ? summary.ringStats : []).map((ring: any, index: number) => {
    const range = Array.isArray(ring.rangeM) ? ring.rangeM.map(Number) : [0, Number(ring.distanceM || 0)]
    return {
      key: `${ring.level || "ring"}-${index}`,
      level: String(ring.level || "ring"),
      label: ["核心区", "过渡区", "外围区"][index] || `第 ${index + 1} 环`,
      rangeText: formatRange(range[0], range[1]),
      areaText: formatArea(Number(ring.areaM2 || 0))
    }
  })
  return { cards, rings }
}
