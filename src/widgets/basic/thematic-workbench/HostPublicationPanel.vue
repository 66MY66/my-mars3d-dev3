<template>
  <section class="result-map-release host-publication" aria-label="专题图发布">
    <header><strong>{{ formalMode ? '规范图件发布' : '人工审核与专题图发布' }}</strong><span>{{ layers.filter(layer => layer.enabled !== false && (layer.opacity ?? 1) > 0).length }} 层</span></header>
    <section v-if="!formalMode" class="manual-review" aria-label="当前地图人工审核">
      <header><strong>当前版本审核</strong><span :class="reviewReady ? 'success' : 'notice'">{{ reviewReady ? '本次版本已确认' : `${checked.length} / ${internalReviewChecks.length} 项已确认` }}</span></header>
      <p>用途：单位内部。保留原始坐标、来源与使用限制。</p>
      <p v-if="sourceBusy" role="status">地图数据正在处理</p>
      <ul v-if="technicalBlockers.length" class="error"><li v-for="issue in technicalBlockers" :key="issue">{{ issue }}</li></ul>
      <label>审核人<input v-model="reviewer" aria-label="内部发布审核人" autocomplete="name" :disabled="busy" /></label>
      <label>审核意见与使用限制<textarea v-model="reviewNotes" aria-label="内部发布审核意见" rows="3" :disabled="busy"></textarea></label>
      <label v-for="check in internalReviewChecks" :key="check.id" class="check"><input v-model="checked" :value="check.id" type="checkbox" :disabled="busy" />{{ check.label }}</label>
      <p v-if="!reviewReady" class="notice" role="status">{{ reviewPending }}</p>
      <div class="actions"><mars-button type="primary" :disabled="busy || sourceBusy" @click="approve"><mars-icon icon="check" :width="16" />确认本次审核</mars-button><mars-button :disabled="!reviewReady || busy" @click="downloadReview"><mars-icon icon="download" :width="16" />下载审核记录</mars-button></div>
      <p v-if="reviewReady" class="success" role="status">{{ review?.reviewer }} · {{ new Date(review!.reviewedAt).toLocaleString() }} · 已绑定当前图件版本</p>
      <p v-else-if="reviewChanged" class="notice" role="status">地图、排版或审核意见已变化，请重新确认本次审核。</p>
      <p v-if="reviewError" class="error" role="alert">{{ reviewError }}</p>
      <details v-if="sourceNotice"><summary>资料来源与使用限制</summary><p>{{ sourceNotice }}</p></details>
    </section>
    <div class="destination"><strong>发布目标</strong><span>{{ host?.name || '目标平台待对接' }}</span></div>
    <p v-if="host?.description" class="notice">{{ host.description }}</p>
    <p v-if="!host" class="notice" role="status">尚未连接目标平台，当前可交付发布包；未执行在线发布。</p>
    <p v-if="formalMode && !formalReady" class="notice">规范图件专项检查尚未通过</p>
    <p v-if="!ready" class="notice" role="status">{{ formalMode ? '发布待办：完成规范图件检查与人工复核' : '发布待办：确认本次人工审核' }}</p>
    <label v-if="host" class="check"><input v-model="confirmed" type="checkbox" :disabled="busy" />确认向“{{ host.name }}”提交当前版本</label>
    <div class="actions">
      <mars-button :disabled="busy || sourceBusy || !ready" :loading="busy" @click="downloadPackage"><mars-icon icon="download" :width="16" />下载发布包</mars-button>
      <mars-button type="primary" :disabled="busy || sourceBusy || !ready || !host || !confirmed || uncertain || (!!receipt && !stale)" :loading="busy" @click="submit"><mars-icon icon="upload" :width="16" />发布专题图</mars-button>
      <mars-button v-if="receipt || uncertain" :disabled="busy" @click="newVersion"><mars-icon icon="plus" :width="16" />开始新版本</mars-button>
    </div>
    <p v-if="message" role="status">{{ message }}</p><p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="uncertain" class="notice">提交状态未确认，请先在目标平台核对，勿重复提交。</p>
    <p v-if="receipt" class="receipt">{{ host?.name || '目标平台' }}编号：{{ receipt.publicationId }} · {{ receipt.status === 'published' ? (host?.storage === 'browser' ? '已保存到当前任务' : '目标平台已确认发布') : '已接收，尚未确认发布' }}</p>
    <p v-if="stale" class="notice">以上回执属于提交时版本，当前图件已有修改。</p>
    <a v-if="receipt?.url" :href="receipt.url" :target="host?.openPublished ? undefined : '_blank'" rel="noopener noreferrer" @click="openPublishedReceipt">{{ host?.storage === 'browser' ? '在当前任务中查看' : '查看发布成果' }}</a>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import type { DbtBounds, DbtLayer } from "./dbt116-standard"
