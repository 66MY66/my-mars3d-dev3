export type SignalOperation = "fourier" | "wavelet" | "filter" | "edge"
export type SignalFilter = "gaussian" | "median" | "mean"
export type SignalEdgeMethod = "sobel" | "prewitt" | "canny"
export type SignalWaveletBand = "detail" | "approximation"

export type SignalOptions = {
  operation: SignalOperation
  cutoff?: number
  waveletLevel?: number
  waveletBand?: SignalWaveletBand
  filter?: SignalFilter
  filterWindow?: number
  edgeMethod?: SignalEdgeMethod
  edgeThreshold?: number
}

export type SignalSummary = {
  validPixelCount: number
  mean: number
  peak: number
  spectrum: number[]
  dominantPeriod: number
  highFrequencyRatio: number
  detailEnergyRatio: number
  noiseReduction: number
  estimatedSnrGainDb: number
  edgePixelCount: number
  edgeDensity: number
}

export type SignalResult = {
  pixels: Uint8ClampedArray
  summary: SignalSummary
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function nextPowerOfTwo(value: number) {
  let size = 1
  while (size < value) {
    size *= 2
  }
  return size
}

function luminance(pixels: Uint8ClampedArray, offset: number) {
  return pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722
}

// In-place radix-2 FFT. Each row/column is transformed separately by fft2d.
function fft1d(real: Float64Array, imaginary: Float64Array, inverse = false) {
  const size = real.length
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1
    for (; j & bit; bit >>= 1) {
      j ^= bit
    }
    j ^= bit
    if (i < j) {
      const a = real[i]
      real[i] = real[j]
      real[j] = a
      const b = imaginary[i]
      imaginary[i] = imaginary[j]
      imaginary[j] = b
    }
  }
  for (let length = 2; length <= size; length *= 2) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / length
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    for (let start = 0; start < size; start += length) {
      let wr = 1
      let wi = 0
      for (let offset = 0; offset < length / 2; offset++) {
        const even = start + offset
        const odd = even + length / 2
        const tr = wr * real[odd] - wi * imaginary[odd]
        const ti = wr * imaginary[odd] + wi * real[odd]
        real[odd] = real[even] - tr
        imaginary[odd] = imaginary[even] - ti
        real[even] += tr
        imaginary[even] += ti
        const nextWr = wr * cosine - wi * sine
        wi = wr * sine + wi * cosine
        wr = nextWr
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < size; i++) {
      real[i] /= size
      imaginary[i] /= size
    }
  }
}

function fft2d(real: Float64Array, imaginary: Float64Array, width: number, height: number, inverse = false) {
  const rowReal = new Float64Array(width)
  const rowImaginary = new Float64Array(width)
  for (let y = 0; y < height; y++) {
    const start = y * width
    rowReal.set(real.subarray(start, start + width))
    rowImaginary.set(imaginary.subarray(start, start + width))
    fft1d(rowReal, rowImaginary, inverse)
    real.set(rowReal, start)
    imaginary.set(rowImaginary, start)
  }
  const columnReal = new Float64Array(height)
  const columnImaginary = new Float64Array(height)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      columnReal[y] = real[y * width + x]
      columnImaginary[y] = imaginary[y * width + x]
    }
    fft1d(columnReal, columnImaginary, inverse)
    for (let y = 0; y < height; y++) {
      real[y * width + x] = columnReal[y]
      imaginary[y * width + x] = columnImaginary[y]
    }
  }
}

function rgbaFromIntensity(
  values: Float64Array,
  valid: Uint8Array,
  width: number,
  height: number,
  palette: "cyan" | "amber" | "gray",
  transparentZero = false
) {
  const output = new Uint8ClampedArray(width * height * 4)
  let peak = 0
  for (let i = 0; i < values.length; i++) {
    if (valid[i]) {
      peak = Math.max(peak, values[i])
    }
  }
  const scale = Math.max(1, peak)
  for (let i = 0; i < values.length; i++) {
    if (!valid[i]) {
      continue
    }
    const intensity = clamp(values[i] / scale, 0, 1)
    const offset = i * 4
    if (palette === "cyan") {
      output[offset] = 15 + 79 * intensity
      output[offset + 1] = 61 + 188 * intensity
      output[offset + 2] = 89 + 145 * intensity
    } else if (palette === "amber") {
      output[offset] = 57 + 198 * intensity
      output[offset + 1] = 51 + 129 * intensity
      output[offset + 2] = 57 - 28 * intensity
    } else {
      output[offset] = values[i]
      output[offset + 1] = values[i]
      output[offset + 2] = values[i]
    }
    output[offset + 3] = transparentZero && intensity < 0.04 ? 0 : 255
  }
  return { output, peak: Number(peak.toFixed(1)) }
}

