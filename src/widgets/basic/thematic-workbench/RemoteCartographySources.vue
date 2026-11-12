<template>
  <details class="remote-sources" @toggle="onToggle">
    <summary>在线数据目录<span v-if="current"> · 参考图层已加入地图</span></summary>
    <section class="remote-body" aria-label="在线专题数据">
      <div class="query-row">
        <label>数据集<select v-model="collection" aria-label="在线数据集" :disabled="searching || loading"><option v-for="entry in collectionOptions" :key="entry.id" :value="entry.id">{{ entry.name }}</option></select></label>
        <button type="button" :disabled="searching || loading || !active" @click="query(false)"><mars-icon icon="search" :width="16" />{{ searching ? '正在查询' : '查询数据' }}</button>
      </div>
      <label class="check"><input v-model="selectionOnly" type="checkbox" :disabled="searching" />限定地图框选范围</label>
      <p v-if="queryError" class="error" role="alert">{{ queryError }}</p>
      <p v-if="queried && !items.length && !searching && !queryError" role="status">当前查询没有返回条目，可调整范围再次查询。</p>
      <button v-if="nextToken" type="button" :disabled="searching || loading" @click="query(true)">继续读取目录</button><p v-if="hasMore" class="muted">目录还有后续结果，当前列表不代表完整清单。</p>
      <template v-if="items.length">
        <label>数据条目<select v-model="itemId" aria-label="在线数据条目" :disabled="loading"><option v-for="entry in items" :key="entry.id" :value="entry.id">{{ remoteItemTitle(entry) }}</option></select></label>
        <template v-if="selectedItem">
          <p class="notice">{{ remoteItemNotice(shownItem!) }}</p>
          <dl><dt>条目</dt><dd>{{ shownItem!.id }}</dd><dt>数据时间</dt><dd>{{ remoteItemTime(shownItem!) }}</dd><dt>目录坐标</dt><dd>{{ shownItem!.properties['proj:epsg'] ? `EPSG:${shownItem!.properties['proj:epsg']}` : 'GeoJSON 默认地理坐标，待来源核验' }}</dd><dt>覆盖范围</dt><dd>{{ shownItem!.bbox.map(v => Number(v.toFixed(5))).join(' / ') }}</dd></dl>
          <p v-if="remoteItemBlock(selectedItem)" class="notice">{{ remoteItemBlock(selectedItem) }}</p>
          <template v-if="assets.length">
            <label>图层资产<select v-model="assetKey" aria-label="在线图层资产" :disabled="loading"><option v-for="asset in assets" :key="asset.key" :value="asset.key">{{ asset.title }} · {{ asset.key }}</option></select></label>
            <template v-if="selectedAsset?.numeric">
              <label v-if="selectedAsset.bands.length > 1">波段<select v-model.number="band" aria-label="在线栅格波段" :disabled="loading"><option v-for="(name, index) in selectedAsset.bands" :key="index" :value="index + 1">{{ name }}</option></select></label>
              <div class="two-columns"><label>显示拉伸下限<input v-model.number="minimum" type="number" step="any" aria-label="在线显示下限" :disabled="loading" /></label><label>显示拉伸上限<input v-model.number="maximum" type="number" step="any" aria-label="在线显示上限" :disabled="loading" /></label></div>
              <p class="muted">目录单位：{{ remoteCatalogUnit(shownItem!, assetKey) }}（来源待核验）。拉伸范围仅控制显示，不是业务分级阈值。</p>
            </template>
            <div class="actions"><button type="button" :disabled="loading || searching || !active" @click="load"><mars-icon icon="layers" :width="16" />{{ loading ? '正在读取图层' : '加载参考图层' }}</button><button type="button" class="secondary" :disabled="!current" @click="locate"><mars-icon icon="local" :width="16" />定位</button><button type="button" class="secondary" :disabled="!current && !loading" @click="clearLoaded"><mars-icon icon="delete" :width="16" />移除</button></div>
          </template>
          <p v-if="loadError" class="error" role="alert">{{ loadError }}</p>
          <template v-if="current">
            <p class="loaded" role="status">已加入地图 · {{ current.asset.title }} · 数据参考，非正式成果{{ vector ? ` · ${vector.features.length} 个要素` : '' }}</p>
            <div v-if="current.asset.numeric" class="legend" aria-label="在线数值色带"><span>{{ current.options.minimum }}</span><i :style="{ background: referenceGradient }"></i><span>{{ current.options.maximum }}</span></div>
            <template v-if="current.asset.numeric">
              <label class="check"><input v-model="picking" type="checkbox" />地图点查原始数值</label>
              <div class="two-columns"><label>经度<input v-model.number="longitude" type="number" step="any" aria-label="在线点查经度" /></label><label>纬度<input v-model.number="latitude" type="number" step="any" aria-label="在线点查纬度" /></label></div>
              <button type="button" :disabled="pointBusy" @click="queryPoint"><mars-icon icon="search" :width="16" />{{ pointBusy ? '正在点查' : '读取点位数值' }}</button>
              <p v-if="pointError" class="error" role="alert">{{ pointError }}</p>
              <p v-if="pointResult" class="point-result" role="status"><strong>原始数值：<output aria-label="在线点查数值">{{ pointResult.value === null ? 'NoData（缺测，非零值）' : pointResult.value }}</output></strong><span>{{ pointResult.longitude.toFixed(5) }}, {{ pointResult.latitude.toFixed(5) }} · {{ pointResult.band }}</span></p>
            </template>
            <div v-if="attributes.length" class="attribute-table"><table aria-label="在线矢量要素属性"><caption>要素属性{{ attributeLabel ? ` · ${attributeLabel}` : '' }}</caption><tbody><tr v-for="[key, value] in attributes" :key="key"><th>{{ key }}</th><td>{{ attributeText(value) }}</td></tr></tbody></table></div>
          </template>
        </template>
      </template>
    </section>
  </details>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import * as mapWork from "./map"
