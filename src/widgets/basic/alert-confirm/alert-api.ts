import axios from "axios"
import type { AlertAnalysisDataset, AlertDay, AlertPoint } from "./analysis-model"

export const ALERT_API_PATH = "/api/geo-anomaly-alerts"
const REQUEST_OPTIONS = { timeout: 10_000 }

export type AlertQueryResult = {
  count: number
  alerts: AlertAnalysisDataset[]
  ackKeys: string[]
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nullableNumber(value: unknown, field: string): number | null {
  if (value === null) { return null }
  if (typeof value !== "number" || !Number.isFinite(value)) { throw new Error(`${field}必须是number或null`) }
  return value
}

function mapDay(value: unknown): AlertDay {
  if (!isRecord(value) || typeof value.date !== "string" || typeof value.task_name !== "string") {
    throw new Error("days[]字段无效")
  }
  return {
    date: value.date,
    obs_c: nullableNumber(value.obs_c, "days[].obs_c"),
    fc_c: nullableNumber(value.fc_c, "days[].fc_c"),
    diff_c: nullableNumber(value.diff_c, "days[].diff_c"),
    task_name: value.task_name
  }
}

function mapPoint(value: unknown): AlertPoint {
  if (!isRecord(value) || !Number.isInteger(value.id)) { throw new Error("points[].id必须是integer") }
  if (typeof value.lon !== "number" || typeof value.lat !== "number" || typeof value.date !== "string" || typeof value.diff_c !== "number" || typeof value.confirmed !== "boolean" || typeof value.task_name !== "string") {
    throw new Error("points[]字段无效")
  }
  return { id: value.id as number, lon: value.lon, lat: value.lat, date: value.date, diff_c: value.diff_c, confirmed: value.confirmed, task_name: value.task_name }
}

export function mapAlertResponse(raw: unknown): AlertQueryResult {
  if (!isRecord(raw) || !Number.isInteger(raw.count) || !Array.isArray(raw.alerts)) { throw new Error("告警查询响应格式无效") }
  if (!Array.isArray(raw.ack_keys) || !raw.ack_keys.every((key) => typeof key === "string")) { throw new Error("ack_keys字段无效") }
  if (raw.alerts.length !== raw.ack_keys.length) { throw new Error("alerts与ack_keys数量不一致") }

  const alerts = raw.alerts.map((value, index): AlertAnalysisDataset => {
    if (!isRecord(value) || typeof value.task_name !== "string" || !Array.isArray(value.days) || !Array.isArray(value.points)) {
      throw new Error("alerts[]字段无效")
    }
    const trend = value.trend
    if (trend !== null && trend !== "rising" && trend !== "falling" && trend !== "stable") { throw new Error("trend字段无效") }
    const snapshotKey = raw.ack_keys[index] as string
    return {
      alertNo: snapshotKey,
      snapshotKey,
      taskName: value.task_name,
      anomalyIndex: nullableNumber(value.anomaly_index, "anomaly_index"),
      trend: trend as AlertAnalysisDataset["trend"],
      baselineN: nullableNumber(value.baseline_n, "baseline_n"),
      days: value.days.map(mapDay),
      points: value.points.map(mapPoint)
    }
  })
  return { count: raw.count as number, alerts, ackKeys: [...raw.ack_keys] as string[] }
}

export async function queryGeoAnomalyAlerts(): Promise<AlertQueryResult> {
  const response = await axios.post(ALERT_API_PATH, {}, REQUEST_OPTIONS)
  return mapAlertResponse(response.data)
}

export async function confirmGeoAnomalyPoints(ids: number[]): Promise<{ confirmed: number }> {
  if (!ids.length || !ids.every(Number.isInteger)) { throw new Error("确认点位ids必须是非空整数数组") }
  const response = await axios.post(ALERT_API_PATH, { confirm: { ids } }, REQUEST_OPTIONS)
  if (!isRecord(response.data) || !Number.isInteger(response.data.confirmed)) { throw new Error("确认响应格式无效") }
  return { confirmed: response.data.confirmed as number }
}

function cloneDataset(dataset: AlertAnalysisDataset): AlertAnalysisDataset {
  return { ...dataset, days: dataset.days.map((day) => ({ ...day })), points: dataset.points.map((point) => ({ ...point })) }
}

export function createAlertSnapshotStore() {
  const snapshots = new Map<string, AlertAnalysisDataset>()
  return {
    merge(result: AlertQueryResult) {
      result.alerts.forEach((alert) => snapshots.set(alert.snapshotKey, cloneDataset(alert)))
    },
    get(key: string) {
      const value = snapshots.get(key)
      return value ? cloneDataset(value) : undefined
    },
    getAll() {
      return [...snapshots.values()].map(cloneDataset)
    },
    markConfirmed(key: string, ids: number[]) {
      const value = snapshots.get(key)
      if (!value) { return }
      const confirmedIds = new Set(ids)
      value.points = value.points.map((point) => confirmedIds.has(point.id) ? { ...point, confirmed: true } : point)
    }
  }
}
