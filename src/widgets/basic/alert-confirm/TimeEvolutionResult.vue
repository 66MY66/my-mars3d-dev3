<template>
  <mars-dialog :title="`时空演化｜${result.alertNo}`" icon="chart-line" custom-class="alert-analysis-result-dialog temporal-result-dialog" :visible="true" :width="860" top="64" :draggable="true" :nopadding="true" :persist-layout="false" @closed="emit('close')">
    <div class="result-page">
      <header class="result-summary">
        <div><div class="result-kicker">观测—预报—温差日序列</div><h2>{{ result.taskName }}</h2><p>{{ dateRange }} · 共 {{ result.records.length }} 天 · 有效温差 {{ result.metrics.validDays }} 天</p></div>
        <span class="trend-badge" :class="trendClass">{{ result.trend }}</span>
      </header>

      <section class="metric-strip" aria-label="日序列核心指标">
        <div><span>异常指数</span><strong>{{ number(result.anomalyIndex) }}</strong></div>
        <div><span>最新温差</span><strong :class="diffClass(result.metrics.latestDiffC)">{{ temperature(result.metrics.latestDiffC, true) }}</strong></div>
        <div><span>最大绝对温差</span><strong>{{ temperature(result.metrics.maxAbsDiffC) }}</strong></div>
        <div><span>平均温差</span><strong>{{ temperature(result.metrics.averageDiffC, true) }}</strong></div>
        <div><span>基线样本</span><strong>{{ result.baselineN == null ? "—" : `${result.baselineN} 天` }}</strong></div>
      </section>

      <section class="analysis-section">
        <div class="section-heading"><div><h3>观测温度与预报温度</h3><p>同一温标下按日期对照，不推导接口未提供的面积或扩张结论。</p></div><div class="chart-legend"><span class="observed">观测温度</span><span class="forecast">预报温度</span></div></div>
        <svg class="temporal-chart" viewBox="0 0 760 250" role="img" aria-label="观测温度与预报温度日序列图">
          <g class="chart-grid"><line v-for="y in [28,78,128,178,228]" :key="y" x1="54" :y1="y" x2="730" :y2="y" /></g>
          <line class="chart-axis" x1="54" y1="228" x2="730" y2="228" />
          <polyline class="chart-line observed-line" :points="observedPoints" /><polyline class="chart-line forecast-line" :points="forecastPoints" />
          <g v-for="point in chartPoints" :key="point.date"><circle v-if="point.obsY != null" class="observed-dot" :cx="point.x" :cy="point.obsY" r="4" /><circle v-if="point.fcY != null" class="forecast-dot" :cx="point.x" :cy="point.fcY" r="4" /><text class="chart-label" :x="point.x" y="246" text-anchor="middle">{{ point.date.slice(5) }}</text></g>
        </svg>
      </section>

      <section class="analysis-section diff-section">
        <div class="section-heading"><div><h3>逐日温差</h3><p>温差 = 观测温度 − 预报温度；零线上方为正温差，下方为负温差。</p></div></div>
        <div class="diff-bars"><div v-for="item in result.records" :key="item.date" class="diff-column"><div class="bar-track"><i v-if="item.diffC != null" :class="diffClass(item.diffC)" :style="diffBarStyle(item.diffC)" /></div><strong :class="diffClass(item.diffC)">{{ temperature(item.diffC, true) }}</strong><span>{{ item.date.slice(5) }}</span></div></div>
      </section>

      <section class="analysis-section"><div class="section-heading"><div><h3>逐日数据明细</h3><p>字段直接对应接口 days[]。</p></div></div><div class="table-scroll"><table><thead><tr><th>日期</th><th>观测温度</th><th>预报温度</th><th>温差</th><th>数据状态</th></tr></thead><tbody><tr v-for="item in result.records" :key="item.date"><td>{{ item.date }}</td><td>{{ temperature(item.obsC) }}</td><td>{{ temperature(item.fcC) }}</td><td :class="diffClass(item.diffC)">{{ temperature(item.diffC, true) }}</td><td>{{ item.obsC != null && item.fcC != null && item.diffC != null ? "完整" : "部分缺失" }}</td></tr></tbody></table></div></section>
      <section class="data-note"><span>数据说明</span><p>{{ result.summary }}</p></section>
    </div>
    <template #footer><div class="result-footer"><button data-testid="close-temporal-result" type="button" @click="emit('close')">返回告警确认</button></div></template>
  </mars-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { TemporalAnalysisResult } from "./analysis-model"
