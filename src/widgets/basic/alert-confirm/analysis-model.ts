export type AlertDay = {
  date: string
  obs_c: number | null
  fc_c: number | null
  diff_c: number | null
  task_name: string
}

export type AlertPoint = {
  id: number
  lon: number
  lat: number
  date: string
  diff_c: number | null
  confirmed: boolean
  task_name: string
}

export type AlertAnalysisDataset = {
  alertNo: string
  snapshotKey: string
  taskName: string
  anomalyIndex: number | null
  trend: "rising" | "falling" | "stable" | null
  baselineN: number | null
  days: AlertDay[]
  points: AlertPoint[]
}

export type TemporalRecord = { date: string; obsC: number | null; fcC: number | null; diffC: number | null }
export type TemporalAnalysisResult = {
  status: "ok" | "insufficient"
  alertNo: string
  taskName: string
  anomalyIndex: number | null
  baselineN: number | null
  trend: string
  records: TemporalRecord[]
  metrics: { latestDiffC: number | null; maxDiffC: number | null; minDiffC: number | null; maxAbsDiffC: number | null; averageDiffC: number | null; validDays: number }
  summary: string
}

export type SpatialAnalysisResult = {
  status: "ok" | "insufficient"
  alertNo: string
  taskName: string
  anomalyIndex: number | null
  trend: string
  points: AlertPoint[]
  extent: { minLng: number; maxLng: number; minLat: number; maxLat: number }
  metrics: { total: number; pending: number; confirmed: number; maxDiffC: number | null; minDiffC: number | null; averageDiffC: number | null }
  summary: string
}

const taskName = "kumamoto_20260728"
const days: AlertDay[] = [
  ["2026-06-30", 24.1, 24.8, -0.7], ["2026-07-01", 24.9, 25.1, -0.2], ["2026-07-02", 25.8, 25.3, 0.5],
  ["2026-07-03", 24.7, 25.0, -0.3], ["2026-07-04", 23.8, 25.0, -1.2], ["2026-07-05", 21.963, 25.247, -3.284]
].map(([date, obs_c, fc_c, diff_c]) => ({ date: String(date), obs_c: Number(obs_c), fc_c: Number(fc_c), diff_c: Number(diff_c), task_name: taskName }))

const pointDiffs = [-3.2, -2.7, -1.8, -0.9, 0.4, 1.1, 1.8, 2.5, 3.2, 3.8, 4.2, 4.6]
const points: AlertPoint[] = pointDiffs.map((diff_c, index) => ({
  id: 1650 + index,
  lon: 130.67 + (index % 4) * 0.018 + Math.floor(index / 4) * 0.004,
  lat: 32.77 + Math.floor(index / 4) * 0.017 + (index % 2) * 0.004,
  date: "2026-07-05",
  diff_c,
  confirmed: index < 3,
  task_name: taskName
}))

const datasets: AlertAnalysisDataset[] = [
  { alertNo: "ALT-20261101-001", snapshotKey: "kumamoto_20260728|2026-07-05", taskName, anomalyIndex: 1.207, trend: "stable", baselineN: 38, days, points },
  { alertNo: "ALT-20261101-002", snapshotKey: "beijing_shunyi_20261101|2026-11-01", taskName: "beijing_shunyi_20261101", anomalyIndex: 1.486, trend: "rising", baselineN: 42, days: days.map((item) => ({ ...item, task_name: "beijing_shunyi_20261101", obs_c: item.obs_c == null ? null : item.obs_c + 8, diff_c: item.diff_c == null ? null : item.diff_c + 4 })), points: points.slice(0, 8).map((item, index) => ({ ...item, id: 2650 + index, lon: 116.43 + (index % 4) * 0.018, lat: 39.91 + Math.floor(index / 4) * 0.018, task_name: "beijing_shunyi_20261101", confirmed: false })) },
  { alertNo: "ALT-20261101-003", snapshotKey: "beijing_fengtai_20261101|2026-11-01", taskName: "beijing_fengtai_20261101", anomalyIndex: 0.918, trend: "falling", baselineN: 35, days: days.slice(1).map((item) => ({ ...item, task_name: "beijing_fengtai_20261101", obs_c: item.obs_c == null ? null : item.obs_c + 5, diff_c: item.diff_c == null ? null : item.diff_c + 2 })), points: points.slice(0, 5).map((item, index) => ({ ...item, id: 3650 + index, lon: 116.29 + (index % 3) * 0.018, lat: 39.85 + Math.floor(index / 3) * 0.018, task_name: "beijing_fengtai_20261101", confirmed: false })) }
]

