import { dbtTemplates, dbtTitle, type DbtBounds, type DbtDocument, type DbtTemplateId } from "./dbt116-standard"
import { dbtRoleNames } from "./dbt-cartography-rules"

// A camera image is a draft reference, never an EPSG:4490 data layer.
export type DbtMapPreview = {
  image: string
  bounds: DbtBounds | null
  capturedAt: string
  view: "selection" | "viewport"
}

export function draftRequirements(doc: DbtDocument | null, id: DbtTemplateId) {
  const template = dbtTemplates.find(item => item.id === id)!
  const present = new Set(doc?.layers.filter(layer => layer.enabled !== false && (layer.data.features.length || layer.raster)).map(layer => layer.role))
  return ["intensity", ...template.roles].map(role => ({ role, label: dbtRoleNames[role], present: present.has(role) }))
}

export async function drawDbtDraft(ctx: CanvasRenderingContext2D, doc: DbtDocument | null, id: DbtTemplateId, preview?: DbtMapPreview | null) {
  const template = dbtTemplates.find(item => item.id === id)!
  const text = (value: string, x: number, y: number, width: number, height: number, size = 24, bold = false) => {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip()
    ctx.fillStyle = "#26343b"; ctx.font = `${bold ? "bold " : ""}${size}px sans-serif`; ctx.textAlign = "left"; ctx.textBaseline = "top"
    let row = ""; let line = 0
    for (const char of value) {
      if (char === "\n" || (row && ctx.measureText(row + char).width > width)) { ctx.fillText(row, x, y + line++ * size * 1.5); row = "" }
      if (char !== "\n") { row += char }
    }
    if (row) { ctx.fillText(row, x, y + line * size * 1.5) }; ctx.restore()
  }
  const completeEvent = doc?.event.time && doc.event.place && doc.event.magnitude > 0
  text(completeEvent ? dbtTitle(doc!, id) : template.name, 88, 44, 1504, 110, 36, true)
  ctx.strokeStyle = "#7e8b90"; ctx.lineWidth = 1; ctx.strokeRect(88, 196, 1076, 802)
  ctx.fillStyle = "#edf1f2"; ctx.fillRect(89, 197, 1074, 800)
  if (preview) {
    const image = new Image(); image.src = preview.image; await image.decode()
    const scale = Math.min(1074 / image.naturalWidth, 800 / image.naturalHeight)
    const width = image.naturalWidth * scale; const height = image.naturalHeight * scale
    ctx.drawImage(image, 89 + (1074 - width) / 2, 197 + (800 - height) / 2, width, height)
  } else {
    text("底图待采集", 420, 510, 650, 70, 36, true)
    text("专题数据未载入", 420, 582, 650, 60, 24)
  }
  text("内容说明", 1230, 196, 388, 48, 27, true)
  text(doc?.description || template.summary, 1230, 253, 388, 230, 23)
  text("专题数据", 1230, 508, 388, 48, 27, true)
  draftRequirements(doc, id).forEach((item, i) => text(`${item.label} · ${item.present ? "已载入，待核验" : "待导入"}`, 1230, 568 + i * 38, 388, 37, 19))
  text("图例", 1230, 895, 388, 42, 27, true)
  text("待专题图层生成", 1230, 947, 388, 44, 22)
  const source = preview ? `${preview.view === "selection" ? "框选底图" : "当前地图视图"} · ${new Date(preview.capturedAt).toLocaleString()}` : "底图来源待补充"
  text(`${source}\n屏幕影像未地理配准，方位与比例尺待核验`, 88, 1040, 1035, 85, 20)
  text(`制作单位：${doc?.agency || "待填写"}\n制图时间：${doc?.createdAt || "待填写"}`, 1230, 1040, 388, 90, 20)
  ctx.fillStyle = "#8b3227"; ctx.fillRect(88, 1140, 1530, 34)
  ctx.fillStyle = "#fff"; ctx.font = "bold 19px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText("底图草稿 · 未生成专题成果 · 禁止正式使用", 853, 1157)
}
