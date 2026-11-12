<template>
  <section class="repository-release" aria-label="成果文件校验与公开审核">
    <p v-if="!sourceReady" class="repository-error" role="status">当前图件版本或目标已变化；以下为先前入库成果，不能代替当前图件申请公开。</p>
    <ol aria-label="成果发布阶段">
      <li>入库记录已确认</li>
      <li :class="verified ? 'is-ready' : 'is-pending'">{{ verifying ? '正在读取后台文件' : verified ? '文件指纹已验证' : '文件完整性待验证' }}</li>
      <li :class="publication?.status === 'published' ? 'is-ready' : ''">{{ publicationLabel }}</li>
    </ol>
    <div class="repository-actions">
      <mars-button :disabled="busy" @click="verify(false)"><mars-icon icon="refresh" :width="16" />重新校验文件</mars-button>
      <mars-button :disabled="busy || !verified" @click="verify(true)"><mars-icon icon="download" :width="16" />下载已入库成果</mars-button>
      <mars-button type="primary" :disabled="busy || !verified || !sourceReady || publication?.status === 'reviewing' || publication?.status === 'published'" @click="requestPublication"><mars-icon icon="upload" :width="16" />提交公开审核</mars-button>
      <mars-button :disabled="busy" @click="refreshStatus"><mars-icon icon="inspection" :width="16" />查询审核状态</mars-button>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="error" class="repository-error" role="alert">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { verifyRepositoryFile, getRepositoryPublicationStatus, requestRepositoryPublication, type RepositoryPublicationStatus } from "./publication-repository"
import { downloadBlob } from "./export-media"

const props = defineProps<{ file: File; artifactId: string; datasetId: string; sourceReady: boolean }>()
const verified = ref(false)
const verifying = ref(false)
const requesting = ref(false)
const publication = ref<RepositoryPublicationStatus | null>(null)
const message = ref("")
const error = ref("")
const busy = computed(() => verifying.value || requesting.value)
const publicationLabel = computed(() => {
  if (!publication.value) { return "公开审核尚未确认" }
  if (publication.value.status === "published" && !verified.value) { return "数据集已公开 · 当前文件尚未通过校验" }
  return { private: "尚未公开发布", reviewing: "已提交 · 等待后台审核", published: "后台确认已公开发布" }[publication.value.status]
})
let epoch = 0
let disposed = false
async function verify(download: boolean) {
  if (busy.value) { return }
  const ticket = epoch; const file = props.file; const artifactId = props.artifactId
  verifying.value = true; error.value = ""; verified.value = false
  try {
    const result = await verifyRepositoryFile(file, artifactId, props.datasetId)
    if (disposed || ticket !== epoch) { return }
    verified.value = true
    message.value = `后台文件已重新读取且 SHA-256 一致 · ${result.verifiedAt}。文件入库不等于已公开发布。`
    if (download) { downloadBlob(result.file, result.file.name) }
  } catch (err) {
    if (!disposed && ticket === epoch) { error.value = err instanceof Error ? err.message : "后台文件校验失败"; message.value = "已有成果记录保留，重新校验不会重复上传。" }
  } finally { if (!disposed && ticket === epoch) { verifying.value = false } }
}
async function refreshStatus() {
  if (busy.value) { return }
  const ticket = epoch; const datasetId = props.datasetId
  requesting.value = true; error.value = ""
  try {
    const result = await getRepositoryPublicationStatus(datasetId)
    if (!disposed && ticket === epoch) { publication.value = result; message.value = result.rejectionReason || "已读取后台审核状态。" }
  } catch (err) { if (!disposed && ticket === epoch) { error.value = err instanceof Error ? err.message : "状态查询失败" } } finally { if (!disposed && ticket === epoch) { requesting.value = false } }
}
async function requestPublication() {
  if (busy.value || !verified.value || !props.sourceReady || publication.value?.status === "reviewing" || publication.value?.status === "published") { return }
  const ticket = epoch; const datasetId = props.datasetId
  if (!window.confirm(`此操作将申请公开整个数据集 ${datasetId}，包括其中已有的其他内容。请确认全部内容均可公开。提交后仍须后台审核，是否继续？`)) { return }
  requesting.value = true; error.value = ""
  try {
    const result = await requestRepositoryPublication(datasetId)
    if (!disposed && ticket === epoch) { publication.value = result; message.value = result.status === "published" ? "后台确认该数据集已公开；在线地图服务状态另行核验。" : "后台已接收申请，尚不能认定已公开发布。" }
  } catch (err) { if (!disposed && ticket === epoch) { error.value = err instanceof Error ? err.message : "公开审核申请失败" } } finally { if (!disposed && ticket === epoch) { requesting.value = false } }
}
watch(() => [props.file, props.artifactId, props.datasetId], () => {
  epoch++; verified.value = false; verifying.value = false; requesting.value = false; publication.value = null; message.value = ""; error.value = ""
  verify(false)
}, { immediate: true })
onBeforeUnmount(() => { disposed = true; epoch++ })
</script>

<style scoped>
.repository-release { border-top: 1px solid var(--thematic-line); padding-top: 12px; color: var(--thematic-ink); min-width: 0; }
.repository-release ol { display: grid; gap: 6px; padding-left: 22px; margin: 0 0 12px; font-size: 13px; }
.repository-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.repository-release p { margin: 10px 0 0; font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.repository-error { color: var(--thematic-danger); }.is-ready { color: var(--thematic-success); }.is-pending { color: var(--thematic-warning); }
</style>
