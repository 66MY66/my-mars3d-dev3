<template>
  <div class="thematic-jobs">
    <!-- API 不可用提示 -->
    <div v-if="!apiAvailable" class="api-unavailable">
      <a-alert
        class="service-status-alert"
        type="warning"
        show-icon
        message="专题图服务当前不可用"
        :description="requestError || '未取得真实服务响应，暂时无法创建、发布或归档任务。'"
      />
      <mars-button class="service-reconnect" size="small" @click="reconnectService"><mars-icon icon="refresh" color="currentColor" :width="14" />重新连接</mars-button>
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
    <div v-if="requestError" class="error-message" role="alert">{{ requestError }}</div>
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
        <a-select-option value="cancelled">已取消</a-select-option>
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
            <div class="job-progress">
              <span class="progress-message">{{ getStatusName(job.status) }} · {{ getThematicProgressMessage(job.progress, job.status) }}</span>
              <a-progress
                v-if="job.status === 'running' || job.status === 'queued'"
                :percent="job.progress?.percent || 0"
                :status="job.progress.percent === 100 ? 'success' : 'active'"
                size="small"
              />
              <div class="task-steps" aria-label="任务阶段"><span v-for="step in jobSteps(job)" :key="step.key" :class="step.state">{{ step.label }}</span></div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="job-actions">
            <mars-button
              v-if="job.status === 'running' || job.status === 'queued'"
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
        <button type="button" class="result-action is-icon" title="关闭任务详情" aria-label="关闭任务详情" @click="handleCloseDetail"><mars-icon icon="close" color="currentColor" :width="16" /></button>
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
            <span class="job-status-label" :class="`is-${selectedJob.status}`">
              {{ getStatusName(selectedJob.status) }}
            </span>
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
          <div class="task-steps" aria-label="成果阶段"><span v-for="step in jobSteps(selectedJob)" :key="step.key" :class="step.state">{{ step.label }}</span></div>
          <div class="result-section-heading"><h5>生成结果</h5><span>{{ jobResult.artifacts?.length || 0 }} 个文件</span></div>
          <div v-if="selectedJob.jobId.startsWith('local_job_')" class="result-demo-notice">本地模拟结果 · 非真实发布服务</div>

          <!-- 附件列表 -->
          <div v-if="jobResult.artifacts && jobResult.artifacts.length > 0" class="artifacts-list">
            <div v-for="artifact in jobResult.artifacts" :key="artifact.artifactId" class="artifact-item">
              <span class="artifact-icon"><mars-icon :icon="getArtifactIcon(artifact.type)" color="currentColor" :width="18" /></span>
              <div class="artifact-copy"><span class="artifact-name">{{ artifact.name }}</span><span class="artifact-format">{{ artifact.mime || artifact.type }}</span></div>
              <div class="artifact-actions">
                <button v-if="canPreviewArtifact(artifact)" type="button" class="result-action is-icon" :title="`预览 ${artifact.name}`" :aria-label="`预览 ${artifact.name}`" @click="handlePreviewArtifact(artifact)"><mars-icon icon="preview-open" color="currentColor" :width="16" /></button>
                <button v-if="canAddArtifactToMap(artifact)" type="button" class="result-action is-icon" :title="`上图 ${artifact.name}`" :aria-label="`上图 ${artifact.name}`" @click="handleAddArtifactToMap(artifact)"><mars-icon icon="layers" color="currentColor" :width="16" /></button>
                <button type="button" class="result-action is-icon" :title="`下载 ${artifact.name}`" :aria-label="`下载 ${artifact.name}`" @click="handleDownloadArtifact(artifact)"><mars-icon icon="download" color="currentColor" :width="16" /></button>
              </div>
            </div>
          </div>

          <!-- 服务引用 -->
          <div v-if="jobResult.serviceRef" class="service-ref">
            <div class="service-header">
              <h5>发布服务</h5>
              <div class="service-actions">
                <button type="button" class="result-action" @click="handleAddServiceLayer(jobResult.serviceRef)"><mars-icon icon="layers" color="currentColor" :width="15" />上图</button>
                <button type="button" class="result-action is-icon" title="定位服务" aria-label="定位服务" @click="handleLocateService(jobResult.serviceRef)"><mars-icon icon="local" color="currentColor" :width="16" /></button>
                <button type="button" class="result-action is-icon" title="导出成果" aria-label="导出成果" @click="handleExportResult"><mars-icon icon="download" color="currentColor" :width="16" /></button>
              </div>
            </div>
            <div class="service-info">
              <span>{{ resolveThematicServiceName(selectedJob, jobResult.serviceRef) }}</span>
              <span class="service-type">{{ jobResult.serviceRef.type.toUpperCase() }}</span>
              <span>层级: {{ jobResult.serviceRef.minZoom }} - {{ jobResult.serviceRef.maxZoom }}</span>
            </div>
            <p class="service-description">{{ resolveThematicServiceDescription(selectedJob, jobResult.serviceRef) || '暂无服务简介' }}</p>
            <div class="service-actions"><button type="button" class="result-action" @click="copyServiceLink(jobResult.serviceRef)">复制链接</button><button type="button" class="result-action" @click="openServiceLink(jobResult.serviceRef)">打开服务</button></div>
            <div v-if="selectedCartography" class="service-info"><span>提交的制图元数据：{{ selectedCartography.settings.title || '未填写标题' }}</span><span>比例尺档位 1:{{ selectedCartography.settings.scaleDenominator }}</span></div>
          </div>

          <!-- 归档状态 -->
          <div v-if="jobResult.archiveRef" class="archive-ref">
            <span>归档状态: </span>
            <a-tag :color="jobResult.archiveRef.status === 'completed' ? 'green' : 'orange'">
              {{ { pending: "归档中", completed: "已归档", failed: "归档失败" }[jobResult.archiveRef.status] }}
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
          <div v-if="!jobResult.archiveRef || jobResult.archiveRef.status === 'failed'" class="archive-action">
            <button type="button" class="result-action is-primary" :disabled="archiving.has(selectedJob.jobId)" @click="handlePushToArchive(selectedJob)">
              <mars-icon icon="upload" color="currentColor" :width="15" />
              推送归档
            </button>
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
      :ok-loading="submitting"
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
        <a-form-item label="清晰度"><a-select v-model:value="createForm.qualityPreset" aria-label="任务清晰度"><a-select-option value="standard">标准 · 1280px</a-select-option><a-select-option value="high">高清 · 2560px</a-select-option><a-select-option value="print">印刷 · 3840px</a-select-option></a-select></a-form-item>

        <a-form-item label="发布为服务">
          <a-checkbox v-model:checked="createForm.shouldPublish">
            同时发布二维地图服务
          </a-checkbox>
        </a-form-item>
        <template v-if="createForm.shouldPublish"><a-form-item label="服务类型"><a-select v-model:value="createForm.publishType" aria-label="发布服务类型"><a-select-option v-for="type in ['xyz', 'mvt', 'wms', 'wmts']" :key="type" :value="type">{{ type.toUpperCase() }}</a-select-option></a-select></a-form-item><a-form-item label="服务名称"><a-input v-model:value="createForm.publishName" aria-label="服务名称" /></a-form-item></template>
        <a-form-item v-if="createForm.shouldPublish" label="发布描述" required :validate-status="publishDescriptionInvalid ? 'error' : undefined" :help="publishDescriptionInvalid ? PUBLISH_DESCRIPTION_ERROR : undefined">
          <a-textarea ref="descriptionInputRef" v-model:value="createForm.description" aria-label="任务发布描述" aria-describedby="task-publish-description-feedback" :aria-invalid="publishDescriptionInvalid" :rows="3" placeholder="至少 5 个有效字符，空白不计入" @blur="publishDescriptionTouched = true" />
          <div id="task-publish-description-feedback" class="publish-description-feedback" :class="{ 'is-ready': isPublishDescriptionValid(createForm.description), 'is-short': publishDescriptionInvalid }" role="status">
            <span>{{ isPublishDescriptionValid(createForm.description) ? '已满足发布要求' : `还需 ${Math.max(0, MIN_PUBLISH_DESCRIPTION_LENGTH - publishDescriptionLength(createForm.description))} 个有效字符` }}</span>
            <strong>{{ publishDescriptionLength(createForm.description) }} / {{ MIN_PUBLISH_DESCRIPTION_LENGTH }}</strong>
          </div>
        </a-form-item>
        <a-form-item v-if="createForm.shouldPublish" label="出图比例尺档位" required :validate-status="publishScaleInvalid ? 'error' : undefined" :help="publishScaleInvalid ? SCALE_REQUIRED_MESSAGE : undefined">
          <a-select ref="scaleInputRef" v-model:value="cartographySettings.scaleDenominator" placeholder="请选择比例尺" aria-label="任务出图比例尺" :aria-invalid="publishScaleInvalid"><a-select-option v-for="denominator in SCALE_PRESETS" :key="denominator" :value="denominator">1:{{ denominator / 10000 }} 万</a-select-option></a-select>
        </a-form-item>
      </a-form>
    </mars-task-modal>
    <mars-task-modal v-model:open="logsOpen" title="任务日志" :footer="false" width="600px"><pre class="task-log">{{ logsText || '暂无日志' }}</pre></mars-task-modal>

    <mars-task-modal v-model:open="previewOpen" :title="previewTitle" :footer="false" :width="previewModalWidth" @cancel="closePreview">
      <div class="artifact-preview">
        <ArtifactPreview v-if="previewUrl" :url="previewUrl" :mime="previewMime" />
        <a-empty v-else description="暂无可预览内容" />
      </div>
    </mars-task-modal>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick, inject } from "vue"
