<template>
  <details ref="root" class="backend-picker" @toggle="opened">
    <summary>从后端目录选择图层</summary>
    <section aria-label="全部后端图层" class="picker-body">
      <div class="actions"><label>数据集<select v-model="collection" aria-label="后端图层数据集" :disabled="searching || busy"><option value="">全部数据集</option><option v-for="entry in collections" :key="entry.id" :value="entry.id">{{ entry.name }}</option></select></label><button type="button" :disabled="searching || busy || !active" @click="query(false)"><mars-icon icon="search" :width="16" />查询图层</button></div>
      <label class="check"><input v-model="scoped" type="checkbox" :disabled="searching || busy" />仅查询框选范围</label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="queried && !items.length && !searching">当前查询无返回条目；可取消范围限制核对目录。</p>
      <template v-if="items.length">
        <label>数据<select v-model="identity" aria-label="后端图层数据" :disabled="searching || busy"><option v-for="item in items" :key="itemKey(item)" :value="itemKey(item)">{{ remoteItemTitle(item) }}</option></select></label>
        <label>显示内容<select v-model="assetKey" aria-label="后端图层资产" :disabled="searching || busy"><option v-for="(asset, key) in selectedItem?.assets || {}" :key="key" :value="key">{{ asset.title || key }}{{ layerAssets.some(entry => entry.key === key) ? '' : ' · 文件/附件' }}</option></select></label>
        <label v-if="selectedAsset">专题用途<select v-model="target" aria-label="后端图层专题用途" :disabled="busy"><option v-for="entry in targets" :key="entry.key" :value="entry.key">{{ entry.label }}</option></select></label>
        <div class="actions"><button v-if="selectedAsset" type="button" :disabled="busy || searching || !active || !bounds || !target" @click="assign"><mars-icon icon="layers" :width="16" />{{ businessTarget ? '读取并配置字段' : '叠加到地图' }}</button><a v-if="downloadUrl" :href="downloadUrl" target="_blank" rel="noopener noreferrer">{{ selectedAsset ? '查看源文件' : '打开后端文件' }}</a></div>
        <p v-if="!selectedAsset" class="notice">后台已提供此文件；当前不是可直接显示的 GeoJSON/GeoTIFF，文件入口保留，不标记为数据缺失。</p>
        <details class="service-links"><summary>地图服务与文件接口</summary><div class="actions"><a v-for="link in serviceLinks" :key="link.id" :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }}</a></div></details>
        <details><summary>数据说明与来源</summary><p>{{ selectedItem && remoteItemNotice(selectedItem) }}</p><p>{{ selectedItem?.collection }} / {{ selectedItem?.id }}</p><p>{{ selectedItem?.assets[assetKey]?.href }}</p></details>
      </template>
      <button v-if="nextToken" type="button" :disabled="searching || busy" @click="query(true)"><mars-icon icon="more" :width="16" />继续读取</button>
      <p v-else-if="hasMore" class="notice">后台有后续页但未提供可用分页令牌，当前不是完整清单。</p>
    </section>
  </details>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import { listRemoteCollections, remoteLayerAssets, remoteItemTitle, remoteItemNotice, remoteProxyUrl, searchStacPage, type RemoteItem } from "./remote-cartography-source"
import type { WorkflowRequirement } from "./cartography-workflow"
import type { DbtBounds } from "./dbt116-standard"
import { backendServiceLinks } from "./backend-service-links"

