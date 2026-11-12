<template>
  <div class="template-data-renderer">
    <label v-if="backendSources === undefined">数据源<select v-model="sourceMode" aria-label="专题模板数据源" :disabled="busy">
      <option value="map">地图业务图层</option>
      <option value="file">导入业务 GeoJSON</option>
      <option v-if="observations" value="observations">已导入的地震观测</option>
    </select></label>
    <details v-if="sourceMode === 'map'" :open="!activeDocument?.metadata.contentRecommendation || undefined" class="source-record"><summary>业务图层来源</summary>
      <label>业务图层<select v-model="layerId" aria-label="制图业务图层" :disabled="busy"><option value="">请选择已读取的业务图层</option><option v-for="source in sources" :key="source.id" :value="source.id">{{ source.name }}{{ source.issue ? ' · 需检查' : '' }}</option></select></label>
      <button type="button" :disabled="busy" @click="refreshSources"><mars-icon icon="refresh" :width="16" />刷新业务图层</button>
      <p v-if="!sources.length" class="result-note" role="status">尚未读取本产品的业务资料。行政区、地名和底图仅作参考，不会自动用作业务指标。</p>
      <p v-for="source in sources.filter(item => item.issue)" :key="source.id" class="result-note">{{ source.name }}：{{ source.issue }}</p>
    </details>
    <div class="source-actions">
      <button v-if="backendSources === undefined" type="button" :disabled="busy" @click="fileInput?.click()"><mars-icon icon="upload" :width="16" />导入数据</button>
      <button type="button" title="下载字段说明" aria-label="下载模板字段说明" @click="downloadContract"><mars-icon icon="download" :width="16" /></button>
      <span>{{ backendSources === undefined ? activeDocument?.metadata.source || filename || '待接入业务数据' : sources.find(source => source.id === layerId)?.name || '待接入业务数据' }}</span>
      <input ref="fileInput" type="file" hidden accept=".geojson,.json" aria-label="专题模板数据文件" @change="importFile" />
    </div>
    <details v-if="backendSources !== undefined && activeDocument" class="source-record"><summary>数据来源与字段说明</summary><p class="result-note">{{ activeDocument.metadata.source }}</p><p v-if="activeDocument.metadata.notice" class="result-note">{{ activeDocument.metadata.notice }}</p><p class="result-note">{{ activeDocument.features.length }} 个真实要素；{{ [...new Set(activeDocument.features.map(feature => feature.geometry.type))].join('、') }}</p></details>
    <p v-if="!activeDocument" class="result-note" role="status">{{ contract.name }}所需指标：{{ requiredFields.join('、') }}</p>
    <div v-else class="field-list"><span v-for="key in requiredFields" :key="key" :class="{ available: fields.includes(key) }">{{ key }}</span></div>
    <p v-if="importError" role="alert">{{ importError }}</p>
    <p v-if="sourceIssue" class="result-note" role="status">{{ sourceIssue }}</p>
    <div v-if="activeDocument" class="data-controls">
      <label v-for="key in contract.automatic ? [] : requiredFields" :key="key" class="field-mapping"><span class="field-mapping-name">{{ key }} 对应字段</span><select v-model="fieldMapping[key]" :aria-label="`专题字段映射 ${key}`" :disabled="busy"><option value="">请选择源字段</option><option v-for="name in availableFields(activeDocument, true)" :key="name" :value="name">{{ name }}</option></select></label>
      <label v-if="contract.automatic">指标字段<select v-model="field" aria-label="专题模板数值字段" :disabled="busy"><option value="">请选择指标</option><option v-for="key in numericFields" :key="key">{{ key }}</option></select></label>
      <label v-if="contract.automatic && kind !== 'unique-value'">指标单位<input v-model="unit" aria-label="专题指标单位" :disabled="busy" /></label>
      <label v-if="kind === 'choropleth'">分级方法<select v-model="method" aria-label="模板分级方法" :disabled="busy"><option value="natural">自然断点</option><option value="equal">等距</option><option value="quantile">分位数</option></select></label>
      <label v-if="contract.automatic && !['point-heat', 'unique-value'].includes(kind)">分级数量<input v-model.number="count" type="number" min="2" max="9" :disabled="busy" aria-label="专题模板分级数量" /></label>
      <label v-if="kind === 'point-heat'">核半径 <output>{{ radius }} px</output><input v-model.number="radius" aria-label="热力核半径" type="range" min="15" max="120" step="5" /></label>
      <label v-if="thresholdConfig">{{ thresholdConfig.label }}<input v-model.number="threshold" :min="thresholdConfig.min" :max="thresholdConfig.max" :step="thresholdConfig.step" type="number" aria-label="专题模板阈值" /></label>
      <label v-if="kind === 'insar-deformation'">最低相干性<input v-model.number="coherence" type="number" min="0.2" max="0.9" step="0.05" /></label>
      <label v-if="kind === 'time-compare'">对比时相<select v-model="compare" aria-label="对比时相"><option value="difference">后期 − 前期</option><option value="before">前期</option><option value="after">后期</option></select></label>
      <label v-if="kind === 'population-exposure'">暴露指标<select v-model="exposure" aria-label="暴露指标"><option value="population">人口</option><option value="asset_value">资产价值</option></select></label>
      <label v-if="isTrajectory" class="replay-control">时间进度 <output>{{ progress }}%</output><input v-model.number="progress" type="range" min="0" max="100" step="1" aria-label="轨迹时间进度" /><button type="button" :disabled="!ready" :title="playing ? '暂停回放' : '播放轨迹'" :aria-label="playing ? '暂停回放' : '播放轨迹'" @click="togglePlayback"><mars-icon :icon="playing ? 'pause' : 'play'" :width="16" /></button></label>
    </div>
    <p v-if="scene?.note" class="result-note">{{ scene.note }}</p>
    <div v-if="kind === 'chart-linkage' && scene" class="linked-chart" role="group" aria-label="专题图表联动">
      <button type="button" @click="selectRow('')">全部区域</button>
      <button v-for="row in scene.rows" :key="row.id" type="button" :aria-pressed="selected === row.id" @click="selectRow(row.id)"><span>{{ row.label }}</span><meter :value="row.value" :min="chartMin" :max="chartMax"></meter><output>{{ row.value.toFixed(2) }}</output></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import { featureCollection, point } from "@turf/turf"