import { isPublishDescriptionValid, MIN_PUBLISH_DESCRIPTION_LENGTH, publishDescriptionLength, PUBLISH_DESCRIPTION_ERROR } from "../services/publish-description"
import { SCALE_PRESETS, SCALE_REQUIRED_MESSAGE, validScale } from "../../thematic-workbench/cartography-layout"
import { cartographySettings, cartographySnapshot, rememberJobCartography, getJobCartography } from "../../thematic-workbench/cartography-state"
import { $message } from "@mars/components/mars-ui/index"
import {
  getJobs,
  getJob,
  getJobResult,
  createJob,
  cancelJob,
  retryJob,
  pushToArchive,
  getTemplates,
  getJobLogs,
  getArchiveStatus
} from "../services/eoapi-thematics"
import { buildLayerConfig, createLayerIdFromService } from "../../../eoapi-workbench/services/eoapi-services"
import {
  ThematicJob,
  ThematicJobResult,
  ThematicTemplate,
  JobStatus,
  Artifact,
  ServiceRef,
  ArchivePushResponse
} from "../types/eoapi-types"
import * as mapWork from "../map"
import ArtifactPreview from "./ArtifactPreview.vue"
import { ensureUniqueMapLayerId, normalizeLayerIdToken } from "../services/layer-id"
import { restoreWorkspace } from "../workspace/restore"
import { buildThematicProgressSteps, getThematicProgressMessage } from "../services/thematic-progress"
import { buildThematicResultGroup } from "../services/thematic-group"
import { buildThematicArchiveMetadata, pickThematicExportArtifact, downloadThematicArtifact, resolveThematicServiceName, resolveThematicServiceDescription } from "../services/thematic-export"
import { canAddServiceRefToMap, resolveServiceRefUrl, resolveServiceRefType, isLikely3DServiceRef, copyServiceRefUrl, openServiceRefUrl } from "../services/service-ref"

