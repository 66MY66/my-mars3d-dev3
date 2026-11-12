import { eoapiGet, eoapiPost } from "../dataset-repository/services/eoapi-client"
import { eoApiConfig } from "../dataset-repository/services/eoapi-config"

export type RepositoryPublicationStatus = { datasetId: string; status: "private" | "reviewing" | "published"; rejectionReason?: string | null }
const identifier = (value: string) => {
  if (!value.trim() || /^local[_:-]/i.test(value) || /[/?#\\]/.test(value)) { throw new Error("需要真实成果库标识，不能使用本地临时记录") }
  return encodeURIComponent(value)
}
export function repositoryDownloadUrl(value: string): string {
  const base = eoApiConfig.apiPrefix.replace(/\/+$/, "")
  const url = new URL(value, window.location.origin)
  if (url.username || url.password || url.hash || ![window.location.origin, "http://192.168.10.15:5960"].includes(url.origin)) { throw new Error("成果下载地址不属于已核验的成果库，未读取外部文件") }
  let path = url.pathname
  if (path.startsWith(`${base}/`)) { path = path.slice(base.length) }
  if (!/^\/uploads\/artifacts\/[A-Za-z0-9_.-]+$/.test(path)) { throw new Error("成果库未返回受控的图件文件地址") }
  return `${base}${path}${url.search}`
}
async function digest(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("")
}
async function bytes(file: File): Promise<ArrayBuffer> {
  if (file.arrayBuffer) { return file.arrayBuffer() }
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(file)
  })
}
export async function verifyRepositoryFile(file: File, artifactId: string, datasetId: string) {
  const id = identifier(artifactId)
  identifier(datasetId)
  const record = await eoapiGet<{ artifactId: string; name: string; url: string; size?: number | null }>(`/artifacts/${id}`)
  if (!record.success || record.data?.artifactId !== artifactId) { throw new Error("未能从后台重新读取匹配的成果记录，尚未确认文件入库完整") }
  if (record.data.size != null && record.data.size !== file.size) { throw new Error("后台成果大小与提交文件不一致") }
  let linked = false
  for (let offset = 0; offset < 10000; offset += 200) {
    const page = await eoapiGet<Array<{ artifactId: string }>>("/artifacts", { params: { datasetId, limit: 200, offset } })
    if (!page.success || !Array.isArray(page.data)) { throw new Error("无法核验成果与目标数据集的实际关联") }
    if (page.data.some(row => row.artifactId === artifactId)) { linked = true; break }
    if (page.data.length < 200) { break }
  }
  if (!linked) { throw new Error("未能确认该文件已关联至目标数据集，不可为错误的数据集申请公开") }
  const receipt = await eoapiGet<{ downloadUrl: string }>(`/artifacts/${id}/download`)
  if (!receipt.success || !receipt.data?.downloadUrl) { throw new Error("成果记录存在，但后台未返回可读取的下载地址") }
  const url = repositoryDownloadUrl(receipt.data.downloadUrl)
  const response = await fetch(url, { credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(30000) })
  if (!response.ok) { throw new Error(`成果记录已入库，但文件读取失败（HTTP ${response.status}）；不能认定发布完成，请后台修复文件存储或下载路由`) }
  if (Number(response.headers.get("content-length")) > file.size) { await response.body?.cancel(); throw new Error("后台下载文件大小与当前图件不一致") }
  const reader = response.body?.getReader()
  if (!reader) { throw new Error("后台未返回成果文件内容") }
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) { break }
      size += next.value.byteLength
      if (size > file.size) { await reader.cancel(); throw new Error("后台下载文件超过提交大小，已停止读取") }
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  const remote = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { remote.set(chunk, offset); offset += chunk.byteLength }
  if (remote.byteLength !== file.size) { throw new Error("下载文件不完整或不是当前提交的图件") }
  const [expected, actual] = [await digest(await bytes(file)), await digest(remote.buffer)]
  if (expected !== actual) { throw new Error("后台文件指纹与当前图件不一致，未确认发布完成") }
  return { artifactId, url, sha256: actual, verifiedAt: new Date().toISOString(), file: new File([remote], file.name, { type: file.type }) }
}
export async function getRepositoryPublicationStatus(datasetId: string): Promise<RepositoryPublicationStatus> {
  const result = await eoapiGet<RepositoryPublicationStatus>(`/datasets/${identifier(datasetId)}/publish-status`)
  if (!result.success || result.data?.datasetId !== datasetId || !["private", "reviewing", "published"].includes(result.data.status)) { throw new Error("后台未返回有效的发布审核状态，不能认定已公开发布") }
  return result.data
}
export async function requestRepositoryPublication(datasetId: string) {
  const current = await getRepositoryPublicationStatus(datasetId)
  if (current.status !== "private") { return current }
  const result = await eoapiPost<{ success: boolean }>(`/datasets/${identifier(datasetId)}/publish-request`, {})
  if (!result.success || result.data?.success !== true) { throw new Error(result.message || "后台未确认接收发布申请") }
  return getRepositoryPublicationStatus(datasetId)
}
