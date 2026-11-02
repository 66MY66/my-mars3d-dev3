<template>
  <mars-dialog
    title="告警确认"
    icon="tips-one"
    custom-class="alert-confirm-panel-dialog"
    :visible="props.visible"
    :draggable="true"
    :width="380"
    top="80"
    right="10"
    :nopadding="true"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="alert-panel">
      <div class="alert-scroll">
        <div class="alert-selector">
          <div class="section-label">选择告警信息</div>
          <mars-select
            v-model:value="selectedAlertId"
            :options="alertOptions"
            placeholder="请选择告警信息"
            allow-clear
            @change="handleAlertSelection"
          />
        </div>

        <div v-if="!alertInfo" class="alert-empty">请选择一条告警信息查看详情</div>

        <div v-if="alertInfo" class="alert-top" data-testid="alert-overview">
          <div class="alert-title-line">
            <div>
              <strong class="alert-title-text">地表热异常告警</strong>
              <div class="alert-subtitle">{{ alertInfo.taskName }} · {{ alertInfo.anomalyDate }}</div>
            </div>
            <span class="alert-status" :class="{ 'is-confirmed': groupConfirmed }">{{ groupConfirmed ? "整组已确认" : "待确认" }}</span>
          </div>

          <div class="overview-grid">
            <div class="overview-field is-wide"><span>监测任务</span><strong>{{ alertInfo.taskName }}</strong></div>
            <div class="overview-field"><span>异常日期</span><strong>{{ alertInfo.anomalyDate }}</strong></div>
            <div class="overview-field"><span>趋势</span><strong>{{ trendLabel }}</strong></div>
            <div class="overview-field"><span>异常指数</span><strong>{{ displayNumber(alertInfo.anomalyIndex) }}</strong></div>
            <div class="overview-field"><span>温差</span><strong>{{ displayTemperature(alertInfo.temperatureDifference) }}</strong></div>
            <div class="overview-field"><span>观测温度</span><strong>{{ displayTemperature(alertInfo.observedTemperature) }}</strong></div>
            <div class="overview-field"><span>预报温度</span><strong>{{ displayTemperature(alertInfo.forecastTemperature) }}</strong></div>
            <div class="overview-field"><span>基线样本</span><strong>{{ alertInfo.baselineSampleCount == null ? "—" : `${alertInfo.baselineSampleCount} 天` }}</strong></div>
            <div class="overview-field"><span>异常点位</span><strong>{{ alertInfo.pointCount }} 个</strong></div>
          </div>

          <div class="points-summary">
            <div><strong>异常点概览</strong><span>共 {{ alertInfo.pointCount }} 个点位，详情默认收起</span></div>
            <button data-testid="toggle-alert-points" type="button" class="points-toggle" @click="pointsExpanded = !pointsExpanded">
              {{ pointsExpanded ? "收起" : "查看点位" }}
            </button>
          </div>
          <div v-if="pointsExpanded" class="points-detail" data-testid="alert-points-detail">
            <span>待确认 {{ pendingPointCount }}</span><span>已确认 {{ displayedConfirmedPointCount }}</span><span>中心坐标 {{ alertInfo.location }}</span>
          </div>
          <mars-button class="locate-btn" block @click="locate">定位异常点</mars-button>
        </div>

        <div v-if="alertInfo" class="alert-bottom">
          <div class="section-label">深化分析</div>

          <div class="op-text-buttons" role="tablist" aria-label="添加算子">
            <button
              type="button"
              class="op-text-btn"
              :class="{ 'is-active': opSelected === 'spatio-temporal' }"
              role="tab"
              :aria-selected="opSelected === 'spatio-temporal'"
              @click="selectOperation('spatio-temporal')"
            >
              时间演化
            </button>
            <button
              type="button"
              class="op-text-btn"
              :class="{ 'is-active': opSelected === 'analysis' }"
              role="tab"
              :aria-selected="opSelected === 'analysis'"
              @click="selectOperation('analysis')"
            >
              空间分析
            </button>
          </div>

          <div v-if="opSelected === 'spatio-temporal'" class="operator-config" data-testid="temporal-config">
            <div class="analysis-scope is-wide"><strong>观测—预报—温差日序列</strong><span>按接口返回日期展示观测温度、预报温度和温差，不推导面积、扩张速度等未提供指标。</span></div>
          </div>

          <div v-else class="operator-config" data-testid="spatial-config">
            <div class="analysis-scope is-wide"><strong>异常点空间分布</strong><span>按接口经纬度展示点位、温差与确认状态，不生成异常边界、影响范围或周边目标结论。</span></div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div v-if="alertInfo" class="alert-footer-wrap">
        <div class="group-confirm-state" data-testid="group-confirm-status">
          {{ groupConfirmed ? `整组已确认 · 已确认 ${alertInfo.pointCount} 个异常点` : `待确认 · 本组共 ${alertInfo.pointCount} 个异常点` }}
        </div>
        <div class="alert-footer-actions">
        <mars-button class="action-btn" type="primary" @click="runOperation">计算</mars-button>
        <mars-button data-testid="save-placeholder" class="action-btn" disabled>保存（待接入）</mars-button>
        <mars-button class="action-btn" type="primary" :disabled="groupConfirmed" @click="confirmAlert">
          {{ groupConfirmed ? "整组已确认" : "确认整组告警" }}
        </mars-button>
        </div>
      </div>
    </template>
  </mars-dialog>

  <TimeEvolutionResult v-if="showTemporalResult && temporalResult" :result="temporalResult" @close="showTemporalResult = false" />
  <SpatialAnalysisResult v-if="showSpatialResult && spatialResult" :result="spatialResult" @close="showSpatialResult = false" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import { useWidget } from "@mars/common/store/widget"
