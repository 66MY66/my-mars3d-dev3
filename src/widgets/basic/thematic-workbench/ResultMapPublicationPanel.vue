<template>
  <section class="result-map-release" aria-label="Windmill 在线地图发布">
    <header><strong>{{ formalMode ? '规范应急图件发布' : '人工审核与内部发布' }}</strong><span>{{ layers.filter(layer => layer.enabled !== false && (layer.opacity ?? 1) > 0).length }} 层</span></header>
    <section v-if="!formalMode" class="manual-review" aria-label="当前地图人工审核">
      <div class="review-heading"><strong>当前版本审核</strong><span :class="reviewReady ? 'success' : 'notice'">{{ reviewReady ? '本次版本已确认' : `${checked.length} / ${internalReviewChecks.length} 项已确认` }}</span></div>
      <p>发布范围：单位内部。保留原始坐标、来源和使用限制，不声明为行业规范正式应急图件。</p>
      <p v-if="sourceBusy" role="status">正在加载地图数据，完成后可确认本次审核。</p>
      <ul v-if="technicalBlockers.length" class="error"><li v-for="issue in technicalBlockers" :key="issue">{{ issue }}</li></ul>
      <label>审核人<input v-model="reviewer" aria-label="内部发布审核人" autocomplete="name" :disabled="busy" /></label>
      <label>审核意见与使用限制<textarea v-model="reviewNotes" aria-label="内部发布审核意见" rows="3" :disabled="busy"></textarea></label>
      <label v-for="check in internalReviewChecks" :key="check.id" class="check"><input v-model="checked" :value="check.id" type="checkbox" :disabled="busy" />{{ check.label }}</label>
      <p v-if="!reviewReady" class="notice" role="status">{{ reviewPending }}</p>
      <div class="actions"><mars-button type="primary" :disabled="busy || sourceBusy" @click="approve"><mars-icon icon="check" :width="16" />确认本次审核</mars-button><mars-button :disabled="!reviewReady || busy" @click="downloadReview"><mars-icon icon="download" :width="16" />下载审核记录</mars-button></div>
      <p v-if="reviewReady" class="success" role="status">{{ review?.reviewer }} · {{ new Date(review!.reviewedAt).toLocaleString() }} · 已绑定当前范围、图层与样式</p>
      <p v-else-if="reviewChanged" class="notice" role="status">地图内容或审核意见已变化，请重新确认本次审核。</p>
      <p v-if="reviewError" class="error" role="alert">{{ reviewError }}</p>
      <details v-if="sourceNotice"><summary>资料来源与使用限制</summary><p>{{ sourceNotice }}</p></details>
    </section>
    <form v-if="!authorized" @submit.prevent="authorize">
      <label>Windmill 账号<input v-model="email" type="email" autocomplete="username" :disabled="busy" /></label>
      <label>密码<input v-model="password" type="password" autocomplete="current-password" :disabled="busy" /></label>
      <mars-button html-type="submit" :disabled="busy" :loading="busy"><mars-icon icon="link" :width="16" />连接汇交服务</mars-button>
    </form>
    <div v-else class="actions"><span class="success">汇交服务已授权</span><mars-button :disabled="busy" @click="disconnect">退出授权</mars-button></div>
    <p v-if="formalMode && !formalReady" class="notice">规范应急图件的专项检查尚未通过；可返回单位内部用途完成当前地图人工审核。</p>
    <label class="check"><input v-model="confirmed" type="checkbox" :disabled="busy || !!jobId || uncertain" />确认以新编号汇交当前图层，不覆盖已有成果</label>
    <p v-if="!jobId && !busy" class="notice" role="status">{{ publicationPending }}</p>
    <div class="actions">
      <mars-button type="primary" :disabled="busy || sourceBusy || !authorized || !confirmed || !bounds || !layers.length || !!jobId || uncertain || (formalMode ? !formalReady : !reviewReady)" :loading="busy" @click="submit"><mars-icon icon="upload" :width="16" />{{ formalMode ? '汇交规范图层' : '发布内部审核地图' }}</mars-button>
      <mars-button v-if="jobId" :disabled="busy || !authorized" @click="refresh"><mars-icon icon="refresh" :width="16" />查询并校验成果</mars-button>
      <mars-button v-if="verified" :disabled="busy || !apply" @click="reopen"><mars-icon icon="layers" :width="16" />从后台重新加载</mars-button>
      <mars-button v-if="jobFinished" :disabled="busy" @click="newVersion"><mars-icon icon="plus" :width="16" />开始新版本</mars-button>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="jobId" class="receipt">任务：{{ jobId }}</p>
    <p v-if="rootId" class="receipt">地图成果：{{ rootId }}</p>
    <p v-if="stale" class="notice">当前操作内容已变化；以上任务属于提交时版本。</p>
    <a v-if="verified" :href="verified.catalogUrl" target="_blank" rel="noopener noreferrer">查看 STAC 成果</a>
    <details v-if="verified?.snapshot.internalReview"><summary>已发布版本的审核记录（只读）</summary><p>{{ verified.snapshot.internalReview.reviewer }} · {{ new Date(verified.snapshot.internalReview.reviewedAt).toLocaleString() }}</p><p>{{ verified.snapshot.internalReview.notes }}</p><p>此记录仅属于该已发布版本，不代替当前地图的审核。</p><mars-button :disabled="busy" @click="downloadPublishedReview"><mars-icon icon="download" :width="16" />下载已发布审核记录</mars-button></details>
    <details><summary>恢复已汇交的地图</summary><label>地图成果编号<input v-model="restoreId" :disabled="busy" placeholder="MAP-…-1" /></label><mars-button :disabled="busy || !restoreId.trim() || !apply" @click="restore"><mars-icon icon="history" :width="16" />读取并加载</mars-button></details>
    <details v-if="uncertain"><summary>提交回执核对</summary><label>Windmill 任务编号<input v-model="recoverJobId" :disabled="busy" /></label><mars-button :disabled="busy || !authorized || !recoverJobId.trim()" @click="recover">查询已有任务</mars-button></details>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import { loginThematicFlow, getThematicFlow } from "./thematic-backend"