const props = defineProps<{ bounds: DbtBounds | null; active: boolean; busy: boolean; requirements: WorkflowRequirement[] }>()
const emit = defineEmits<{ assign: [value: { item: RemoteItem; asset: string; key: string }] }>()
const root = ref<HTMLDetailsElement>()
const collections = ref<Array<{ id: string; name: string }>>([])
const collection = ref(""); const scoped = ref(true); const searching = ref(false); const queried = ref(false); const error = ref("")
const items = shallowRef<RemoteItem[]>([]); const identity = ref(""); const assetKey = ref(""); const target = ref("")
const nextToken = ref<string>(); const hasMore = ref(false)
const itemKey = (item: RemoteItem) => JSON.stringify([item.collection, item.id])
const selectedItem = computed(() => items.value.find(item => itemKey(item) === identity.value))
const layerAssets = computed(() => selectedItem.value ? remoteLayerAssets(selectedItem.value) : [])
const selectedAsset = computed(() => layerAssets.value.find(asset => asset.key === assetKey.value))
const targets = computed(() => [...props.requirements.filter(entry => entry.key !== "catalog-reference" && !["event", "distance"].includes(entry.role)), { key: "catalog-reference", label: "其他参考图层" }])
const businessTarget = computed(() => props.requirements.find(entry => entry.key === target.value)?.adapter === "business-vector")
const downloadUrl = computed(() => { const href = selectedItem.value?.assets[assetKey.value]?.href; if (!href) { return "" }; try { return remoteProxyUrl("files", href) } catch { return "" } })
const serviceLinks = computed(() => selectedItem.value ? backendServiceLinks(selectedItem.value, assetKey.value) : [])
let request: AbortController | undefined; let disposed = false; let queryKey = ""
watch(selectedItem, () => { assetKey.value = layerAssets.value[0]?.key || Object.keys(selectedItem.value?.assets || {})[0] || "" })
watch(targets, entries => { if (!entries.some(entry => entry.key === target.value)) { target.value = entries[0]?.key || "" } }, { immediate: true })
watch([collection, scoped, () => props.bounds, () => props.active], () => { request?.abort(); searching.value = false; queried.value = false; items.value = []; identity.value = ""; nextToken.value = undefined; hasMore.value = false; error.value = "" })
async function opened(event: Event) { if ((event.target as HTMLDetailsElement).open && !queried.value && props.active) { await query(false) } }
async function query(more: boolean) {
  if (searching.value || props.busy || !props.active) { return }
  const controller = new AbortController(); request = controller; searching.value = true; error.value = ""
  try {
    if (!collections.value.length) { collections.value = await listRemoteCollections(controller.signal) }
    const b = props.bounds
    if (scoped.value && !b) { throw new Error("请先框选范围，或取消范围限制查询") }
    const body = { limit: 50, ...(collection.value ? { collections: [collection.value] } : {}), ...(scoped.value && b ? { bbox: [b.west, b.south, b.east, b.north] } : {}) }
    const key = JSON.stringify(body)
    if (more && key !== queryKey) { throw new Error("查询条件已变化，请重新查询") }
    const result = await searchStacPage(body, controller.signal, more ? nextToken.value : undefined)
    if (disposed || controller.signal.aborted) { return }
    items.value = [...new Map([...(more ? items.value : []), ...result.items].map(item => [itemKey(item), item])).values()]
    if (!items.value.some(item => itemKey(item) === identity.value)) { identity.value = items.value[0] ? itemKey(items.value[0]) : "" }
    queryKey = key; queried.value = true; nextToken.value = result.nextToken; hasMore.value = result.hasMore
  } catch (err) { if (!controller.signal.aborted && !disposed) { error.value = err instanceof Error ? err.message : "目录读取失败" } } finally { if (request === controller) { searching.value = false } }
}
function assign() { if (selectedItem.value && selectedAsset.value && target.value && props.bounds && props.active && !props.busy) { emit("assign", { item: selectedItem.value, asset: assetKey.value, key: target.value }) } }
async function open(key?: string) {
  if (props.busy || !props.active) { return }
  if (key && targets.value.some(entry => entry.key === key)) { target.value = key }
  if (root.value) { root.value.open = true; root.value.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true }); root.value.scrollIntoView?.({ block: "start", behavior: "smooth" }) }
  if (!queried.value) { await query(false) }
}
onBeforeUnmount(() => { disposed = true; request?.abort() })
defineExpose({ open })
</script>

<style scoped>
.backend-picker { border-block: 1px solid var(--thematic-line); margin-block: 12px; padding-block: 12px; color: var(--thematic-ink); min-width: 0; }
summary { cursor: pointer; font-weight: 600; }.picker-body { display: grid; gap: 12px; padding-top: 12px; min-width: 0; }
.actions { display: flex; flex-wrap: wrap; align-items: end; gap: 10px; }.actions label { flex: 1 1 180px; }
label { display: grid; gap: 6px; min-width: 0; }.check { display: flex; align-items: center; gap: 8px; }
select,button { font: inherit; color: var(--thematic-ink); background: var(--thematic-control); border: 1px solid var(--thematic-line); border-radius: 3px; padding: 8px; min-width: 0; max-width: 100%; }
select { width: 100%; }button { cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }button:disabled { cursor: default; opacity: .6; }
a { color: var(--thematic-accent); }p { font-size: 13px; line-height: 1.65; margin: 0; overflow-wrap: anywhere; }.error { color: var(--thematic-danger); }.notice { color: var(--thematic-warning); }
</style>
