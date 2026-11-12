import { dbtTemplates, dbtTitle, type DbtBounds, type DbtDocument, type DbtTemplateId } from "./dbt116-standard"
import { dbtRoleNames } from "./dbt-cartography-rules"
import { drawCartographyText, measureCartographyText } from "./cartography-text"

// A camera image is a draft reference, never an EPSG:4490 data layer.
export type DbtMapPreview = {
  image: string
  bounds: DbtBounds | null
  capturedAt: string
  view: "selection" | "viewport"
}

export type DbtCatalogPlate = { title: string; description: string; generic?: boolean }

export function draftRequirements(doc: DbtDocument | null, id: DbtTemplateId) {
  const template = dbtTemplates.find(item => item.id === id)!
  const present = new Set(doc?.layers.filter(layer => layer.enabled !== false && (layer.data.features.length || layer.raster || layer.grid)).map(layer => layer.role))
  return [
    { role: "intensity", label: dbtRoleNames.intensity, present: present.has("intensity") },
    { role: "topic", label: `${template.roles.map(role => dbtRoleNames[role]).join(" / ")}（至少一类）`, present: template.roles.some(role => present.has(role)) }
  ]
}

export async function drawDbtDraft(ctx: CanvasRenderingContext2D, doc: DbtDocument | null, id: DbtTemplateId, preview?: DbtMapPreview | null, catalog?: DbtCatalogPlate) {
  const template = dbtTemplates.find(item => item.id === id)!
  const text = (value: string, x: number, y: number, width: number, height: number, size = 24, bold = false, center = false) => {
    const layout = measureCartographyText(ctx, value, width, height, size, bold, Math.max(14, Math.floor(size * 0.75)))
    if (!layout.fits) { throw new Error(`草稿文字超出版面，请精简内容或分幅：${value.slice(0, 40)}`) }
    drawCartographyText(ctx, layout, x, y, width, height, bold, center)
  }
  const completeEvent = doc?.event.time && doc.event.place && doc.event.magnitude > 0
  text(catalog?.title || (completeEvent ? dbtTitle(doc!, id) : template.name), 88, 44, 1504, 110, 36, true, true)
  ctx.strokeStyle = "#7e8b90"; ctx.lineWidth = 1; ctx.strokeRect(88, 196, 1076, 802)
  ctx.fillStyle = "#edf1f2"; ctx.fillRect(89, 197, 1074, 800)
  if (preview) {
    const image = new Image(); image.src = preview.image; await image.decode()
    const scale = Math.min(1074 / image.naturalWidth, 800 / image.naturalHeight)
    const width = image.naturalWidth * scale; const height = image.naturalHeight * scale
    ctx.drawImage(image, 89 + (1074 - width) / 2, 197 + (800 - height) / 2, width, height)
  } else {
    text(catalog ? "地图主图" : "底图待采集", 89, 510, 1074, 70, 36, true, true)
    text("专题数据未载入", 89, 582, 1074, 60, 24, false, true)
  }
  text("内容说明", 1230, 196, 388, 48, 27, true)
  text(catalog?.description || doc?.description || template.summary, 1230, 253, 388, 230, 23)
  text("专题数据", 1230, 508, 388, 48, 27, true)
  const requirements = catalog?.generic ? ["专题图层 · 待载入", "来源、时间及单位 · 待核验"] : draftRequirements(doc, id).map(item => `${item.label} · ${item.present ? "已载入，待核验" : "待导入"}`)
  requirements.forEach((value, i) => text(value, 1230, 568 + i * 94, 388, 88, 19))
  text("图例", 1230, 895, 388, 42, 27, true)
  text("待专题图层生成", 1230, 947, 388, 44, 22)
  const source = preview ? `${preview.view === "selection" ? "框选底图" : "当前地图视图"} · ${new Date(preview.capturedAt).toLocaleString()}` : "底图来源待补充"
  text(catalog ? "数据来源：待接入\n坐标基准、比例尺与方位：随图件校核" : `${source}\n屏幕影像未地理配准，方位与比例尺待核验`, 88, 1040, 1035, 85, 20)
  text(`制作单位：${doc?.agency || "待填写"}\n制图时间：${doc?.createdAt || "待填写"}`, 1230, 1040, 388, 90, 20)
  ctx.fillStyle = "#8b3227"; ctx.fillRect(88, 1140, 1530, 34)
  ctx.fillStyle = "#fff"; ctx.font = "bold 19px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText(catalog ? "版式预览 · 未载入业务数据" : "底图草稿 · 未生成专题成果 · 禁止正式使用", 853, 1157)
}