const props = defineProps<{ result: TemporalAnalysisResult }>()
const emit = defineEmits<{(event: "close"): void}>()
const trendClass = computed(() => ({ "is-rising": props.result.trend === "上升", "is-falling": props.result.trend === "下降" }))
const dateRange = computed(() => props.result.records.length ? `${props.result.records[0].date}—${props.result.records.at(-1)?.date}` : "暂无日期")
const chartPoints = computed(() => {
  const values = props.result.records.flatMap((item) => [item.obsC, item.fcC]).filter((value): value is number => value != null)
  const min = values.length ? Math.min(...values) - 1 : 0; const max = values.length ? Math.max(...values) + 1 : 1
  const y = (value: number | null) => value == null ? null : 228 - ((value - min) / Math.max(max - min, 1)) * 190
  return props.result.records.map((item, index) => ({ ...item, x: 54 + index * 676 / Math.max(props.result.records.length - 1, 1), obsY: y(item.obsC), fcY: y(item.fcC) }))
})
const observedPoints = computed(() => chartPoints.value.filter((item) => item.obsY != null).map((item) => `${item.x},${item.obsY}`).join(" "))
const forecastPoints = computed(() => chartPoints.value.filter((item) => item.fcY != null).map((item) => `${item.x},${item.fcY}`).join(" "))
function number(value: number | null) { return value == null ? "—" : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") }
function temperature(value: number | null, signed = false) { return value == null ? "—" : `${signed && value > 0 ? "+" : ""}${number(value)}℃` }
function diffClass(value: number | null) {
  if (value == null) { return "is-missing" }
  if (value > 0) { return "is-positive" }
  if (value < 0) { return "is-negative" }
  return "is-neutral"
}
function diffBarStyle(value: number) { const size = Math.max(4, Math.abs(value) / Math.max(props.result.metrics.maxAbsDiffC || 1, 1) * 42); return value >= 0 ? { height: `${size}px`, bottom: "50%" } : { height: `${size}px`, top: "50%" } }
</script>

<style lang="less" scoped>
.result-page{max-height:calc(100vh - 150px);overflow-y:auto;padding:22px;color:var(--text-primary,#eef5fb);background:linear-gradient(180deg,rgba(31,54,72,.28),transparent 180px),var(--popup-bg,#0d141b)}.result-summary{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:18px;border-bottom:1px solid rgba(151,185,210,.16)}.result-kicker{color:#79b9e8;font-size:12px}h2{margin:4px 0;font-size:20px}.result-summary p,.section-heading p{margin:0;color:rgba(220,235,246,.58);font-size:12px}.trend-badge{padding:7px 12px;border:1px solid rgba(65,168,255,.32);border-radius:4px;color:#6fc5ff;background:rgba(65,168,255,.12);font-size:13px;font-weight:600}.trend-badge.is-rising{color:#ff9b78;border-color:rgba(255,132,94,.34);background:rgba(255,132,94,.12)}.trend-badge.is-falling{color:#78d9ad;border-color:rgba(64,194,133,.32);background:rgba(64,194,133,.12)}.metric-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;margin:16px 0;border:1px solid rgba(151,185,210,.14);background:rgba(151,185,210,.14)}.metric-strip div{padding:12px;background:rgba(15,25,34,.96)}.metric-strip span{display:block;color:rgba(220,235,246,.55);font-size:11px}.metric-strip strong{display:block;margin-top:6px;font-size:15px}.analysis-section{margin-top:14px;padding:16px;border:1px solid rgba(151,185,210,.14);background:rgba(16,27,36,.72)}.section-heading{display:flex;justify-content:space-between;gap:16px;margin-bottom:12px}h3{margin:0 0 3px;font-size:14px}.chart-legend{display:flex;gap:14px;color:rgba(220,235,246,.7);font-size:11px}.chart-legend span::before{content:"";display:inline-block;width:14px;height:2px;margin:0 5px 3px 0}.observed::before{background:#ff956e}.forecast::before{background:#58b5ed}.temporal-chart{display:block;width:100%;min-height:220px}.chart-grid line{stroke:rgba(151,185,210,.11)}.chart-axis{stroke:rgba(151,185,210,.28)}.chart-line{fill:none;stroke-width:2.5;stroke-linejoin:round}.observed-line{stroke:#ff956e}.forecast-line{stroke:#58b5ed}.observed-dot{fill:#ff956e}.forecast-dot{fill:#58b5ed}.chart-label{fill:rgba(220,235,246,.6);font-size:10px}.diff-bars{display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:8px}.diff-column{text-align:center}.bar-track{position:relative;height:100px;border-top:1px solid transparent;background:linear-gradient(to bottom,transparent 49.5%,rgba(220,235,246,.28) 49.5%,rgba(220,235,246,.28) 50.5%,transparent 50.5%)}.bar-track i{position:absolute;left:calc(50% - 9px);width:18px;border-radius:2px}.diff-column strong,.diff-column span{display:block;font-size:11px}.diff-column span{margin-top:3px;color:rgba(220,235,246,.5)}.is-positive{color:#ff956e!important}.bar-track .is-positive{background:#ff956e}.is-negative{color:#66baf0!important}.bar-track .is-negative{background:#58b5ed}.is-missing{color:rgba(220,235,246,.4)!important}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:12px}th{color:rgba(220,235,246,.55);font-weight:500;text-align:left;background:rgba(151,185,210,.06)}th,td{padding:9px 10px;border-bottom:1px solid rgba(151,185,210,.1)}.data-note{display:grid;grid-template-columns:70px 1fr;gap:12px;margin-top:14px;padding:13px 15px;border-left:3px solid #58b5ed;background:rgba(65,168,255,.08)}.data-note span{color:#83caf6;font-size:12px}.data-note p{margin:0;color:rgba(238,247,255,.78);font-size:12px;line-height:1.6}.result-footer{display:flex;justify-content:flex-end;width:100%;padding:10px 16px;border-top:1px solid rgba(151,185,210,.14);background:#0d141b}.result-footer button{height:32px;padding:0 16px;border:1px solid rgba(65,168,255,.52);border-radius:4px;background:rgba(65,168,255,.14);color:#8fd0ff;cursor:pointer}@media(max-width:760px){.metric-strip{grid-template-columns:repeat(2,1fr)}.result-page{padding:14px}}
</style>
