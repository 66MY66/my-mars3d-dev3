import type { DbtIssue } from "./dbt116-standard"

const categories = {
  source: { title: "数据用途与审核", owner: "数据提供方 / 业务审核方", action: "补齐数据来源、版本和公开使用依据，交付与当前图层对应的审核记录；前端不能代为声明审核通过。" },
  coordinates: { title: "坐标基准", owner: "数据提供方", action: "提供原始坐标依据；不一致时交付真实转换成果及转换记录，不能只将 WGS84 标签改为 CGCS2000。" },
  event: { title: "正式震情与制图分区", owner: "震情数据提供方 / 制图人员", action: "选择完整的正式地震事件，核对时间、地名、震级类型、公告来源及所属制图分区。" },
  coverage: { title: "图层覆盖与完整性", owner: "数据提供方 / 制图人员", action: "补齐当前范围缺失的图幅、必需图层或有效要素；仅在业务范围允许时调整选区，不能拉伸或补造缺失数据。" },
  theme: { title: "专题内容与表达", owner: "数据提供方 / 制图人员", action: "按当前专题补齐指标、单位、统计口径及适用符号，核对分类与实际显示内容。" },
  annotations: { title: "注记排布", owner: "制图人员 / 前端", action: "按要素层级综合注记、调整比例尺或分幅，并复核未放置的名称；未放置清单保留在检查记录中。" },
  layout: { title: "版式与输出", owner: "制图人员 / 前端", action: "补齐制作信息，调整文字和图例容量，并核对源图精度及最终校样。" },
  other: { title: "其他检查", owner: "制图人员 / 技术维护", action: "查看具体检查明细，处理后重新生成校样并复核。" }
} as const

export type ReleaseCheckGroup = { key: string; title: string; owner: string; action: string; issues: DbtIssue[]; blocking: number }

export function uniqueCartographyIssues(issues: DbtIssue[]) {
  return [...new Map(issues.map(issue => [JSON.stringify([issue.severity, issue.clause, issue.message]), issue])).values()]
}

function category(issue: DbtIssue): keyof typeof categories {
  const text = issue.message
  if (/注记.*(冲突|排布|放置|超过)|候选.*注记|注记.*候选/.test(text)) { return "annotations" }
  if (/坐标|CGCS2000|CRS|EPSG/.test(text)) { return "coordinates" }
  if (/震情|发震时间|震级类型|台网|制图分区|行政归属/.test(text)) { return "event" }
  if (/覆盖|缺测|范围内没有|缺少地理底图|完整性依据|规范范围|制图范围|退化|无效几何/.test(text)) { return "coverage" }
  if (/测试.*用途|测试.*数据|参考产品|参考数据|业务审核|在线数据|来源|涉密|脱密|审核数据包|审核绑定|用途/.test(text)) { return "source" }
  if (/制作单位|制图时间|内容说明|图例|DPI|栅格.*解码|比例尺.*绘制|校样|版式/.test(text)) { return "layout" }
  if (/专题|实例|符号|单位|指标|烈度|人口|经济|类别|级别|配色|DEM|晕渲|比例尺/.test(text)) { return "theme" }
  return "other"
}

export function groupCartographyIssues(issues: DbtIssue[]): ReleaseCheckGroup[] {
  const grouped = new Map<string, ReleaseCheckGroup>()
  for (const issue of uniqueCartographyIssues(issues)) {
    const key = category(issue)
    if (!grouped.has(key)) { grouped.set(key, { key, ...categories[key], issues: [], blocking: 0 }) }
    const group = grouped.get(key)!
    group.issues.push(issue)
    if (issue.severity === "error") { group.blocking++ }
  }
  return [...grouped.values()].sort((a, b) => Number(b.blocking > 0) - Number(a.blocking > 0) || Object.keys(categories).indexOf(a.key) - Object.keys(categories).indexOf(b.key))
}

export function annotationIssueSummary(skipped: Array<{ text: string; reason: string }>): string[] {
  const relevant = skipped.filter(entry => !["outside", "generalized", "duplicate"].includes(entry.reason))
  if (!relevant.length) { return [] }
  const counts = [
    ["crowded", "冲突未放置"], ["oversize", "超过图幅"], ["limit", "超过候选数量上限"]
  ].flatMap(([reason, name]) => {
    const count = relevant.filter(entry => entry.reason === reason).length
    return count ? [`${name} ${count} 条`] : []
  })
  return [`注记排布需复核：${counts.join("；")}。需综合注记、调整比例尺或分幅；完整未放置清单见检查记录。`]
}
