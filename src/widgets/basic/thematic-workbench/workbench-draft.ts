export type WorkbenchDraft = {
  templateId: string
  templateName: string
  title: string
  subtitle: string
  legendTitle: string
  palette: string
  notes: string
  agency: string
  publishName: string
  publishDesc: string
}

const copyFields = ["title", "subtitle", "legendTitle", "palette", "notes", "agency", "publishName", "publishDesc"] as const

export function restoreWorkbenchCopy(current: WorkbenchDraft, saved: unknown): WorkbenchDraft {
  if (!current.templateId) { throw new Error("请先选择专题模板") }
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) { throw new Error("没有可恢复的本机文案") }
  const values = saved as Record<string, unknown>
  if (values.templateId !== current.templateId) { throw new Error("本机文案属于其他模板，请先选择对应模板；当前专题未更改") }
  const next = { ...current }
  for (const key of copyFields) {
    const value = values[key]
    if (value === undefined) { continue }
    if (typeof value !== "string") { throw new Error("本机文案格式无效，当前内容已保留") }
    next[key] = value
  }
  return next
}
