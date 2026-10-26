<template>
  <mars-dialog
    title="剖面分析"
    icon="analysis"
    custom-class="insar-profile-panel-dialog"
    :width="dialogWidth"
    :height="DIALOG_HEIGHT"
    :min-width="DIALOG_MIN_WIDTH"
    :min-height="DIALOG_MIN_HEIGHT"
    :position="dialogPosition"
    :draggable="true"
  >
    <div class="insar-profile-panel">
      <div class="steps">
        <a-steps size="small" :current="stepIndex">
          <a-step title="对象确认" />
          <a-step title="参数" />
          <a-step title="运行" />
          <a-step title="导出" />
        </a-steps>
      </div>

      <div class="panel-scroll">
        <div v-if="stepIndex === 0" class="step-body">
          <div class="object-meta">
            <div class="meta-row">
              <span class="k">来源：</span>
              <span class="v">{{ sourceText }}</span>
            </div>
            <div class="meta-row">
              <span class="k">长度：</span>
              <span class="v">{{ lengthText }}</span>
            </div>
            <div class="meta-row">
              <span class="k">节点数：</span>
              <span class="v">{{ targetPointCountText }}</span>
            </div>
            <div class="meta-row">
              <span class="k">坐标系：</span>
              <span class="v">EPSG:4326</span>
            </div>
          </div>

          <div class="object-actions">
            <mars-button @click="reselectLine">重新绘制</mars-button>
            <mars-button @click="locateTarget" :disabled="!hasValidTarget">定位</mars-button>
            <mars-button @click="clearTarget" :disabled="!hasValidTarget">清除对象</mars-button>
          </div>
        </div>

        <div v-else-if="stepIndex === 1" class="step-body">
          <div class="param-card">
            <div class="param-row">
              <div class="label">采样点数：</div>
              <div class="value">
                <mars-input-number v-model:value="sampleCount" :min="16" :max="512" :step="16" />
              </div>
            </div>
            <div class="param-row">
              <div class="label">平滑窗口：</div>
              <div class="value">
                <mars-input-number v-model:value="smoothWindow" :min="1" :max="21" :step="2" />
              </div>
            </div>
            <div class="param-row">
              <div class="label">快捷档位：</div>
              <div class="value quick-actions">
                <mars-button size="small" @click="sampleCount = 64">64</mars-button>
                <mars-button size="small" @click="sampleCount = 128">128</mars-button>
                <mars-button size="small" @click="sampleCount = 256">256</mars-button>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="stepIndex === 2" class="step-body">
          <div class="run-actions">
            <mars-button type="primary" block :loading="running" :disabled="!hasValidTarget" @click="runProfile">
              开始分析
            </mars-button>
            <mars-button block :disabled="!running" @click="cancelRun">取消分析</mars-button>
          </div>

          <div v-if="progressText" class="progress-box">进度：{{ progressText }}</div>
        </div>

        <div v-else class="step-body result-step">
          <div v-if="resultSummary" class="result-layout">
            <div class="chart-card">
              <div class="chart-heading">
                <div>
                  <div class="chart-title">地形高程剖面</div>
                  <div class="chart-subtitle">滚轮缩放，拖动查看局部；悬停位置同步到地图</div>
                </div>
                <span class="terrain-status" :class="{ fallback: resultSummary.terrainSampled === false }">
                  {{ resultSummary.terrainSampled === false ? "地形采样回退" : "真实地形采样" }}
                </span>
              </div>
              <div ref="chartRef" class="profile-chart"></div>
            </div>

            <div class="result-card">
              <div class="result-title">剖面概览</div>
              <div class="metric-grid">
                <div class="metric-item">
                  <span>路径长度</span>
                  <strong>{{ formatSummaryDistance(resultSummary.totalLengthM) }}</strong>
                </div>
                <div class="metric-item">
                  <span>最大高差</span>
                  <strong>{{ formatSummaryElevation(resultSummary.reliefM) }}</strong>
                </div>
                <div class="metric-item">
                  <span>最低高程</span>
                  <strong>{{ formatSummaryElevation(resultSummary.minElevationM) }}</strong>
                </div>
                <div class="metric-item">
                  <span>最高高程</span>
                  <strong>{{ formatSummaryElevation(resultSummary.maxElevationM) }}</strong>
                </div>
              </div>
              <div class="summary-actions">
                <mars-button @click="exportCsv">导出CSV</mars-button>
                <mars-button @click="exportPng">导出PNG</mars-button>
                <mars-button @click="generatePdf">生成PDF</mars-button>
              </div>
              <div class="summary-detail-list">
                <div v-for="item in displaySummary" :key="item.k" class="summary-row">
                  <span class="k">{{ item.label }}</span>
                  <span class="v">{{ item.v }}</span>
                </div>
              </div>
              <div v-if="sinkStatusText" class="sink-status">{{ sinkStatusText }}</div>
            </div>
          </div>
          <div v-else class="empty-result">暂无结果</div>
        </div>
      </div>

      <div class="panel-footer" :class="{ dual: stepIndex > 0 }">
        <template v-if="stepIndex === 0">
          <mars-button type="primary" block :disabled="!hasValidTarget" @click="goNext">下一步</mars-button>
        </template>
        <template v-else>
          <mars-button block :disabled="running" @click="goPrev">上一步</mars-button>
          <mars-button
            v-if="stepIndex < 3"
            type="primary"
            block
            :disabled="(stepIndex === 1 && !hasValidTarget) || (stepIndex === 2 && (running || !resultSummary))"
            @click="goNext"
          >
            下一步
          </mars-button>
          <mars-button v-else type="primary" block @click="resetAll">重新分析</mars-button>
        </template>
      </div>
    </div>
  </mars-dialog>
