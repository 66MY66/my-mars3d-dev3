<template>
  <section class="template-map-editor" aria-label="模板地图应用">
    <div class="template-map-actions">
      <button type="button" :disabled="busy" @click="emit('select-range')"><mars-icon icon="rectangle-one" :width="16" />{{ scopeKey ? '重新框选范围' : '框选地图范围' }}</button>
      <button type="button" class="primary" :disabled="busy || !scopeKey" @click="apply(true)"><mars-icon icon="play" :width="16" />{{ busy ? '正在应用' : '应用模板' }}</button>
      <button type="button" :disabled="busy || !scopeKey" @click="applyLayout"><mars-icon icon="layout-two" :width="16" />仅套用版式</button>
      <label class="live-toggle"><input v-model="live" type="checkbox" aria-label="实时渲染" />实时渲染</label>
    </div>
    <p v-if="busy" class="template-map-feedback" role="status" aria-live="polite"><mars-icon icon="loading" :width="16" />{{ loadingStage || '正在应用模板' }}</p>
    <p v-else-if="error" class="template-map-error" role="alert">{{ error }}</p>
    <p v-else-if="preview && !dirty" class="template-map-feedback" :class="{ 'is-layout-only': layoutPreview }" role="status">{{ layoutPreview ? '仅版式已套用，尚未执行模板渲染' : '模板已渲染，地图与排版已同步' }}</p>
    <div class="template-map-status" role="status">{{ scopeKey ? scopeLabel : '尚未框选地图范围' }}</div>
    <div class="template-map-actions sample-actions">
      <button type="button" :disabled="busy || sampleLoading" @click="loadSample"><mars-icon icon="folder-open" :width="16" />{{ sampleLoading ? '正在加载' : '加载测试数据' }}</button>
      <a :href="templateSampleUrl(kind)" :download="`${kind}.geojson`" @click.prevent="downloadSample"><mars-icon icon="download" :width="16" />下载测试数据</a>
      <label class="live-toggle"><input v-model="fitSample" type="checkbox" aria-label="测试数据适配框选范围" :disabled="busy || sampleLoading" />适配框选范围</label>
    </div>
    <p v-if="sampleLoaded" class="template-map-status" role="status">合成测试，非业务数据。{{ fitSample ? scopeKey ? '生成范围：当前框选区域' : '生成范围：待框选' : '原始范围：东经104.8–106.6°、北纬28.2–29.7°' }}</p>
    <div v-if="polygonTemplate" class="template-map-status" role="status">数据：{{ sourceMode === 'auto' ? `自动行政区边界 · ${kind === 'unique-value' ? '行政区代码' : '面积（km²）'}` : sourceMode === 'current' ? '当前分区结果' : filename || '待导入业务指标' }}{{ loadingStage ? ` · ${loadingStage}` : '' }}</div>
    <details ref="dataOptions" class="template-data-options" :open="!polygonTemplate && !rasterTemplate">
      <summary>渲染数据 <span>{{ polygonTemplate ? '分区数值' : rasterTemplate ? 'RGB 亮度' : '业务数据' }}</span></summary>
      <template v-if="polygonTemplate">
      <label class="template-source-field">数据源<select v-model="sourceMode" aria-label="模板数据源" :disabled="busy"><option value="auto">自动加载行政区边界</option><option value="current">当前范围分区结果</option><option value="file">导入业务指标 GeoJSON</option><option v-if="sampleDocument" value="sample">合成测试数据</option></select></label>
      <div class="template-map-actions"><button type="button" :disabled="busy" @click="fileInput?.click()"><mars-icon icon="upload" :width="16" />导入分区 GeoJSON</button><span>{{ filename || '未导入分区数据' }}</span></div>
      <input ref="fileInput" type="file" accept=".geojson,.json" aria-label="模板分区数据文件" hidden @change="importFile" />
      <div class="template-map-fields">
        <label v-if="sourceMode === 'file' || sourceMode === 'sample'">数值字段<select v-model="field" :disabled="!document || busy" aria-label="模板数值字段"><option v-for="name in document?.fields || []" :key="name">{{ name }}</option></select></label>
        <label v-else>数值字段<input readonly :value="sourceMode === 'auto' ? kind === 'unique-value' ? '行政区代码' : '行政区面积（km²）' : '当前分区数值'" /></label>
        <label v-if="kind !== 'unique-value'">分级方法<select v-model="method" :disabled="busy" aria-label="模板分级方法"><option value="natural">自然断点</option><option value="equal">等距</option><option value="quantile">分位数</option></select></label>
        <label v-if="kind !== 'unique-value'">分级数量<input v-model.number="count" :disabled="busy" type="number" min="2" max="9" aria-label="模板分级数量" /></label>
      </div>
      <button type="button" :disabled="busy || !scopeKey" @click="apply(false)"><mars-icon icon="play" :width="16" />应用到地图</button>
      </template>
      <label v-if="rasterTemplate" class="template-source-field">栅格数据源<select v-model="importedRaster" aria-label="栅格模板数据源" :disabled="busy"><option :value="false">框选底图 RGB 亮度</option><option :value="true">导入规则网格 GeoJSON</option></select></label>
      <p v-if="rasterTemplate && !importedRaster" class="template-map-status">数据源：当前范围的 RGB 像元亮度（0–255），非温度、高程或风险值。</p>
      <TemplateDataRenderer v-if="!polygonTemplate && (!rasterTemplate || importedRaster)" :key="kind" ref="dataRenderer" :kind="kind" :palette="palette" :scope-key="scopeKey" :busy="busy" :fit-sample="fitSample" :observations="observations" @change="parametersChanged" @stage="loadingStage = $event" />
    </details>
    <p v-if="layoutPreview && preview" class="template-map-status" role="status">{{ layoutName }}版式已应用；当前主图保留已有地图内容，未生成新的业务分析数据。</p>
    <div v-if="preview" class="template-map-result">
      <div class="template-map-result-head"><strong>{{ dirty ? '上次应用结果 · 参数已修改' : layoutPreview ? '版式底图 · 未执行模板渲染' : '模板渲染结果' }}</strong><button type="button" :disabled="busy || dirty" @click="emit('layout')"><mars-icon icon="layout-two" :width="16" />制图排版</button></div>
      <img :src="preview" alt="模板应用后的地图实际截图" />
      <ul><li v-for="entry in legend" :key="entry.label"><i :style="{ background: entry.color }"></i>{{ entry.label }}</li></ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import * as mapWork from "./map"
