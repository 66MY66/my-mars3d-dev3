<template>
  <div class="thematic-jobs">
    <a-space direction="vertical" :size="8" style="width: 100%">
      <a-alert v-if="error" type="error" :message="error" show-icon />
      <a-space :size="8">
        <a-button size="small" @click="load">刷新模板</a-button>
        <a-button size="small" :disabled="!selectedTemplate" type="primary" :loading="creating" @click="openCreate">
          创建任务
        </a-button>
      </a-space>

      <a-list :data-source="templates" :loading="loading" bordered size="small">
        <template #renderItem="{ item }">
          <a-list-item class="tpl-row" @click="selectTemplate(item)">
            <a-radio :checked="selectedTemplate?.templateId === item.templateId" />
            <a-list-item-meta :title="item.name || item.templateId" :description="item.description || item.templateId" />
          </a-list-item>
        </template>
      </a-list>

      <a-card v-if="job" size="small" title="任务状态">
        <div class="meta">jobId：{{ job.jobId }}</div>
        <div class="meta">状态：{{ job.status }}</div>
        <a-progress v-if="typeof job.progress === 'number'" :percent="Math.round(job.progress)" size="small" />
        <div v-if="job.message" class="meta">{{ job.message }}</div>
        <a-space :size="8" style="margin-top: 8px">
          <a-button size="small" :disabled="polling" @click="pollOnce">刷新状态</a-button>
          <a-button v-if="job.status === 'succeeded'" size="small" type="primary" :loading="loadingResult" @click="loadResult">
            获取结果
          </a-button>
        </a-space>
      </a-card>

      <a-card v-if="result" size="small" title="任务结果">
        <div v-if="result.serviceRef" class="meta">serviceRef：{{ (result.serviceRef as any).urlTemplate || result.serviceRef.url }}</div>
        <div v-if="result.archiveRef" class="meta">archiveRef：{{ JSON.stringify(result.archiveRef) }}</div>
        <a-space :size="8" style="margin-top: 8px">
          <a-button size="small" :disabled="!result.serviceRef" @click="addServiceToMap">加载服务到地图</a-button>
          <a-button size="small" :disabled="!result.serviceRef || !datasetId" :loading="savingRevision" @click="saveResultAsRevision">
            写入为新版本
          </a-button>
        </a-space>
      </a-card>

      <mars-task-modal v-model:open="createOpen" title="创建专题任务" :okLoading="creating" @ok="confirmCreate">
        <a-form layout="vertical">
          <a-form-item label="模板" required>
            <a-input :value="selectedTemplate?.templateId" disabled />
          </a-form-item>
          <a-form-item label="模板版本">
            <a-input v-model:value="templateVersion" />
          </a-form-item>
          <a-form-item label="datasetId" required>
            <a-input v-model:value="formDatasetId" />
          </a-form-item>
          <a-form-item label="revisionId（可选）">
            <a-input v-model:value="formRevisionId" />
          </a-form-item>
          <a-form-item label="发布类型">
            <a-radio-group v-model:value="publishType">
              <a-radio value="xyz">xyz</a-radio>
            </a-radio-group>
          </a-form-item>
        </a-form>
      </mars-task-modal>
    </a-space>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { $message } from "@mars/components/mars-ui/index"
import * as mars3d from "mars3d"
import { createJob, getJob, getJobResult, getTemplates } from "../services/eoapi-thematics"
import type { ThematicTemplate } from "../services/eoapi-thematics"
import { buildXyzLayerOptions } from "../services/eoapi-services"
import { createRevision } from "../services/eoapi-datasets"
import { getMap } from "../map"
import { serializeWorkspace } from "../workspace/serialize"

const props = defineProps<{ datasetId?: string }>()
const datasetId = computed(() => String(props.datasetId || "").trim())

const loading = ref(false)
const error = ref("")
const templates = ref<ThematicTemplate[]>([])
const selectedTemplate = ref<ThematicTemplate | null>(null)

const createOpen = ref(false)
const creating = ref(false)
const templateVersion = ref("")
const formDatasetId = ref("")
const formRevisionId = ref("")
const publishType = ref<"xyz">("xyz")

const job = ref<any>(null)
const polling = ref(false)
const loadingResult = ref(false)
const result = ref<any>(null)
const savingRevision = ref(false)

function selectTemplate(t: ThematicTemplate) {
  selectedTemplate.value = t
}

