import axios from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  ALERT_API_PATH,
  confirmGeoAnomalyPoints,
  createAlertSnapshotStore,
  mapAlertResponse,
  queryGeoAnomalyAlerts
} from "./alert-api"

vi.mock("axios", () => ({ default: { post: vi.fn() } }))
const post = vi.mocked(axios.post)

const rawResponse = {
  count: 1,
  alerts: [{
    task_name: "kumamoto_20260728",
    days: [{ date: "2026-07-05", obs_c: 21.963, fc_c: 25.244, diff_c: -3.284, task_name: "kumamoto_20260728" }],
    trend: "stable",
    points: [{ id: 1650, lat: 31, lon: 131, date: "2026-07-05", diff_c: 1.637, confirmed: false, task_name: "kumamoto_20260728" }],
    anomaly_index: 1.207,
    baseline_n: 38
  }],
  ack_keys: ["kumamoto_20260728|2026-07-05"]
}

describe("告警接口响应映射", () => {
  beforeEach(() => post.mockReset())

  it("原样映射文档字段和服务端ack key", () => {
    const mapped = mapAlertResponse(rawResponse)
    expect(mapped.count).toBe(1)
    expect(mapped.ackKeys).toEqual(["kumamoto_20260728|2026-07-05"])
    expect(mapped.alerts[0]).toMatchObject({
      snapshotKey: "kumamoto_20260728|2026-07-05",
      taskName: "kumamoto_20260728",
      anomalyIndex: 1.207,
      trend: "stable",
      baselineN: 38
    })
    expect(mapped.alerts[0].points[0]).toMatchObject({ id: 1650, lon: 131, lat: 31, diff_c: 1.637, confirmed: false })
    expect(Number.isInteger(mapped.alerts[0].points[0].id)).toBe(true)
  })

  it("保留接口允许的null字段", () => {
    const response = structuredClone(rawResponse)
    response.alerts[0].anomaly_index = null as any
    response.alerts[0].baseline_n = null as any
    response.alerts[0].days[0].obs_c = null as any
    expect(mapAlertResponse(response).alerts[0]).toMatchObject({ anomalyIndex: null, baselineN: null, days: [{ obs_c: null }] })
  })

  it("拒绝缺少ack_keys或包含非整数点位id的响应", () => {
    expect(() => mapAlertResponse({ count: 1, alerts: rawResponse.alerts })).toThrow("ack_keys")
    const response = structuredClone(rawResponse)
    response.alerts[0].points[0].id = "1650" as any
    expect(() => mapAlertResponse(response)).toThrow("points[].id")
  })

  it("查询和确认仅调用同源代理且不携带token", async () => {
    post.mockResolvedValueOnce({ data: rawResponse }).mockResolvedValueOnce({ data: { confirmed: 1 } })
    await queryGeoAnomalyAlerts()
    await confirmGeoAnomalyPoints([1650])
    expect(post).toHaveBeenNthCalledWith(1, ALERT_API_PATH, {}, { timeout: 10_000 })
    expect(post).toHaveBeenNthCalledWith(2, ALERT_API_PATH, { confirm: { ids: [1650] } }, { timeout: 10_000 })
  })
})

describe("告警会话快照", () => {
  it("重复查询以同一服务端key覆盖快照", () => {
    const store = createAlertSnapshotStore()
    store.merge(mapAlertResponse(rawResponse))
    const next = structuredClone(rawResponse)
    next.alerts[0].points[0].confirmed = true
    store.merge(mapAlertResponse(next))
    expect(store.get("kumamoto_20260728|2026-07-05")?.points[0].confirmed).toBe(true)
    expect(store.getAll()).toHaveLength(1)
  })

  it("确认后只更新指定点且失败查询不影响旧快照", () => {
    const store = createAlertSnapshotStore()
    store.merge(mapAlertResponse(rawResponse))
    store.markConfirmed("kumamoto_20260728|2026-07-05", [1650])
    expect(store.get("kumamoto_20260728|2026-07-05")?.points[0].confirmed).toBe(true)
    expect(() => mapAlertResponse({ broken: true })).toThrow()
    expect(store.getAll()).toHaveLength(1)
  })
})