function fourier(source: Float64Array, valid: Uint8Array, width: number, height: number, cutoff: number) {
  const paddedWidth = nextPowerOfTwo(width)
  const paddedHeight = nextPowerOfTwo(height)
  const real = new Float64Array(paddedWidth * paddedHeight)
  const imaginary = new Float64Array(real.length)
  let average = 0
  let count = 0
  for (let i = 0; i < source.length; i++) {
    if (valid[i]) {
      average += source[i]
      count++
    }
  }
  average /= Math.max(1, count)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      real[y * paddedWidth + x] = valid[index] ? source[index] - average : 0
    }
  }
  fft2d(real, imaginary, paddedWidth, paddedHeight)
  const bins = new Float64Array(20)
  let totalEnergy = 0
  let highEnergy = 0
  const cutoffRatio = clamp(cutoff, 2, 45) / 100
  for (let y = 0; y < paddedHeight; y++) {
    const fy = Math.min(y, paddedHeight - y) / paddedHeight
    for (let x = 0; x < paddedWidth; x++) {
      const fx = Math.min(x, paddedWidth - x) / paddedWidth
      const radius = Math.hypot(fx, fy) / Math.SQRT1_2
      const index = y * paddedWidth + x
      const energy = real[index] ** 2 + imaginary[index] ** 2
      const bin = Math.min(bins.length - 1, Math.floor(radius * bins.length))
      if (radius > 0.003) {
        bins[bin] += energy
        totalEnergy += energy
      }
      if (radius >= cutoffRatio) {
        highEnergy += energy
      } else {
        real[index] = 0
        imaginary[index] = 0
      }
    }
  }
  const dominantBin = bins.slice(1).reduce((best, value, index) => (value > bins[best] ? index + 1 : best), 1)
  const dominantFrequency = ((dominantBin + 0.5) / bins.length) * Math.SQRT1_2
  const spectrumPeak = Math.max(1, ...bins)
  const spectrum = Array.from(bins, (energy) => Number(((Math.log1p(energy) / Math.log1p(spectrumPeak)) * 100).toFixed(1)))
  fft2d(real, imaginary, paddedWidth, paddedHeight, true)
  const values = new Float64Array(source.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      values[y * width + x] = Math.abs(real[y * paddedWidth + x])
    }
  }
  return {
    ...rgbaFromIntensity(values, valid, width, height, "cyan"),
    spectrum,
    dominantPeriod: Number((1 / Math.max(0.001, dominantFrequency)).toFixed(1)),
    highFrequencyRatio: totalEnergy > 0 ? highEnergy / totalEnergy : 0
  }
}