import * as mapWork from "./map"
import { $message } from "@mars/components/mars-ui/index"
import type { AlertInfo } from "@/shell/alerts"
import { createMockAlerts } from "@/shell/alerts"
import { useNotificationStore } from "@/shell/notificationStore"
import TimeEvolutionResult from "./TimeEvolutionResult.vue"
import SpatialAnalysisResult from "./SpatialAnalysisResult.vue"
import {
  calculateSpatialAnalysis,
  calculateTemporalAnalysis,
  getAlertAnalysisDataset,
  type AlertAnalysisDataset,
  type SpatialAnalysisResult as SpatialResult,
  type TemporalAnalysisResult as TemporalResult
} from "./analysis-model"
import {
  confirmGeoAnomalyPoints,
  createAlertSnapshotStore,
  queryGeoAnomalyAlerts
} from "./alert-api"

const props = withDefaults(defineProps<{ visible?: boolean }>(), {
  visible: false
})

const emit = defineEmits<{
  "update:visible": [value: boolean]
}>()

useLifecycle(mapWork)

const { currentWidget } = useWidget()

const initialAlert = currentWidget?.data?.alertInfo as AlertInfo | undefined
const availableAlerts = ref<AlertInfo[]>(createMockAlerts())
const snapshotStore = createAlertSnapshotStore()

function datasetToAlertInfo(dataset: AlertAnalysisDataset): AlertInfo {
  const latestDay = dataset.days.at(-1)
  const validPoints = dataset.points.filter((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat))
  const centerLon = validPoints.length ? validPoints.reduce((sum, point) => sum + point.lon, 0) / validPoints.length : 0
  const centerLat = validPoints.length ? validPoints.reduce((sum, point) => sum + point.lat, 0) / validPoints.length : 0
  const confirmedPointCount = dataset.points.filter((point) => point.confirmed).length
  return {
    taskName: dataset.taskName,
    anomalyDate: latestDay?.date || "",
    anomalyIndex: dataset.anomalyIndex,
    baselineSampleCount: dataset.baselineN,
    trend: dataset.trend,
    observedTemperature: latestDay?.obs_c ?? null,
    forecastTemperature: latestDay?.fc_c ?? null,
    temperatureDifference: latestDay?.diff_c ?? null,
    pointCount: dataset.points.length,
    confirmedPointCount,
    alertNo: dataset.snapshotKey,
    name: "地表热异常告警",
    type: "热异常",
    time: latestDay?.date || new Date().toISOString(),
    source: "地表热异常监测接口",
    region: "",
    location: `${centerLon.toFixed(5)}, ${centerLat.toFixed(5)}`,
    status: confirmedPointCount === dataset.points.length && dataset.points.length ? "已确认" : "待确认",
    degree: "",
    duration: "",
    scope: "",
    analysisResult: "",
    monitoring: {
      maxSurfaceTemperature: latestDay?.obs_c ?? 0,
      averageTemperature: latestDay?.obs_c ?? 0,
      backgroundTemperature: latestDay?.fc_c ?? 0,
      maxTemperatureDifference: latestDay?.diff_c ?? 0,
      abnormalArea: 0,
      abnormalPixelCount: dataset.points.length,
      cloudCoverage: 0,
      confidence: 0
    }
  }
}

