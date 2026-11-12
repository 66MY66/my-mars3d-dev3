import { dbtTemplates } from "./dbt116-standard"
import { renderDbtMap } from "./dbt116-renderer"
import { productDefinitions } from "./product-definitions"

const previews = new Map<string, Promise<string>>()

export function templateLayoutPlate(name: string) {
  const template = dbtTemplates.find(item => item.name === name)
  const product = productDefinitions.find(item => item.name === name)
  return {
    id: template?.id || "T30101000" as const,
    plate: { title: name, description: template?.summary || (product ? `${product.purpose}${product.expression}` : "专题内容、统计与图例随接入的业务图层生成。当前仅展示图件版式，不包含示例业务数据。"), generic: !template }
  }
}

export function renderTemplateLayoutPreview(name: string): Promise<string> {
  if (!previews.has(name)) {
    const pending = (async () => {
      await document.fonts.ready
      const canvas = document.createElement("canvas")
      const { id, plate } = templateLayoutPlate(name)
      await renderDbtMap(canvas, null, id, { layoutOnly: true, catalogPlate: plate })
      return canvas.toDataURL("image/png")
    })().catch(error => { previews.delete(name); throw error })
    previews.set(name, pending)
  }
  return previews.get(name)!
}
