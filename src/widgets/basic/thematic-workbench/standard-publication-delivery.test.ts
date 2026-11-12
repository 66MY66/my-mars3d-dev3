import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { webcrypto } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import JSZip from "jszip"
import { dbtReviewClauses, inspectDbtDocument } from "./dbt116-standard"
import { createStandardPublicationArchive, uploadStandardPublicationArchive } from "./standard-publication-delivery"
import { uploadArtifact } from "../dataset-repository/services/eoapi-artifacts"
import { emitDatasetSync } from "../dataset-repository/services/dataset-sync"
import type { StandardPublicationBundle } from "./standard-publication"

vi.mock("../dataset-repository/services/eoapi-artifacts", () => ({ uploadArtifact: vi.fn() }))
vi.mock("../dataset-repository/services/dataset-sync", () => ({ emitDatasetSync: vi.fn() }))
vi.mock("./dbt116-standard", async importOriginal => {
  const actual = await importOriginal<typeof import("./dbt116-standard")>()
  return { ...actual, inspectDbtDocument: vi.fn(() => []) }
})

async function bundle(): Promise<StandardPublicationBundle> {
  // Fixture approval is mocked only to isolate packaging. Production inspection is tested separately.
  const document = JSON.parse(readFileSync(resolve("public/data/dbt116-test/T30101000.json"), "utf8"))
  document.usage = "operational"
  const dataSha256 = Buffer.from(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(document)))).toString("hex")
  const file = new File(["%PDF-test-fixture"], "map.pdf", { type: "application/pdf" })
  Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode("%PDF-test-fixture").buffer })
  return {
    templateId: "T30101000",
title: "仅单元测试",
code: "T30101006",
revision: 1,
format: "pdf",
dpi: 300,
document,
file,
    review: { template: "T30101000", code: "T30101006", usage: "operational", dataSha256, formalExportEnabled: true, issues: [], review: dbtReviewClauses.map(item => ({ ...item, confirmed: true })), reviewer: "测试复核人", evidence: "测试证据" }
  }
}
const bytes = (blob: Blob) => new Promise<ArrayBuffer>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result as ArrayBuffer)
  reader.onerror = reject
  reader.readAsArrayBuffer(blob)
})

describe("reviewed standard publication delivery", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("crypto", webcrypto); vi.mocked(inspectDbtDocument).mockReturnValue([]) })
  afterEach(() => { vi.unstubAllGlobals() })
  it("packages the actual map with its document, review and matching integrity manifest", async () => {
    const snapshot = await bundle()
    const file = await createStandardPublicationArchive(snapshot)
    expect(file.type).toBe("application/zip")
    const zip = await JSZip.loadAsync(new Uint8Array(await bytes(file)))
    expect(Object.keys(zip.files).sort()).toEqual(["T30101006.pdf", "document.json", "manifest.json", "review.json"].sort())
    expect(await zip.file("T30101006.pdf")!.async("string")).toBe("%PDF-test-fixture")
    expect(JSON.parse(await zip.file("document.json")!.async("string"))).toEqual(snapshot.document)
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"))
    expect(manifest.dataSha256).toBe(snapshot.review.dataSha256)
    expect(manifest.map.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(inspectDbtDocument).toHaveBeenCalledWith(snapshot.document, "T30101000")
  })

  it("rejects test data, changed documents, incomplete review and renderer failures", async () => {
    const snapshot = await bundle()
    snapshot.document.usage = "test"
    await expect(createStandardPublicationArchive(snapshot)).rejects.toThrow("未通过")
    snapshot.document.usage = "operational"
    snapshot.document.agency = "changed after review"
    await expect(createStandardPublicationArchive(snapshot)).rejects.toThrow("指纹不一致")
    const incomplete = await bundle()
    incomplete.review.review[0].confirmed = false
    await expect(createStandardPublicationArchive(incomplete)).rejects.toThrow("未通过")
    const badRender = await bundle()
    badRender.review.issues.push({ severity: "error", clause: "9", message: "render failed" })
    await expect(createStandardPublicationArchive(badRender)).rejects.toThrow("未通过")
    vi.mocked(inspectDbtDocument).mockReturnValue([{ severity: "error", clause: "4", message: "invalid source" }])
    await expect(createStandardPublicationArchive(await bundle())).rejects.toThrow("未通过")
    expect(uploadArtifact).not.toHaveBeenCalled()
  })

  it("accepts only confirmed remote artifact receipts and keeps existing access permissions", async () => {
    const file = new File(["zip"], "package.zip", { type: "application/zip" })
    vi.mocked(uploadArtifact).mockResolvedValueOnce({ success: false, message: "VPN disconnected" })
    await expect(uploadStandardPublicationArchive(file, "dataset_1", "规范图件发布测试")).rejects.toThrow("VPN disconnected")
    expect(uploadArtifact).toHaveBeenLastCalledWith(expect.objectContaining({ datasetId: "dataset_1", type: "export", file }), { localFallback: false })
    vi.mocked(uploadArtifact).mockResolvedValueOnce({ success: true, data: { artifactId: "local_art_1", url: "local://artifact/1" } as any })
    await expect(uploadStandardPublicationArchive(file, "dataset_1", "规范图件发布测试")).rejects.toThrow("不能确认发布成功")
    expect(emitDatasetSync).not.toHaveBeenCalled()
    vi.mocked(uploadArtifact).mockResolvedValueOnce({ success: true, data: { artifactId: "art_1", url: "/uploads/artifacts/art_1.zip" } as any })
    expect((await uploadStandardPublicationArchive(file, "dataset_1", "规范图件发布测试")).artifactId).toBe("art_1")
    expect(emitDatasetSync).toHaveBeenCalledWith({ datasetId: "dataset_1", reason: "artifact", source: "standard-publication" })
  })

  it("blocks missing targets, local datasets and short publication descriptions before upload", async () => {
    const file = new File(["zip"], "package.zip", { type: "application/zip" })
    await expect(uploadStandardPublicationArchive(file, "", "规范图件发布测试")).rejects.toThrow("目标数据集")
    await expect(uploadStandardPublicationArchive(file, "local_ds_1", "规范图件发布测试")).rejects.toThrow("临时")
    await expect(uploadStandardPublicationArchive(file, "dataset_1", "a")).rejects.toThrow("至少需要")
    expect(uploadArtifact).not.toHaveBeenCalled()
  })
})
