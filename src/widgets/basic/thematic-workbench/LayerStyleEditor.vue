<template>
  <section class="layer-style-editor" aria-label="图层符号化与渲染">
    <header><strong>{{ layer.name }}</strong><button type="button" title="关闭样式设置" aria-label="关闭样式设置" :disabled="busy" @click="emit('close')"><mars-icon icon="close" :width="16" /></button></header>
    <label>表达方式<select v-model="kind" aria-label="图层表达方式" :disabled="busy"><option v-for="method in methods" :key="method.value" :value="method.value">{{ method.label }}</option></select></label>
    <template v-if="selected">
      <label>{{ kind === 'unique-value' ? '分类依据' : '业务指标' }}<select v-model="field" aria-label="图层业务指标" :disabled="busy"><option v-for="option in fields" :key="option.key" :value="option.key">{{ option.label }}</option></select></label>
      <div v-if="kind !== 'unique-value' && kind !== 'proportional-symbol'" class="pair"><label>分级方法<select v-model="method" :disabled="busy"><option value="natural">自然断点</option><option value="equal">等距</option><option value="quantile">分位数</option></select></label><label>级数<input v-model.number="count" type="number" min="2" max="9" :disabled="busy" /></label></div>
      <label v-if="kind === 'choropleth'">色带<select v-model="palette" :disabled="busy"><option value="sequential-blue">蓝色顺序色带</option><option value="terrain">多色顺序色带</option></select></label>
      <p v-if="kind !== 'unique-value'">{{ indicatorLabel }} · {{ normalization ? `${unit}/km²` : unit }}</p>
      <p v-if="normalization">按原统计区完整面积计算密度。</p>
      <details><summary>指标与单位</summary><label>单位<input v-model="unit" aria-label="图层指标单位" :disabled="busy" /></label><p>{{ field }} · {{ layer.publishedAt || '数据时点未注明' }}</p></details>
      <div class="actions"><button type="button" class="primary" :disabled="busy || !field || !unit.trim()" @click="apply"><mars-icon icon="layers" :width="16" />应用到此图层</button><button type="button" :disabled="busy" @click="emit('restore')"><mars-icon icon="refresh" :width="16" />还原默认</button></div>
    </template>
    <p v-else>当前图层没有适用的分类或数值指标，保留原始几何表达。</p>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { DbtLayer } from "./dbt116-standard"
import type { TemplateOptions } from "./template-renderer"
import { layerStyleOptions, layerStyleDocument } from "./layer-style-options"
const props = defineProps<{ layer: DbtLayer; busy: boolean }>()
const emit = defineEmits<{ close: []; restore: []; apply: [kind: string, options: TemplateOptions] }>()
const methods = computed(() => layerStyleOptions(props.layer))
const kind = ref(""); const field = ref(""); const unit = ref(""); const palette = ref("sequential-blue")
const method = ref<"natural" | "equal" | "quantile">("natural"); const count = ref(5)
const selected = computed(() => methods.value.find(entry => entry.value === kind.value))
const fields = computed(() => kind.value === "unique-value" ? selected.value?.fields.filter(entry => entry.present > 0 && entry.values.length > 1 && entry.values.length <= 24).map(entry => ({ key: entry.key, label: entry.key === "GB" ? "地理要素分类代码" : entry.key })) || [] : selected.value?.metrics.filter(entry => entry.score >= 65).map(entry => ({ key: entry.field, label: entry.label })) || [])
const metric = computed(() => selected.value?.metrics.find(entry => entry.field === field.value))
const indicatorLabel = computed(() => fields.value.find(entry => entry.key === field.value)?.label || field.value)
const normalization = computed(() => kind.value === "choropleth" && metric.value?.total ? { kind: "area-density" as const } : undefined)
watch(() => props.layer.id, () => {
  const previous = props.layer.onlineSource?.rendering?.parameters?.expression as { kind?: string; options?: TemplateOptions } | undefined
  kind.value = previous?.kind && methods.value.some(entry => entry.value === previous.kind) ? previous.kind : methods.value[0]?.value || ""
}, { immediate: true })
watch(kind, () => {
  const previous = props.layer.onlineSource?.rendering?.parameters?.expression as { kind?: string; options?: TemplateOptions } | undefined
  const options = previous?.kind === kind.value ? previous.options : undefined
  field.value = options?.field || selected.value?.recommendation.field || ""
  method.value = options?.method || "natural"; count.value = options?.count || 5; palette.value = options?.palette || "sequential-blue"
}, { immediate: true })
watch(field, () => { unit.value = kind.value === "unique-value" ? "类别" : metric.value?.unit || "原始值" }, { immediate: true })
function apply() { const metadata = layerStyleDocument(props.layer).metadata; emit("apply", kind.value, { field: field.value, unit: normalization.value ? `${unit.value}/km²` : unit.value, method: method.value, count: count.value, palette: palette.value, normalization: normalization.value, geometryFilter: selected.value?.recommendation.geometry, ...(kind.value === "unique-value" ? { categoryLabels: metadata.categoryLabels, categoryColors: metadata.categoryColors } : {}) }) }
</script>
<style scoped>
.layer-style-editor { padding: 12px 0; border-block: 1px solid var(--thematic-line); display: grid; gap: 10px; min-width: 0; scroll-margin-top: 160px; }
header, .actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
label { display: grid; gap: 5px; font-size: 13px; min-width: 0; }
select, input { min-width: 0; width: 100%; height: 36px; padding: 5px 8px; color: var(--thematic-ink); background: var(--thematic-control); border: 1px solid var(--thematic-line); color-scheme: var(--thematic-scheme); }
.pair { display: grid; grid-template-columns: 1fr 90px; gap: 10px; }
button { min-height: 36px; display: inline-flex; gap: 6px; align-items: center; padding: 6px 10px; color: var(--thematic-ink); border: 1px solid var(--thematic-line); background: var(--thematic-surface); cursor: pointer; }
.primary { background: var(--thematic-primary); color: #fff; }
button:disabled { cursor: not-allowed; opacity: .65; }
p, details { margin: 0; font-size: 12px; color: var(--thematic-muted); overflow-wrap: anywhere; }
summary { cursor: pointer; }
</style>
