export type StatisticsOperation = "area" | "category" | "autocorrelation" | "density"
export type StatisticsClassMethod = "equal" | "quantile"

export type StatisticsOptions = {
  operation: StatisticsOperation
  columns?: number
  rows?: number
  classCount?: number
  classMethod?: StatisticsClassMethod
  brightnessThreshold?: number
  densityRadius?: number
}

export type StatisticsRow = {
  label: string
  value: number
  color: string
}

export type StatisticsSummary = {
  validPixelCount: number
  mean: number
  standardDeviation: number
  minimum: number
  maximum: number
  moranI: number
  highHighCount: number
  lowLowCount: number
  meanDensity: number
  hotspotShare: number
  rows: StatisticsRow[]
}

export type StatisticsResult = {
  pixels: Uint8ClampedArray
  summary: StatisticsSummary
}

const SEQUENTIAL = ["#285a83", "#338ca4", "#65b6a9", "#d5bd69", "#d97954", "#ad4451", "#772e55"]
const CLUSTERS = ["#e57a65", "#4f9ec3", "#d6bb75", "#9d82b5"]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function brightness(pixels: Uint8ClampedArray, offset: number) {
  return pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722
}

function hexRgb(color: string) {
  return [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16))
}

function paint(output: Uint8ClampedArray, index: number, color: string, alpha = 188) {
  const rgb = hexRgb(color)
  const offset = index * 4
  output[offset] = rgb[0]
  output[offset + 1] = rgb[1]
  output[offset + 2] = rgb[2]
  output[offset + 3] = alpha
}

function gridIndex(x: number, y: number, width: number, height: number, columns: number, rows: number) {
  const column = Math.min(columns - 1, Math.floor((x * columns) / width))
  const row = Math.min(rows - 1, Math.floor((y * rows) / height))
  return row * columns + column
}

function aggregateGrid(values: Float64Array, valid: Uint8Array, width: number, height: number, columns: number, rows: number) {
  const sums = new Float64Array(columns * rows)
  const counts = new Uint32Array(columns * rows)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      if (!valid[index]) {
        continue
      }
      const cell = gridIndex(x, y, width, height, columns, rows)
      sums[cell] += values[index]
      counts[cell]++
    }
  }
  const means = sums.map((sum, index) => (counts[index] ? sum / counts[index] : 0))
  return { means, counts }
}

function area(values: Float64Array, valid: Uint8Array, width: number, height: number, columns: number, rows: number) {
  const output = new Uint8ClampedArray(valid.length * 4)
  const { means, counts } = aggregateGrid(values, valid, width, height, columns, rows)
  const chartRows: StatisticsRow[] = Array.from(means, (mean, index) => ({
    label: `R${Math.floor(index / columns) + 1} · C${(index % columns) + 1}`,
    value: Number(mean.toFixed(1)),
    color: SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.floor((mean / 256) * SEQUENTIAL.length))]
  })).filter((_, index) => counts[index] > 0)
  const colors = Array.from(means, (mean) => SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.floor((mean / 256) * SEQUENTIAL.length))])
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      if (!valid[index]) {
        continue
      }
      const cell = gridIndex(x, y, width, height, columns, rows)
      paint(output, index, colors[cell])
    }
  }
  return { output, rows: chartRows }
}

function category(values: Float64Array, valid: Uint8Array, count: number, method: StatisticsClassMethod) {
  const output = new Uint8ClampedArray(valid.length * 4)
  const samples = Array.from(values)
    .filter((_, index) => valid[index])
    .sort((a, b) => a - b)
  const minimum = samples[0]
  const maximum = samples[samples.length - 1]
  const thresholds = Array.from({ length: count - 1 }, (_, index) =>
    method === "quantile"
      ? samples[Math.min(samples.length - 1, Math.ceil(((index + 1) * samples.length) / count) - 1)]
      : minimum + ((maximum - minimum) * (index + 1)) / count
  )
  const counts = new Uint32Array(count)
  const colors = Array.from({ length: count }, (_, index) => SEQUENTIAL[Math.round((index * (SEQUENTIAL.length - 1)) / Math.max(1, count - 1))])
  for (let index = 0; index < values.length; index++) {
    if (!valid[index]) {
      continue
    }
    let classIndex = 0
    while (classIndex < thresholds.length && values[index] > thresholds[classIndex]) {
      classIndex++
    }
    counts[classIndex]++
    paint(output, index, colors[classIndex], 174)
  }
  return {
    output,
    rows: Array.from(counts, (value, index) => ({ label: `${index + 1} 级`, value, color: colors[index] }))
  }
}

