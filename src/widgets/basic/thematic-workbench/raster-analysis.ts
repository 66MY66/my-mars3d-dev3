export type RasterOperation = "algebra" | "classified" | "threshold" | "mosaic"
export type RasterAlgebraMode = "normalize" | "invert" | "log" | "gamma"
export type RasterClassMethod = "equal" | "quantile"

export type RasterAnalysisOptions = {
  operation: RasterOperation
  algebraMode?: RasterAlgebraMode
  gamma?: number
  classCount?: number
  classMethod?: RasterClassMethod
  thresholdMin?: number
  thresholdMax?: number
  mosaicSize?: number
  opacity?: number
}

export type RasterAnalysisSummary = {
  operation: RasterOperation
  pixelCount: number
  validPixelCount: number
  validRatio: number
  minimum: number
  maximum: number
  mean: number
  breaks: number[]
}

export type RasterAnalysisResult = {
  pixels: Uint8ClampedArray
  summary: RasterAnalysisSummary
}

const CLASS_PALETTE = [
  [24, 59, 99],
  [31, 120, 180],
  [78, 178, 151],
  [244, 207, 87],
  [230, 92, 70],
  [145, 34, 57],
  [87, 21, 46]
]

export function rasterResultLegend(summary: RasterAnalysisSummary) {
  if (summary.operation !== "classified" || !summary.validPixelCount) { return [] }
  const edges = [summary.minimum, ...summary.breaks, summary.maximum]
  return edges.slice(0, -1).map((low, index) => ({
    label: `${index === 0 ? "[" : "("}${low.toFixed(1)}, ${edges[index + 1].toFixed(1)}]`,
    color: `#${CLASS_PALETTE[Math.min(index, CLASS_PALETTE.length - 1)].map(value => value.toString(16).padStart(2, "0")).join("")}`
  }))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function luminance(red: number, green: number, blue: number) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function getLuminanceValues(source: Uint8ClampedArray) {
  const values: number[] = []
  for (let offset = 0; offset < source.length; offset += 4) {
    if (source[offset + 3] < 16) {
      continue
    }
    values.push(luminance(source[offset], source[offset + 1], source[offset + 2]))
  }
  return values
}

function getValueStats(values: number[]) {
  let minimum = 255
  let maximum = 0
  let sum = 0
  values.forEach((value) => {
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
    sum += value
  })
  return {
    minimum: values.length ? minimum : 0,
    maximum: values.length ? maximum : 0,
    mean: values.length ? sum / values.length : 0
  }
}

function getBreaks(values: number[], count: number, method: RasterClassMethod) {
  if (values.length === 0) {
    return []
  }
  const sorted = [...values].sort((a, b) => a - b)
  const minimum = sorted[0]
  const maximum = sorted[sorted.length - 1]
  const breaks: number[] = []
  for (let index = 1; index < count; index++) {
    if (method === "quantile") {
      const position = Math.min(sorted.length - 1, Math.floor((sorted.length * index) / count))
      breaks.push(sorted[position])
    } else {
      breaks.push(minimum + ((maximum - minimum) * index) / count)
    }
  }
  return breaks
}

function getClassIndex(value: number, breaks: number[]) {
  const index = breaks.findIndex((breakValue) => value <= breakValue)
  return index === -1 ? breaks.length : index
}

function applyAlgebra(source: Uint8ClampedArray, output: Uint8ClampedArray, values: number[], options: RasterAnalysisOptions) {
  const mode = options.algebraMode || "normalize"
  const { minimum, maximum } = getValueStats(values)
  const range = Math.max(1, maximum - minimum)
  const gamma = clamp(Number(options.gamma) || 1, 0.2, 3)
  for (let offset = 0; offset < source.length; offset += 4) {
    const alpha = source[offset + 3]
    if (alpha < 16) {
      output[offset + 3] = 0
      continue
    }
    for (let channel = 0; channel < 3; channel++) {
      const raw = source[offset + channel]
      let next = raw
      if (mode === "normalize") {
        next = ((raw - minimum) / range) * 255
      } else if (mode === "invert") {
        next = 255 - raw
      } else if (mode === "log") {
        next = (Math.log1p(raw) / Math.log(256)) * 255
      } else if (mode === "gamma") {
        next = Math.pow(raw / 255, 1 / gamma) * 255
      }
      output[offset + channel] = clamp(Math.round(next), 0, 255)
    }
    output[offset + 3] = alpha
  }
}

function applyClassified(source: Uint8ClampedArray, output: Uint8ClampedArray, values: number[], options: RasterAnalysisOptions) {
  const classCount = clamp(Math.round(Number(options.classCount) || 5), 3, 7)
  const breaks = getBreaks(values, classCount, options.classMethod || "quantile")
  const opacity = clamp(Number(options.opacity) || 86, 10, 100) / 100
  for (let offset = 0; offset < source.length; offset += 4) {
    if (source[offset + 3] < 16) {
      output[offset + 3] = 0
      continue
    }
    const value = luminance(source[offset], source[offset + 1], source[offset + 2])
    const color = CLASS_PALETTE[getClassIndex(value, breaks)] || CLASS_PALETTE[CLASS_PALETTE.length - 1]
    output[offset] = color[0]
    output[offset + 1] = color[1]
    output[offset + 2] = color[2]
    output[offset + 3] = Math.round(255 * opacity)
  }
  return breaks
}

function applyThreshold(source: Uint8ClampedArray, output: Uint8ClampedArray, options: RasterAnalysisOptions) {
  const minimum = clamp(Number(options.thresholdMin) || 0, 0, 100) * 2.55
  const maximum = clamp(Number(options.thresholdMax) || 100, 0, 100) * 2.55
  const low = Math.min(minimum, maximum)
  const high = Math.max(minimum, maximum)
  const span = Math.max(1, high - low)
  const opacity = clamp(Number(options.opacity) || 88, 10, 100) / 100
  let validPixelCount = 0
  for (let offset = 0; offset < source.length; offset += 4) {
    const value = luminance(source[offset], source[offset + 1], source[offset + 2])
    if (source[offset + 3] < 16 || value < low || value > high) {
      output[offset + 3] = 0
      continue
    }
    const ratio = clamp((value - low) / span, 0, 1)
    output[offset] = Math.round(34 + ratio * 210)
    output[offset + 1] = Math.round(186 - ratio * 108)
    output[offset + 2] = Math.round(214 - ratio * 164)
    output[offset + 3] = Math.round(255 * opacity)
    validPixelCount += 1
  }
  return validPixelCount
}

function applyMosaic(source: Uint8ClampedArray, output: Uint8ClampedArray, width: number, height: number, options: RasterAnalysisOptions) {
  const blockSize = clamp(Math.round(Number(options.mosaicSize) || 8), 2, 32)
  const opacity = clamp(Number(options.opacity) || 90, 10, 100) / 100
  for (let top = 0; top < height; top += blockSize) {
    for (let left = 0; left < width; left += blockSize) {
      let red = 0
      let green = 0
      let blue = 0
      let alpha = 0
      let count = 0
      const bottom = Math.min(height, top + blockSize)
      const right = Math.min(width, left + blockSize)
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const offset = (y * width + x) * 4
          if (source[offset + 3] < 16) {
            continue
          }
          red += source[offset]
          green += source[offset + 1]
          blue += source[offset + 2]
          alpha += source[offset + 3]
          count += 1
        }
      }
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const offset = (y * width + x) * 4
          if (count === 0) {
            output[offset + 3] = 0
            continue
          }
          output[offset] = Math.round(red / count)
          output[offset + 1] = Math.round(green / count)
          output[offset + 2] = Math.round(blue / count)
          output[offset + 3] = Math.round((alpha / count) * opacity)
        }
      }
    }
  }
}

