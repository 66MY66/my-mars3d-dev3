<template>
  <details class="result-documents">
    <summary>关联报告与既有成图</summary>
    <div class="actions"><label>成果类型<select v-model="collection" :disabled="busy" aria-label="关联成果类型"><option value="disaster-report">评估报告</option><option value="thematic-map">既有成图</option><option value="spatial-thematic">源资料与后台浏览页</option></select></label><button type="button" :disabled="busy || !active" @click="query(false)"><mars-icon icon="search" :width="16" />查询关联成果</button><button v-if="nextToken" type="button" :disabled="busy" @click="query(true)"><mars-icon icon="more" :width="16" />更多成果</button></div>
    <p v-if="collection === 'spatial-thematic'">压缩包、MapGIS 和说明文件仅作源资料；云南建筑没有损毁类别，人口/GDP 三维成果不是实际地形 DEM。</p>
    <article v-for="item in items" :key="`${item.collection}:${item.id}`">
      <strong>{{ item.properties.title || item.id }}</strong>
      <p>{{ item.properties.datetime || item.properties.start_datetime || '时间未提供' }}</p>
      <p v-if="item.properties['eq:event_name']">{{ item.properties['eq:event_name'] }}</p>
      <div class="actions"><a v-for="asset in links(item)" :key="asset.href" :href="asset.href" target="_blank" rel="noopener noreferrer">{{ asset.label }}</a></div>
    </article>
    <p v-if="message" role="status">{{ message }}</p><p v-if="error" class="error" role="alert">{{ error }}</p>
  </details>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from "vue"
import type { RectInfo } from "./map"
import type { RemoteItem } from "./remote-cartography-source"
import { queryBackendResults, backendAssetUrl } from "./thematic-backend"
import { productionItem, intersectBounds, scopeFingerprint } from "./cartography-workflow"
import { remoteBounds, searchRemoteItems } from "./remote-cartography-source"

const props = defineProps<{ active: boolean; bounds: RectInfo }>()
const collection = ref("disaster-report"); const busy = ref(false); const items = shallowRef<RemoteItem[]>([])
const nextToken = ref<string>(); const message = ref(""); const error = ref("")
let request: AbortController | undefined; let revision = 0
function reset() { revision++; request?.abort(); busy.value = false; items.value = []; nextToken.value = undefined; message.value = ""; error.value = "" }
watch([collection, () => props.active, () => scopeFingerprint(props.bounds)], reset)
function links(item: RemoteItem) {
  return Object.entries(item.assets).flatMap(([key, asset]) => {
    if (!/^(text\/html|application\/(pdf|zip|vnd\.rar)|image\/(png|jpeg)|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/.test(asset.type || "")) { return [] }
    let label = "下载文件"
    if (asset.type === "text/html") { label = "查看报告" } else if (/^image\//.test(asset.type || "")) { label = "查看成图" }
    if (collection.value === "spatial-thematic") { label = String(asset.title || (asset.type === "text/html" ? "打开后台浏览页" : "下载源资料")) }
    try { return [{ href: backendAssetUrl(item, key), label }] } catch { return [] }
  }).filter((entry, index, all) => all.findIndex(other => other.href === entry.href) === index)
}
async function query(more: boolean) {
  if (busy.value || !props.active || (more && !nextToken.value)) { return }
  const ticket = revision; const controller = new AbortController(); request = controller; busy.value = true; error.value = ""
  try {
    const result = collection.value === "spatial-thematic" ? await searchRemoteItems(collection.value, props.bounds, controller.signal, more ? nextToken.value : undefined) : await queryBackendResults(collection.value, controller.signal, more ? nextToken.value : undefined, props.bounds)
    if (ticket !== revision || controller.signal.aborted) { return }
    const matching = result.items.filter(item => productionItem(item) && intersectBounds(remoteBounds(item.bbox), props.bounds) && links(item).length)
    const merged = [...new Map([...(more ? items.value : []), ...matching].map(item => [item.id, item])).values()]
    if (merged.length > 1000) { throw new Error("关联成果较多，请缩小范围") }
    items.value = merged; nextToken.value = result.nextToken
    message.value = merged.length ? `${merged.length} 份可查看成果${result.hasMore ? "；尚有后续记录" : ""}` : `当前范围未找到适用报告或成图${result.hasMore ? "；可继续查询后续记录" : ""}`
  } catch (err) { if (ticket === revision && !controller.signal.aborted) { error.value = err instanceof Error ? err.message : "成果读取失败" } } finally { if (ticket === revision) { busy.value = false } }
}
onBeforeUnmount(reset)
</script>

<style scoped>
.result-documents { border-top: 1px solid var(--thematic-line); margin-top: 14px; padding-top: 12px; min-width: 0; }
summary { cursor: pointer; font-weight: 600; }article { border-bottom: 1px solid var(--thematic-line); padding: 12px 0; overflow-wrap: anywhere; }p { margin: 6px 0; color: var(--thematic-muted); font-size: 12px; }p.error { color: var(--thematic-danger); }
.actions { display: flex; flex-wrap: wrap; align-items: end; gap: 8px; margin: 10px 0; }label { display: grid; gap: 5px; min-width: 0; max-width: 100%; }select { min-height: 36px; max-width: 100%; background: var(--thematic-control); color: var(--thematic-ink); border: 1px solid var(--thematic-line); padding: 6px; }button { min-height: 36px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--thematic-primary); background: var(--thematic-primary); color: #fff; cursor: pointer; }button:disabled { color: var(--thematic-disabled-ink); background: var(--thematic-disabled-bg); border-color: var(--thematic-line); cursor: not-allowed; }a { color: var(--thematic-accent); }button:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible { outline: 2px solid var(--thematic-accent); outline-offset: 2px; }
</style>