function wavelet(source: Float64Array, valid: Uint8Array, width: number, height: number, level: number, band: SignalWaveletBand) {
  const levels = clamp(Math.round(level), 1, Math.min(3, Math.floor(Math.log2(Math.min(nextPowerOfTwo(width), nextPowerOfTwo(height))))))
  const paddedWidth = nextPowerOfTwo(width)
  const paddedHeight = nextPowerOfTwo(height)
  const values = new Float64Array(paddedWidth * paddedHeight)
  for (let y = 0; y < paddedHeight; y++) {
    for (let x = 0; x < paddedWidth; x++) {
      const sx = Math.min(width - 1, x)
      const sy = Math.min(height - 1, y)
      values[y * paddedWidth + x] = valid[sy * width + sx] ? source[sy * width + sx] : 0
    }
  }
  const scratch = new Float64Array(values.length)
  let detailEnergy = 0
  let totalEnergy = 0
  for (let i = 0; i < source.length; i++) {
    if (valid[i]) {
      totalEnergy += source[i] ** 2
    }
  }
  for (let depth = 0; depth < levels; depth++) {
    const activeWidth = paddedWidth >> depth
    const activeHeight = paddedHeight >> depth
    for (let y = 0; y < activeHeight; y++) {
      for (let x = 0; x < activeWidth / 2; x++) {
        const a = values[y * paddedWidth + 2 * x]
        const b = values[y * paddedWidth + 2 * x + 1]
        scratch[y * paddedWidth + x] = (a + b) / Math.SQRT2
        scratch[y * paddedWidth + x + activeWidth / 2] = (a - b) / Math.SQRT2
      }
      values.set(scratch.subarray(y * paddedWidth, y * paddedWidth + activeWidth), y * paddedWidth)
    }
    for (let x = 0; x < activeWidth; x++) {
      for (let y = 0; y < activeHeight / 2; y++) {
        const a = values[2 * y * paddedWidth + x]
        const b = values[(2 * y + 1) * paddedWidth + x]
        scratch[y * paddedWidth + x] = (a + b) / Math.SQRT2
        scratch[(y + activeHeight / 2) * paddedWidth + x] = (a - b) / Math.SQRT2
      }
      for (let y = 0; y < activeHeight; y++) {
        values[y * paddedWidth + x] = scratch[y * paddedWidth + x]
      }
    }
    for (let y = 0; y < activeHeight; y++) {
      for (let x = 0; x < activeWidth; x++) {
        if (x >= activeWidth / 2 || y >= activeHeight / 2) {
          const index = y * paddedWidth + x
          detailEnergy += values[index] ** 2
          values[index] = 0
        }
      }
    }
  }
  for (let depth = levels - 1; depth >= 0; depth--) {
    const activeWidth = paddedWidth >> depth
    const activeHeight = paddedHeight >> depth
    for (let x = 0; x < activeWidth; x++) {
      for (let y = 0; y < activeHeight / 2; y++) {
        const low = values[y * paddedWidth + x]
        const high = values[(y + activeHeight / 2) * paddedWidth + x]
        scratch[2 * y * paddedWidth + x] = (low + high) / Math.SQRT2
        scratch[(2 * y + 1) * paddedWidth + x] = (low - high) / Math.SQRT2
      }
      for (let y = 0; y < activeHeight; y++) {
        values[y * paddedWidth + x] = scratch[y * paddedWidth + x]
      }
    }
    for (let y = 0; y < activeHeight; y++) {
      for (let x = 0; x < activeWidth / 2; x++) {
        const low = values[y * paddedWidth + x]
        const high = values[y * paddedWidth + x + activeWidth / 2]
        scratch[y * paddedWidth + 2 * x] = (low + high) / Math.SQRT2
        scratch[y * paddedWidth + 2 * x + 1] = (low - high) / Math.SQRT2
      }
      values.set(scratch.subarray(y * paddedWidth, y * paddedWidth + activeWidth), y * paddedWidth)
    }
  }
  const rendered = new Float64Array(source.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      const approximation = values[y * paddedWidth + x]
      rendered[index] = band === "detail" ? Math.abs(source[index] - approximation) : approximation
    }
  }
  return {
    ...rgbaFromIntensity(rendered, valid, width, height, band === "detail" ? "amber" : "gray"),
    detailEnergyRatio: totalEnergy > 0 ? clamp(detailEnergy / totalEnergy, 0, 1) : 0
  }
}

function filterScalar(source: Float64Array, valid: Uint8Array, width: number, height: number, method: SignalFilter, window: number) {
  const radius = (window - 1) / 2
  const output = new Float64Array(source.length)
  const sigma = Math.max(0.7, radius / 1.5)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      if (!valid[index]) {
        continue
      }
      const neighbors: number[] = []
      let sum = 0
      let weightSum = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = clamp(x + dx, 0, width - 1)
          const ny = clamp(y + dy, 0, height - 1)
          const neighbor = ny * width + nx
          if (!valid[neighbor]) {
            continue
          }
          const weight = method === "gaussian" ? Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)) : 1
          neighbors.push(source[neighbor])
          sum += source[neighbor] * weight
          weightSum += weight
        }
      }
      if (method === "median") {
        neighbors.sort((a, b) => a - b)
        output[index] = neighbors[Math.floor(neighbors.length / 2)] ?? source[index]
      } else {
        output[index] = weightSum ? sum / weightSum : source[index]
      }
    }
  }
  return output
}

