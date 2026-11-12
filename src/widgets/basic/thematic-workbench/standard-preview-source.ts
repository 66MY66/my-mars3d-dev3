import { emptyDbtDocument, readDbtDocument, type DbtTemplateId } from "./dbt116-standard"

export function standardPreviewPath(id: DbtTemplateId): string | null {
  return id === "T30102000" ? "data/cartography-reference/population-worldpop2020.json" : null
}
export function standardPreviewLabel(id: DbtTemplateId): string {
  return id === "T30102000" ? "2020 年真实模型数据参考 · 非当前震情成果" : "规范版式结构 · 未绑定业务数据"
}
export async function loadStandardPreviewDocument(id: DbtTemplateId, signal?: AbortSignal) {
  const path = standardPreviewPath(id)
  if (!path) { return emptyDbtDocument() }
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`, { signal })
  if (!response.ok) { throw new Error("参考数据加载失败") }
  return readDbtDocument(await response.json())
}
