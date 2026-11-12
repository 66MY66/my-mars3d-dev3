<template>
  <section class="standard-publication" aria-label="规范图件发布检查">
    <header><strong>{{ state?.name || "规范图件" }}</strong><span>{{ state?.code || "图件准备中" }}</span></header>
    <template v-if="state">
      <button class="publication-preview" type="button" aria-label="查看当前规范图件排版" @click="emit('preview')">
        <img v-if="state.preview" :src="state.preview" alt="当前规范图件校样" />
        <span v-else>图件正在生成</span>
      </button>
      <dl class="publication-summary"><dt>图件标题</dt><dd>{{ state.title }}</dd><dt>输出规格</dt><dd>A3 横向 · 420 × 297 mm</dd><dt>数据用途</dt><dd>{{ state.usage === 'operational' ? '业务数据 · 以检查结果为准' : state.usage === 'reference' ? '参考数据 · 尚未完成业务审核' : '测试或未声明用途 · 仅限校样' }}</dd><dt>人工复核</dt><dd>{{ state.reviewCount }} / {{ state.reviewTotal }}</dd></dl>
      <div class="publication-check" :class="{ 'is-ready': state.ready }" role="status">
        <strong>{{ state.busy ? '正在处理图件' : state.ready ? '已满足当前正式出图检查' : '正式图件尚未就绪' }}</strong>
        <CartographyReleaseChecks v-if="!state.ready" :issues="state.issues" />
        <ul v-if="additionalBlockers.length"><li v-for="item in additionalBlockers" :key="item">{{ item }}</li></ul>
      </div>
      <div class="publication-actions"><mars-button :disabled="state.busy" @click="emit('inspect')"><mars-icon icon="inspection" :width="16" />查看完整检查与复核</mars-button></div>
      <div class="publication-output">
        <label>输出格式<a-select :value="state.format" aria-label="发布图件格式" :disabled="state.busy" @change="emit('output', $event, state.dpi)"><a-select-option value="pdf">PDF</a-select-option><a-select-option value="jpg">JPG</a-select-option></a-select></label>
        <label>分辨率<a-select :value="state.dpi" aria-label="发布图件分辨率" :disabled="state.busy" @change="emit('output', state.format, $event)"><a-select-option v-for="density in [300, 450, 600]" :key="density" :value="density">{{ density }} DPI</a-select-option></a-select></label>
      </div>
      <div class="publication-actions">
        <mars-button :disabled="!state.hasDocument || state.busy" @click="emit('export', false)"><mars-icon icon="download" :width="16" />导出校样</mars-button>
        <mars-button type="primary" :disabled="!state.ready || state.busy" @click="emit('export', true)"><mars-icon icon="download" :width="16" />导出正式图件</mars-button>
        <mars-button :disabled="state.busy" @click="emit('report')"><mars-icon icon="inspection" :width="16" />下载检查记录</mars-button>
      </div>
      <p v-if="state.error" class="publication-error" role="alert">{{ state.error }}</p>
      <p v-else-if="state.status" class="publication-status" role="status">{{ state.status }}</p>
    </template>
    <section class="publication-service" aria-label="规范图件成果发布">
      <strong>成果库归档与文件校验</strong>
      <label class="delivery-field">目标数据集 ID<a-input v-model:value="targetDatasetId" aria-label="规范发布目标数据集" placeholder="成果库数据集 ID" :disabled="delivering" /></label>
      <label class="delivery-field">发布描述<a-textarea v-model:value="description" aria-label="规范发布描述" :rows="3" placeholder="至少 5 个有效字符" :disabled="delivering" /></label>
      <div class="publication-actions">
        <mars-button :disabled="!state?.ready || state.busy || delivering || !prepare" @click="downloadPackage"><mars-icon icon="download" :width="16" />下载发布包</mars-button>
        <mars-button type="primary" :disabled="!state?.ready || state.busy || delivering || !prepare" :loading="delivering" @click="publishPackage"><mars-icon icon="upload" :width="16" />上传到成果库</mars-button>
      </div>
      <p class="publication-status">包内容：{{ state?.format.toUpperCase() || 'PDF/JPG' }} 图件、制图数据、检查记录及文件指纹。</p>
      <p v-if="deliveryStatus" role="status">{{ deliveryStatus }}</p>
      <p v-if="deliveryError" class="publication-error" role="alert">{{ deliveryError }}</p>
      <RepositoryPublicationActions v-if="uploadedRecord" :key="uploadedRecord.artifactId" :file="uploadedRecord.file" :artifact-id="uploadedRecord.artifactId" :dataset-id="uploadedRecord.datasetId" :source-ready="!!state?.ready && !state.busy && !delivering && uploadedRecord.source === sourceKey() && uploadedRecord.datasetId === targetDatasetId.trim()" />
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { isPublishDescriptionValid, PUBLISH_DESCRIPTION_ERROR } from "../dataset-repository/services/publish-description"
import { createStandardPublicationArchive, uploadStandardPublicationArchive } from "./standard-publication-delivery"
import { downloadBlob } from "./export-media"
import type { StandardPublicationBundle, StandardPublicationState } from "./standard-publication"
import CartographyReleaseChecks from "./CartographyReleaseChecks.vue"
import RepositoryPublicationActions from "./RepositoryPublicationActions.vue"