export function processRasterPixels(source: Uint8ClampedArray, width: number, height: number, options: RasterAnalysisOptions): RasterAnalysisResult {
  if (source.length !== width * height * 4) {
    throw new Error("Raster pixel buffer size does not match its dimensions")
  }
  const values = getLuminanceValues(source)
  const output = new Uint8ClampedArray(source.length)
  const { minimum, maximum, mean } = getValueStats(values)
  let breaks: number[] = []
  let validPixelCount = values.length

  if (options.operation === "algebra") {
    applyAlgebra(source, output, values, options)
  } else if (options.operation === "classified") {
    breaks = applyClassified(source, output, values, options)
  } else if (options.operation === "threshold") {
    validPixelCount = applyThreshold(source, output, options)
  } else {
    applyMosaic(source, output, width, height, options)
  }

  return {
    pixels: output,
    summary: {
      operation: options.operation,
      pixelCount: width * height,
      validPixelCount,
      validRatio: width * height ? validPixelCount / (width * height) : 0,
      minimum: Number((minimum / 2.55).toFixed(1)),
      maximum: Number((maximum / 2.55).toFixed(1)),
      mean: Number((mean / 2.55).toFixed(1)),
      breaks: breaks.map((value) => Number((value / 2.55).toFixed(1)))
    }
  }
}