const props = defineProps<{
  datasetId?: string
  publishDescription?: string
  publishName?: string
}>()
const getMapInstance = inject<() => any>("getMapInstance", () => null)
function connectResultMap() {
  const map = getMapInstance()
  if (map && map !== mapWork.getMap()) { mapWork.onMounted(map) }
}

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
const lastLoadedLayerId = ref("")
const submitting = ref(false)
const requestError = ref("")
const logsOpen = ref(false)
const logsText = ref("")
const seenStatuses = new Map<string, JobStatus>()
const ownedJobs = new Map<string, ThematicJob>()
const autoLoadedJobs = new Set<string>()
const autoLoadingJobs = new Set<string>()
const archives = ref<Record<string, ArchivePushResponse>>({})
const archiving = ref(new Set<string>())
let pollingArchives = false

function jobSteps(job: ThematicJob) {
  const archive = archives.value[job.jobId] || (jobResult.value?.jobId === job.jobId ? jobResult.value.archiveRef : undefined)
  const steps = buildThematicProgressSteps(job.progress, job.status, archive?.status === "completed")
  if (archive?.status === "pending") { steps[4].state = "active" }
  if (archive?.status === "failed") { steps[4].state = "error" }
  return steps
}

async function pollArchives() {
  if (pollingArchives) { return }
  pollingArchives = true
  try {
    for (const [jobId, archive] of Object.entries(archives.value)) {
      if (archive.status !== "pending") { continue }
      const response = await getArchiveStatus(archive.archiveId)
      if (!response.success || !response.data) { continue }
      archives.value[jobId] = response.data
      if (jobResult.value?.jobId === jobId && jobResult.value.archiveRef) { Object.assign(jobResult.value.archiveRef, response.data) }
      if (response.data.status === "completed") { $message("专题成果归档完成") }
      if (response.data.status === "failed") { $message(response.data.message || "专题成果归档失败，可重新推送") }
    }
  } finally { pollingArchives = false }
}

const createForm = ref({
  templateId: "",
  datasetId: "",
  outputFormat: "png",
  qualityPreset: "standard",
  publishType: "xyz" as "xyz" | "mvt" | "wms" | "wmts",
  publishName: "",
  description: "",
  shouldPublish: true
})
const descriptionInputRef = ref<{ focus(): void } | null>(null)
const scaleInputRef = ref<{ focus(): void } | null>(null)
const publishDescriptionAttempted = ref(false)
const publishDescriptionTouched = ref(false)
const publishDescriptionInvalid = computed(() => createForm.value.shouldPublish && (publishDescriptionAttempted.value || publishDescriptionTouched.value) && !isPublishDescriptionValid(createForm.value.description))
const publishScaleInvalid = computed(() => createForm.value.shouldPublish && publishDescriptionAttempted.value && !validScale(cartographySettings.scaleDenominator))
const selectedCartography = computed(() => selectedJob.value ? getJobCartography(selectedJob.value) : null)

// 轮询间隔
let pollInterval: number | null = null

// ============ 初始化 ============

