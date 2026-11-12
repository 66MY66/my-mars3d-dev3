import type { DbtDocument } from "./dbt116-standard"

export type BackendDocumentBinding = { receipt: string; collection: string; itemId: string; asset: string; revision: string; documentSha256: string; approvalId: string; authority: string; reviewer: string; reviewedAt: string }
const receipts = new Map<string, string>()

// Bind business facts, not editable production notes. Cached JSON alone is never an approval.
function businessIdentity(doc: DbtDocument) {
  return JSON.stringify({ crs: doc.crs, usage: doc.usage, reference: doc.reference, event: doc.event, region: doc.region, layers: doc.layers, assessment: doc.assessment || {}, classification: doc.classification, crsEvidence: doc.crsEvidence })
}
export function bindBackendDocument(doc: DbtDocument, source: Omit<BackendDocumentBinding, "receipt">) {
  const receipt = crypto.randomUUID()
  const binding = JSON.stringify({ source, business: businessIdentity(doc) })
  if (binding.length > 25_000_000) { throw new Error("审核数据绑定超过交互内存上限，请拆分图幅") }
  receipts.set(receipt, binding)
  while (receipts.size > 20 || [...receipts.values()].reduce((sum, value) => sum + value.length, 0) > 50_000_000) { receipts.delete(receipts.keys().next().value!) }
  doc.backendDocument = { ...source, receipt }
  return doc
}
export function backendDocumentIssue(doc: DbtDocument): string {
  if (!doc.backendDocument) { return "" }
  const { receipt, ...source } = doc.backendDocument
  return receipts.get(receipt) === JSON.stringify({ source, business: businessIdentity(doc) }) ? "" : "后台数据审核绑定已失效；数据已变化或来自旧缓存，请重新读取后台审核数据包"
}