function localResidualEnergy(values: Float64Array, valid: Uint8Array, width: number, height: number) {
  let energy = 0
  let count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x
      const neighborhood = [index - width, index + width, index - 1, index + 1]
      if (!valid[index] || neighborhood.some((neighbor) => !valid[neighbor])) {
        continue
      }
      const residual = values[index] - neighborhood.reduce((sum, neighbor) => sum + values[neighbor], 0) / 4
      energy += residual ** 2
      count++
    }
  }
  return energy / Math.max(1, count)
}

function filterImage(
  pixels: Uint8ClampedArray,
  source: Float64Array,
  valid: Uint8Array,
  width: number,
  height: number,
  method: SignalFilter,
  window: number
) {
  const output = new Uint8ClampedArray(pixels.length)
  for (let channel = 0; channel < 3; channel++) {
    const values = new Float64Array(source.length)
    for (let i = 0; i < values.length; i++) {
      values[i] = pixels[i * 4 + channel]
    }
    const filtered = filterScalar(values, valid, width, height, method, window)
    for (let i = 0; i < values.length; i++) {
      output[i * 4 + channel] = filtered[i]
    }
  }
  for (let i = 0; i < valid.length; i++) {
    output[i * 4 + 3] = valid[i] ? 255 : 0
  }
  const filteredLuminance = new Float64Array(source.length)
  for (let i = 0; i < filteredLuminance.length; i++) {
    filteredLuminance[i] = luminance(output, i * 4)
  }
  const before = localResidualEnergy(source, valid, width, height)
  const after = localResidualEnergy(filteredLuminance, valid, width, height)
  let peak = 0
  for (let i = 0; i < filteredLuminance.length; i++) {
    if (valid[i]) {
      peak = Math.max(peak, filteredLuminance[i])
    }
  }
  return {
    output,
    peak,
    noiseReduction: before > 0 ? clamp((before - after) / before, -1, 1) : 0,
    estimatedSnrGainDb: before > 0 ? clamp(10 * Math.log10(before / Math.max(after, 1e-6)), -30, 60) : 0
  }
}

function edge(source: Float64Array, valid: Uint8Array, width: number, height: number, method: SignalEdgeMethod, threshold: number) {
  const input = method === "canny" ? filterScalar(source, valid, width, height, "gaussian", 5) : source
  const magnitude = new Float64Array(source.length)
  const direction = new Uint8Array(source.length)
  const xKernel = method === "prewitt" ? [-1, 0, 1, -1, 0, 1, -1, 0, 1] : [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const yKernel = method === "prewitt" ? [-1, -1, -1, 0, 0, 0, 1, 1, 1] : [-1, -2, -1, 0, 0, 0, 1, 2, 1]
  let maximum = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x
      if (!valid[index]) {
        continue
      }
      let gx = 0
      let gy = 0
      let kernelIndex = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const neighbor = (y + dy) * width + x + dx
          const value = valid[neighbor] ? input[neighbor] : input[index]
          gx += value * xKernel[kernelIndex]
          gy += value * yKernel[kernelIndex]
          kernelIndex++
        }
      }
      magnitude[index] = Math.hypot(gx, gy)
      maximum = Math.max(maximum, magnitude[index])
      const angle = ((Math.atan2(gy, gx) * 180) / Math.PI + 180) % 180
      direction[index] = Math.round(angle / 45) % 4
    }
  }
  const edges = new Uint8Array(source.length)
  const high = (maximum * clamp(threshold, 5, 80)) / 100
  if (method === "canny") {
    const suppressed = new Float64Array(source.length)
    const offsets = [
      [1, -1],
      [width + 1, -width - 1],
      [width, -width],
      [width - 1, -width + 1]
    ]
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x
        const [forward, backward] = offsets[direction[index]]
        if (magnitude[index] >= magnitude[index + forward] && magnitude[index] >= magnitude[index + backward]) {
          suppressed[index] = magnitude[index]
        }
      }
    }
    const low = high * 0.4
    const stack: number[] = []
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x
        if (valid[index] && suppressed[index] >= high && suppressed[index] > 0) {
          edges[index] = 1
          stack.push(index)
        }
      }
    }
    while (stack.length) {
      const index = stack.pop() as number
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const neighbor = index + dy * width + dx
          if (!edges[neighbor] && valid[neighbor] && suppressed[neighbor] >= low && suppressed[neighbor] > 0) {
            edges[neighbor] = 1
            stack.push(neighbor)
          }
        }
      }
    }
  } else {
    for (let i = 0; i < edges.length; i++) {
      if (valid[i] && magnitude[i] >= high && magnitude[i] > 0) {
        edges[i] = 1
      }
    }
  }
  const output = new Uint8ClampedArray(source.length * 4)
  let count = 0
  for (let i = 0; i < edges.length; i++) {
    if (!edges[i]) {
      continue
    }
    output[i * 4] = 255
    output[i * 4 + 1] = 190
    output[i * 4 + 2] = 77
    output[i * 4 + 3] = 255
    count++
  }
  return { output, peak: Number(maximum.toFixed(1)), edgePixelCount: count }
}

