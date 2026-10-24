<template>
  <div class="template-data-renderer">
    <label>数据源<select v-model="sourceMode" aria-label="专题模板数据源" :disabled="busy">
      <option v-if="contract.automatic" value="auto">{{ contract.automatic === 'admin' ? '自动行政区边界 · 面积' : '框选底图 · RGB 亮度' }}</option>
      <option value="file">导入业务 GeoJSON</option>
      <option v-if="hasSample" value="sample">合成测试数据</option>
      <option v-if="observations" value="observations">已导入的地震观测</option>
    </select></label>
    <div class="source-actions">
      <button type="button" :disabled="busy" @click="fileInput?.click()"><mars-icon icon="upload" :width="16" />导入数据</button>
      <button type="button" title="下载字段说明" aria-label="下载模板字段说明" @click="downloadContract"><mars-icon icon="download" :width="16" /></button>
      <span>{{ sourceMode === 'auto' ? contract.automatic === 'admin' ? '真实行政区面积（km²）' : '亮度场，非物理观测量' : filename || (sourceMode === 'observations' ? observations?.source : '待导入') }}</span>
      <input ref="fileInput" type="file" hidden accept=".geojson,.json" aria-label="专题模板数据文件" @change="importFile" />
    </div>
    <div class="field-list"><span v-for="key in requiredFields" :key="key" :class="{ available: fields.includes(key) || sourceMode === 'auto' }">{{ key }}</span></div>
    <p v-if="importError" role="alert">{{ importError }}</p>
    <div class="data-controls">
      <label v-if="contract.automatic && sourceMode !== 'auto'">数值字段<select v-model="field" aria-label="专题模板数值字段" :disabled="busy"><option v-for="key in numericFields" :key="key">{{ key }}</option></select></label>
      <label v-if="contract.automatic && kind !== 'point-heat'">分级数量<input v-model.number="count" type="number" min="2" max="9" :disabled="busy" aria-label="专题模板分级数量" /></label>
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
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import { featureCollection, point } from "@turf/turf"
import { TEMPLATE_CONTRACTS, readTemplateDocument, renderTemplateDocument, rgbGridDocument, type TemplateDocument, type TemplateScene } from "./template-renderer"
import { ADMIN_AREA_FIELD, loadTemplateAdministrativeSource } from "./template-admin-source"
import type { EarthquakeDataset } from "./earthquake-analysis"
import * as mapWork from "./map"
import { fitTemplateSampleToBounds } from "./catalog-template-samples"

