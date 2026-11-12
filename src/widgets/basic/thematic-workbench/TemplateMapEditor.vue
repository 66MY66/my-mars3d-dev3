<template>
  <section ref="root" class="template-map-editor" aria-label="模板地图应用">
    <h4 v-if="backendSources !== undefined">业务数据准备</h4>
    <div class="actions">
      <button v-if="backendSources !== undefined" type="button" :disabled="busy || !scopeKey" @click="emit('choose-data')"><mars-icon icon="folder-open" :width="16" />选择后端业务资料</button>
      <button type="button" :disabled="busy" @click="emit('select-range')"><mars-icon icon="rectangle-one" :width="16" />{{ scopeKey ? '重新框选范围' : '框选地图范围' }}</button>
      <button type="button" class="primary" :disabled="busy || !dataRenderer?.ready" @click="apply(backendSources === undefined)"><mars-icon icon="play" :width="16" />{{ busy ? '正在应用' : '应用模板并渲染' }}</button>
      <button v-if="backendSources === undefined" type="button" :disabled="busy || !scopeKey" @click="applyLayout"><mars-icon icon="layout-two" :width="16" />仅底图校样</button>
      <label class="live-toggle"><input v-model="live" type="checkbox" aria-label="实时渲染" />实时渲染</label>
    </div>
    <p v-if="busy" class="feedback" role="status">{{ loadingStage || '正在应用模板' }}</p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
    <p class="status">{{ scopeKey ? scopeLabel : '尚未框选地图范围' }}</p>
    <TemplateDataRenderer :key="kind" ref="dataRenderer" :kind="kind" :palette="palette" :scope-key="scopeKey" :busy="busy" :observations="observations" :backend-sources="backendSources" @change="parametersChanged" @stage="loadingStage = $event" />
    <div v-if="preview" class="result">
      <div class="actions"><strong>{{ snapshot ? '业务数据渲染结果' : '底图校样 · 无业务统计' }}</strong><button type="button" :disabled="busy || dirty" @click="emit('layout')"><mars-icon icon="layout-two" :width="16" />制图排版</button><button v-if="snapshot" type="button" @click="downloadSnapshot"><mars-icon icon="download" :width="16" />本次数据记录</button></div>
      <p v-if="snapshot" class="status">{{ backendSources?.find(source => source.id === snapshot?.document.metadata.onlineLayerId)?.name || snapshot.scene.kind }} · {{ snapshot.scene.rows.length }} 个绘制要素 · {{ snapshot.scene.unit }}<br />{{ snapshot.scene.note }}</p>
      <img :src="preview" alt="当前框选范围的实际地图渲染结果" />
      <ul><li v-for="entry in legend" :key="entry.label"><i :style="{ background: entry.color }"></i>{{ entry.label }}</li></ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from "vue"
import * as mapWork from "./map"
import { cartographySettings, cartographyContext } from "./cartography-state"
import type { LegendEntry } from "./display-model"
import TemplateDataRenderer from "./TemplateDataRenderer.vue"
import type { EarthquakeDataset } from "./earthquake-analysis"
import type { BusinessMapResult, MapDataSource } from "./business-map-data"

