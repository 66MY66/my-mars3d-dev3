<template>
  <details class="analysis-tools" aria-label="业务图层分析与联动">
    <summary>业务分析</summary>
    <label>输入图层<select v-model="sourceId" aria-label="分析输入图层" :disabled="busy || working"><option value="">请选择地图图层</option><option v-for="layer in vectorLayers" :key="layer.id" :value="layer.id">{{ layer.name }}</option></select></label>
    <label>工具<select v-model="kind" aria-label="业务分析工具" :disabled="busy || working"><option value="">请选择工具</option><optgroup label="观测点计算"><option value="thermal-infrared">LST 时间基线偏差</option><option value="insar-deformation">LOS 位移与相干性筛选</option><option value="instrumental-intensity">仪器烈度初判（PGA / PGV）</option></optgroup><optgroup label="指标计算"><option value="risk-overlay">风险指数叠加</option><option value="anomaly-composite">异常指标综合</option></optgroup><optgroup label="空间分析"><option value="contour">等值线生成</option></optgroup><optgroup label="查看与联动"><option value="point-heat">点热力预览</option><option value="chart-linkage">图表联动</option><option value="trajectory">轨迹回放</option><option value="flow-direction">流向表达</option><option value="time-compare">两期数值对比</option></optgroup></select></label>
    <template v-if="source && kind">
      <TemplateDataRenderer :key="`${sourceId}:${kind}`" ref="renderer" :kind="kind" :palette="kind === 'point-heat' ? 'heat' : 'sequential-blue'" :scope-key="scopeKey" :backend-sources="sources" :busy="busy || working" workflow-key="tool-preview" @change="clearPreview" />
      <div class="actions"><button type="button" :disabled="busy || working || !renderer?.ready" @click="run"><mars-icon icon="play" :width="16" />{{ working ? '正在执行' : '执行并查看' }}</button><button type="button" :disabled="!result || working" @click="clearPreview"><mars-icon icon="delete" :width="16" />清除预览</button><button v-if="result && !result.scene.heat" type="button" :disabled="busy || working" @click="emit('add', source!, result!); clearPreview()"><mars-icon icon="plus" :width="16" />加入地图图层</button></div>
      <p v-if="result?.scene.heat">热力为核平滑显示预览，不作为人口密度、灾损数量或正式分析栅格入图。</p>
      <p v-if="result" role="status">{{ result.scene.note || `${result.scene.rows.length} 个要素` }}</p>
      <ul v-if="result"><li v-for="row in result.scene.legend" :key="row.label"><CartographyLegendSwatch :row="row" />{{ row.label }}</li></ul>
    </template>
    <p v-else-if="!vectorLayers.length">请先加载可读取要素属性的业务图层。栅格生产与分区统计在数据维护中按后端能力执行。</p>
    <p v-if="error" role="alert">{{ error }}</p>
  </details>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import type { DbtLayer } from "./dbt116-standard"
import type { BusinessMapResult } from "./business-map-data"
import { layerStyleDocument } from "./layer-style-options"
import { inspectJsonContent, prepareContentDocument, recommendExpression } from "./content-routing"
import TemplateDataRenderer from "./TemplateDataRenderer.vue"
import CartographyLegendSwatch from "./CartographyLegendSwatch.vue"
import * as mapWork from "./map"
const props = defineProps<{ layers: DbtLayer[]; scopeKey: string; busy: boolean }>()
const emit = defineEmits<{ add: [source: DbtLayer, result: BusinessMapResult]; busy: [value: boolean] }>()
const sourceId = ref(""); const kind = ref(""); const error = ref(""); const working = ref(false)
const result = shallowRef<BusinessMapResult | null>(null); const renderer = ref<InstanceType<typeof TemplateDataRenderer>>()
const vectorLayers = computed(() => props.layers.filter(layer => layer.onlineSource && layer.enabled !== false && (layer.opacity ?? 1) > 0 && !layer.raster && layer.data.features.length && !layer.id.startsWith("online:derived:")))
const source = computed(() => vectorLayers.value.find(layer => layer.id === sourceId.value))
const sources = computed(() => {
  if (!source.value) { return [] }
  let document = layerStyleDocument(source.value)
  const recommendation = recommendExpression(inspectJsonContent(document), kind.value)
  if (recommendation) { document = prepareContentDocument(document, recommendation, source.value.onlineSource!.fingerprint, kind.value) }
  return [{ id: source.value.id, name: source.value.name, document }]
})
let request: AbortController | undefined
let ownsPreview = false
let previewIsHeat = false
function clearPreview() { request?.abort(); result.value = null; if (ownsPreview) { mapWork.clearWorkflowLayers("tool-preview"); if (previewIsHeat) { mapWork.clearRasterResult() }; ownsPreview = false } }
async function run() {
  if (working.value || props.busy) { return }
  clearPreview(); const controller = new AbortController(); request = controller; ownsPreview = true; previewIsHeat = kind.value === "point-heat"; working.value = true; emit("busy", true); error.value = ""
  try { const value = await renderer.value?.render(controller.signal); controller.signal.throwIfAborted(); if (value) { result.value = value } } catch (err) { if (!controller.signal.aborted) { error.value = err instanceof Error ? err.message : "分析未完成" } } finally { working.value = false; emit("busy", false) }
}
watch([sourceId, kind, () => props.scopeKey], clearPreview)
onBeforeUnmount(clearPreview)
defineExpose({ clearPreview })
</script>
<style scoped>
.analysis-tools { border-block: 1px solid var(--thematic-line); padding: 12px 0; margin: 12px 0; color: var(--thematic-ink); }
summary { cursor: pointer; font-weight: 600; }
label { display: grid; gap: 5px; margin: 10px 0; font-size: 13px; }
select { width: 100%; min-width: 0; height: 36px; color: var(--thematic-ink); background: var(--thematic-control); border: 1px solid var(--thematic-line); color-scheme: var(--thematic-scheme); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
button { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; background: var(--thematic-surface); border: 1px solid var(--thematic-line); color: var(--thematic-ink); padding: 6px 10px; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .65; }
p { font-size: 12px; overflow-wrap: anywhere; color: var(--thematic-muted); }
[role=alert] { color: var(--thematic-warning); }
ul { list-style: none; padding: 0; } li { display: flex; align-items: center; gap: 8px; font-size: 12px; }
</style>