import { readPolygonDocument } from "./polygon-source"
import { classifyTemplatePolygons, recolorTemplatePolygons, colorTemplatePixels } from "./template-map"
import { cartographySettings, cartographyContext } from "./cartography-state"
import type { RenderStyle } from "./render-style"
import type { LegendEntry } from "./display-model"
import { templateLayoutProfiles } from "./composition-layout"
import { loadTemplateAdministrativeSource, ADMIN_AREA_FIELD, ADMIN_CODE_FIELD } from "./template-admin-source"
import TemplateDataRenderer from "./TemplateDataRenderer.vue"
import type { EarthquakeDataset } from "./earthquake-analysis"
import { fitTemplateSampleToBounds, loadTemplateSample, templateSampleUrl } from "./catalog-template-samples"
import type { TemplateDocument } from "./template-renderer"

const props = defineProps<{ kind: string; palette: string; title: string; legendTitle: string; scopeKey: string; scopeLabel: string; observations?: EarthquakeDataset | null }>()
const emit = defineEmits<{(event: "select-range"): void; (event: "applied", blob: Blob, openLayout: boolean, rendered: boolean): void; (event: "layout"): void; (event: "invalidate"): void }>()
const polygonTemplate = computed(() => ["choropleth", "unique-value"].includes(props.kind))
const rasterTemplate = computed(() => ["raster-ramp", "raster-threshold"].includes(props.kind))
const importedRaster = ref(false)
const dataTemplate = computed(() => !polygonTemplate.value && (!rasterTemplate.value || importedRaster.value))
const sampleLoading = ref(false); const fitSample = ref(true)
const sampleDocument = shallowRef<TemplateDocument | null>(null)
const sampleLoaded = computed(() => polygonTemplate.value ? sourceMode.value === "sample" : !!dataRenderer.value?.sampleActive)
const layoutName = computed(() => templateLayoutProfiles[props.kind]?.name || "专题图")
const dataOptions = ref<HTMLDetailsElement>()
const layoutPreview = ref(false)
const fileInput = ref<HTMLInputElement>()
const document = shallowRef<ReturnType<typeof readPolygonDocument> | null>(null)
let automaticDocument: TemplateDocument | null = null
const initialSource = mapWork.getDisplaySource()
const sourceMode = ref<"auto" | "file" | "current" | "sample">(props.scopeKey && initialSource?.kind === "polygons" && JSON.stringify(initialSource.rectangle) === JSON.stringify(mapWork.getLockedSelection()) ? "current" : "auto")
const loadingStage = ref("")
let requestController: AbortController | null = null
const filename = ref(""); const field = ref(""); const count = ref(5)
const method = ref<RenderStyle["method"]>("natural")
const busy = ref(false); const error = ref(""); const preview = ref(""); const dirty = ref(false)
const dataRenderer = ref<InstanceType<typeof TemplateDataRenderer>>()
const live = ref(true)
let hasApplied = false
let liveTimer: ReturnType<typeof setTimeout> | undefined
let pendingLive = false
const legend = ref<LegendEntry[]>([])
let disposed = false
let parameterRevision = 0
function clearPreview() { if (preview.value) { URL.revokeObjectURL(preview.value) }; preview.value = ""; legend.value = [] }
async function loadSample() {
  if (busy.value || sampleLoading.value) { return }
  const kind = props.kind
  sampleLoading.value = true; error.value = ""
  try {
    const data = structuredClone(await loadTemplateSample(kind))
    if (disposed || kind !== props.kind) { return }
    if (polygonTemplate.value) {
      sampleDocument.value = data
      document.value = readPolygonDocument(data, kind === "unique-value")
      Object.assign(document.value.document, { metadata: data.metadata })
      field.value = kind === "unique-value" ? "category" : "value"; filename.value = `${kind}.geojson`; sourceMode.value = "sample"
    } else {
      if (rasterTemplate.value) { importedRaster.value = true }
      await nextTick()
      if (disposed || kind !== props.kind) { return }
      dataRenderer.value?.importDocument(data, `${kind}.geojson（合成测试）`, true)
    }
    if (dataOptions.value) { dataOptions.value.open = true }
    parametersChanged()
  } catch (err) { error.value = err instanceof Error ? err.message : "测试数据加载失败" } finally { sampleLoading.value = false }
}
async function downloadSample() {
  if (busy.value || sampleLoading.value) { return }
  const kind = props.kind
  try {
    const sample = await loadTemplateSample(kind)
    if (disposed || kind !== props.kind) { return }
    const bounds = mapWork.getLockedSelection()
    const data = fitSample.value && bounds ? fitTemplateSampleToBounds(sample, bounds) : sample
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/geo+json" }))
    const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = `${kind}.geojson`; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) { error.value = err instanceof Error ? err.message : "测试数据下载失败" }
}
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) { return }
  try {
    if (file.size > 10 * 1024 * 1024) { throw new Error("GeoJSON 文件不能超过 10 MB") }
    const raw = JSON.parse(await file.text())
    const parsed = readPolygonDocument(raw, props.kind === "unique-value")
    Object.assign(parsed.document, { metadata: raw.metadata })
    if (disposed) { return }
    sampleDocument.value = null
    document.value = parsed; filename.value = file.name; field.value = parsed.fields[0]; sourceMode.value = "file"; error.value = ""; dirty.value = true
  } catch (err) { error.value = err instanceof Error ? err.message : "文件读取失败" }
  ;(event.target as HTMLInputElement).value = ""
}
async function apply(openLayout = false) {
  if (busy.value) { return }
  clearTimeout(liveTimer); pendingLive = false
  error.value = ""
  const bounds = mapWork.getLockedSelection()
  if (!bounds || !props.scopeKey) { error.value = "请先框选并确认地图范围"; return }
  const scope = props.scopeKey
  const revision = parameterRevision
  busy.value = true
  loadingStage.value = "正在读取模板数据"
  const controller = new AbortController()
  requestController = controller
  try {
    const current = mapWork.getDisplaySource()
    const scoped = current && JSON.stringify(current.rectangle) === JSON.stringify(bounds) ? current : null
    let rows: LegendEntry[] = []
    let sourceLabel = ""
    let renderedUnit = ""
    if (dataTemplate.value) {
      const result = await dataRenderer.value?.render(controller.signal)
      if (!result) { throw new Error("模板数据面板尚未就绪") }
      rows = result.legend; sourceLabel = `${result.source}${result.note ? `；${result.note}` : ""}`; renderedUnit = result.unit
    } else if (polygonTemplate.value) {
      const unique = props.kind === "unique-value"
      let result: ReturnType<typeof recolorTemplatePolygons> | null = null
      let unit = field.value
      if (sourceMode.value === "auto") {
        loadingStage.value = "正在加载真实行政区边界"
        const automatic = await loadTemplateAdministrativeSource(bounds, controller.signal)
        if (disposed || scope !== props.scopeKey || revision !== parameterRevision) { return }
        unit = unique ? ADMIN_CODE_FIELD : ADMIN_AREA_FIELD
        result = classifyTemplatePolygons(automatic.document, unit, bounds, props.palette, method.value, count.value, unique)
        sourceLabel = automatic.source
        automaticDocument = { ...automatic.document, metadata: { source: automatic.source, unit: "行政区面积（km²）" } }
      } else if (sourceMode.value === "sample" && sampleDocument.value && field.value) {
        const sample = fitSample.value ? fitTemplateSampleToBounds(sampleDocument.value, bounds) : sampleDocument.value
        result = classifyTemplatePolygons(readPolygonDocument(sample, unique).document, field.value, bounds, props.palette, method.value, count.value, unique)
        sourceLabel = sample.metadata.source; unit = sample.metadata.unit || unit
      } else if (sourceMode.value === "file" && document.value && field.value) {
        result = classifyTemplatePolygons(document.value.document, field.value, bounds, props.palette, method.value, count.value, unique)
        const metadata = (document.value.document as any).metadata
        sourceLabel = metadata?.source || `本地文件：${filename.value}`
        unit = metadata?.unit || unit
      } else if (sourceMode.value === "current" && scoped?.kind === "polygons" && scoped.polygons?.length) {
        if (!unique && scoped.polygons.some(item => item.category !== undefined)) { throw new Error("当前结果为文字类别，请导入数值字段或选择自动行政区面积") }
        result = recolorTemplatePolygons(scoped.polygons, props.palette, method.value, count.value, unique)
        sourceLabel = scoped.source; unit = scoped.unit
      }
      if (!result) {
        if (dataOptions.value) { dataOptions.value.open = true }
        throw new Error("请导入包含数值字段的分区 GeoJSON，或加载当前范围的分区数据。仅套用版式不会生成分区图案。")
      }
      loadingStage.value = "正在分级着色"
      renderedUnit = unit
      if (unit === ADMIN_AREA_FIELD && !unique) { result.legend = result.legend.map(entry => ({ ...entry, label: `${entry.label} km²` })) }
      await mapWork.renderTemplatePolygons(result.polygons, result.legend, unit, filename.value, sourceLabel)
      rows = result.legend
      sourceLabel = mapWork.getDisplaySource()!.source
    } else {
      const input = scoped?.kind === "raster" ? scoped.templateInput || scoped.image : await mapWork.captureTemplateBaseImage()
      if (!input) { throw new Error("当前范围截图不可用") }
      const bitmap = await createImageBitmap(typeof input === "string" ? await (await fetch(input)).blob() : input)
      let image = ""; let original = ""
      const canvas = window.document.createElement("canvas")
      try {
        canvas.width = Math.min(1280, bitmap.width); canvas.height = Math.max(1, Math.round(bitmap.height * canvas.width / bitmap.width))
        const context = canvas.getContext("2d", { willReadFrequently: true })!
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        original = canvas.toDataURL("image/png")
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
        const result = colorTemplatePixels(pixels.data, props.palette, props.kind === "raster-threshold", count.value)
        pixels.data.set(result.data); context.putImageData(pixels, 0, 0)
        image = canvas.toDataURL("image/png"); rows = result.legend
      } finally { bitmap.close() }
      if (disposed || scope !== props.scopeKey || revision !== parameterRevision) { throw new Error("范围或参数已修改，请重新应用模板") }
      sourceLabel = "框选截图 RGB 亮度配色（非物理观测量）"
      if (!mapWork.renderRasterResult(image, bounds, 1, { input: original, name: props.title, source: sourceLabel, legend: rows, canvas })) { throw new Error("栅格模板图层未能加载") }
      await mapWork.waitForTemplateRaster()
    }
    await mapWork.afterDisplayRender()
    if (disposed || props.scopeKey !== scope) { return }
    if (revision !== parameterRevision) { throw new Error("参数已修改，请重新应用到地图") }
    let legendTitle = props.legendTitle
    if (dataTemplate.value) { legendTitle = renderedUnit }
    if (rasterTemplate.value && !importedRaster.value) { legendTitle = "RGB 亮度 / 图例" }
    if (renderedUnit === ADMIN_AREA_FIELD) { legendTitle = "行政区面积（km²）" }
    if (renderedUnit === ADMIN_CODE_FIELD) { legendTitle = "行政区代码" }
    Object.assign(cartographySettings, { title: props.title, legendTitle, source: sourceLabel, time: new Date().toISOString() })
    cartographyContext.value = { ...cartographyContext.value, legend: rows, metrics: mapWork.getMapAdornmentMetrics() }
    loadingStage.value = "正在生成地图预览"
    const blob = await mapWork.captureSelectionImage({ targetWidth: 1280, fitAspect: true, frameWidth: 0, mime: "image/png" })
    if (disposed || props.scopeKey !== scope) { return }
    if (revision !== parameterRevision) { throw new Error("参数已修改，请重新应用到地图") }
    if (!blob?.size) { throw new Error("地图已应用，但实际截图失败，请重试应用") }
    clearPreview(); preview.value = URL.createObjectURL(blob); legend.value = rows; dirty.value = false; layoutPreview.value = false; hasApplied = true
    emit("applied", blob, openLayout, true)
  } catch (err) { if (!disposed && scope === props.scopeKey && revision === parameterRevision) { error.value = err instanceof Error ? err.message : "模板应用失败" } } finally {
    busy.value = false; loadingStage.value = ""; if (requestController === controller) { requestController = null }
    if (pendingLive) { pendingLive = false; scheduleLive() }
  }
}
async function applyLayout() {
  if (busy.value) { return }
  error.value = ""
  const bounds = mapWork.getLockedSelection()
  if (!bounds || !props.scopeKey) { error.value = "请先框选并确认地图范围"; return }
  const scope = props.scopeKey
  const revision = parameterRevision
  busy.value = true
  try {
    const current = mapWork.getDisplaySource()
    const scopedSource = current && JSON.stringify(current.rectangle) === JSON.stringify(bounds) ? current : null
    const rows = scopedSource?.legend || []
    const blob = await mapWork.captureSelectionImage({ targetWidth: 1280, fitAspect: true, frameWidth: 0, mime: "image/png" })
    if (disposed || scope !== props.scopeKey) { return }
    if (revision !== parameterRevision) { throw new Error("参数已修改，请重新套用版式") }
    if (!blob?.size) { throw new Error("框选地图截图失败，请稍后重试") }
    Object.assign(cartographySettings, { title: props.title, legendTitle: rows.length ? props.legendTitle : "图例", source: scopedSource?.source || "当前框选地图截图", time: new Date().toISOString() })
    cartographyContext.value = { ...cartographyContext.value, legend: rows, metrics: mapWork.getMapAdornmentMetrics() }
    clearPreview(); preview.value = URL.createObjectURL(blob); legend.value = rows; dirty.value = false; layoutPreview.value = true; hasApplied = false
    emit("applied", blob, true, false)
  } catch (err) { error.value = err instanceof Error ? err.message : "套用版式失败" } finally { busy.value = false }
}
function scheduleLive() {
  clearTimeout(liveTimer)
  if (!live.value || !hasApplied || !props.scopeKey || disposed) { return }
  liveTimer = setTimeout(() => {
    if (busy.value) { pendingLive = true; return }
    if (dataTemplate.value && !dataRenderer.value?.ready) { return }
    apply(false)
  }, 250)
}
function parametersChanged() { dirty.value = true; parameterRevision++; emit("invalidate"); scheduleLive() }
watch(() => props.scopeKey, () => { automaticDocument = null; requestController?.abort(); clearPreview(); emit("invalidate"); parameterRevision++; scheduleLive() })
watch(() => props.kind, () => { requestController?.abort(); error.value = ""; sampleDocument.value = null; if (sourceMode.value === "sample") { sourceMode.value = "auto" }; importedRaster.value = false; clearPreview() })
watch([() => props.kind, () => props.palette, () => props.title, () => props.legendTitle, sourceMode, field, method, count, importedRaster, fitSample], parametersChanged)
watch(live, scheduleLive)
onBeforeUnmount(() => { disposed = true; clearTimeout(liveTimer); requestController?.abort(); clearPreview() })
function getDocument() {
  if (dataTemplate.value) { return dataRenderer.value?.getDocument() || null }
  if (!polygonTemplate.value) { return null }
  const bounds = mapWork.getLockedSelection()
  if (sourceMode.value === "sample" && sampleDocument.value) { return fitSample.value && bounds ? fitTemplateSampleToBounds(sampleDocument.value, bounds) : sampleDocument.value }
  if (sourceMode.value === "file") { return document.value?.document || null }
  return sourceMode.value === "auto" ? automaticDocument : null
}
defineExpose({ getDocument, isRendering: () => busy.value || pendingLive || (live.value && hasApplied && dirty.value && !error.value) })
</script>

