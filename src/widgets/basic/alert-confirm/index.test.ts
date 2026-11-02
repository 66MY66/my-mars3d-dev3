import { mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import AlertConfirm from "./index.vue"
import { createMockAlerts } from "@/shell/alerts"
import { getAlertAnalysisDataset } from "./analysis-model"

const widgetState = vi.hoisted(() => ({ currentWidget: undefined as any }))
const mapMocks = vi.hoisted(() => ({ locateTo: vi.fn() }))
const widgetMocks = vi.hoisted(() => ({ disable: vi.fn() }))
const messageMocks = vi.hoisted(() => ({ message: vi.fn() }))
const apiMocks = vi.hoisted(() => ({
  query: vi.fn(),
  confirm: vi.fn(),
  snapshots: new Map<string, any>()
}))
const notificationMocks = vi.hoisted(() => ({ upsert: vi.fn(), markRead: vi.fn() }))

vi.mock("@mars/common/uses/use-lifecycle", () => ({ default: vi.fn() }))
vi.mock("@mars/common/store/widget", () => ({
  useWidget: () => ({
    currentWidget: widgetState.currentWidget,
    disable: widgetMocks.disable
  })
}))
vi.mock("./map", () => mapMocks)
vi.mock("@mars/components/mars-ui/index", () => ({ $message: messageMocks.message }))
vi.mock("./alert-api", () => ({
  queryGeoAnomalyAlerts: apiMocks.query,
  confirmGeoAnomalyPoints: apiMocks.confirm,
  createAlertSnapshotStore: () => ({
    merge: (result: any) => result.alerts.forEach((alert: any) => apiMocks.snapshots.set(alert.snapshotKey, structuredClone(alert))),
    get: (key: string) => apiMocks.snapshots.get(key) ? structuredClone(apiMocks.snapshots.get(key)) : undefined,
    getAll: () => [...apiMocks.snapshots.values()].map((value) => structuredClone(value)),
    markConfirmed: (key: string, ids: number[]) => {
      const value = apiMocks.snapshots.get(key)
      if (value) { value.points.forEach((point: any) => { if (ids.includes(point.id)) { point.confirmed = true } }) }
    }
  })
}))
vi.mock("@/shell/notificationStore", () => ({
  useNotificationStore: () => ({
    upsertAlert: notificationMocks.upsert,
    markRead: notificationMocks.markRead
  })
}))

function mountAlert(options: Record<string, any> = {}) {
  return mount(AlertConfirm, {
    ...options,
    global: {
      ...options.global,
      stubs: {
        ...options.global?.stubs,
        MarsDialog: {
          inheritAttrs: true,
          template: '<div class="mars-dialog-stub"><slot /><slot name="footer" /></div>'
        }
      }
    }
  })
}

function seedMockSnapshot(alertNo: string) {
  const dataset = structuredClone(getAlertAnalysisDataset(alertNo)!)
  dataset.snapshotKey = alertNo
  apiMocks.snapshots.set(alertNo, dataset)
}

describe("告警确认入口选择", () => {
  beforeEach(() => {
    widgetState.currentWidget = undefined
    mapMocks.locateTo.mockClear()
    widgetMocks.disable.mockClear()
    messageMocks.message.mockClear()
    apiMocks.query.mockReset().mockRejectedValue(new Error("proxy unavailable"))
    apiMocks.confirm.mockReset().mockResolvedValue({ confirmed: 12 })
    apiMocks.snapshots.clear()
    notificationMocks.upsert.mockClear()
    notificationMocks.markRead.mockClear()
  })

  it("将 Widget 容器的可见状态传递给主弹窗", () => {
    const wrapper = mountAlert({
      attrs: { visible: true }
    })

    expect(wrapper.get(".mars-dialog-stub").attributes("visible")).toBe("true")
  })

  it("从菜单首次打开时等待用户选择告警", () => {
    const wrapper = mountAlert()
    const state = (wrapper.vm as any).$.setupState

    expect(state.selectedAlertId).toBeUndefined()
    expect(state.alertInfo).toBeNull()
    expect(state.alertOptions).toHaveLength(3)
  })

  it("从通知打开时自动选中并展示对应告警", () => {
    const alert = createMockAlerts()[1]
    widgetState.currentWidget = { data: { alertInfo: alert } }

    const wrapper = mountAlert()
    const state = (wrapper.vm as any).$.setupState

    expect(state.selectedAlertId).toBe(state.getAlertId(alert))
    expect(state.alertInfo.location).toBe(alert.location)
  })

  it("选中告警后显示分析区且点击定位展开点位详情", async () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }
    const wrapper = mountAlert()
    const state = (wrapper.vm as any).$.setupState

    expect(state.detailVisible).toBe(false)
    expect(wrapper.find(".alert-bottom").exists()).toBe(true)
    state.locate()
    await wrapper.vm.$nextTick()

    expect(state.detailVisible).toBe(true)
    expect(wrapper.find(".alert-bottom").exists()).toBe(true)
    expect(mapMocks.locateTo).toHaveBeenCalledWith(116.39, 39.9)
    expect(state.alertInfo.alertNo).toBe("ALT-20261101-001")
    expect(state.alertInfo.monitoring.maxSurfaceTemperature).toBe(68.4)
  })

  it("切换告警时更新数据并收起旧详情", () => {
    const alerts = createMockAlerts()
    widgetState.currentWidget = { data: { alertInfo: alerts[0] } }
    const wrapper = mountAlert()
    const state = (wrapper.vm as any).$.setupState
    state.locate()

    state.handleAlertSelection(state.getAlertId(alerts[1]))

    expect(state.detailVisible).toBe(false)
    expect(state.alertInfo.alertNo).toBe("ALT-20261101-002")
    expect(state.alertInfo.region).toBe("北京市顺义区西南部")
  })

  it("时间演化计算打开对应结果页", async () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }
    const wrapper = mountAlert()
    const state = (wrapper.vm as any).$.setupState
    state.locate()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain("观测—预报—温差日序列")
    state.runOperation()
    await wrapper.vm.$nextTick()

    expect(state.temporalResult.status).toBe("ok")
    expect(state.showTemporalResult).toBe(true)
    expect(state.showSpatialResult).toBe(false)
  })

  it("空间分析计算打开对应结果页", async () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }
    const wrapper = mountAlert()
    const state = (wrapper.vm as any).$.setupState
    state.locate()
    state.selectOperation("analysis")
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain("异常点空间分布")
    state.runOperation()

    expect(state.spatialResult.status).toBe("ok")
    expect(state.showSpatialResult).toBe(true)
    expect(state.showTemporalResult).toBe(false)
  })

  it("切换告警时清空已打开的计算结果", () => {
    const alerts = createMockAlerts()
    widgetState.currentWidget = { data: { alertInfo: alerts[0] } }
    const wrapper = mountAlert()
    const state = (wrapper.vm as any).$.setupState
    state.locate()
    state.runOperation()
    expect(state.showTemporalResult).toBe(true)

    state.handleAlertSelection(state.getAlertId(alerts[1]))

    expect(state.showTemporalResult).toBe(false)
    expect(state.temporalResult).toBeNull()
    expect(state.spatialResult).toBeNull()
  })

  it("用接口语义字段展示整组告警概要", () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }

    const wrapper = mountAlert()

    expect(wrapper.get('[data-testid="alert-overview"]').text()).toContain("kumamoto_20260728")
    expect(wrapper.get('[data-testid="alert-overview"]').text()).toContain("2026-07-05")
    expect(wrapper.get('[data-testid="alert-overview"]').text()).toContain("1.207")
    expect(wrapper.get('[data-testid="alert-overview"]').text()).toContain("平稳")
    expect(wrapper.get('[data-testid="alert-overview"]').text()).toContain("-3.284℃")
    expect(wrapper.get('[data-testid="alert-overview"]').text()).toContain("38 天")
    expect(wrapper.get('[data-testid="alert-overview"]').text()).toContain("12")
  })

  it("异常点详情默认收起并可由用户展开", async () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }
    const wrapper = mountAlert()

    expect(wrapper.find('[data-testid="alert-points-detail"]').exists()).toBe(false)
    await wrapper.get('[data-testid="toggle-alert-points"]').trigger("click")

    expect(wrapper.get('[data-testid="alert-points-detail"]').text()).toContain("待确认 12")
    expect(wrapper.get('[data-testid="alert-points-detail"]').text()).toContain("已确认 0")
  })

  it("保存按钮保持禁用且不再伪装成已保存", () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }
    const wrapper = mountAlert()

    const saveButton = wrapper.get('[data-testid="save-placeholder"]')
    expect(saveButton.text()).toContain("保存（待接入）")
    expect(saveButton.attributes("disabled")).toBeDefined()
  })

  it("整组确认后保持弹窗并只派发一次确认事件", async () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }
    const wrapper = mountAlert()
    seedMockSnapshot(alert.alertNo)
    const state = (wrapper.vm as any).$.setupState
    const confirmed = vi.fn()
    window.addEventListener("mars3d_alertConfirmed", confirmed)

    await state.confirmAlert()
    await state.confirmAlert()
    await wrapper.vm.$nextTick()

    expect(state.groupConfirmed).toBe(true)
    expect(wrapper.get('[data-testid="group-confirm-status"]').text()).toContain("整组已确认")
    expect(widgetMocks.disable).not.toHaveBeenCalled()
    expect(confirmed).toHaveBeenCalledTimes(1)
    window.removeEventListener("mars3d_alertConfirmed", confirmed)
  })

  it("整组确认前后都允许执行计算", async () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }
    const wrapper = mountAlert()
    seedMockSnapshot(alert.alertNo)
    const state = (wrapper.vm as any).$.setupState
    state.runOperation()
    expect(state.showTemporalResult).toBe(true)

    state.showTemporalResult = false
    await state.confirmAlert()
    state.runOperation()
    expect(state.showTemporalResult).toBe(true)
  })

  it("切换告警后保留已经完成的整组确认状态", async () => {
    const alerts = createMockAlerts()
    widgetState.currentWidget = { data: { alertInfo: alerts[0] } }
    const wrapper = mountAlert()
    seedMockSnapshot(alerts[0].alertNo)
    const state = (wrapper.vm as any).$.setupState

    await state.confirmAlert()
    state.handleAlertSelection(state.getAlertId(alerts[1]))
    expect(state.groupConfirmed).toBe(false)

    state.handleAlertSelection(state.getAlertId(alerts[0]))
    expect(state.groupConfirmed).toBe(true)
    expect(state.alertInfo.confirmedPointCount).toBe(12)
  })

  it("查询成功后用服务端告警替换模拟列表并保留ack key", async () => {
    const dataset = {
      alertNo: "kumamoto_20260728|2026-07-05",
snapshotKey: "kumamoto_20260728|2026-07-05",
taskName: "kumamoto_20260728",
      anomalyIndex: 1.207,
trend: "stable",
baselineN: 38,
      days: [{ date: "2026-07-05", obs_c: 21.963, fc_c: 25.244, diff_c: -3.284, task_name: "kumamoto_20260728" }],
      points: [{ id: 1650, lon: 131, lat: 31, date: "2026-07-05", diff_c: 1.637, confirmed: false, task_name: "kumamoto_20260728" }]
    }
    apiMocks.query.mockResolvedValue({ count: 1, alerts: [dataset], ackKeys: [dataset.snapshotKey] })
    const wrapper = mountAlert()
    await vi.waitFor(() => expect((wrapper.vm as any).$.setupState.alertOptions).toHaveLength(1))
    const state = (wrapper.vm as any).$.setupState
    state.handleAlertSelection(dataset.snapshotKey)
    expect(state.alertInfo.alertNo).toBe(dataset.snapshotKey)
    expect(state.alertInfo.taskName).toBe("kumamoto_20260728")
  })

  it("整组确认发送快照中的全部整数id并在成功后保留分析快照", async () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }
    const wrapper = mountAlert()
    seedMockSnapshot(alert.alertNo)
    const state = (wrapper.vm as any).$.setupState
    await state.confirmAlert()
    expect(apiMocks.confirm).toHaveBeenCalledWith([1650, 1651, 1652, 1653, 1654, 1655, 1656, 1657, 1658, 1659, 1660, 1661])
    expect(state.groupConfirmed).toBe(true)
    state.runOperation()
    expect(state.temporalResult.status).toBe("ok")
  })

  it("确认数量不足时保留未确认状态并提示刷新", async () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }
    apiMocks.confirm.mockResolvedValue({ confirmed: 3 })
    const wrapper = mountAlert()
    seedMockSnapshot(alert.alertNo)
    const state = (wrapper.vm as any).$.setupState
    await state.confirmAlert()
    expect(state.groupConfirmed).toBe(false)
    expect(messageMocks.message).toHaveBeenCalledWith("数据已变化，请刷新后重试")
  })

  it("接口可空指标显示为缺省值而不是零", async () => {
    const dataset = {
      alertNo: "task|null",
snapshotKey: "task|null",
taskName: "task",
anomalyIndex: null,
trend: null,
baselineN: null,
      days: [{ date: "2026-07-05", obs_c: null, fc_c: null, diff_c: null, task_name: "task" }],
      points: [{ id: 1, lon: 131, lat: 31, date: "2026-07-05", diff_c: 1, confirmed: false, task_name: "task" }]
    }
    apiMocks.query.mockResolvedValue({ count: 1, alerts: [dataset], ackKeys: [dataset.snapshotKey] })
    const wrapper = mountAlert()
    await vi.waitFor(() => expect((wrapper.vm as any).$.setupState.alertOptions).toHaveLength(1))
    const state = (wrapper.vm as any).$.setupState
    state.handleAlertSelection(dataset.snapshotKey)
    await wrapper.vm.$nextTick()
    const text = wrapper.get('[data-testid="alert-overview"]').text()
    expect(text).toContain("异常指数—")
    expect(text).toContain("温差—")
    expect(text).toContain("基线样本—")
  })

  it("查询成功时将通知中的旧选择同步到同任务服务端快照", async () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }
    const dataset = structuredClone(getAlertAnalysisDataset(alert.alertNo)!)
    dataset.alertNo = dataset.snapshotKey
    apiMocks.query.mockResolvedValue({ count: 1, alerts: [dataset], ackKeys: [dataset.snapshotKey] })
    const wrapper = mountAlert()
    await vi.waitFor(() => expect((wrapper.vm as any).$.setupState.alertInfo.alertNo).toBe(dataset.snapshotKey))
    expect((wrapper.vm as any).$.setupState.selectedAlertId).toBe(dataset.snapshotKey)
  })

  it("确认响应只作用于请求发起时的告警组", async () => {
    const alerts = createMockAlerts()
    widgetState.currentWidget = { data: { alertInfo: alerts[0] } }
    seedMockSnapshot(alerts[0].alertNo)
    seedMockSnapshot(alerts[1].alertNo)
    let resolveConfirm!: (value: { confirmed: number }) => void
    apiMocks.confirm.mockReturnValue(new Promise((resolve) => { resolveConfirm = resolve }))
    const wrapper = mountAlert()
    const state = (wrapper.vm as any).$.setupState
    const pending = state.confirmAlert()
    state.handleAlertSelection(state.getAlertId(alerts[1]))
    resolveConfirm({ confirmed: 12 })
    await pending
    expect(state.alertInfo.alertNo).toBe(alerts[1].alertNo)
    expect(state.groupConfirmed).toBe(false)
    expect(apiMocks.snapshots.get(alerts[0].alertNo).points.every((point: any) => point.confirmed)).toBe(true)
    expect(apiMocks.snapshots.get(alerts[1].alertNo).points.every((point: any) => !point.confirmed)).toBe(true)
  })

  it("确认成功不自动标记本地通知为已读", async () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }
    seedMockSnapshot(alert.alertNo)
    const wrapper = mountAlert()
    await (wrapper.vm as any).$.setupState.confirmAlert()
    expect(notificationMocks.markRead).not.toHaveBeenCalled()
  })

  it("没有服务端快照时不发送模拟点位确认请求", async () => {
    const alert = createMockAlerts()[0]
    widgetState.currentWidget = { data: { alertInfo: alert } }
    const wrapper = mountAlert()
    await (wrapper.vm as any).$.setupState.confirmAlert()
    expect(apiMocks.confirm).not.toHaveBeenCalled()
    expect(messageMocks.message).toHaveBeenCalledWith("告警点位数据尚未加载，请刷新后重试")
  })
})