onMounted(async () => {
  if (typeof window !== "undefined") {
    previewViewportWidth.value = window.innerWidth
    window.addEventListener("resize", handlePreviewResize)
  }
  await checkApiAvailable()
  if (apiAvailable.value) {
    await loadTemplates()
    await loadJobs()
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", handlePreviewResize)
  }
  restorePreviewView()
})

// ============ API 可用性检查 ============

async function checkApiAvailable() {
  const result = await getTemplates(undefined, { localFallback: false })
  apiAvailable.value = result.success
  if (!result.success) { requestError.value = result.message || "专题图服务无法访问" }
}

async function reconnectService() {
  await checkApiAvailable()
  if (apiAvailable.value) { await loadTemplates(); await loadJobs(); stopPolling(); startPolling() }
}

// ============ 数据加载 ============

async function loadTemplates() {
  if (!apiAvailable.value) {
    return
  }
  loadingTemplates.value = true
  const result = await getTemplates(undefined, { localFallback: false })
  if (result.success && result.data) {
    templates.value = result.data.templates || []
  }
  loadingTemplates.value = false
}

async function loadJobs() {
  if (!apiAvailable.value || loading.value) {
    return
  }
  loading.value = true
  try {
  const result = await getJobs({
    status: statusFilter.value || undefined,
    datasetId: props.datasetId || undefined,
    limit: 20
  })
  if (result.success && result.data) {
    requestError.value = ""
    jobs.value = [...result.data].sort((a, b) => b.createdAt - a.createdAt)
    for (const job of result.data) { await observeJob(job) }
  } else {
    requestError.value = result.message || "任务服务不可用，未返回真实任务"
  }
  } catch (err) { requestError.value = err instanceof Error ? err.message : "任务加载失败" } finally { loading.value = false }
}

async function observeJob(job: ThematicJob) {
  const submitted = ownedJobs.get(job.jobId)
  if (submitted) {
    job.parameters = { ...submitted.parameters, ...job.parameters }
    job.publishParams = job.publishParams || submitted.publishParams
  }
  const previous = seenStatuses.get(job.jobId)
  seenStatuses.set(job.jobId, job.status)
  if (previous && previous !== job.status && job.status === "succeeded") { $message(`专题任务已完成：${getTemplateDisplayName(job.templateId)}`) }
  if (previous && previous !== job.status && job.status === "failed") { $message(`专题任务失败：${getThematicProgressMessage(job.progress, job.status)}`) }
  if (selectedJobId.value === job.jobId) { selectedJob.value = { ...selectedJob.value, ...job } }
  if (ownedJobs.has(job.jobId) && job.status === "succeeded" && !autoLoadedJobs.has(job.jobId) && !autoLoadingJobs.has(job.jobId)) {
    autoLoadingJobs.add(job.jobId)
    try {
      const result = await getJobResult(job.jobId)
      if (result.success && result.data) {
        if (selectedJobId.value === job.jobId) { jobResult.value = result.data }
        const layer = result.data.serviceRef ? await handleAddServiceLayer(result.data.serviceRef, job) : null
        if (layer) { autoLoadedJobs.add(job.jobId); $message("任务完成，已自动上图") }
      }
    } catch (err) { $message(err instanceof Error ? err.message : "自动上图失败，请在成果中重试") } finally { autoLoadingJobs.delete(job.jobId); ownedJobs.delete(job.jobId) }
  }
  if (job.status === "failed" || job.status === "cancelled") { ownedJobs.delete(job.jobId) }
}