<style scoped>
.template-map-editor { margin-bottom: 16px; padding: 12px; border-bottom: 1px solid #41556c; background: #1d2e40; color: #e8f1fa; }
.template-map-actions, .template-map-result-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.template-map-actions span { min-width: 0; overflow-wrap: anywhere; color: #b7c9da; font-size: 12px; }
.template-map-editor button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 5px 10px; background: #263e53; border: 1px solid #56768f; color: #e8f1fa; cursor: pointer; }
.template-map-editor button.primary { background: #1678c9; border-color: #3e9de9; }
.template-map-editor button:disabled { opacity: .5; cursor: not-allowed; }
.sample-actions { margin: 10px 0; }
.sample-actions a { display: inline-flex; align-items: center; gap: 6px; color: #90d4ef; padding: 6px; white-space: nowrap; }
.live-toggle { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #b7c9da; white-space: nowrap; }
.live-toggle input { accent-color: #35b4d3; }
.template-map-status { margin: 8px 0; font-size: 12px; color: #a9c2d6; overflow-wrap: anywhere; }
.template-map-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(125px, 1fr)); gap: 10px; margin-top: 10px; }
.template-data-options { border-top: 1px solid #41556c; padding-top: 10px; }
.template-data-options summary { cursor: pointer; margin-bottom: 10px; }
.template-data-options summary span { margin-left: 6px; color: #a9c2d6; font-size: 12px; }
.template-data-options > button { margin-top: 10px; }
.template-map-fields label { display: grid; gap: 5px; min-width: 0; }
.template-source-field { display: grid; gap: 5px; margin: 10px 0; }
.template-source-field select { min-height: 34px; background: #203348; color: #edf5ff; border: 1px solid #56768f; color-scheme: dark; }
.template-map-fields input, .template-map-fields select { width: 100%; min-width: 0; height: 34px; background: #203348; border: 1px solid #56768f; color: #edf5ff; color-scheme: dark; }
.template-map-error, .template-map-feedback { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-left: 3px solid currentColor; font-size: 13px; margin: 10px 0; overflow-wrap: anywhere; }
.template-map-error, .template-map-feedback.is-layout-only { color: #ffd08a; background: #ffd08a10; }
.template-map-feedback { color: #75dcc3; background: #75dcc310; }
.template-map-result { margin-top: 12px; }
.template-map-result-head { justify-content: space-between; margin-bottom: 8px; }
.template-map-result img { display: block; width: 100%; max-height: 260px; object-fit: contain; }
.template-map-result ul { display: flex; gap: 8px 16px; flex-wrap: wrap; padding: 8px 0 0; list-style: none; }
.template-map-result li { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.template-map-result i { width: 16px; height: 10px; flex-shrink: 0; }
</style>