</template>

<script setup lang="ts">
import * as echarts from "echarts"
import * as mars3d from "mars3d"
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { useWidget } from "@mars/common/store/widget"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import { $alert, $message } from "@mars/components/mars-ui/index"
import { getCurrentDataset } from "@/shell/currentDataset"
import { smartUploadArtifact } from "../dataset-repository/services/eoapi-artifacts"
import * as mapWork from "./map"
import { computeLineLengthMeters, profileSamplesToCsv } from "./utils"

useLifecycle(mapWork)

const { currentWidget } = useWidget()

const target = ref<any>(null)
const stepIndex = ref(0)
const sampleCount = ref(128)
const smoothWindow = ref(3)
const running = ref(false)
const progressText = ref("")
const sinkStatusText = ref("")
const resultSummary = ref<Record<string, any> | null>(null)
const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let chartResizeObserver: ResizeObserver | null = null
let observedChartElement: HTMLDivElement | null = null
let runToken = 0

const hasValidTarget = computed(() => Array.isArray(target.value?.points) && target.value.points.length >= 2)

const sourceText = computed(() => {
  const source = String(target.value?.source || "")
  if (source === "selection") {
    return "绘制线"
  }
  if (source === "marker") {
    return "线对象"
  }
  return "线对象/绘制线"
})

const lineLengthM = computed(() => {
  const points = Array.isArray(target.value?.points) ? target.value.points : []
  return computeLineLengthMeters(points)
})

const lengthText = computed(() => {
  const length = Number(lineLengthM.value || 0)
  if (!Number.isFinite(length) || length <= 0) {
    return "—"
  }
  if (length >= 1000) {
    return `${(length / 1000).toFixed(2)} km`
  }
  return `${length.toFixed(0)} m`
})

const targetPointCountText = computed(() => {
  const count = Array.isArray(target.value?.points) ? target.value.points.length : 0
  return count > 0 ? `${count}` : "—"
})

