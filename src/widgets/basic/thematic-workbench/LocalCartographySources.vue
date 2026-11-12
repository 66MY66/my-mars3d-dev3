<template>
  <section class="local-sources" aria-label="项目制图数据目录">
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="!available.length && !error">当前模板没有匹配的项目数据。</p>
    <template v-if="available.length">
      <label>项目数据<select v-model="selected" aria-label="项目制图数据" :disabled="loading || disabled"><option v-for="item in available" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
      <template v-if="source">
        <p class="notice">{{ source.notice }}</p>
        <dl><dt>坐标</dt><dd>{{ source.crs }}{{ source.kind === 'raw-grid' ? ' · 原椭球，非 WGS84/CGCS2000' : '' }}</dd><dt>来源</dt><dd>{{ source.source }}</dd></dl>
        <template v-if="source.kind !== 'thermal'">
          <label v-if="source.kind === 'imagery'">取数范围<select v-model="extentMode" aria-label="影像取数范围" :disabled="loading || disabled"><option value="source">影像实际覆盖范围</option><option value="map" :disabled="!mapBounds">当前地图框选范围</option></select></label>
          <div v-if="source.kind === 'raw-grid'" class="extent"><label v-for="(name, key) in boundNames" :key="key">原椭球{{ name }}<input v-model.number="extent[key]" type="number" step="0.01" :aria-label="`原椭球${name}`" :disabled="loading || disabled" /></label></div>
          <button type="button" :disabled="loading || disabled" @click="loadStandard"><mars-icon icon="layers" :width="16" />{{ loading ? '正在读取数据' : '载入数据参考图' }}</button>
        </template>
        <template v-else>
          <label>日期<select v-model="date" aria-label="温度日期" :disabled="loading || disabled"><option v-for="day in dates" :key="day">{{ day }}</option></select></label>
          <label>观测与预报配对<select v-model="frameId" aria-label="温度时次" :disabled="loading || disabled"><option v-for="item in dateFrames" :key="item.id" :value="item.id">{{ item.passName === 'day' ? '日间' : '夜间' }} · 观测 UTC {{ item.utcHour }}h / 预报时效 {{ item.forecastStep }}h</option></select></label>
          <label>指标<select v-model="metric" aria-label="温度指标" :disabled="loading || disabled"><option value="observedC">观测温度（TIFF 换算 °C）</option><option value="forecastC">报告预报温度（°C）</option><option value="differenceC">报告预报 − 观测（°C）</option></select></label>
          <p v-if="frame">{{ frame.points.length }} 个有效格点 · 1°网格 · 时间不完全一致，不作为同时刻误差检验</p>
          <button type="button" :disabled="loading || disabled || !frame" @click="loadThermal"><mars-icon icon="layers" :width="16" />载入温度数据</button>
          <details @toggle="readNativeForecast"><summary>原始非规则预报格点</summary>
            <p v-if="nativeLoading" role="status">正在校验原始预报格点…</p>
            <template v-if="nativeForecasts.length"><label>原始预报日期<select v-model="nativeDate" aria-label="原始预报日期"><option v-for="day in nativeDates" :key="day">{{ day }}</option></select></label><label>预报时效<select v-model.number="nativeStep" aria-label="原始预报时效"><option v-for="item in nativeSteps" :key="item.stepHour" :value="item.stepHour">{{ item.stepHour }} h</option></select></label></template>
            <template v-if="nativeFrame">
              <p>{{ nativeFrame.gridType }} · {{ nativeFrame.points.length }} 点 · 原值 {{ nativeFrame.unit }} · 球半径 {{ nativeFrame.radiusMetres }} m</p>
              <p>预报有效日期 {{ nativeFrame.validDate }} / UTC {{ String(nativeFrame.validTime).padStart(4, '0') }} · 与上方观测时刻并非完全一致</p>
              <table><thead><tr><th>经度</th><th>纬度</th><th>原始值（{{ nativeFrame.unit }}）</th></tr></thead><tbody><tr v-for="(point, i) in nativeFrame.points.slice(nativePage * 10, nativePage * 10 + 10)" :key="i"><td>{{ point.lon.toFixed(5) }}</td><td>{{ point.lat.toFixed(5) }}</td><td>{{ point.value.toFixed(3) }}</td></tr></tbody></table>
              <div class="pages"><button type="button" aria-label="上一页预报格点" title="上一页" :disabled="nativePage === 0" @click="nativePage--"><mars-icon icon="left" :width="16" /></button><span>{{ nativePage + 1 }} / {{ Math.ceil(nativeFrame.points.length / 10) }}</span><button type="button" aria-label="下一页预报格点" title="下一页" :disabled="(nativePage + 1) * 10 >= nativeFrame.points.length" @click="nativePage++"><mars-icon icon="right" :width="16" /></button><button type="button" title="下载当前原始预报格点及元数据" aria-label="下载原始预报格点" @click="downloadNative"><mars-icon icon="download" :width="16" /></button></div>
            </template>
            <p v-else-if="nativeForecasts.length">此时次没有匹配的原始预报消息，不代填其他时次。</p>
          </details>
        </template>
        <details><summary>处理记录与来源指纹</summary><p>{{ source.processing }}</p><p>原始输入{{ source.inputFiles ? '清单' : '文件' }} SHA-256：{{ source.sourceSha256 }}</p><p v-for="file in source.inputFiles" :key="file.path">{{ file.path }} · {{ file.sha256 }}</p><p>接入产品 SHA-256：{{ source.sha256 }}</p></details>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { localCatalog, localReferenceDocument, thermalDocument, verifiedLocalBytes, type LocalSource, type ThermalFrame, type NativeForecast } from "./local-cartography-source"