function getAlertId(alert: AlertInfo): string {
  if (alert.alertNo.includes("|")) {
    return alert.alertNo
  }
  const createdAt = new Date(alert.time).getTime()
  return `alert_${createdAt}_${alert.location.replace(/\s+/g, "")}`
}

if (initialAlert && !availableAlerts.value.some((item) => getAlertId(item) === getAlertId(initialAlert))) {
  availableAlerts.value.unshift(initialAlert)
}

const selectedAlertId = ref<string | undefined>(initialAlert ? getAlertId(initialAlert) : undefined)
const alertInfo = ref<AlertInfo | null>(initialAlert ? { ...initialAlert } : null)
const detailVisible = ref(false)
const pointsExpanded = ref(false)
const groupConfirmed = ref(Boolean(initialAlert && initialAlert.confirmedPointCount >= initialAlert.pointCount))

const trendLabel = computed(() => alertInfo.value?.trend ? ({ rising: "上升", falling: "下降", stable: "平稳" })[alertInfo.value.trend] : "暂无")
const displayedConfirmedPointCount = computed(() => groupConfirmed.value ? (alertInfo.value?.pointCount || 0) : (alertInfo.value?.confirmedPointCount || 0))
const pendingPointCount = computed(() => Math.max((alertInfo.value?.pointCount || 0) - displayedConfirmedPointCount.value, 0))

function formatOptionTime(time: Date | string): string {
  const d = new Date(time)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function displayNumber(value: number | null): string {
  return value == null ? "—" : String(value)
}

function displayTemperature(value: number | null): string {
  return value == null ? "—" : `${value}℃`
}

const alertOptions = computed(() =>
  availableAlerts.value.map((alert) => ({
    label: `${alert.taskName}｜${alert.anomalyDate || formatOptionTime(alert.time)}`,
    value: getAlertId(alert)
  }))
)

function handleAlertSelection(value?: string) {
  selectedAlertId.value = value
  const selected = availableAlerts.value.find((item) => getAlertId(item) === value)
  alertInfo.value = selected ? { ...selected } : null
  detailVisible.value = false
  pointsExpanded.value = false
  groupConfirmed.value = Boolean(selected && selected.confirmedPointCount >= selected.pointCount)
  resetAnalysisResults()
}

const formattedAlertTime = computed(() => {
  if (!alertInfo.value) {
    return ""
  }
  const d = new Date(alertInfo.value.time)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  return `${y}年${m}月${day}日 ${hh}:${mm}:${ss}`
})

function locate() {
  if (!alertInfo.value) {
    return
  }
  const [lng, lat] = alertInfo.value.location.split(",").map((v) => Number(v.trim()))
  if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
    mapWork.locateTo(lng, lat)
    detailVisible.value = true
  } else {
    $message("无法定位：坐标格式错误")
  }
}

const opSelected = ref<"spatio-temporal" | "analysis">("spatio-temporal")
const temporalResult = ref<TemporalResult | null>(null)
const spatialResult = ref<SpatialResult | null>(null)
const showTemporalResult = ref(false)
const showSpatialResult = ref(false)
const confirmingKeys = new Set<string>()

function resetAnalysisResults() {
  temporalResult.value = null
  spatialResult.value = null
  showTemporalResult.value = false
  showSpatialResult.value = false
}

function selectOperation(value: "spatio-temporal" | "analysis") {
  opSelected.value = value
  resetAnalysisResults()
}

function runOperation() {
  if (!alertInfo.value) {
    $message("请先选择告警信息")
    return
  }
  const dataset = snapshotStore.get(alertInfo.value.alertNo) || getAlertAnalysisDataset(alertInfo.value.alertNo)
  if (opSelected.value === "spatio-temporal") {
    const result = calculateTemporalAnalysis(dataset)
    if (result.status !== "ok") {
      $message(result.summary)
      return
    }
    temporalResult.value = result
    spatialResult.value = null
    showSpatialResult.value = false
    showTemporalResult.value = true
    return
  }
  const result = calculateSpatialAnalysis(dataset)
  if (result.status !== "ok") {
    $message(result.summary)
    return
  }
  spatialResult.value = result
  temporalResult.value = null
  showTemporalResult.value = false
  showSpatialResult.value = true
}