export function processSignalPixels(pixels: Uint8ClampedArray, width: number, height: number, options: SignalOptions): SignalResult {
  if (width < 3 || height < 3 || pixels.length !== width * height * 4) {
    throw new Error("Invalid signal image dimensions")
  }
  const valid = new Uint8Array(width * height)
  const source = new Float64Array(valid.length)
  let validPixelCount = 0
  let sum = 0
  for (let i = 0; i < valid.length; i++) {
    valid[i] = pixels[i * 4 + 3] >= 16 ? 1 : 0
    if (!valid[i]) {
      continue
    }
    source[i] = luminance(pixels, i * 4)
    sum += source[i]
    validPixelCount++
  }
  if (!validPixelCount) {
    throw new Error("The selection contains no valid pixels")
  }
  const summary: SignalSummary = {
    validPixelCount,
    mean: Number((sum / validPixelCount).toFixed(1)),
    peak: 0,
    spectrum: [],
    dominantPeriod: 0,
    highFrequencyRatio: 0,
    detailEnergyRatio: 0,
    noiseReduction: 0,
    estimatedSnrGainDb: 0,
    edgePixelCount: 0,
    edgeDensity: 0
  }
  let output: Uint8ClampedArray
  if (options.operation === "fourier") {
    const result = fourier(source, valid, width, height, options.cutoff ?? 15)
    output = result.output
    summary.peak = result.peak
    summary.spectrum = result.spectrum
    summary.dominantPeriod = result.dominantPeriod
    summary.highFrequencyRatio = result.highFrequencyRatio
  } else if (options.operation === "wavelet") {
    const result = wavelet(source, valid, width, height, options.waveletLevel ?? 2, options.waveletBand ?? "detail")
    output = result.output
    summary.peak = result.peak
    summary.detailEnergyRatio = result.detailEnergyRatio
  } else if (options.operation === "filter") {
    const window = clamp(Math.round(options.filterWindow ?? 3), 3, 7) | 1
    const result = filterImage(pixels, source, valid, width, height, options.filter ?? "gaussian", window)
    output = result.output
    summary.peak = Number(result.peak.toFixed(1))
    summary.noiseReduction = result.noiseReduction
    summary.estimatedSnrGainDb = Number(result.estimatedSnrGainDb.toFixed(2))
  } else if (options.operation === "edge") {
    const result = edge(source, valid, width, height, options.edgeMethod ?? "canny", options.edgeThreshold ?? 25)
    output = result.output
    summary.peak = result.peak
    summary.edgePixelCount = result.edgePixelCount
    summary.edgeDensity = result.edgePixelCount / validPixelCount
  } else {
    throw new Error("Unknown signal operation")
  }
  return { pixels: output, summary }
}
