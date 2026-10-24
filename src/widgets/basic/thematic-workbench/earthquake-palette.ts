import type { EarthquakeOperation } from "./earthquake-analysis"

export type EarthquakePalette = {
  operation: EarthquakeOperation
  name: string
  note: string
  standardUrl?: string
  entries: Array<{ band: string; label: string; color: string }>
}

// GB/T 38226-2019, 6.5.2: use the specified RGB values, not sampled PDF swatches.
export const INTENSITY_COLORS = {
  VI: "#ffd2da", VII: "#ffbebe", VIII: "#ff7f7f", IX: "#c82828", X: "#a80000", XI: "#8c0000"
} as const
export const EARTHQUAKE_COLORS = {
  thermal: { cold: "#9aa6b2", background: "#fee08b", hot: "#d73027" },
  deformation: { negative: "#2166ac", neutral: "#f7f7f7", positive: "#b2182b" },
  risk: { low: "#27925d", medium: "#f2c94c", high: "#d83b36" }
} as const

export function earthquakePalette(operation: EarthquakeOperation, thresholds: { thermalZ: number; deformationMm: number; riskHigh: number }, losConvention: unknown): EarthquakePalette {
  const { thermalZ: z, deformationMm: mm, riskHigh: high } = thresholds
  if (operation === "thermal") {
    const colors = EARTHQUAKE_COLORS.thermal
    return {
      operation,
      name: "热异常 · 红黄分级",
      note: "Z 为基准期标准化亮温偏差；偏冷用中性灰区分，不表示地震前兆。",
      entries: [
        { band: "偏冷", label: `偏冷 · Z ≤ −${z}`, color: colors.cold },
        { band: "背景范围", label: `背景范围 · −${z} < Z < ${z}`, color: colors.background },
        { band: "热异常", label: `热异常 · Z ≥ ${z}`, color: colors.hot }
      ]
    }
  }
  if (operation === "deformation") {
    const colors = EARTHQUAKE_COLORS.deformation
    const positive = losConvention === "toward_positive" ? "朝向卫星" : "远离卫星"
    const negative = losConvention === "toward_positive" ? "远离卫星" : "朝向卫星"
    return {
      operation,
      name: "LOS 形变 · 蓝白红",
      note: `正值表示${positive}，负值表示${negative}；LOS 位移不等同于垂直升降。`,
      entries: [
        { band: "LOS 负向", label: `LOS ≤ −${mm} mm · ${negative}`, color: colors.negative },
        { band: "低于阈值", label: `−${mm} < LOS < ${mm} mm`, color: colors.neutral },
        { band: "LOS 正向", label: `LOS ≥ ${mm} mm · ${positive}`, color: colors.positive }
      ]
    }
  }
  if (operation === "risk") {
    const colors = EARTHQUAKE_COLORS.risk
    return {
      operation,
      name: "相对风险 · 绿黄红",
      note: `R = 危险性 × 暴露 × 脆弱性；H = ${high}，关注界值为 H/3。业务筛查分级，非国家风险等级或损失概率。`,
      entries: [
        { band: "常规", label: `常规 · 0 ≤ R < ${high}/3`, color: colors.low },
        { band: "关注", label: `关注 · ${high}/3 ≤ R < ${high}`, color: colors.medium },
        { band: "优先核查", label: `优先核查 · ${high} ≤ R ≤ 1`, color: colors.high }
      ]
    }
  }
  return {
    operation,
    name: "烈度 · 国标推荐色",
    note: "配色：GB/T 38226-2019 §6.5.2。当前为 VI–XI 仪器初判点，不替代正式烈度评定或等震线面成果。",
    standardUrl: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=67C05528A050DE2BAF7D61B9087516A7",
    entries: Object.entries(INTENSITY_COLORS).map(([band, color], index) => ({ band, label: `${band} 度（${index + 6} 度）`, color }))
  }
}

export function earthquakeLegend(palette: EarthquakePalette) {
  return palette.entries.map(({ label, color }) => ({ label, color }))
}
