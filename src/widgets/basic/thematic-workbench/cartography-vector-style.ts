import type { DbtSymbolKind } from "./dbt116-symbols"

export type VectorPaint = { color: string; width: number; fill?: string; pattern?: number; period?: number; casing?: string; innerWidth?: number; railway?: boolean }
export const basegeoSchema = "china-basegeo-250k.gb13923.v1"
export function basegeoFallback(asset: string, p: Record<string, unknown>) {
  if (asset.endsWith("_HYDA") && Number(p.GB) === 260200) { return "water-island" }
  if (asset.endsWith("_HYDL") && [210200, 210300].includes(Number(p.GB))) { return Number(p.GB) === 210200 ? "seasonal-river" : "dry-river" }
  if (asset.endsWith("_LRDL") && [420102, 420202, 420302].includes(Number(p.GB))) { return "road-construction" }
  if (asset.endsWith("_LRRL") && Number(p.GB) === 410103) { return "rail-construction" }
  return asset.split("_").at(-1) || "boundary"
}
export const fallbackNames: Record<string, string> = { "water-island": "水中岛屿", "seasonal-river": "时令河", "dry-river": "干涸河", "road-construction": "在建公路", "rail-construction": "在建铁路" }

// GB feature classes, not administrative division codes. Only used for the documented basegeo assets.
export function basegeoFeatureSymbol(asset: string, p: Record<string, unknown>): DbtSymbolKind | undefined {
  const code = Number(p.GB)
  if (asset.endsWith("_BOUL")) {
    const boundaries: Record<number, DbtSymbolKind> = { 620200: "dbt-national-boundary", 620201: "dbt-national-boundary", 630200: "dbt-province-boundary", 630201: "dbt-province-boundary", 640200: "dbt-city-boundary", 640201: "dbt-city-boundary", 650200: "dbt-county-boundary", 650201: "dbt-county-boundary", 660200: "dbt-town-boundary", 660201: "dbt-town-boundary" }
    return boundaries[code]
  }
  if (asset.endsWith("_BOUA") && /^\d{6}$/.test(String(p.PAC)) && Number(p.PAC) % 100 !== 0) { return "dbt-county-boundary" }
  if (asset.endsWith("_LRDL")) {
    // Under-construction classes retain their distinct fallback; do not imply an open road.
    if ([420102, 420202, 420302].includes(code)) { return }
    if (String(p.RTEG).trim() === "高速") { return "dbt-expressway" }
    return ({ 420101: "dbt-national-road", 420201: "dbt-province-road", 420301: "dbt-county-road", 420400: "dbt-town-road", 440200: "dbt-village-road", 440300: "dbt-village-road" } as Record<number, DbtSymbolKind>)[code]
  }
  if (asset.endsWith("_LRRL") && [410101, 410102, 410200, 410201, 410202].includes(code)) { return "dbt-railway" }
  if (asset.endsWith("_HYDL") && [210100, 210101].includes(code)) { return "dbt-river" }
  if (asset.endsWith("_HYDA")) { return ({ 230101: "dbt-lake", 240101: "dbt-reservoir" } as Record<number, DbtSymbolKind>)[code] }
}

