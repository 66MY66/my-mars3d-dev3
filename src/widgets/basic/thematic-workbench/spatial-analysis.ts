export type SpatialOperation = "contour" | "buffer" | "overlay" | "neighborhood"
export type SpatialOverlayMode = "intersect" | "union" | "difference"
export type SpatialNeighborhoodMetric = "mean" | "variation"

export type SpatialOptions = {
  operation: SpatialOperation
  threshold?: number
  radius?: number
  overlayMode?: SpatialOverlayMode
  neighborhoodMetric?: SpatialNeighborhoodMetric
}

export type SpatialSummary = {
  validPixelCount: number
  selectedPixelCount: number
  coverage: number
  contourSegments: number
  contourLength: number
  mean: number
  maximum: number
  rows: Array<{ label: string; value: number; color: string }>
}

export type SpatialResult = { pixels: Uint8ClampedArray; summary: SpatialSummary }

const COLORS = { contour: "#73e1d2", source: "#549bbf", buffer: "#e6bb70", overlap: "#e77965", neighborhood: "#82bbac" }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function luminance(pixels: Uint8ClampedArray, offset: number) {
  return pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722
}

function paint(output: Uint8ClampedArray, index: number, color: string, alpha = 210) {
  const offset = index * 4
  output[offset] = parseInt(color.slice(1, 3), 16)
  output[offset + 1] = parseInt(color.slice(3, 5), 16)
  output[offset + 2] = parseInt(color.slice(5, 7), 16)
  output[offset + 3] = alpha
}

function line(output: Uint8ClampedArray, width: number, height: number, x0: number, y0: number, x1: number, y1: number) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2))
  for (let step = 0; step <= steps; step++) {
    const x = Math.round(x0 + ((x1 - x0) * step) / steps)
    const y = Math.round(y0 + ((y1 - y0) * step) / steps)
    if (x >= 0 && x < width && y >= 0 && y < height) {
      paint(output, y * width + x, COLORS.contour, 255)
    }
  }
}

function contour(values: Float64Array, valid: Uint8Array, width: number, height: number, threshold: number) {
  const output = new Uint8ClampedArray(valid.length * 4)
  let segments = 0
  let length = 0
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const indices = [y * width + x, y * width + x + 1, (y + 1) * width + x + 1, (y + 1) * width + x]
      if (indices.some((index) => !valid[index])) {
        continue
      }
      const corners = indices.map((index) => values[index])
      const edges: Array<[number, number]> = []
      for (let edge = 0; edge < 4; edge++) {
        const next = (edge + 1) % 4
        const currentAbove = corners[edge] >= threshold
        const nextAbove = corners[next] >= threshold
        if (currentAbove === nextAbove) {
          continue
        }
        const fraction = clamp((threshold - corners[edge]) / (corners[next] - corners[edge]), 0, 1)
        const points = [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1]
        ]
        edges.push([
          points[edge][0] + (points[next][0] - points[edge][0]) * fraction,
          points[edge][1] + (points[next][1] - points[edge][1]) * fraction
        ])
      }
      for (let edge = 0; edge + 1 < edges.length; edge += 2) {
        const [start, end] = [edges[edge], edges[edge + 1]]
        line(output, width, height, start[0], start[1], end[0], end[1])
        segments++
        length += Math.hypot(end[0] - start[0], end[1] - start[1])
      }
    }
  }
  return { output, segments, length }
}

function distanceFromMask(mask: Uint8Array, valid: Uint8Array, width: number, height: number) {
  const distance = new Float32Array(mask.length)
  distance.fill(Infinity)
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] && valid[i]) {
      distance[i] = 0
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      if (!valid[index]) {
        continue
      }
      if (x) {
        distance[index] = Math.min(distance[index], distance[index - 1] + 1)
      }
      if (y) {
        distance[index] = Math.min(distance[index], distance[index - width] + 1)
      }
      if (x && y) {
        distance[index] = Math.min(distance[index], distance[index - width - 1] + Math.SQRT2)
      }
      if (x < width - 1 && y) {
        distance[index] = Math.min(distance[index], distance[index - width + 1] + Math.SQRT2)
      }
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const index = y * width + x
      if (!valid[index]) {
        continue
      }
      if (x < width - 1) {
        distance[index] = Math.min(distance[index], distance[index + 1] + 1)
      }
      if (y < height - 1) {
        distance[index] = Math.min(distance[index], distance[index + width] + 1)
      }
      if (x < width - 1 && y < height - 1) {
        distance[index] = Math.min(distance[index], distance[index + width + 1] + Math.SQRT2)
      }
      if (x && y < height - 1) {
        distance[index] = Math.min(distance[index], distance[index + width - 1] + Math.SQRT2)
      }
    }
  }
  return distance
}