const props = defineProps<{ kind: string; palette: string; scopeKey: string; busy: boolean; fitSample?: boolean; observations?: EarthquakeDataset | null }>()
const emit = defineEmits<{(event: "change"): void; (event: "stage", value: string): void }>()
const contract = computed(() => TEMPLATE_CONTRACTS[props.kind])
function defaultSource() { if (contract.value.automatic) { return "auto" }; return props.observations ? "observations" : "file" }
const sourceMode = ref(defaultSource())
const imported = shallowRef<TemplateDocument | null>(null)
const hasSample = ref(false)
const sampleActive = computed(() => sourceMode.value === "sample")
const filename = ref(""); const importError = ref(""); const fileInput = ref<HTMLInputElement>()
const field = ref("value"); const count = ref(5); const radius = ref(45); const threshold = ref(2); const coherence = ref(0.4)
const progress = ref(100); const compare = ref<"difference" | "before" | "after">("difference")
const exposure = ref<"population" | "asset_value">("population")
const requiredFields = computed(() => props.kind === "population-exposure" ? [exposure.value, "intensity"] : contract.value.fields)
const scene = shallowRef<TemplateScene | null>(null); const selected = ref(""); const playing = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
let baseline: { scope: string; document: TemplateDocument } | null = null
let disposed = false
const isTrajectory = computed(() => ["trajectory", "swarm-trajectory"].includes(props.kind))
const thresholdConfig = computed(() => ({ "thermal-infrared": { label: "热异常 Z 阈值", min: 1, max: 5, step: 0.1 }, "insar-deformation": { label: "LOS 关注阈值（mm）", min: 1, max: 100, step: 1 }, "population-exposure": { label: "最低影响烈度", min: 1, max: 12, step: 1 } }[props.kind]))
const observationDocument = computed<TemplateDocument | null>(() => props.observations ? { ...featureCollection(props.observations.features.map(f => point([f.lon, f.lat], f.properties))), metadata: { ...props.observations.metadata, source: props.observations.source, observedAt: props.observations.observedAt } } : null)
const activeDocument = computed(() => sourceMode.value === "observations" ? observationDocument.value : imported.value)
let lastRenderedDocument: TemplateDocument | null = null
const fields = computed(() => [...new Set(activeDocument.value?.features.flatMap(f => Object.keys(f.properties)) || [])])
const numericFields = computed(() => fields.value.filter(name => activeDocument.value?.features.some(f => typeof f.properties[name] === "number")))
const ready = computed(() => !!props.scopeKey && (sourceMode.value === "auto" || !!activeDocument.value))
const chartMin = computed(() => Math.min(0, ...scene.value?.rows.map(row => row.value) || []))
const chartMax = computed(() => Math.max(1, ...scene.value?.rows.map(row => row.value) || []))

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) { return }
  try {
    if (file.size > 10 * 1024 * 1024) { throw new Error("GeoJSON 文件不能超过 10 MB") }
    const data = readTemplateDocument(JSON.parse(await file.text()), file.name)
    if (disposed) { return }
    importDocument(data, file.name)
  } catch (error) { importError.value = error instanceof Error ? error.message : "数据导入失败" }
  input.value = ""
}
function importDocument(data: TemplateDocument, name: string, syntheticSample = false) {
  hasSample.value = syntheticSample
  imported.value = data; filename.value = name; sourceMode.value = syntheticSample ? "sample" : "file"; importError.value = ""
  field.value = numericFields.value.includes("value") ? "value" : numericFields.value[0] || "value"
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
  let data = activeDocument.value
  let selectedField = field.value
  if (sourceMode.value === "auto" && contract.value.automatic === "admin") {
    emit("stage", "正在加载真实行政区边界")
    const administrative = await loadTemplateAdministrativeSource(bounds, signal)
    data = { ...administrative.document, metadata: { source: administrative.source, unit: "行政区面积（km²）" } }
    selectedField = ADMIN_AREA_FIELD
  } else if (sourceMode.value === "auto" && contract.value.automatic === "rgb") {
    emit("stage", "正在采样框选底图")
    if (baseline?.scope !== scope) {
      const blob = await mapWork.captureTemplateBaseImage()
      if (!blob) { throw new Error("框选底图截图不可用") }
      const bitmap = await createImageBitmap(blob)
      try {
        const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height
        const context = canvas.getContext("2d")!; context.drawImage(bitmap, 0, 0)
        baseline = { scope, document: rgbGridDocument(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, bounds) }
      } finally { bitmap.close() }
    }
    data = baseline.document; selectedField = "value"
  }
  signal.throwIfAborted()
  if (disposed || props.scopeKey !== scope || props.kind !== kind) { throw new Error("范围或模板已改变") }
  if (!data) { throw new Error(`${contract.value.name}需要 ${contract.value.geometry} 数据；缺少字段：${requiredFields.value.join("、")}`) }
  if (sampleActive.value && props.fitSample) { data = fitTemplateSampleToBounds(data, bounds) }
  emit("stage", `正在计算${contract.value.name}`)
  const output = renderTemplateDocument(kind, data, bounds, { field: selectedField, count: count.value, threshold: threshold.value, coherence: coherence.value, progress: progress.value, compare: compare.value, exposure: exposure.value, palette: props.palette })
  emit("stage", `正在绘制${contract.value.name}`)
  await mapWork.renderTemplateScene(output, radius.value, signal)
  signal.throwIfAborted()
  scene.value = output
  lastRenderedDocument = data
  return output
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
watch([sourceMode, field, count, radius, threshold, coherence, progress, compare, exposure], () => emit("change"))
watch(() => props.scopeKey, () => { stopPlayback(); baseline = null; lastRenderedDocument = null })
onBeforeUnmount(() => { disposed = true; stopPlayback(); mapWork.eventTarget.off("templateFeatureSelected", onMapSelect) })
function getDocument() {
  if (sourceMode.value === "auto") { return contract.value.automatic === "admin" ? lastRenderedDocument : null }
  const data = activeDocument.value; const bounds = mapWork.getLockedSelection()
  return data && sampleActive.value && props.fitSample && bounds ? fitTemplateSampleToBounds(data, bounds) : data
}
defineExpose({ render, ready, importDocument, sampleActive, getDocument })
</script>

<style scoped>
.template-data-renderer { display: grid; gap: 10px; min-width: 0; color: #edf5ff; }
label { display: grid; gap: 6px; min-width: 0; font-size: 13px; }
select, input[type="number"] { width: 100%; min-width: 0; height: 34px; border: 1px solid #56768f; background: #203348; color: #edf5ff; color-scheme: dark; }
.source-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.source-actions span, .result-note { font-size: 12px; color: #b7c9da; overflow-wrap: anywhere; }
button { display: inline-flex; gap: 6px; align-items: center; padding: 6px 10px; min-height: 32px; border: 1px solid #56768f; background: #263e53; color: #edf5ff; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
.field-list { display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; color: #ffd08a; }
.field-list .available { color: #6ddbb6; }
.data-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
input[type="range"] { width: 100%; accent-color: #35b4d3; }
output { color: #82d9f5; }
.replay-control { grid-column: 1 / -1; }
.linked-chart { display: grid; max-height: 240px; overflow-y: auto; gap: 4px; }
.linked-chart button { display: grid; grid-template-columns: minmax(60px, 1fr) 1fr 64px; gap: 8px; text-align: left; font-size: 12px; }
.linked-chart button[aria-pressed="true"] { border-color: #ffe773; }
.linked-chart span { overflow-wrap: anywhere; }
meter { width: 100%; }
[role="alert"] { color: #ffd08a; }
</style>
