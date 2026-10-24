export type ScreenshotMetric = "luminance" | "greenness" | "warmth" | "texture"

export type ScreenshotPixelSource = {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type ScreenshotAnalysisOptions = {
  metric: ScreenshotMetric
  sampleStep: number
  gridColumns: number
  gridRows: number
  inset?: number
  profileSegments?: number
}

export type ScreenshotAnalysisResult = {
  metric: ScreenshotMetric
  width: number
  height: number
  sampledPixels: number
  gridColumns: number
  gridRows: number
  gridValues: number[]
  profileValues: number[]
  levelDistribution: number[]
  colorDistribution: number[]
  channelMeans: number[]
  mean: number
  minimum: number
  maximum: number
  standardDeviation: number
}

const clampByte = (value: number) => Math.max(0, Math.min(255, value))
const toPercent = (value: number) => Number((clampByte(value) / 2.55).toFixed(1))

function getMetricValue(metric: ScreenshotMetric, red: number, green: number, blue: number, luminance: number, previous: number | null) {
  if (metric === "greenness") {
    return clampByte(128 + green * 1.5 - red * 0.75 - blue * 0.75)
  }
  if (metric === "warmth") {
    return clampByte(128 + red - blue)
  }
  if (metric === "texture") {
    return previous === null ? 0 : clampByte(Math.abs(luminance - previous) * 3)
  }
  return luminance
}

function normalizeCounts(counts: number[], total: number) {
  if (!total) {
    return counts.map(() => 0)
  }
  return counts.map((value) => Number((value / total * 100).toFixed(1)))
}

export function analyzeScreenshotPixels(source: ScreenshotPixelSource, options: ScreenshotAnalysisOptions): ScreenshotAnalysisResult {
  const width = Math.max(1, Math.floor(source.width))
  const height = Math.max(1, Math.floor(source.height))
  const inset = Math.max(0, Math.min(Math.floor(options.inset || 0), Math.floor((Math.min(width, height) - 1) / 2)))
  const sampleStep = Math.max(1, Math.floor(options.sampleStep || 1))
  const gridColumns = Math.max(1, Math.floor(options.gridColumns || 1))
  const gridRows = Math.max(1, Math.floor(options.gridRows || 1))
  const profileSegments = Math.max(2, Math.floor(options.profileSegments || 8))
  const contentWidth = Math.max(1, width - inset * 2)
  const contentHeight = Math.max(1, height - inset * 2)
  const gridSums = Array(gridColumns * gridRows).fill(0)
  const gridCounts = Array(gridColumns * gridRows).fill(0)
  const profileSums = Array(profileSegments).fill(0)
  const profileCounts = Array(profileSegments).fill(0)
  const levelCounts = [0, 0, 0, 0]
  const colorCounts = [0, 0, 0, 0, 0]
  const channelSums = [0, 0, 0]
  let sampledPixels = 0
  let metricSum = 0
  let metricSquaredSum = 0
  let minimum = 255
  let maximum = 0

  for (let y = inset; y < height - inset; y += sampleStep) {
    let previousLuminance: number | null = null
    for (let x = inset; x < width - inset; x += sampleStep) {
      const offset = (y * width + x) * 4
      const alpha = source.data[offset + 3]
      if (alpha < 16) {
        continue
      }
      const red = source.data[offset]
      const green = source.data[offset + 1]
      const blue = source.data[offset + 2]
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
      const metricValue = getMetricValue(options.metric, red, green, blue, luminance, previousLuminance)
      previousLuminance = luminance
      const normalized = metricValue / 2.55
      const gridColumn = Math.min(gridColumns - 1, Math.floor((x - inset) / contentWidth * gridColumns))
      const gridRow = Math.min(gridRows - 1, Math.floor((y - inset) / contentHeight * gridRows))
      const gridIndex = gridRow * gridColumns + gridColumn
      const profileIndex = Math.min(profileSegments - 1, Math.floor((x - inset) / contentWidth * profileSegments))
      const levelIndex = Math.min(3, Math.floor(normalized / 25))
      const channelRange = Math.max(red, green, blue) - Math.min(red, green, blue)

      gridSums[gridIndex] += normalized
      gridCounts[gridIndex] += 1
      profileSums[profileIndex] += normalized
      profileCounts[profileIndex] += 1
      levelCounts[levelIndex] += 1
      channelSums[0] += red
      channelSums[1] += green
      channelSums[2] += blue

      if (luminance < 65) {
        colorCounts[0] += 1
      } else if (luminance > 195 && channelRange < 42) {
        colorCounts[3] += 1
      } else if (green > red * 1.06 && green > blue * 1.04) {
        colorCounts[1] += 1
      } else if (red > green * 1.08 && red > blue * 1.08) {
        colorCounts[2] += 1
      } else {
        colorCounts[4] += 1
      }

      sampledPixels += 1
      metricSum += normalized
      metricSquaredSum += normalized * normalized
      minimum = Math.min(minimum, normalized)
      maximum = Math.max(maximum, normalized)
    }
  }

  const mean = sampledPixels ? metricSum / sampledPixels : 0
  const variance = sampledPixels ? Math.max(0, metricSquaredSum / sampledPixels - mean * mean) : 0
  const averageSeries = (sums: number[], counts: number[]) => sums.map((value, index) => Number((value / Math.max(1, counts[index])).toFixed(1)))

  return {
    metric: options.metric,
    width,
    height,
    sampledPixels,
    gridColumns,
    gridRows,
    gridValues: averageSeries(gridSums, gridCounts),
    profileValues: averageSeries(profileSums, profileCounts),
    levelDistribution: normalizeCounts(levelCounts, sampledPixels),
    colorDistribution: normalizeCounts(colorCounts, sampledPixels),
    channelMeans: channelSums.map((value) => toPercent(value / Math.max(1, sampledPixels))),
    mean: Number(mean.toFixed(1)),
    minimum: sampledPixels ? Number(minimum.toFixed(1)) : 0,
    maximum: sampledPixels ? Number(maximum.toFixed(1)) : 0,
    standardDeviation: Number(Math.sqrt(variance).toFixed(1))
  }
}