watch(
  () => props.datasetId,
  (id) => {
    if (id) {
      createForm.value.datasetId = id
    }
    if (apiAvailable.value) {
      loadJobs()
    }
  },
  { immediate: true }
)

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
    pollArchives().catch(() => { requestError.value = "归档状态查询失败，将自动重试" })
    const hasRunning = jobs.value.some(
      j => j.status === "running" || j.status === "queued"
    )
    if (hasRunning || ownedJobs.size) {
      loadJobs()
      for (const id of ownedJobs.keys()) { if (!jobs.value.some(job => job.jobId === id)) { getJob(id).then(result => { if (result.success && result.data) { observeJob(result.data) } }) } }
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
  jobResult.value = null
  const result = await getJobResult(jobId)
  if (result.success && result.data && selectedJobId.value === jobId) {
    jobResult.value = result.data
    if (result.data.archiveRef) { archives.value[jobId] = result.data.archiveRef }
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
  createForm.value.description = props.publishDescription || ""
  createForm.value.publishName = props.publishName || ""
  publishDescriptionAttempted.value = false
  publishDescriptionTouched.value = false
  showCreateDialog.value = true
}

function openPublishDialog(templateId?: string) {
  if (!isPublishDescriptionValid(props.publishDescription || "")) {
    $message(PUBLISH_DESCRIPTION_ERROR)
    return
  }
  if (!validScale(cartographySettings.scaleDenominator)) {
    $message(SCALE_REQUIRED_MESSAGE)
    return
  }
  if (!apiAvailable.value) {
    $message("专题图服务暂未启用，暂时无法发布")
    return
  }
  createForm.value.shouldPublish = true
  createForm.value.templateId = templates.value.some(template => template.templateId === templateId) ? templateId! : ""
  handleCreateJob()
}

defineExpose({ openPublishDialog })

async function handleSubmitCreate() {
  if (submitting.value) { return }
  publishDescriptionAttempted.value = true
  if (createForm.value.shouldPublish && !isPublishDescriptionValid(createForm.value.description)) {
    $message(PUBLISH_DESCRIPTION_ERROR)
    nextTick(() => descriptionInputRef.value?.focus?.())
    return
  }
  if (createForm.value.shouldPublish && !validScale(cartographySettings.scaleDenominator)) {
    $message(SCALE_REQUIRED_MESSAGE)
    nextTick(() => scaleInputRef.value?.focus?.())
    return
  }
  if (!createForm.value.templateId) {
    $message("请选择模板")
    return
  }

  const snapshot = cartographySnapshot()
  const publish = createForm.value.shouldPublish ? { type: createForm.value.publishType, name: createForm.value.publishName.trim(), description: createForm.value.description.trim(), metadata: { cartography: snapshot, dimensions: 2, description: createForm.value.description.trim() } } : undefined
  const parameters = {
    templateSnapshot: JSON.parse(JSON.stringify(templates.value.find(template => template.templateId === createForm.value.templateId) || null)),
    cartography: snapshot,
prefer2D: true,
serviceDimensions: 2,
effects3D: snapshot.effects,
    qualityPreset: createForm.value.qualityPreset,
    outputWidth: { standard: 1280, high: 2560, print: 3840 }[createForm.value.qualityPreset],
    publishName: createForm.value.publishName.trim(),
publishDesc: createForm.value.description.trim(),
    includeTitle: snapshot.settings.enabled?.title !== false,
includeLegend: snapshot.settings.enabled?.legend !== false,
    includeScale: snapshot.settings.enabled?.scale !== false,
includeNorth: snapshot.settings.enabled?.north !== false,
    includeText: snapshot.settings.enabled?.text === true,
includeIcon: snapshot.settings.enabled?.image === true,
    notes: snapshot.settings.text,
title: snapshot.settings.title,
legendTitle: snapshot.settings.legendTitle
  }
  submitting.value = true
  try {
  const result = await createJob({
    templateId: createForm.value.templateId,
    datasetId: createForm.value.datasetId || undefined,
    outputFormat: createForm.value.outputFormat,
    parameters,
    publish
  })

  if (result.success && result.data) {
    rememberJobCartography(result.data.jobId, snapshot)
    result.data.parameters = { ...parameters, ...result.data.parameters, cartography: snapshot }
    result.data.publishParams = result.data.publishParams || publish
    ownedJobs.set(result.data.jobId, result.data)
    seenStatuses.set(result.data.jobId, "queued")
    $message("任务已创建")
    showCreateDialog.value = false
    loadJobs()
    handleSelectJob(result.data)
    await observeJob(result.data)
  } else {
    $message(result.message || "创建失败")
  }
  } catch (err) { $message(err instanceof Error ? err.message : "创建失败") } finally { submitting.value = false }
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
    result.data.parameters = result.data.parameters || job.parameters
    result.data.publishParams = result.data.publishParams || job.publishParams
    const snapshot = getJobCartography(job)
    if (snapshot) { rememberJobCartography(result.data.jobId, snapshot) }
    ownedJobs.set(result.data.jobId, result.data)
    seenStatuses.set(result.data.jobId, "queued")
    loadJobs()
    handleSelectJob(result.data)
    await observeJob(result.data)
  } else {
    $message(result.message || "重试失败")
  }
}

function handleViewResult(job: ThematicJob) {
  handleSelectJob(job)
}

// ============ 归档操作 ============

async function handlePushToArchive(job: ThematicJob) {
  if (archiving.value.has(job.jobId) || archives.value[job.jobId]?.status === "pending") { return }
  if (!job.datasetId) {
    $message("缺少数据集 ID，无法归档")
    return
  }

  archiving.value.add(job.jobId)
  try {
  const response = jobResult.value?.jobId === job.jobId ? { success: true, data: jobResult.value } : await getJobResult(job.jobId)
  if (!response.success || !response.data) { $message("无法读取完整成果，未执行归档"); return }
  const metadata = buildThematicArchiveMetadata(job, response.data)
  const snapshot = getJobCartography(job)
  if (snapshot) { Object.assign(metadata, { cartography: snapshot, effects3D: snapshot.effects, annotations: snapshot.symbols, text: snapshot.settings.text, decorationConfig: snapshot.settings }) }
  $message("正在推送归档...")
  const result = await pushToArchive({
    datasetId: job.datasetId,
    revisionId: job.revisionId,
    jobId: job.jobId,
    artifacts: response.data.artifacts.map(artifact => artifact.artifactId),
    metadata
  })

  if (result.success && result.data) {
    archives.value[job.jobId] = result.data
    if (jobResult.value?.jobId === job.jobId) {
      jobResult.value.archiveRef = { archiveSystem: "", archivedAt: 0, ...jobResult.value.archiveRef, ...result.data }
    }
    if (result.data.status === "completed") {
      $message("归档成功")
    } else {
      $message(`归档状态: ${result.data.status}`)
    }
  } else {
    $message(result.message || "归档失败")
  }
  } catch (err) { $message(err instanceof Error ? err.message : "归档失败") } finally { archiving.value.delete(job.jobId) }
}

