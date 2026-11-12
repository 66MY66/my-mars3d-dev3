<template>
  <section class="published-maps" aria-label="已发布专题图">
    <header><strong>已发布专题图<span v-if="records.length">（{{ records.length }}）</span></strong><button type="button" :disabled="loading" @click="refresh">刷新</button></header>
    <p v-if="loading" role="status">正在读取已发布图件…</p>
    <p v-if="error" class="publication-error" role="alert">{{ error }}</p>
    <article v-for="record in records" :key="record.id" :class="{ highlighted: record.id === highlightId }">
      <strong>{{ record.manifest.title }}</strong>
      <p>{{ new Date(record.savedAt).toLocaleString() }} · 本机已保存</p>
      <div class="publication-actions">
        <button type="button" :disabled="busy" @click="preview(record)">查看图件</button>
        <button type="button" :disabled="busy" @click="download(record)">下载发布包</button>
      </div>
    </article>
    <p v-if="records.length" class="publication-scope">发布包保存在当前浏览器中，包含图件、地图配置和审核记录。</p>
    <a-modal v-model:open="previewOpen" :title="previewTitle" :footer="null" width="1000" @cancel="closePreview">
      <div class="publication-preview">
        <ArtifactPreview v-if="previewUrl" :url="previewUrl" :mime="previewMime" />
      </div>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue"
import ArtifactPreview from "../dataset-repository/components/ArtifactPreview.vue"
import { downloadBlob } from "../thematic-workbench/export-media"
import { listTaskPublications, readTaskPublication, TASK_PUBLICATION_EVENT, type TaskPublication } from "./thematic-publications"

const props = defineProps<{ datasetId: string; active: boolean; refreshKey?: number; highlightId?: string }>()
const emit = defineEmits<{ count: [value: number] }>()
const records = ref<TaskPublication[]>([])
const loading = ref(false)
const busy = ref(false)
const error = ref("")
const previewOpen = ref(false)
const previewTitle = ref("")
const previewUrl = ref("")
const previewMime = ref("")
let revision = 0
let disposed = false
function closePreview() {
  previewOpen.value = false
  if (previewUrl.value) { URL.revokeObjectURL(previewUrl.value) }
  previewUrl.value = ""
}

async function refresh() {
  const token = ++revision
  if (!props.active || !props.datasetId) { return }
  loading.value = true; error.value = ""
  try {
    const result = await listTaskPublications(props.datasetId)
    if (disposed || token !== revision) { return }
    records.value = result
    emit("count", result.length)
  } catch (err) {
    if (!disposed && token === revision) { error.value = err instanceof Error ? err.message : "已发布图件读取失败" }
  } finally {
    if (!disposed && token === revision) { loading.value = false }
  }
}

async function download(record: TaskPublication) {
  busy.value = true; error.value = ""
  try {
    const saved = await readTaskPublication(record.id, props.datasetId)
    if (!disposed) { downloadBlob(saved.archive, record.fileName) }
  } catch (err) {
    if (!disposed) { error.value = err instanceof Error ? err.message : "发布包读取失败" }
  } finally {
    if (!disposed) { busy.value = false }
  }
}
async function preview(record: TaskPublication) {
  if (busy.value) { return }
  closePreview(); busy.value = true; error.value = ""
  const datasetId = props.datasetId
  try {
    const saved = await readTaskPublication(record.id, datasetId)
    let file = saved.zip.file("composition.png")
    let mime = "image/png"
    if (!file) {
      const formal = saved.zip.file("formal-document.zip")
      if (formal) {
        const { default: JSZip } = await import("jszip")
        const inner = await JSZip.loadAsync(await formal.async("uint8array"))
        const manifest = JSON.parse(await inner.file("manifest.json")!.async("string"))
        file = inner.file(manifest.map.file)
        mime = manifest.format === "pdf" ? "application/pdf" : "image/jpeg"
      }
    }
    if (!file) { throw new Error("发布包没有可预览图件，请下载完整发布包") }
    const bytes = await file.async("uint8array")
    if (disposed || !props.active || datasetId !== props.datasetId) { return }
    previewUrl.value = URL.createObjectURL(new Blob([bytes], { type: mime }))
    previewMime.value = mime; previewTitle.value = record.manifest.title; previewOpen.value = true
  } catch (err) {
    if (!disposed && datasetId === props.datasetId) { error.value = err instanceof Error ? err.message : "图件预览失败" }
  } finally { if (!disposed) { busy.value = false } }
}

watch(() => props.datasetId, () => { records.value = []; emit("count", 0); closePreview() })
watch([() => props.active, () => props.highlightId], closePreview)
watch([() => props.datasetId, () => props.active, () => props.refreshKey], refresh, { immediate: true })
function saved() { if (props.active) { refresh() } }
onMounted(() => window.addEventListener(TASK_PUBLICATION_EVENT, saved))
onBeforeUnmount(() => { disposed = true; revision++; closePreview(); window.removeEventListener(TASK_PUBLICATION_EVENT, saved) })
</script>

<style scoped>
.published-maps { margin-bottom: 14px; color: var(--mars-text-color, #172b45); }
header, .publication-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
header { padding: 8px 0; }
article { margin: 8px 0; padding: 12px; border: 1px solid var(--mars-control-border, #cbd5e1); border-radius: 6px; }
article.highlighted { border-color: #1677ff; }
article strong { display: block; overflow-wrap: anywhere; }
p { margin: 6px 0; font-size: 12px; line-height: 1.6; }
.publication-actions { justify-content: flex-start; margin-top: 10px; }
button { cursor: pointer; border: 1px solid var(--mars-control-border, #b9c6d6); border-radius: 4px; background: var(--mars-control-bg, #fff); color: inherit; min-height: 32px; padding: 4px 10px; }
button:disabled { opacity: .55; cursor: default; }
.publication-error { color: #c73535; }
.publication-scope { color: var(--mars-text-secondary, #64748b); }
.publication-preview { min-height: 200px; }
</style>