export const vectorPaints: Partial<Record<DbtSymbolKind, VectorPaint>> = {
  "dbt-national-boundary": { color: "#655a6e", width: 2.1, pattern: 0xff30, period: 32 },
  "dbt-province-boundary": { color: "#76667d", width: 1.7, pattern: 0xfc90, period: 32 },
  "dbt-city-boundary": { color: "#8d818f", width: 1.2, pattern: 0xf0c8, period: 24 },
  "dbt-county-boundary": { color: "#a298a5", width: 0.9, pattern: 0xf0c0, period: 20 },
  "dbt-town-boundary": { color: "#b5acb7", width: 0.7, pattern: 0xcc00, period: 16 },
  "dbt-expressway": { color: "#547c66", width: 4.2, casing: "#f7fbf8", innerWidth: 2.2 },
  "dbt-national-road": { color: "#a47a51", width: 3.2, casing: "#fff2cc", innerWidth: 1.7 },
  "dbt-province-road": { color: "#b4926d", width: 2.4, casing: "#fff7e5", innerWidth: 1.2 },
  "dbt-county-road": { color: "#b5a38b", width: 1.2 },
  "dbt-town-road": { color: "#bcaf9b", width: 0.9, pattern: 0xff00, period: 12 },
  "dbt-village-road": { color: "#c2b8a9", width: 0.7, pattern: 0xcc00, period: 10 },
  "dbt-railway": { color: "#59626a", width: 1.2, railway: true },
  "dbt-river": { color: "#5896b5", width: 1.1 },
  "dbt-lake": { color: "#5896b5", width: 0.8, fill: "#dceef6" },
  "dbt-reservoir": { color: "#5896b5", width: 0.8, fill: "#dceef6" },
  "dbt-fault": { color: "#c73743", width: 2.3 },
  "dbt-isoseismal": { color: "#df283a", width: 2.5 },
  "dbt-pga": { color: "#c73a67", width: 2.2 },
  "dbt-rescue-area": { color: "#c2175b", width: 2 }
}
export function vectorPaint(kind?: string, fallback = ""): VectorPaint {
  if (kind && Object.hasOwn(vectorPaints, kind)) { return vectorPaints[kind as DbtSymbolKind]! }
  if (fallback === "water-island") { return { color: "#a6b2ae", width: 0.6, fill: "#f7f9f9" } }
  if (["road-construction", "rail-construction"].includes(fallback)) { return { color: "#969187", width: 1.2, pattern: 0xff00, period: 14 } }
  if (fallback === "seasonal-river") { return { color: "#76a7be", width: 0.8, pattern: 0xff00, period: 12 } }
  if (fallback === "dry-river") { return { color: "#a7b1b4", width: 0.8, pattern: 0xcc00, period: 10 } }
  if (/HYD|water/.test(fallback)) { return { color: "#76a7be", width: 0.8, fill: "#e4f1f7" } }
  if (/LRD|transport/.test(fallback)) { return { color: "#b7afa2", width: 0.8 } }
  if (/LRR/.test(fallback)) { return { color: "#8f979b", width: 0.9, pattern: 0xff00, period: 14 } }
  if (/RESA|settlement-area/.test(fallback)) { return { color: "#b6b2ac", width: 0.6, fill: "#e6e3dd" } }
  return { color: "#a298a5", width: 0.9 }
}
export function paintDash(paint: VectorPaint) {
  if (!paint.pattern) { return [] }
  const bits = paint.pattern.toString(2).padStart(16, "0")
  const runs = bits.match(/1+|0+/g) || []
  return runs.map(run => run.length * (paint.period || 16) / 16)
}
export function nativeVectorPaint(paint: VectorPaint, line: boolean): Record<string, unknown> {
  if (!line) { return { color: paint.fill || paint.color, outlineColor: paint.color, outlineWidth: paint.width } }
  const style: Record<string, unknown> = { color: paint.color, width: paint.width, fill: true, outline: false, closure: false }
  if (paint.pattern) { Object.assign(style, { materialType: "PolylineDash", materialOptions: { color: paint.color, dashLength: paint.period, dashPattern: paint.pattern } }) }
  if (paint.casing) { Object.assign(style, { materialType: "PolylineOutline", materialOptions: { color: paint.casing, outlineColor: paint.color, outlineWidth: (paint.width - paint.innerWidth!) / 2 } }) }
  if (paint.railway) { Object.assign(style, { width: 4, materialType: "LineCross", materialOptions: { color: paint.color, dashLength: 16, maskLength: 3, centerPower: 0.25, dashPower: 0.2 } }) }
  return style
}
export function strokeCartographyLine(ctx: CanvasRenderingContext2D, paint: VectorPaint, points?: number[][]) {
  ctx.strokeStyle = paint.color; ctx.lineWidth = paint.width; ctx.setLineDash(paintDash(paint)); ctx.stroke()
  if (paint.casing) { ctx.strokeStyle = paint.casing; ctx.lineWidth = paint.innerWidth!; ctx.setLineDash([]); ctx.stroke() }
  if (paint.railway && points) {
    ctx.setLineDash([]); ctx.lineWidth = 0.8
    let remainder = 8
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]; const b = points[i]; const dx = b[0] - a[0]; const dy = b[1] - a[1]; const length = Math.hypot(dx, dy)
      if (!length) { continue }
      for (; remainder <= length; remainder += 16) {
        const x = a[0] + dx * remainder / length; const y = a[1] + dy * remainder / length
        ctx.beginPath(); ctx.moveTo(x - dy / length * 3, y + dx / length * 3); ctx.lineTo(x + dy / length * 3, y - dx / length * 3); ctx.stroke()
      }
      remainder -= length
    }
  }
}