import type { TemplateDocument } from "./template-renderer"
import { backendRenderPlan } from "./cartography-backend-render"
import { remoteCollections, listRemoteCollections, searchRemoteItems, refreshRemoteItem, remoteLayerAssets, remoteItemTitle, remoteItemNotice, remoteItemBlock, remoteItemTime, remoteCatalogUnit, remoteBounds, remoteRaster, remoteVector, remotePoint, type RemoteItem, type RemoteLayerAsset, type RemotePoint, type RemoteRenderOptions } from "./remote-cartography-source"

const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true })
const collection = ref<string>("spatial-thematic")
const collectionOptions = ref<Array<{ id: string; name: string }>>([...remoteCollections]); const nextToken = ref<string>()
const selectionOnly = ref(false); const searching = ref(false); const loading = ref(false); const queried = ref(false)
const queryError = ref(""); const loadError = ref(""); const hasMore = ref(false)
const items = shallowRef<RemoteItem[]>([]); const itemId = ref(""); const assetKey = ref("")
const band = ref(1); const minimum = ref(0); const maximum = ref(5000)
const selectedItem = computed(() => items.value.find(item => item.id === itemId.value))
const assets = computed(() => selectedItem.value ? remoteLayerAssets(selectedItem.value) : [])
const selectedAsset = computed(() => assets.value.find(asset => asset.key === assetKey.value))
const current = shallowRef<{ item: RemoteItem; asset: RemoteLayerAsset; options: RemoteRenderOptions; bounds: mapWork.RectInfo } | null>(null)
const referenceGradient = computed(() => {
  const value = current.value
  if (!value || !value.asset.numeric) { return "transparent" }
  const plan = backendRenderPlan(value.item, value.asset, "raster-ramp", value.options, null)
  return `linear-gradient(90deg,${plan.legend.map(row => row.color).join(",")})`
})
const shownItem = computed(() => current.value?.item || selectedItem.value)
const vector = shallowRef<TemplateDocument | null>(null)
const attributes = shallowRef<Array<[string, unknown]>>([]); const attributeLabel = ref("")
const longitude = ref(0); const latitude = ref(0); const picking = ref(false); const pointBusy = ref(false)
const pointResult = shallowRef<RemotePoint | null>(null); const pointError = ref("")
let searchRequest: AbortController | undefined; let layerRequest: AbortController | undefined; let pointRequest: AbortController | undefined
let disposed = false