async function confirmAlert() {
  if (!alertInfo.value) {
    $message("请先选择告警信息")
    return
  }
  if (groupConfirmed.value) {
    return
  }
  const requestAlert = { ...alertInfo.value }
  const requestKey = requestAlert.alertNo
  if (confirmingKeys.has(requestKey)) {
    return
  }
  const dataset = snapshotStore.get(requestKey)
  if (!dataset) {
    $message("告警点位数据尚未加载，请刷新后重试")
    return
  }
  const ids = dataset?.points.map((point) => point.id) || []
  if (!ids.length) {
    $message("当前告警没有可确认的异常点")
    return
  }
  confirmingKeys.add(requestKey)
  try {
    const response = await confirmGeoAnomalyPoints(ids)
    if (response.confirmed !== ids.length) {
      $message("数据已变化，请刷新后重试")
      return
    }
    snapshotStore.markConfirmed(requestKey, ids)
    requestAlert.confirmedPointCount = requestAlert.pointCount
    requestAlert.status = "已确认"
    const { upsertAlert } = useNotificationStore()
    upsertAlert(requestAlert)
  } catch {
    $message("确认失败，请稍后重试")
    return
  } finally {
    confirmingKeys.delete(requestKey)
  }
  const storedAlert = availableAlerts.value.find((item) => item.alertNo === requestKey)
  if (storedAlert) {
    storedAlert.confirmedPointCount = storedAlert.pointCount
    storedAlert.status = "已确认"
  }
  if (alertInfo.value?.alertNo === requestKey) {
    groupConfirmed.value = true
    alertInfo.value.confirmedPointCount = alertInfo.value.pointCount
    alertInfo.value.status = "已确认"
  }
  $message("整组告警已确认", "success")
  window.dispatchEvent(new CustomEvent("mars3d_alertConfirmed", {
    detail: { alertInfo: requestAlert }
  }))
}

onMounted(async () => {
  if (alertInfo.value) {
    const { upsertAlert } = useNotificationStore()
    upsertAlert(alertInfo.value)
  }
  try {
    const response = await queryGeoAnomalyAlerts()
    snapshotStore.merge(response)
    const previousAlert = alertInfo.value
    availableAlerts.value = response.alerts.map(datasetToAlertInfo)
    if (previousAlert) {
      const matched = availableAlerts.value.find((item) => item.alertNo === previousAlert.alertNo) ||
        availableAlerts.value.find((item) => item.taskName === previousAlert.taskName && item.anomalyDate === previousAlert.anomalyDate)
      handleAlertSelection(matched ? getAlertId(matched) : undefined)
    }
  } catch {
    $message("告警数据暂不可用")
  }
})
</script>

