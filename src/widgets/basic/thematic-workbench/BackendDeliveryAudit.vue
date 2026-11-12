<template>
  <details class="delivery-audit">
    <summary>高级维护 · 数据交付核对</summary>
    <div class="actions"><button type="button" :disabled="busy || !active" @click="query"><mars-icon icon="search" :width="16" />核对后台原始数据</button><button v-if="audit" type="button" :disabled="busy" @click="download"><mars-icon icon="download" :width="16" />下载交付核对表</button></div>
    <p v-if="busy" role="status">正在读取后台业务目录</p><p v-if="error" role="alert" class="error">{{ error }}</p>
    <template v-if="audit">
      <p>目录原始记录 {{ audit.items.length }} 条 · 声明审核包 {{ report!.declaredApprovedPackages }} 份</p>
      <p class="muted">{{ report!.scope }} · {{ audit.checkedAt }}</p>
      <ul class="collection-status"><li v-for="collection in audit.collections" :key="collection.id">{{ collection.id }} · {{ collection.count }} 条 · {{ collection.error || (collection.complete ? '目录读取完整' : '目录未读全') }}</li></ul>
      <section v-for="row in report!.rows" :key="row.role"><header><strong>{{ row.label }}</strong><span>{{ row.status }}</span></header><p v-if="row.ids.length" class="muted">{{ row.ids.join(' / ') }}</p><p>{{ row.needs }}</p></section>
      <p class="warning">{{ report!.publication }}</p>
      <details v-if="report!.excluded.length"><summary>已排除演示来源 · {{ report!.excluded.length }} 条</summary><ul><li v-for="item in report!.excluded" :key="`${item.collection}/${item.id}`">{{ item.collection }} / {{ item.id }}</li></ul></details>
    </template>
  </details>
</template>
<script setup lang="ts">
import { computed, ref, shallowRef, watch, onBeforeUnmount } from "vue"
import { auditBackendDelivery, deliveryAuditReport, type DeliveryAudit } from "./backend-delivery-audit"
import { downloadBlob } from "./export-media"
const props = defineProps<{ active: boolean }>()
const busy = ref(false); const error = ref(""); const audit = shallowRef<DeliveryAudit | null>(null)
const report = computed(() => audit.value && deliveryAuditReport(audit.value))
let request: AbortController | undefined
async function query() {
  if (busy.value || !props.active) { return }
  const controller = new AbortController(); request = controller; busy.value = true; error.value = ""; audit.value = null
  try { const result = await auditBackendDelivery(controller.signal); if (!controller.signal.aborted && props.active) { audit.value = result } } catch (err) { if (!controller.signal.aborted) { error.value = err instanceof Error ? err.message : "目录核对失败" } } finally { if (request === controller) { busy.value = false } }
}
function download() { if (report.value) { downloadBlob(new Blob([JSON.stringify(report.value, null, 2)], { type: "application/json" }), "thematic-backend-delivery.json") } }
watch(() => props.active, active => { if (!active) { request?.abort() } })
onBeforeUnmount(() => request?.abort())
</script>
<style scoped>
.delivery-audit { border-block: 1px solid var(--thematic-line); padding-block: 12px; margin-block: 12px; min-width: 0; color: var(--thematic-ink); } summary { cursor: pointer; font-weight: 600; } .actions,header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }.actions { justify-content: flex-start; margin-block: 12px; } button { display: inline-flex; gap: 6px; align-items: center; min-height: 36px; max-width: 100%; padding: 7px 10px; border: 1px solid var(--thematic-line); border-radius: 3px; background: var(--thematic-control); color: var(--thematic-ink); cursor: pointer; }button:disabled { background: var(--thematic-disabled-bg); color: var(--thematic-disabled-ink); } section { border-top: 1px solid var(--thematic-line); padding-block: 10px; }p,li,header span { font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }.muted,.collection-status { color: var(--thematic-muted); }.warning { color: var(--thematic-warning); }.error { color: var(--thematic-danger); }ul { padding-left: 18px; } button:focus-visible,summary:focus-visible { outline: 2px solid var(--thematic-accent); outline-offset: 2px; }
</style>