import { prepareResultMap, submitResultMap, queryResultMap, loadPublishedMap, mapRootId, mapPublicationHash, type PreparedMapPublication, type VerifiedPublishedMap } from "./result-map-publication"
import type { DbtBounds, DbtLayer } from "./dbt116-standard"
import { standardBounds } from "./dbt116-standard"
import type { StandardPublicationBundle } from "./standard-publication"
import { internalReviewChecks, internalReviewSubject, internalMapBlockers, internalReviewProblems, confirmInternalReview, type InternalMapReview } from "./internal-map-review"
import { onlineLayerDescription } from "./online-layer-description"
import { downloadBlob } from "./export-media"

const props = defineProps<{ title: string; topic: string; bounds: DbtBounds | null; layers: DbtLayer[]; formalReady: boolean; formalMode?: boolean; documentRevision?: number; sourceBusy?: boolean; viewError?: string; apply?:(map: VerifiedPublishedMap) => Promise<void>; prepareFormal?: () => Promise<StandardPublicationBundle> }>()
const email = ref(""); const password = ref(""); const authorized = ref(false)
const busy = ref(false); const confirmed = ref(false); const message = ref(""); const error = ref("")
const jobId = ref(""); const restoreId = ref(""); const recoverJobId = ref(""); const uncertain = ref(false)
const jobFinished = ref(false)
const prepared = shallowRef<PreparedMapPublication | null>(null); const verified = shallowRef<VerifiedPublishedMap | null>(null)
const reviewer = ref(""); const reviewNotes = ref(""); const checked = ref<string[]>([])
const review = shallowRef<InternalMapReview | null>(null); const sourceHash = ref(""); const reviewError = ref(""); const reviewChanged = ref(false)
const reviewSource = computed(() => ({ title: props.title, topic: props.topic, bounds: props.bounds, layers: props.layers, documentRevision: props.documentRevision }))
const technicalBlockers = computed(() => [...internalMapBlockers(reviewSource.value), ...(props.viewError ? [props.viewError] : [])])
const reviewReady = computed(() => !!review.value && !props.sourceBusy && !technicalBlockers.value.length && !internalReviewProblems(review.value, sourceHash.value).length)
const reviewPending = computed(() => {
  const pending = [...technicalBlockers.value, ...(!reviewer.value.trim() ? ["填写审核人"] : []), ...(!reviewNotes.value.trim() ? ["填写审核意见"] : []), ...(checked.value.length !== internalReviewChecks.length ? [`完成 ${internalReviewChecks.length - checked.value.length} 项确认`] : [])]
  return pending.length ? `审核待办：${pending.join("；")}` : "审核内容已填写，可确认本次版本。"
})
const publicationPending = computed(() => {
  const pending = [...(!authorized.value ? ["连接汇交服务"] : []), ...(!confirmed.value ? ["确认新编号汇交"] : [])]
  if (props.formalMode && !props.formalReady) { pending.splice(1, 0, "完成规范应急图件专项检查") }
  if (!props.formalMode && !reviewReady.value) { pending.splice(authorized.value ? 0 : 1, 0, "确认本次人工审核") }
  return pending.length ? `发布待办：${pending.join("；")}` : "当前版本可提交汇交。"
})
const sourceNotice = computed(() => props.layers.length ? onlineLayerDescription(props.layers) : "")
const sourceKey = computed(() => JSON.stringify({ source: internalReviewSubject(reviewSource.value), formal: props.formalMode, ready: props.formalReady }))
const reviewFormKey = computed(() => JSON.stringify({ reviewer: reviewer.value, notes: reviewNotes.value, checked: checked.value }))
const submissionKey = computed(() => `${sourceKey.value}:${props.formalMode ? "formal" : review.value?.reviewedAt || "pending"}`)
const submittedKey = ref("")
const stale = computed(() => !!submittedKey.value && submittedKey.value !== submissionKey.value)
const rootId = computed(() => prepared.value ? mapRootId(prepared.value.snapshot) : "")
let token = ""; let controller: AbortController | undefined; let disposed = false
const receiptKey = "thematic-result-flow-receipt-v1"
function saveReceipt() {
  // Only configuration and receipts are retained, never credentials or business file bytes.
  try { sessionStorage.setItem(receiptKey, JSON.stringify({ prepared: prepared.value, jobId: jobId.value, submittedKey: submittedKey.value, uncertain: uncertain.value })) } catch { /* A receipt remains visible even when storage is unavailable. */ }
}
try {
  const saved = JSON.parse(sessionStorage.getItem(receiptKey) || "null")
  if (saved?.prepared?.fingerprint && saved.prepared.snapshot?.version === "mars3d.map-view.v1") { prepared.value = saved.prepared; jobId.value = saved.jobId || ""; submittedKey.value = saved.submittedKey || ""; uncertain.value = !!saved.uncertain; message.value = "已恢复提交记录，需重新授权并读取后台状态。" }
} catch { /* Invalid local receipts cannot establish publication status. */ }
let hashRevision = 0
watch(sourceKey, async () => {
  const version = ++hashRevision
  if (review.value) { reviewChanged.value = true }
  review.value = null; checked.value = []; sourceHash.value = ""; confirmed.value = false; verified.value = null
  try {
    const hash = await mapPublicationHash(internalReviewSubject(reviewSource.value))
    if (!disposed && version === hashRevision) { sourceHash.value = hash }
  } catch (error) { if (!disposed && version === hashRevision) { reviewError.value = error instanceof Error ? error.message : "地图版本指纹计算失败，请重新加载" } }
}, { immediate: true, flush: "sync" })
watch([reviewer, reviewNotes, checked], () => { if (review.value) { review.value = null; reviewChanged.value = true; confirmed.value = false } }, { deep: true, flush: "sync" })
async function approve() {
  reviewError.value = ""
  const key = sourceKey.value
  const formKey = reviewFormKey.value
  try {
    if (busy.value || props.sourceBusy) { throw new Error("图层仍在处理，请完成后审核") }
    if (technicalBlockers.value.length) { throw new Error(technicalBlockers.value.join("；")) }
    const record = await confirmInternalReview(reviewSource.value, reviewer.value, reviewNotes.value, checked.value)
    if (disposed || key !== sourceKey.value || formKey !== reviewFormKey.value || props.sourceBusy) { throw new Error("地图或审核内容已变化，请重新审核") }
    review.value = record; reviewChanged.value = false; confirmed.value = false
  } catch (error) { reviewError.value = error instanceof Error ? error.message : "审核未完成" }
}
function downloadReview() {
  if (!reviewReady.value) { return }
  downloadBlob(new Blob([JSON.stringify({ title: props.title, topic: props.topic, bounds: props.bounds, review: review.value }, null, 2)], { type: "application/json" }), "专题地图-内部人工审核.json")
}
function downloadPublishedReview() {
  const snapshot = verified.value?.snapshot
  if (!snapshot?.internalReview) { return }
  downloadBlob(new Blob([JSON.stringify({ id: snapshot.id, title: snapshot.title, topic: snapshot.topic, bounds: snapshot.bounds, review: snapshot.internalReview }, null, 2)], { type: "application/json" }), "专题地图-已发布版本审核.json")
}
watch(() => props.viewError, value => { if (value) { verified.value = null; message.value = "地图加载失败，不能确认在线可用。"; error.value = value } })
async function perform(action: (signal: AbortSignal) => Promise<void>) {
  if (busy.value) { return }
  busy.value = true; error.value = ""; controller = new AbortController()
  try { await action(controller.signal) } catch (err) { if (!disposed) { error.value = err instanceof Error ? err.message : "发布未完成" } } finally { if (!disposed) { busy.value = false } }
}
function authorize() {
 return perform(async signal => {
  try {
    const value = (await loginThematicFlow(email.value, password.value, signal)).trim()
    await getThematicFlow(value, "result_flow", signal)
    if (!disposed) { token = value; authorized.value = true; message.value = "成果汇交流程已连接。" }
  } finally { password.value = "" }
})
}
function disconnect() { token = ""; password.value = ""; authorized.value = false }
function submit() {
 return perform(async signal => {
  if (!authorized.value || !confirmed.value || !props.bounds || props.sourceBusy || jobId.value || uncertain.value) { throw new Error("请确认范围、图层和授权后再提交") }
  if (props.formalMode ? !props.formalReady : !reviewReady.value) { throw new Error("请先完成当前用途的人工审核") }
  const key = submissionKey.value
  const assertCurrent = () => { signal.throwIfAborted(); if (disposed || key !== submissionKey.value || props.sourceBusy || (!props.formalMode && !reviewReady.value)) { throw new Error("当前图件或审核已变化，已停止提交") } }
  let data = { title: props.title, topic: props.topic, bounds: props.bounds, layers: props.layers, formal: false, internalReview: review.value || undefined, documentRevision: props.documentRevision } as Parameters<typeof prepareResultMap>[0]
  if (props.formalMode && props.formalReady) {
    if (!props.prepareFormal) { throw new Error("正式图件尚未提供本次复核数据") }
    const bundle = await props.prepareFormal()
    await nextTick()
    assertCurrent()
    if (!bundle.review.formalExportEnabled || bundle.document.usage !== "operational") { throw new Error("本次图件尚未通过正式复核") }
    const bounds = standardBounds(bundle.document, bundle.templateId)
    if (!bounds) { throw new Error("本次正式图件缺少规范图幅") }
    data = { title: bundle.title, topic: bundle.templateId, bounds, layers: bundle.document.layers, formal: true, formalReview: { code: bundle.code, revision: bundle.revision, dataSha256: bundle.review.dataSha256 } }
  }
  const input = await prepareResultMap(data, signal)
  assertCurrent()
  const count = input.snapshot.layers.reduce((n, layer) => n + layer.parts.length, 0)
  if (!window.confirm(`将通过 Windmill 新建 ${count} 个 MinIO/STAC 成果，可能复制及处理完整源文件。${props.formalMode ? "" : "本次为已人工审核的单位内部地图，不改变源数据权限。"}确认提交？`)) { return }
  assertCurrent(); prepared.value = input; submittedKey.value = key; jobFinished.value = false
  message.value = "正在提交成果汇交流程，尚未确认发布。"
  try {
    jobId.value = await submitResultMap(token, input, assertCurrent, signal, () => { uncertain.value = true; saveReceipt() })
    uncertain.value = false; confirmed.value = false; saveReceipt()
    message.value = "后台已接收任务；须查询目录、实际文件与地图瓦片后才能确认可用。"
  } catch (err) { saveReceipt(); message.value = uncertain.value ? "提交结果未确认；请核对任务编号，勿重复提交。" : "前置检查未通过，未提交汇交任务。"; throw err }
})
}
function refresh() {
 return perform(async signal => {
  if (!prepared.value || !authorized.value) { throw new Error("请重新授权后查询提交记录") }
  verified.value = null
  let result: Awaited<ReturnType<typeof queryResultMap>>
  try { result = await queryResultMap(token, jobId.value, prepared.value, signal) } catch (error) {
    if (error && typeof error === "object" && "jobCompleted" in error && error.jobCompleted === true) { jobFinished.value = true; message.value = "后台任务已结束，但地图校验未通过；可重查原成果或明确新建版本。" }
    throw error
  }
  if (disposed) { return }
  if (result.state === "running") { message.value = "后台正在处理，尚未发布完成。"; return }
  if (result.state === "failed") { jobFinished.value = true; message.value = "汇交流程失败，未确认地图发布。"; return }
  jobFinished.value = true
  verified.value = result.map
  message.value = `${result.map!.snapshot.usage === "internal-proof" ? "历史校样" : "在线图层"}的 STAC、MinIO 和实际地图数据已校验；尚需重新加载查看。`
})
}
function recover() { jobId.value = recoverJobId.value.trim(); uncertain.value = false; saveReceipt(); return refresh() }
function newVersion() {
  if (!jobFinished.value || !window.confirm("保留后台已有成果，开始一个新的发布版本？")) { return }
  prepared.value = null; verified.value = null; jobId.value = ""; uncertain.value = false; jobFinished.value = false; confirmed.value = false; submittedKey.value = ""; message.value = ""; error.value = ""; saveReceipt()
}
function reopen() {
 return perform(async signal => {
  const id = verified.value ? mapRootId(verified.value.snapshot) : ""
  const hash = verified.value?.fingerprint
  verified.value = null
  if (!id || !props.apply) { throw new Error("没有可重新加载的地图") }
  const map = await loadPublishedMap(id, hash, signal)
  await props.apply(map)
  if (disposed) { return }
  verified.value = map
  message.value = map.snapshot.usage === "internal-proof" ? "历史在线校样已从后台重新读取并在 Mars3D 加载；尚无本次人工审核。" : "在线地图已从后台重新读取并在 Mars3D 加载；审核记录随地图保存，文件成果入库状态单独核验。"
})
}
function restore() {
 return perform(async signal => {
  verified.value = null
  if (!props.apply) { throw new Error("地图未就绪") }
  const map = await loadPublishedMap(restoreId.value.trim(), undefined, signal)
  await props.apply(map)
  if (!disposed) { verified.value = map; message.value = `${map.snapshot.title} · ${map.snapshot.usage === "internal-proof" ? "内部校样" : "业务图层"}已从后台加载。` }
})
}
onBeforeUnmount(() => { disposed = true; controller?.abort(); token = ""; password.value = "" })
</script>

