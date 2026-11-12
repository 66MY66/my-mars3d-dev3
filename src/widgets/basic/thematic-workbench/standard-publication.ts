import type { DbtDocument, DbtIssue, DbtTemplateId } from "./dbt116-standard"

export interface StandardPublicationReview extends Record<string, unknown> {
  template: DbtTemplateId
  code: string
  usage: string
  dataSha256: string
  formalExportEnabled: boolean
  issues: DbtIssue[]
  review: Array<{ clause: string; label: string; confirmed: boolean }>
  reviewer: string
  evidence: string
}

export interface StandardPublicationBundle {
  templateId: DbtTemplateId
  title: string
  code: string
  revision: number
  format: "jpg" | "pdf"
  dpi: number
  document: DbtDocument
  review: StandardPublicationReview
  file: File
}

export interface StandardPublicationState {
  templateId: DbtTemplateId
  revision: number
  name: string
  title: string
  code: string
  preview: string
  hasDocument: boolean
  usage: string
  busy: boolean
  ready: boolean
  format: "jpg" | "pdf"
  dpi: number
  blockers: string[]
  issues: DbtIssue[]
  reviewCount: number
  reviewTotal: number
  status: string
  error: string
}

export function standardPublicationBlockers(input: {
  hasDocument: boolean
  usage?: string
  mapDraft: boolean
  renderReady: boolean
  issues: DbtIssue[]
  reviewCount: number
  reviewTotal: number
  reviewer: string
  evidence: string
}): string[] {
  if (!input.hasDocument) { return ["尚未创建或导入制图数据"] }
  const blockers = input.issues.filter(issue => issue.severity === "error").map(issue => `${issue.clause} · ${issue.message}`)
  if (input.usage !== "operational") { blockers.unshift("当前数据未声明为正式业务数据，仅可导出校样") }
  if (input.mapDraft) { blockers.push("当前仍为底图草稿，需补齐规范范围和专题数据") }
  if (!input.renderReady) { blockers.push("当前图件尚未完成渲染") }
  if (input.reviewCount < input.reviewTotal) { blockers.push(`人工复核尚有 ${input.reviewTotal - input.reviewCount} 项未确认`) }
  if (!input.reviewer.trim()) { blockers.push("未填写复核人") }
  if (!input.evidence.trim()) { blockers.push("未填写复核依据") }
  return blockers
}
