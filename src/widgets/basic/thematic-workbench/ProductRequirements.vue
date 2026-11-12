<template>
  <section v-if="product" class="product-requirements" aria-label="专题产品要求与资料状态">
    <header><strong>{{ product.name }}</strong><span :class="{ ready: !missing.length, pending: missing.length }" role="status">{{ busy ? '正在核对资料' : missing.length ? '专题资料待补齐' : '所需图层已显示' }}</span></header>
    <p v-if="!busy && missing.length" class="pending">待补齐：{{ missing.join('；') }}</p>
    <p v-if="!busy && missing.includes('地形')" class="pending">地形资料尚未提供独立接口；现有基础地理压缩包含等高线和高程点，不能替代 DEM 晕渲图层。</p>
    <details><summary>产品要求与制图依据</summary>
      <dl><dt>用途</dt><dd>{{ product.purpose }}</dd><dt>表达</dt><dd>{{ product.expression }}</dd><dt>统计</dt><dd>{{ product.statistics }}</dd><dt>适用边界</dt><dd>{{ product.boundary }}</dd><dt>依据</dt><dd>{{ product.standards.join('；') }}</dd></dl>
      <ul><li v-for="entry in requirements" :key="entry.key"><span>{{ entry.label }}</span><span>{{ entry.group === 'optional' ? '参考' : entry.group === 'topic' ? '任选一类' : '必需' }}</span><button v-if="!visible.has(entry.key)" type="button" @click="emit('locate', [entry.key])">{{ inputOnly.has(entry.key) ? '配置指标' : sourceAction(entry.key) }}</button><span v-else>已显示</span></li></ul>
    </details>
  </section>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { productDefinition } from "./product-definitions"
import { workflowRequirements, workflowMissing, type WorkflowStatus } from "./cartography-workflow"
import type { DbtLayer } from "./dbt116-standard"
const props = defineProps<{ topic: string; layers: DbtLayer[]; states: Record<string, WorkflowStatus>; busy: boolean }>()
const emit = defineEmits<{ locate: [keys: string[]] }>()
const product = computed(() => productDefinition(props.topic))
const requirements = computed(() => workflowRequirements(props.topic))
const inputOnly = computed(() => new Set(props.layers.filter(layer => layer.onlineSource?.rendering?.parameters?.inputOnly).map(layer => layer.id.replace(/^online:/, ""))))
function sourceAction(key: string) {
  if (props.states[key] === "failed") { return "读取失败" }
  if (props.states[key] === "empty") { return "未匹配" }
  return "查看资料"
}
const visible = computed(() => new Set(props.layers.filter(layer => layer.enabled !== false && (layer.opacity ?? 1) > 0 && !layer.onlineSource?.rendering?.parameters?.inputOnly).map(layer => layer.id.replace(/^online:/, ""))))
const missing = computed(() => workflowMissing(props.topic, [...visible.value]))
</script>
<style scoped>
.product-requirements { border-bottom: 1px solid var(--thematic-line); padding: 0 0 12px; margin-bottom: 14px; }
header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; font-size: 14px; }
header strong { flex: 1 1 190px; overflow-wrap: anywhere; } header span { font-size: 12px; }
.pending { color: var(--thematic-warning); } .ready { color: var(--thematic-success); }
p { font-size: 13px; line-height: 1.6; margin: 8px 0; overflow-wrap: anywhere; }
details { margin-top: 10px; font-size: 13px; } summary { cursor: pointer; color: var(--thematic-muted); }
dl { display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 8px; line-height: 1.65; margin: 12px 0; } dt { color: var(--thematic-muted); } dd { margin: 0; overflow-wrap: anywhere; }
ul { list-style: none; padding: 0; margin: 0; } li { display: grid; grid-template-columns: minmax(0, 1fr) 70px 75px; align-items: center; gap: 8px; padding: 7px 0; border-top: 1px solid var(--thematic-line); } li span { overflow-wrap: anywhere; }
button { color: var(--thematic-accent); border: 0; padding: 5px 0; background: transparent; cursor: pointer; text-align: left; } button:focus-visible { outline: 2px solid var(--thematic-accent); }
</style>
