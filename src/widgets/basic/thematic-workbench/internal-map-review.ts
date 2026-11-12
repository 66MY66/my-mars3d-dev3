import type { DbtBounds, DbtLayer } from "./dbt116-standard"
import { cartographyFingerprint } from "./cartography-fingerprint"

export const internalReviewChecks = [
  { id: "sources", label: "已核对后台数据来源、时间与指标含义，并在审核意见中注明已知限制" },
  { id: "extent", label: "已核对当前地图范围、专题内容与图层覆盖" },
  { id: "portrayal", label: "已检查实际地图效果、图例、注记与显示顺序" },
  { id: "permission", label: "确认有权在单位内部共享本次成果，不改变源数据的访问权限" },
  { id: "record", label: "确认本次版本可供内部业务使用，并保留本次审核记录" }
] as const
export type InternalReviewSource = { title: string; topic: string; bounds: DbtBounds | null; layers: DbtLayer[]; documentRevision?: number; presentationKey?: string }
export type InternalMapReview = { version: "mars3d.internal-map-review.v1"; scope: "internal"; sourceSha256: string; reviewer: string; notes: string; checks: string[]; reviewedAt: string; documentRevision?: number }

export const activeReviewLayers = (layers: DbtLayer[]) => layers.filter(layer => layer.enabled !== false && (layer.opacity ?? 1) > 0)
export function internalReviewSubject(source: InternalReviewSource) {
  return { title: source.title.trim(), topic: source.topic, bounds: source.bounds, documentRevision: source.documentRevision, presentationKey: source.presentationKey, layers: activeReviewLayers(source.layers).map(layer => ({ id: layer.id, name: layer.name, role: layer.role, source: layer.source, crs: layer.crs, onlineSource: layer.onlineSource, enabled: layer.enabled, opacity: layer.opacity, order: layer.order, legend: layer.legend, color: layer.color, unit: layer.unit })) }
}
export function internalMapBlockers(source: InternalReviewSource) {
  const issues: string[] = []
  const b = source.bounds
  if (!b || !Object.values(b).every(Number.isFinite) || b.west >= b.east || b.south >= b.north || b.west < -180 || b.east > 180 || b.south < -90 || b.north > 90) { issues.push("请先确认有效的地图范围") }
  if (!source.title.trim() || !source.topic) { issues.push("请先选择专题并填写图件标题") }
  const layers = activeReviewLayers(source.layers)
  if (layers.some(layer => layer.onlineSource?.rendering?.parameters?.inputOnly)) { issues.push("专题数据已读取但尚未渲染，请返回数据与制图应用表达方法") }
  if (!layers.some(layer => layer.role !== "event")) { issues.push("请至少叠加一个真实后台地图图层；仅有震中摘要不能作为地图成果") }
  const crs = new Set(layers.map(layer => ["CRS84", "OGC:CRS84"].includes(layer.crs) ? "EPSG:4326" : layer.crs))
  if (crs.size > 1) { issues.push("当前图层坐标基准不一致，需实际转换后再发布") }
  if ([...crs].some(value => !["EPSG:4326", "EPSG:4490"].includes(value))) { issues.push("当前存在未适配的坐标基准，不能直接按经纬度发布") }
  const missing = layers.filter(layer => !/^[a-f\d]{64}$/.test(layer.onlineSource?.sourceItemSha256 || "") || !/^[a-f\d]{64}$/.test(layer.onlineSource?.fingerprint || "") || (!layer.raster && !layer.data.features.length))
  if (missing.length) { issues.push(`需重新叠加来源或内容无效的图层：${missing.map(layer => layer.name).join("、")}`) }
  if (layers.some(layer => /^(secret|top[_ -]?secret|classified|confidential|秘密|机密|绝密|涉密)$/i.test(layer.security))) { issues.push("存在明确限制共享的图层，不能由人工勾选解除其限制") }
  const roles = new Set(layers.map(layer => layer.role))
  const topics: Record<string, string[]> = { T30102000: ["population", "economy", "building"], T30103000: ["target"], T30201000: ["intensity"], T30202000: ["capacity", "refuge", "supplies", "pga"], T30203000: ["dem", "imagery", "settlement", "transport", "building", "target", "population", "rescue-area", "geohazard"] }
  if (topics[source.topic] && !topics[source.topic].some(role => roles.has(role))) { issues.push("尚未叠加当前专题的核心业务图层，请返回数据与制图补齐") }
  return issues
}
export function internalReviewProblems(review: InternalMapReview | null | undefined, hash: string) {
  if (!review) { return ["请完成下方人工审核并确认本次版本"] }
  if (review.version !== "mars3d.internal-map-review.v1" || review.scope !== "internal" || !/^[a-f\d]{64}$/.test(hash) || review.sourceSha256 !== hash) { return ["地图内容或发布配置已变化，请重新审核当前版本"] }
  const issues: string[] = []
  if (typeof review.reviewer !== "string" || !review.reviewer.trim()) { issues.push("请填写实际审核人") }
  if (typeof review.notes !== "string" || !review.notes.trim()) { issues.push("请填写审核意见及使用限制") }
  if (!Array.isArray(review.checks) || internalReviewChecks.some(check => !review.checks.includes(check.id))) { issues.push("请完成五项人工审核确认") }
  if (!/(Z|[+-]\d\d:\d\d)$/.test(review.reviewedAt) || !Number.isFinite(Date.parse(review.reviewedAt))) { issues.push("审核时间无效，请重新确认本次版本") }
  return issues
}
export async function confirmInternalReview(source: InternalReviewSource, reviewer: string, notes: string, checks: string[]): Promise<InternalMapReview> {
  const issues = internalMapBlockers(source)
  if (issues.length) { throw new Error(issues.join("；")) }
  const review: InternalMapReview = { version: "mars3d.internal-map-review.v1", scope: "internal", sourceSha256: await cartographyFingerprint(internalReviewSubject(source)), reviewer: reviewer.trim(), notes: notes.trim(), checks: [...checks], reviewedAt: new Date().toISOString(), documentRevision: source.documentRevision }
  const problems = internalReviewProblems(review, review.sourceSha256)
  if (problems.length) { throw new Error(problems.join("；")) }
  return review
}
