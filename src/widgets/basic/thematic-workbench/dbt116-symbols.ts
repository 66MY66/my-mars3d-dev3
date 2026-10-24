const thematic = [
  ["current-epicenter", "当前地震震中", "当前震中"], ["historical-epicenter", "历史地震震中", "历史震中"],
  ["aftershock", "余震震中", "余震震中"], ["station", "地震监测中心站", "监测中心站"],
  ["geohazard", "地震地质灾害", "地质灾害"], ["rescue-target", "重点救灾目标", "救灾目标"],
  ["rescue-area", "重点救援建议区域", "救援建议区"], ["fault", "活动断层", "活动断层"],
  ["isoseismal", "快速评估烈度等震线", "烈度等震线"], ["pga", "地震动峰值加速度等值线", "加速度等值线"],
  ["refuge", "应急避难场所", "避难场所"], ["airport", "机场", "机场"], ["school", "学校", "学校"], ["medical", "医院", "医院"]
] as const
const geographic = [
  ["capital", "首都", "首都"], ["province-seat", "省级政府驻地", "省级驻地"], ["city-seat", "市级政府驻地", "市级驻地"],
  ["county-seat", "县级政府驻地", "县级驻地"], ["town-seat", "乡级政府驻地", "乡级驻地"], ["village", "村庄", "村庄"],
  ["national-boundary", "国界", "国界"], ["province-boundary", "省级行政区划界线", "省级界线"],
  ["city-boundary", "地级行政区划界线", "地级界线"], ["county-boundary", "县级行政区划界线", "县级界线"],
  ["town-boundary", "乡级行政区划界线", "乡级界线"], ["railway", "铁路", "铁路"], ["expressway", "高速公路", "高速公路"],
  ["national-road", "国道", "国道"], ["province-road", "省道", "省道"], ["county-road", "县道", "县道"],
  ["town-road", "乡道", "乡道"], ["village-road", "村道", "村道"], ["river", "河流", "河流"], ["lake", "湖泊", "湖泊"], ["reservoir", "水库", "水库"]
] as const
export type DbtSymbolKind = `dbt-${(typeof thematic)[number][0] | (typeof geographic)[number][0]}`
export type DbtSymbol = {
  kind: DbtSymbolKind; label: string; shortLabel: string; family: "basic" | "earthquake"; icon: string; accent: string
  standardAsset: string; reference: string; fixedColors: boolean; priority: number; geometry: "point" | "line" | "area"
}
export const dbtSymbolDefinitions = Object.fromEntries([thematic, geographic].flatMap((rows, group) => rows.map(([id, label, shortLabel], index) => {
  const kind = `dbt-${id}` as DbtSymbolKind
  const line = group === 1 ? index >= 6 && index <= 17 : [7, 8, 9].includes(index)
  let geometry: DbtSymbol["geometry"] = "point"
  if (id === "rescue-area" || index >= 18) { geometry = "area" }
  if (line) { geometry = "line" }
  return [kind, {
 kind,
label,
shortLabel,
family: group ? "basic" : "earthquake",
icon: "",
accent: "#202020",
    standardAsset: `dbt116-b${group + 1}-${String(index + 1).padStart(2, "0")}.png`,
reference: `地震应急响应专题图制作要求（报批稿）表 B.${group + 1} 第 ${index + 1} 项`,
    fixedColors: true,
priority: id === "current-epicenter" ? 100 : 0,
geometry 
}]
}))) as Record<DbtSymbolKind, DbtSymbol>
