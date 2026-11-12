import type { DbtLayer } from "./dbt116-standard"
import { dbtRoleNames } from "./dbt-cartography-rules"
import { readBusinessDocument, type MapDataSource } from "./business-map-data"

export function businessStandardLayer(source: MapDataSource, role?: string): DbtLayer {
  if (!source.document || source.issue) { throw new Error(source.issue || "图层无可读取的业务数据") }
  const data = readBusinessDocument(source.document)
  const m = data.metadata
  if (m.referenceOnly || m.usage === "reference") { throw new Error("参考数据不可直接纳入正式应急制图，请保留独立参考用途并核验来源") }
  const selectedRole = role || m.role
  if (!Object.hasOwn(dbtRoleNames, selectedRole || "")) { throw new Error("未声明规范图层角色 metadata.role，请先确认数据用途") }
  const text = (key: string) => typeof m[key] === "string" ? m[key] : ""
  return {
    id: source.id,
name: source.name,
role: selectedRole,
data,
    source: text("source"),
crs: text("crs"),
authority: text("authority"),
    publishedAt: text("publishedAt") || text("observedAt"),
security: text("security"),
    scale: typeof m.scale === "number" && Number.isFinite(m.scale) ? m.scale : 0,
    unit: text("unit"),
    thematic: {
      ...(typeof m.thematic === "object" && m.thematic ? JSON.parse(JSON.stringify(m.thematic)) : {}),
      ...(typeof m.valueField === "string" ? { field: m.valueField } : {}),
      ...(m.inputMetric !== undefined ? { inputMetric: m.inputMetric } : {})
    },
crsEvidence: text("crsEvidence"),
    coverage: m.coverage ? JSON.parse(JSON.stringify(m.coverage)) : undefined,
    coverageEvidence: text("coverageEvidence"),
colorStandard: text("colorStandard"),
    parameterEvidence: text("parameterEvidence"),
legend: m.legend ? JSON.parse(JSON.stringify(m.legend)) : undefined
  }
}
