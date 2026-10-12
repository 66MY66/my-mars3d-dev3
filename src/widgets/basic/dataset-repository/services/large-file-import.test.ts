import { describe, expect, it, vi } from "vitest"
import {
  LARGE_FILE_CHUNK_THRESHOLD_BYTES,
  isLargeFileChunkingRequired,
  parseCsvFileInChunks,
  readCsvHeaderFields
} from "./large-file-import"

describe("large-file-import", () => {
  it("detects when file size should switch to chunked loading", () => {
    expect(isLargeFileChunkingRequired(LARGE_FILE_CHUNK_THRESHOLD_BYTES - 1)).toBe(false)
    expect(isLargeFileChunkingRequired(LARGE_FILE_CHUNK_THRESHOLD_BYTES)).toBe(true)
  })

  it("reads csv header fields from the file head only", async () => {
    const file = new File([
      "lon,lat,name,status\n118,32,alpha,ok\n119,33,beta,done\n"
    ], "points.csv", { type: "text/csv" })

    await expect(readCsvHeaderFields(file)).resolves.toEqual(["lon", "lat", "name", "status"])
  })

  it("parses csv batches incrementally without loading the whole file at once", async () => {
    const file = new File([
      "lon,lat,name\n118,32,alpha\nbad,32,skip-me\n119,33,beta\n120,34,gamma\n"
    ], "points.csv", { type: "text/csv" })

    const onBatch = vi.fn()
    const onProgress = vi.fn()

    const result = await parseCsvFileInChunks(file, {
      chunkBytes: 12,
      batchSize: 2,
      onBatch,
      onProgress
    })

    expect(result).toEqual({
      headers: ["lon", "lat", "name"],
      totalRows: 4,
      keptFeatures: 3,
      skippedRows: 1,
      batches: 2
    })
    expect(onBatch).toHaveBeenCalledTimes(2)
    expect(onBatch.mock.calls[0][0].featureCollection.features).toHaveLength(2)
    expect(onBatch.mock.calls[1][0].featureCollection.features).toHaveLength(1)
    expect(onProgress).toHaveBeenCalled()
  })
})