<style scoped>
.result-map-release { display: grid; gap: 12px; min-width: 0; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--thematic-line); color: var(--thematic-ink); }
header, .actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
form { display: grid; gap: 12px; } label { display: grid; gap: 6px; min-width: 0; }
input:not([type=checkbox]), textarea { width: 100%; min-width: 0; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--thematic-line); border-radius: 3px; color: var(--thematic-ink); background: var(--thematic-control); font: inherit; }
.manual-review { display: grid; gap: 12px; border-block: 1px solid var(--thematic-line); padding: 14px 0; }
.review-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.manual-review label { font-size: 14px; line-height: 1.6; }.manual-review .check { padding-block: 3px; }
.manual-review ul { margin: 0; padding-left: 20px; }.manual-review textarea { resize: vertical; }
.manual-review p { color: var(--thematic-muted); }.manual-review p.success { color: var(--thematic-success); }.manual-review p.error { color: var(--thematic-danger); }
.manual-review input:focus-visible,.manual-review textarea:focus-visible { outline: 2px solid var(--thematic-accent); outline-offset: 2px; }
.check { display: flex; align-items: flex-start; gap: 8px; } .check input { flex: none; margin-top: 4px; }
p { margin: 0; font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; } .receipt { color: var(--thematic-muted); }
.error { color: var(--thematic-danger); }.notice { color: var(--thematic-warning); }.success { color: var(--thematic-success); }
a { color: var(--thematic-accent); overflow-wrap: anywhere; } details { border-top: 1px solid var(--thematic-line); padding-top: 10px; } summary { cursor: pointer; } details label { margin-block: 10px; }
</style>