import type { DbtBounds, DbtDocument } from "./dbt116-standard"
import type { TemplateDocument } from "./template-renderer"
const props = defineProps<{ templateId?: string; analysis?: boolean; disabled?: boolean; mapBounds?: DbtBounds | null }>()
const emit = defineEmits<{(event: "document", value: DbtDocument): void; (event: "business", value: TemplateDocument): void; (event: "loading", value: boolean): void }>()
const sources = ref<LocalSource[]>([]); const selected = ref(""); const loading = ref(false); const error = ref("")
const boundNames = { west: "西界经度", south: "南界纬度", east: "东界经度", north: "北界纬度" }
const extent = ref<DbtBounds>({ west: 100, south: 28, east: 104, north: 31 }); const extentMode = ref("source")
const available = computed(() => sources.value.filter(s => {
  if (props.analysis) { return s.kind === "thermal" }
  if (props.templateId === "T30102000") { return s.kind === "raw-grid" }
  return props.templateId === "T30203000" && s.kind === "imagery"
}))
const source = computed(() => available.value.find(s => s.id === selected.value))
const frames = ref<ThermalFrame[]>([]); const date = ref(""); const frameId = ref(""); const metric = ref<"observedC" | "forecastC" | "differenceC">("observedC")
const dates = computed(() => [...new Set(frames.value.map(f => f.date))])
const dateFrames = computed(() => frames.value.filter(f => f.date === date.value))
const frame = computed(() => dateFrames.value.find(f => f.id === frameId.value))
const nativeForecasts = ref<NativeForecast[]>([]); const nativeLoading = ref(false); const nativePage = ref(0)
const nativeDate = ref(""); const nativeStep = ref(0)
const nativeDates = computed(() => [...new Set(nativeForecasts.value.map(f => f.date))])
const nativeSteps = computed(() => nativeForecasts.value.filter(f => f.date === nativeDate.value))
const nativeFrame = computed(() => nativeSteps.value.find(f => f.stepHour === nativeStep.value))
watch(frame, value => { if (value) { nativeDate.value = value.date; nativeStep.value = value.forecastStep } })
watch(nativeSteps, list => { if (!list.some(f => f.stepHour === nativeStep.value)) { nativeStep.value = list[0]?.stepHour || 0 } })
watch(nativeFrame, () => { nativePage.value = 0 })
let controller = new AbortController(); let disposed = false
watch(available, list => { if (!list.some(s => s.id === selected.value)) { selected.value = list[0]?.id || "" } })
watch(dateFrames, list => { if (!list.some(f => f.id === frameId.value)) { frameId.value = list[0]?.id || "" } })
watch(source, async value => {
  controller.abort(); controller = new AbortController(); error.value = ""; frames.value = []; nativeForecasts.value = []; date.value = ""; extentMode.value = "source"
  if (value?.kind !== "thermal") { return }
  const request = controller
  try {
    const bytes = await verifiedLocalBytes(value, request.signal)
    const data = JSON.parse(new TextDecoder().decode(bytes))
    if (!Array.isArray(data.frames)) { throw new Error("温度时次文件结构无效") }
    frames.value = data.frames; date.value = dates.value[0] || ""
  } catch (err) { if (!request.signal.aborted) { error.value = err instanceof Error ? err.message : "温度数据读取失败" } }
})
onMounted(async () => {
  const request = controller
  try { sources.value = await localCatalog(request.signal) } catch (err) { if (!request.signal.aborted) { error.value = err instanceof Error ? err.message : "目录读取失败" } }
})
async function loadStandard() {
  if (!source.value || loading.value || props.disabled) { return }
  const snapshot = source.value; const request = controller
  let bounds = snapshot.bounds
  if (snapshot.kind === "raw-grid") { bounds = { ...extent.value } } else if (extentMode.value === "map") { bounds = props.mapBounds! }
  if (!bounds) { error.value = "请先框选地图范围"; return }
  loading.value = true; error.value = ""; emit("loading", true)
  try {
    const result = await localReferenceDocument(snapshot, bounds, request.signal)
    if (!disposed && !request.signal.aborted) { emit("document", result) }
  } catch (err) { if (!request.signal.aborted) { error.value = err instanceof Error ? err.message : "本地数据加载失败" } } finally { if (!disposed) { loading.value = false; emit("loading", false) } }
}
function loadThermal() { if (source.value && frame.value && !props.disabled) { emit("business", thermalDocument(source.value, frame.value, metric.value)) } }
async function readNativeForecast(event: Event) {
  if (!(event.target as HTMLDetailsElement).open || nativeForecasts.value.length || nativeLoading.value || !source.value?.nativeForecastUrl || !source.value.nativeForecastSha256) { return }
  nativeLoading.value = true; const request = controller
  try {
    const bytes = await verifiedLocalBytes({ ...source.value, url: source.value.nativeForecastUrl, sha256: source.value.nativeForecastSha256 }, request.signal)
    const data = JSON.parse(new TextDecoder().decode(bytes))
    if (!Array.isArray(data.forecasts)) { throw new Error("预报格点数据无效") }
    nativeForecasts.value = data.forecasts
  } catch (err) { if (!request.signal.aborted) { error.value = err instanceof Error ? err.message : "预报格点读取失败" } } finally { nativeLoading.value = false }
}
function downloadNative() {
  if (!nativeFrame.value) { return }
  const url = URL.createObjectURL(new Blob([JSON.stringify(nativeFrame.value, null, 2)], { type: "application/json" }))
  const a = document.createElement("a"); a.href = url; a.download = `${nativeFrame.value.sourceFile}-${nativeFrame.value.stepHour}h.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
onBeforeUnmount(() => { disposed = true; controller.abort(); if (loading.value) { emit("loading", false) } })
</script>

<style scoped>
.local-sources { display: grid; gap: 10px; color: var(--thematic-ink); min-width: 0; font-size: 13px; }
label { display: grid; gap: 6px; min-width: 0; }select, input { box-sizing: border-box; width: 100%; min-width: 0; min-height: 36px; padding: 6px 10px; color: var(--thematic-ink); background: var(--thematic-control); border: 1px solid var(--thematic-line); color-scheme: var(--thematic-scheme); }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 6px 10px; border: 1px solid var(--thematic-primary); color: #fff; background: var(--thematic-primary); cursor: pointer; }
button:disabled { color: var(--thematic-disabled-ink); background: var(--thematic-disabled-bg); border-color: var(--thematic-line); cursor: not-allowed; }
table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }th, td { padding: 5px 4px; text-align: right; border-bottom: 1px solid var(--thematic-line); }.pages { display: flex; gap: 8px; align-items: center; margin-top: 8px; }.pages button { min-width: 36px; }
.extent { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }.notice, [role="alert"] { color: var(--thematic-warning); }p { margin: 0; overflow-wrap: anywhere; line-height: 1.6; }dl { display: grid; grid-template-columns: 42px minmax(0,1fr); gap: 6px; margin: 0; }dd { margin: 0; overflow-wrap: anywhere; }summary { cursor: pointer; color: var(--thematic-ink); }details p { margin-top: 8px; }
</style>
