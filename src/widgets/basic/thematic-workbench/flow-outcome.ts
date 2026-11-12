import type { ThematicFlowId } from "./thematic-services"

export function flowOutcome(id: ThematicFlowId, result: unknown) {
  const value = result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, any> : {}
  if (id === "stac_flow") {
    if (Array.isArray(value.errors) && value.errors.length) { return { state: "rejected", label: "后台编目校验未通过；未发布", refresh: false } }
    if (value.status === "pending_review" || (value.approved === false && value.published === false)) { return { state: "pending-review", label: "变更已登记，待后台审核；尚未发布", refresh: false } }
    if (value.action === "query") { return { state: "queried", label: "后台编目查询已完成", refresh: false } }
    if (value.published === true && typeof value.item_url === "string" && value.item_url) { return { state: "published", label: "后台编目已发布", refresh: true } }
    return { state: "unverified", label: "后台执行完成，编目发布尚未确认", refresh: false }
  }
  if (id === "result_flow") {
    if (Number.isInteger(value.failed) && value.failed > 0) { return { state: "partial", label: `汇交完成，${value.failed} 项失败；请核查回执`, refresh: value.published > 0 } }
    if (Number.isInteger(value.received) && value.received > 0 && value.published === value.received && value.failed === 0) { return { state: "published", label: `后台回执称已编目 ${value.published} 项成果；实际文件与地图服务仍需重新读取校验`, refresh: true } }
    return { state: "unverified", label: "后台执行完成，成果归档尚未确认", refresh: false }
  }
  return { state: "succeeded", label: "后台任务已完成", refresh: id !== "search_flow" }
}