import { standardBounds } from "./dbt116-standard"
import type { StandardPublicationBundle } from "./standard-publication"
import { internalReviewChecks, internalReviewSubject, internalMapBlockers, internalReviewProblems, confirmInternalReview, type InternalMapReview, type InternalReviewSource } from "./internal-map-review"
import { onlineLayerDescription } from "./online-layer-description"
import { downloadBlob } from "./export-media"
import { cartographyFingerprint } from "./cartography-fingerprint"
import { createPublicationPackage, validatePublicationSources, type PublicationView } from "./publication-package"
import { THEMATIC_PUBLICATION_HOST, publishToHost, type PublicationPackage, type PublicationReceipt } from "./publication-host"

const props = defineProps<{ title: string; topic: string; bounds: DbtBounds | null; layers: DbtLayer[]; formalReady: boolean; formalMode?: boolean; documentRevision?: number; presentationKey?: string; sourceBusy?: boolean; viewError?: string; prepareFormal?:() => Promise<StandardPublicationBundle>; prepareView?: () => Promise<PublicationView> }>()
const host = inject(THEMATIC_PUBLICATION_HOST, null)
const busy = ref(false); const confirmed = ref(false); const message = ref(""); const error = ref("")
const uncertain = ref(false); const receipt = shallowRef<PublicationReceipt | null>(null)
const reviewer = ref(""); const reviewNotes = ref(""); const checked = ref<string[]>([])
const review = shallowRef<InternalMapReview | null>(null); const sourceHash = ref(""); const reviewError = ref(""); const reviewChanged = ref(false)
const reviewSource = computed<InternalReviewSource>(() => ({ title: props.title, topic: props.topic, bounds: props.bounds, layers: props.layers, documentRevision: props.documentRevision, presentationKey: props.presentationKey }))
const technicalBlockers = computed(() => [...internalMapBlockers(reviewSource.value), ...(props.viewError ? [props.viewError] : [])])
const reviewReady = computed(() => !!review.value && !props.sourceBusy && !technicalBlockers.value.length && !internalReviewProblems(review.value, sourceHash.value).length)
const ready = computed(() => props.formalMode ? props.formalReady : reviewReady.value)
const reviewPending = computed(() => {
  const pending = [...technicalBlockers.value, ...(!reviewer.value.trim() ? ["填写审核人"] : []), ...(!reviewNotes.value.trim() ? ["填写审核意见"] : []), ...(checked.value.length !== internalReviewChecks.length ? [`完成 ${internalReviewChecks.length - checked.value.length} 项确认`] : [])]
  return pending.length ? `审核待办：${pending.join("；")}` : "审核内容已填写，可确认本次版本。"
})
const sourceNotice = computed(() => props.layers.length ? onlineLayerDescription(props.layers) : "")
const sourceKey = computed(() => JSON.stringify({ source: internalReviewSubject(reviewSource.value), formal: props.formalMode, ready: props.formalReady }))
const reviewFormKey = computed(() => JSON.stringify({ reviewer: reviewer.value, notes: reviewNotes.value, checked: checked.value }))
const submissionKey = computed(() => `${sourceKey.value}:${props.formalMode ? "formal" : review.value?.reviewedAt || "pending"}`)
const submittedKey = ref("")
const stale = computed(() => !!submittedKey.value && submittedKey.value !== submissionKey.value)
let controller: AbortController | undefined; let disposed = false; let hashRevision = 0
let cached: { key: string; value: PublicationPackage } | undefined
watch(sourceKey, async () => {
  const version = ++hashRevision
  if (review.value) { reviewChanged.value = true }
  review.value = null; checked.value = []; sourceHash.value = ""; confirmed.value = false; cached = undefined
  try { const hash = await cartographyFingerprint(internalReviewSubject(reviewSource.value)); if (!disposed && version === hashRevision) { sourceHash.value = hash } } catch (err) { if (!disposed && version === hashRevision) { reviewError.value = err instanceof Error ? err.message : "图件版本计算失败" } }
}, { immediate: true, flush: "sync" })
watch([reviewer, reviewNotes, checked], () => { if (review.value) { review.value = null; reviewChanged.value = true; confirmed.value = false; cached = undefined } }, { deep: true, flush: "sync" })
async function approve() {
  reviewError.value = ""; const key = sourceKey.value; const formKey = reviewFormKey.value
  try {
    if (busy.value || props.sourceBusy) { throw new Error("图层仍在处理，请完成后审核") }
    if (technicalBlockers.value.length) { throw new Error(technicalBlockers.value.join("；")) }
    const record = await confirmInternalReview(reviewSource.value, reviewer.value, reviewNotes.value, checked.value)
    if (disposed || key !== sourceKey.value || formKey !== reviewFormKey.value || props.sourceBusy) { throw new Error("地图或审核内容已变化，请重新审核") }
    review.value = record; reviewChanged.value = false; confirmed.value = false
  } catch (err) { reviewError.value = err instanceof Error ? err.message : "审核未完成" }
}
function downloadReview() { if (reviewReady.value) { downloadBlob(new Blob([JSON.stringify({ title: props.title, topic: props.topic, bounds: props.bounds, review: review.value }, null, 2)], { type: "application/json" }), "专题地图-内部人工审核.json") } }
async function perform(action: (signal: AbortSignal) => Promise<void>) {
  if (busy.value) { return }
  busy.value = true; error.value = ""; controller = new AbortController(); const request = controller
  const timer = setTimeout(() => request.abort(), 90000)
  try { await action(request.signal) } catch (err) { if (!disposed) { const detail = err instanceof Error ? err.message : "发布未完成"; error.value = request.signal.aborted ? "发布操作已取消或超时，请核对目标平台状态" : detail } } finally { clearTimeout(timer); if (!disposed) { busy.value = false } }
}
async function prepare(signal: AbortSignal) {
  const key = submissionKey.value
  const assertCurrent = () => { signal.throwIfAborted(); if (disposed || key !== submissionKey.value || props.sourceBusy || !ready.value) { throw new Error("当前图件或审核已变化，已停止提交") } }
  assertCurrent()
  if (cached?.key === key) { await validatePublicationSources(reviewSource.value, signal); assertCurrent(); return cached.value }
  let source = JSON.parse(JSON.stringify(reviewSource.value)) as InternalReviewSource
  let value: PublicationPackage
  if (props.formalMode) {
    if (!props.prepareFormal) { throw new Error("正式图件尚未提供本次复核数据") }
    const formal = await props.prepareFormal(); await nextTick(); assertCurrent()
    const bounds = standardBounds(formal.document, formal.templateId)
    if (!bounds) { throw new Error("正式图件缺少规范图幅") }
    source = { title: formal.title, topic: formal.templateId, bounds, layers: formal.document.layers, documentRevision: formal.revision, presentationKey: props.presentationKey }
    value = await createPublicationPackage(source, { formal }, signal)
  } else {
    if (!props.prepareView) { throw new Error("请先完成当前图件排版") }
    const view = await props.prepareView(); assertCurrent()
    value = await createPublicationPackage(source, { review: review.value!, view }, signal)
  }
  assertCurrent(); cached = { key, value }; return value
}
function downloadPackage() { return perform(async signal => { message.value = "正在生成发布包"; const value = await prepare(signal); downloadBlob(value.file, value.file.name); message.value = "发布包已下载，尚未提交目标平台。" }) }
async function submit() {
 let published: PublicationReceipt | undefined
 await perform(async signal => {
  if (!host || !confirmed.value || uncertain.value || (receipt.value && !stale.value)) { throw new Error("请连接目标平台并确认当前版本，勿重复提交") }
  const key = submissionKey.value; const value = await prepare(signal)
  if (key !== submissionKey.value || !ready.value) { throw new Error("当前图件或审核已变化，已停止提交") }
  submittedKey.value = key; uncertain.value = true; message.value = "正在向目标平台提交专题图"
  const result = await publishToHost(host, value, signal)
  if (disposed) { return }
  receipt.value = result; uncertain.value = false; confirmed.value = false
  if (result.status === "published") {
    message.value = host.storage === "browser" ? "专题图已发布到当前任务，保存在当前浏览器。" : "目标平台已确认本次专题图发布。"
    published = result
  } else {
    message.value = "目标平台已接收本次专题图，尚未确认发布完成。"
  }
 })
 if (published && !disposed) { showPublished(published) }
}
function showPublished(result: PublicationReceipt) {
  try { host?.openPublished?.(result) } catch (err) {
    error.value = `专题图已保存，但未能打开当前任务：${err instanceof Error ? err.message : "请点击成果链接重试"}`
  }
}
function openPublishedReceipt(event: MouseEvent) {
  if (host?.openPublished && receipt.value) { event.preventDefault(); showPublished(receipt.value) }
}
function newVersion() {
  if (!window.confirm("请先在目标平台核对上次提交状态。确认开始一个新版本？")) { return }
  cached = undefined; receipt.value = null; uncertain.value = false; submittedKey.value = ""; confirmed.value = false; message.value = ""; error.value = ""
}
onBeforeUnmount(() => { disposed = true; controller?.abort() })
</script>

