import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { webcrypto } from "node:crypto"
import { eoapiGet, eoapiPost } from "../dataset-repository/services/eoapi-client"
import { repositoryDownloadUrl, verifyRepositoryFile, requestRepositoryPublication, getRepositoryPublicationStatus } from "./publication-repository"

vi.mock("../dataset-repository/services/eoapi-client", () => ({ eoapiGet: vi.fn(), eoapiPost: vi.fn() }))
vi.mock("../dataset-repository/services/eoapi-config", () => ({ eoApiConfig: { apiPrefix: "/api/eoapi" } }))
const content = "actual file bytes"
const file = () => {
  const result = new File([content], "map.zip", { type: "application/zip" })
  Object.defineProperty(result, "arrayBuffer", { value: async () => new TextEncoder().encode(content).buffer })
  return result
}
function receipt() {
  vi.mocked(eoapiGet).mockResolvedValueOnce({ success: true, data: { artifactId: "art_1", name: "map.zip", size: content.length } })
    .mockResolvedValueOnce({ success: true, data: [{ artifactId: "art_1" }] })
    .mockResolvedValueOnce({ success: true, data: { downloadUrl: "/api/eoapi/uploads/artifacts/art_1.zip" } })
}
describe("real repository publication verification", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("crypto", webcrypto); vi.stubGlobal("fetch", vi.fn()) })
  afterEach(() => vi.unstubAllGlobals())
  it("maps only verified repository storage paths to the same-origin proxy", () => {
    expect(repositoryDownloadUrl("/uploads/artifacts/art_1.zip")).toBe("/api/eoapi/uploads/artifacts/art_1.zip")
    expect(repositoryDownloadUrl("http://192.168.10.15:5960/api/eoapi/uploads/artifacts/art_1.zip")).toBe("/api/eoapi/uploads/artifacts/art_1.zip")
    for (const value of ["https://evil.example/uploads/artifacts/a.zip", "javascript:alert(1)", "http://user:pass@192.168.10.15:5960/uploads/artifacts/a.zip", "/datasets/a", "/uploads/artifacts/a.zip#fragment"]) { expect(() => repositoryDownloadUrl(value)).toThrow() }
  })
  it("requires a real record, target association, complete download and matching SHA-256", async () => {
    receipt(); vi.mocked(fetch).mockResolvedValueOnce(new Response(content))
    const result = await verifyRepositoryFile(file(), "art_1", "ds_1")
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(result.file.name).toBe("map.zip")
    expect(eoapiGet).toHaveBeenCalledWith("/artifacts", { params: { datasetId: "ds_1", limit: 200, offset: 0 } })
    expect(fetch).toHaveBeenCalledWith("/api/eoapi/uploads/artifacts/art_1.zip", expect.objectContaining({ credentials: "omit", cache: "no-store" }))
  })
  it("reports the real download-404 defect despite a successful upload record", async () => {
    receipt(); vi.mocked(fetch).mockResolvedValueOnce(new Response("not found", { status: 404 }))
    await expect(verifyRepositoryFile(file(), "art_1", "ds_1")).rejects.toThrow("HTTP 404")
    expect(eoapiPost).not.toHaveBeenCalled()
  })
  it("rejects altered bytes, truncated files and overlong streams", async () => {
    for (const body of ["X".repeat(content.length), "short", content + "extra"]) {
      receipt(); vi.mocked(fetch).mockResolvedValueOnce(new Response(body))
      await expect(verifyRepositoryFile(file(), "art_1", "ds_1")).rejects.toThrow(/指纹|不完整|超过提交大小/)
    }
  })
  it("does not trust a record that belongs to another target", async () => {
    vi.mocked(eoapiGet).mockResolvedValueOnce({ success: true, data: { artifactId: "art_1", size: content.length } })
      .mockResolvedValueOnce({ success: true, data: [{ artifactId: "art_other" }] })
    await expect(verifyRepositoryFile(file(), "art_1", "ds_1")).rejects.toThrow("未能确认该文件已关联")
    expect(fetch).not.toHaveBeenCalled()
  })
  it("never accepts local records or promotes malformed status responses", async () => {
    await expect(verifyRepositoryFile(file(), "local_art_1", "ds_1")).rejects.toThrow("临时")
    await expect(getRepositoryPublicationStatus("local_ds_1")).rejects.toThrow("临时")
    vi.mocked(eoapiGet).mockResolvedValueOnce({ success: true, data: { datasetId: "ds_other", status: "published" } })
    await expect(getRepositoryPublicationStatus("ds_1")).rejects.toThrow("有效的发布审核状态")
  })
  it("submits an actual approval request and reports reviewing, not published", async () => {
    vi.mocked(eoapiGet).mockResolvedValueOnce({ success: true, data: { datasetId: "ds_1", status: "private" } })
      .mockResolvedValueOnce({ success: true, data: { datasetId: "ds_1", status: "reviewing" } })
    vi.mocked(eoapiPost).mockResolvedValueOnce({ success: true, data: { success: true } })
    expect((await requestRepositoryPublication("ds_1")).status).toBe("reviewing")
    expect(eoapiPost).toHaveBeenCalledWith("/datasets/ds_1/publish-request", {})
  })
  it("does not resubmit requests already received or published by the backend", async () => {
    for (const status of ["reviewing", "published"] as const) {
      vi.mocked(eoapiGet).mockResolvedValueOnce({ success: true, data: { datasetId: "ds_1", status } })
      expect((await requestRepositoryPublication("ds_1")).status).toBe(status)
    }
    expect(eoapiPost).not.toHaveBeenCalled()
  })
})