function clearLoaded() {
  layerRequest?.abort(); pointRequest?.abort(); picking.value = false
  mapWork.pickRemoteReferencePoint(); mapWork.clearRemoteReference()
  current.value = null; vector.value = null; attributes.value = []; attributeLabel.value = ""
  pointResult.value = null; pointError.value = ""; pointBusy.value = false; loading.value = false
}
function stopAll() { searchRequest?.abort(); searching.value = false; clearLoaded() }
watch(collection, () => { stopAll(); items.value = []; itemId.value = ""; queryError.value = ""; queried.value = false; nextToken.value = undefined; hasMore.value = false })
watch(selectedItem, () => { clearLoaded(); loadError.value = ""; assetKey.value = assets.value[0]?.key || "" })
watch(selectedAsset, asset => {
  clearLoaded(); loadError.value = ""
  band.value = asset ? Math.max(1, asset.bands.findIndex(name => /CH24/.test(name)) + 1) : 1
  minimum.value = asset?.range[0] ?? 0; maximum.value = asset?.range[1] ?? 1
})
watch([band, minimum, maximum], () => { clearLoaded(); loadError.value = "" })
watch(() => props.active, active => { if (!active) { stopAll() } })
watch(picking, enabled => mapWork.pickRemoteReferencePoint(enabled
  ? (lon, lat) => {
  if (!props.active || !current.value) { return }
  longitude.value = lon; latitude.value = lat; queryPoint()
  }
  : undefined))
watch([longitude, latitude], () => { pointRequest?.abort(); pointBusy.value = false; pointResult.value = null; pointError.value = "" }, { flush: "sync" })

function onToggle(event: Event) { if ((event.target as HTMLDetailsElement).open && props.active && !queried.value && !searching.value) { query() } }
async function query(more = false) {
  if (!props.active || disposed || searching.value) { return }
  searchRequest?.abort(); const request = new AbortController(); searchRequest = request
  clearLoaded(); if (!more) { items.value = []; itemId.value = "" }; queryError.value = ""; queried.value = true; searching.value = true
  const sourceCollection = collection.value
  try {
    const bounds = selectionOnly.value ? mapWork.getLockedSelection() : null
    if (selectionOnly.value && !bounds) { throw new Error("请先框选并锁定地图范围，或取消限定范围") }
    const result = await searchRemoteItems(sourceCollection, bounds, request.signal, more ? nextToken.value : undefined)
    if (disposed || request.signal.aborted || !props.active || collection.value !== sourceCollection) { return }
    items.value = [...new Map([...(more ? items.value : []), ...result.items].map(item => [item.id, item])).values()]; itemId.value ||= items.value[0]?.id || ""; nextToken.value = result.nextToken; hasMore.value = result.hasMore; queried.value = true
    collectionOptions.value = await listRemoteCollections(request.signal)
  } catch (error) { if (!request.signal.aborted && !disposed) { queryError.value = error instanceof Error ? error.message : "目录查询失败" } } finally { if (searchRequest === request) { searching.value = false } }
}
async function load() {
  if (!props.active || disposed || loading.value || !selectedItem.value || !selectedAsset.value) { return }
  const candidate = selectedItem.value; const key = assetKey.value
  let options: RemoteRenderOptions = { band: band.value, minimum: minimum.value, maximum: maximum.value }
  clearLoaded(); loadError.value = ""; loading.value = true
  const request = new AbortController(); layerRequest = request
  try {
    const item = await refreshRemoteItem(candidate, request.signal)
    const asset = remoteLayerAssets(item).find(a => a.key === key)
    if (!asset) { throw new Error("目录资产已变化，请重新查询") }
    if (asset.kind === "raster") { options = backendRenderPlan(item, asset, "raster-ramp", options, null).params }
    const raster = asset.kind === "raster" ? await remoteRaster(item, asset, options, request.signal) : undefined
    const document = asset.kind === "vector" ? await remoteVector(item, asset, request.signal, mapWork.getLockedSelection() || undefined) : undefined
    request.signal.throwIfAborted()
    await mapWork.showRemoteReference({ name: remoteItemTitle(item), raster, document, onFeature: value => { attributes.value = Object.entries(value).slice(0, 20); attributeLabel.value = "地图选中要素" }, onError: message => { if (!request.signal.aborted && !disposed) { loadError.value = message } } }, request.signal)
    request.signal.throwIfAborted()
    if (disposed || !props.active) { return }
    const bounds = raster?.bounds || remoteBounds(item.bbox)
    current.value = { item, asset, options, bounds }; vector.value = document || null
    if (document?.features[0]) { attributes.value = Object.entries(document.features[0].properties).slice(0, 20); attributeLabel.value = "首个要素" }
    longitude.value = (bounds.west + bounds.east) / 2; latitude.value = (bounds.south + bounds.north) / 2
    mapWork.flyToRemoteReference(bounds)
  } catch (error) { if (!request.signal.aborted && !disposed) { clearLoaded(); loadError.value = error instanceof Error ? error.message : "图层加载失败" } } finally { if (layerRequest === request) { loading.value = false } }
}
async function queryPoint() {
  const snapshot = current.value
  if (!snapshot || !props.active || !snapshot.asset.numeric || disposed) { return }
  pointRequest?.abort(); const request = new AbortController(); pointRequest = request
  pointResult.value = null; pointError.value = ""; pointBusy.value = true
  try {
    const result = await remotePoint(snapshot.item, snapshot.asset, snapshot.options.band, longitude.value, latitude.value, request.signal)
    if (!request.signal.aborted && !disposed && props.active && current.value === snapshot) { pointResult.value = result }
  } catch (error) { if (!request.signal.aborted && !disposed) { pointError.value = error instanceof Error ? error.message : "数值点查失败" } } finally { if (pointRequest === request) { pointBusy.value = false } }
}
function locate() { if (current.value) { mapWork.flyToRemoteReference(current.value.bounds) } }
function attributeText(value: unknown) { return (typeof value === "object" ? JSON.stringify(value) : String(value ?? "缺测")).slice(0, 500) }
onBeforeUnmount(() => { disposed = true; stopAll() })
</script>

