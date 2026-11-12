import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { point, featureCollection } from "@turf/turf"
import { businessResult } from "./business-map-data"
import { renderTemplateDocument } from "./template-renderer"
import { cartographySnapshot } from "./cartography-state"
import { BUSINESS_INPUT_CONTRACT, publicationCapabilityIssue, prepareBusinessPublication, submitPublicationInput } from "./publication-input"
import { uploadArtifact } from "../dataset-repository/services/eoapi-artifacts"
import { createJob } from "../dataset-repository/services/eoapi-thematics"
import { verifyRepositoryFile } from "./publication-repository"
import type { ThematicTemplate } from "../dataset-repository/types/eoapi-types"

vi.mock("../dataset-repository/services/eoapi-artifacts", () => ({ uploadArtifact: vi.fn() }))
vi.mock("../dataset-repository/services/eoapi-thematics", () => ({ createJob: vi.fn() }))
vi.mock("./publication-repository", () => ({ verifyRepositoryFile: vi.fn() }))
const template: ThematicTemplate = { templateId: "graduated-symbol", templateVersion: "2", name: "后台声明的业务渲染器", inputContracts: [BUSINESS_INPUT_CONTRACT], parameters: [], createdAt: 1 }
const options = { outputFormat: "png" as const, publish: { type: "xyz" as const, description: "独立单元测试发布" } }
async function fixture() {
  // Isolated assertions, never a public or operational data source.
  const document = { ...featureCollection([point([104, 26], { value: 12 })]), metadata: { source: "QA isolated assertions", unit: "人", revisionId: "source-revision-9" } }
  const bounds = { west: 103, east: 105, south: 25, north: 27 }
  return businessResult(document, renderTemplateDocument("graduated-symbol", document, bounds), bounds, { field: "value" })
}
const readText = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(file) })
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("crypto", webcrypto)
  vi.mocked(uploadArtifact).mockResolvedValue({ success: true, data: { artifactId: "remote-input-1", url: "/uploads/input.json" } as any })
  vi.mocked(createJob).mockImplementation(async params => ({ success: true, data: { ...params, jobId: "server-job-1", status: "queued" } as any }))
  vi.mocked(verifyRepositoryFile).mockResolvedValue({} as any)
})
afterEach(() => vi.unstubAllGlobals())