const displaySummary = computed(() => {
  const summary = resultSummary.value || {}
  const items: Array<{ k: string; label: string; v: string }> = []
  const push = (k: string, label: string, value: any) => {
    items.push({ k, label, v: value == null ? "—" : String(value) })
  }
  if (summary.sampleCount != null) { push("sampleCount", "采样点数", `${summary.sampleCount}`) }
  if (summary.sourcePointCount != null) { push("sourcePointCount", "原始节点数", `${summary.sourcePointCount}`) }
  if (summary.totalLengthM != null) { push("totalLengthM", "剖面长度", `${Number(summary.totalLengthM).toFixed(2)} m`) }
  if (summary.minElevationM != null) { push("minElevationM", "最小高程", `${Number(summary.minElevationM).toFixed(2)} m`) }
  if (summary.maxElevationM != null) { push("maxElevationM", "最大高程", `${Number(summary.maxElevationM).toFixed(2)} m`) }
  if (summary.avgElevationM != null) { push("avgElevationM", "平均高程", `${Number(summary.avgElevationM).toFixed(2)} m`) }
  if (summary.reliefM != null) { push("reliefM", "高差", `${Number(summary.reliefM).toFixed(2)} m`) }
  if (summary.startElevationM != null) { push("startElevationM", "起点高程", `${Number(summary.startElevationM).toFixed(2)} m`) }
  if (summary.endElevationM != null) { push("endElevationM", "终点高程", `${Number(summary.endElevationM).toFixed(2)} m`) }
  if (summary.elevationDeltaM != null) { push("elevationDeltaM", "起终点高程差", `${Number(summary.elevationDeltaM).toFixed(2)} m`) }
  if (summary.smoothWindow != null) { push("smoothWindow", "平滑窗口", `${summary.smoothWindow}`) }
  if (summary.terrainSampled != null) { push("terrainSampled", "高程来源", summary.terrainSampled ? "真实地形采样" : "原始高度回退") }
  return items
})

const dialogWidth = computed(() => (resultSummary.value ? 860 : 420))

/** 弹窗初始尺寸与最小约束 */
const DIALOG_HEIGHT = 640
/** 最小宽度：完整展示底部「上一步」「下一步」 */
const DIALOG_MIN_WIDTH = 260
/** 最小高度：标题栏高度（--popup-header-height 44px） */
const DIALOG_MIN_HEIGHT = 44

function getMapWrapperSize() {
  const el = document.getElementById("mars-main-view")
  return {
    width: el?.offsetWidth || window.innerWidth || 1200,
    height: el?.offsetHeight || window.innerHeight || 800
  }
}

function getCenteredPosition(width: number, height: number) {
  const { width: viewW, height: viewH } = getMapWrapperSize()
  return {
    left: Math.max(12, Math.round((viewW - width) / 2)),
    top: Math.max(12, Math.round((viewH - height) / 2))
  }
}

const dialogPosition = ref(getCenteredPosition(420, DIALOG_HEIGHT))

onMounted(() => {
  const graphic = currentWidget?.data?.graphic
  if (graphic) {
    target.value = mapWork.getTargetFromGraphic(graphic)
  } else if (currentWidget?.data?.target) {
    target.value = currentWidget.data.target
  }
})

onUnmounted(() => {
  mapWork.clearProfilePosition()
  chartResizeObserver?.disconnect()
  chartResizeObserver = null
  observedChartElement = null
  if (chart) {
    chart.dispose()
    chart = null
  }
})

function goNext() {
  stepIndex.value = Math.min(3, stepIndex.value + 1)
}

function goPrev() {
  stepIndex.value = Math.max(0, stepIndex.value - 1)
}

function locateTarget() {
  mapWork.flyToTarget(target.value, 1.2)
}

async function reselectLine() {
  const nextTarget = await mapWork.startSelectLine()
  if (!nextTarget) {
    $message("绘制失败")
    return
  }
  target.value = { ...nextTarget, source: "selection" }
  resultSummary.value = null
  sinkStatusText.value = ""
}

function clearTarget() {
  target.value = null
  resultSummary.value = null
  sinkStatusText.value = ""
  mapWork.clearTargetGraphic()
  mapWork.clearAnalysisResult()
}

function buildParams() {
  return {
    sampleCount: Math.max(16, Math.min(512, Number(sampleCount.value) || 128)),
    smoothWindow: Math.max(1, Math.min(21, Number(smoothWindow.value) || 1))
  }
}