// ============ 服务加载到地图 ============

async function handleAddServiceLayer(serviceRef: ServiceRef, owner: ThematicJob | null = selectedJob.value) {
  connectResultMap()
  if (!canAddServiceRefToMap(serviceRef)) { $message("该服务无法直接上图"); return null }
  const datasetId = owner?.datasetId || props.datasetId || "未绑定数据集"
  const group = buildThematicResultGroup(datasetId)
  mapWork.ensureGroupLayer(group.rootGroupId, group.rootGroupName)
  mapWork.ensureGroupLayer(group.thematicGroupId, group.thematicGroupName, group.rootGroupId)
  const layerId = createLayerIdFromService(serviceRef)
  const config = buildLayerConfig(serviceRef)
  const url = resolveServiceRefUrl(serviceRef, { prefer2D: true })
  if (!url) { $message("该三维服务没有可用的二维降级地址"); return null }
  const options = { name: resolveThematicServiceName(owner, serviceRef) || `专题服务-${serviceRef.serviceId}`, pid: group.thematicGroupId, bounds: config.bounds, minZoom: config.minZoom, maxZoom: config.maxZoom }
  const type = resolveServiceRefType(serviceRef)
  const protocolOptions = isLikely3DServiceRef(serviceRef)
    ? { ...serviceRef.metadata, ...(serviceRef as any).fallback2d, ...serviceRef.metadata?.fallback2d }
    : serviceRef.metadata
  let layer: any = null
  if (/^data:application\/geo\+json/i.test(url)) {
    const idx = url.indexOf(",")
    const raw = idx >= 0 ? url.slice(idx + 1) : ""
    try {
      const json = JSON.parse(decodeURIComponent(raw))
      layer = (mapWork as any).addGeoJsonLayer?.(layerId, json, {
        ...options
      })
    } catch {
      layer = null
    }
  } else if (type === "xyz") {
    layer = mapWork.addXyzLayer(layerId, url, options)
  } else {
    try { layer = await mapWork.addThematicProtocolLayer(layerId, type, url, { ...protocolOptions, ...options }) } catch (err) { $message(err instanceof Error ? err.message : "服务上图失败"); return null }
  }

  if (layer) {
    lastLoadedLayerId.value = layerId
    $message(`已加载服务图层: ${serviceRef.serviceId}`)
    if (isLikely3DServiceRef(serviceRef)) { $message("第三方三维服务已使用配套二维服务加载") }
    window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
  } else {
    $message("加载图层失败")
  }
  return layer
}

async function copyServiceLink(service: ServiceRef) { if (!await copyServiceRefUrl(service)) { $message("没有可用的二维服务地址，或剪贴板不可用") } else { $message("已复制二维服务链接") } }
function openServiceLink(service: ServiceRef) { if (!openServiceRefUrl(service)) { $message("没有可用的二维服务地址") } }

function handleLocateService(serviceRef: ServiceRef) {
  connectResultMap()
  const bounds = (serviceRef as any)?.bounds as [number, number, number, number] | undefined
  if (bounds && bounds.length === 4) {
    mapWork.flyToBbox(bounds, 1.2)
    return
  }
  const id = lastLoadedLayerId.value
  if (!id) {
    return
  }
  try {
    const map = (mapWork as any).getMap?.()
    const layer = map?.getLayerById?.(id)
    layer?.flyTo?.()
  } catch {
  }
}

function handleExportResult() {
  const res = jobResult.value
  if (!res) {
    return
  }
  const artifacts = Array.isArray(res.artifacts) ? res.artifacts : []
  const preferred = pickThematicExportArtifact(artifacts, selectedJob.value?.outputFormat)
  if (!preferred?.url) {
    $message("未找到可导出的附件")
    return
  }
  downloadThematicArtifact(preferred)
}

// ============ 附件操作 ============

const previewOpen = ref(false)
const previewUrl = ref("")
const previewTitle = ref("")
const previewMime = ref("")
const previewViewportWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1366)
const previewViewState = ref<any | null>(null)

const previewModalWidth = computed(() => {
  if (previewViewportWidth.value <= 768) {
    return "calc(100vw - 24px)"
  }
  if (previewViewportWidth.value <= 1280) {
    return "calc(100vw - 96px)"
  }
  return "960px"
})