<style scoped>
.remote-sources { margin: 12px 0; min-width: 0; color: var(--thematic-ink); border-top: 1px solid var(--thematic-line); border-bottom: 1px solid var(--thematic-line); font-size: 13px; }
summary { padding: 12px 0; cursor: pointer; color: var(--thematic-ink); font-weight: 600; }summary span { color: var(--thematic-muted); font-size: 12px; font-weight: 400; }
.remote-body { display: grid; gap: 10px; min-width: 0; padding-bottom: 14px; }.query-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: end; }
label { display: grid; gap: 6px; min-width: 0; color: var(--thematic-ink); }.check { display: flex; align-items: center; gap: 8px; }.check input { flex: 0 0 auto; margin: 0; accent-color: var(--thematic-primary); }
select, input[type="number"] { box-sizing: border-box; width: 100%; min-width: 0; min-height: 36px; padding: 6px 10px; color: var(--thematic-ink); background: var(--thematic-control); border: 1px solid var(--thematic-line); border-radius: 3px; font: inherit; color-scheme: var(--thematic-scheme); }option { color: var(--thematic-ink); background: var(--thematic-control); }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 6px 10px; color: #fff; background: var(--thematic-primary); border: 1px solid var(--thematic-primary); border-radius: 3px; font: inherit; cursor: pointer; }button.secondary { color: var(--thematic-ink); background: var(--thematic-control); border-color: var(--thematic-line); }button:disabled { color: var(--thematic-disabled-ink); background: var(--thematic-disabled-bg); border-color: var(--thematic-line); cursor: not-allowed; }
button:focus-visible, select:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid var(--thematic-accent); outline-offset: 2px; }.actions { display: flex; flex-wrap: wrap; gap: 8px; }.two-columns { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
p { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }.muted { color: var(--thematic-muted); }.notice { color: var(--thematic-warning); }.error { color: var(--thematic-danger); }.loaded { color: var(--thematic-success); }
dl { display: grid; grid-template-columns: 72px minmax(0,1fr); gap: 5px 8px; margin: 0; }dt { color: var(--thematic-muted); }dd { margin: 0; overflow-wrap: anywhere; }
.legend { display: grid; grid-template-columns: auto minmax(30px,1fr) auto; gap: 8px; align-items: center; }.legend i { height: 12px; background: linear-gradient(90deg,#440154,#3b528b,#21918c,#5ec962,#fde725); }.point-result { display: grid; gap: 4px; }.point-result span { color: var(--thematic-muted); font-size: 12px; }
.attribute-table { min-width: 0; max-height: 260px; overflow: auto; }table { width: 100%; border-collapse: collapse; table-layout: fixed; }caption { padding: 6px 0; color: var(--thematic-ink); text-align: left; }th, td { padding: 6px; text-align: left; vertical-align: top; overflow-wrap: anywhere; border-bottom: 1px solid var(--thematic-line); }th { width: 38%; color: var(--thematic-muted); font-weight: 500; }
</style>