async function runProfile() {
  if (!hasValidTarget.value) {
    return
  }
  const token = Date.now()
  runToken = token
  running.value = true
  progressText.value = "采样准备"
  sinkStatusText.value = ""
  resultSummary.value = null
  try {
    window.setTimeout(() => {
      if (runToken === token) {
        progressText.value = "高程采样"
      }
    }, 250)
    const summary = await mapWork.runProfileAnalysis(target.value, buildParams())
    if (runToken !== token) {
      return
    }
    progressText.value = "图表渲染"
    resultSummary.value = summary || null
    stepIndex.value = 3
    await nextTick()
    renderChart()
    progressText.value = "完成"
    await autoSinkOutputs()
  } catch (error: any) {
    if (runToken === token) {
      $alert(error?.message || "剖面分析失败", "剖面分析")
    }
  } finally {
    if (runToken === token) {
      running.value = false
    }
  }
}

function cancelRun() {
  runToken = Date.now()
  running.value = false
  progressText.value = ""
}

function resetAll() {
  stepIndex.value = 0
  progressText.value = ""
  sinkStatusText.value = ""
  resultSummary.value = null
  mapWork.clearProfilePosition()
  mapWork.clearAnalysisResult()
}

function renderChart() {
  const el = chartRef.value
  const samples = mapWork.getProfileSamples()
  if (!el || !samples.length) {
    return
  }
  if (!chart) {
    chart = echarts.init(el)
  }
  if (observedChartElement !== el && typeof ResizeObserver !== "undefined") {
    chartResizeObserver?.disconnect()
    observedChartElement = el
    chartResizeObserver = new ResizeObserver(() => chart?.resize())
    chartResizeObserver.observe(el)
  }
  chart.off("updateAxisPointer")
  chart.getZr().off("globalout")
  chart.setOption({
    animation: false,
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross", snap: true },
      backgroundColor: "rgba(12, 24, 38, 0.94)",
      borderColor: "rgba(64, 169, 255, 0.5)",
      textStyle: { color: "#f4f8fc" },
      formatter(params: any) {
        const first = Array.isArray(params) ? params[0] : null
        if (!first) {
          return ""
        }
        const data = first.data || {}
        return [
          `距起点：${(Number(data.distanceM || 0) / 1000).toFixed(3)} km`,
          `高程：${Number(data.value || 0).toFixed(2)} m`,
          `经度：${Number(data.lng || 0).toFixed(6)}`,
          `纬度：${Number(data.lat || 0).toFixed(6)}`
        ].join("<br/>")
      }
    },
    toolbox: {
      right: 8,
      top: 4,
      iconStyle: { borderColor: "#a9c7df" },
      emphasis: { iconStyle: { borderColor: "#40a9ff" } },
      feature: { restore: { title: "恢复全部" } }
    },
    grid: { left: 62, right: 26, top: 46, bottom: 78 },
    xAxis: {
      type: "category",
      name: "距离(km)",
      nameTextStyle: { color: "#93a9ba" },
      axisLine: { lineStyle: { color: "rgba(160, 190, 212, 0.45)" } },
      axisLabel: { color: "#a9bbc9" },
      splitLine: { show: false },
      data: samples.map((item) => (item.distanceM / 1000).toFixed(3))
    },
    yAxis: {
      type: "value",
      name: "高程(m)",
      scale: true,
      nameTextStyle: { color: "#93a9ba" },
      axisLabel: { color: "#a9bbc9" },
      splitLine: { lineStyle: { color: "rgba(160, 190, 212, 0.12)" } }
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none", zoomOnMouseWheel: true, moveOnMouseMove: true },
      {
        type: "slider",
        xAxisIndex: 0,
        height: 18,
        bottom: 18,
        borderColor: "rgba(160, 190, 212, 0.25)",
        backgroundColor: "rgba(8, 22, 34, 0.45)",
        fillerColor: "rgba(64, 169, 255, 0.2)",
        handleStyle: { color: "#40a9ff", borderColor: "#d9f2ff" },
        textStyle: { color: "#93a9ba" }
      }
    ],
    series: [
      {
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color: "#40a9ff" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(64,169,255,0.38)" },
            { offset: 1, color: "rgba(64,169,255,0.03)" }
          ])
        },
        data: samples.map((item) => ({
          value: Number(item.elevationM.toFixed(2)),
          distanceM: item.distanceM,
          lng: item.lng,
          lat: item.lat
        }))
      }
    ]
  })
  chart.on("updateAxisPointer", (event: any) => {
    const directIndex = Number(event?.dataIndex ?? event?.seriesDataIndices?.[0]?.dataIndex)
    const axisValue = String(event?.axesInfo?.[0]?.value ?? "")
    const index = Number.isInteger(directIndex)
      ? directIndex
      : samples.findIndex((item) => (item.distanceM / 1000).toFixed(3) === axisValue)
    if (Number.isInteger(index) && index >= 0 && index < samples.length) {
      mapWork.showProfilePosition(index)
    }
  })
  chart.getZr().on("globalout", () => mapWork.clearProfilePosition())
  chart.resize()
}