async function load() {
  loading.value = true
  error.value = ""
  const res = await getTemplates()
  if (!res.success) {
    error.value = res.message || "加载失败"
    templates.value = []
  } else {
    templates.value = (res.data || []).filter((t) => t.templateId)
  }
  loading.value = false
}

function openCreate() {
  if (!selectedTemplate.value) {
    return
  }
  formDatasetId.value = datasetId.value
  templateVersion.value = selectedTemplate.value.version || ""
  createOpen.value = true
}

async function confirmCreate() {
  if (!selectedTemplate.value || creating.value) {
    return
  }
  const did = String(formDatasetId.value || "").trim()
  if (!did) {
    $message("datasetId 不能为空")
    return
  }
  creating.value = true
  try {
    const body = {
      templateId: selectedTemplate.value.templateId,
      templateVersion: String(templateVersion.value || "").trim() || undefined,
      datasetId: did,
      revisionId: String(formRevisionId.value || "").trim() || undefined,
      publish: { type: publishType.value }
    }
    const res = await createJob(body)
    if (!res.success || !res.data?.jobId) {
      $message(res.message || "创建任务失败")
      return
    }
    job.value = res.data
    result.value = null
    createOpen.value = false
    $message("任务已创建", "success")
    startPolling()
  } finally {
    creating.value = false
  }
}

async function pollOnce() {
  if (!job.value?.jobId) {
    return
  }
  const res = await getJob(job.value.jobId)
  if (res.success && res.data) {
    job.value = res.data
  }
}

function startPolling() {
  if (polling.value) {
    return
  }
  polling.value = true
  const id = job.value?.jobId
  const timer = window.setInterval(async () => {
    if (!id) {
      window.clearInterval(timer)
      polling.value = false
      return
    }
    const res = await getJob(id)
    if (res.success && res.data) {
      job.value = res.data
      if (res.data.status === "succeeded" || res.data.status === "failed") {
        window.clearInterval(timer)
        polling.value = false
      }
    }
  }, 2000)
}

async function loadResult() {
  if (!job.value?.jobId || loadingResult.value) {
    return
  }
  loadingResult.value = true
  try {
    const res = await getJobResult(job.value.jobId)
    if (!res.success) {
      $message(res.message || "获取结果失败")
      return
    }
    result.value = res.data || null
  } finally {
    loadingResult.value = false
  }
}

function addServiceToMap() {
  const serviceRef = result.value?.serviceRef
  if (!serviceRef) {
    return
  }
  const map = getMap()
  if (!map) {
    $message("地图未就绪")
    return
  }
  const layerOpt = buildXyzLayerOptions(serviceRef)
  if (!layerOpt?.url) {
    $message("serviceRef 缺少 url/urlTemplate")
    return
  }
  try {
    const layer = mars3d.LayerUtil.create(layerOpt)
    if (layer) {
      map.addLayer(layer)
      $message("已加载服务", "success")
    }
  } catch {
    $message("加载失败")
  }
}

async function saveResultAsRevision() {
  const did = datasetId.value
  const serviceRef = result.value?.serviceRef
  if (!did || !serviceRef || savingRevision.value) {
    return
  }
  const map = getMap()
  if (!map) {
    $message("地图未就绪")
    return
  }
  const url = (serviceRef as any).urlTemplate || serviceRef.url
  if (!url) {
    $message("serviceRef 缺少 url/urlTemplate")
    return
  }
  savingRevision.value = true
  try {
    const manifest = serializeWorkspace(map, { includeView: true, includeLayers: true, includeDraw: true })
    const layerId = `thematic_${job.value?.jobId || Date.now()}`
    const nextLayers = Array.isArray(manifest.layers) ? [...manifest.layers] : []
    nextLayers.push({
      id: layerId,
      name: selectedTemplate.value?.name || "专题图服务",
      sourceType: "xyz",
      sourceRef: String(url),
      visible: true,
      opacity: 1,
      order: nextLayers.length + 1,
      data: { serviceRef }
    })
    manifest.layers = nextLayers

    const res = await createRevision(did, { message: `专题图发布：${selectedTemplate.value?.templateId || ""}`.trim(), manifest })
    if (!res.success) {
      $message(res.message || "保存失败")
      return
    }
    $message("已写入新版本", "success")
  } finally {
    savingRevision.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.tpl-row {
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.meta {
  font-size: 12px;
  color: var(--mars-text-color);
  opacity: 0.9;
}
</style>
