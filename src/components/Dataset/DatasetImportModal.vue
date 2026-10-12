<template>
  <mars-task-modal
    v-model:open="visible"
    title="数据集导入"
    ok-text="开始导入"
    cancel-text="取消"
    :okLoading="importing"
    @ok="handleOk"
  >
    <a-alert v-if="errorText" type="error" :message="errorText" show-icon style="margin-bottom: 10px" />

    <a-form layout="vertical">
      <a-form-item label="选择文件">
        <a-upload
          :file-list="fileList"
          :max-count="1"
          :before-upload="beforeUpload"
          @remove="removeFile"
          accept=".csv,.geojson,.json,.zip"
        >
          <a-button>选择文件</a-button>
        </a-upload>
        <div class="hint">支持 csv / geojson / shp(zip)，文件大小 ≤ 2GB</div>
      </a-form-item>

      <a-form-item label="导入名称（可选）">
        <a-input v-model:value="layerName" placeholder="默认使用文件名" />
      </a-form-item>

      <a-form-item v-if="progressVisible" label="进度">
        <a-progress :percent="progressPercent" size="small" />
        <div class="hint">{{ progressText }}</div>
      </a-form-item>
    </a-form>
  </mars-task-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import shp from "shpjs"
import { smartUploadArtifact } from "@/widgets/basic/dataset-repository/services/eoapi-artifacts"
import type { UploadArtifactResponse } from "@/widgets/basic/dataset-repository/types/eoapi-types"

const props = defineProps<{
  open: boolean
  datasetId?: string
  sessionRootId?: string
}>()

const emit = defineEmits<{
  "update:open": [value: boolean]
  imported: [payload: { file: File; geojson: any; artifact?: UploadArtifactResponse }]
}>()

const visible = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v)
})

const importing = ref(false)
const errorText = ref("")
const fileList = ref<any[]>([])
const pickedFile = ref<File | null>(null)
const layerName = ref("")

const progressVisible = ref(false)
const progressPercent = ref(0)
const progressText = ref("")

function resetState() {
  importing.value = false
  errorText.value = ""
  fileList.value = []
  pickedFile.value = null
  layerName.value = ""
  progressVisible.value = false
  progressPercent.value = 0
  progressText.value = ""
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetState()
    }
  }
)

function fileExt(name: string): string {
  const lower = String(name || "").toLowerCase()
  const idx = lower.lastIndexOf(".")
  return idx >= 0 ? lower.slice(idx + 1) : ""
}

function ensureFileAllowed(file: File): string | null {
  const maxBytes = 2 * 1024 * 1024 * 1024
  if (file.size > maxBytes) {
    return "文件过大（需 ≤ 2GB）"
  }
  const ext = fileExt(file.name)
  if (ext === "csv" || ext === "geojson" || ext === "json" || ext === "zip") {
    return null
  }
  return "仅支持 csv / geojson / shp(zip) 格式"
}

function beforeUpload(file: File) {
  const err = ensureFileAllowed(file)
  if (err) {
    errorText.value = err
    return false
  }
  errorText.value = ""
  pickedFile.value = file
  fileList.value = [{ uid: String(Date.now()), name: file.name, status: "done" }]
  return false
}

function removeFile() {
  pickedFile.value = null
  fileList.value = []
  return true
}

function normalizeGeojson(fc: any): any {
  if (!fc) {
    return null
  }
  if (fc.type === "FeatureCollection") {
    return fc
  }
  if (fc.type === "Feature") {
    return { type: "FeatureCollection", features: [fc] }
  }
  if (fc.type && fc.coordinates) {
    return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: fc }] }
  }
  return null
}

function parseCsvToGeojson(text: string): any {
  const lines = String(text || "")
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) {
    return null
  }
  const headers = lines[0].split(",").map((x) => x.trim())
  const lonIdx = headers.findIndex((h) => ["lon", "lng", "longitude", "x"].includes(h.toLowerCase()))
  const latIdx = headers.findIndex((h) => ["lat", "latitude", "y"].includes(h.toLowerCase()))
  if (lonIdx < 0 || latIdx < 0) {
    return null
  }
  const features: any[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",")
    const lon = Number(cols[lonIdx])
    const lat = Number(cols[latIdx])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      continue
    }
    const props: any = {}
    headers.forEach((h, idx) => {
      if (idx === lonIdx || idx === latIdx) {
        return
      }
      props[h] = cols[idx]
    })
    features.push({
      type: "Feature",
      properties: props,
      geometry: { type: "Point", coordinates: [lon, lat] }
    })
  }
  return { type: "FeatureCollection", features }
}

async function parseFileToGeojson(file: File): Promise<any> {
  const ext = fileExt(file.name)
  if (ext === "geojson" || ext === "json") {
    const raw = await file.text()
    const parsed = JSON.parse(raw)
    return normalizeGeojson(parsed)
  }
  if (ext === "csv") {
    const raw = await file.text()
    return parseCsvToGeojson(raw)
  }
  if (ext === "zip") {
    const buf = await file.arrayBuffer()
    const parsed = await (shp as any)(buf)
    return normalizeGeojson(parsed)
  }
  return null
}

async function handleOk() {
  const file = pickedFile.value
  if (!file) {
    errorText.value = "请先选择文件"
    return
  }
  const err = ensureFileAllowed(file)
  if (err) {
    errorText.value = err
    return
  }
  importing.value = true
  errorText.value = ""
  progressVisible.value = true
  progressPercent.value = 0
  progressText.value = "准备中..."
  try {
    progressText.value = "解析文件..."
    const geojson = await parseFileToGeojson(file)
    if (!geojson || !Array.isArray(geojson.features) || geojson.features.length === 0) {
      throw new Error("解析失败：未识别到有效要素")
    }
    progressPercent.value = 30
    progressText.value = "上传原始文件..."

    const datasetId = typeof props.datasetId === "string" ? props.datasetId : ""
    const uploadRes = datasetId
      ? await smartUploadArtifact(
          { file, name: layerName.value || file.name, type: "data", datasetId },
          { onProgress: (p) => (progressPercent.value = Math.min(95, 30 + (p * 0.65))) }
        )
      : { success: false }

    progressPercent.value = 100
    progressText.value = "导入完成"
    emit("imported", { file, geojson, artifact: uploadRes.success ? (uploadRes.data as any) : undefined })
    visible.value = false
  } catch (e: any) {
    errorText.value = e?.message || "导入失败"
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--mars-control-placeholder);
}
</style>
