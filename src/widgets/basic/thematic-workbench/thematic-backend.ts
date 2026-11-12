import { thematicFlows, flowPath, flowWorkspace, flowWrites, validThematicFile, type ThematicFlowId } from "./thematic-services"
import { remoteProxyUrl, searchStacPage, type RemoteItem } from "./remote-cartography-source"
import type { FlowSchema } from "./flow-parameters"
import type { RectInfo } from "./map"

const flowRoute = "/api/thematic/flow"
export type FlowDefinition = { path: string; summary: string; schema?: FlowSchema }
async function read(url: string, init: RequestInit = {}, signal?: AbortSignal) {
  const controller = new AbortController(); const abort = () => controller.abort()
  signal?.throwIfAborted(); signal?.addEventListener("abort", abort, { once: true })
  const timer = setTimeout(abort, 20000)
  try {
    const response = await fetch(url, { ...init, credentials: "omit", cache: "no-store", signal: controller.signal })
    if (!response.ok) { throw new Error(response.status === 401 || response.status === 403 ? "后台未授权或权限不足，请重新授权" : `后台请求失败（HTTP ${response.status}）`) }
    const text = await response.text()
    if (text.length > 4_000_000) { throw new Error("后台结果过大，请缩小范围") }
    controller.signal.throwIfAborted()
    return text
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort) }
}
function authorization(token: string) {
  if (!token.trim() || /[\r\n]/.test(token)) { throw new Error("请先提供有效的 Windmill 授权") }
  return { Authorization: `Bearer ${token.trim()}` }
}
export async function loginThematicFlow(email: string, password: string, signal?: AbortSignal) {
  if (!email.trim() || !password) { throw new Error("请填写 Windmill 账号和密码") }
  return read(`${flowRoute}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) }, signal)
}
export async function getThematicFlow(token: string, id: ThematicFlowId, signal?: AbortSignal): Promise<FlowDefinition> {
  const path = flowPath(id)
  const result = JSON.parse(await read(`${flowRoute}${flowWorkspace}/flows/get/${path}`, { headers: authorization(token) }, signal))
  if (result.path !== path || typeof result.summary !== "string") { throw new Error("后台流程身份不匹配") }
  return { path, summary: result.summary, schema: result.schema }
}
export async function runThematicFlow(token: string, id: ThematicFlowId, args: Record<string, unknown>, confirmed: boolean, signal?: AbortSignal) {
  if (!args || Array.isArray(args) || typeof args !== "object" || JSON.stringify(args).length > 256000) { throw new Error("流程参数需要不超过 256 KB 的 JSON 对象") }
  if (flowWrites(id, args) && !confirmed) { throw new Error("该流程会生产或写入后台数据，须明确确认后提交") }
  const result = await read(`${flowRoute}${flowWorkspace}/jobs/run/f/${flowPath(id)}`, { method: "POST", headers: { ...authorization(token), "Content-Type": "application/json" }, body: JSON.stringify(args) }, signal)
  let jobId = result.trim()
  try { jobId = JSON.parse(jobId) } catch { /* Windmill may return a plain UUID. */ }
  if (typeof jobId !== "string" || !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(jobId)) { throw new Error("后台未返回有效任务号，未标记为提交成功") }
  return jobId
}
export async function getThematicJob(token: string, jobId: string, signal?: AbortSignal) {
  if (!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(jobId)) { throw new Error("无效的后台任务号") }
  const headers = authorization(token)
  const status = JSON.parse(await read(`${flowRoute}${flowWorkspace}/jobs_u/get/${jobId}`, { headers }, signal))
  if (status.id && status.id !== jobId) { throw new Error("后台任务身份不匹配") }
  if (status.type !== "CompletedJob" && !status.completed_at && status.success === undefined) { return { state: "running" as const, status, result: null } }
  const completed = JSON.parse(await read(`${flowRoute}${flowWorkspace}/jobs_u/completed/get_result_maybe/${jobId}`, { headers }, signal))
  if (!completed.completed) { return { state: "running" as const, status, result: null } }
  return { state: completed.success ? "succeeded" as const : "failed" as const, status, result: completed.result }
}
export async function inspectThematicFlows(token: string, signal?: AbortSignal) {
  const results: Array<{ id: ThematicFlowId; definition?: FlowDefinition; error?: string }> = []
  for (const flow of thematicFlows) {
    signal?.throwIfAborted()
    try { results.push({ id: flow.id, definition: await getThematicFlow(token, flow.id, signal) }) } catch (error) { signal?.throwIfAborted(); results.push({ id: flow.id, error: error instanceof Error ? error.message : "接口验证失败" }) }
  }
  return results
}
export async function checkThematicServices(signal?: AbortSignal) {
  const endpoints = [
    ["STAC 目录", "/api/thematic/stac/collections?limit=1", "GET"],
    ["目录浏览入口", "/api/thematic/catalog-health/", "HEAD"],
    ["TiTiler-PgSTAC", "/api/thematic/tiles/healthz", "GET"],
    ["COG 直读", "/api/thematic/cog/healthz", "GET"],
    ["Windmill 服务", `${flowRoute}/api/version`, "GET"]
  ]
  const results: Array<{ name: string; ok: boolean; detail: string }> = []
  for (const [name, url, method] of endpoints) {
    signal?.throwIfAborted()
    try { await read(url, { method }, signal); results.push({ name, ok: true, detail: name === "Windmill 服务" ? "服务可达，流程权限另行验证" : "服务响应正常，业务数据另行核验" }) } catch (error) { signal?.throwIfAborted(); results.push({ name, ok: false, detail: error instanceof Error ? error.message : "连接失败" }) }
  }
  return results
}
export const backendResultCollections = ["disaster-report", "thermal-background", "thermal-anomaly", "thematic-map"] as const
export async function queryBackendResults(collection: string, signal?: AbortSignal, token?: string, bounds?: RectInfo) {
  if (!collection || /[\\/?#]/.test(collection) || Array.from(collection).some(character => character.charCodeAt(0) < 32) || [".", ".."].includes(collection)) { throw new Error("数据集编号无效") }
  const result = await searchStacPage({ collections: [collection], limit: 50, ...(bounds ? { bbox: [bounds.west, bounds.south, bounds.east, bounds.north] } : {}) }, signal, token)
  const items = result.items
  if (items.some(item => item.collection !== collection)) { throw new Error("成果目录身份不匹配") }
  return result
}
export function backendAssetUrl(item: RemoteItem, key: string) {
  const href = item.assets[key]?.href
  if (!href || !validThematicFile(href)) { throw new Error("资产不属于已配置的后台文件服务") }
  return href
}
export async function readBackendResult(item: RemoteItem, key: string, signal?: AbortSignal) {
  const href = backendAssetUrl(item, key)
  if (!/\.(json|geojson)$/i.test(new URL(href).pathname)) { throw new Error("仅在界面读取 JSON/GeoJSON；HTML 和文档使用独立链接") }
  return JSON.parse(await read(remoteProxyUrl("files", href), {}, signal))
}
export async function checkCogAsset(item: RemoteItem, key: string, signal?: AbortSignal) {
  const href = backendAssetUrl(item, key)
  if (!/\.tiff?$/i.test(new URL(href).pathname)) { throw new Error("COG 服务需要实际 GeoTIFF，不接受目录页或报告") }
  const params = new URLSearchParams({ url: href })
  const result = JSON.parse(await read(`/api/thematic/cog/cog/WebMercatorQuad/tilejson.json?${params}`, {}, signal))
  if (!Array.isArray(result.tiles) || !result.tiles.length || !result.tiles.every((url: string) => typeof url === "string" && url.startsWith("http://192.168.10.15:5955/cog/tiles/"))) { throw new Error("COG 瓦片返回了非预期地址") }
  return { minzoom: result.minzoom, maxzoom: result.maxzoom, bounds: result.bounds, tileCount: result.tiles.length }
}