<style lang="less" scoped>
.alert-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.alert-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  --alert-inner-inset: calc(var(--popup-body-padding, 14px) + 12px);
  padding: var(--popup-body-padding, 14px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: color-mix(in srgb, var(--popup-surface, #11161c) 88%, #fff 12%);
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-radius: var(--popup-item-radius, 8px);
}

.alert-empty {
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
  font-size: 13px;
  text-align: center;
}

.alert-top,
.alert-bottom {
  padding: 12px;
  background: color-mix(in srgb, var(--popup-surface, #11161c) 88%, #fff 12%);
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-radius: var(--popup-item-radius, 8px);
  box-sizing: border-box;
}

.alert-top {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-title-line {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  text-align: left;
}

.alert-subtitle {
  margin-top: 3px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
  font-size: 11px;
}

.alert-status {
  flex: none;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-warning, #ff9f43) 18%, transparent);
  color: var(--color-warning, #ffb35c);
  font-size: 11px;

  &.is-confirmed {
    background: color-mix(in srgb, var(--color-success, #39c58a) 18%, transparent);
    color: var(--color-success, #5bd6a4);
  }
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.overview-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent);

  span {
    color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
    font-size: 11px;
  }

  strong {
    overflow-wrap: anywhere;
    color: var(--mars-text-color, var(--text-primary, #fff));
    font-size: 12px;
    font-weight: 500;
  }
}

.points-summary,
.points-detail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--text-primary, #fff) 12%, transparent);
}

.points-summary div {
  display: flex;
  flex-direction: column;
  gap: 3px;

  span {
    color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
    font-size: 11px;
  }
}

.points-toggle {
  flex: none;
  padding: 4px 8px;
  border: 0;
  background: transparent;
  color: var(--color-primary, #41a8ff);
  cursor: pointer;
  font-size: 12px;
}

.points-detail {
  flex-wrap: wrap;
  justify-content: flex-start;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.78));
  font-size: 11px;
}

.alert-title-text {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--mars-text-color, var(--text-primary, #fff));
}

.alert-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding-left: calc(16px + 8px);
  box-sizing: border-box;
  text-align: left;
}

.detail-item {
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.78));
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
}

.locate-btn {
  width: 100%;
}

.located-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 2px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--text-primary, #fff) 12%, transparent);
}

.detail-section-title {
  color: var(--mars-text-color, var(--text-primary, #fff));
  font-size: 13px;
  font-weight: 600;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.info-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent);

  &.is-wide {
    grid-column: 1 / -1;
  }

  span {
    color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
    font-size: 11px;
  }

  strong {
    overflow-wrap: anywhere;
    color: var(--mars-text-color, var(--text-primary, #fff));
    font-size: 12px;
    font-weight: 500;
    line-height: 1.45;
  }

  .status-value {
    color: var(--color-primary, #41a8ff);
  }
}

.alert-bottom {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--mars-text-color, var(--text-primary, #fff));
  text-align: left;
}

.op-text-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
}

.op-text-btn {
  height: 32px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 16%, transparent);
  border-radius: var(--popup-item-radius, 8px);
  background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    color: var(--mars-text-color, var(--text-primary, #fff));
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 35%, transparent);
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 10%, transparent);
  }

  &.is-active {
    color: var(--color-primary, #41a8ff);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 55%, transparent);
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 16%, transparent);
    font-weight: 600;
  }
}

.ops-hint {
  text-align: left;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
  font-size: 12px;
  line-height: 1.5;
}

.operator-config {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  padding-top: 2px;
}

.analysis-scope {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 11px;
  border-left: 2px solid color-mix(in srgb, var(--color-primary, #41a8ff) 70%, transparent);
  background: color-mix(in srgb, var(--color-primary, #41a8ff) 8%, transparent);

  strong { color: var(--mars-text-color, #fff); font-size: 12px; font-weight: 600; }
  span { color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.62)); font-size: 11px; line-height: 1.55; }
}

.config-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;

  span {
    color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.6));
    font-size: 11px;
  }

  select {
    width: 100%;
    height: 30px;
    padding: 0 8px;
    border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 16%, transparent);
    border-radius: 5px;
    outline: none;
    background: var(--popup-bg, #0d141b);
    color: var(--mars-text-color, #fff);
    font-size: 12px;

    &:focus {
      border-color: var(--color-primary, #41a8ff);
    }
  }
}

.is-wide {
  grid-column: 1 / -1;
}

.config-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  padding: 7px 9px 8px;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 12%, transparent);
  border-radius: 5px;

  legend {
    padding: 0 4px;
    color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.6));
    font-size: 11px;
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.78));
    font-size: 11px;
  }
}

.history-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.78));
  font-size: 11px;
}

.alert-footer-wrap {
  width: 100%;
  padding: 9px var(--alert-inner-inset, calc(var(--popup-body-padding, 14px) + 12px));
  box-sizing: border-box;
  border-top: 1px solid var(--layout-border, var(--popup-border, rgba(255 255 255 / 0.12)));
  background: color-mix(in srgb, var(--popup-surface, #11161c) 96%, #fff 4%);
}

.group-confirm-state {
  margin-bottom: 7px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.68));
  font-size: 11px;
}

.alert-footer-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
}

.action-btn {
  width: 100%;
  min-width: 0;
}
</style>

<style lang="less">
.alert-confirm-panel-dialog.mars-dialog {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;

  .mars-dialog__content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .mars-dialog__footer {
    flex-shrink: 0;
    padding: 0 !important;
  }
}
</style>
