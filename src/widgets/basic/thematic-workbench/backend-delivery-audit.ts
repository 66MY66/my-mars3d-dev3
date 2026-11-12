import { remoteCollections, searchStacPage, type RemoteItem } from "./remote-cartography-source"
import { matchesWorkflowItem, productionItem, type SourceAdapter } from "./cartography-workflow"
import { validThematicFile } from "./thematic-services"

export const deliveryCollections = [...remoteCollections.map(entry => entry.id), "disaster-report"]
export type DeliveryAudit = { checkedAt: string; collections: Array<{ id: string; count: number; complete: boolean; error?: string }>; items: RemoteItem[] }
export async function auditBackendDelivery(signal?: AbortSignal): Promise<DeliveryAudit> {
  const items = new Map<string, RemoteItem>(); const collections: DeliveryAudit["collections"] = []
  for (const id of deliveryCollections) {
    const row: DeliveryAudit["collections"][number] = { id, count: 0, complete: false }; collections.push(row)
    let token: string | undefined; const seen = new Set<string>()
    try {
      for (let page = 0; page < 10; page++) {
        signal?.throwIfAborted()
        const result = await searchStacPage({ collections: [id], limit: 100 }, signal, token)
        if (result.items.some(item => item.collection !== id)) { throw new Error("目录身份不匹配") }
        for (const item of result.items) { items.set(`${id}/${item.id}`, item) }
        row.count = [...items.values()].filter(item => item.collection === id).length
        if (!result.hasMore) { row.complete = true; break }
        if (!result.nextToken || seen.has(result.nextToken)) { break }
        seen.add(result.nextToken); token = result.nextToken
      }
    } catch (error) { signal?.throwIfAborted(); row.error = error instanceof Error ? error.message : "目录查询失败" }
  }
  return { checkedAt: new Date().toISOString(), collections, items: [...items.values()] }
}
const specs: Array<{ role: string; label: string; adapter?: SourceAdapter; collections: string[]; needs: string }> = [
  { role: "event", label: "正式震情", collections: ["disaster-report", "spatial-thematic"], needs: "正式事件接口或已声明事件角色的点数据；发震时间、震中、震级类型及台网公告。报告摘要不代替事件数据。" },
  { role: "intensity", label: "正式评估烈度面", collections: ["spatial-thematic"], needs: "对应事件的真实烈度 Polygon/MultiPolygon、等级、评估来源与版本；radius_km 不是烈度面。" },
  { role: "population", label: "人口分布", adapter: "population", collections: ["spatial-thematic"], needs: "确认原始指标为人/格还是密度、复制重采样规则、年份、NoData、坐标和来源；不能累加重复发布像元。" },
  { role: "economy", label: "GDP 分布", adapter: "economy", collections: ["spatial-thematic"], needs: "确认金额/格或密度、币种与价格基期、年份、复制重采样规则及质量依据；GDP 不是资产或损失。" },
  { role: "imagery", label: "遥感原始影像", adapter: "imagery", collections: ["fy3-mersi-l1"], needs: "采集时相、GSD、波段物理量、质量标识与定位精度；亮温不当成 LST，影像不当成损毁成果。" },
  { role: "rate", label: "InSAR 速率", adapter: "rate", collections: ["insar-deformation"], needs: "mm/a 速率方向、时段、精度和相干性；不可代替累计 LOS 位移。" },
  ...[["fault", "活动断层线"], ["boundary", "行政区划"], ["settlement", "居民地"], ["water", "水系"], ["transport", "交通"], ["dem", "真实地形"], ["target", "医院/学校/桥梁/水库"], ["building", "建筑及损毁"], ["geohazard", "已核查次生灾害"], ["capacity", "减灾能力"]].map(([role, label]) => ({ role, label, collections: ["spatial-thematic", "geohazard-spot"], needs: "交付真实几何/资产、角色和分类字典、稳定 ID、有效版本、来源与质量依据。" }))
]
export function deliveryRows(audit: DeliveryAudit) {
  const roleAdapters: Record<string, SourceAdapter[]> = { event: ["event-parameters"], intensity: ["assessment-intensity"], fault: ["active-faults"], boundary: ["admin-area", "border-line"], settlement: ["settlement-name", "settlement-area"], water: ["water-line", "water-area"], transport: ["road-line", "rail-line"] }
  return specs.map(spec => {
    const candidates = audit.items.filter(item => productionItem(item) && (spec.adapter ? matchesWorkflowItem(item, spec.adapter) : item.properties["cartography:role"] === spec.role || roleAdapters[spec.role]?.some(adapter => matchesWorkflowItem(item, adapter)) || (spec.role === "building" && item.id === "SP-yunnan-buildings")) && Object.values(item.assets).some(asset => validThematicFile(asset.href)))
    const complete = spec.collections.every(id => audit.collections.some(row => row.id === id && row.complete && !row.error))
    let status = complete ? "当前目录未发现可适配条目" : "目录未读全 · 不能判断缺失"
    if (candidates.length) { status = "原始条目可用 · 质量待核验" }
    return { role: spec.role, label: spec.label, status, ids: candidates.map(item => `${item.collection}/${item.id}`), needs: spec.needs }
  })
}
export function deliveryAuditReport(audit: DeliveryAudit) {
  return {
    kind: "thematic-backend-delivery-audit",
checkedAt: audit.checkedAt,
scope: `已配置的 ${deliveryCollections.length} 类业务目录；全部数据集可在后端目录中选择，本表不是全库资产鉴定或选区统计`,
    collections: audit.collections,
rows: deliveryRows(audit),
    excluded: audit.items.filter(item => !productionItem(item)).map(item => ({ collection: item.collection, id: item.id, reason: "后台目录结构无效" })),
    declaredApprovedPackages: audit.items.filter(item => item.properties["cartography:contract"] === "mars3d.standard-document.v1" && item.properties["cartography:status"] === "approved").length,
    publication: "专题图由目标前端平台接管发布，当前支持交付带审核和指纹的发布包；不通过 Windmill 汇交。文件归档使用5960成果库并另行取回校验；归档或下载不等于在线发布",
    qualification: "原始数据接通与审核数据包分别核对；未验证文件内容、质量证书或正式出图资格，不因没有自定义审核包而认定原始数据不存在"
  }
}
