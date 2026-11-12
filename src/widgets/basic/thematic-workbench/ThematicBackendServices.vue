<template>
  <details class="backend-services" @toggle="openServices">
    <summary>高级服务 · 数据生产与诊断</summary>
    <section aria-label="专题后端连接">
      <div class="actions"><button type="button" :disabled="busy || !active" @click="check"><mars-icon icon="refresh" :width="16" />检查服务连接</button><a href="http://192.168.10.15:5954/" target="_blank" rel="noopener noreferrer">数据目录</a></div>
      <dl v-if="services.length" class="service-list"><template v-for="service in services" :key="service.name"><dt>{{ service.name }}</dt><dd :class="service.ok ? 'success' : 'error'">{{ service.ok ? '可达' : '未连接' }} · {{ service.detail }}</dd></template></dl>
      <div v-if="surfaces.length" class="asset-links"><a v-for="surface in surfaces" :key="surface.href" :href="surface.href" target="_blank" rel="noopener noreferrer">{{ surface.name }} · 后端三维页</a></div>
      <button v-if="cogItem" type="button" :disabled="busy || !active" @click="checkCog"><mars-icon icon="check" :width="16" />验证当前数值资产 COG 接口</button>
      <p v-if="cogStatus" role="status">{{ cogStatus }}</p>
      <h4>Windmill · earth-data</h4>
      <template v-if="!token">
        <label>账号<input v-model="email" autocomplete="username" aria-label="Windmill账号" :disabled="busy" /></label>
        <label>密码<input v-model="password" type="password" autocomplete="current-password" aria-label="Windmill密码" :disabled="busy" /></label>
        <div class="actions"><button type="button" :disabled="busy || !active || !email || !password" @click="login"><mars-icon icon="user" :width="16" />登录 Windmill</button></div>
        <label>访问令牌<input v-model="tokenInput" type="password" autocomplete="off" aria-label="Windmill访问令牌" :disabled="busy" /></label>
        <button type="button" :disabled="busy || !active || !tokenInput" @click="authorize"><mars-icon icon="key" :width="16" />验证令牌</button>
      </template>
      <template v-else>
        <div class="actions"><strong class="success">已授权 · 本次页面会话</strong><button type="button" :disabled="busy" @click="disconnect"><mars-icon icon="close" :width="16" />断开授权</button></div>
        <ul class="flow-status"><li v-for="entry in definitions.filter(item => item.id !== 'result_flow')" :key="entry.id"><strong>{{ flowName(entry.id) }}</strong><span :class="entry.error ? 'error' : 'success'">{{ entry.error || '已读取定义 · 执行权限由后台校验' }}</span></li></ul>
        <label>后台流程<select v-model="flowId" aria-label="Windmill流程" :disabled="busy"><option v-for="flow in thematicFlows.filter(item => item.id !== 'result_flow')" :key="flow.id" :value="flow.id">{{ flow.name }}</option></select></label>
        <p v-if="definition" class="muted">{{ definition.summary }}</p>
        <button v-if="formSchema?.properties?.bbox && bounds" type="button" :disabled="busy" @click="useBounds"><mars-icon icon="rectangle-one" :width="16" />使用当前框选范围</button>
        <FlowParameterFields v-if="formSchema" v-model="formValue" :schema="formSchema" :disabled="busy" />
        <details><summary>高级任务参数 JSON</summary><label>任务参数<textarea v-model="parameters" rows="7" spellcheck="false" aria-label="Windmill任务参数" :disabled="busy"></textarea></label></details>
        <ul v-if="parameterErrors.length" class="error" aria-label="任务参数检查"><li v-for="entry in parameterErrors" :key="entry">{{ entry }}</li></ul>
        <details v-if="definition?.schema"><summary>后台参数契约</summary><pre>{{ JSON.stringify(definition.schema, null, 2) }}</pre></details>
        <label v-if="writes" class="check"><input v-model="writeConfirmed" type="checkbox" :disabled="busy" aria-label="确认后台写入" />确认生产、写库或成果变更；不是发布当前排版图件</label>
        <p v-if="flowId === 'background_flow'" class="warning">此流程会清除同类型、同网格尺度的旧统计，并重写当天背景文件。历史样本不足时可能使用同景空间背景，不能直接当作 LST 历史基线。</p>
        <p v-if="flowId === 'grid_layer_flow'" class="warning">此流程会更新现有全国人口或 GDP 编目；填写新图层名也不能隔离现有目录记录。</p>
        <p v-if="flowId === 'grid_layer_flow' && formValue.coverage === 'event'" class="warning">事件范围参数由后台处理；若后台输出说明含示意烈度，其原始说明随成果保留，不自动认定为调查烈度。</p>
        <label v-if="submissionUnknown" class="check warning"><input type="checkbox" aria-label="确认后台未生成重复任务" @change="submissionUnknown = !($event.target as HTMLInputElement).checked" />已在后台核对：上次提交未生成任务，允许重新提交</label>
        <div class="actions"><button type="button" :disabled="busy || !active || !definition?.schema || parameterErrors.length > 0 || submissionUnknown || (writes && !writeConfirmed)" @click="submit"><mars-icon icon="play" :width="16" />提交后台任务</button><button type="button" :disabled="busy || !active || !jobId" @click="refreshJob"><mars-icon icon="refresh" :width="16" />检查任务状态</button></div>
        <label class="check"><input v-model="autoRefresh" type="checkbox" aria-label="自动跟踪后台任务" />自动跟踪任务状态</label>
        <label>后台任务号<input v-model="jobId" aria-label="Windmill任务号" :disabled="busy" /></label>
        <div v-if="receipts.length" class="actions"><button type="button" :disabled="busy" @click="downloadReceipts"><mars-icon icon="download" :width="16" />下载任务回执</button><select aria-label="本次会话任务" :disabled="busy" @change="jobId = ($event.target as HTMLSelectElement).value"><option value="">本次会话任务</option><option v-for="receipt in receipts" :key="receipt.id" :value="receipt.id">{{ flowName(receipt.flow) }} · {{ receipt.id }}</option></select></div>
        <p v-if="jobState" role="status">{{ jobState }}</p>
        <button v-if="resultAvailable && bounds" type="button" :disabled="busy" @click="emit('refresh-results')"><mars-icon icon="layers" :width="16" />返回制图并刷新图层</button>
        <details v-if="jobResult !== null" open><summary>后台任务返回结果</summary><pre>{{ JSON.stringify(jobResult, null, 2) }}</pre></details>
      </template>
      <h4>后台成果目录</h4>
      <label>成果数据集<select v-model="resultCollection" aria-label="后台成果类别" :disabled="busy"><option v-for="entry in resultCollections" :key="entry.id" :value="entry.id">{{ entry.name }}</option></select></label>
      <p v-if="collectionsError" class="error" role="alert">{{ collectionsError }}</p>
      <button type="button" :disabled="busy || !active" @click="queryResults"><mars-icon icon="search" :width="16" />查询后台成果</button>
      <button v-if="resultToken" type="button" :disabled="busy || !active" @click="moreResults"><mars-icon icon="more" :width="16" />继续读取后台成果</button>
      <template v-if="resultItems.length">
        <label>成果条目<select v-model="resultId" aria-label="后台成果条目" :disabled="busy"><option v-for="item in resultItems" :key="item.id" :value="item.id">{{ item.properties.title || item.id }}</option></select></label>
        <p v-if="resultItem" class="warning">{{ resultNotice }} 不自动替代当前图件的正式业务数据。</p>
        <div class="asset-links"><a v-for="asset in resultAssets" :key="asset.key" :href="asset.href" target="_blank" rel="noopener noreferrer">{{ asset.name }}</a></div>
        <button v-if="jsonAsset" type="button" :disabled="busy" @click="readResult"><mars-icon icon="notes" :width="16" />读取成果原始 JSON</button>
        <details v-if="resultJson !== null" open><summary>后台成果原始内容</summary><pre>{{ JSON.stringify(resultJson, null, 2) }}</pre></details>
      </template>
      <p v-if="resultMessage" role="status">{{ resultMessage }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </section>
  </details>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import type { RectInfo } from "./map"
import type { RemoteItem } from "./remote-cartography-source"
import { listRemoteCollections } from "./remote-cartography-source"
import { thematicFlows, flowWrites, type ThematicFlowId } from "./thematic-services"
import { loginThematicFlow, inspectThematicFlows, runThematicFlow, getThematicJob, checkThematicServices, queryBackendResults, readBackendResult, backendAssetUrl, checkCogAsset } from "./thematic-backend"
import FlowParameterFields from "./FlowParameterFields.vue"
import { structuredFlowSchema, validateFlowParameters } from "./flow-parameters"
import { downloadBlob } from "./export-media"
import { flowOutcome } from "./flow-outcome"

const props = defineProps<{ active: boolean; bounds: RectInfo | null; items: RemoteItem[] }>()
const emit = defineEmits<{ "refresh-results": [] }>()
const busy = ref(false); const error = ref(""); const token = ref(""); const tokenInput = ref(""); const email = ref(""); const password = ref("")
const services = shallowRef<Awaited<ReturnType<typeof checkThematicServices>>>([])
const definitions = shallowRef<Awaited<ReturnType<typeof inspectThematicFlows>>>([])
const flowId = ref<ThematicFlowId>("search_flow"); const parameters = ref(""); const writeConfirmed = ref(false)
const jobId = ref(""); const jobState = ref(""); const jobResult = shallowRef<unknown>(null); const cogStatus = ref("")
const autoRefresh = ref(false); const submissionUnknown = ref(false)
const resultAvailable = ref(false)
const receipts = ref<Array<{ id: string; flow: ThematicFlowId; acceptedAt: string; state: string }>>([])
let pollTimer: ReturnType<typeof setTimeout> | undefined
const resultCollection = ref("disaster-report"); const resultItems = shallowRef<RemoteItem[]>([]); const resultId = ref(""); const resultJson = shallowRef<unknown>(null); const resultMessage = ref("")
const resultCollections = ref([{ id: "disaster-report", name: "评估报告" }, { id: "thermal-background", name: "背景场" }, { id: "thermal-anomaly", name: "热异常成果" }, { id: "thematic-map", name: "既有专题成果" }]); const collectionsError = ref("")
let catalogRequest: AbortController | undefined
const resultToken = ref<string | undefined>()
let request: AbortController | undefined
const definition = computed(() => definitions.value.find(entry => entry.id === flowId.value)?.definition)
const formSchema = computed(() => definition.value?.schema && structuredFlowSchema(flowId.value, definition.value.schema))
const formValue = computed({ get: () => { try { return args() } catch { return {} } }, set: value => { parameters.value = JSON.stringify(value, null, 2) } })
const parameterErrors = computed(() => { try { return definition.value?.schema ? validateFlowParameters(flowId.value, args(), definition.value.schema) : ["尚未读取后台参数契约"] } catch { return ["任务参数必须为有效 JSON 对象"] } })
function args() {
  const value = JSON.parse(parameters.value)
  if (!value || typeof value !== "object" || Array.isArray(value)) { throw new Error("任务参数必须为 JSON 对象") }
  return value as Record<string, unknown>
}
const writes = computed(() => { try { return flowWrites(flowId.value, args()) } catch { return true } })
const resultItem = computed(() => resultItems.value.find(item => item.id === resultId.value))
const jsonAsset = computed(() => resultAssets.value.find(asset => /\.(geojson|json)$/i.test(new URL(asset.href).pathname))?.key)
const resultAssets = computed(() => resultItem.value
? Object.entries(resultItem.value.assets).flatMap(([key, asset]) => {
  try { return [{ key, href: backendAssetUrl(resultItem.value!, key), name: asset.title || key }] } catch { return [] }
})
: [])
const resultNotice = computed(() => {
  const p = resultItem.value?.properties || {}
  return `${p["result:source_system"] || "来源待核验"}；${p["background:method"] || p["thermal_anomaly:method"] || "用途与质量依据待核验"}。`
})
const surfaces = computed(() => [...new Map(props.items.flatMap(item => {
  if (!item.assets.overview) { return [] }
  try {
    const href = backendAssetUrl(item, "overview")
    return /\.html?$/i.test(new URL(href).pathname) ? [[href, { href, name: String(item.properties.title || item.id) }] as const] : []
  } catch { return [] }
})).values()])
const cogItem = computed(() => props.items.find(item => { try { return /\.tiff?$/i.test(new URL(backendAssetUrl(item, "data")).pathname) } catch { return false } }))
function flowName(id: string) { return thematicFlows.find(flow => flow.id === id)?.name || id }
async function openServices(event: Event) {
  if (!(event.target as HTMLDetailsElement).open || !props.active) { return }
  catalogRequest?.abort(); const controller = new AbortController(); catalogRequest = controller; collectionsError.value = ""
  try { const entries = await listRemoteCollections(controller.signal); if (!controller.signal.aborted && props.active) { resultCollections.value = entries } } catch (error) { if (!controller.signal.aborted) { collectionsError.value = error instanceof Error ? error.message : "数据集目录读取失败" } }
}
function defaultParameters() {
  const b = props.bounds
  const bbox = b ? [b.west, b.south, b.east, b.north] : undefined
  const defaults: Record<ThematicFlowId, object> = { search_flow: { collections: ["spatial-thematic"], bbox, limit: 20, page_size: 20, export: "" }, grid_layer_flow: { file_path: "", grid_kind: "population", coverage: "national" }, background_flow: { query_type: "thermal", bbox, submit_anomaly: false }, result_flow: { receive_type: "manual", result_type: "generic", result_data: {} }, stac_flow: { action: "query", source_scene: "scene1", query: { collection_id: "spatial-thematic", limit: 20 } } }
  parameters.value = JSON.stringify(defaults[flowId.value], null, 2); writeConfirmed.value = false
}
watch(flowId, defaultParameters, { immediate: true })
watch(parameters, () => { writeConfirmed.value = false })
watch(resultCollection, () => { resultItems.value = []; resultId.value = ""; resultJson.value = null; resultMessage.value = ""; resultToken.value = undefined })
watch(resultId, () => { resultJson.value = null })
watch(() => props.active, active => { if (!active) { request?.abort(); autoRefresh.value = false; clearTimeout(pollTimer) } })
watch(jobId, () => { jobResult.value = null; jobState.value = ""; resultAvailable.value = false }, { flush: "sync" })
watch([autoRefresh, jobId], () => { clearTimeout(pollTimer); if (autoRefresh.value && jobId.value && token.value && props.active) { pollTimer = setTimeout(pollJob, 1000) } })
async function pollJob() { if (!autoRefresh.value || !props.active || !token.value) { return }; if (!busy.value) { await refreshJob() }; if (autoRefresh.value) { pollTimer = setTimeout(pollJob, 5000) } }
function downloadReceipts() { downloadBlob(new Blob([JSON.stringify({ workspace: "earth-data", receipts: receipts.value }, null, 2)], { type: "application/json" }), "thematic-task-receipts.json") }
function useBounds() { const b = props.bounds; if (b) { formValue.value = { ...args(), bbox: [b.west, b.south, b.east, b.north] } } }
async function perform(action: (signal: AbortSignal) => Promise<void>) {
  if (busy.value || !props.active) { return }
  request = new AbortController(); busy.value = true; error.value = ""
  try { await action(request.signal) } catch (err) { if (!request.signal.aborted) { error.value = err instanceof Error ? err.message : "后台操作失败" } } finally { busy.value = false }
}
async function connect(value: string, signal: AbortSignal) {
  const result = await inspectThematicFlows(value, signal)
  if (!result.some(entry => entry.definition)) { throw new Error("授权未通过，未连接任何流程") }
  definitions.value = result; token.value = value; tokenInput.value = ""
}
function login() { return perform(async signal => { try { await connect(await loginThematicFlow(email.value, password.value, signal), signal) } finally { password.value = "" } }) }
function authorize() { return perform(signal => connect(tokenInput.value.trim(), signal)) }
function disconnect() { request?.abort(); clearTimeout(pollTimer); autoRefresh.value = false; token.value = ""; tokenInput.value = ""; password.value = ""; definitions.value = []; jobResult.value = null; jobState.value = ""; jobId.value = ""; receipts.value = [] }
function check() { return perform(async signal => { services.value = await checkThematicServices(signal) }) }
function checkCog() { return perform(async signal => { if (cogItem.value) { const result = await checkCogAsset(cogItem.value, "data", signal); cogStatus.value = `COG TileJSON 已验证 · 层级 ${result.minzoom}—${result.maxzoom} · 原始范围 ${result.bounds?.join(" / ")}` } }) }
function submit() {
 return perform(async signal => {
  if (flowId.value === "result_flow") { throw new Error("专题图发布已由目标平台接管，不再通过此流程提交") }
  const value = args()
  if (submissionUnknown.value) { throw new Error("上次提交结果不确定，须先核对后台任务") }
  if (!definition.value?.schema) { throw new Error("未取得后台参数契约") }
  const problems = validateFlowParameters(flowId.value, value, definition.value.schema)
  if (problems.length) { throw new Error(problems.join("；")) }
  let warning = "此操作将生产或修改后台数据。确认提交该流程？"
  if (flowId.value === "grid_layer_flow") { warning = "将更新现有全国人口/GDP目录记录，确认覆盖？" } else if (flowId.value === "background_flow") { warning = "将清除同类同尺度背景统计并重写当天文件，确认覆盖？" }
  if (flowWrites(flowId.value, value) && (!writeConfirmed.value || !window.confirm(warning))) { return }
  jobState.value = "正在提交"; jobResult.value = null; jobId.value = ""
  try { jobId.value = await runThematicFlow(token.value, flowId.value, value, writeConfirmed.value, signal) } catch (err) { submissionUnknown.value = true; jobState.value = "提交未确认，请先核对后台任务，勿直接重复提交"; throw err }
  receipts.value = [{ id: jobId.value, flow: flowId.value, acceptedAt: new Date().toISOString(), state: "accepted" }, ...receipts.value].slice(0, 30)
  jobState.value = "后台已接收，尚未完成；请检查任务状态"; writeConfirmed.value = false; autoRefresh.value = true
}) 
}
function refreshJob() {
 return perform(async signal => {
  try {
    const id = jobId.value; const job = await getThematicJob(token.value, id, signal)
    if (jobId.value !== id) { return }
    jobState.value = ({ running: "后台任务执行中", succeeded: "后台任务已完成", failed: "后台任务失败" })[job.state]; jobResult.value = job.result
    const receipt = receipts.value.find(entry => entry.id === id); if (receipt) { receipt.state = job.state }
    if (job.state === "succeeded") { const outcome = flowOutcome(receipt?.flow || flowId.value, job.result); jobState.value = outcome.label; resultAvailable.value = outcome.refresh; if (receipt) { receipt.state = outcome.state } }
    if (job.state !== "running") { autoRefresh.value = false; clearTimeout(pollTimer) }
  } catch (err) { autoRefresh.value = false; clearTimeout(pollTimer); throw err }
}) 
}
function queryResults() { return perform(async signal => { const result = await queryBackendResults(resultCollection.value, signal); resultItems.value = result.items; resultId.value = result.items[0]?.id || ""; resultToken.value = result.nextToken; resultMessage.value = `读取 ${result.items.length} 条后台记录${result.hasMore ? "；还有后续记录，当前不是完整清单" : ""}` }) }
function moreResults() {
  return perform(async signal => {
  if (!resultToken.value) { return }
  const result = await queryBackendResults(resultCollection.value, signal, resultToken.value)
  const merged = [...new Map([...resultItems.value, ...result.items].map(item => [item.id, item])).values()]
  if (merged.length > 1000) { throw new Error("成果候选超过 1000 条，请在数据目录缩小查询条件") }
  resultItems.value = merged; resultToken.value = result.nextToken
  resultJson.value = null
  resultMessage.value = `累计读取 ${merged.length} 条后台记录${result.hasMore ? "；尚有后续记录" : "；分页已完成"}`
  })
}
function readResult() { return perform(async signal => { if (resultItem.value && jsonAsset.value) { resultJson.value = await readBackendResult(resultItem.value, jsonAsset.value, signal) } }) }
onBeforeUnmount(() => { request?.abort(); catalogRequest?.abort(); clearTimeout(pollTimer); token.value = ""; password.value = ""; tokenInput.value = "" })
</script>

<style scoped>
.backend-services { border-block: 1px solid var(--thematic-line); padding: 12px 0; margin-top: 16px; min-width: 0; color: var(--thematic-ink); }
summary { cursor: pointer; font-weight: 600; } section { min-width: 0; padding-top: 10px; } h4 { margin: 18px 0 10px; font-size: 14px; }
label { display: grid; gap: 6px; margin: 10px 0; min-width: 0; } input,select,textarea { box-sizing: border-box; width: 100%; min-width: 0; border: 1px solid var(--thematic-line); padding: 8px 10px; background: var(--thematic-control); color: var(--thematic-ink); color-scheme: var(--thematic-scheme); font: inherit; border-radius: 3px; }
textarea { resize: vertical; } .actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; max-width: 100%; min-height: 36px; padding: 7px 10px; border: 1px solid var(--thematic-line); border-radius: 3px; background: var(--thematic-control); color: var(--thematic-ink); font: inherit; cursor: pointer; }
button:disabled { color: var(--thematic-disabled-ink); background: var(--thematic-disabled-bg); cursor: not-allowed; } a { color: var(--thematic-accent); overflow-wrap: anywhere; } .asset-links { display: grid; gap: 8px; margin-block: 10px; }
.service-list { display: grid; gap: 7px; margin: 10px 0; } dt { font-weight: 600; } dd { margin: 0 0 7px; overflow-wrap: anywhere; } .success { color: var(--thematic-success); } .error { color: var(--thematic-danger); } .warning { color: var(--thematic-warning); } .muted { color: var(--thematic-muted); }
.check { display: flex; align-items: flex-start; line-height: 1.6; }.check input { width: 16px; flex: none; margin-top: 4px; } p { line-height: 1.6; overflow-wrap: anywhere; }
pre { box-sizing: border-box; max-height: 320px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid var(--thematic-line); padding: 10px; background: var(--thematic-control); color: var(--thematic-ink); font-size: 12px; line-height: 1.6; }
.flow-status { padding: 0; list-style: none; }.flow-status li { display: grid; gap: 5px; padding: 9px 0; border-bottom: 1px solid var(--thematic-line); }
</style>
