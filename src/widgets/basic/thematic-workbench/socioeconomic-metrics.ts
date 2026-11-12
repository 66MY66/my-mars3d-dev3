import { area } from "@turf/turf"
import type { DbtLayer } from "./dbt116-standard"

export function socioeconomicMetrics(layer: DbtLayer) {
  const style = layer.thematic || {}
  const field = style.field || (layer.role === "population" ? "population" : "value")
  const inputMetric = style.inputMetric || "total"
  const polygons = layer.data.features.every(feature => ["Polygon", "MultiPolygon"].includes(feature.geometry.type))
  const mode = style.mode || (polygons ? "density" : "total")
  if ((inputMetric === "density" || mode === "density") && !polygons) { throw new Error(`${layer.name} 只有面统计单元才能计算单位面积密度或积分总量`) }
  const rawUnit = layer.role === "population" ? "人" : layer.unit?.trim()
  if (!rawUnit) { throw new Error(`${layer.name} 缺少经济指标单位`) }
  const areaSuffix = /(?:\/\s*(?:km[²2]|平方千米)|每平方千米)$/i
  if (inputMetric === "total" && areaSuffix.test(rawUnit)) { throw new Error(`${layer.name} 的单位是密度，请确认原始指标口径，不能作为总量再次除以面积`) }
  const baseUnit = rawUnit.replace(areaSuffix, "").trim()
  if (!baseUnit) { throw new Error(`${layer.name} 缺少指标基准单位`) }
  const rows = layer.data.features.map(feature => {
    const value = feature.properties?.[field]
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) { throw new Error(`${layer.name} 的 ${field} 必须是非负有限数值，缺测须显式为 null`) }
    const km2 = ["Polygon", "MultiPolygon"].includes(feature.geometry.type) ? area(feature) / 1e6 : null
    if ((inputMetric === "density" || mode === "density") && !(km2 && km2 > 0)) { throw new Error(`${layer.name} 含面积为零的统计单元`) }
    const total = value === null ? null : value * (inputMetric === "density" ? km2! : 1)
    let density: number | null = null
    if (value !== null && km2) { density = inputMetric === "density" ? value : total! / km2 }
    if ((total !== null && !Number.isFinite(total)) || (density !== null && !Number.isFinite(density))) { throw new Error(`${layer.name} 数值换算超出有效范围`) }
    return { sourceValue: value as number | null, total, density, areaKm2: km2, displayValue: mode === "density" ? density : total }
  })
  return { field, inputMetric, mode, baseUnit, unit: mode === "density" ? `${baseUnit}/km²` : baseUnit, rows }
}