function formatSummaryDistance(value: any) {
  const meters = Number(value)
  if (!Number.isFinite(meters)) {
    return "—"
  }
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`
}

function formatSummaryElevation(value: any) {
  const meters = Number(value)
  return Number.isFinite(meters) ? `${meters.toFixed(1)} m` : "—"
}

watch(
  () => resultSummary.value,
  (value) => {
    if (value) {
      nextTick(() => renderChart())
    }
  }
)

function exportCsv() {
  mapWork.exportProfileCsv()
}

function chartDataUrl(): string {
  if (!chart) {
    throw new Error("图表未生成")
  }
  return chart.getDataURL({
    type: "png",
    pixelRatio: 2,
    backgroundColor: "#ffffff"
  })
}

function exportPng() {
  try {
    const url = chartDataUrl()
    mars3d.Util.downloadBase64Image("剖面分析图.png", url)
  } catch {
    $message("图表导出失败")
  }
}

function generatePdf() {
  if (!resultSummary.value) {
    return
  }
  let chartUrl = ""
  try {
    chartUrl = chartDataUrl()
  } catch {
  }
  const rows = displaySummary.value.map((item) => `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${item.label}</td><td style="padding:6px 10px;border:1px solid #ddd;">${item.v}</td></tr>`).join("")
  const html = `
  <html><head><meta charset="utf-8" /><title>剖面分析报告</title></head>
  <body style="font-family: Arial, sans-serif;">
    <h2>剖面分析报告</h2>
    <div>生成时间：${new Date().toLocaleString()}</div>
    <div>来源：${sourceText.value}</div>
    <div>长度：${lengthText.value}</div>
    ${chartUrl ? `<div style="margin:12px 0;"><img src="${chartUrl}" style="max-width:100%;" /></div>` : ""}
    <table style="border-collapse:collapse;margin-top:10px;">${rows}</table>
  </body></html>`
  const win = window.open("", "_blank", "noopener,noreferrer,width=960,height=720")
  if (!win) {
    $message("弹窗被拦截")
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  window.setTimeout(() => {
    try {
      win.focus()
      win.print()
    } catch {
    }
  }, 200)
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], name, { type: blob.type || "image/png" })
}

async function autoSinkOutputs() {
  const datasetId = String(getCurrentDataset()?.datasetId || "")
  if (!datasetId || !resultSummary.value) {
    return
  }
  try {
    sinkStatusText.value = "正在沉淀到当前任务目录…"
    const now = Date.now()
    const samples = mapWork.getProfileSamples()
    const csvFile = new File([profileSamplesToCsv(samples)], `剖面分析_${now}.csv`, { type: "text/csv" })
    const jsonFile = new File([JSON.stringify(resultSummary.value, null, 2)], `剖面分析摘要_${now}.json`, { type: "application/json" })
    await smartUploadArtifact({ file: csvFile, name: "剖面分析结果(CSV)", type: "export", datasetId })
    await smartUploadArtifact({ file: jsonFile, name: "剖面分析摘要(JSON)", type: "report", datasetId })
    try {
      const pngFile = await dataUrlToFile(chartDataUrl(), `剖面分析图_${now}.png`)
      await smartUploadArtifact({ file: pngFile, name: "剖面分析图(PNG)", type: "report", datasetId })
    } catch {
    }
    sinkStatusText.value = "已沉淀到当前任务目录"
  } catch {
    sinkStatusText.value = "沉淀失败（不影响分析结果）"
  }
}
</script>

<style lang="less" scoped>
.insar-profile-panel {
  height: 100%;
  min-height: 0;
  padding: 10px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;

  .steps {
    flex-shrink: 0;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-light);
  }

  .panel-scroll {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .step-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  }

  .panel-footer {
    flex-shrink: 0;
    padding-top: 10px;
    border-top: 1px solid var(--border-light);

    &.dual {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
  }

  .object-meta,
  .param-card,
  .result-card,
  .chart-card {
    border: 1px solid var(--border-light);
    padding: 10px;
    background: rgba(255, 255, 255, 0.02);
  }

  .meta-row,
  .param-row,
  .summary-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 0;
  }

  .param-row {
    align-items: center;
  }

  .k,
  .label {
    color: var(--mars-text-color-placeholder);
  }

  .v {
    font-variant-numeric: tabular-nums;
  }

  .object-actions,
  .summary-actions,
  .quick-actions,
  .run-actions {
    display: grid;
    gap: 8px;
  }

  .object-actions,
  .run-actions {
    grid-template-columns: repeat(3, 1fr);
  }

  .quick-actions {
    grid-template-columns: repeat(3, 1fr);
  }

  .summary-actions {
    grid-template-columns: repeat(3, 1fr);
    margin-bottom: 8px;
  }

  .progress-box,
  .sink-status,
  .empty-result {
    color: var(--mars-text-color-secondary);
  }

  .result-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    flex: 1;
    min-height: 0;
  }

  .chart-card {
    min-width: 0;
    background:
      linear-gradient(180deg, rgba(24, 51, 72, 0.32), rgba(8, 22, 34, 0.14)),
      rgba(255, 255, 255, 0.015);
  }

  .chart-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 4px 8px;
  }

  .chart-title,
  .result-title {
    color: var(--mars-text-color);
    font-size: 15px;
    font-weight: 650;
  }

  .chart-subtitle {
    margin-top: 4px;
    color: var(--mars-text-color-placeholder);
    font-size: 12px;
    line-height: 1.45;
  }

  .terrain-status {
    flex: 0 0 auto;
    padding: 4px 8px;
    border: 1px solid rgba(82, 196, 26, 0.4);
    border-radius: 12px;
    background: rgba(82, 196, 26, 0.1);
    color: #95de64;
    font-size: 12px;

    &.fallback {
      border-color: rgba(250, 173, 20, 0.45);
      background: rgba(250, 173, 20, 0.1);
      color: #ffd666;
    }
  }

  .result-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .metric-item {
    min-width: 0;
    padding: 9px;
    border-left: 2px solid #40a9ff;
    background: rgba(64, 169, 255, 0.08);

    span,
    strong {
      display: block;
    }

    span {
      color: var(--mars-text-color-placeholder);
      font-size: 11px;
    }

    strong {
      margin-top: 4px;
      color: var(--mars-text-color);
      font-size: 14px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .summary-detail-list {
    min-height: 0;
    overflow-y: auto;
    padding-right: 3px;
  }

  .profile-chart {
    width: 100%;
    min-height: 280px;
    height: 420px;
  }

  @media (max-width: 760px) {
    .result-layout {
      grid-template-columns: 1fr;
    }

    .profile-chart {
      height: 340px;
    }
  }
}
</style>

<style lang="less">
.insar-profile-panel-dialog.mars-dialog {
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
}
</style>
