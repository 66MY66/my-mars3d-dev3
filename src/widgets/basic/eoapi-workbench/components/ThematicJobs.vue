<template>
  <div class="thematic-jobs">
    <!-- API 不可用提示 -->
    <div v-if="!apiAvailable" class="api-unavailable">
      <a-alert
        type="warning"
        show-icon
        message="专题图服务暂未启用"
        description="当前 eoAPI 后端未部署专题图生成服务（/thematics 端点）。此功能需要额外部署专题图处理模块。"
      />
      <div class="unavailable-info">
        <p>您可以继续使用以下功能：</p>
        <ul>
          <li>数据集浏览与查询</li>
          <li>影像加载与可视化</li>
          <li>分屏对比</li>
          <li>时间轴演化</li>
        </ul>
      </div>
    </div>

    <!-- 正常内容 -->
    <template v-else>
    <!-- 头部工具栏 -->
    <div class="jobs-header">
      <mars-button type="primary" size="small" @click="handleCreateJob">
        <mars-icon icon="plus" width="14" />
        新建任务
      </mars-button>
      <mars-button size="small" @click="handleRefresh" :loading="refreshing">
        <mars-icon icon="refresh" width="14" />
        刷新
      </mars-button>
      <a-select
        v-model:value="statusFilter"
        size="small"
        style="width: 120px"
        placeholder="状态筛选"
        @change="handleFilterChange"
      >
        <a-select-option value="">全部</a-select-option>
        <a-select-option value="queued">排队中</a-select-option>
        <a-select-option value="running">运行中</a-select-option>
        <a-select-option value="succeeded">已完成</a-select-option>
        <a-select-option value="failed">失败</a-select-option>
      </a-select>
    </div>

    <!-- 任务列表 -->
    <div class="jobs-list">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <a-spin tip="加载任务列表..." />
      </div>

      <!-- 空状态 -->
      <a-empty v-else-if="jobs.length === 0" description="暂无专题图任务" />

      <!-- 任务列表 -->
      <div v-else class="jobs-items">
        <div
          v-for="job in jobs"
          :key="job.jobId"
          class="job-item"
          :class="{ 'job-item-active': selectedJobId === job.jobId }"
          @click="handleSelectJob(job)"
        >
          <!-- 任务状态图标 -->
          <div class="job-status-icon">
            <mars-icon v-if="job.status === 'queued' || job.status === 'running'" icon="loading" :class="'status-running'" width="16" />
            <mars-icon v-else-if="job.status === 'succeeded'" icon="success" :class="'status-success'" width="16" />
            <mars-icon v-else-if="job.status === 'failed'" icon="close" :class="'status-failed'" width="16" />
            <mars-icon v-else icon="stop" :class="'status-cancelled'" width="16" />
          </div>

          <!-- 任务信息 -->
          <div class="job-info">
            <div class="job-title">{{ getTemplateDisplayName(job.templateId) }}</div>
            <div class="job-meta">
              <span class="job-id">ID: {{ job.jobId.slice(0, 8) }}</span>
              <span class="job-time">{{ formatTime(job.createdAt) }}</span>
            </div>
            <!-- 进度条 -->
            <div v-if="job.status === 'running'" class="job-progress">
              <a-progress
                :percent="job.progress.percent"
                :status="job.progress.percent === 100 ? 'success' : 'active'"
                size="small"
              />
              <span class="progress-message">{{ job.progress.message || job.progress.stage }}</span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="job-actions">
            <mars-button
              v-if="job.status === 'running'"
              size="small"
              type="text"
              @click.stop="handleCancelJob(job)"
            >
              取消
            </mars-button>
            <mars-button
              v-if="job.status === 'failed'"
              size="small"
              type="text"
              @click.stop="handleRetryJob(job)"
            >
              重试
            </mars-button>
            <mars-button
              v-if="job.status === 'succeeded'"
              size="small"
              type="text"
              @click.stop="handleViewResult(job)"
            >
              查看结果
            </mars-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 任务详情面板 -->
    <div v-if="selectedJob" class="job-detail-panel">
      <div class="detail-header">
        <h4>任务详情</h4>
        <mars-button type="text" size="small" @click="handleCloseDetail">
          <mars-icon icon="close" width="16" />
        </mars-button>
      </div>

      <div class="detail-content">
        <!-- 基本信息 -->
        <div class="detail-section">
          <div class="detail-row">
            <span class="detail-label">模板：</span>
            <span class="detail-value">{{ selectedJob.templateId }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">版本：</span>
            <span class="detail-value">{{ selectedJob.templateVersion }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">状态：</span>
            <a-tag :color="getStatusColor(selectedJob.status)">
              {{ getStatusName(selectedJob.status) }}
            </a-tag>
          </div>
          <div v-if="selectedJob.datasetId" class="detail-row">
            <span class="detail-label">数据集：</span>
            <span class="detail-value">{{ selectedJob.datasetId }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">创建时间：</span>
            <span class="detail-value">{{ formatTime(selectedJob.createdAt) }}</span>
          </div>
        </div>

        <!-- 进度信息 -->
        <div v-if="selectedJob.status === 'running'" class="detail-section">
          <h5>执行进度</h5>
          <a-progress
            :percent="selectedJob.progress.percent"
            :status="selectedJob.progress.percent === 100 ? 'success' : 'active'"
          />
          <div class="progress-details">
            <span>阶段: {{ selectedJob.progress.stage || "处理中" }}</span>
            <span v-if="selectedJob.progress.startTime">
              耗时: {{ getDuration(selectedJob.progress.startTime) }}
            </span>
          </div>
        </div>

        <!-- 结果信息 -->
        <div v-if="jobResult && selectedJob.status === 'succeeded'" class="detail-section">
          <h5>生成结果</h5>

          <!-- 附件列表 -->
          <div v-if="jobResult.artifacts && jobResult.artifacts.length > 0" class="artifacts-list">
            <div v-for="artifact in jobResult.artifacts" :key="artifact.artifactId" class="artifact-item">
              <span class="artifact-icon">{{ getArtifactIcon(artifact.type) }}</span>
              <span class="artifact-name">{{ artifact.name }}</span>
              <mars-button size="small" type="text" @click="handlePreviewArtifact(artifact)">
                预览
              </mars-button>
              <mars-button v-if="canAddArtifactToMap(artifact)" size="small" type="text" @click="handleAddArtifactToMap(artifact)">
                上图
              </mars-button>
              <mars-button size="small" type="text" @click="handleDownloadArtifact(artifact)">
                下载
              </mars-button>
            </div>
          </div>

          <!-- 服务引用 -->
          <div v-if="jobResult.serviceRef" class="service-ref">
            <div class="service-header">
              <span>发布服务</span>
              <mars-button size="small" type="primary" @click="handleAddServiceLayer(jobResult.serviceRef)">
                加载到地图
              </mars-button>
            </div>
            <div class="service-info">
              <span>类型: {{ jobResult.serviceRef.type }}</span>
              <span>层级: {{ jobResult.serviceRef.minZoom }} - {{ jobResult.serviceRef.maxZoom }}</span>
            </div>
          </div>

          <!-- 归档状态 -->
          <div v-if="jobResult.archiveRef" class="archive-ref">
            <span>归档状态: </span>
            <a-tag :color="jobResult.archiveRef.status === 'completed' ? 'green' : 'orange'">
              {{ jobResult.archiveRef.status }}
            </a-tag>
            <mars-button
              v-if="jobResult.archiveRef.archiveUrl"
              size="small"
              type="text"
              @click="handleOpenArchiveUrl(jobResult.archiveRef.archiveUrl)"
            >
              查看归档
            </mars-button>
          </div>

          <!-- 归档操作 -->
          <div v-if="!jobResult.archiveRef || jobResult.archiveRef.status === 'pending'" class="archive-action">
            <mars-button size="small" @click="handlePushToArchive(selectedJob)">
              <mars-icon icon="upload" width="14" />
              推送归档
            </mars-button>
          </div>
        </div>

        <!-- 错误信息 -->
        <div v-if="selectedJob.status === 'failed'" class="detail-section error-section">
          <h5>错误信息</h5>
          <div class="error-message">
            {{ selectedJob.progress.message || "任务执行失败，请查看日志" }}
          </div>
          <mars-button size="small" @click="handleViewLogs(selectedJob)">
            查看日志
          </mars-button>
        </div>
      </div>
    </div>

    <!-- 新建任务对话框 -->
    <mars-task-modal
      v-model:open="showCreateDialog"
      title="新建专题图任务"
      width="600px"
      @ok="handleSubmitCreate"
      @cancel="handleCancelCreate"
    >
      <a-form :model="createForm" layout="vertical">
        <a-form-item label="选择模板" required>
          <a-select
            v-model:value="createForm.templateId"
            placeholder="选择专题图模板"
            :loading="loadingTemplates"
          >
            <a-select-option v-for="tpl in templates" :key="tpl.templateId" :value="tpl.templateId">
              {{ tpl.name }} (v{{ tpl.templateVersion }})
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="数据集">
          <a-input v-model:value="createForm.datasetId" placeholder="数据集 ID（可选）" />
        </a-form-item>

        <a-form-item label="输出格式">
          <a-select v-model:value="createForm.outputFormat" placeholder="选择输出格式">
            <a-select-option value="png">PNG</a-select-option>
            <a-select-option value="jpg">JPEG</a-select-option>
            <a-select-option value="pdf">PDF</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="发布为服务">
          <a-checkbox v-model:checked="createForm.shouldPublish">
            发布为 XYZ 瓦片服务
          </a-checkbox>
        </a-form-item>
      </a-form>
    </mars-task-modal>

    <mars-task-modal v-model:open="previewOpen" :title="previewTitle" :footer="false" width="760px" @cancel="closePreview">
      <div class="artifact-preview">
        <ArtifactPreview v-if="previewUrl" :url="previewUrl" :mime="previewMime" />
        <a-empty v-else description="暂无可预览内容" />
      </div>
    </mars-task-modal>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from "vue"
import { $message } from "@mars/components/mars-ui/index"
import {
  getJobs,
  getJob,
  getJobResult,
  createJob,
  cancelJob,
  retryJob,
  pushToArchive,
  getTemplates
} from "../../dataset-repository/services/eoapi-thematics"
import { buildLayerConfig, createLayerIdFromService } from "../../../eoapi-workbench/services/eoapi-services"
import {
  ThematicJob,
  ThematicJobResult,
  ThematicTemplate,
  JobStatus,
  Artifact,
  ServiceRef
} from "../../dataset-repository/types/eoapi-types"
import ArtifactPreview from "../../dataset-repository/components/ArtifactPreview.vue"
import { ensureUniqueMapLayerId, normalizeLayerIdToken } from "../../dataset-repository/services/layer-id"
import { restoreWorkspace } from "../../dataset-repository/workspace/restore"
import * as mapWork from "../map"

// ============ 状态变量 ============

const apiAvailable = ref(true) // API 是否可用
const loading = ref(false)
const refreshing = ref(false)
const jobs = ref<ThematicJob[]>([])
const templates = ref<ThematicTemplate[]>([])
const loadingTemplates = ref(false)
const statusFilter = ref<JobStatus | "">("")
const selectedJobId = ref<string>("")
const selectedJob = ref<ThematicJob | null>(null)
const jobResult = ref<ThematicJobResult | null>(null)
const showCreateDialog = ref(false)

const createForm = ref({
  templateId: "",
  datasetId: "",
  outputFormat: "png",
  shouldPublish: true
})

const previewOpen = ref(false)
const previewUrl = ref("")
const previewTitle = ref("")
const previewMime = ref("")

// 轮询间隔
let pollInterval: number | null = null

// ============ 初始化 ============

onMounted(async () => {
  await checkApiAvailable()
  if (apiAvailable.value) {
    await loadTemplates()
    await loadJobs()
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})

// ============ API 可用性检查 ============

async function checkApiAvailable() {
  const result = await getTemplates()
  if (!result.success && result.code === 404) {
    apiAvailable.value = false
  }
}

// ============ 数据加载 ============

async function loadTemplates() {
  if (!apiAvailable.value) {
    return
  }
  loadingTemplates.value = true
  const result = await getTemplates()
  if (result.success && result.data) {
    templates.value = result.data.templates || []
  }
  loadingTemplates.value = false
}

async function loadJobs() {
  if (!apiAvailable.value) {
    return
  }
  loading.value = true
  const result = await getJobs({
    status: statusFilter.value || undefined,
    limit: 20
  })
  if (result.success && result.data) {
    jobs.value = result.data
  }
  loading.value = false
}

function handleRefresh() {
  refreshing.value = true
  loadJobs().then(() => {
    refreshing.value = false
  })
}

function handleFilterChange() {
  loadJobs()
}

// ============ 轮询更新 ============

function startPolling() {
  pollInterval = window.setInterval(() => {
    const hasRunning = jobs.value.some(
      j => j.status === "running" || j.status === "queued"
    )
    if (hasRunning) {
      loadJobs()
      if (selectedJobId.value && selectedJob.value?.status === "running") {
        updateSelectedJobDetail()
      }
    }
  }, 3000)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

// ============ 任务选择与详情 ============

function handleSelectJob(job: ThematicJob) {
  selectedJobId.value = job.jobId
  selectedJob.value = job
  loadJobResult(job.jobId)
}

function handleCloseDetail() {
  selectedJobId.value = ""
  selectedJob.value = null
  jobResult.value = null
}

async function loadJobResult(jobId: string) {
  const result = await getJobResult(jobId)
  if (result.success && result.data) {
    jobResult.value = result.data
  }
}

async function updateSelectedJobDetail() {
  if (!selectedJobId.value) {
    return
  }
  const result = await getJob(selectedJobId.value)
  if (result.success && result.data) {
    selectedJob.value = result.data
    if (result.data.status === "succeeded") {
      loadJobResult(selectedJobId.value)
    }
  }
}

// ============ 任务操作 ============

function handleCreateJob() {
  showCreateDialog.value = true
}

async function handleSubmitCreate() {
  if (!createForm.value.templateId) {
    $message("请选择模板")
    return
  }

  const result = await createJob({
    templateId: createForm.value.templateId,
    datasetId: createForm.value.datasetId || undefined,
    outputFormat: createForm.value.outputFormat,
    publish: createForm.value.shouldPublish ? { type: "xyz" } : undefined
  })

  if (result.success && result.data) {
    $message("任务已创建")
    showCreateDialog.value = false
    loadJobs()
    handleSelectJob(result.data)
  } else {
    $message(result.message || "创建失败")
  }
}

function handleCancelCreate() {
  showCreateDialog.value = false
}

async function handleCancelJob(job: ThematicJob) {
  const result = await cancelJob(job.jobId)
  if (result.success) {
    $message("任务已取消")
    loadJobs()
  } else {
    $message(result.message || "取消失败")
  }
}

async function handleRetryJob(job: ThematicJob) {
  const result = await retryJob(job.jobId)
  if (result.success && result.data) {
    $message("任务已重新启动")
    loadJobs()
    handleSelectJob(result.data)
  } else {
    $message(result.message || "重试失败")
  }
}

function handleViewResult(job: ThematicJob) {
  handleSelectJob(job)
}

// ============ 归档操作 ============

async function handlePushToArchive(job: ThematicJob) {
  if (!job.datasetId) {
    $message("缺少数据集 ID，无法归档")
    return
  }

  $message("正在推送归档...")
  const result = await pushToArchive({
    datasetId: job.datasetId,
    revisionId: job.revisionId,
    jobId: job.jobId
  })

  if (result.success && result.data) {
    if (result.data.status === "completed") {
      $message("归档成功")
    } else {
      $message(`归档状态: ${result.data.status}`)
    }
    loadJobResult(job.jobId)
  } else {
    $message(result.message || "归档失败")
  }
}

// ============ 服务加载到地图 ============

function handleAddServiceLayer(serviceRef: ServiceRef) {
  const layerId = createLayerIdFromService(serviceRef)
  const config = buildLayerConfig(serviceRef)

  const layer = mapWork.addXyzLayer(layerId, config.url, {
    minZoom: config.minZoom,
    maxZoom: config.maxZoom,
    bounds: config.bounds
  })

  if (layer) {
    $message(`已加载服务图层: ${serviceRef.serviceId}`)
  } else {
    $message("加载图层失败")
  }
}

// ============ 附件操作 ============

function handleDownloadArtifact(artifact: Artifact) {
  window.open(artifact.url, "_blank")
}

function canPreviewArtifact(artifact: Artifact): boolean {
  const mime = String((artifact as any)?.mime || "")
  if (mime.startsWith("image/")) {
    return true
  }
  if (mime === "application/pdf" || mime === "text/html") {
    return true
  }
  const url = String(artifact?.url || "")
  if (/\.(pdf|html?)(\?.*)?$/i.test(url)) {
    return true
  }
  return /\.(png|jpg|jpeg|gif|webp|tif|tiff)(\?.*)?$/i.test(url)
}

function handlePreviewArtifact(artifact: Artifact) {
  if (!artifact?.url) {
    return
  }
  if (!canPreviewArtifact(artifact)) {
    handleDownloadArtifact(artifact)
    return
  }
  previewTitle.value = artifact.name || "附件预览"
  previewMime.value = String((artifact as any)?.mime || "")
  previewUrl.value = artifact.url
  previewOpen.value = true
}

function closePreview() {
  previewOpen.value = false
  previewUrl.value = ""
  previewTitle.value = ""
  previewMime.value = ""
}

function isTiffArtifact(a: Artifact): boolean {
  const mime = String((a as any)?.mime || "").toLowerCase()
  if (mime.includes("tiff")) {
    return true
  }
  const url = String((a as any)?.url || "")
  return /\.(tif|tiff)(\?.*)?$/i.test(url)
}

function isImageArtifact(a: Artifact): boolean {
  const mime = String((a as any)?.mime || "")
  if (mime.startsWith("image/")) {
    return true
  }
  const url = String((a as any)?.url || "")
  return /\.(png|jpg|jpeg|gif|webp|tif|tiff)(\?.*)?$/i.test(url)
}

function canAddArtifactToMap(a: Artifact): boolean {
  return isImageArtifact(a)
}

function resolveBoundsFromMetadata(meta: any): [number, number, number, number] | null {
  const candidates = [meta?.bounds, meta?.bbox, meta?.extent?.bbox, meta?.coverage?.bbox, meta?.coverage?.bounds]
  for (const c of candidates) {
    const arr = Array.isArray(c) ? c : null
    if (!arr || arr.length !== 4) {
      continue
    }
    const west = Number(arr[0])
    const south = Number(arr[1])
    const east = Number(arr[2])
    const north = Number(arr[3])
    if ([west, south, east, north].every((n) => Number.isFinite(n))) {
      return [west, south, east, north]
    }
  }
  return null
}

function shrinkBounds(bounds: [number, number, number, number], ratio = 0.18): [number, number, number, number] {
  const [west, south, east, north] = bounds
  const cx = (west + east) / 2
  const cy = (south + north) / 2
  const dx = Math.max(0.00001, Math.abs(east - west) * ratio)
  const dy = Math.max(0.00001, Math.abs(north - south) * ratio)
  return [cx - dx, cy - dy, cx + dx, cy + dy]
}

async function handleAddArtifactToMap(a: Artifact) {
  const datasetId = String((selectedJob.value as any)?.datasetId || "")
  if (!datasetId) {
    $message("缺少数据集 ID")
    return
  }
  const map = mapWork.getMap()
  if (!map) {
    $message("地图尚未初始化")
    return
  }
  const url = String(a?.url || "")
  if (!url) {
    $message("缺少附件地址")
    return
  }
  const datasetToken = normalizeLayerIdToken(datasetId, "dataset")
  const groupId = `myrepo_group_${datasetToken}_thematics`
  const desiredLayerId = `myrepo_${datasetToken}_artifact_${normalizeLayerIdToken(a.artifactId, "artifact")}`
  const layerId = ensureUniqueMapLayerId(map as any, desiredLayerId, { fallbackBase: `myrepo_${datasetToken}_artifact` })

  const isXyz = /\{x\}|\{y\}|\{z\}/.test(url)
  let sourceType: any = "image"
  if (isXyz) {
    sourceType = "xyz"
  } else if (isTiffArtifact(a)) {
    sourceType = "geotiff"
  }
  const metaBounds = resolveBoundsFromMetadata((a as any)?.metadata)
  const defaultBounds = mapWork.getCurrentBounds ? mapWork.getCurrentBounds() : null
  const bounds = metaBounds || (defaultBounds ? shrinkBounds(defaultBounds) : null)
  const options = sourceType === "image" && bounds ? { bounds } : undefined

  try {
    await restoreWorkspace(map as any, {
      manifestVersion: "1.0",
      layers: [
        { id: groupId, name: `数据集成果/${datasetId}`, sourceType: "group", sourceRef: "", visible: true, order: 0 } as any,
        {
          id: layerId,
          name: String(a?.name || "专题附件"),
          sourceType: sourceType as any,
          sourceRef: url,
          pid: groupId,
          visible: true,
          opacity: 1,
          options,
          order: 1
        } as any
      ],
      createdAt: Date.now()
    } as any, {
      strategy: "overlay",
      conflictResolution: "skip",
      restoreView: false,
      restoreDrawFeatures: false
    })
    window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
    try {
      const layer: any = map.getLayerById?.(layerId)
      layer?.flyTo?.()
    } catch {
    }
    $message("已上图", "success")
  } catch (e: any) {
    $message(e?.message || "上图失败")
  }
}

function handleViewLogs(job: ThematicJob) {
  console.log("[eoAPI] 查看任务日志:", job.jobId)
  $message("日志详情功能待完善")
}

function handleOpenArchiveUrl(url: string) {
  window.open(url, "_blank")
}

// ============ 辅助函数 ============

function getTemplateDisplayName(templateId: string): string {
  const tpl = templates.value.find(t => t.templateId === templateId)
  return tpl?.name || templateId
}

function getStatusName(status: JobStatus): string {
  const names: Record<JobStatus, string> = {
    queued: "排队中",
    running: "运行中",
    succeeded: "已完成",
    failed: "失败",
    cancelled: "已取消"
  }
  return names[status] || status
}

function getStatusColor(status: JobStatus): string {
  const colors: Record<JobStatus, string> = {
    queued: "orange",
    running: "blue",
    succeeded: "green",
    failed: "red",
    cancelled: "default"
  }
  return colors[status] || "default"
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })
}

function getDuration(startTime: number): string {
  const elapsed = Date.now() - startTime
  const seconds = Math.floor(elapsed / 1000)
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`
  }
  return `${seconds}秒`
}

function getArtifactIcon(type: string): string {
  const icons: Record<string, string> = {
    thumbnail: "🖼️",
    report: "📄",
    export: "📦",
    log: "📋",
    data: "💾",
    other: "📁"
  }
  return icons[type] || "📁"
}
</script>

<style scoped lang="less">
.thematic-jobs {
  height: 100%;
  display: flex;
  flex-direction: column;

  .api-unavailable {
    padding: 20px;
    text-align: center;

    :deep(.ant-alert) {
      text-align: left;
      margin-bottom: 16px;
    }

    .unavailable-info {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      padding: 16px;
      text-align: left;

      p {
        color: var(--mars-text-color);
        margin-bottom: 8px;
      }

      ul {
        color: var(--mars-extra-text-color);
        margin: 0;
        padding-left: 20px;

        li {
          margin: 4px 0;
        }
      }
    }
  }

  .jobs-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .jobs-list {
    flex: 1;
    overflow-y: auto;

    .loading-container {
      padding: 40px;
      text-align: center;
    }

    .jobs-items {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .job-item {
      display: flex;
      align-items: center;
      padding: 10px 8px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      &.job-item-active {
        background: rgba(24, 144, 255, 0.1);
        border: 1px solid rgba(24, 144, 255, 0.3);
      }

      .job-status-icon {
        margin-right: 10px;
        font-size: 16px;

        .status-running { color: #1890ff; }
        .status-success { color: #52c41a; }
        .status-failed { color: #ff4d4f; }
        .status-cancelled { color: #999; }
      }

      .job-info {
        flex: 1;
        min-width: 0;

        .job-title {
          font-size: 14px;
          color: var(--mars-text-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .job-meta {
          font-size: 12px;
          color: var(--mars-extra-text-color);
          margin-top: 2px;

          .job-id {
            margin-right: 8px;
          }
        }

        .job-progress {
          margin-top: 4px;

          .progress-message {
            font-size: 12px;
            color: var(--mars-extra-text-color);
          }
        }
      }

      .job-actions {
        display: flex;
        gap: 4px;
      }
    }
  }

  .job-detail-panel {
    margin-top: 8px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      h4 {
        margin: 0;
        color: var(--mars-text-color);
      }
    }

    .detail-content {
      .detail-section {
        margin-bottom: 12px;

        h5 {
          color: var(--mars-extra-text-color);
          font-size: 12px;
          margin-bottom: 8px;
        }

        .detail-row {
          display: flex;
          padding: 4px 0;
          font-size: 13px;

          .detail-label {
            color: #aaa;
            width: 80px;
          }

          .detail-value {
            color: #fff;
          }
        }

        .progress-details {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #aaa;
          margin-top: 4px;
        }
      }

      .artifacts-list {
        .artifact-item {
          display: flex;
          align-items: center;
          padding: 6px 0;

          .artifact-icon {
            margin-right: 8px;
          }

          .artifact-name {
            flex: 1;
            color: #fff;
          }
        }
      }

      .service-ref {
        padding: 8px;
        background: rgba(0, 0, 0, 0.1);
        border-radius: 4px;
        margin-top: 8px;

        .service-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .service-info {
          font-size: 12px;
          color: #aaa;
          display: flex;
          gap: 16px;
        }
      }

      .archive-ref {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
      }

      .archive-action {
        margin-top: 8px;
      }

      .error-section {
        .error-message {
          color: #ff4d4f;
          background: rgba(255, 77, 79, 0.1);
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 8px;
        }
      }
    }
  }
}
</style>
