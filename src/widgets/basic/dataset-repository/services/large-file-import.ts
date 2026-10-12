export const MAX_IMPORT_SOURCE_FILE_BYTES = 10 * 1024 * 1024 * 1024
export const LARGE_FILE_CHUNK_THRESHOLD_BYTES = 2 * 1024 * 1024 * 1024
export const LARGE_CSV_CHUNK_BYTES = 4 * 1024 * 1024
export const LARGE_CSV_BATCH_SIZE = 50000

export type ImportFormat = "geojson" | "csv" | "shp"

export type CsvChunkBatch = {
  batchIndex: number
  headers: string[]
  featureCollection: {
    type: "FeatureCollection"
    features: any[]
  }
  processedRows: number
  keptFeatures: number
  skippedRows: number
}

function normalizeSize(input: number | Blob | File): number {
  return typeof input === "number" ? input : Number((input as Blob)?.size || 0)
}

export function isLargeFileChunkingRequired(input: number | Blob | File): boolean {
  return normalizeSize(input) >= LARGE_FILE_CHUNK_THRESHOLD_BYTES
}

export function isLargeFileChunkingSupported(format: ImportFormat): boolean {
  return format === "csv" || format === "geojson"
}

export async function readCsvHeaderFields(file: Blob, sampleBytes = 256 * 1024): Promise<string[]> {
  const text = await file.slice(0, sampleBytes).text()
  const firstLine = String(text || "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .find(Boolean)
  if (!firstLine) {
    return []
  }
  return Array.from(new Set(firstLine.split(",").map((item) => item.trim()).filter(Boolean)))
}

function createCsvFeature(row: Record<string, any>, headers: string[]) {
  const lonKey = headers.find((h) => ["lon", "lng", "longitude", "x"].includes(h.toLowerCase()))
  const latKey = headers.find((h) => ["lat", "latitude", "y"].includes(h.toLowerCase()))
  if (!lonKey || !latKey) {
    return null
  }
  const lon = Number(row[lonKey])
  const lat = Number(row[latKey])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null
  }
  const properties = { ...row }
  delete properties[lonKey]
  delete properties[latKey]
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Point",
      coordinates: [lon, lat]
    }
  }
}

export async function parseCsvFileInChunks(
  file: Blob,
  options: {
    chunkBytes?: number
    batchSize?: number
    mapRow?: (row: Record<string, any>) => Record<string, any> | null
    mapFeature?: (feature: any) => any | null
    onBatch: (batch: CsvChunkBatch) => void | Promise<void>
    onProgress?: (percent: number) => void
  }
): Promise<{
  headers: string[]
  totalRows: number
  keptFeatures: number
  skippedRows: number
  batches: number
}> {
  const chunkBytes = Math.max(64 * 1024, Number(options.chunkBytes) || LARGE_CSV_CHUNK_BYTES)
  const batchSize = Math.max(1, Number(options.batchSize) || LARGE_CSV_BATCH_SIZE)
  const decoder = new TextDecoder()
  const totalSize = Math.max(1, Number(file.size || 0))
  let offset = 0
  let remainder = ""
  let headers: string[] = []
  let batchIndex = 0
  let totalRows = 0
  let keptFeatures = 0
  let skippedRows = 0
  let currentBatch: any[] = []

  const flushBatch = async () => {
    if (!currentBatch.length) {
      return
    }
    batchIndex += 1
    const featureCollection = {
      type: "FeatureCollection" as const,
      features: currentBatch
    }
    const batch = currentBatch
    currentBatch = []
    await options.onBatch({
      batchIndex,
      headers,
      featureCollection,
      processedRows: totalRows,
      keptFeatures,
      skippedRows
    })
    if (typeof options.onProgress === "function") {
      options.onProgress(Math.min(100, Math.round((offset / totalSize) * 100)))
    }
  }

  const handleLines = async (lines: string[]) => {
    for (const rawLine of lines) {
      const line = String(rawLine || "").trim()
      if (!line) {
        continue
      }
      if (!headers.length) {
        headers = line.split(",").map((item) => item.trim()).filter(Boolean)
        continue
      }
      totalRows += 1
      const cols = line.split(",")
      const row: Record<string, any> = {}
      headers.forEach((header, index) => {
        row[header] = cols[index]
      })
      const mappedRow = typeof options.mapRow === "function" ? options.mapRow(row) : row
      if (!mappedRow) {
        skippedRows += 1
        continue
      }
      const feature = createCsvFeature(mappedRow, headers)
      const mappedFeature = feature && typeof options.mapFeature === "function" ? options.mapFeature(feature) : feature
      if (!mappedFeature) {
        skippedRows += 1
        continue
      }
      currentBatch.push(mappedFeature)
      keptFeatures += 1
      if (currentBatch.length >= batchSize) {
        await flushBatch()
      }
    }
  }

  while (offset < totalSize) {
    const nextChunk = await file.slice(offset, offset + chunkBytes).arrayBuffer()
    offset += chunkBytes
    const text = remainder + decoder.decode(nextChunk, { stream: offset < totalSize })
    const lines = text.split(/\r?\n/g)
    remainder = lines.pop() || ""
    await handleLines(lines)
  }

  if (remainder.trim()) {
    await handleLines([remainder])
  }
  await flushBatch()

  if (!headers.length) {
    throw new Error("CSV 文件缺少表头")
  }

  return {
    headers,
    totalRows,
    keptFeatures,
    skippedRows,
    batches: batchIndex
  }
}
