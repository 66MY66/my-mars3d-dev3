<template>
  <section class="backend-standard" aria-label="后台审核图件">
    <header><strong>后台审核图件</strong><span>{{ state }}</span></header>
    <div class="actions"><button type="button" :disabled="busy || !active" @click="query"><mars-icon icon="search" :width="16" />查询审核数据包</button></div>
    <button v-if="nextToken" type="button" :disabled="busy || !active" @click="more"><mars-icon icon="more" :width="16" />继续读取审核数据包</button>
    <template v-if="items.length">
      <label>审核数据包<select v-model="selected" aria-label="后台审核数据包" :disabled="busy"><option v-for="item in items" :key="`${item.collection}/${item.id}`" :value="`${item.collection}/${item.id}`">{{ item.properties.title || item.id }} · {{ item.properties['cartography:revision'] }}</option></select></label>
      <button type="button" :disabled="busy || !active || !selected" @click="load"><mars-icon icon="check" :width="16" />绑定后台审核图件</button>
    </template>
    <p v-if="message" role="status">{{ message }}</p><p v-if="error" role="alert" class="error">{{ error }}</p>
  </section>
</template>
<script setup lang="ts">
import { ref, shallowRef, watch, onBeforeUnmount } from "vue"
import { findBackendStandardDocuments, loadBackendStandardDocument } from "./backend-standard-document"
import type { RemoteItem } from "./remote-cartography-source"
import type { DbtDocument, DbtTemplateId, DbtBounds } from "./dbt116-standard"
const props = defineProps<{ templateId: DbtTemplateId; active: boolean; bounds?: DbtBounds | null }>()
const emit = defineEmits<{ document: [doc: DbtDocument] }>()
const items = shallowRef<RemoteItem[]>([]); const selected = ref(""); const busy = ref(false); const error = ref(""); const message = ref(""); const state = ref("未查询")
const nextToken = ref<string | undefined>()
let revision = 0; let controller: AbortController | undefined
function reset() { revision++; controller?.abort(); items.value = []; nextToken.value = undefined; selected.value = ""; error.value = ""; message.value = ""; state.value = "未查询"; busy.value = false }
watch([() => props.templateId, () => JSON.stringify(props.bounds)], reset)
watch(() => props.active, active => { if (!active) { reset() } })
async function perform(action: (signal: AbortSignal, current: () => boolean) => Promise<void>) {
  if (busy.value || !props.active) { return }
  const ticket = ++revision; controller = new AbortController(); const request = controller
  busy.value = true; error.value = ""
  const timer = setTimeout(() => request.abort(), 30000)
  const current = () => ticket === revision && props.active && !request.signal.aborted
  try { await action(request.signal, current) } catch (err) {
    if (ticket === revision && props.active) {
      const detail = err instanceof Error ? err.message : "后台读取失败"
      error.value = request.signal.aborted ? "后台请求超时或已取消，请检查内网后重试" : detail; state.value = "未绑定"
    }
  } finally { clearTimeout(timer); if (ticket === revision) { busy.value = false } }
}
function query() {
  return perform(async (signal, current) => {
  const result = await findBackendStandardDocuments(props.templateId, props.bounds || null, signal)
  if (!current()) { return }
  items.value = result.items; selected.value = result.items[0] ? `${result.items[0].collection}/${result.items[0].id}` : ""
  nextToken.value = result.nextToken
  state.value = `${result.items.length} 份可选`
  message.value = result.items.length ? `已读取后台声明审核完成的数据包${result.hasMore ? "；结果未完整，请缩小查询范围" : ""}` : "本次未返回此审核协议的数据包，不表示后台没有原始数据。原始图层按独立目录检索；正式资格还需来源、质量与审核依据。"
  })
}
function more() {
  return perform(async (signal, current) => {
    if (!nextToken.value) { return }
    const result = await findBackendStandardDocuments(props.templateId, props.bounds || null, signal, nextToken.value)
    if (!current()) { return }
    const merged = [...new Map([...items.value, ...result.items].map(item => [`${item.collection}/${item.id}`, item])).values()]
    if (merged.length > 1000) { throw new Error("审核候选超过 1000 条，请缩小范围") }
    items.value = merged; nextToken.value = result.nextToken; state.value = `${merged.length} 份可选`
    if (!selected.value && merged.length) { selected.value = `${merged[0].collection}/${merged[0].id}` }
    message.value = result.hasMore ? "审核目录尚有后续记录。" : "当前检索分页已读取完成。"
  })
}
function load() {
  return perform(async (signal, current) => {
  const item = items.value.find(item => `${item.collection}/${item.id}` === selected.value)
  if (!item) { throw new Error("请选择审核数据包") }
  const doc = await loadBackendStandardDocument(item, props.templateId, signal)
  if (!current()) { return }
  emit("document", doc); state.value = "已核对后台审核记录"; message.value = `审核：${doc.backendDocument!.reviewer} · ${doc.backendDocument!.reviewedAt}；仍须完成当前图件检查与人工复核。`
  })
}
onBeforeUnmount(reset)
</script>
<style scoped>
.backend-standard { border-block: 1px solid var(--thematic-line); padding: 12px 0; margin-block: 12px; color: var(--thematic-ink); min-width: 0; } header,.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; } header { justify-content: space-between; } header span,p { color: var(--thematic-muted); font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; } label { display: grid; gap: 6px; margin-block: 10px; } select,button { box-sizing: border-box; min-width: 0; max-width: 100%; min-height: 36px; padding: 7px 10px; border: 1px solid var(--thematic-line); background: var(--thematic-control); color: var(--thematic-ink); font: inherit; border-radius: 3px; } select { width: 100%; color-scheme: var(--thematic-scheme); } button { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; } button:disabled { background: var(--thematic-disabled-bg); color: var(--thematic-disabled-ink); cursor: not-allowed; } .error { color: var(--thematic-danger); } button:focus-visible,select:focus-visible { outline: 2px solid var(--thematic-accent); outline-offset: 2px; }
</style>
