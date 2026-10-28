import { beforeEach, describe, expect, it, vi } from "vitest"

const eoapiGet = vi.fn()
const eoapiPost = vi.fn()
const eoapiDelete = vi.fn()
const eoapiClientPost = vi.fn()
const emitDatasetSync = vi.fn()
const idbSet = vi.fn(async () => undefined)
const idbGet = vi.fn(async () => null)
const idbDel = vi.fn(async () => undefined)

vi.mock("./eoapi-client", () => ({
  eoapiGet,
  eoapiPost,
  eoapiDelete,
  eoapiClient: {
    post: eoapiClientPost
  },
  resolveEoapiHref: (url: string) => url
}))

vi.mock("./dataset-sync", () => ({
  emitDatasetSync
}))

vi.mock("idb-keyval", () => ({
  createStore: vi.fn(() => ({})),
  del: idbDel,
  get: idbGet,
  set: idbSet
}))

vi.mock("spark-md5", () => ({
  default: {
    ArrayBuffer: class {
      append() {}
      end() {
        return "md5-test"
      }
    }
  }
}))

const { LARGE_ARTIFACT_UPLOAD_THRESHOLD_BYTES, getArtifacts, smartUploadArtifact } = await import("./eoapi-artifacts")

function makeSizedFile(name: string, size: number, type = "application/octet-stream"): File {
  const file = new File(["x"], name, { type })
  Object.defineProperty(file, "size", {
    configurable: true,
    value: size
  })
  return file
}

describe("smartUploadArtifact", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, statusText: "OK" } as Response)))
  })

  it("directly uploads files below the 50MB threshold", async () => {
    const file = makeSizedFile("small-report.pdf", LARGE_ARTIFACT_UPLOAD_THRESHOLD_BYTES - 1, "application/pdf")
    eoapiClientPost.mockResolvedValueOnce({
      data: {
        artifactId: "art_small_1",
        url: "/artifacts/art_small_1",
        name: "small-report.pdf",
        type: "report",
        mime: "application/pdf",
        size: file.size,
        createdAt: 1
      }
    })

    const result = await smartUploadArtifact({
      file,
      name: "small-report.pdf",
      type: "report",
      datasetId: "ds_small_1"
    })

    expect(result.success).toBe(true)
    expect(eoapiClientPost).toHaveBeenCalledWith(
      "/artifacts/upload",
      expect.any(FormData),
      expect.objectContaining({
        headers: {
          "Content-Type": "multipart/form-data"
        }
      })
    )
    expect(eoapiPost).not.toHaveBeenCalledWith("/artifacts/chunked/init", expect.anything())
    expect(emitDatasetSync).toHaveBeenCalledWith({
      datasetId: "ds_small_1",
      reason: "artifact",
      source: "smartUploadArtifact:direct"
    })
  })

  it("switches remote files at 50MB to chunked upload", async () => {
    const file = makeSizedFile("big-data.zip", LARGE_ARTIFACT_UPLOAD_THRESHOLD_BYTES, "application/zip")
    eoapiPost.mockImplementation(async (url: string, payload: any) => {
      if (url === "/artifacts/dedup-check") {
        return { success: true, data: {} }
      }
      if (url === "/artifacts/chunked/init") {
        return {
          success: true,
          data: {
            uploadId: "upload_big_1",
            artifactId: "art_big_1",
            chunks: [],
            expiresAt: Date.now() + 60_000
          }
        }
      }
      if (url === "/artifacts/chunked/complete") {
        return {
          success: true,
          data: {
            artifactId: "art_big_1",
            url: "/artifacts/art_big_1",
            name: payload.name,
            type: payload.type,
            mime: payload.mime,
            size: payload.size,
            createdAt: 2
          }
        }
      }
      if (url === "/artifacts/art_big_1/metadata") {
        return {
          success: true,
          data: {
            artifactId: "art_big_1"
          }
        }
      }
      return { success: false, message: `unexpected url: ${url}` }
    })

    const result = await smartUploadArtifact({
      file,
      name: "big-data.zip",
      type: "data",
      datasetId: "ds_big_1"
    }, {
      chunkSize: 5 * 1024 * 1024,
      concurrency: 1
    })

    expect(result.success).toBe(true)
    expect(eoapiClientPost).not.toHaveBeenCalled()
    expect(eoapiPost).toHaveBeenCalledWith("/artifacts/chunked/init", expect.objectContaining({
      name: "big-data.zip",
      type: "data",
      size: LARGE_ARTIFACT_UPLOAD_THRESHOLD_BYTES,
      chunkCount: 10,
      chunkSize: 5 * 1024 * 1024
    }))
    expect(fetch).toHaveBeenCalled()
    expect(emitDatasetSync).toHaveBeenCalledWith({
      datasetId: "ds_big_1",
      reason: "artifact",
      source: "smartUploadArtifact:chunked"
    })
  })

  it("falls back to presigned upload flow for local large files", async () => {
    const file = makeSizedFile("local-big.zip", LARGE_ARTIFACT_UPLOAD_THRESHOLD_BYTES, "application/zip")
    eoapiPost.mockImplementation(async (url: string) => {
      if (url === "/artifacts/presigned") {
        return { success: false, message: "offline" }
      }
      return { success: false, message: `unexpected url: ${url}` }
    })

    const result = await smartUploadArtifact({
      file,
      name: "local-big.zip",
      type: "data",
      datasetId: "local_ds_big_1"
    })

    expect(result.success).toBe(true)
    expect(eoapiPost).toHaveBeenCalledWith("/artifacts/presigned", expect.objectContaining({
      name: "local-big.zip",
      size: LARGE_ARTIFACT_UPLOAD_THRESHOLD_BYTES
    }))
    expect(eoapiPost).not.toHaveBeenCalledWith("/artifacts/chunked/init", expect.anything())
    expect(idbSet).toHaveBeenCalled()
    expect(emitDatasetSync).toHaveBeenCalledWith({
      datasetId: "local_ds_big_1",
      reason: "artifact",
      source: "smartUploadArtifact:local-presigned"
    })
  })
})

describe("bundled layer loading acceptance artifact", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    eoapiGet.mockResolvedValue({ success: false, message: "offline" })
  })

  it("exposes an ordinary JPG report in the dataset attachment list", async () => {
    const result = await getArtifacts({ datasetId: "local_layer_loading_acceptance" })

    expect(result.success).toBe(true)
    expect(result.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        artifactId: "local_art_layer_loading_report",
        name: "图层加载验收监测报告.jpg",
        type: "report",
        mime: "image/jpeg",
        datasetId: "local_layer_loading_acceptance"
      })
    ]))
  })
})