const props = defineProps<{ kind: string; palette: string; title: string; legendTitle: string; scopeKey: string; scopeLabel: string; observations?: EarthquakeDataset | null; backendSources?: MapDataSource[] }>()
const emit = defineEmits<{(event: "select-range"): void; (event: "choose-data"): void; (event: "applied", blob: Blob, openLayout: boolean, rendered: boolean, snapshot?: BusinessMapResult): void; (event: "layout"): void; (event: "invalidate"): void }>()
const dataRenderer = ref<InstanceType<typeof TemplateDataRenderer>>()
const root = ref<HTMLElement>()
const busy = ref(false); const error = ref(""); const preview = ref(""); const dirty = ref(false); const live = ref(true); const loadingStage = ref("")
const snapshot = shallowRef<BusinessMapResult | null>(null)
const legend = ref<LegendEntry[]>([])
let requestController: AbortController | null = null
let disposed = false; let parameterRevision = 0; let hasApplied = false; let pendingLive = false
let liveTimer: ReturnType<typeof setTimeout> | undefined
function clearPreview() { if (preview.value) { URL.revokeObjectURL(preview.value) }; preview.value = ""; legend.value = []; snapshot.value = null }
async function apply(openLayout = false) {
  if (busy.value) { return }
  clearTimeout(liveTimer); pendingLive = false; error.value = ""
  if (!mapWork.getLockedSelection() || !props.scopeKey) { error.value = "请先框选并确认地图范围"; return }
  if (!dataRenderer.value?.ready) { dataRenderer.value?.refreshSources(); focusFields(); return }
  const scope = props.scopeKey; const revision = parameterRevision
  const controller = new AbortController(); requestController = controller; busy.value = true
  try {
    loadingStage.value = "正在读取业务图层"
    const result = await dataRenderer.value?.render(controller.signal)
    if (!result) { throw new Error("模板数据面板尚未就绪") }
    controller.signal.throwIfAborted()
    if (disposed || scope !== props.scopeKey || revision !== parameterRevision) { return }
    mapWork.clearCartographySymbols()
    Object.assign(cartographySettings, { title: props.title, legendTitle: result.scene.unit || props.legendTitle, source: result.scene.source, time: result.document.metadata.observedAt || "数据时点未提供" })
    cartographyContext.value = { ...cartographyContext.value, legend: result.scene.legend, metrics: mapWork.getMapAdornmentMetrics() }
    loadingStage.value = "正在生成实际地图预览"
    const blob = await mapWork.captureSelectionImage({ targetWidth: 1600, fitAspect: true, frameWidth: 0, mime: "image/png" })
    controller.signal.throwIfAborted()
    if (disposed || scope !== props.scopeKey || revision !== parameterRevision) { return }
    if (!blob?.size) { throw new Error("地图截图失败，请重试") }
    clearPreview(); preview.value = URL.createObjectURL(blob); snapshot.value = result; legend.value = result.scene.legend; dirty.value = false; hasApplied = true
    emit("applied", blob, openLayout, true, result)
  } catch (err) {
    if (!disposed && scope === props.scopeKey && revision === parameterRevision) {
      error.value = err instanceof Error ? err.message : "模板应用失败"
      clearPreview(); mapWork.clearRasterResult(); emit("invalidate")
    }
  } finally {
    busy.value = false; loadingStage.value = ""; if (requestController === controller) { requestController = null }
    if (pendingLive) { pendingLive = false; scheduleLive() }
  }
}
async function applyLayout() {
  if (busy.value) { return }
  clearTimeout(liveTimer); pendingLive = false; error.value = ""
  if (!mapWork.getLockedSelection() || !props.scopeKey) { error.value = "请先框选并确认地图范围"; return }
  const scope = props.scopeKey; const revision = parameterRevision
  busy.value = true
  try {
    mapWork.clearRasterResult(); mapWork.clearCartographySymbols()
    const blob = await mapWork.captureSelectionImage({ targetWidth: 1600, fitAspect: true, frameWidth: 0, mime: "image/png" })
    if (disposed || scope !== props.scopeKey || revision !== parameterRevision) { return }
    if (!blob?.size) { throw new Error("框选地图截图失败") }
    Object.assign(cartographySettings, { title: props.title, source: "当前地图画面 · 仅底图校样", time: new Date().toISOString() })
    cartographyContext.value = { ...cartographyContext.value, legend: [], metrics: mapWork.getMapAdornmentMetrics() }
    clearPreview(); preview.value = URL.createObjectURL(blob); dirty.value = false; hasApplied = false
    emit("applied", blob, true, false)
  } catch (err) { error.value = err instanceof Error ? err.message : "底图校样失败" } finally { busy.value = false }
}
function downloadSnapshot() {
  if (!snapshot.value) { return }
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot.value, null, 2)], { type: "application/json" }))
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = props.kind + "-" + snapshot.value.fingerprint.slice(0, 12) + ".json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function scheduleLive() {
  clearTimeout(liveTimer)
  if (!live.value || !hasApplied || !props.scopeKey || disposed) { return }
  liveTimer = setTimeout(() => { if (busy.value) { pendingLive = true; return }; if (dataRenderer.value?.ready) { apply(false) } }, 250)
}
function parametersChanged() { dirty.value = true; parameterRevision++; requestController?.abort(); clearPreview(); mapWork.clearRasterResult(); emit("invalidate"); scheduleLive() }
function resetResult() { clearTimeout(liveTimer); pendingLive = false; hasApplied = false; dirty.value = true; parameterRevision++; requestController?.abort(); clearPreview(); mapWork.clearRasterResult() }
function focusFields() { const control = root.value?.querySelector<HTMLElement>('[aria-label="专题模板数值字段"], [aria-label^="专题字段映射"]') || root.value?.querySelector<HTMLElement>('[aria-label="制图业务图层"]'); const details = control?.closest("details"); if (details) { details.open = true }; control?.focus({ preventScroll: true }); control?.scrollIntoView?.({ block: "center", behavior: "smooth" }) }
watch([() => props.scopeKey, () => props.kind, () => props.palette], parametersChanged)
watch([() => props.title, () => props.legendTitle], () => { cartographySettings.title = props.title; cartographySettings.legendTitle = props.legendTitle })
watch(live, scheduleLive)
onBeforeUnmount(() => { disposed = true; resetResult() })
defineExpose({ getDocument: () => snapshot.value?.document || null, isRendering: () => busy.value || pendingLive, resetResult, focusFields, applyRecommended: () => apply(false) })
</script>

<style scoped>
.template-map-editor { margin-bottom: 16px; padding: 12px; border-bottom: 1px solid var(--thematic-line); background: var(--thematic-subtle); color: var(--thematic-ink); }
h4 { margin: 0 0 12px; font-size: 14px; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 5px 10px; background: var(--thematic-surface); border: 1px solid var(--thematic-line); color: var(--thematic-ink); cursor: pointer; }
button.primary { color: #ffffff; background: var(--thematic-primary); border-color: var(--thematic-primary); }
button:disabled { opacity: 1; color: var(--thematic-disabled-ink); background: var(--thematic-disabled-bg); cursor: not-allowed; }
.live-toggle { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--thematic-muted); white-space: nowrap; }
.live-toggle input { accent-color: var(--thematic-accent); }
.status { margin: 10px 0; font-size: 12px; color: var(--thematic-muted); overflow-wrap: anywhere; }
.error, .feedback { padding: 8px 10px; border-left: 3px solid currentColor; font-size: 13px; margin: 10px 0; overflow-wrap: anywhere; }
.error { color: var(--thematic-warning); background: var(--thematic-warning-bg); }
.feedback { color: var(--thematic-success); background: var(--thematic-success-bg); }
.result { margin-top: 12px; }
.result img { display: block; width: 100%; max-height: 260px; object-fit: contain; margin-top: 8px; }
.result ul { display: flex; gap: 8px 16px; flex-wrap: wrap; padding: 8px 0 0; list-style: none; }
.result li { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.result i { width: 16px; height: 10px; flex-shrink: 0; }
</style>
