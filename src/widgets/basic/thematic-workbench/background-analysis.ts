export type BackgroundOperation = "difference" | "ratio" | "normalization" | "denoise"

export type BackgroundOptions = {
  operation: BackgroundOperation
  denoiseWindow?: 3 | 5
  sensitivity?: number
}

export type BackgroundSummary = {
  validPixelCount: number
  baselineMean: number
  baselineDeviation: number
  meanDifference: number
  meanRatio: number
  meanZ: number
  suppressedResidual: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  rows: Array<{ label: string; value: number; color: string }>
}

export type BackgroundResult = { pixels: Uint8ClampedArray; summary: BackgroundSummary }

function luminance(pixels: Uint8ClampedArray, offset: number) {
  return pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722
}

function medianFilter(values: Float64Array, valid: Uint8Array, width: number, height: number, window: 3 | 5) {
  const output = new Float64Array(values.length)
  const radius = Math.floor(window / 2)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      if (!valid[index]) { continue }
      const neighbors: number[] = []
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) { continue }
          const neighbor = ny * width + nx
          if (valid[neighbor]) { neighbors.push(values[neighbor]) }
        }
      }
      neighbors.sort((a, b) => a - b)
      output[index] = neighbors[Math.floor(neighbors.length / 2)]
    }
  }
  return output
}

export function processBackgroundPixels(current: Uint8ClampedArray, baseline: Uint8ClampedArray, width: number, height: number, options: BackgroundOptions): BackgroundResult {
  if (width < 3 || height < 3 || current.length !== width * height * 4 || baseline.length !== current.length) {
    throw new Error("Background images must share valid dimensions")
  }
  const valid = new Uint8Array(width * height)
  const currentValues = new Float64Array(valid.length)
  const baselineValues = new Float64Array(valid.length)
  const differences = new Float64Array(valid.length)
  let count = 0
  let baselineSum = 0
  let differenceSum = 0
  let ratioSum = 0
  let ratioCount = 0
  for (let index = 0; index < valid.length; index++) {
    const offset = index * 4
    if (current[offset + 3] < 16 || baseline[offset + 3] < 16) { continue }
    valid[index] = 1
    const before = luminance(baseline, offset)
    const after = luminance(current, offset)
    baselineValues[index] = before
    currentValues[index] = after
    differences[index] = after - before
    count++
    baselineSum += before
    differenceSum += differences[index]
    if (before >= 5) {
      ratioSum += after / before
      ratioCount++
    }
  }
  if (!count) { throw new Error("Background images have no shared valid pixels") }
  const baselineMean = baselineSum / count
  let baselineVariance = 0
  for (let index = 0; index < valid.length; index++) {
    if (valid[index]) { baselineVariance += (baselineValues[index] - baselineMean) ** 2 }
  }
  const baselineDeviation = Math.sqrt(baselineVariance / count)
  const values = new Float64Array(valid.length)
  let suppressed = 0
  if (options.operation === "denoise") {
    const smoothed = medianFilter(differences, valid, width, height, options.denoiseWindow ?? 3)
    for (let index = 0; index < values.length; index++) {
      if (!valid[index]) { continue }
      values[index] = smoothed[index]
      suppressed += Math.abs(differences[index] - smoothed[index])
    }
  } else {
    for (let index = 0; index < values.length; index++) {
      if (!valid[index]) { continue }
      if (options.operation === "difference") { values[index] = differences[index] } else if (options.operation === "ratio") {
        if (baselineValues[index] < 5) { valid[index] = 0; continue }
        values[index] = Math.log2(Math.max(1e-6, currentValues[index] / baselineValues[index]))
      } else if (options.operation === "normalization") {
        values[index] = differences[index] / Math.max(baselineDeviation, 1)
      } else { throw new Error("Unknown background operation") }
    }
  }
  const absValues = Array.from(values).filter((_, index) => valid[index]).map(Math.abs).sort((a, b) => a - b)
  if (!absValues.length) { throw new Error("Background images have no valid ratio pixels") }
  const scale = Math.max(0.01, absValues[Math.floor((absValues.length - 1) * 0.95)])
  const sensitivity = Math.max(0.01, Math.min(1, options.sensitivity ?? 0.08))
  const output = new Uint8ClampedArray(current.length)
  let positiveCount = 0
  let negativeCount = 0
  let neutralCount = 0
  for (let index = 0; index < values.length; index++) {
    if (!valid[index]) { continue }
    const signed = values[index]
    const strength = Math.min(1, Math.abs(signed) / scale)
    if (strength < sensitivity) { neutralCount++; continue }
    const offset = index * 4
    if (signed > 0) {
      output[offset] = 232
      output[offset + 1] = Math.round(185 - strength * 95)
      output[offset + 2] = 92
      positiveCount++
    } else {
      output[offset] = 72
      output[offset + 1] = Math.round(180 + strength * 30)
      output[offset + 2] = 223
      negativeCount++
    }
    output[offset + 3] = Math.round(65 + strength * 170)
  }
  const summary: BackgroundSummary = {
    validPixelCount: options.operation === "ratio" ? ratioCount : count,
    baselineMean: Number(baselineMean.toFixed(1)),
    baselineDeviation: Number(baselineDeviation.toFixed(1)),
    meanDifference: Number((differenceSum / count).toFixed(2)),
    meanRatio: Number((ratioSum / Math.max(1, ratioCount)).toFixed(3)),
    meanZ: Number((differenceSum / count / Math.max(baselineDeviation, 1)).toFixed(2)),
    suppressedResidual: Number((suppressed / count).toFixed(2)),
    positiveCount,
    negativeCount,
    neutralCount,
    rows: [
      { label: "下降", value: negativeCount, color: "#48b4df" },
      { label: "稳定", value: neutralCount, color: "#78909c" },
      { label: "上升", value: positiveCount, color: "#e98c5c" }
    ]
  }
  return { pixels: output, summary }
}
