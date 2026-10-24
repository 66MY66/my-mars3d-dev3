import type { JobProgress, JobStatus } from "../types/eoapi-types"

export type ThematicProgressStepKey = "data" | "render" | "tiling" | "publish" | "archive"
export type ThematicProgressStepState = "pending" | "active" | "done" | "error"

export interface ThematicProgressStepItem {
  key: ThematicProgressStepKey
  label: string
  state: ThematicProgressStepState
}

export const THEMATIC_PROGRESS_STEPS: Array<{ key: ThematicProgressStepKey; label: string }> = [
  { key: "data", label: "数据" },
  { key: "render", label: "渲染" },
  { key: "tiling", label: "切片" },
  { key: "publish", label: "发布" },
  { key: "archive", label: "归档" }
]

function normalizeText(value: unknown): string {
  return String(value || "").trim().toLowerCase()
}

function detectStepKeyFromText(text: string): ThematicProgressStepKey | null {
  if (!text) {
    return null
  }
  if (/(archive|archiv|归档|入档|存档)/.test(text)) {
    return "archive"
  }
  if (/(publish|service|deploy|发布|服务)/.test(text)) {
    return "publish"
  }
  if (/(tile|tiling|slice|slicing|切片|瓦片)/.test(text)) {
    return "tiling"
  }
  if (/(render|layout|draw|plot|preview|map|出图|制图|渲染)/.test(text)) {
    return "render"
  }
  if (/(data|dataset|prepare|fetch|query|source|load|upload|parse|ingest|validate|数据|准备|解析|读取|加载)/.test(text)) {
    return "data"
  }
  return null
}

export function resolveThematicProgressStepKey(
  progress?: Partial<JobProgress> | null,
  status?: JobStatus | null
): ThematicProgressStepKey {
  const stageText = normalizeText(progress?.stage)
  const messageText = normalizeText(progress?.message)
  return detectStepKeyFromText(stageText) ||
    detectStepKeyFromText(messageText) ||
    (status === "queued" ? "data" : "render")
}

export function getThematicProgressStageLabel(
  progress?: Partial<JobProgress> | null,
  status?: JobStatus | null
): string {
  const key = resolveThematicProgressStepKey(progress, status)
  const matched = THEMATIC_PROGRESS_STEPS.find((step) => step.key === key)
  return matched?.label || "处理中"
}

export function getThematicProgressMessage(
  progress?: Partial<JobProgress> | null,
  status?: JobStatus | null
): string {
  if (status === "succeeded") { return "生成完成" }
  if (status === "cancelled") { return "已取消" }
  const label = getThematicProgressStageLabel(progress, status)
  const message = String(progress?.message || "").trim()
  if (message) {
    return `${label}: ${message}`
  }
  const stage = String(progress?.stage || "").trim()
  if (stage && stage !== label && normalizeText(stage) !== normalizeText(status)) {
    return `${label}: ${stage}`
  }
  if (status === "queued") {
    return `${label}: 等待中`
  }
  return `${label}: 处理中`
}

export function buildThematicProgressSteps(
  progress?: Partial<JobProgress> | null,
  status?: JobStatus | null,
  archiveCompleted = false
): ThematicProgressStepItem[] {
  const activeKey = resolveThematicProgressStepKey(progress, status)
  const activeIndex = THEMATIC_PROGRESS_STEPS.findIndex((step) => step.key === activeKey)
  const index = activeIndex >= 0 ? activeIndex : 0

  return THEMATIC_PROGRESS_STEPS.map((step, stepIndex) => {
    let state: ThematicProgressStepState = "pending"
    if (status === "succeeded") {
      state = step.key === "archive" && !archiveCompleted ? "pending" : "done"
    } else if (status === "failed" || status === "cancelled") {
      if (stepIndex < index) {
        state = "done"
      } else if (stepIndex === index) {
        state = "error"
      }
    } else if (status === "queued" || status === "running") {
      if (stepIndex < index) {
        state = "done"
      } else if (stepIndex === index) {
        state = "active"
      }
    }
    return {
      key: step.key,
      label: step.label,
      state
    }
  })
}