describe("source-bound publication inputs", () => {
  it("never publishes pending reference data as an operational result", async () => {
    const result = await fixture()
    result.document.metadata.referenceOnly = true
    await expect(prepareBusinessPublication(result, "dataset-a", template, cartographySnapshot())).rejects.toThrow("参考数据")
    expect(uploadArtifact).not.toHaveBeenCalled(); expect(createJob).not.toHaveBeenCalled()
  })
  it("requires an explicit server protocol, never a matching name, ordinary parameter or local template", async () => {
    const unsupported = { ...template, inputContracts: undefined }
    expect(publicationCapabilityIssue(unsupported, BUSINESS_INPUT_CONTRACT)).toContain("尚未声明")
    await expect(prepareBusinessPublication(await fixture(), "dataset-a", unsupported, cartographySnapshot())).rejects.toThrow("尚未声明")
    expect(publicationCapabilityIssue({ ...template, templateId: "local_mock_template" }, BUSINESS_INPUT_CONTRACT)).toContain("尚未声明")
    expect(uploadArtifact).not.toHaveBeenCalled(); expect(createJob).not.toHaveBeenCalled()
  })
  it("detaches source coordinates, values, scene, extent, rendering and revision into one fingerprinted input", async () => {
    const result = await fixture()
    const prepared = await prepareBusinessPublication(result, "dataset-a", template, cartographySnapshot())
    const payload = JSON.parse(await readText(prepared.file))
    expect(payload).toMatchObject({ datasetId: "dataset-a", revisionId: "source-revision-9", document: result.document, scene: result.scene, bounds: result.bounds, options: result.options, cartography: cartographySnapshot() })
    result.document.features[0].properties.value = 99
    expect(payload.document.features[0].properties.value).toBe(12)
    await expect(prepareBusinessPublication(result, "dataset-a", template, cartographySnapshot())).rejects.toThrow("指纹不一致")
  })
  it("sends remote dataRefs, exact template and source versions, extent and integrity envelope", async () => {
    const result = await fixture()
    const prepared = await prepareBusinessPublication(result, "dataset-a", template, cartographySnapshot())
    const current = vi.fn()
    await submitPublicationInput(prepared, template, options, current)
    expect(current).toHaveBeenCalledTimes(3)
    expect(verifyRepositoryFile).toHaveBeenCalledWith(prepared.file, "remote-input-1", "dataset-a")
    expect(uploadArtifact).toHaveBeenCalledWith(expect.objectContaining({ file: prepared.file, datasetId: "dataset-a", revisionId: "source-revision-9" }), { localFallback: false })
    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({ dataRefs: ["remote-input-1"], datasetId: "dataset-a", templateVersion: "2", revisionId: "source-revision-9", parameters: { cartographyInput: expect.objectContaining({ bounds: result.bounds, sourceFingerprint: result.fingerprint, fingerprint: prepared.manifest.fingerprint }) } }))
  })
  it("blocks a source or target change during upload before creating a job", async () => {
    const prepared = await prepareBusinessPublication(await fixture(), "dataset-a", template, cartographySnapshot())
    const current = vi.fn().mockImplementationOnce(() => {}).mockImplementation(() => { throw new Error("dataset changed") })
    await expect(submitPublicationInput(prepared, template, options, current)).rejects.toThrow("dataset changed")
    expect(createJob).not.toHaveBeenCalled()
  })
  it("never creates an online job whose stored input cannot be reopened", async () => {
    const prepared = await prepareBusinessPublication(await fixture(), "dataset-a", template, cartographySnapshot())
    vi.mocked(verifyRepositoryFile).mockRejectedValueOnce(new Error("HTTP 404"))
    await expect(submitPublicationInput(prepared, template, options, () => {})).rejects.toThrow("HTTP 404")
    expect(createJob).not.toHaveBeenCalled()
  })
  it("checks for document changes again after remote-file verification", async () => {
    const prepared = await prepareBusinessPublication(await fixture(), "dataset-a", template, cartographySnapshot())
    const current = vi.fn().mockImplementationOnce(() => {}).mockImplementationOnce(() => {}).mockImplementation(() => { throw new Error("source changed during verification") })
    await expect(submitPublicationInput(prepared, template, options, current)).rejects.toThrow("source changed during verification")
    expect(createJob).not.toHaveBeenCalled()
  })
  it("rejects tampered input envelopes before upload", async () => {
    const prepared = await prepareBusinessPublication(await fixture(), "dataset-a", template, cartographySnapshot())
    prepared.manifest.datasetId = "dataset-b"
    await expect(submitPublicationInput(prepared, template, options, () => {})).rejects.toThrow("已变化")
    expect(uploadArtifact).not.toHaveBeenCalled()
  })
  it("does not use local upload fallback or accept a job receipt that ignores the current fingerprint", async () => {
    const prepared = await prepareBusinessPublication(await fixture(), "dataset-a", template, cartographySnapshot())
    vi.mocked(uploadArtifact).mockResolvedValueOnce({ success: true, data: { artifactId: "local_artifact", url: "local://input" } as any })
    await expect(submitPublicationInput(prepared, template, options, () => {})).rejects.toThrow("未确认接收")
    expect(createJob).not.toHaveBeenCalled()
    vi.mocked(createJob).mockResolvedValueOnce({ success: true, data: { jobId: "ignored-job" } as any })
    await expect(submitPublicationInput(prepared, template, options, () => {})).rejects.toThrow("回执未确认")
  })
  it("blocks missing and local target datasets", async () => {
    await expect(prepareBusinessPublication(await fixture(), "", template, cartographySnapshot())).rejects.toThrow("目标数据集")
    await expect(prepareBusinessPublication(await fixture(), "local_dataset", template, cartographySnapshot())).rejects.toThrow("临时")
    expect(uploadArtifact).not.toHaveBeenCalled()
  })
})
