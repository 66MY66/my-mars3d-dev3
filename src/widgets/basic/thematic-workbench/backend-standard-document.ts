import { readDbtDocument, dbtTemplates, type DbtDocument, type DbtTemplateId } from "./dbt116-standard"
import { bindBackendDocument, backendDocumentIssue } from "./backend-document-binding"
import { searchStacPage, refreshRemoteItem, remoteProxyUrl, type RemoteItem } from "./remote-cartography-source"
import { validThematicFile } from "./thematic-services"
import type { RectInfo } from "./map"
import { CARTOGRAPHY_RULESET } from "./cartography-standards"

export const BACKEND_STANDARD_CONTRACT = "mars3d.standard-document.v1"
export const DRAFT_RULESET = CARTOGRAPHY_RULESET.id
async function json(url: string, init: RequestInit, signal: AbortSignal) {
  const response = await fetch(url, { ...init, credentials: "omit", cache: "no-store", signal })
  if (!response.ok) { throw new Error(`后台审核数据读取失败（HTTP ${response.status}）`) }
  const text = await response.text()
  if (new TextEncoder().encode(text).length > 25_000_000) { throw new Error("后台审核数据包过大，请按图幅拆分") }
  signal.throwIfAborted()
  return JSON.parse(text)
}
export function standardDocumentItem(item: RemoteItem, id: DbtTemplateId) {
  const p = item.properties
  return p["cartography:contract"] === BACKEND_STANDARD_CONTRACT && p["cartography:template"] === id && p["cartography:status"] === "approved"
}
export async function findBackendStandardDocuments(id: DbtTemplateId, bounds: RectInfo | null, signal: AbortSignal, token?: string) {
  if (!dbtTemplates.some(t => t.id === id)) { throw new Error("未知正式专题类型") }
  const body = { limit: 50, ...(bounds ? { bbox: [bounds.west, bounds.south, bounds.east, bounds.north] } : {}), query: { "cartography:contract": { eq: BACKEND_STANDARD_CONTRACT }, "cartography:template": { eq: id }, "cartography:status": { eq: "approved" } } }
  const result = await searchStacPage(body, signal, token)
  return { ...result, items: result.items.filter(item => standardDocumentItem(item, id)) }
}
export async function loadBackendStandardDocument(candidate: RemoteItem, id: DbtTemplateId, signal: AbortSignal): Promise<DbtDocument> {
  const item = await refreshRemoteItem(candidate, signal)
  if (!standardDocumentItem(item, id)) { throw new Error("后台数据尚未审核或专题用途不符，不能进入正式制图") }
  const asset = item.assets.document
  if (!asset || !validThematicFile(asset.href) || !/\.json$/i.test(new URL(asset.href).pathname)) { throw new Error("后台未提供受控 JSON document 资产") }
  const raw = await json(remoteProxyUrl("files", asset.href), {}, signal)
  if (raw.contract !== BACKEND_STANDARD_CONTRACT || raw.templateId !== id || raw.ruleset !== DRAFT_RULESET || raw.revision !== item.properties["cartography:revision"] || typeof raw.revision !== "string" || !raw.revision.trim()) { throw new Error("后台图件协议、模板、规则版本或修订身份不匹配") }
  const approval = raw.approval
  if (approval?.status !== "approved" || [approval.id, approval.reviewer, approval.authority].some(v => typeof v !== "string" || !v.trim()) || typeof approval.reviewedAt !== "string" || !/(Z|[+-]\d\d:\d\d)$/.test(approval.reviewedAt) || !Number.isFinite(Date.parse(approval.reviewedAt))) { throw new Error("缺少后台审核机构、审核人、审核记录及带时区审核时间") }
  if (raw.document?.usage !== "operational" || raw.document.backendDocument || raw.document.layers?.some((layer: any) => layer.onlineSource || layer.sourceGrid || layer.sourceReference)) { throw new Error("后台包必须交付正式业务数据，不能把现有参考图层改写用途后送审") }
  if (raw.document.layers?.some((layer: any) => layer.grid)) { throw new Error("审核协议 v1 需要矢量统计单元或后台图像资产；原值栅格须另接正式 COG 与统计契约，不能静默跳过地图叠加") }
  const sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(raw.document)))), b => b.toString(16).padStart(2, "0")).join("")
  if (sha !== raw.documentSha256 || sha !== item.properties["cartography:document_sha256"]) { throw new Error("后台文档、目录与审核数据指纹不一致") }
  const doc = readDbtDocument(raw.document)
  if (!doc.classification) { throw new Error("后台图件缺少专题实例及空间范围代码") }
  for (const layer of doc.layers) { if (!layer.coverage && layer.raster) { layer.coverage = { ...layer.raster.bounds } } }
  signal.throwIfAborted()
  return bindBackendDocument(doc, { collection: item.collection, itemId: item.id, asset: "document", revision: raw.revision, documentSha256: sha, approvalId: approval.id, authority: approval.authority, reviewer: approval.reviewer, reviewedAt: approval.reviewedAt })
}
export async function revalidateBackendDocument(doc: DbtDocument, id: DbtTemplateId, signal: AbortSignal) {
  const issue = backendDocumentIssue(doc)
  if (issue) { throw new Error(issue) }
  const source = doc.backendDocument
  if (!source) { throw new Error("生产图件必须绑定后台审核数据包") }
  const current = await loadBackendStandardDocument({ collection: source.collection, id: source.itemId } as RemoteItem, id, signal)
  if (["documentSha256", "approvalId", "revision", "authority", "reviewer", "reviewedAt"].some(key => current.backendDocument![key as keyof typeof source] !== source[key as keyof typeof source])) { throw new Error("后台数据或审核版本已变化，请重新绑定并复核，未输出旧图件") }
}
