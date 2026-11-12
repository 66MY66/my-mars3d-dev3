export const thematicServiceTargets = {
  "/api/thematic/stac": "http://192.168.10.15:5951",
  "/api/thematic/tiles": "http://192.168.10.15:5952",
  "/api/thematic/files": "http://192.168.10.15:9002",
  "/api/thematic/cog": "http://192.168.10.15:5955",
  "/api/thematic/flow": "http://192.168.10.15:6080",
  "/api/thematic/catalog-health": "http://192.168.10.15:5954"
}
export const thematicFlows = [
  { id: "search_flow", name: "数据检索" },
  { id: "grid_layer_flow", name: "人口/GDP 网格生产" },
  { id: "background_flow", name: "背景场计算与编目" },
  { id: "result_flow", name: "成果汇交" },
  { id: "stac_flow", name: "元数据编目维护" }
] as const
export type ThematicFlowId = typeof thematicFlows[number]["id"]
export const flowWorkspace = "/api/w/earth-data"
export function flowPath(id: ThematicFlowId) {
  if (!thematicFlows.some(flow => flow.id === id)) { throw new Error("未配置的后台流程") }
  return `u/fyt/earth/${id}`
}
export function validThematicFile(href: string) {
  try {
    const url = new URL(href)
    return url.origin === thematicServiceTargets["/api/thematic/files"] && !url.username && !url.password && !url.hash && validThematicObjectPath(url.pathname)
  } catch { return false }
}
export function validThematicObjectPath(pathname: string) {
  try {
    const parts = decodeURIComponent(pathname).split("/")
    const bucket = parts[1] || ""
    return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) && !["minio", "admin", "console"].includes(bucket) && parts.slice(2).some(Boolean) && parts.every(part => part !== "." && part !== ".." && !part.includes("\\") && Array.from(part).every(character => character.charCodeAt(0) >= 32))
  } catch { return false }
}
export function allowThematicServiceRequest(method: string, url: URL, prefix: string) {
  const pathname = url.pathname.slice(prefix.length)
  const read = method === "GET" || method === "HEAD"
  if (prefix.endsWith("/catalog-health")) { return read && (pathname === "/" || pathname.startsWith("/collections/")) }
  if (prefix.endsWith("/flow")) {
    if (method === "POST" && pathname === "/api/auth/login") { return true }
    if (read && pathname === "/api/version") { return true }
    const definitions = thematicFlows.map(flow => `${flowWorkspace}/flows/get/${flowPath(flow.id)}`)
    if (read && definitions.includes(pathname)) { return true }
    if (method === "POST" && thematicFlows.some(flow => pathname === `${flowWorkspace}/jobs/run/f/${flowPath(flow.id)}`)) { return true }
    return read && new RegExp(`^${flowWorkspace}/jobs_u/(completed/get_result_maybe/|get/)[a-f0-9-]{36}$`, "i").test(pathname)
  }
  if (prefix.endsWith("/cog")) {
    if (read && pathname === "/healthz") { return true }
    return read && pathname.startsWith("/cog/") && validThematicFile(url.searchParams.get("url") || "")
  }
  if (prefix.endsWith("/files")) { return read && validThematicObjectPath(pathname) }
  return read || (prefix.endsWith("/stac") && method === "POST" && pathname === "/search")
}
export function flowWrites(id: ThematicFlowId, args: Record<string, unknown>) {
  return id === "search_flow" ? !!args.export : id !== "stac_flow" || args.action !== "query"
}
