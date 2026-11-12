import { afterEach, describe, expect, it, vi } from "vitest"
import { emptyDbtDocument, readDbtDocument, inspectDbtDocument } from "./dbt116-standard"
import { BACKEND_STANDARD_CONTRACT, DRAFT_RULESET, loadBackendStandardDocument, findBackendStandardDocuments, revalidateBackendDocument } from "./backend-standard-document"
import { backendDocumentIssue } from "./backend-document-binding"
import type { RemoteItem } from "./remote-cartography-source"

const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
async function source() {
  const document = { ...emptyDbtDocument(), usage: "operational" }
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(document)))), b => b.toString(16).padStart(2, "0")).join("")
  const item: RemoteItem = { type: "Feature", collection: "thematic-map", id: "approved-event", bbox: [100, 20, 110, 30], properties: { "cartography:contract": BACKEND_STANDARD_CONTRACT, "cartography:status": "approved", "cartography:template": "T30102000", "cartography:revision": "r1", "cartography:document_sha256": hash }, assets: { document: { href: "http://192.168.10.15:9002/rs-products/approved/document.json" } } }
  const bundle = { contract: BACKEND_STANDARD_CONTRACT, templateId: "T30102000", ruleset: DRAFT_RULESET, revision: "r1", approval: { status: "approved", id: "review-1", reviewer: "业务复核人", authority: "业务审核机构", reviewedAt: "2026-10-30T08:00:00Z" }, documentSha256: hash, document }
  return { item, bundle }
}
const signal = () => new AbortController().signal
afterEach(() => vi.unstubAllGlobals())
describe("backend approved document contract", () => {
  it("binds a fetched backend revision, but never treats a record as complete just because it was approved", async () => {
    const { item, bundle } = await source()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(item)).mockResolvedValueOnce(response(bundle)))
    const doc = await loadBackendStandardDocument(item, "T30102000", signal())
    expect(doc.usage).toBe("operational"); expect(doc.backendDocument?.approvalId).toBe("review-1")
    expect(backendDocumentIssue(doc)).toBe("")
    expect(() => readDbtDocument(JSON.parse(JSON.stringify(doc)))).not.toThrow()
    expect(inspectDbtDocument(doc, "T30102000").some(issue => issue.message.includes("正式震情"))).toBe(true)
    doc.agency = "制图单位"; doc.description = "图件说明"
    expect(backendDocumentIssue(doc)).toBe("")
    doc.event.magnitude = 6.8
    expect(backendDocumentIssue(doc)).toContain("失效")
    expect(() => readDbtDocument(doc)).toThrow("失效")
  })
  it("rejects metadata only approvals and old cached approval receipts", async () => {
    const { item, bundle } = await source()
    bundle.approval.reviewedAt = "2026-10-30T08:00:00"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(item)).mockResolvedValueOnce(response(bundle)))
    await expect(loadBackendStandardDocument(item, "T30102000", signal())).rejects.toThrow("审核时间")
    expect(() => readDbtDocument({ ...emptyDbtDocument(), backendDocument: { receipt: "cached-not-fetched" } })).toThrow("重新读取")
  })
  it("detects mismatched backend hashes and rulesets", async () => {
    const { item, bundle } = await source()
    bundle.documentSha256 = "0".repeat(64)
    const fetcher = vi.fn().mockResolvedValueOnce(response(item)).mockResolvedValueOnce(response(bundle)); vi.stubGlobal("fetch", fetcher)
    await expect(loadBackendStandardDocument(item, "T30102000", signal())).rejects.toThrow("指纹")
    bundle.ruleset = "unknown-standard"
    fetcher.mockResolvedValueOnce(response(item)).mockResolvedValueOnce(response(bundle))
    await expect(loadBackendStandardDocument(item, "T30102000", signal())).rejects.toThrow("规则版本")
  })
  it("uses declared approval rather than source-system names and rejects external files or reference-only documents", async () => {
    const { item, bundle } = await source()
    item.properties["result:source_system"] = "演示批量导入"
    const fetcher = vi.fn().mockResolvedValueOnce(response(item)).mockResolvedValueOnce(response(bundle)); vi.stubGlobal("fetch", fetcher)
    await expect(loadBackendStandardDocument(item, "T30102000", signal())).resolves.toHaveProperty("backendDocument")
    delete item.properties["result:source_system"]; item.assets.document.href = "https://other.test/document.json"
    fetcher.mockResolvedValueOnce(response(item))
    await expect(loadBackendStandardDocument(item, "T30102000", signal())).rejects.toThrow("受控")
    item.assets.document.href = "http://192.168.10.15:9002/rs-products/approved/document.json"
    ;(bundle.document as any).layers = [{ onlineSource: {} }]
    fetcher.mockResolvedValueOnce(response(item)).mockResolvedValueOnce(response(bundle))
    await expect(loadBackendStandardDocument(item, "T30102000", signal())).rejects.toThrow("参考图层")
  })
  it("re-reads approval before export and rejects revoked or changed backend revisions", async () => {
    const { item, bundle } = await source()
    const fetcher = vi.fn().mockResolvedValueOnce(response(item)).mockResolvedValueOnce(response(bundle)); vi.stubGlobal("fetch", fetcher)
    const doc = await loadBackendStandardDocument(item, "T30102000", signal())
    fetcher.mockResolvedValueOnce(response({ ...item, properties: { ...item.properties, "cartography:status": "revoked" } }))
    await expect(revalidateBackendDocument(doc, "T30102000", signal())).rejects.toThrow("尚未审核")
    item.properties["cartography:revision"] = "r2"; bundle.revision = "r2"
    fetcher.mockResolvedValueOnce(response(item)).mockResolvedValueOnce(response(bundle))
    await expect(revalidateBackendDocument(doc, "T30102000", signal())).rejects.toThrow("版本已变化")
    doc.backendDocument!.revision = "r2"
    expect(backendDocumentIssue(doc)).toContain("失效")
  })
  it("only advertises approved packages for the exact template, without manufacturing data when none are returned", async () => {
    const { item } = await source()
    const fetcher = vi.fn().mockResolvedValue(response({ type: "FeatureCollection", features: [item, { ...item, id: "other", properties: { ...item.properties, "cartography:template": "T30103000" } }] })); vi.stubGlobal("fetch", fetcher)
    const result = await findBackendStandardDocuments("T30102000", null, signal())
    expect(result.items.map(item => item.id)).toEqual(["approved-event"])
    expect(JSON.parse(fetcher.mock.calls[0][1].body).query["cartography:status"].eq).toBe("approved")
  })
})
