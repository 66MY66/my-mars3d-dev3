import { businessResult, readBusinessDocument, type BusinessMapResult } from "./business-map-data"
import { standardBounds } from "./dbt116-standard"
import { createStandardPublicationArchive } from "./standard-publication-delivery"
import { uploadArtifact } from "../dataset-repository/services/eoapi-artifacts"
import { createJob } from "../dataset-repository/services/eoapi-thematics"
import type { CartographySnapshot } from "./cartography-layout"
import type { StandardPublicationBundle } from "./standard-publication"
import type { CreateJobParams, ThematicTemplate } from "../dataset-repository/types/eoapi-types"
import type { GeoBounds } from "./earthquake-analysis"
import { verifyRepositoryFile } from "./publication-repository"

// Proposed input protocols. A backend must explicitly advertise and implement these before use.
export const BUSINESS_INPUT_CONTRACT = "mars3d.business-map.v1"
export const STANDARD_INPUT_CONTRACT = "mars3d.standard-map.v1"
export type PublicationManifest = {
  contract: string; datasetId: string; revisionId?: string; templateId: string; templateVersion: string
  bounds: GeoBounds; sourceFingerprint: string; dataSha256: string; fingerprint: string
}
export type PublicationInput = { manifest: PublicationManifest; file: File }

async function digest(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")
}
const jsonHash = (value: unknown) => digest(new TextEncoder().encode(JSON.stringify(value)))
async function fileBytes(file: File): Promise<Uint8Array> {
  if (file.arrayBuffer) { return new Uint8Array(await file.arrayBuffer()) }
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer)); reader.onerror = reject; reader.readAsArrayBuffer(file)
  })
}
function dataset(value: string): string {
  const id = value.trim()
  if (!id || /^local[_:-]/i.test(id)) { throw new Error("请选择成果库中的目标数据集，不能使用本地临时数据集") }
  return id
}
export function publicationCapabilityIssue(template: ThematicTemplate | undefined, contract: string): string {
  if (!template || !template.templateVersion || /^local[_:-]/i.test(template.templateId) || !template.inputContracts?.includes(contract)) {
    return `后台尚未声明支持当前图件数据协议 ${contract}，不能用空任务或同名模板代替发布。需后台接口联调。`
  }
  return ""
}
async function input(file: File, manifest: Omit<PublicationManifest, "dataSha256" | "fingerprint">): Promise<PublicationInput> {
  const dataSha256 = await digest(await fileBytes(file))
  const detached = JSON.parse(JSON.stringify({ ...manifest, dataSha256 }))
  return { file, manifest: { ...detached, fingerprint: await jsonHash(detached) } }
}
export async function prepareBusinessPublication(result: BusinessMapResult, datasetId: string, template: ThematicTemplate, cartography: CartographySnapshot): Promise<PublicationInput> {
  datasetId = dataset(datasetId)
  const issue = publicationCapabilityIssue(template, BUSINESS_INPUT_CONTRACT)
  if (issue) { throw new Error(issue) }
  readBusinessDocument(result.document)
  if (result.document.metadata.referenceOnly || result.document.metadata.usage === "reference") { throw new Error("当前为来源或精度待核验的参考数据，不能作为正式业务成果在线发布") }
  const snapshot = await businessResult(result.document, result.scene, result.bounds, result.options)
  if (snapshot.fingerprint !== result.fingerprint) { throw new Error("当前业务数据与已绘制图件指纹不一致，请重新应用模板") }
  const revisionId = typeof snapshot.document.metadata.revisionId === "string" ? snapshot.document.metadata.revisionId : undefined
  const payload = { contract: BUSINESS_INPUT_CONTRACT, datasetId, revisionId, templateId: template.templateId, templateVersion: template.templateVersion, ...snapshot, cartography }
  const file = new File([JSON.stringify(payload)], "business-map-input.json", { type: "application/json" })
  return input(file, { contract: BUSINESS_INPUT_CONTRACT, datasetId, revisionId, templateId: template.templateId, templateVersion: template.templateVersion, bounds: snapshot.bounds, sourceFingerprint: snapshot.fingerprint })
}
export async function prepareStandardOnlinePublication(bundle: StandardPublicationBundle, datasetId: string, template: ThematicTemplate): Promise<PublicationInput> {
  datasetId = dataset(datasetId)
  const issue = publicationCapabilityIssue(template, STANDARD_INPUT_CONTRACT)
  if (issue) { throw new Error(issue) }
  const bounds = standardBounds(bundle.document, bundle.templateId)
  if (!bounds) { throw new Error("缺少经过核验的制图范围") }
  const file = await createStandardPublicationArchive(bundle)
  return input(file, { contract: STANDARD_INPUT_CONTRACT, datasetId, templateId: template.templateId, templateVersion: template.templateVersion, bounds, sourceFingerprint: bundle.review.dataSha256 })
}

export async function submitPublicationInput(prepared: PublicationInput, template: ThematicTemplate, options: Pick<CreateJobParams, "outputFormat" | "parameters" | "publish">, assertCurrent: () => void) {
  const manifest = prepared.manifest
  const issue = publicationCapabilityIssue(template, manifest.contract)
  if (issue) { throw new Error(issue) }
  const { fingerprint, ...identity } = manifest
  dataset(manifest.datasetId)
  if (await jsonHash(identity) !== fingerprint || await digest(await fileBytes(prepared.file)) !== manifest.dataSha256 ||
      template.templateId !== manifest.templateId || template.templateVersion !== manifest.templateVersion) {
    throw new Error("发布输入或服务模板版本已变化，请重新准备")
  }
  assertCurrent()
  const receipt = await uploadArtifact({ file: prepared.file, name: prepared.file.name, type: "data", datasetId: manifest.datasetId, revisionId: manifest.revisionId, description: options.publish?.description }, { localFallback: false })
  const artifact = receipt.data
  if (!receipt.success || !artifact?.artifactId || /^local[_:-]/i.test(artifact.artifactId) || !/^(https?:\/\/|\/(?!\/))/.test(artifact.url || "")) {
    throw new Error(receipt.message || "后台未确认接收当前图件数据包，未创建发布任务")
  }
  // A change during upload may leave an unused artifact, but must never create a stale job.
  assertCurrent()
  await verifyRepositoryFile(prepared.file, artifact.artifactId, manifest.datasetId)
  assertCurrent()
  const binding = { ...manifest, artifactId: artifact.artifactId, url: artifact.url }
  const result = await createJob({
    ...options,
templateId: manifest.templateId,
templateVersion: manifest.templateVersion,
datasetId: manifest.datasetId,
    revisionId: manifest.revisionId,
dataRefs: [artifact.artifactId],
parameters: { ...options.parameters, cartographyInput: binding },
    publish: options.publish ? { ...options.publish, metadata: { ...options.publish.metadata, cartographyInput: binding } } : undefined
  })
  const job = result.data
  if (!result.success || !job) { throw new Error(result.message || "后台未确认创建任务") }
  if (!job.jobId || /^local[_:-]/i.test(job.jobId) || job.datasetId !== manifest.datasetId || job.templateId !== manifest.templateId || job.templateVersion !== manifest.templateVersion || job.parameters?.cartographyInput?.fingerprint !== fingerprint) {
    throw new Error(`后台回执未确认当前数据指纹，不能确认绑定成功。任务编号：${job.jobId || "未返回"}，请联系后台核查，勿重复提交。`)
  }
  return result
}