function autocorrelation(values: Float64Array, valid: Uint8Array, width: number, height: number, columns: number, rows: number) {
  const output = new Uint8ClampedArray(valid.length * 4)
  const { means, counts } = aggregateGrid(values, valid, width, height, columns, rows)
  const active = Array.from(means.keys()).filter((index) => counts[index] > 0)
  const mean = active.reduce((sum, index) => sum + means[index], 0) / active.length
  const deviations = means.map((value) => value - mean)
  const denominator = active.reduce((sum, index) => sum + deviations[index] ** 2, 0)
  const classes = new Int8Array(means.length).fill(-1)
  const classCounts = new Uint32Array(4)
  let numerator = 0
  let weights = 0
  for (const index of active) {
    const x = index % columns
    const y = Math.floor(index / columns)
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x < columns - 1 ? index + 1 : -1,
      y > 0 ? index - columns : -1,
      y < rows - 1 ? index + columns : -1
    ].filter((neighbor) => neighbor >= 0 && counts[neighbor] > 0)
    if (!neighbors.length || denominator === 0) {
      continue
    }
    const lag = neighbors.reduce((sum, neighbor) => sum + deviations[neighbor], 0) / neighbors.length
    numerator += neighbors.reduce((sum, neighbor) => sum + deviations[index] * deviations[neighbor], 0)
    weights += neighbors.length
    let classIndex = 0
    if (deviations[index] >= 0) {
      classIndex = lag >= 0 ? 0 : 2
    } else {
      classIndex = lag < 0 ? 1 : 3
    }
    classes[index] = classIndex
    classCounts[classIndex]++
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      if (!valid[index]) {
        continue
      }
      const cluster = classes[gridIndex(x, y, width, height, columns, rows)]
      if (cluster >= 0) {
        paint(output, index, CLUSTERS[cluster], 180)
      }
    }
  }
  return {
    output,
    moranI: weights && denominator ? ((active.length / weights) * numerator) / denominator : 0,
    highHighCount: classCounts[0],
    lowLowCount: classCounts[1],
    rows: ["高-高", "低-低", "高-低", "低-高"].map((label, index) => ({ label, value: classCounts[index], color: CLUSTERS[index] }))
  }
}

function density(values: Float64Array, valid: Uint8Array, width: number, height: number, threshold: number, radius: number) {
  const output = new Uint8ClampedArray(valid.length * 4)
  const stride = width + 1
  const brightIntegral = new Uint32Array(stride * (height + 1))
  const validIntegral = new Uint32Array(stride * (height + 1))
  for (let y = 1; y <= height; y++) {
    let brightRow = 0
    let validRow = 0
    for (let x = 1; x <= width; x++) {
      const index = (y - 1) * width + x - 1
      validRow += valid[index]
      brightRow += valid[index] && values[index] >= threshold ? 1 : 0
      const integralIndex = y * stride + x
      brightIntegral[integralIndex] = brightIntegral[integralIndex - stride] + brightRow
      validIntegral[integralIndex] = validIntegral[integralIndex - stride] + validRow
    }
  }
  const sumRect = (integral: Uint32Array, x0: number, y0: number, x1: number, y1: number) =>
    integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0]
  const bands = new Uint32Array(5)
  let densitySum = 0
  let hotspots = 0
  let validCount = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      if (!valid[index]) {
        continue
      }
      const x0 = Math.max(0, x - radius)
      const y0 = Math.max(0, y - radius)
      const x1 = Math.min(width, x + radius + 1)
      const y1 = Math.min(height, y + radius + 1)
      const total = sumRect(validIntegral, x0, y0, x1, y1)
      const ratio = total ? sumRect(brightIntegral, x0, y0, x1, y1) / total : 0
      densitySum += ratio
      validCount++
      if (ratio >= 0.6) {
        hotspots++
      }
      const band = Math.min(4, Math.floor(ratio * 5))
      bands[band]++
      paint(output, index, SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.floor(ratio * SEQUENTIAL.length))], Math.round(65 + ratio * 160))
    }
  }
  return {
    output,
    meanDensity: densitySum / validCount,
    hotspotShare: hotspots / validCount,
    rows: Array.from(bands, (value, index) => ({
      label: `${index * 20}–${(index + 1) * 20}%`,
      value,
      color: SEQUENTIAL[Math.round((index * (SEQUENTIAL.length - 1)) / 4)]
    }))
  }
}