<style scoped>
.host-publication { display: grid; gap: 12px; min-width: 0; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--thematic-line); color: var(--thematic-ink); }
header,.actions,.destination { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
label { display: grid; gap: 6px; min-width: 0; }input:not([type=checkbox]),textarea { width: 100%; min-width: 0; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--thematic-line); border-radius: 3px; color: var(--thematic-ink); background: var(--thematic-control); font: inherit; }
.manual-review { display: grid; gap: 12px; border-block: 1px solid var(--thematic-line); padding: 14px 0; }.manual-review label { font-size: 14px; line-height: 1.6; }.manual-review .check { padding-block: 3px; }.manual-review ul { margin: 0; padding-left: 20px; }.manual-review textarea { resize: vertical; }
input:focus-visible,textarea:focus-visible { outline: 2px solid var(--thematic-accent); outline-offset: 2px; }.check { display: flex; align-items: flex-start; gap: 8px; }.check input { flex: none; margin-top: 4px; }
p { margin: 0; font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }.receipt,.destination span { color: var(--thematic-muted); }.destination { border-bottom: 1px solid var(--thematic-line); padding-block: 8px; }
.error { color: var(--thematic-danger); }.notice { color: var(--thematic-warning); }.success { color: var(--thematic-success); }a { color: var(--thematic-accent); overflow-wrap: anywhere; }details { border-top: 1px solid var(--thematic-line); padding-top: 10px; }summary { cursor: pointer; }
</style>
