export type TemporalOperation = "difference" | "statistics" | "trend" | "anomaly"
export type TemporalDifferenceMode = "delta" | "rate"
export type TemporalStatisticMode = "mean" | "variance"

export type TemporalFrameInput = {
  pixels: Uint8ClampedArray
  width: number
  height: number
  label: string
  timestamp: string
}

export type TemporalAnalysisOptions = {
  operation: TemporalOperation
  differenceMode?: TemporalDifferenceMode
  statisticMode?: TemporalStatisticMode
  minimumR2?: number
  anomalyThreshold?: number
  opacity?: number
}

export type TemporalAnalysisSummary = {
  operation: TemporalOperation
  frameCount: number
  pixelCount: number
  validPixelCount: number
  changedRatio: number
  anomalyRatio: number
  meanDelta: number
  meanVariance: number
  meanSlope: number
  meanR2: number
  minimum: number
  maximum: number
  frameMeans: number[]
}

export type TemporalAnalysisResult = {
  pixels: Uint8ClampedArray
  summary: TemporalAnalysisSummary
}

type PixelMetric = {
  valid: boolean
  first: number
  last: number
  mean: number
  variance: number
  slope: number
  r2: number
  anomaly: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function getLuminance(pixels: Uint8ClampedArray, offset: number) {
  return (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) / 2.55
}

function interpolateColor(start: number[], end: number[], ratio: number) {
  const t = clamp(ratio, 0, 1)
  return start.map((value, index) => Math.round(value + (end[index] - value) * t))
}

function divergingColor(value: number, scale: number) {
  const ratio = clamp(Math.abs(value) / Math.max(scale, 0.001), 0, 1)
  if (value < 0) {
    return interpolateColor([214, 230, 242], [32, 93, 166], ratio)
  }
  return interpolateColor([247, 227, 205], [190, 45, 52], ratio)
}

function sequentialColor(value: number, maximum: number) {
  const ratio = clamp(value / Math.max(maximum, 0.001), 0, 1)
  if (ratio < 0.5) {
    return interpolateColor([18, 60, 92], [39, 181, 174], ratio * 2)
  }
  return interpolateColor([39, 181, 174], [244, 191, 69], (ratio - 0.5) * 2)
}

function getPixelMetric(frames: TemporalFrameInput[], offset: number): PixelMetric {
  const values = frames.map((frame) => getLuminance(frame.pixels, offset))
  const valid = frames.every((frame) => frame.pixels[offset + 3] >= 16)
  if (!valid) {
    return { valid: false, first: 0, last: 0, mean: 0, variance: 0, slope: 0, r2: 0, anomaly: 0 }
  }

  const count = values.length
  const mean = values.reduce((sum, value) => sum + value, 0) / count
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / count
  const xMean = (count - 1) / 2
  let covariance = 0
  let xVariance = 0
  let totalVariance = 0
  values.forEach((value, index) => {
    covariance += (index - xMean) * (value - mean)
    xVariance += Math.pow(index - xMean, 2)
    totalVariance += Math.pow(value - mean, 2)
  })
  const slope = xVariance > 0 ? covariance / xVariance : 0
  const fittedMean = values.reduce((sum, _value, index) => sum + (mean + slope * (index - xMean)), 0) / count
  let residualVariance = 0
  values.forEach((value, index) => {
    const fitted = fittedMean + slope * (index - xMean)
    residualVariance += Math.pow(value - fitted, 2)
  })
  const r2 = totalVariance > 0.0001 ? clamp(1 - residualVariance / totalVariance, 0, 1) : 0
  const background = values.slice(0, -1)
  const backgroundMean = background.reduce((sum, value) => sum + value, 0) / Math.max(1, background.length)
  const backgroundVariance = background.reduce((sum, value) => sum + Math.pow(value - backgroundMean, 2), 0) / Math.max(1, background.length)
  const anomaly = (values[count - 1] - backgroundMean) / Math.max(2, Math.sqrt(backgroundVariance))

  return {
    valid: true,
    first: values[0],
    last: values[count - 1],
    mean,
    variance,
    slope,
    r2,
    anomaly
  }
}

function validateFrames(frames: TemporalFrameInput[]) {
  if (frames.length < 2) {
    throw new Error("Temporal analysis requires at least two frames")
  }
  const width = frames[0].width
  const height = frames[0].height
  const expectedSize = width * height * 4
  if (
    width <= 0 ||
    height <= 0 ||
    frames.some((frame) => frame.width !== width || frame.height !== height || frame.pixels.length !== expectedSize)
  ) {
    throw new Error("Temporal frames must share the same dimensions")
  }
  return { width, height, expectedSize }
}

export function processTemporalFrames(frames: TemporalFrameInput[], options: TemporalAnalysisOptions): TemporalAnalysisResult {
  const { width, height, expectedSize } = validateFrames(frames)
  const output = new Uint8ClampedArray(expectedSize)
  const metrics: PixelMetric[] = []
  const opacity = clamp(Number(options.opacity) || 88, 10, 100) / 100
  const anomalyThreshold = clamp(Number(options.anomalyThreshold) || 2, 0.5, 4)
  const minimumR2 = clamp(Number(options.minimumR2) || 0.35, 0, 1)
  const frameSums = Array(frames.length).fill(0)
  const frameCounts = Array(frames.length).fill(0)
  let validPixelCount = 0
  let deltaSum = 0
  let varianceSum = 0
  let slopeSum = 0
  let r2Sum = 0
  let changedCount = 0
  let anomalyCount = 0
  let maxVariance = 0
  let maxAbsDelta = 0
  let maxAbsSlope = 0
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY

  for (let offset = 0; offset < expectedSize; offset += 4) {
    const metric = getPixelMetric(frames, offset)
    metrics.push(metric)
    if (!metric.valid) {
      continue
    }
    validPixelCount += 1
    const delta = metric.last - metric.first
    deltaSum += delta
    varianceSum += metric.variance
    slopeSum += metric.slope
    r2Sum += metric.r2
    maxVariance = Math.max(maxVariance, metric.variance)
    maxAbsDelta = Math.max(maxAbsDelta, Math.abs(delta))
    maxAbsSlope = Math.max(maxAbsSlope, Math.abs(metric.slope))
    minimum = Math.min(minimum, metric.first, metric.last, metric.mean)
    maximum = Math.max(maximum, metric.first, metric.last, metric.mean)
    if (Math.abs(delta) >= 5) {
      changedCount += 1
    }
    if (Math.abs(metric.anomaly) >= anomalyThreshold) {
      anomalyCount += 1
    }
    frames.forEach((frame, frameIndex) => {
      frameSums[frameIndex] += getLuminance(frame.pixels, offset)
      frameCounts[frameIndex] += 1
    })
  }

  metrics.forEach((metric, index) => {
    const offset = index * 4
    if (!metric.valid) {
      output[offset + 3] = 0
      return
    }

    let color = [255, 255, 255]
    let alpha = opacity
    if (options.operation === "difference") {
      const rawDelta = metric.last - metric.first
      const value = options.differenceMode === "rate" ? rawDelta / Math.max(1, metric.first) * 100 : rawDelta
      color = divergingColor(value, options.differenceMode === "rate" ? 50 : Math.max(8, maxAbsDelta))
      alpha *= Math.abs(value) < 1 ? 0.18 : 1
    } else if (options.operation === "statistics") {
      const value = options.statisticMode === "mean" ? metric.mean : metric.variance
      color = sequentialColor(value, options.statisticMode === "mean" ? 100 : maxVariance)
    } else if (options.operation === "trend") {
      color = divergingColor(metric.slope, Math.max(1, maxAbsSlope))
      alpha *= metric.r2 >= minimumR2 ? 1 : 0.16
    } else {
      color = metric.anomaly < 0
        ? interpolateColor([105, 157, 196], [52, 40, 138], Math.abs(metric.anomaly) / 4)
        : interpolateColor([248, 183, 116], [181, 23, 71], Math.abs(metric.anomaly) / 4)
      alpha *= Math.abs(metric.anomaly) >= anomalyThreshold ? 1 : 0
    }
    output[offset] = color[0]
    output[offset + 1] = color[1]
    output[offset + 2] = color[2]
    output[offset + 3] = Math.round(255 * alpha)
  })

  const safeCount = Math.max(1, validPixelCount)
  return {
    pixels: output,
    summary: {
      operation: options.operation,
      frameCount: frames.length,
      pixelCount: width * height,
      validPixelCount,
      changedRatio: changedCount / safeCount,
      anomalyRatio: anomalyCount / safeCount,
      meanDelta: Number((deltaSum / safeCount).toFixed(2)),
      meanVariance: Number((varianceSum / safeCount).toFixed(2)),
      meanSlope: Number((slopeSum / safeCount).toFixed(2)),
      meanR2: Number((r2Sum / safeCount).toFixed(2)),
      minimum: Number((Number.isFinite(minimum) ? minimum : 0).toFixed(1)),
      maximum: Number((Number.isFinite(maximum) ? maximum : 0).toFixed(1)),
      frameMeans: frameSums.map((sum, index) => Number((sum / Math.max(1, frameCounts[index])).toFixed(1)))
    }
  }
}