function buffer(values: Float64Array, valid: Uint8Array, width: number, height: number, threshold: number, radius: number) {
  const output = new Uint8ClampedArray(valid.length * 4)
  const source = Uint8Array.from(values, (value, index) => (valid[index] && value >= threshold ? 1 : 0))
  const distance = distanceFromMask(source, valid, width, height)
  let sourceCount = 0
  let bufferCount = 0
  for (let index = 0; index < valid.length; index++) {
    if (!valid[index]) {
      continue
    }
    if (source[index]) {
      paint(output, index, COLORS.source, 205)
      sourceCount++
    } else if (distance[index] <= radius) {
      paint(output, index, COLORS.buffer, 174)
      bufferCount++
    }
  }
  return { output, sourceCount, bufferCount }
}

function overlay(pixels: Uint8ClampedArray, values: Float64Array, valid: Uint8Array, threshold: number, mode: SpatialOverlayMode) {
  const output = new Uint8ClampedArray(valid.length * 4)
  let aCount = 0
  let bCount = 0
  let resultCount = 0
  for (let index = 0; index < valid.length; index++) {
    if (!valid[index]) {
      continue
    }
    const offset = index * 4
    const bright = values[index] >= threshold
    const green = pixels[offset + 1] > pixels[offset] * 1.12 && pixels[offset + 1] > pixels[offset + 2] * 1.04
    if (bright) {
      aCount++
    }
    if (green) {
      bCount++
    }
    let selected = bright && green
    if (mode === "union") {
      selected = bright || green
    }
    if (mode === "difference") {
      selected = bright && !green
    }
    if (selected) {
      paint(output, index, COLORS.overlap, 196)
      resultCount++
    }
  }
  return { output, aCount, bCount, resultCount }
}

function neighborhood(values: Float64Array, valid: Uint8Array, width: number, height: number, radius: number, metric: SpatialNeighborhoodMetric) {
  const output = new Uint8ClampedArray(valid.length * 4)
  const response = new Float64Array(valid.length)
  const stride = width + 1
  const sums = new Float64Array(stride * (height + 1))
  const squares = new Float64Array(stride * (height + 1))
  const counts = new Uint32Array(stride * (height + 1))
  for (let y = 1; y <= height; y++) {
    let rowSum = 0
    let rowSquare = 0
    let rowCount = 0
    for (let x = 1; x <= width; x++) {
      const index = (y - 1) * width + x - 1
      if (valid[index]) {
        rowSum += values[index]
        rowSquare += values[index] ** 2
        rowCount++
      }
      const target = y * stride + x
      sums[target] = sums[target - stride] + rowSum
      squares[target] = squares[target - stride] + rowSquare
      counts[target] = counts[target - stride] + rowCount
    }
  }
  const rectSum = (array: Float64Array | Uint32Array, x0: number, y0: number, x1: number, y1: number) =>
    array[y1 * stride + x1] - array[y0 * stride + x1] - array[y1 * stride + x0] + array[y0 * stride + x0]
  let total = 0
  let maximum = 0
  let minimum = Infinity
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
      const count = rectSum(counts, x0, y0, x1, y1)
      const mean = count ? rectSum(sums, x0, y0, x1, y1) / count : 0
      const value = metric === "mean" ? mean : Math.sqrt(Math.max(0, rectSum(squares, x0, y0, x1, y1) / count - mean ** 2))
      response[index] = value
      total += value
      maximum = Math.max(maximum, value)
      minimum = Math.min(minimum, value)
      validCount++
    }
  }
  const globalMean = total / validCount
  let squaredDeviation = 0
  for (let index = 0; index < response.length; index++) {
    if (valid[index]) {
      squaredDeviation += (response[index] - globalMean) ** 2
    }
  }
  const highThreshold = globalMean + Math.sqrt(squaredDeviation / validCount)
  let selected = 0
  for (let index = 0; index < response.length; index++) {
    if (!valid[index]) {
      continue
    }
    const ratio = clamp((response[index] - minimum) / Math.max(1, maximum - minimum), 0, 1)
    const isHigh = response[index] >= highThreshold && maximum > minimum
    if (isHigh) {
      selected++
    }
    paint(output, index, isHigh ? COLORS.overlap : COLORS.neighborhood, Math.round(45 + ratio * 190))
  }
  return { output, mean: globalMean, maximum, selected }
}

