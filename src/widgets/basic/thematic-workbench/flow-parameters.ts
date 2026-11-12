import type { ThematicFlowId } from "./thematic-services"

export type FlowSchema = {
  type?: string; description?: string; title?: string; enum?: unknown[]; default?: unknown
  required?: string[]; properties?: Record<string, FlowSchema>; items?: FlowSchema; order?: string[]
  minimum?: number; maximum?: number; minItems?: number; maxItems?: number; minLength?: number
}
const labels: Record<string, string> = {
  satellite: "卫星系列",
platform: "卫星平台",
instrument: "传感器",
collections: "数据集编号",
collection_id: "数据集编号",
  start: "开始时间",
end: "结束时间",
bbox: "空间范围",
gsd_min: "最小分辨率（米）",
gsd_max: "最大分辨率（米）",
  keyword: "关键字",
dir_id: "目录编号",
limit: "条数上限",
page_size: "每页条数",
export: "导出格式",
user_id: "查询用户",
  file_path: "后台源文件路径",
grid_kind: "网格指标",
coverage: "覆盖方式",
west: "西界经度",
south: "南界纬度",
east: "东界经度",
north: "北界纬度",
epicenter_lon: "震中经度",
epicenter_lat: "震中纬度",
magnitude: "震级",
azimuth: "走向角",
title: "成果标题",
layer_name: "图层名称",
  visibility: "共享级别",
operator: "操作员",
query_type: "背景场类型",
grid_size_deg: "网格大小（度）",
thresholds: "模型参数",
  submit_anomaly: "提交异常成果",
receive_type: "接收方式",
result_type: "成果类型",
result_data: "单条成果",
payload: "推送数据包",
  batch_data: "批量成果",
source_system: "来源子系统",
source_scene: "来源场景",
action: "编目操作",
entry_mode: "录入方式",
  item_data: "编目数据",
query: "检索条件",
update: "单条更新",
updates: "批量更新",
review: "审核记录",
task_id: "上游任务号",
  item_id: "条目编号",
reviewer: "审核人",
approved: "审核通过",
comment: "审核意见",
datetime: "数据时间",
file: "后台成果文件",
  brightness_temp_threshold: "亮温阈值（K）",
intensity_threshold: "标准化强度阈值",
overlap_area_threshold: "重叠面积阈值（后台口径）",
  region_bbox: "模型适用范围",
duration_days: "持续天数",
background_window_days: "历史窗口（天）"
}
export function flowFieldLabel(key: string, schema: FlowSchema) { return labels[key] || schema.title || key }
const number = (minimum?: number, maximum?: number): FlowSchema => ({ type: "number", minimum, maximum })
const string: FlowSchema = { type: "string" }
const queryFields = { collection_id: string, platform: string, instrument: string, start: string, end: string, item_id: string, limit: { type: "integer", minimum: 1, maximum: 10000 } }
export function structuredFlowSchema(id: ThematicFlowId, source: FlowSchema): FlowSchema {
  const properties = structuredClone(source.properties || {})
  const nested: Record<string, Record<string, FlowSchema>> = id === "background_flow"
? {
    thresholds: { brightness_temp_threshold: number(0), intensity_threshold: number(0), overlap_area_threshold: number(0), region_bbox: { type: "array", items: number(), minItems: 4, maxItems: 4 }, duration_days: { type: "integer", minimum: 1 }, background_window_days: { type: "integer", minimum: 1 }, grid_size_deg: number(Number.EPSILON, 180) }
  }
: {}
  if (id === "stac_flow") { Object.assign(nested, { query: queryFields, review: { reviewer: string, approved: { type: "boolean" }, comment: string } }) }
  for (const [key, fields] of Object.entries(nested)) { if (properties[key] && !properties[key].properties) { properties[key].properties = fields } }
  if (properties.bbox) { properties.bbox.minItems = 4; properties.bbox.maxItems = 4 }
  return { ...source, properties }
}
export function orderedFlowFields(schema: FlowSchema) {
  return [...new Set([...(schema.order || []), ...Object.keys(schema.properties || {})])].filter(key => schema.properties?.[key])
}
export function validateFlowParameters(id: ThematicFlowId, value: Record<string, unknown>, schema: FlowSchema) {
  const errors: string[] = []
  const check = (data: unknown, rule: FlowSchema, path: string, depth = 0) => {
    if (depth > 12) { errors.push(`${path}：参数嵌套过深`); return }
    if (rule.enum && !rule.enum.some(option => JSON.stringify(option) === JSON.stringify(data))) { errors.push(`${path}：不属于后台允许的选项`); return }
    const type = rule.type
    const validators: Record<string, () => boolean> = {
      object: () => !!data && typeof data === "object" && !Array.isArray(data),
      array: () => Array.isArray(data),
      integer: () => Number.isInteger(data),
      number: () => typeof data === "number" && Number.isFinite(data),
      string: () => typeof data === "string",
      boolean: () => typeof data === "boolean",
      null: () => data === null
    }
    const valid = !type || (validators[type]?.() ?? false)
    if (!valid) { errors.push(`${path}：类型应为 ${type}`); return }
    if (typeof data === "number" && ((rule.minimum !== undefined && data < rule.minimum) || (rule.maximum !== undefined && data > rule.maximum))) { errors.push(`${path}：超出允许范围`) }
    if (typeof data === "string" && rule.minLength && data.length < rule.minLength) { errors.push(`${path}：内容过短`) }
    if (Array.isArray(data)) {
      if ((rule.minItems !== undefined && data.length < rule.minItems) || (rule.maxItems !== undefined && data.length > rule.maxItems)) { errors.push(`${path}：数组长度不正确`) }
      if (rule.items) { data.forEach((entry, i) => check(entry, rule.items!, `${path}[${i}]`, depth + 1)) }
    } else if (data && typeof data === "object") {
      const record = data as Record<string, unknown>
      for (const key of rule.required || []) { if (record[key] === undefined || record[key] === null || (typeof record[key] === "string" && !String(record[key]).trim())) { errors.push(`${path}.${key}：必填`) } }
      for (const [key, child] of Object.entries(rule.properties || {})) { if (record[key] !== undefined) { check(record[key], child, `${path}.${flowFieldLabel(key, child)}`, depth + 1) } }
      for (const key of ["bbox", "region_bbox"]) {
        const b = record[key]
        if (Array.isArray(b) && (b.length !== 4 || !b.every(n => typeof n === "number" && Number.isFinite(n)) || b[0] < -180 || b[2] > 180 || b[1] < -90 || b[3] > 90 || b[0] >= b[2] || b[1] >= b[3])) { errors.push(`${path}.${key}：须为有效西、南、东、北范围；跨日期变更线须分区`) }
      }
      if (typeof record.start === "string" && record.start && !Number.isFinite(Date.parse(record.start))) { errors.push(`${path}：开始时间无效`) }
      if (typeof record.end === "string" && record.end && !Number.isFinite(Date.parse(record.end))) { errors.push(`${path}：结束时间无效`) }
      if (record.start && record.end && Date.parse(String(record.start)) > Date.parse(String(record.end))) { errors.push(`${path}：开始时间不能晚于结束时间`) }
      if ((typeof record.gsd_min === "number" && record.gsd_min < 0) || (typeof record.gsd_max === "number" && record.gsd_max < 0) || (typeof record.gsd_min === "number" && typeof record.gsd_max === "number" && record.gsd_min > record.gsd_max)) { errors.push(`${path}：分辨率范围无效`) }
    }
  }
  check(value, { ...structuredFlowSchema(id, schema), type: "object" }, "任务")
  if (id === "result_flow") {
    const key = ({ manual: "result_data", webhook: "payload", batch_import: "batch_data" } as Record<string, string>)[String(value.receive_type || "manual")]
    const data = value[key]
    if (key && (!data || typeof data !== "object" || !Object.keys(data).length)) { errors.push("成果汇交须提供对应接收方式的非空成果，不能提交空成果") }
  }
  if (id === "stac_flow" && value.action !== "query") {
    const key = ({ update: "update", batch_update: "updates", create: "item_data", manual: "item_data" } as Record<string, string>)[String(value.action)]
    if (key && (!value[key] || typeof value[key] !== "object" || !Object.keys(value[key] as object).length)) { errors.push("编目写入须提供非空的对应业务内容") }
  }
  return [...new Set(errors)]
}