function handlePreviewResize() {
  previewViewportWidth.value = window.innerWidth
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
  previewViewState.value = mapWork.getViewState ? mapWork.getViewState() : null
  previewTitle.value = artifact.name || "附件预览"
  previewMime.value = String((artifact as any)?.mime || "")
  previewUrl.value = artifact.url
  previewOpen.value = true
  const bounds = resolvePreviewBounds(artifact)
  if (bounds) {
    mapWork.flyToBbox(bounds, 0.9)
  }
}

function closePreview() {
  previewOpen.value = false
  previewUrl.value = ""
  previewTitle.value = ""
  previewMime.value = ""
  restorePreviewView()
}

function restorePreviewView() {
  if (!previewViewState.value) {
    return
  }
  mapWork.flyToViewState(previewViewState.value, 0.9)
  previewViewState.value = null
}

function handleDownloadArtifact(artifact: Artifact) {
  window.open(artifact.url, "_blank")
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

function resolvePreviewBounds(artifact: Artifact): [number, number, number, number] | null {
  return (
    resolveBoundsFromMetadata((artifact as any)?.metadata) ||
    resolveBoundsFromMetadata((selectedJob.value as any)?.metadata) ||
    resolveBoundsFromMetadata((jobResult.value as any)?.metadata) ||
    null
  )
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
  connectResultMap()
  const datasetId = String((selectedJob.value as any)?.datasetId || props.datasetId || "")
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
  const group = buildThematicResultGroup(datasetId)
  const groupId = group.thematicGroupId
  mapWork.ensureGroupLayer(group.rootGroupId, group.rootGroupName)
  mapWork.ensureGroupLayer(groupId, group.thematicGroupName, group.rootGroupId)

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
        {
          id: layerId,
          name: String(a?.name || "专题附件"),
          sourceType: sourceType as any,
          sourceRef: url,
          pid: groupId,
          visible: true,
          opacity: 1,
          options
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
    mapWork.flyToLayer(layerId)
    $message("已上图", "success")
  } catch (e: any) {
    $message(e?.message || "上图失败")
  }
}

async function handleViewLogs(job: ThematicJob) {
  logsOpen.value = true; logsText.value = "加载中..."
  const result = await getJobLogs(job.jobId, { limit: 200 })
  logsText.value = result.success && result.data ? result.data.entries.map(entry => `${new Date(entry.timestamp).toLocaleString()} [${entry.level}] ${entry.stage || ""} ${entry.message}`).join("\n") : result.message || "日志加载失败"
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
    thumbnail: "pic",
    report: "file-text",
    export: "folder-download",
    log: "list",
    data: "file-text",
    other: "folder-open"
  }
  return icons[type] || "folder-open"
}
</script>

