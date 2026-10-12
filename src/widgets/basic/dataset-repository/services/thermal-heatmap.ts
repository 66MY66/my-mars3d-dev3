const THERMAL_KEYWORDS = ["thermal", "heat", "temperature", "热异常", "热红外"]
const HEAT_VALUE_FIELDS = ["value", "heat", "intensity", "score", "temperature", "temp", "level"]

function normalizeText(input: any): string {
  return typeof input === "string" ? input.trim().toLowerCase() : ""
}

function isPointGeometry(type: string): boolean {
  const normalized = normalizeText(type)
  return normalized === "point" || normalized === "multipoint"
}

function getGeometryType(feature: any): string {
  return String(feature?.geometry?.type || "")
}

function detectValueField(features: any[]): string {
  for (const field of HEAT_VALUE_FIELDS) {
    if (features.some((feature) => Number.isFinite(Number(feature?.properties?.[field])))) {
      return field
    }
  }
  return "value"
}

function getFeatureValue(feature: any, valueField: string): number {
  const candidate = Number(feature?.properties?.[valueField])
  return Number.isFinite(candidate) ? candidate : 1
}

export function shouldRenderThermalHeatmap(data: any, ...hints: any[]): boolean {
  const features = Array.isArray(data?.features) ? data.features : []
  if (!features.length) {
    return false
  }
  if (!features.every((feature: any) => isPointGeometry(getGeometryType(feature)))) {
    return false
  }
  const haystack = hints.map((item) => normalizeText(item)).filter(Boolean).join(" ")
  return THERMAL_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

export function extractThermalHeatPositions(data: any): { positions: Array<Record<string, number>>; valueField: string } {
  const features = Array.isArray(data?.features) ? data.features : []
  const valueField = detectValueField(features)
  const positions: Array<Record<string, number>> = []

  for (const feature of features) {
    const geometryType = getGeometryType(feature)
    const coordinates = feature?.geometry?.coordinates
    const value = getFeatureValue(feature, valueField)

    if (normalizeText(geometryType) === "point" && Array.isArray(coordinates) && coordinates.length >= 2) {
      positions.push({
        lng: Number(coordinates[0]),
        lat: Number(coordinates[1]),
        value
      })
      continue
    }

    if (normalizeText(geometryType) === "multipoint" && Array.isArray(coordinates)) {
      coordinates.forEach((point: any) => {
        if (Array.isArray(point) && point.length >= 2) {
          positions.push({
            lng: Number(point[0]),
            lat: Number(point[1]),
            value
          })
        }
      })
    }
  }

  return {
    positions: positions.filter((item) => Number.isFinite(item.lng) && Number.isFinite(item.lat) && Number.isFinite(item.value)),
    valueField
  }
}

export function buildThermalHeatLayerOptions(id: string, data: any, options?: { name?: string; pid?: string | number | null }) {
  const { positions, valueField } = extractThermalHeatPositions(data)
  return {
    id,
    type: "heat",
    name: options?.name || id,
    pid: options?.pid ?? undefined,
    positions,
    data,
    styleProfile: "thermal",
    valueColumn: "value",
    heatValueField: valueField,
    heatStyle: {
      maxOpacity: 0.85,
      minOpacity: 0.15,
      blur: 0.85,
      radius: 28,
      gradient: {
        0.3: "#1b5e20",
        0.55: "#66bb6a",
        0.75: "#ffea00",
        0.9: "#ff6d00",
        1.0: "#d50000"
      }
    },
    style: {
      type: "image",
      opacity: 0.85,
      clampToGround: true
    },
    show: true
  }
}