export function processSpatialPixels(pixels: Uint8ClampedArray, width: number, height: number, options: SpatialOptions): SpatialResult {
  if (width < 3 || height < 3 || pixels.length !== width * height * 4) {
    throw new Error("Invalid spatial image dimensions")
  }
  const valid = new Uint8Array(width * height)
  const values = new Float64Array(valid.length)
  let validPixelCount = 0
  for (let index = 0; index < valid.length; index++) {
    if (pixels[index * 4 + 3] < 16) {
      continue
    }
    valid[index] = 1
    values[index] = luminance(pixels, index * 4)
    validPixelCount++
  }
  if (!validPixelCount) {
    throw new Error("The selection contains no valid pixels")
  }
  const threshold = clamp(options.threshold ?? 140, 0, 255)
  const radius = clamp(Math.round(options.radius ?? 10), 2, 30)
  const summary: SpatialSummary = {
    validPixelCount,
    selectedPixelCount: 0,
    coverage: 0,
    contourSegments: 0,
    contourLength: 0,
    mean: 0,
    maximum: 0,
    rows: []
  }
  let output: Uint8ClampedArray
  if (options.operation === "contour") {
    const result = contour(values, valid, width, height, threshold)
    output = result.output
    summary.contourSegments = result.segments
    summary.contourLength = Number(result.length.toFixed(1))
    summary.rows = [{ label: "等值线", value: result.segments, color: COLORS.contour }]
  } else if (options.operation === "buffer") {
    const result = buffer(values, valid, width, height, threshold, radius)
    output = result.output
    summary.selectedPixelCount = result.sourceCount + result.bufferCount
    summary.coverage = Number(((summary.selectedPixelCount / validPixelCount) * 100).toFixed(1))
    summary.rows = [
      { label: "源区", value: result.sourceCount, color: COLORS.source },
      { label: "缓冲带", value: result.bufferCount, color: COLORS.buffer }
    ]
  } else if (options.operation === "overlay") {
    const result = overlay(pixels, values, valid, threshold, options.overlayMode ?? "union")
    output = result.output
    summary.selectedPixelCount = result.resultCount
    summary.coverage = Number(((result.resultCount / validPixelCount) * 100).toFixed(1))
    summary.rows = [
      { label: "亮区 A", value: result.aCount, color: COLORS.source },
      { label: "绿区 B", value: result.bCount, color: COLORS.neighborhood },
      { label: "运算结果", value: result.resultCount, color: COLORS.overlap }
    ]
  } else if (options.operation === "neighborhood") {
    const result = neighborhood(values, valid, width, height, radius, options.neighborhoodMetric ?? "mean")
    output = result.output
    summary.mean = Number(result.mean.toFixed(1))
    summary.maximum = Number(result.maximum.toFixed(1))
    summary.selectedPixelCount = result.selected
    summary.coverage = Number(((result.selected / validPixelCount) * 100).toFixed(1))
    summary.rows = [
      { label: "高响应", value: result.selected, color: COLORS.overlap },
      { label: "其余像元", value: validPixelCount - result.selected, color: COLORS.neighborhood }
    ]
  } else {
    throw new Error("Unknown spatial operation")
  }
  return { pixels: output, summary }
}