<style scoped lang="less">
.task-steps { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 10px 0; font-size: 12px; color: var(--mars-extra-text-color); }
.task-steps span { padding-bottom: 4px; border-bottom: 2px solid currentColor; opacity: .65; }
.task-steps .active { color: #49a6e9; opacity: 1; }
.task-steps .done { color: #329b73; opacity: 1; }
.task-steps .error { color: #e66c61; opacity: 1; }
.task-log { max-height: 400px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--mars-text-color); }
.service-description { color: var(--result-ink); overflow-wrap: anywhere; font-size: 12px; line-height: 1.6; }
.publish-description-feedback { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 7px; color: var(--mars-text-color-secondary, #aebccc); font-size: 11px; line-height: 1.4; }
.publish-description-feedback strong { color: inherit; font-variant-numeric: tabular-nums; white-space: nowrap; }
.publish-description-feedback.is-short { color: #f3b76a; }
.publish-description-feedback.is-ready { color: #6bd4b0; }
.thematic-jobs {
  --result-ink: #24364b;
  --result-muted: #526579;
  --result-line: #d4dee8;
  --result-hover: #eaf2fa;
  --result-accent: #16659d;
  --result-success: #227544;
  --result-warning: #895900;
  --result-danger: #b63836;
  --service-warning-surface: #fff8eb;
  --service-warning-line: #d1ad67;
  color: var(--result-ink);
  container-type: inline-size;
  height: 100%;
  min-height: 240px;
  display: flex;
  flex-direction: column;

  .api-unavailable {
    min-width: 0;
    padding: 16px 0;
    text-align: left;

    :deep(.service-status-alert) {
      text-align: left;
      margin-bottom: 12px;
      padding: 14px 16px;
      background: var(--service-warning-surface);
      border: 1px solid var(--service-warning-line);
      border-left: 3px solid var(--result-warning);
      border-radius: 4px;
      color: var(--result-ink);
    }

    :deep(.service-status-alert .ant-alert-message) {
      color: var(--result-ink) !important;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    :deep(.service-status-alert .ant-alert-description) {
      color: var(--result-muted) !important;
      font-size: 12px;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }

    :deep(.service-status-alert .ant-alert-icon) {
      color: var(--result-warning);
      font-size: 18px;
      margin-top: 2px;
    }

    .service-reconnect {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 32px;
      margin-bottom: 16px;
    }

    .unavailable-info {
      background: transparent;
      border-top: 1px solid var(--result-line);
      padding: 14px 0 0;
      text-align: left;
      font-size: 12px;
      line-height: 1.7;

      p {
        color: var(--result-ink);
        margin-bottom: 8px;
      }

      ul {
        color: var(--result-muted);
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
    flex-wrap: wrap;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .jobs-list {
    min-height: 160px;
    max-height: 280px;
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
        flex-wrap: wrap;
        gap: 4px;
      }
    }
  }

  .job-detail-panel {
    margin-top: 16px;
    padding: 16px 0 0;
    background: transparent;
    border-radius: 0;
    border-top: 1px solid var(--result-line);
    color: var(--result-ink);

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      h4 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--result-ink);
      }
    }

    .detail-content {
      .detail-section {
        margin-bottom: 12px;

        h5 {
          color: var(--result-ink);
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .detail-row {
          display: grid;
          grid-template-columns: 76px minmax(0, 1fr);
          align-items: start;
          gap: 12px;
          padding: 6px 0;
          font-size: 13px;

          .detail-label {
            color: var(--result-muted);
          }

          .detail-value {
            color: var(--result-ink);
            overflow-wrap: anywhere;
          }
        }

        .progress-details {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: var(--result-muted);
          flex-wrap: wrap;
          margin-top: 4px;
        }
      }

      .artifacts-list {
        .artifact-item {
          display: grid;
          grid-template-columns: 20px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          padding: 12px 0;
          border-bottom: 1px solid var(--result-line);

          .artifact-icon {
            color: var(--result-accent);
            display: flex;
            align-items: center;
          }

          .artifact-name {
            color: var(--result-ink);
            font-size: 13px;
            line-height: 1.5;
            overflow-wrap: anywhere;
          }
        }
      }

      .service-ref {
        padding: 16px 0;
        background: transparent;
        border-radius: 0;
        margin-top: 8px;
        border-bottom: 1px solid var(--result-line);
        color: var(--result-ink);

        .service-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 10px;

          h5 { margin: 0; }
        }

        .service-info {
          font-size: 12px;
          color: var(--result-muted);
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }
      }

      .archive-ref {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        color: var(--result-ink);
        margin-top: 8px;
      }

      .archive-action {
        display: flex;
        justify-content: flex-end;
        margin-top: 16px;
      }

      .error-section {
        .error-message {
          color: var(--result-danger);
          background: rgba(255, 77, 79, 0.1);
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 8px;
        }
      }
    }
  }

  .result-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 12px; border-top: 1px solid var(--result-line); }
  .result-section-heading h5 { margin: 0; }
  .result-section-heading > span, .artifact-format { color: var(--result-muted); font-size: 11px; line-height: 1.6; }
  .artifact-copy { display: grid; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
  .artifact-actions, .service-actions { display: flex; align-items: center; gap: 6px; }
  .result-demo-notice { color: var(--result-warning); font-size: 12px; line-height: 1.5; padding: 8px 0; }
  .service-type { color: var(--result-accent); font-size: 12px; font-weight: 600; }
  .job-status-label { justify-self: start; font-size: 12px; line-height: 22px; padding: 0 8px; border: 1px solid currentColor; border-radius: 4px; color: var(--result-muted); }
  .job-status-label.is-succeeded { color: var(--result-success); }
  .job-status-label.is-running { color: var(--result-accent); }
  .job-status-label.is-queued { color: var(--result-warning); }
  .job-status-label.is-failed { color: var(--result-danger); }
  .result-action { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 0 10px; border: 1px solid var(--result-line); border-radius: 4px; background: transparent; color: var(--result-ink); font: inherit; font-size: 12px; line-height: 1; cursor: pointer; }
  .result-action.is-icon { width: 32px; height: 32px; padding: 0; }
  .result-action:hover { background: var(--result-hover); border-color: var(--result-accent); color: var(--result-accent); }
  .result-action:focus-visible { outline: 2px solid var(--result-accent); outline-offset: 2px; }
  .result-action.is-primary { background: #176dbe; border-color: #176dbe; color: #fff; }
  .result-action.is-primary:hover { background: #12599e; border-color: #12599e; color: #fff; }
}
:global(:root[data-theme="dark"] .thematic-jobs) { --result-ink: #edf3fa; --result-muted: #b5c4d5; --result-line: #45566c; --result-hover: #30465c; --result-accent: #8bcaff; --result-success: #82dfb4; --result-warning: #efc67d; --result-danger: #ffaaa5; --service-warning-surface: #302b22; --service-warning-line: #766044; }
@container (max-width: 330px) {
  .thematic-jobs .job-detail-panel .detail-content .artifacts-list .artifact-item { grid-template-columns: 20px minmax(0, 1fr); }
  .artifact-actions { grid-column: 2; justify-content: flex-end; }
}
</style>
