export type LocalNeighborRaster = {
  id: string
  name: string
  width: number
  height: number
  bounds: [number, number, number, number]
  nodata: number
  unit: string
  values: Float32Array
}

export type RasterSummary = {
  count: number
  mean: number | null
  maximum: number | null
  minimum: number | null
  stddev: number | null
  unit: string
}

export type FocalStatistic = "mean" | "maximum" | "minimum" | "stddev"
export type FocalWindowShape = "square" | "circle"
export type NoDataMode = "ignore" | "include"

function gaussian(x: number, y: number, centerX: number, centerY: number, spreadX: number, spreadY: number, amplitude: number) {
  const dx = (x - centerX) / spreadX
  const dy = (y - centerY) / spreadY
  return amplitude * Math.exp(-(dx * dx + dy * dy) / 2)
}

export function createLocalRiskRaster(): LocalNeighborRaster {
  const width = 512
  const height = 512
  const bounds: [number, number, number, number] = [97, 21, 109, 35]
  const nodata = -9999
  const values = new Float32Array(width * height)
  const [west, south, east, north] = bounds

  for (let row = 0; row < height; row++) {
    const latitude = north - ((row + 0.5) / height) * (north - south)
    for (let column = 0; column < width; column++) {
      const longitude = west + ((column + 0.5) / width) * (east - west)
      const isNoData = ((longitude - 105.65) / 0.48) ** 2 + ((latitude - 31.55) / 0.36) ** 2 <= 1
      if (isNoData) {
        values[row * width + column] = nodata
        continue
      }

      const value = 18 +
        2.2 * (longitude - west) +
        0.8 * (north - latitude) +
        gaussian(longitude, latitude, 104.07, 30.67, 0.85, 0.75, 43) +
        gaussian(longitude, latitude, 102.72, 25.04, 0.95, 0.85, 25) +
        gaussian(longitude, latitude, 106.55, 29.56, 0.65, 0.65, 18) -
        gaussian(longitude, latitude, 99.2, 28.7, 0.95, 1.25, 28) +
        4 * Math.sin((longitude - west) * 2.4) * Math.cos((latitude - south) * 1.7)
      values[row * width + column] = Math.max(0, Math.min(100, value))
    }
  }

  return { id: "local-synthetic-risk", name: "本地合成风险指数", width, height, bounds, nodata, unit: "index", values }
}

export function describeLocalRasterSource(raster: LocalNeighborRaster) {
  return {
    id: raster.id,
    label: raster.name,
    sourceType: "raster",
    sourceRef: `memory://${raster.id}`,
    bands: [{ value: "1", label: `风险指数（${raster.unit}）` }]
  }
}

function pointInPolygon(longitude: number, latitude: number, ring: Array<[number, number]>) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const crosses = (yi > latitude) !== (yj > latitude) &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi
    if (crosses) {
      inside = !inside
    }
  }
  return inside
}

function summarizeValues(values: number[], unit: string): RasterSummary {
  if (values.length === 0) {
    return { count: 0, mean: null, maximum: null, minimum: null, stddev: null, unit }
  }
  let sum = 0
  let sumSquares = 0
  let minimum = Infinity
  let maximum = -Infinity
  values.forEach((value) => {
    sum += value
    sumSquares += value * value
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
  })
  const mean = sum / values.length
  return {
    count: values.length,
    mean,
    maximum,
    minimum,
    stddev: Math.sqrt(Math.max(0, sumSquares / values.length - mean * mean)),
    unit
  }
}

export function summarizeRasterInPolygon(raster: LocalNeighborRaster, ring: Array<[number, number]>, noDataMode: NoDataMode): RasterSummary {
  if (!Array.isArray(ring) || ring.length < 3) {
    return summarizeValues([], raster.unit)
  }
  const [west, south, east, north] = raster.bounds
  const pixelWidth = (east - west) / raster.width
  const pixelHeight = (north - south) / raster.height
  const values: number[] = []

  for (let row = 0; row < raster.height; row++) {
    const latitude = north - (row + 0.5) * pixelHeight
    for (let column = 0; column < raster.width; column++) {
      const longitude = west + (column + 0.5) * pixelWidth
      if (!pointInPolygon(longitude, latitude, ring)) {
        continue
      }
      const value = raster.values[row * raster.width + column]
      if (value === raster.nodata) {
        if (noDataMode === "include") {
          values.push(0)
        }
        continue
      }
      if (Number.isFinite(value)) {
        values.push(value)
      }
    }
  }

  return summarizeValues(values, raster.unit)
}

function focalValue(values: number[], statistic: FocalStatistic) {
  if (values.length === 0) {
    return null
  }
  if (statistic === "maximum") {
    return values.reduce((result, value) => Math.max(result, value), -Infinity)
  }
  if (statistic === "minimum") {
    return values.reduce((result, value) => Math.min(result, value), Infinity)
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  if (statistic === "stddev") {
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
  }
  return mean
}

function normalizeWindowSize(value: number) {
  const size = Math.max(3, Math.min(31, Math.round(value)))
  return size % 2 === 0 ? Math.min(31, size + 1) : size
}

export function computeFocalRaster(
  raster: LocalNeighborRaster,
  options: { statistic: FocalStatistic; windowSize: number; windowShape: FocalWindowShape; noDataMode: NoDataMode }
): LocalNeighborRaster {
  const windowSize = normalizeWindowSize(options.windowSize)
  const radius = Math.floor(windowSize / 2)
  const output = new Float32Array(raster.values.length)

  for (let row = 0; row < raster.height; row++) {
    for (let column = 0; column < raster.width; column++) {
      const neighborhood: number[] = []
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset++) {
        const neighborRow = row + rowOffset
        if (neighborRow < 0 || neighborRow >= raster.height) {
          continue
        }
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset++) {
          if (options.windowShape === "circle" && rowOffset * rowOffset + columnOffset * columnOffset > radius * radius) {
            continue
          }
          const neighborColumn = column + columnOffset
          if (neighborColumn < 0 || neighborColumn >= raster.width) {
            continue
          }
          const value = raster.values[neighborRow * raster.width + neighborColumn]
          if (value === raster.nodata) {
            if (options.noDataMode === "include") {
              neighborhood.push(0)
            }
          } else if (Number.isFinite(value)) {
            neighborhood.push(value)
          }
        }
      }
      output[row * raster.width + column] = focalValue(neighborhood, options.statistic) ?? raster.nodata
    }
  }

  return { ...raster, id: `${raster.id}-focal`, name: `${raster.name}（焦点统计）`, values: output }
}

