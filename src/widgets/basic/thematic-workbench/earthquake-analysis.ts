import { EARTHQUAKE_COLORS, INTENSITY_COLORS, earthquakePalette, type EarthquakePalette } from "./earthquake-palette"

export type EarthquakeOperation = "thermal" | "deformation" | "risk" | "intensity"
export type GeoBounds = { west: number; south: number; east: number; north: number }
export type EarthquakePoint = { lon: number; lat: number; value: number; label: string; band: string; color: string; time?: number; track?: string }
export type EarthquakeResultFilter = { min: number | null; max: number | null; band: string; bounds: GeoBounds | null }
export type EarthquakeDataset = {
  source: string
  observedAt: string
  metadata: Record<string, unknown>
  features: Array<{ lon: number; lat: number; properties: Record<string, unknown> }>
}
export type EarthquakeResult = {
  operation: EarthquakeOperation
  palette: EarthquakePalette
  points: EarthquakePoint[]
  totalInScope: number
  excludedCount: number
  unit: string
  method: string
  caution: string
  metrics: Array<{ label: string; value: string }>
  rows: Array<{ label: string; value: number; color: string }>
}

export const EARTHQUAKE_IMPORT_TEMPLATE = {
  type: "FeatureCollection",
  metadata: {
    source: "",
    observedAt: "",
    temperatureUnit: "K",
    baselinePeriod: "",
    losUnit: "mm",
    losConvention: "toward_positive",
    acquisitionPair: "",
    riskModel: "relative-screening-v1",
    intensityStandard: "GB/T 17742-2020",
    analysisParams: { thermalZ: 2, coherenceMin: 0.4, deformationMm: 20, riskHigh: 0.25 }
  },
  fieldGuide: {
    thermal: "lst_k, baseline_mean_k, baseline_sd_k, baseline_count, quality_flag=good",
    deformation: "los_mm, coherence",
    risk: "hazard_index, exposure_index, vulnerability_index (0–1)",
    intensity: "pga_ms2, pgv_ms"
  },
  features: []
}

