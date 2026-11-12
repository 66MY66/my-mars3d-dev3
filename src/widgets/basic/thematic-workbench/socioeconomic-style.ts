import { classBreaks } from "./render-style"
import { sampleTemplatePalette } from "./template-palettes"
import type { DbtLayer } from "./dbt116-standard"
import { socioeconomicMetrics } from "./socioeconomic-metrics"

export type SocioeconomicStyle = { mode?: "total" | "density"; inputMetric?: "total" | "density"; field?: string; method?: "natural" | "equal" | "quantile"; count?: number; labels?: boolean }
const palettes = {
  population: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"],
  economy: ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"]
}
const format = (value: number) => Number(value.toPrecision(6)).toLocaleString("zh-CN", { maximumSignificantDigits: 6 })

// Derive the visual variables from the same scoped features used by statistics.
export function styleSocioeconomicLayer(layer: DbtLayer): DbtLayer {
  if (!Object.hasOwn(palettes, layer.role) || layer.raster || !layer.data.features.length) { return layer }
  const style = layer.thematic || {}
  const { field, mode, inputMetric, unit, rows } = socioeconomicMetrics(layer)
  const density = mode === "density"
  const values = rows.map(row => row.displayValue)
  const positive = values.filter((value): value is number => value !== null && value > 0)
  const method = style.method || "natural"
  const count = style.count ?? 5
  if (!["natural", "equal", "quantile"].includes(method) || !Number.isInteger(count) || count < 2 || count > 9) { throw new Error(`${layer.name} 的分级方法或分级数量无效`) }
  const breaks = [...new Set(classBreaks(positive, method, count))]
  const colors = breaks.map((_, i) => sampleTemplatePalette(palettes[layer.role as keyof typeof palettes], i / Math.max(1, breaks.length - 1)))
  const minimum = positive.length ? Math.min(...positive) : 0
  const metric = { population: density ? "人口密度" : "人口", economy: density ? "经济密度" : "经济指标" }[layer.role]
  const maximum = positive.length ? Math.max(...positive) : 0
  const totalColor = palettes[layer.role as keyof typeof palettes][3]
  const legend: NonNullable<DbtLayer["legend"]> = density
    ? breaks.map((end, i) => ({ label: `${i ? "(" : "["}${format(i ? breaks[i - 1] : minimum)}, ${format(end)}] ${unit}`, color: colors[i], value: end })).reverse()
    : [...new Set([maximum, maximum / 2, maximum / 4].filter(value => value > 0).map(value => layer.role === "population" && maximum >= 1 ? Math.max(1, Math.round(value)) : value))].map(value => ({ label: `${format(value)} ${unit}`, color: totalColor, value, radius: 20 * Math.sqrt(value / maximum) }))
  if (values.includes(0)) { legend.push({ label: `0 ${unit}`, color: "#ffffff", value: 0 }) }
  if (values.includes(null)) { legend.push({ label: "缺测 / 未提供", color: "#d9dee5", noData: true }) }
  const features = layer.data.features.map((feature, i) => {
    const value = values[i]
    const band = value === null ? -1 : breaks.findIndex(end => value <= end)
    const name = String(feature.properties?.name || feature.properties?.region_name || "")
    const labels = style.labels ?? layer.data.features.length <= 20
    let color = totalColor
    if (density) { color = colors[band < 0 ? colors.length - 1 : band] }
    if (value === 0) { color = "#ffffff" }
    if (value === null) { color = "#d9dee5" }
    return {
 ...feature,
properties: {
 ...feature.properties,
      color,
      label: labels ? `${name ? `${name} · ` : ""}${value === null ? "缺测" : `${format(value)} ${unit}`}` : "",
      thematicRadius: maximum && value !== null ? 20 * Math.sqrt(value / maximum) : 0,
      thematicNoData: value === null,
      thematicMode: density ? "density" : "total",
      thematicValue: values[i],
thematicMetric: metric
    } 
}
  })
  return {
 ...layer,
data: { ...layer.data, features },
legend,
    colorStandard: `${field} 原始${inputMetric === "density" ? "密度" : "总量"}；${density ? "密度分级设色" : "符号面积与总量成正比"}；零值及缺测独立表达；${{ natural: "自然断点", equal: "等距", quantile: "分位数" }[method]}` 
}
}
