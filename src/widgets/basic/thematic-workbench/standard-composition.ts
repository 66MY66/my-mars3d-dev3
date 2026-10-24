import { createCompositionItem, type CompositionItem, type CompositionKind } from "./composition-model"
import { DBT_PAGE } from "./dbt116-renderer"
import { dbtTemplates, dbtTitle, type DbtDocument, type DbtTemplateId } from "./dbt116-standard"

export type StandardComposition = { id: DbtTemplateId; title: string; usage: string; items: CompositionItem[] }

// Regions come from the actual renderer, not from standard-document screenshots.
export function standardComposition(canvas: HTMLCanvasElement, doc: DbtDocument | null, id: DbtTemplateId, legendY: number, draft: boolean): StandardComposition {
  const name = dbtTemplates.find(template => template.id === id)!.name
  const title = doc?.event.time && doc.event.place && doc.event.magnitude ? dbtTitle(doc, id) : name
  const sections: Array<[string, CompositionKind, string, number, number, number, number, string]> = [
    ["title", "title", "标题", 60, 38, 1560, 110, title],
    ["map", "map", "主图", 54, 160, 1144, 872, ""],
    ["description", "description", "内容说明与统计", 1230, 181, 388, legendY - 181, doc?.description || ""],
    ["legend", "legend", "图例", 1230, legendY, 388, 1030 - legendY, "图例"],
    ["source", "source", "数据来源", draft ? 88 : 400, draft ? 1040 : 1065, draft ? 1035 : 690, draft ? 85 : 73, ""],
    ["agency", "agency", "制图单位", draft ? 1230 : 1150, draft ? 1040 : 1065, draft ? 388 : 480, 44, doc?.agency || ""],
    ["time", "time", "制图时间", draft ? 1230 : 1150, draft ? 1070 : 1092, draft ? 388 : 480, 44, doc?.createdAt || ""],
    ["code", "image", "分类编码与坐标信息", 88, 1140, 1560, 44, ""]
  ]
  if (!draft) { sections.push(["scale", "scale", "比例尺", 88, 1050, 300, 70, ""]) }
  const ratio = canvas.width / DBT_PAGE.width
  const items = sections.map(([part, kind, label, x, y, w, h, text]) => {
    const image = document.createElement("canvas"); image.width = Math.round(w * ratio); image.height = Math.round(h * ratio)
    image.getContext("2d")!.drawImage(canvas, x * ratio, y * ratio, w * ratio, h * ratio, 0, 0, image.width, image.height)
    return { ...createCompositionItem(kind, text), id: `standard:${id}:${part}`, standardPart: part, label, x, y, w, h, raster: { image: image.toDataURL("image/png"), width: image.width, height: image.height, label, detail: text, legend: [] } }
  })
  return { id, title, usage: draft ? "draft" : doc?.usage || "unknown", items }
}

export function syncStandardComposition(items: CompositionItem[], scene: StandardComposition, reset = false): CompositionItem[] {
  if (reset || !items.some(item => scene.items.some(expected => expected.id === item.id))) { return JSON.parse(JSON.stringify(scene.items)) }
  return items.map(item => {
    const next = scene.items.find(expected => expected.id === item.id)
    if (!next) { return item }
    return { ...item, raster: next.raster, text: item.text === item.raster?.detail ? next.text : item.text }
  })
}

export function standardCompositionIssues(items: CompositionItem[], scene: StandardComposition | null): string[] {
  if (!scene) { return ["尚未生成规范图件"] }
  const issues: string[] = []
  for (const expected of scene.items) {
    const actual = items.find(item => item.id === expected.id)
    if (!actual) { issues.push(`缺少${expected.label}`); continue }
    if (actual.hidden) { issues.push(`${expected.label}已隐藏`); continue }
    const fields = ["kind", "standardPart", "x", "y", "w", "h", "rotation", "text", "fontSize", "color", "align", "font", "background", "opacity"] as const
    if (fields.some(field => actual[field] !== expected[field]) || actual.raster?.image !== expected.raster?.image || actual.frameColor || actual.ruleColor) { issues.push(`${expected.label}已自由调整，正式出图前需恢复当前支持的规范版式`) }
  }
  if (items.some(item => !scene.items.some(expected => expected.id === item.id))) { issues.push("附加元素尚未纳入规范校核") }
  return issues
}
