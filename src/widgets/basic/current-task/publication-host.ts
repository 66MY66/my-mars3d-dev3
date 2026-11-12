import { computed, shallowRef } from "vue"
import type { PublicationReceipt, ThematicPublicationHost } from "../thematic-workbench/publication-host"

export type TaskPublicationSelection = { datasetId: string; publicationId: string; section: string }
export const TASK_PUBLICATION_VIEW_EVENT = "mars3d:task-publication-view"
const selectedPublication = shallowRef<TaskPublicationSelection | null>(null)

export function selectTaskPublication(selection: TaskPublicationSelection) {
  selectedPublication.value = { ...selection }
}

export function useTaskPublicationSelection() {
  return computed(() => selectedPublication.value || taskPublicationRequest())
}

function openPublished(receipt: PublicationReceipt) {
  if (receipt.status !== "published" || !receipt.url) { return }
  const url = new URL(receipt.url)
  const params = new URLSearchParams(url.hash.split("?")[1] || "")
  const datasetId = params.get("datasetId") || ""
  const publicationId = params.get("publicationId") || ""
  if (url.origin !== window.location.origin || !datasetId || publicationId !== receipt.publicationId) {
    throw new Error("当前任务成果地址无效，请核对发布记录")
  }
  window.dispatchEvent(new CustomEvent<TaskPublicationSelection>(TASK_PUBLICATION_VIEW_EVENT, {
    detail: { datasetId, publicationId, section: "thematics" }
  }))
}

export function taskPublicationLink(datasetId: string, publicationId: string) {
  const url = new URL(window.location.href)
  url.hash = `/?${new URLSearchParams({ taskSection: "thematics", datasetId, publicationId })}`
  return url.href
}

export function taskPublicationRequest() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "")
  return { datasetId: params.get("datasetId") || "", publicationId: params.get("publicationId") || "", section: params.get("taskSection") || "" }
}

export function createCurrentTaskPublicationHost(context: () => { datasetId?: string; name?: string }): ThematicPublicationHost {
  return {
    name: "当前任务 · 专题图",
    storage: "browser",
    openPublished,
    description: "完整图件和审核包保存在当前浏览器，刷新后可继续查看；跨设备共享需等待后端发布接口。",
    async publish(input) {
      const target = { ...context() }
      const { saveTaskPublication } = await import("./thematic-publications")
      const saved = await saveTaskPublication(input, target)
      input.signal.throwIfAborted()
      return { status: "published", publicationId: saved.id, packageSha256: saved.packageSha256, url: taskPublicationLink(saved.datasetId, saved.id) }
    }
  }
}