type PreparePublication = () => Promise<StandardPublicationBundle>
const props = defineProps<{ state?: StandardPublicationState; datasetId?: string; prepare?: PreparePublication }>()
const additionalBlockers = computed(() => props.state?.blockers.filter(message => !props.state!.issues.some(issue => message === `${issue.clause} · ${issue.message}`) && !(message.includes("未声明为正式业务数据") && props.state!.issues.some(issue => issue.clause === "4.6 / 10.1"))) || [])
const emit = defineEmits<{
  inspect: []; preview: []; report: []
  output: [format: "jpg" | "pdf", dpi: number]
  export: [formal: boolean]
}>()
const targetDatasetId = ref(props.datasetId || "")
const description = ref("")
const delivering = ref(false)
const deliveryStatus = ref("")
const deliveryError = ref("")
let disposed = false
let cached: { key: string; file: File } | undefined
let uploaded: { key: string; artifactId: string } | undefined
const uploadedRecord = ref<{ artifactId: string; datasetId: string; source: string; file: File } | null>(null)
const sourceKey = () => `${props.datasetId || ""}:${props.state?.templateId}:${props.state?.revision}:${props.state?.format}:${props.state?.dpi}`
watch(() => props.datasetId, (next, previous) => { if (!targetDatasetId.value || targetDatasetId.value === previous) { targetDatasetId.value = next || "" } })
watch(sourceKey, () => { cached = undefined; uploaded = undefined; deliveryStatus.value = ""; deliveryError.value = "" })
async function archive() {
  if (!props.prepare || !props.state?.ready) { throw new Error("请先完成正式出图检查和人工复核") }
  const key = sourceKey()
  if (cached?.key === key) { return cached.file }
  const bundle = await props.prepare()
  const file = await createStandardPublicationArchive(bundle)
  if (disposed || key !== sourceKey() || !props.state?.ready) { throw new Error("图件已变化，请重新检查后发布") }
  cached = { key, file }
  return file
}
async function downloadPackage() {
  if (delivering.value) { return }
  delivering.value = true; deliveryError.value = ""; deliveryStatus.value = "正在生成发布包…"
  try {
    const file = await archive()
    downloadBlob(file, file.name)
    deliveryStatus.value = "发布包已下载，尚未上传至成果库。"
  } catch (error) { deliveryError.value = error instanceof Error ? error.message : "发布包生成失败"; deliveryStatus.value = "" } finally { delivering.value = false }
}
async function publishPackage() {
  if (delivering.value) { return }
  const datasetId = targetDatasetId.value.trim(); const notes = description.value.trim()
  deliveryError.value = ""
  if (!datasetId) { deliveryError.value = "请填写成果库中的目标数据集 ID"; return }
  if (!isPublishDescriptionValid(notes)) { deliveryError.value = PUBLISH_DESCRIPTION_ERROR; return }
  const key = `${sourceKey()}:${datasetId}:${notes}`
  const submittedSource = sourceKey()
  if (uploaded?.key === key) { deliveryStatus.value = `当前发布包已有入库记录：${uploaded.artifactId}。请使用下方文件校验和审核操作，不重复上传。`; return }
  delivering.value = true; deliveryStatus.value = "正在生成并上传正式图件发布包…"
  try {
    const file = await archive()
    const artifact = await uploadStandardPublicationArchive(file, datasetId, notes)
    if (disposed) { return }
    uploaded = { key, artifactId: artifact.artifactId }
    uploadedRecord.value = { artifactId: artifact.artifactId, datasetId, source: submittedSource, file }
    deliveryStatus.value = `成果库已确认入库记录，成果编号 ${artifact.artifactId}。文件完整性仍待重新读取验证；数据集公开权限未改变。${submittedSource !== sourceKey() ? "上传的是提交时的版本，当前图件已有修改。" : ""}`
  } catch (error) {
    if (!disposed) { deliveryError.value = error instanceof Error ? error.message : "上传失败，请连接单位内网或 VPN 后重试"; deliveryStatus.value = "未确认上传成功。" }
  } finally { delivering.value = false }
}
onBeforeUnmount(() => { disposed = true })
</script>

<style scoped>
.standard-publication { color: var(--thematic-ink); display: grid; gap: 16px; min-width: 0; }
.standard-publication header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.standard-publication header strong { font-size: 17px; }
.standard-publication header span, .publication-summary dt { color: var(--thematic-muted); }
.publication-preview { width: 100%; height: 172px; padding: 8px; background: var(--thematic-subtle); border: 1px solid var(--thematic-line); border-radius: 4px; color: var(--thematic-ink); cursor: pointer; }
.publication-preview img { width: 100%; height: 100%; object-fit: contain; display: block; }
.publication-summary { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 8px 12px; margin: 0; font-size: 13px; line-height: 1.6; }
.publication-summary dd { margin: 0; overflow-wrap: anywhere; }
.publication-check { background: var(--thematic-warning-bg); border-left: 3px solid var(--thematic-warning); padding: 12px 14px; color: var(--thematic-warning); line-height: 1.65; font-size: 13px; }
.publication-check.is-ready { background: var(--thematic-success-bg); border-left-color: var(--thematic-success); color: var(--thematic-success); }
.publication-check ul { margin: 8px 0; padding-left: 18px; }
.publication-check li { margin-bottom: 4px; overflow-wrap: anywhere; }
.publication-check strong { color: inherit; font-size: 14px; }
.publication-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.publication-output { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; border-top: 1px solid var(--thematic-line); padding-top: 16px; }
.publication-output label { display: grid; gap: 8px; min-width: 0; font-size: 13px; }
.delivery-field { display: grid; gap: 8px; min-width: 0; font-size: 13px; color: var(--thematic-ink); }
.publication-status, .publication-error, .publication-service p { margin: 0; font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.publication-status { color: var(--thematic-muted); }.publication-error { color: var(--thematic-danger); }
.publication-service { border-top: 1px solid var(--thematic-line); padding-top: 16px; display: grid; gap: 10px; color: var(--thematic-muted); }
.publication-service > div { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.publication-service strong { color: var(--thematic-ink); }
.publication-preview:focus-visible { outline: 2px solid var(--thematic-accent); outline-offset: 2px; }
</style>