import { TEMPLATE_CONTRACTS, renderTemplateDocument, type TemplateDocument, type TemplateScene, type TemplateOptions } from "./template-renderer"
import { loadEarthquakeParameters, type EarthquakeDataset } from "./earthquake-analysis"
import * as mapWork from "./map"
import { availableFields, businessResult, defaultBusinessField, readBusinessDocument, templateSourceIssue, type MapDataSource } from "./business-map-data"
import { bindExpressionFields } from "./expression-presentation"

const props = defineProps<{ kind: string; palette: string; scopeKey: string; busy: boolean; observations?: EarthquakeDataset | null; backendSources?: MapDataSource[]; workflowKey?: string }>()
const emit = defineEmits<{(event: "change"): void; (event: "stage", value: string): void }>()
const contract = computed(() => TEMPLATE_CONTRACTS[props.kind])
function defaultSource() { return props.observations && !contract.value.automatic ? "observations" : "map" }
const sourceMode = ref(defaultSource())
const imported = shallowRef<TemplateDocument | null>(null)
const sources = shallowRef<MapDataSource[]>([])
const layerId = ref("")
const unit = ref("")
const method = ref<"natural" | "equal" | "quantile">("natural")
function refreshSources() {
  const next = props.backendSources ?? mapWork.getBusinessDataSources()
  if (JSON.stringify(next) !== JSON.stringify(sources.value)) { sources.value = next }
  const usable = next.filter(source => source.document && !source.issue)
  const preferred = usable.filter(source => source.document?.metadata.contentRecommendation?.kind === props.kind)
  if (preferred.length === 1) { layerId.value = preferred[0].id } else if (!usable.some(source => source.id === layerId.value)) { layerId.value = usable.length === 1 ? usable[0].id : "" }
}
let stopSources: (() => void) | undefined
onMounted(() => { refreshSources(); if (props.backendSources === undefined) { stopSources = mapWork.onBusinessLayersChanged(refreshSources); window.addEventListener("focus", refreshSources) } })
watch(() => props.backendSources, refreshSources, { deep: true })
const filename = ref(""); const importError = ref(""); const fileInput = ref<HTMLInputElement>()
const field = ref("value"); const count = ref(5); const radius = ref(45); const threshold = ref(2); const coherence = ref(0.4)
const fieldMapping = ref<Record<string, string>>({})
const progress = ref(100); const compare = ref<"difference" | "before" | "after">("difference")
const exposure = ref<"population" | "asset_value">("population")
const requiredFields = computed(() => {
  if (props.kind === "population-exposure") { return [exposure.value, "intensity"] }
  return contract.value.automatic ? [field.value || "待选指标"] : contract.value.fields
})
const scene = shallowRef<TemplateScene | null>(null); const selected = ref(""); const playing = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
let disposed = false
const isTrajectory = computed(() => ["trajectory", "swarm-trajectory"].includes(props.kind))
const thresholdConfig = computed(() => ({ "thermal-infrared": { label: "热异常 Z 阈值", min: 1, max: 5, step: 0.1 }, "insar-deformation": { label: "LOS 关注阈值（mm）", min: 1, max: 100, step: 1 }, "population-exposure": { label: "最低影响烈度", min: 1, max: 12, step: 1 } }[props.kind]))
const observationDocument = computed<TemplateDocument | null>(() => props.observations ? { ...featureCollection(props.observations.features.map(f => point([f.lon, f.lat], f.properties))), metadata: { ...props.observations.metadata, source: props.observations.source, observedAt: props.observations.observedAt } } : null)
const activeDocument = computed(() => {
  if (sourceMode.value === "map") { return sources.value.find(source => source.id === layerId.value)?.document || null }
  return sourceMode.value === "observations" ? observationDocument.value : imported.value
})
let lastRenderedDocument: TemplateDocument | null = null
const fields = computed(() => [...new Set(activeDocument.value?.features.flatMap(f => Object.keys(f.properties)) || [])])
const numericFields = computed(() => availableFields(activeDocument.value, props.kind === "unique-value", true))
const normalization = computed(() => activeDocument.value?.metadata.contentRecommendation?.field === field.value ? activeDocument.value.metadata.contentRecommendation.normalization : undefined)
function renderOptions(document: TemplateDocument): TemplateOptions {
  const declaredUnit = typeof document.metadata.unit === "string" ? document.metadata.unit : undefined
  const indicatorUnit = props.kind === "unique-value" ? "类别" : unit.value.trim()
  return { field: contract.value.automatic ? field.value : undefined, method: method.value, count: count.value, threshold: threshold.value, coherence: coherence.value, progress: progress.value, compare: compare.value, exposure: exposure.value, palette: props.palette, radius: radius.value, normalization: normalization.value, geometryFilter: document.metadata.contentRecommendation?.geometry, unit: contract.value.automatic ? indicatorUnit : declaredUnit, fieldMapping: contract.value.automatic ? undefined : Object.fromEntries(requiredFields.value.map(key => [key, fieldMapping.value[key] || ""])) }
}
const sourceIssue = computed(() => {
  if (!activeDocument.value) { return sources.value.find(source => source.id === layerId.value)?.issue || "" }
  try {
    const options = renderOptions(activeDocument.value)
    const mapped = bindExpressionFields(activeDocument.value, options)
    const issue = templateSourceIssue(mapped, props.kind, exposure.value)
    if (issue) { return issue }
    if (contract.value.automatic && !field.value) { return "请选择真实业务指标字段" }
    if (contract.value.automatic && props.kind !== "unique-value" && !unit.value.trim()) { return "请确认指标单位；未知时可明确填写原始值，不推定为人口或金额" }
    const bounds = props.scopeKey ? mapWork.getLockedSelection() : null
    if (bounds) { renderTemplateDocument(props.kind, mapped, bounds, options) }
    return ""
  } catch (error) { return error instanceof Error ? error.message : "字段绑定不完整" }
})
const ready = computed(() => !!props.scopeKey && !!activeDocument.value && !sourceIssue.value)
watch([activeDocument, exposure], ([value]) => {
  field.value = defaultBusinessField(value, props.kind); unit.value = typeof value?.metadata.unit === "string" ? value.metadata.unit : ""
  const parameters = loadEarthquakeParameters(value?.metadata || {})
  if (props.kind === "thermal-infrared") { threshold.value = parameters.thermalZ }
  if (props.kind === "insar-deformation") { threshold.value = parameters.deformationMm; coherence.value = parameters.coherenceMin }
  const available = availableFields(value, true)
  fieldMapping.value = Object.fromEntries(requiredFields.value.map(key => [key, available.includes(value?.metadata.fieldMapping?.[key]) ? value!.metadata.fieldMapping[key] : available.find(name => name.toLowerCase() === key.toLowerCase()) || ""]))
  lastRenderedDocument = null; scene.value = null; emit("change")
}, { immediate: true })
const chartMin = computed(() => Math.min(0, ...scene.value?.rows.map(row => row.value) || []))
const chartMax = computed(() => Math.max(1, ...scene.value?.rows.map(row => row.value) || []))

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) { return }
  try {
    if (file.size > 10 * 1024 * 1024) { throw new Error("GeoJSON 文件不能超过 10 MB") }
    const data = readBusinessDocument(JSON.parse(await file.text()), file.name)
    if (disposed) { return }
    importDocument(data, file.name)
  } catch (error) { importError.value = error instanceof Error ? error.message : "数据导入失败" }
  input.value = ""
}
function importDocument(data: TemplateDocument, name: string) {
  imported.value = readBusinessDocument(data, name); filename.value = name; sourceMode.value = "file"; importError.value = ""
  emit("change")
}
function downloadContract() {
  const content = { type: "FeatureCollection", metadata: { source: "", observedAt: "", ...contract.value.metadata, ...(exposure.value === "asset_value" ? { assetUnit: "元" } : {}) }, fieldGuide: { geometry: contract.value.geometry, required: requiredFields.value }, features: [] }
  const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: "application/geo+json" }))
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${props.kind}-fields.geojson`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function render(signal: AbortSignal) {
  const bounds = mapWork.getLockedSelection()
  if (!bounds) { throw new Error("请先框选并锁定范围") }
  const scope = props.scopeKey
  const kind = props.kind
  if (!activeDocument.value) { throw new Error(`${contract.value.name}缺少业务数据：${requiredFields.value.join("、")}`) }
  if (sourceMode.value === "map") {
    const latest = (props.backendSources ?? mapWork.getBusinessDataSources()).find(source => source.id === layerId.value)?.document
    if (!latest || JSON.stringify(latest) !== JSON.stringify(activeDocument.value)) { refreshSources(); throw new Error("业务图层已更新或被移除，请重新确认数据") }
  }
  const original = readBusinessDocument(activeDocument.value, "", { maxFeatures: 2000, maxVertices: 250000 })
  if (contract.value.automatic && !field.value) { throw new Error("请明确选择指标字段，不能用行政区面积代替业务指标") }
  if (contract.value.automatic && props.kind !== "unique-value" && !unit.value.trim()) { throw new Error("请确认指标单位") }
  const options = renderOptions(original)
  const data = bindExpressionFields(original, options)
  signal.throwIfAborted()
  if (disposed || props.scopeKey !== scope || props.kind !== kind) { throw new Error("范围或模板已改变") }
  const issue = templateSourceIssue(data, kind, exposure.value)
  if (issue) { throw new Error(issue) }
  emit("stage", `正在计算${contract.value.name}`)
  const output = renderTemplateDocument(kind, data, bounds, options)
  const snapshot = await businessResult(data, output, bounds, options)
  signal.throwIfAborted()
  emit("stage", `正在绘制${contract.value.name}`)
  await mapWork.renderTemplateScene(output, radius.value, signal, output.heat ? undefined : props.workflowKey)
  signal.throwIfAborted()
  scene.value = output
  lastRenderedDocument = data
  return snapshot
}
function stopPlayback() { if (timer) { clearInterval(timer) }; timer = null; playing.value = false }
function togglePlayback() {
  if (playing.value) { stopPlayback(); return }
  progress.value = 0; playing.value = true
  timer = setInterval(() => { if (props.busy) { return }; progress.value = Math.min(100, progress.value + 5); if (progress.value >= 100) { stopPlayback() } }, 800)
}
function selectRow(id: string) { selected.value = id; mapWork.highlightTemplateFeature(id) }
function onMapSelect(event: { id: string }) { if (props.kind === "chart-linkage") { selectRow(event.id) } }
mapWork.eventTarget.on("templateFeatureSelected", onMapSelect)
watch(() => props.kind, () => {
  stopPlayback(); scene.value = null; importError.value = ""; selected.value = ""
  threshold.value = { "insar-deformation": 20, "population-exposure": 6 }[props.kind] || 2
  if (!imported.value) { sourceMode.value = defaultSource() }
}, { immediate: true })
watch([sourceMode, field, unit, method, count, radius, threshold, coherence, progress, compare, exposure], () => { lastRenderedDocument = null; scene.value = null; emit("change") })
watch(fieldMapping, () => { lastRenderedDocument = null; scene.value = null; emit("change") }, { deep: true })
watch(() => props.scopeKey, () => { stopPlayback(); lastRenderedDocument = null; scene.value = null; refreshSources() })
onBeforeUnmount(() => { disposed = true; stopPlayback(); stopSources?.(); window.removeEventListener("focus", refreshSources); mapWork.eventTarget.off("templateFeatureSelected", onMapSelect) })
function getDocument() {
  return lastRenderedDocument
}
defineExpose({ render, ready, refreshSources, importDocument, getDocument })
</script>

<style scoped>
.template-data-renderer { display: grid; gap: 10px; min-width: 0; color: var(--thematic-ink); }
label { display: grid; gap: 6px; min-width: 0; font-size: 13px; }
select, input:not([type="range"]):not([type="file"]) { width: 100%; min-width: 0; height: 34px; padding: 0 10px; border: 1px solid var(--thematic-line); background: var(--thematic-control); color: var(--thematic-ink); color-scheme: var(--thematic-scheme); }
.source-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.source-actions span, .result-note { font-size: 12px; color: var(--thematic-muted); overflow-wrap: anywhere; }
button { display: inline-flex; gap: 6px; align-items: center; padding: 6px 10px; min-height: 32px; border: 1px solid var(--thematic-line); background: var(--thematic-surface); color: var(--thematic-ink); cursor: pointer; }
button:disabled { opacity: 1; color: var(--thematic-disabled-ink); background: var(--thematic-disabled-bg); cursor: not-allowed; }
.field-list { display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; color: var(--thematic-warning); }
.field-list .available { color: var(--thematic-success); }
.data-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 10px; }
.field-mapping { display: flex; flex-direction: column; justify-content: space-between; }
.field-mapping-name { line-height: 1.5; overflow-wrap: anywhere; }
.field-mapping select { flex-shrink: 0; }
input[type="range"] { width: 100%; accent-color: var(--thematic-accent); }
output { color: var(--thematic-accent); }
.replay-control { grid-column: 1 / -1; }
.linked-chart { display: grid; max-height: 240px; overflow-y: auto; gap: 4px; }
.linked-chart button { display: grid; grid-template-columns: minmax(60px, 1fr) 1fr 64px; gap: 8px; text-align: left; font-size: 12px; }
.linked-chart button[aria-pressed="true"] { border-color: var(--thematic-accent); }
.linked-chart span { overflow-wrap: anywhere; }
meter { width: 100%; }
[role="alert"] { color: var(--thematic-warning); }
</style>
