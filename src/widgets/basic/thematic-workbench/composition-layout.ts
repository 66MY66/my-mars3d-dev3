import type { CompositionItem } from "./composition-model"
import { STANDARD_SLOTS, standardChartSlots } from "./cartography-standard-layout"

const names: Record<string, string> = {
  choropleth: "分级设色",
"unique-value": "唯一值分类",
"graduated-symbol": "分级符号",
"point-heat": "点热力",
  "raster-ramp": "栅格色带",
"raster-threshold": "栅格阈值",
contour: "等值线",
trajectory: "轨迹回放",
  "flow-direction": "流向",
"risk-overlay": "风险叠加",
"time-compare": "时相对比",
"chart-linkage": "图表联动",
  "anomaly-composite": "综合异常",
"thermal-infrared": "热红外",
"post-quake-risk": "震后风险",
"swarm-trajectory": "震群轨迹",
  "insar-deformation": "InSAR 形变",
"intensity-distribution": "烈度分布",
"secondary-hazard": "次生灾害",
  "building-resilience": "建筑抗震",
"population-exposure": "人口暴露",
"emergency-command": "应急指挥"
}
export const templateLayoutProfiles = Object.fromEntries(Object.entries(names).map(([kind, name]) => [kind, { name: `${name} · A3 四区版式`, family: "standard", accent: "#222222" }]))

export function applyTemplateLayout(items: CompositionItem[], kind: string): CompositionItem[] {
  const charts = items.filter(item => item.kind === "chart")
  const slots = standardChartSlots(charts.length)
  return items.map<CompositionItem>(item => {
    const slot = item.kind === "chart" ? slots[charts.indexOf(item)] : STANDARD_SLOTS[item.kind as keyof typeof STANDARD_SLOTS]
    if (!slot) { return item }
    return {
      ...item,
...slot,
...(item.kind === "legend" && charts.length ? { h: 176 } : {}),
      positioned: true,
rotation: 0,
color: "#222222",
background: "transparent",
font: "sans",
      fontSize: item.kind === "title" ? 36 : 21,
align: item.kind === "title" ? "center" : "left",
      frameColor: undefined,
ruleColor: undefined,
legendFlow: "rows",
templateKind: item.kind === "map" ? kind : undefined
    }
  })
}