export function resampleRaster(raster: LocalNeighborRaster, maxDimension: number): LocalNeighborRaster {
  const scale = Math.min(1, Math.max(1, Math.round(maxDimension)) / Math.max(raster.width, raster.height))
  const width = Math.max(1, Math.round(raster.width * scale))
  const height = Math.max(1, Math.round(raster.height * scale))
  if (width === raster.width && height === raster.height) {
    return { ...raster, values: new Float32Array(raster.values) }
  }
  const values = new Float32Array(width * height)
  for (let row = 0; row < height; row++) {
    const sourceRow = height === 1 ? 0 : Math.round((row * (raster.height - 1)) / (height - 1))
    for (let column = 0; column < width; column++) {
      const sourceColumn = width === 1 ? 0 : Math.round((column * (raster.width - 1)) / (width - 1))
      values[row * width + column] = raster.values[sourceRow * raster.width + sourceColumn]
    }
  }
  return { ...raster, id: `${raster.id}-preview`, width, height, values }
}

export function maskRasterToPolygon(raster: LocalNeighborRaster, ring: Array<[number, number]>): LocalNeighborRaster {
  const values = new Float32Array(raster.values)
  const [west, south, east, north] = raster.bounds
  const pixelWidth = (east - west) / raster.width
  const pixelHeight = (north - south) / raster.height
  for (let row = 0; row < raster.height; row++) {
    const latitude = north - (row + 0.5) * pixelHeight
    for (let column = 0; column < raster.width; column++) {
      const longitude = west + (column + 0.5) * pixelWidth
      if (!pointInPolygon(longitude, latitude, ring)) {
        values[row * raster.width + column] = raster.nodata
      }
    }
  }
  return { ...raster, id: `${raster.id}-masked`, values }
}

const RISK_PALETTE = [
  { position: 0, color: [24, 78, 159] },
  { position: 0.35, color: [34, 139, 94] },
  { position: 0.65, color: [255, 234, 0] },
  { position: 0.82, color: [255, 109, 0] },
  { position: 1, color: [213, 0, 0] }
] as const

function riskColor(value: number) {
  const position = Math.max(0, Math.min(1, value / 100))
  const upperIndex = RISK_PALETTE.findIndex((stop) => stop.position >= position)
  if (upperIndex <= 0) {
    return [...RISK_PALETTE[0].color]
  }
  const upper = RISK_PALETTE[upperIndex]
  const lower = RISK_PALETTE[upperIndex - 1]
  const ratio = (position - lower.position) / (upper.position - lower.position)
  return lower.color.map((channel, index) => Math.round(channel + (upper.color[index] - channel) * ratio))
}

export function rasterToRgba(raster: LocalNeighborRaster): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(raster.values.length * 4)
  raster.values.forEach((value, index) => {
    if (value === raster.nodata || !Number.isFinite(value)) {
      return
    }
    const color = riskColor(value)
    rgba[index * 4] = color[0]
    rgba[index * 4 + 1] = color[1]
    rgba[index * 4 + 2] = color[2]
    rgba[index * 4 + 3] = 220
  })
  return rgba
}

export function rasterToCanvas(raster: LocalNeighborRaster): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = raster.width
  canvas.height = raster.height
  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("当前浏览器不支持栅格画布渲染")
  }
  context.putImageData(new ImageData(rasterToRgba(raster), raster.width, raster.height), 0, 0)
  return canvas
}

export function analyzeLocalRaster(
  raster: LocalNeighborRaster,
  options: {
    mode: "area" | "focal"
    ring: Array<[number, number]>
    noDataMode: NoDataMode
    statistic?: FocalStatistic
    windowShape?: FocalWindowShape
    windowSize?: number
    previewResolution?: "low" | "medium"
  }
): { summary: Record<string, any>; previewRaster: LocalNeighborRaster | null } {
  const baseSummary = {
    analysisMode: options.mode,
    rasterSourceId: raster.id,
    band: "1"
  }
  if (options.mode === "area") {
    return {
      summary: { ...baseSummary, ...summarizeRasterInPolygon(raster, options.ring, options.noDataMode) },
      previewRaster: null
    }
  }

  const statistic = options.statistic ?? "mean"
  const windowShape = options.windowShape ?? "square"
  const windowSize = normalizeWindowSize(options.windowSize ?? 3)
  const previewResolution = options.previewResolution === "medium" ? "medium" : "low"
  const previewSource = resampleRaster(raster, previewResolution === "medium" ? 256 : 128)
  const focalRaster = computeFocalRaster(previewSource, { statistic, windowShape, windowSize, noDataMode: options.noDataMode })
  const previewRaster = maskRasterToPolygon(focalRaster, options.ring)

  return {
    previewRaster,
    summary: {
      ...baseSummary,
      ...summarizeRasterInPolygon(previewRaster, options.ring, options.noDataMode),
      statistic,
      windowShape,
      windowSize,
      previewResolution
    }
  }
}
