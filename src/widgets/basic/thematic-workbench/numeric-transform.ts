export type NumericOperation = "extract" | "vectorize" | "index" | "projection"
export type NumericChannel = "brightness" | "red" | "green" | "blue"
export type NumericIndex = "exg" | "ngrdi"
export type GeoBounds = { west: number; south: number; east: number; north: number }
export type NumericOptions = {
  operation: NumericOperation
  channel?: NumericChannel
  threshold?: number
  blockSize?: 4 | 8 | 16
  index?: NumericIndex
  bounds?: GeoBounds
}
export type NumericSummary = {
  validPixelCount: number
  selectedPixelCount: number
  coverage: number
  mean: number
  featureCount: number
  centerWgs84?: [number, number]
  centerMercator?: [number, number]
  mercatorBounds?: [number, number, number, number]
  rows: Array<{ label: string; value: number; color: string }>
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function projectWgs84(lon: number, lat: number): [number, number] {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new Error("Invalid WGS84 coordinate")
  }
  const radius = 6378137
  const safeLat = clamp(lat, -85.05112878, 85.05112878)
  return [radius * lon * Math.PI / 180, radius * Math.log(Math.tan(Math.PI / 4 + safeLat * Math.PI / 360))]
}

export function makePixelVectorSvg(cells: Array<{ x: number; y: number; w: number; h: number }>, width: number, height: number) {
  const paths = cells.map((cell) => `M${cell.x} ${cell.y}h${cell.w}v${cell.h}h-${cell.w}Z`).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${paths}" fill="#41b9d6" fill-opacity=".18" stroke="#16a6cf" stroke-width=".7"/></svg>`
}

export function processNumericPixels(pixels: Uint8ClampedArray, width: number, height: number, options: NumericOptions) {
  if (width < 1 || height < 1 || pixels.length !== width * height * 4) { throw new Error("Invalid image dimensions") }
  const threshold = clamp(options.threshold ?? 140, 0, 255)
  const values = new Float32Array(width * height)
  const valid = new Uint8Array(values.length)
  let count = 0
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    const offset = i * 4
    if (pixels[offset + 3] < 16) { continue }
    const [red, green, blue] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]]
    valid[i] = 1
    count++
    if (options.operation === "index") {
      values[i] = options.index === "ngrdi" ? (green - red) / Math.max(1, green + red) : 2 * green - red - blue
    } else if (options.channel === "red") { values[i] = red } else if (options.channel === "green") { values[i] = green } else if (options.channel === "blue") { values[i] = blue } else { values[i] = red * 0.2126 + green * 0.7152 + blue * 0.0722 }
    sum += values[i]
  }
  if (!count) { throw new Error("No valid pixels") }
  const output = new Uint8ClampedArray(pixels.length)
  const cells: Array<{ x: number; y: number; w: number; h: number }> = []
  let selected = 0
  if (options.operation === "vectorize") {
    const block = options.blockSize ?? 8
    for (let y = 0; y < height; y += block) {
      for (let x = 0; x < width; x += block) {
        let blockSum = 0
        let blockCount = 0
        const cellWidth = Math.min(block, width - x)
        const cellHeight = Math.min(block, height - y)
        for (let dy = 0; dy < cellHeight; dy++) {
          for (let dx = 0; dx < cellWidth; dx++) {
            const index = (y + dy) * width + x + dx
            if (valid[index]) { blockSum += values[index]; blockCount++ }
          }
        }
        if (!blockCount || blockSum / blockCount < threshold) { continue }
        cells.push({ x, y, w: cellWidth, h: cellHeight })
        for (let dy = 0; dy < cellHeight; dy++) {
          for (let dx = 0; dx < cellWidth; dx++) {
            const index = (y + dy) * width + x + dx
            if (!valid[index]) { continue }
            selected++
            const edge = dx === 0 || dy === 0 || dx === cellWidth - 1 || dy === cellHeight - 1
            output.set(edge ? [31, 211, 229, 225] : [31, 160, 190, 55], index * 4)
          }
        }
      }
    }
  } else if (options.operation === "projection") {
    if (!options.bounds || options.bounds.west >= options.bounds.east || options.bounds.south >= options.bounds.north) { throw new Error("Invalid locked bounds") }
    const spacing = Math.max(12, Math.floor(Math.min(width, height) / 6))
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x % spacing > 1 && y % spacing > 1) { continue }
        const index = y * width + x
        if (!valid[index]) { continue }
        output.set([45, 200, 226, 160], index * 4)
        selected++
      }
    }
  } else {
    for (let i = 0; i < values.length; i++) {
      if (!valid[i]) { continue }
      const value = values[i]
      const selectedIndex = options.operation === "index" ? value > 0 : value >= threshold
      if (!selectedIndex) { continue }
      selected++
      const strength = options.operation === "index" ? clamp(Math.abs(value) / (options.index === "ngrdi" ? 0.35 : 120), 0, 1) : clamp((value - threshold) / Math.max(1, 255 - threshold), 0, 1)
      output.set([options.operation === "index" ? 45 : 243, options.operation === "index" ? 198 : 178, options.operation === "index" ? 126 : 69, Math.round(85 + strength * 150)], i * 4)
    }
  }
  const bounds = options.bounds
  const centerWgs84: [number, number] | undefined = bounds ? [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2] : undefined
  const centerMercator = centerWgs84 ? projectWgs84(...centerWgs84) : undefined
  const mercatorBounds: [number, number, number, number] | undefined = bounds
    ? [...projectWgs84(bounds.west, bounds.south), ...projectWgs84(bounds.east, bounds.north)]
    : undefined
  const summary: NumericSummary = {
    validPixelCount: count,
    selectedPixelCount: selected,
    coverage: Number((selected / count * 100).toFixed(1)),
    mean: Number((sum / count).toFixed(options.operation === "index" && options.index === "ngrdi" ? 3 : 1)),
    featureCount: cells.length,
    centerWgs84,
    centerMercator,
    mercatorBounds,
    rows: [
      { label: "选中", value: selected, color: "#42bdd1" },
      { label: "其余", value: count - selected, color: "#738a99" }
    ]
  }
  return { pixels: output, summary, svg: options.operation === "vectorize" ? makePixelVectorSvg(cells, width, height) : null }
}
