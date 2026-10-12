export interface VectorLayerStyleState {
  fillColor: string
  fillOpacity: number
  outlineColor: string
  outlineWidth: number
  pointSize: number
  labelField: string
}

export const DEFAULT_VECTOR_LAYER_STYLE: Readonly<VectorLayerStyleState> = Object.freeze({
  fillColor: "#5cadff",
  fillOpacity: 0.25,
  outlineColor: "#5cadff",
  outlineWidth: 2,
  pointSize: 10,
  labelField: ""
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeText(input: any): string {
  return typeof input === "string" ? input.trim() : ""
}

function normalizeNumber(input: any, fallback: number, min: number, max: number): number {
  const value = Number(input)
  if (!Number.isFinite(value)) {
    return fallback
  }
  return clamp(value, min, max)
}

export function toVectorStyleState(input?: Partial<VectorLayerStyleState> | null): VectorLayerStyleState {
  return {
    fillColor: normalizeText(input?.fillColor) || DEFAULT_VECTOR_LAYER_STYLE.fillColor,
    fillOpacity: normalizeNumber(input?.fillOpacity, DEFAULT_VECTOR_LAYER_STYLE.fillOpacity, 0, 1),
    outlineColor: normalizeText(input?.outlineColor) || DEFAULT_VECTOR_LAYER_STYLE.outlineColor,
    outlineWidth: normalizeNumber(input?.outlineWidth, DEFAULT_VECTOR_LAYER_STYLE.outlineWidth, 0, 10),
    pointSize: normalizeNumber(input?.pointSize, DEFAULT_VECTOR_LAYER_STYLE.pointSize, 1, 40),
    labelField: normalizeText(input?.labelField)
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim())
  const safeAlpha = clamp(Number(alpha), 0, 1)
  if (!match) {
    return `rgba(92,173,255,${safeAlpha})`
  }
  const raw = match[1]
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${safeAlpha})`
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")
  return `#${to(r)}${to(g)}${to(b)}`
}

function parseColor(input: any): { hex: string; alpha: number } | null {
  const raw = String(input || "").trim()
  if (!raw) {
    return null
  }

  const hexMatch = /^#?([0-9a-f]{6})$/i.exec(raw)
  if (hexMatch) {
    return { hex: `#${hexMatch[1]}`.toLowerCase(), alpha: 1 }
  }

  const rgbaMatch = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i.exec(raw)
  if (!rgbaMatch) {
    return null
  }

  const r = Number(rgbaMatch[1])
  const g = Number(rgbaMatch[2])
  const b = Number(rgbaMatch[3])
  const a = rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4])
  if (![r, g, b, a].every((value) => Number.isFinite(value))) {
    return null
  }
  return {
    hex: rgbToHex(r, g, b),
    alpha: clamp(a, 0, 1)
  }
}

function buildLabelStyle(labelField: string) {
  const normalized = normalizeText(labelField)
  if (!normalized) {
    return undefined
  }
  return {
    text: `{${normalized}}`,
    color: "#ffffff",
    outline: true,
    outlineColor: "#000000",
    outlineWidth: 2,
    font_size: 16,
    pixelOffsetY: -18
  }
}

function getGeometryKind(feature: any): "point" | "line" | "polygon" {
  const raw = String(feature?.geometry?.type || "").toLowerCase()
  if (raw.includes("point")) {
    return "point"
  }
  if (raw.includes("line")) {
    return "line"
  }
  return "polygon"
}

function buildGeometryStyle(styleOptions: Record<string, any>, feature: any) {
  const kind = getGeometryKind(feature)
  const label = styleOptions?.label
  const outlineColor = styleOptions?.outlineColor || styleOptions?.color || "rgba(92,173,255,1)"
  const outlineWidth = normalizeNumber(styleOptions?.outlineWidth, DEFAULT_VECTOR_LAYER_STYLE.outlineWidth, 0, 10)
  const pixelSize = normalizeNumber(styleOptions?.pixelSize, DEFAULT_VECTOR_LAYER_STYLE.pointSize, 1, 40)

  if (kind === "point") {
    return {
      color: outlineColor,
      opacity: 1,
      pixelSize,
      outline: true,
      outlineColor: "#ffffff",
      outlineWidth: 2,
      clampToGround: true,
      ...(label ? { label } : {})
    }
  }

  if (kind === "line") {
    return {
      color: outlineColor,
      opacity: 1,
      width: Math.max(1, outlineWidth),
      clampToGround: true,
      ...(label ? { label } : {})
    }
  }

  return {
    color: styleOptions?.color || hexToRgba(DEFAULT_VECTOR_LAYER_STYLE.fillColor, DEFAULT_VECTOR_LAYER_STYLE.fillOpacity),
    outline: true,
    outlineColor,
    outlineWidth,
    clampToGround: true,
    ...(label ? { label } : {})
  }
}

export function buildVectorLayerSymbol(input?: Partial<VectorLayerStyleState> | null): Record<string, any> {
  const style = toVectorStyleState(input)
  const styleOptions: Record<string, any> = {
    color: hexToRgba(style.fillColor, style.fillOpacity),
    outline: true,
    outlineColor: style.outlineColor,
    outlineWidth: style.outlineWidth,
    pixelSize: style.pointSize,
    clampToGround: true,
    labelField: style.labelField
  }
  const label = buildLabelStyle(style.labelField)
  if (label) {
    styleOptions.label = label
  }

  return {
    styleOptions,
    applyVectorStyleByGeometry: true,
    callback: (_attr: any, styleOpt: Record<string, any>, feature: any) => buildGeometryStyle(styleOpt || styleOptions, feature)
  }
}

function parseLabelField(symbol: any): string {
  const text = normalizeText(symbol?.styleOptions?.label?.text)
  if (text.startsWith("{") && text.endsWith("}") && text.length > 2) {
    return text.slice(1, -1).trim()
  }
  return normalizeText(symbol?.styleOptions?.labelField || symbol?.labelField)
}

export function extractVectorLayerStyle(symbol?: any): VectorLayerStyleState {
  const styleOptions = symbol?.styleOptions || {}
  const fillColor = parseColor(styleOptions?.color)
  const outlineColor = parseColor(styleOptions?.outlineColor)

  return toVectorStyleState({
    fillColor: fillColor?.hex,
    fillOpacity: typeof styleOptions?.fillOpacity === "number" ? styleOptions.fillOpacity : fillColor?.alpha,
    outlineColor: outlineColor?.hex,
    outlineWidth: styleOptions?.outlineWidth,
    pointSize: styleOptions?.pixelSize,
    labelField: parseLabelField(symbol)
  })
}

export function normalizeVectorLayerSymbol(symbol?: any, fallback?: Partial<VectorLayerStyleState> | null): any {
  if (!symbol || typeof symbol !== "object") {
    return buildVectorLayerSymbol(fallback)
  }
  if (typeof symbol.callback === "function") {
    return symbol
  }

  const normalized = buildVectorLayerSymbol({
    ...toVectorStyleState(fallback),
    ...extractVectorLayerStyle(symbol)
  })

  return {
    ...symbol,
    ...normalized,
    styleOptions: {
      ...normalized.styleOptions,
      ...(symbol?.styleOptions || {})
    }
  }
}