export function processStatisticsPixels(pixels: Uint8ClampedArray, width: number, height: number, options: StatisticsOptions): StatisticsResult {
  if (width < 3 || height < 3 || pixels.length !== width * height * 4) {
    throw new Error("Invalid statistics image dimensions")
  }
  const values = new Float64Array(width * height)
  const valid = new Uint8Array(width * height)
  let sum = 0
  let minimum = 255
  let maximum = 0
  let validPixelCount = 0
  for (let index = 0; index < values.length; index++) {
    if (pixels[index * 4 + 3] < 16) {
      continue
    }
    const value = brightness(pixels, index * 4)
    valid[index] = 1
    values[index] = value
    sum += value
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
    validPixelCount++
  }
  if (!validPixelCount) {
    throw new Error("The selection contains no valid pixels")
  }
  const mean = sum / validPixelCount
  let variance = 0
  for (let index = 0; index < values.length; index++) {
    if (valid[index]) {
      variance += (values[index] - mean) ** 2
    }
  }
  const summary: StatisticsSummary = {
    validPixelCount,
    mean: Number(mean.toFixed(1)),
    standardDeviation: Number(Math.sqrt(variance / validPixelCount).toFixed(1)),
    minimum: Number(minimum.toFixed(1)),
    maximum: Number(maximum.toFixed(1)),
    moranI: 0,
    highHighCount: 0,
    lowLowCount: 0,
    meanDensity: 0,
    hotspotShare: 0,
    rows: []
  }
  const columns = clamp(Math.round(options.columns ?? 4), 2, Math.min(width, 32))
  const rows = clamp(Math.round(options.rows ?? 3), 2, Math.min(height, 24))
  let output: Uint8ClampedArray
  if (options.operation === "area") {
    const result = area(values, valid, width, height, columns, rows)
    output = result.output
    summary.rows = result.rows
  } else if (options.operation === "category") {
    const result = category(values, valid, clamp(Math.round(options.classCount ?? 5), 3, 7), options.classMethod ?? "equal")
    output = result.output
    summary.rows = result.rows
  } else if (options.operation === "autocorrelation") {
    const result = autocorrelation(values, valid, width, height, columns, rows)
    output = result.output
    summary.rows = result.rows
    summary.moranI = Number(result.moranI.toFixed(3))
    summary.highHighCount = result.highHighCount
    summary.lowLowCount = result.lowLowCount
  } else if (options.operation === "density") {
    const result = density(
      values,
      valid,
      width,
      height,
      clamp(options.brightnessThreshold ?? 150, 0, 255),
      clamp(Math.round(options.densityRadius ?? 12), 2, 40)
    )
    output = result.output
    summary.rows = result.rows
    summary.meanDensity = Number((result.meanDensity * 100).toFixed(1))
    summary.hotspotShare = Number((result.hotspotShare * 100).toFixed(1))
  } else {
    throw new Error("Unknown statistics operation")
  }
  return { pixels: output, summary }
}
