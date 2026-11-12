import JSZip from "jszip"
import { uploadArtifact } from "../dataset-repository/services/eoapi-artifacts"
import { emitDatasetSync } from "../dataset-repository/services/dataset-sync"
import { isPublishDescriptionValid, PUBLISH_DESCRIPTION_ERROR } from "../dataset-repository/services/publish-description"
import { dbtReviewClauses, inspectDbtDocument } from "./dbt116-standard"
import type { StandardPublicationBundle } from "./standard-publication"

async function sha256(data: BufferSource): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")
}

export async function createStandardPublicationArchive(bundle: StandardPublicationBundle): Promise<File> {
  const review = bundle.review
  if (bundle.document.usage !== "operational" || review.usage !== "operational" || !review.formalExportEnabled ||
      review.template !== bundle.templateId || review.code !== bundle.code || review.issues.some(issue => issue.severity === "error") ||
      inspectDbtDocument(bundle.document, bundle.templateId).some(issue => issue.severity === "error") ||
      !review.reviewer.trim() || !review.evidence.trim() ||
      !dbtReviewClauses.every(clause => review.review.some(item => item.clause === clause.clause && item.confirmed))) {
    throw new Error("图件未通过完整的正式出图检查，不能生成正式发布包")
  }
  if (![300, 450, 600].includes(bundle.dpi) || !["pdf", "jpg"].includes(bundle.format) ||
      bundle.file.type !== (bundle.format === "pdf" ? "application/pdf" : "image/jpeg") || !bundle.file.size) {
    throw new Error("图件格式或分辨率无效")
  }
  const documentJson = JSON.stringify(bundle.document)
  if (await sha256(new TextEncoder().encode(documentJson)) !== review.dataSha256) {
    throw new Error("制图数据与复核记录指纹不一致，请重新检查")
  }
  const bytes = await bundle.file.arrayBuffer()
  const mapName = `${bundle.code}.${bundle.format}`
  const zip = new JSZip()
  zip.file(mapName, new Uint8Array(bytes))
  zip.file("document.json", documentJson)
  zip.file("review.json", JSON.stringify(review, null, 2))
  zip.file("manifest.json", JSON.stringify({
    version: 1,
    templateId: bundle.templateId,
    code: bundle.code,
    title: bundle.title,
    format: bundle.format,
    dpi: bundle.dpi,
    usage: "operational",
    dataSha256: review.dataSha256,
    map: { file: mapName, bytes: bytes.byteLength, sha256: await sha256(bytes) }
  }, null, 2))
  const archive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })
  return new File([archive], `${bundle.code}-发布包.zip`, { type: "application/zip" })
}

export async function uploadStandardPublicationArchive(file: File, datasetId: string, description: string) {
  if (!datasetId.trim() || /^local[_:-]/i.test(datasetId.trim())) { throw new Error("请选择成果库中的目标数据集，不能使用本地临时数据集") }
  if (!isPublishDescriptionValid(description)) { throw new Error(PUBLISH_DESCRIPTION_ERROR) }
  const result = await uploadArtifact({
    file, name: file.name, type: "export", datasetId: datasetId.trim(), description: description.trim()
  }, { localFallback: false })
  if (!result.success || !result.data) { throw new Error(result.message || "成果库未确认上传，请检查单位内网或 VPN 后重试") }
  const artifact = result.data
  if (!artifact.artifactId || /^local[_:-]/i.test(artifact.artifactId) || !/^(https?:\/\/|\/(?!\/))/.test(artifact.url || "")) {
    throw new Error("成果库未返回有效的远程成果记录，不能确认发布成功")
  }
  emitDatasetSync({ datasetId: datasetId.trim(), reason: "artifact", source: "standard-publication" })
  return artifact
}