const INTENSITY_BANDS = [
  { grade: "VI", pga: [0.457, 0.963], pgv: [0.038, 0.082], color: INTENSITY_COLORS.VI },
  { grade: "VII", pga: [0.937, 1.94], pgv: [0.082, 0.176], color: INTENSITY_COLORS.VII },
  { grade: "VIII", pga: [1.95, 4.01], pgv: [0.177, 0.378], color: INTENSITY_COLORS.VIII },
  { grade: "IX", pga: [4.02, 8.30], pgv: [0.379, 0.814], color: INTENSITY_COLORS.IX },
  { grade: "X", pga: [8.31, 17.20], pgv: [0.815, 1.750], color: INTENSITY_COLORS.X },
  { grade: "XI", pga: [17.30, 35.50], pgv: [1.760, 3.770], color: INTENSITY_COLORS.XI }
] as const

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function positive(value: unknown): number | null {
  const number = finite(value)
  return number !== null && number > 0 ? number : null
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function parseEarthquakeGeoJson(raw: unknown): EarthquakeDataset {
  const root = record(raw)
  const metadata = record(root?.metadata)
  if (root?.type !== "FeatureCollection" || !Array.isArray(root.features) || !metadata) {
    throw new Error("需要包含 metadata 和 Point features 的 GeoJSON FeatureCollection")
  }
  const source = String(metadata.source || "").trim()
  const observedAt = String(metadata.observedAt || "").trim()
  if (!source || !observedAt || Number.isNaN(Date.parse(observedAt))) {
    throw new Error("请填写有效的数据来源 source 和观测时间 observedAt")
  }
  if (!root.features.length || root.features.length > 2000) { throw new Error("观测点数量须为 1–2000") }
  const features = root.features.map((item: unknown, index: number) => {
    const feature = record(item)
    const geometry = record(feature?.geometry)
    const coordinates = geometry?.coordinates
    const properties = record(feature?.properties)
    const lon = Array.isArray(coordinates) ? finite(coordinates[0]) : null
    const lat = Array.isArray(coordinates) ? finite(coordinates[1]) : null
    if (feature?.type !== "Feature" || geometry?.type !== "Point" || lon === null || lat === null || !properties || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      throw new Error(`第 ${index + 1} 个观测点的坐标或属性无效`)
    }
    return { lon, lat, properties }
  })
  return { source: source.slice(0, 120), observedAt, metadata, features }
}

function requireMetadata(metadata: Record<string, unknown>, key: string, expected: string, label: string) {
  if (metadata[key] !== expected) { throw new Error(`${label}须为 ${expected}`) }
}

function bands(points: EarthquakePoint[], palette: EarthquakePalette) {
  const counts = new Map<string, { value: number; color: string }>()
  for (const point of points) {
    const entry = counts.get(point.band)
    counts.set(point.band, { value: (entry?.value || 0) + 1, color: point.color })
  }
  return palette.entries.filter(entry => counts.has(entry.band)).map(entry => ({ label: entry.band, value: counts.get(entry.band)!.value, color: entry.color }))
}

export function filterEarthquakePoints(points: EarthquakePoint[], filter: EarthquakeResultFilter): EarthquakePoint[] {
  return points.filter((point) => {
    if (filter.min !== null && point.value < filter.min) { return false }
    if (filter.max !== null && point.value > filter.max) { return false }
    if (filter.band !== "all" && point.band !== filter.band) { return false }
    const bounds = filter.bounds
    return !bounds || (point.lon >= bounds.west && point.lon <= bounds.east && point.lat >= bounds.south && point.lat <= bounds.north)
  })
}

export function loadEarthquakeParameters(metadata: Record<string, unknown>) {
  const source = record(metadata.analysisParams)
  const within = (key: string, fallback: number, min: number, max: number) => {
    const value = finite(source?.[key])
    return value !== null && value >= min && value <= max ? value : fallback
  }
  return {
    thermalZ: within("thermalZ", 2, 1, 5),
    coherenceMin: within("coherenceMin", 0.4, 0.2, 0.9),
    deformationMm: within("deformationMm", 20, 5, 100),
    riskHigh: within("riskHigh", 0.25, 0.05, 0.8)
  }
}

function classifyIntensity(value: number, field: "pga" | "pgv") {
  return INTENSITY_BANDS.filter((band) => value >= band[field][0] && value <= band[field][1])
}

export function analyzeEarthquakeDataset(dataset: EarthquakeDataset, operation: EarthquakeOperation, bounds: GeoBounds, options: { thermalZ?: number; coherenceMin?: number; deformationMm?: number; riskHigh?: number } = {}): EarthquakeResult {
  if (bounds.west >= bounds.east || bounds.south >= bounds.north) { throw new Error("请先锁定有效制图范围") }
  const metadata = dataset.metadata
  if (operation === "thermal") {
    requireMetadata(metadata, "temperatureUnit", "K", "热红外温度单位")
    if (!String(metadata.baselinePeriod || "").trim()) { throw new Error("请提供热异常基准期 baselinePeriod") }
  }
  if (operation === "deformation") {
    requireMetadata(metadata, "losUnit", "mm", "LOS 形变单位")
    if (metadata.losConvention !== "toward_positive" && metadata.losConvention !== "away_positive") { throw new Error("请声明 LOS 正值方向 losConvention") }
    if (!String(metadata.acquisitionPair || "").trim()) { throw new Error("请提供 InSAR 影像对 acquisitionPair") }
  }
  if (operation === "risk") { requireMetadata(metadata, "riskModel", "relative-screening-v1", "风险模型") }
  if (operation === "intensity") { requireMetadata(metadata, "intensityStandard", "GB/T 17742-2020", "烈度参考标准") }
  const scoped = dataset.features.filter((feature) => feature.lon >= bounds.west && feature.lon <= bounds.east && feature.lat >= bounds.south && feature.lat <= bounds.north)
  if (!scoped.length) { throw new Error("框选范围内没有观测点") }
  const points: EarthquakePoint[] = []
  const thermalThreshold = Math.max(1, Math.min(5, options.thermalZ ?? 2))
  const coherenceMin = Math.max(0.2, Math.min(0.9, options.coherenceMin ?? 0.4))
  const deformationMm = Math.max(1, Math.min(100, options.deformationMm ?? 20))
  const riskHigh = Math.max(0.05, Math.min(0.8, options.riskHigh ?? 0.25))
  for (const feature of scoped) {
    const p = feature.properties
    const { lon, lat } = feature
    const timestamp = typeof p.observedAt === "string" ? Date.parse(p.observedAt) : NaN
    const temporal = { time: Number.isFinite(timestamp) ? timestamp : undefined, track: typeof p.track_id === "string" ? p.track_id : undefined }
    if (operation === "thermal") {
      const lst = finite(p.lst_k)
      const baseline = finite(p.baseline_mean_k)
      const sd = positive(p.baseline_sd_k)
      const count = finite(p.baseline_count)
      if (p.quality_flag !== "good" || lst === null || baseline === null || sd === null || count === null || count < 10 || lst < 180 || lst > 370) { continue }
      const z = (lst - baseline) / sd
      let band = "背景范围"
      let color: string = EARTHQUAKE_COLORS.thermal.background
      if (z >= thermalThreshold) { band = "热异常"; color = EARTHQUAKE_COLORS.thermal.hot }
      if (z <= -thermalThreshold) { band = "偏冷"; color = EARTHQUAKE_COLORS.thermal.cold }
      points.push({ lon, lat, ...temporal, value: z, label: `Z ${z.toFixed(2)} · LST ${lst.toFixed(1)} K`, band, color })
    } else if (operation === "deformation") {
      const los = finite(p.los_mm)
      const coherence = finite(p.coherence)
      if (los === null || coherence === null || coherence < coherenceMin || coherence > 1) { continue }
      let band = "低于阈值"
      let color: string = EARTHQUAKE_COLORS.deformation.neutral
      if (los >= deformationMm) { band = "LOS 正向"; color = EARTHQUAKE_COLORS.deformation.positive }
      if (los <= -deformationMm) { band = "LOS 负向"; color = EARTHQUAKE_COLORS.deformation.negative }
      points.push({ lon, lat, ...temporal, value: los, label: `${los.toFixed(1)} mm · 相干性 ${coherence.toFixed(2)}`, band, color })
    } else if (operation === "risk") {
      const hazard = finite(p.hazard_index)
      const exposure = finite(p.exposure_index)
      const vulnerability = finite(p.vulnerability_index)
      if (hazard === null || exposure === null || vulnerability === null || [hazard, exposure, vulnerability].some((value) => value < 0 || value > 1)) { continue }
      const score = hazard * exposure * vulnerability
      let band = "常规"
      let color: string = EARTHQUAKE_COLORS.risk.low
      if (score >= riskHigh / 3) { band = "关注"; color = EARTHQUAKE_COLORS.risk.medium }
      if (score >= riskHigh) { band = "优先核查"; color = EARTHQUAKE_COLORS.risk.high }
      points.push({ lon, lat, ...temporal, value: score, label: `相对风险 ${score.toFixed(3)}`, band, color })
    } else {
      const pga = positive(p.pga_ms2)
      const pgv = positive(p.pgv_ms)
      if (pga === null || pgv === null) { continue }
      const pgaBands = classifyIntensity(pga, "pga")
      const pgvBands = classifyIntensity(pgv, "pgv")
      if (pgaBands.length !== 1 || pgvBands.length !== 1 || pgaBands[0].grade !== pgvBands[0].grade) { continue }
      const agreed = pgaBands[0]
      points.push({ lon, lat, ...temporal, value: INTENSITY_BANDS.findIndex((band) => band.grade === agreed.grade) + 6, label: `${agreed.grade} · PGA ${pga.toFixed(3)} m/s² · PGV ${pgv.toFixed(3)} m/s`, band: agreed.grade, color: agreed.color })
    }
  }
  if (!points.length) {
    const reasons: Record<EarthquakeOperation, string> = {
      thermal: "请检查亮温、基准期、样本数和质量标记",
      deformation: "请检查 LOS 形变、相干性和阈值",
      risk: "请检查危险性、暴露和脆弱性指数",
      intensity: "PGA/PGV 无同级匹配，请核查观测或模型"
    }
    const reason = reasons[operation]
    throw new Error(`无有效${operation === "intensity" ? "初判" : "分析"}点：${reason}`)
  }
  const values = points.map((point) => point.value)
  const palette = earthquakePalette(operation, { thermalZ: thermalThreshold, deformationMm, riskHigh }, metadata.losConvention)
  const common = { operation, palette, points, totalInScope: scoped.length, excludedCount: scoped.length - points.length, rows: bands(points, palette) }
  if (operation === "thermal") {
    return {
      ...common,
      unit: "Z",
      method: "亮温时序基准标准化",
      caution: "热异常不等于地震前兆；仅保留质量合格且基准样本数≥10的观测点。",
      metrics: [
        { label: "有效点", value: String(points.length) },
        { label: "最高 Z", value: Math.max(...values).toFixed(2) },
        { label: "热异常", value: String(points.filter((point) => point.band === "热异常").length) }
      ]
    }
  }
  if (operation === "deformation") {
    return {
      ...common,
      unit: "mm",
      method: "相干性筛选 · LOS 位移",
      caution: "LOS 正负号按数据声明解释，不等同于垂直升降；低相干点已剔除。",
      metrics: [
        { label: "有效点", value: String(points.length) },
        { label: "最大 |LOS|", value: `${Math.max(...values.map(Math.abs)).toFixed(1)} mm` },
        { label: "均值 |LOS|", value: `${average(values.map(Math.abs)).toFixed(1)} mm` }
      ]
    }
  }
  if (operation === "risk") {
    return {
      ...common,
      unit: "0–1",
      method: "危险性 × 暴露 × 脆弱性",
      caution: "相对风险筛查指数，不是人员伤亡、经济损失或概率预测。",
      metrics: [
        { label: "有效点", value: String(points.length) },
        { label: "最高指数", value: Math.max(...values).toFixed(3) },
        { label: "优先核查", value: String(points.filter((point) => point.band === "优先核查").length) }
      ]
    }
  }
  return {
    ...common,
    unit: "级",
    method: "PGA/PGV 双指标同级初判",
    caution: "仅保留 VI–XI 且两指标同级的点；这是仪器初判，不替代正式烈度评定。",
    metrics: [
      { label: "同级点", value: String(points.length) },
      { label: "最高初判", value: INTENSITY_BANDS[Math.max(...values) - 6]?.grade || "-" },
      { label: "待复核", value: String(scoped.length - points.length) }
    ]
  }
}