export function getAlertAnalysisDataset(alertNo: string): AlertAnalysisDataset | null {
  return datasets.find((item) => item.alertNo === alertNo) || null
}

function trendLabel(trend: AlertAnalysisDataset["trend"]): string {
  const labels = { rising: "上升", falling: "下降", stable: "平稳" }
  return trend ? labels[trend] : "暂无"
}
function round(value: number, digits = 3): number { const factor = 10 ** digits; return Math.round(value * factor) / factor }
function nullableStats(values: Array<number | null>) {
  const valid = values.filter((value): value is number => Number.isFinite(value))
  return { valid, max: valid.length ? Math.max(...valid) : null, min: valid.length ? Math.min(...valid) : null, average: valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null }
}

export function calculateTemporalAnalysis(dataset: AlertAnalysisDataset | null): TemporalAnalysisResult {
  const records = [...(dataset?.days || [])].sort((a, b) => a.date.localeCompare(b.date)).map((item) => ({ date: item.date, obsC: item.obs_c, fcC: item.fc_c, diffC: item.diff_c }))
  const stats = nullableStats(records.map((item) => item.diffC))
  const latestDiffC = records.at(-1)?.diffC ?? null
  return {
    status: records.length ? "ok" : "insufficient",
alertNo: dataset?.alertNo || "",
taskName: dataset?.taskName || "",
    anomalyIndex: dataset?.anomalyIndex ?? null,
baselineN: dataset?.baselineN ?? null,
trend: trendLabel(dataset?.trend ?? null),
records,
    metrics: { latestDiffC, maxDiffC: stats.max, minDiffC: stats.min, maxAbsDiffC: stats.valid.length ? Math.max(...stats.valid.map(Math.abs)) : null, averageDiffC: stats.average, validDays: stats.valid.length },
    summary: records.length ? `当前共返回 ${records.length} 个日期，其中 ${stats.valid.length} 天具备完整温差数据；趋势字段为“${trendLabel(dataset?.trend ?? null)}”。` : "接口未返回可用的日序列数据。"
  }
}

export function calculateSpatialAnalysis(dataset: AlertAnalysisDataset | null): SpatialAnalysisResult {
  const points = (dataset?.points || []).filter((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat) && Math.abs(point.lon) <= 180 && Math.abs(point.lat) <= 90)
  const diffs = nullableStats(points.map((point) => point.diff_c))
  const extent = points.length ? { minLng: Math.min(...points.map((point) => point.lon)), maxLng: Math.max(...points.map((point) => point.lon)), minLat: Math.min(...points.map((point) => point.lat)), maxLat: Math.max(...points.map((point) => point.lat)) } : { minLng: 0, maxLng: 0, minLat: 0, maxLat: 0 }
  const confirmed = points.filter((point) => point.confirmed).length
  return {
    status: points.length ? "ok" : "insufficient",
alertNo: dataset?.alertNo || "",
taskName: dataset?.taskName || "",
anomalyIndex: dataset?.anomalyIndex ?? null,
    trend: trendLabel(dataset?.trend ?? null),
points,
extent,
    metrics: { total: points.length, pending: points.length - confirmed, confirmed, maxDiffC: diffs.max, minDiffC: diffs.min, averageDiffC: diffs.average },
    summary: points.length ? `当前展示 ${points.length} 个有效坐标点，其中待确认 ${points.length - confirmed} 个、已确认 ${confirmed} 个。` : "接口未返回有效坐标点。"
  }
}
