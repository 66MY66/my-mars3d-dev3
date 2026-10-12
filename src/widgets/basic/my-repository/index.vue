<template>
  <mars-dialog
    title="我的仓库"
    custom-class="ksh002-drawer"
    :draggable="false"
    width="32%"
    top="0"
    bottom="0"
    right="0"
    v-model:visible="dialogVisible"
    :defaultFold="drawerFolded"
    :thumbnail="thumbnail"
    @fold="onFold"
    ref="dialogRef"
  >
    <div class="my-repo-panel">
      <div class="panel-header">
        <div class="panel-title-row">
          <a-button
            v-if="viewMode === 'detail'"
            type="text"
            size="small"
            class="back-icon-btn"
            title="返回列表"
            aria-label="返回列表"
            @click="backToList"
          >
            <mars-icon icon="left" :width="16" />
          </a-button>
          <div class="panel-title">个人数据集</div>
        </div>
        <div class="panel-header-actions">
          <a-button size="small" :loading="loading" @click="refresh">刷新</a-button>
        </div>
      </div>

      <div v-if="viewMode === 'list'" class="panel-controls">
        <mars-input v-model:value="keyword" class="search-input" placeholder="搜索名称/描述" :allowClear="true" />
        <a-select v-model:value="statusFilter" class="status-select" :options="statusOptions" />
        <a-select v-model:value="sortKey" class="sort-select" :options="sortOptions" />
        <button
          type="button"
          class="sort-order-btn"
          :title="sortOrder === 'desc' ? '当前倒序，点击切换为正序' : '当前正序，点击切换为倒序'"
          :aria-label="sortOrder === 'desc' ? '切换为正序' : '切换为倒序'"
          @click="toggleSortOrder"
        >
          <mars-icon :icon="sortOrder === 'desc' ? 'sort-amount-down' : 'sort-amount-up'" :width="16" />
        </button>
      </div>

      <div v-if="loading" class="loading-container">
        <a-spin tip="加载中..." />
      </div>

      <div v-else-if="viewMode === 'list' && filteredTotal === 0" class="empty-state">
        <a-empty :description="emptyText" />
      </div>

      <div v-else-if="viewMode === 'list'" class="list-section">
        <div class="list">
          <div v-for="d in pageItems" :key="d.datasetId" class="card dataset-card" @click="openDetail(d.datasetId)">
            <div class="card-cover" v-if="d.coverUrl">
              <img class="cover-img" :src="d.coverUrl" alt="cover" />
            </div>
            <div class="card-body">
              <div class="card-head">
                <div class="name">{{ d.name }}</div>
                <div class="tags">
                  <a-tag v-if="hasRejection(d.datasetId)" color="red">已退回</a-tag>
                  <a-tag :color="statusColor(getStatus(d.datasetId))">{{ statusLabel(getStatus(d.datasetId)) }}</a-tag>
                  <a-tag v-if="d.visibility" color="blue">{{ visibilityLabel(d.visibility) }}</a-tag>
                </div>
              </div>
              <div v-if="d.description" class="desc">{{ d.description }}</div>
              <div class="meta">
                <div class="row"><span class="k">ID：</span><span class="v">{{ d.datasetId }}</span></div>
                <div class="row"><span class="k">创建：</span><span class="v">{{ formatTime(d.createdAt) }}</span></div>
                <div v-if="d.updatedAt" class="row"><span class="k">更新：</span><span class="v">{{ formatTime(d.updatedAt) }}</span></div>
              </div>

              <div class="actions" @click.stop>
                <a-button size="small" @click="openDetail(d.datasetId)">查看</a-button>
                <a-button size="small" :loading="downloadId === d.datasetId" @click="downloadZip(d)">下载ZIP</a-button>
                <a-button v-if="getStatus(d.datasetId) === 'private'" size="small" type="primary" @click="submitShare(d)">提交共享</a-button>
                <a-button v-else-if="getStatus(d.datasetId) === 'reviewing'" size="small" danger @click="withdrawShare(d)">撤回</a-button>
                <a-button
                  size="small"
                  :loading="deleting && deletingDatasetId === d.datasetId"
                  :disabled="deleting || !canDeleteDataset(d.datasetId)"
                  @click="openDeleteDialog(d)"
                >
                  删除
                </a-button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="pageItems.length > 0" class="pagination">
          <a-pagination
            v-model:current="page"
            :pageSize="pageSize"
            :total="filteredTotal"
            size="small"
            show-less-items
            :show-total="showTotal"
            :show-size-changer="false"
          />
        </div>
      </div>

      <div v-else class="detail">
        <div class="detail-header">
          <div class="detail-title">{{ selectedMeta?.name || selectedId }}</div>
        </div>

        <div v-if="selectedMeta?.coverUrl" class="detail-cover">
          <img class="cover-img" :src="selectedMeta.coverUrl" alt="cover" />
        </div>

        <div class="detail-tags">
          <a-tag v-if="hasRejection(selectedId)" color="red">已退回</a-tag>
          <a-tag :color="statusColor(getStatus(selectedId))">{{ statusLabel(getStatus(selectedId)) }}</a-tag>
          <a-tag v-if="selectedMeta?.visibility" color="blue">{{ visibilityLabel(selectedMeta.visibility) }}</a-tag>
        </div>

        <div v-if="selectedMeta?.description" class="detail-desc">{{ selectedMeta.description }}</div>
        <div v-if="selectedMeta?.tags?.length" class="detail-tags-list">
          <a-tag v-for="t in selectedMeta.tags" :key="t" color="default">{{ t }}</a-tag>
        </div>

        <div v-if="selectedRejectReason" class="reject-box">
          <div class="reject-title">拒绝原因</div>
          <div class="reject-text">{{ selectedRejectReason }}</div>
          <div class="reject-actions">
            <a-button size="small" type="primary" @click="resubmitSelected">重新提交</a-button>
          </div>
        </div>
        <div class="meta">
          <div class="row"><span class="k">ID：</span><span class="v">{{ selectedId }}</span></div>
          <div v-if="selectedMeta?.createdAt" class="row"><span class="k">创建：</span><span class="v">{{ formatTime(selectedMeta.createdAt) }}</span></div>
          <div v-if="selectedMeta?.updatedAt" class="row"><span class="k">更新：</span><span class="v">{{ formatTime(selectedMeta.updatedAt) }}</span></div>
        </div>

        <div class="detail-actions">
          <a-button type="primary" :loading="opening" @click="openUseDialog">打开使用</a-button>
          <a-button :loading="updating" @click="openUpdateDialog">更新内容</a-button>
          <a-button @click="openCoverDialog">设置封面</a-button>
          <a-button v-if="canUndo" :loading="undoing" @click="undo">撤销本次打开</a-button>
          <a-button :loading="downloadId === selectedId" @click="selectedMeta && downloadZip(selectedMeta)">下载ZIP</a-button>
          <a-button v-if="getStatus(selectedId) === 'private'" type="primary" @click="selectedId && submitShare({ datasetId: selectedId })">提交共享</a-button>
          <a-button v-else-if="getStatus(selectedId) === 'reviewing'" danger @click="selectedId && withdrawShare({ datasetId: selectedId })">撤回</a-button>
          <a-button
            :loading="deleting && deletingDatasetId === selectedId"
            :disabled="!selectedMeta || deleting || !canDeleteDataset(selectedId)"
            @click="selectedMeta && openDeleteDialog(selectedMeta)"
          >
            删除
          </a-button>
        </div>

        <LineagePanel
          v-if="selectedId"
          :dataset-id="selectedId"
          :dataset-name="selectedMeta?.name"
          @navigate="(id) => openDetail(id)"
        />
      </div>
    </div>

    <mars-task-modal
      v-model:open="showOpenDialog"
      title="打开使用"
      :okLoading="opening"
      ok-text="开始打开"
      cancel-text="取消"
      @ok="confirmOpen"
    >
      <div class="open-mode">
        <a-radio-group v-model:value="timeMode">
          <a-radio value="saved">使用保存时数据</a-radio>
          <a-radio value="latest">使用最新数据</a-radio>
        </a-radio-group>
      </div>
    </mars-task-modal>

    <mars-task-modal
      v-model:open="showUpdateDialog"
      title="更新内容"
      ok-text="确认更新"
      cancel-text="取消"
      :okLoading="updating"
      @ok="confirmUpdate"
    >
      <a-form layout="vertical">
        <a-form-item label="描述">
          <a-textarea v-model:value="updateForm.description" :rows="3" placeholder="请输入描述" />
        </a-form-item>
        <a-form-item label="标签">
          <a-select
            v-model:value="updateForm.tags"
            mode="tags"
            style="width: 100%"
            placeholder="输入后回车添加标签"
            :options="tagOptions"
          />
        </a-form-item>
        <a-form-item label="更新说明">
          <a-input v-model:value="updateForm.message" placeholder="本次更新说明（可选）" />
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="updateForm.createNewVersion">生成新版本</a-checkbox>
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="updateForm.updateCover">更新封面（使用当前地图截图）</a-checkbox>
        </a-form-item>
      </a-form>
    </mars-task-modal>

    <mars-task-modal
      v-model:open="showCoverDialog"
      title="设置封面"
      ok-text="确认"
      cancel-text="取消"
      :okLoading="settingCover"
      @ok="confirmSetCover"
    >
      <a-form layout="vertical">
        <a-form-item label="方式">
          <a-radio-group v-model:value="coverForm.mode">
            <a-radio value="auto">使用当前地图截图</a-radio>
            <a-radio value="upload">上传图片</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item v-if="coverForm.mode === 'upload'" label="上传图片">
          <a-upload :file-list="coverFileList" :max-count="1" :before-upload="beforeCoverUpload" @remove="removeCover" accept="image/*">
            <a-button size="small">选择图片</a-button>
          </a-upload>
        </a-form-item>
      </a-form>
    </mars-task-modal>

    <mars-task-modal
      v-model:open="deleteDialogOpen"
      title="删除"
      ok-type="danger"
      ok-text="删除"
      cancel-text="取消"
      :okLoading="deleting"
      @ok="confirmDelete"
      @cancel="cancelDelete"
    >
      <div>确认删除“{{ deleteTargetTitle }}”？此操作不可撤销。</div>
    </mars-task-modal>
  </mars-dialog>
</template>

<script setup lang="ts">
import useLifecycle from "@mars/common/uses/use-lifecycle"
import * as mapWork from "./map"
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue"
import { $message } from "@mars/components/mars-ui/index"
import { cancelDatasetPublishRequest, deleteDataset, getCollectionsAll, getLatestDatasetManifest, getLocalDataset, getLocalManifests, submitDatasetPublishRequest, updateLocalDataset } from "../dataset-repository/services/eoapi-datasets"
import type { DatasetVisibility, Manifest, StacCollection, StacItem } from "../dataset-repository/types/eoapi-types"
import { clearDatasetPublishEntry, clearDatasetRejection, getDatasetPublishEntry, getDatasetPublishStatus, requestDatasetShare, withdrawDatasetShare } from "../dataset-repository/services/publish-status"
import { downloadDatasetZip } from "../dataset-repository/utils/zip-export"
import { serializeWorkspace, validateManifest } from "../dataset-repository/workspace/serialize"
import { captureCoverImage } from "../dataset-repository/map"
import { getOrCreateBboxCover, getPersistedDatasetCover, setPersistedDatasetCover } from "../dataset-repository/services/cover-cache"
import { eoapiGet, hasKnownHealthyManagementApi, resolveEoapiHref } from "../dataset-repository/services/eoapi-client"
import { eoApiConfig } from "../dataset-repository/services/eoapi-config"
import LineagePanel from "../dataset-repository/components/LineagePanel.vue"
import { useWidget } from "@mars/common/store/widget"
import { clearDatasetMetric, getDatasetMetric, onDatasetMetricsChange, recordDatasetBrowse, recordDatasetImport, syncMetricsFromServer } from "../dataset-repository/services/dataset-metrics"
import { onDatasetSync } from "../dataset-repository/services/dataset-sync"
import type { UploadFile } from "ant-design-vue"
import { createRefreshGuard, shouldBlockRepositoryLoading } from "./refresh-guard"

// #region debug-point eoapi-datasets-500
type TraeDebugEvent = {
  t: number
  sessionId: string
  level: "info" | "warn" | "error"
  type: string
  message: string
  data?: Record<string, unknown>
}

const TRAE_DEBUG_ENDPOINT =
  (import.meta.env as any).VITE_DEBUG_SERVER_URL ||
  new URLSearchParams(location.search).get("traeDebug") ||
  localStorage.getItem("TRAE_DEBUG_SERVER_URL") ||
  ""
const TRAE_DEBUG_SESSION_ID =
  (import.meta.env as any).VITE_DEBUG_SESSION_ID ||
  new URLSearchParams(location.search).get("traeSession") ||
  localStorage.getItem("TRAE_DEBUG_SESSION_ID") ||
  "eoapi-datasets-500"

const traeBaseFetch = window.fetch.bind(window)

async function reportTraeDebugEvent(event: TraeDebugEvent): Promise<void> {
  if (!TRAE_DEBUG_ENDPOINT) {
    return
  }
  try {
    await traeBaseFetch(TRAE_DEBUG_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify(event),
      keepalive: true
    })
  } catch {
  }
}

function fireAndForget(p: Promise<unknown>): void {
  p.catch(() => {})
}
// #endregion debug-point eoapi-datasets-500

// 启用生命周期
useLifecycle(mapWork)

const { activate, setVisible } = useWidget()

const props = defineProps<{
  visible?: boolean
}>()

const emit = defineEmits<{
  "update:visible": [value: boolean]
}>()

const dialogVisible = computed({
  get: () => props.visible ?? false,
  set: (v) => emit("update:visible", v)
})

let refreshTimer: number | null = null

watch(
  () => dialogVisible.value,
  (visible) => {
    if (!visible) {
      return
    }
    scheduleRefresh()
  },
  { immediate: true }
)

const foldStorageKey = "ksh002_drawer_folded_my-repository"
const drawerFolded = ref(localStorage.getItem(foldStorageKey) === "1")
const thumbnail = {
  right: 0,
  top: 12,
  width: 30,
  height: 44,
  icon: "left-expand"
}
const dialogRef = ref<any>(null)

function toggleFold() {
  dialogRef.value?.toggle?.()
}

function onFold(v: boolean) {
  drawerFolded.value = v
  localStorage.setItem(foldStorageKey, v ? "1" : "0")
}

const loading = ref(false)
const datasets = ref<Array<{
  datasetId: string
  name: string
  description?: string
  visibility?: DatasetVisibility
  publishStatus?: "private" | "reviewing" | "published"
  rejectionReason?: string
  coverUrl?: string
  tags?: string[]
  createdAt: number
  updatedAt?: number
}>>([])

const downloadId = ref("")
const viewMode = ref<"list" | "detail">("list")
const selectedId = ref("")
const deleteDialogOpen = ref(false)
const deleteTarget = ref<{ datasetId: string; name?: string } | null>(null)
const deleteTargetTitle = computed(() => deleteTarget.value?.name || deleteTarget.value?.datasetId || "")

const keyword = ref("")
const statusFilter = ref<"all" | "private" | "reviewing" | "published">("all")
const sortKey = ref<"heat" | "updatedAt" | "createdAt">("updatedAt")
const sortOrder = ref<"desc" | "asc">("desc")
const metricTick = ref(0)

const pageSize = 20
const page = ref(1)
const deleting = ref(false)
const deletingDatasetId = ref("")

const statusOptions = [
  { label: "全部状态", value: "all" },
  { label: "私有", value: "private" },
  { label: "审核中", value: "reviewing" },
  { label: "已发布", value: "published" }
]

const sortOptions = [
  { label: "使用热度", value: "heat" },
  { label: "更新时间", value: "updatedAt" },
  { label: "创建时间", value: "createdAt" }
]

const filtered = computed(() => {
  const tick = metricTick.value
  if (tick < 0) {
    return []
  }
  const q = keyword.value.trim().toLowerCase()
  const list = datasets.value.filter((d) => {
    if (statusFilter.value !== "all" && getStatus(d.datasetId) !== statusFilter.value) {
      return false
    }
    if (!q) {
      return true
    }
    const hay = `${d.name || ""} ${d.description || ""}`.toLowerCase()
    return hay.includes(q)
  })

  const withScore = list.map((d, index) => {
    const m = getDatasetMetric(d.datasetId)
    const heat = m.browseCount + m.importCount + (m.favorite ? 20 : 0)
    const createdAt = d.createdAt || 0
    const updatedAt = d.updatedAt || d.createdAt || 0
    return { d, index, heat, createdAt, updatedAt }
  })

  const dir = sortOrder.value === "asc" ? 1 : -1
  withScore.sort((a, b) => {
    if (sortKey.value === "heat") {
      return (a.heat - b.heat) * dir || (b.updatedAt - a.updatedAt) || a.index - b.index
    }
    if (sortKey.value === "createdAt") {
      return (a.createdAt - b.createdAt) * dir || a.index - b.index
    }
    return (a.updatedAt - b.updatedAt) * dir || a.index - b.index
  })

  return withScore.map((x) => x.d)
})

const filteredTotal = computed(() => filtered.value.length)
const emptyText = computed(() => (keyword.value.trim() ? "未找到匹配的数据集，请尝试其他关键词" : "暂无已保存成果"))

const pageItems = computed(() => {
  const start = (page.value - 1) * pageSize
  return filtered.value.slice(start, start + pageSize)
})

watch([keyword, statusFilter, sortKey, sortOrder], () => {
  page.value = 1
})

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === "desc" ? "asc" : "desc"
}

function showTotal(total: number) {
  return `共 ${total} 条`
}

const selectedMeta = computed(() => datasets.value.find((d) => d.datasetId === selectedId.value) || null)

function openDetail(id: string) {
  selectedId.value = id
  viewMode.value = "detail"
  try {
    recordDatasetBrowse(id)
    metricTick.value += 1
  } catch {}
}

function backToList() {
  viewMode.value = "list"
}

function openDeleteDialog(d: { datasetId: string; name?: string }) {
  if (!canDeleteDataset(d.datasetId)) {
    $message("仅私有数据集支持直接删除，请先撤回共享后再试")
    return
  }
  deleteTarget.value = { datasetId: d.datasetId, name: d.name }
  deleteDialogOpen.value = true
}

function cancelDelete() {
  deleteDialogOpen.value = false
  deleteTarget.value = null
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) {
    cancelDelete()
    return
  }
  deleting.value = true
  deletingDatasetId.value = target.datasetId
  deleteDialogOpen.value = false
  deleteTarget.value = null
  try {
    await remove({ datasetId: target.datasetId })
  } finally {
    deleting.value = false
    deletingDatasetId.value = ""
  }
}

const showOpenDialog = ref(false)
const timeMode = ref<"saved" | "latest">("saved")
const opening = ref(false)
const undoing = ref(false)
const showUpdateDialog = ref(false)
const updating = ref(false)
const updateForm = reactive({
  description: "",
  tags: [] as string[],
  message: "",
  createNewVersion: true,
  updateCover: true
})

const presetTagValues = [
  "地震",
  "灾害评估",
  "InSAR",
  "专题图",
  "影像",
  "矢量",
  "DEM",
  "地形",
  "应急",
  "规划",
  "分析",
  "标注",
  "测量",
  "演示",
  "测试"
]

const tagOptions = computed(() => {
  const set = new Set<string>()
  presetTagValues.forEach((t) => {
    const v = String(t || "").trim()
    if (v) {
      set.add(v)
    }
  })
  datasets.value.forEach((d) => {
    ;(d.tags || []).forEach((t) => {
      const v = String(t || "").trim()
      if (v) {
        set.add(v)
      }
    })
  })
  return Array.from(set).slice(0, 80).map((value) => ({ value }))
})

const sessionTick = ref(0)
function bumpSession() {
  sessionTick.value += 1
}
const activeSessionDatasetId = computed(() => {
  const tick = sessionTick.value
  if (tick < 0) {
    return null
  }
  return mapWork.getActiveSessionDatasetId()
})
const canUndo = computed(() => activeSessionDatasetId.value === selectedId.value && !!activeSessionDatasetId.value)

function openUseDialog() {
  showOpenDialog.value = true
}

async function confirmOpen() {
  const id = selectedId.value
  if (!id) {
    return
  }
  let manifest: Manifest | undefined
  if (String(id || "").startsWith("local_")) {
    const dataset = getLocalDataset(id)
    manifest = dataset?.manifest as Manifest | undefined
  } else {
    const res = await getLatestDatasetManifest(id)
    if (res.success && res.data?.manifest) {
      manifest = res.data.manifest
    }
  }
  if (!manifest) {
    $message("当前数据集没有可打开的成果包")
    showOpenDialog.value = false
    return
  }

  opening.value = true
  try {
    await mapWork.openLocalDataset({
      datasetId: id,
      datasetName: selectedMeta.value?.name || id,
      manifest,
      timeMode: timeMode.value
    })
    bumpSession()
    try {
      recordDatasetImport(id)
      metricTick.value += 1
    } catch {}
    try {
      const focusPid = mapWork.getActiveSessionLayerParentId()
      activate({ name: "manage-layers", data: { focusPid, props: { position: { top: 60, left: 90 } } } })
      // 打开图层面板后保留“我的仓库”详情态，便于继续执行撤销/重命名/设置封面等后续操作。
      setVisible("my-repository", true)
    } catch {}
    $message("打开完成")
    showOpenDialog.value = false
  } catch (e: any) {
    $message(`打开失败: ${e?.message || "未知错误"}`)
  } finally {
    opening.value = false
  }
}

async function undo() {
  if (!canUndo.value) {
    return
  }
  undoing.value = true
  try {
    const ok = await mapWork.undoOpen()
    if (ok) {
      bumpSession()
      $message("已撤销本次打开")
    }
  } catch (e: any) {
    $message(`撤销失败: ${e?.message || "未知错误"}`)
  } finally {
    undoing.value = false
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function visibilityLabel(v: DatasetVisibility): string {
  if (v === "public") {
    return "公开"
  }
  if (v === "shared") {
    return "共享"
  }
  return "私有"
}

function getStatus(datasetId: string) {
  const localStatus = getDatasetPublishEntry(datasetId)?.status
  if (localStatus) {
    return localStatus
  }
  return datasets.value.find((d) => d.datasetId === datasetId)?.publishStatus || getDatasetPublishStatus(datasetId)
}

function canDeleteDataset(datasetId: string): boolean {
  return getStatus(datasetId) === "private"
}

function hasRejection(datasetId: string): boolean {
  const entry = getDatasetPublishEntry(datasetId)
  if (entry?.status === "private" && !!entry?.rejectionReason) {
    return true
  }
  return !!datasets.value.find((d) => d.datasetId === datasetId)?.rejectionReason
}

const selectedRejectReason = computed(() => {
  if (!selectedId.value) {
    return ""
  }
  const entry = getDatasetPublishEntry(selectedId.value)
  if (entry?.status === "private" && entry?.rejectionReason) {
    return entry.rejectionReason
  }
  return datasets.value.find((d) => d.datasetId === selectedId.value)?.rejectionReason || ""
})

function statusLabel(s: "private" | "reviewing" | "published"): string {
  if (s === "reviewing") {
    return "审核中"
  }
  if (s === "published") {
    return "已发布"
  }
  return "私有"
}

function statusColor(s: "private" | "reviewing" | "published"): string {
  if (s === "reviewing") {
    return "orange"
  }
  if (s === "published") {
    return "green"
  }
  return "default"
}

async function refreshCore() {
  const locals = getLocalManifests()
  loading.value = shouldBlockRepositoryLoading(datasets.value.length, locals.length)

  // Match the dataset repository's non-blocking behavior: show local data
  // immediately while the remote list is refreshed in the background.
  if (locals.length > 0 && datasets.value.length === 0) {
    datasets.value = locals
  }

  try {
    const remotes = await fetchRemoteDatasets().catch(() => [])
    const merged = [...locals]
    const seen = new Set<string>(locals.map((x) => x.datasetId))
    remotes.forEach((r) => {
      if (r?.datasetId && !seen.has(r.datasetId)) {
        seen.add(r.datasetId)
        merged.push(r)
      }
    })
    datasets.value = merged
    fireAndForget(
      reportTraeDebugEvent({
        t: Date.now(),
        sessionId: TRAE_DEBUG_SESSION_ID,
        level: "info",
        type: "my-repo.refresh.done",
        message: "my-repo.refresh.done",
        data: {
          origin: location.origin,
          apiPrefix: eoApiConfig.apiPrefix,
          localCount: locals.length,
          remoteCount: remotes.length,
          mergedCount: merged.length
        }
      })
    )
    hydrateMissingCovers().catch(() => {})
  } finally {
    loading.value = false
  }
}

// The panel can receive refresh signals from several sources (open, sync events,
// manual refresh and auto-sync). Keep one request in flight so those signals
// cannot stack slow API calls and keep the loading state perpetually active.
const refreshGuard = createRefreshGuard(refreshCore)

function refresh() {
  return refreshGuard.run()
}

async function fetchRemoteDatasets(): Promise<Array<{
  datasetId: string
  name: string
  description?: string
  visibility?: DatasetVisibility
  publishStatus?: "private" | "reviewing" | "published"
  rejectionReason?: string
  coverUrl?: string
  tags?: string[]
  createdAt: number
  updatedAt?: number
}>> {
  if (!hasKnownHealthyManagementApi()) {
    const fallback = await getCollectionsAll()
    if (!fallback.success || !fallback.data) {
      fireAndForget(
        reportTraeDebugEvent({
          t: Date.now(),
          sessionId: TRAE_DEBUG_SESSION_ID,
          level: "error",
          type: "my-repo.remote.fetch.fallback.fail",
          message: "my-repo.remote.fetch.fallback.fail",
          data: {
            origin: location.origin,
            path: "/collections",
            code: fallback.code ?? null,
            detail: fallback.message || "",
            reason: "management-api-health-unknown"
          }
        })
      )
      return []
    }

    fireAndForget(
      reportTraeDebugEvent({
        t: Date.now(),
        sessionId: TRAE_DEBUG_SESSION_ID,
        level: "info",
        type: "my-repo.remote.fetch.fallback.direct",
        message: "my-repo.remote.fetch.fallback.direct",
        data: {
          origin: location.origin,
          path: "/collections",
          rows: Array.isArray(fallback.data) ? fallback.data.length : 0,
          reason: "management-api-health-unknown"
        }
      })
    )

    return fallback.data.map((item: any) => ({
      datasetId: item.id,
      name: String(item.title || item.id || ""),
      description: String(item.description || ""),
      visibility: "private" as DatasetVisibility,
      publishStatus: "published" as const,
      createdAt: 0,
      updatedAt: 0,
      coverUrl: getCollectionCoverUrl(item),
      tags: []
    }))
  }

  fireAndForget(
    reportTraeDebugEvent({
      t: Date.now(),
      sessionId: TRAE_DEBUG_SESSION_ID,
      level: "info",
      type: "my-repo.remote.fetch.start",
      message: "my-repo.remote.fetch.start",
      data: {
        origin: location.origin,
        apiPrefix: eoApiConfig.apiPrefix,
        path: "/datasets"
      }
    })
  )
  const res = await eoapiGet<any>("/datasets")
  if (!res.success || !res.data) {
    fireAndForget(
      reportTraeDebugEvent({
        t: Date.now(),
        sessionId: TRAE_DEBUG_SESSION_ID,
        level: "error",
        type: "my-repo.remote.fetch.fail",
        message: "my-repo.remote.fetch.fail",
        data: {
          origin: location.origin,
          apiPrefix: eoApiConfig.apiPrefix,
          path: "/datasets",
          code: res.code ?? null,
          detail: res.message || ""
        }
      })
    )

    const fallback = await getCollectionsAll()
    if (!fallback.success || !fallback.data) {
      fireAndForget(
        reportTraeDebugEvent({
          t: Date.now(),
          sessionId: TRAE_DEBUG_SESSION_ID,
          level: "error",
          type: "my-repo.remote.fetch.fallback.fail",
          message: "my-repo.remote.fetch.fallback.fail",
          data: {
            origin: location.origin,
            path: "/collections",
            code: fallback.code ?? null,
            detail: fallback.message || ""
          }
        })
      )
      return []
    }

    fireAndForget(
      reportTraeDebugEvent({
        t: Date.now(),
        sessionId: TRAE_DEBUG_SESSION_ID,
        level: "warn",
        type: "my-repo.remote.fetch.fallback.success",
        message: "my-repo.remote.fetch.fallback.success",
        data: {
          origin: location.origin,
          path: "/collections",
          rows: fallback.data.length
        }
      })
    )

    return fallback.data
      .map((d) => mapRemoteCollectionToDataset(d))
      .filter(Boolean) as any
  }
  const raw = res.data
  let rows: any[] = []
  if (Array.isArray(raw)) {
    rows = raw
  } else if (Array.isArray(raw?.datasets)) {
    rows = raw.datasets
  } else if (Array.isArray(raw?.items)) {
    rows = raw.items
  }

  let payloadShape: string = typeof raw
  if (Array.isArray(raw)) {
    payloadShape = "array"
  } else if (Array.isArray(raw?.datasets)) {
    payloadShape = "datasets"
  } else if (Array.isArray(raw?.items)) {
    payloadShape = "items"
  }

  fireAndForget(
    reportTraeDebugEvent({
      t: Date.now(),
      sessionId: TRAE_DEBUG_SESSION_ID,
      level: "info",
      type: "my-repo.remote.fetch.success",
      message: "my-repo.remote.fetch.success",
      data: {
        origin: location.origin,
        path: "/datasets",
        rows: rows.length,
        shape: payloadShape
      }
    })
  )
  return rows
    .map((d: any) => {
      const datasetId = String(d?.datasetId || d?.id || "").trim()
      if (!datasetId) {
        return null
      }
      const createdAt = Number(d?.createdAt) || Date.now()
      const updatedAt = Number(d?.updatedAt) || undefined
      const name = String(d?.name || d?.title || datasetId)
      const description = d?.description != null ? String(d.description) : undefined
      const visibility = d?.visibility as DatasetVisibility
      const publishStatus = d?.publishStatus as "private" | "reviewing" | "published" | undefined
      const rejectionReason = d?.rejectionReason != null ? String(d.rejectionReason) : undefined
      const coverUrl = typeof d?.coverUrl === "string" && d.coverUrl
        ? resolveEoapiHref(d.coverUrl)
        : undefined
      const tags = Array.isArray(d?.tags) ? d.tags.filter((t: any) => typeof t === "string") : undefined
      return { datasetId, name, description, visibility, publishStatus, rejectionReason, coverUrl, tags, createdAt, updatedAt }
    })
    .filter(Boolean) as any
}

function mapRemoteCollectionToDataset(d: StacCollection): {
  datasetId: string
  name: string
  description?: string
  visibility?: DatasetVisibility
  publishStatus?: "private" | "reviewing" | "published"
  rejectionReason?: string
  coverUrl?: string
  tags?: string[]
  createdAt: number
  updatedAt?: number
} | null {
  const datasetId = String(d?.id || "").trim()
  if (!datasetId) {
    return null
  }
  const summaries = (d?.summaries || {}) as Record<string, any>
  return {
    datasetId,
    name: String(d?.title || datasetId),
    description: d?.description != null ? String(d.description) : undefined,
    visibility: summaries.visibility as DatasetVisibility,
    publishStatus: summaries.publishStatus as "private" | "reviewing" | "published" | undefined,
    rejectionReason: summaries.rejectionReason != null ? String(summaries.rejectionReason) : undefined,
    coverUrl: getCollectionCoverUrl(d),
    tags: Array.isArray(summaries.tags) ? summaries.tags.filter((t: any) => typeof t === "string") : undefined,
    createdAt: Number(summaries.createdAt) || Date.now(),
    updatedAt: Number(summaries.updatedAt) || undefined
  }
}

function getCollectionCoverUrl(collection: any): string | undefined {
  const summaries = collection?.summaries || {}
  const links = Array.isArray(collection?.links) ? collection.links : []
  const previewLink = links.find((link: any) => ["preview", "thumbnail", "self-preview"].includes(String(link?.rel || "").toLowerCase()))
  const assets = collection?.assets || {}
  const asset = assets.thumbnail || assets.preview || assets.cover
  const raw = summaries.coverUrl || previewLink?.href || asset?.href
  return typeof raw === "string" && raw ? resolveEoapiHref(raw) : undefined
}

async function hydrateMissingCovers(): Promise<void> {
  const list = datasets.value.slice(0, 40)
  for (let i = 0; i < list.length; i++) {
    const d = list[i]
    if (!d?.datasetId) {
      continue
    }
    const datasetId = d.datasetId
    if (d.coverUrl) {
      setPersistedDatasetCover(datasetId, d.coverUrl).catch(() => {})
      continue
    }
    if (!String(datasetId || "").startsWith("local_")) {
      const persisted = await getPersistedDatasetCover(datasetId)
      if (persisted) {
        const next = datasets.value.map((x) => (x.datasetId === datasetId ? { ...x, coverUrl: persisted } : x))
        datasets.value = next
      }
      continue
    }
    const persisted = await getPersistedDatasetCover(datasetId)
    if (persisted) {
      updateLocalDataset(datasetId, { coverUrl: persisted, createNewVersion: false })
      const next = datasets.value.map((x) => (x.datasetId === datasetId ? { ...x, coverUrl: persisted } : x))
      datasets.value = next
      continue
    }
    const local = getLocalDataset(datasetId) as any
    const bbox = local?.manifest?.viewState?.bbox
    const nums = Array.isArray(bbox) && bbox.length === 4
      ? [Number(bbox[0]), Number(bbox[1]), Number(bbox[2]), Number(bbox[3])]
      : [0, 0, 0, 0]
    if (nums.some((n) => !Number.isFinite(n))) {
      continue
    }
    const dataUrl = await getOrCreateBboxCover({ datasetId, title: d.name || datasetId, bbox: [nums[0], nums[1], nums[2], nums[3]] })
    if (!dataUrl) {
      continue
    }
    updateLocalDataset(datasetId, { coverUrl: dataUrl, createNewVersion: false })
    setPersistedDatasetCover(datasetId, dataUrl).catch(() => {})
    const next = datasets.value.map((x) => (x.datasetId === datasetId ? { ...x, coverUrl: dataUrl } : x))
    datasets.value = next
  }
}

async function submitShare(d: { datasetId: string }) {
  clearDatasetRejection(d.datasetId)
  requestDatasetShare(d.datasetId, "shared")
  if (String(d.datasetId || "").startsWith("local_")) {
    $message("已提交共享（本地模拟）：本地成果不走后端审核流")
    return
  }
  try {
    const res = await submitDatasetPublishRequest(d.datasetId)
    if (!res.success) {
      $message(`已提交共享（本地模拟）：${res.message || "后端未响应"}`)
      return
    }
    $message("已提交共享，状态为审核中")
  } catch (e: any) {
    $message(`已提交共享（本地模拟）：${e?.message || "后端未响应"}`)
  }
}

async function withdrawShare(d: { datasetId: string }) {
  withdrawDatasetShare(d.datasetId)
  if (String(d.datasetId || "").startsWith("local_")) {
    $message("已撤回（本地模拟）：本地成果不走后端审核流")
    return
  }
  try {
    const res = await cancelDatasetPublishRequest(d.datasetId)
    if (!res.success) {
      $message(`已撤回（本地模拟）：${res.message || "后端未响应"}`)
      return
    }
    $message("已撤回，状态已恢复为私有")
  } catch (e: any) {
    $message(`已撤回（本地模拟）：${e?.message || "后端未响应"}`)
  }
}

function resubmitSelected() {
  if (!selectedId.value) {
    return
  }
  submitShare({ datasetId: selectedId.value })
}

function openUpdateDialog() {
  if (!selectedId.value) {
    return
  }
  const ds = getLocalDataset(selectedId.value) as any
  updateForm.description = ds?.description || selectedMeta.value?.description || ""
  updateForm.tags = Array.isArray(ds?.tags) ? ds.tags : (selectedMeta.value?.tags || [])
  updateForm.message = ""
  updateForm.createNewVersion = true
  updateForm.updateCover = true
  showUpdateDialog.value = true
}

async function confirmUpdate() {
  if (!selectedId.value) {
    return
  }
  if (!mapWork.getMap()) {
    $message("地图未初始化")
    return
  }
  updating.value = true
  try {
    const map = mapWork.getMap()
    const manifest = serializeWorkspace(map as any, {
      includeViewState: true,
      includeLayers: true,
      includeDrawFeatures: true
    })
    const check = validateManifest(manifest)
    if (!check.valid) {
      $message(check.errors[0] || "成果内容无效")
      return
    }

    let coverUrl: string | undefined
    if (updateForm.updateCover) {
      try {
        const blob = await captureCoverImage(
          { minWidth: 800, minHeight: 600, targetWidth: 1024, targetHeight: 768, mime: "image/jpeg", quality: 0.88, title: selectedMeta.value?.name || selectedId.value },
          map as any
        )
        coverUrl = await blobToDataUrl(blob)
      } catch {
      }
    }

    const ok = updateLocalDataset(selectedId.value, {
      manifest,
      description: updateForm.description,
      tags: updateForm.tags,
      coverUrl,
      createNewVersion: updateForm.createNewVersion,
      message: updateForm.message
    })
    if (!ok) {
      $message("更新失败：未找到本地数据集")
      return
    }
    await refresh()
    $message("更新成功")
    showUpdateDialog.value = false
  } catch (e: any) {
    $message(`更新失败: ${e?.message || "未知错误"}`)
  } finally {
    updating.value = false
  }
}

const showCoverDialog = ref(false)
const settingCover = ref(false)
const coverForm = reactive({
  mode: "auto" as "auto" | "upload"
})
const coverFileList = ref<UploadFile[]>([])
const uploadedCoverUrl = ref<string>("")

function openCoverDialog() {
  coverForm.mode = "auto"
  coverFileList.value = []
  uploadedCoverUrl.value = ""
  showCoverDialog.value = true
}

function beforeCoverUpload(file: any) {
  return new Promise<boolean>((resolve) => {
    try {
      const reader = new FileReader()
      reader.onload = () => {
        uploadedCoverUrl.value = String(reader.result || "")
        coverFileList.value = [
          {
            uid: String(Date.now()),
            name: file?.name || "cover",
            status: "done"
          } as any
        ]
        resolve(false)
      }
      reader.onerror = () => resolve(false)
      reader.readAsDataURL(file)
    } catch {
      resolve(false)
    }
  })
}

function removeCover() {
  uploadedCoverUrl.value = ""
  coverFileList.value = []
}

async function confirmSetCover() {
  if (!selectedId.value) {
    return
  }
  settingCover.value = true
  try {
    let coverUrl: string | undefined
    if (coverForm.mode === "upload") {
      coverUrl = uploadedCoverUrl.value || undefined
      if (!coverUrl) {
        $message("请先选择图片")
        return
      }
    } else {
      const map = mapWork.getMap()
      if (!map) {
        $message("地图未初始化")
        return
      }
      try {
        const blob = await captureCoverImage(
          { minWidth: 800, minHeight: 600, targetWidth: 1024, targetHeight: 768, mime: "image/jpeg", quality: 0.88, title: selectedMeta.value?.name || selectedId.value },
          map as any
        )
        coverUrl = await blobToDataUrl(blob)
      } catch (e: any) {
        $message(`设置失败: ${e?.message || "封面生成失败"}`)
        return
      }
    }

    if (!coverUrl) {
      $message("设置失败: 封面为空")
      return
    }

    const datasetId = String(selectedId.value || "")
      if (datasetId.startsWith("local_")) {
        const ok = updateLocalDataset(datasetId, { coverUrl, createNewVersion: false })
      if (!ok) {
        $message("设置失败：未找到本地数据集")
          return
        }
        // Large uploaded images are represented by __idb_cover__ in localStorage.
        // Wait for the actual IndexedDB write before refreshing, otherwise the
        // background cover backfill can race and replace the uploaded cover.
        await setPersistedDatasetCover(datasetId, coverUrl)
        await refresh()
      $message("封面已更新")
    } else {
      await setPersistedDatasetCover(datasetId, coverUrl)
      datasets.value = datasets.value.map((d) => (d.datasetId === datasetId ? { ...d, coverUrl } : d))
      $message("封面已更新（本地缓存）")
    }
    showCoverDialog.value = false
  } finally {
    settingCover.value = false
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("read failed"))
      reader.readAsDataURL(blob)
    } catch (e) {
      reject(e)
    }
  })
}

async function downloadZip(d: { datasetId: string; name: string }) {
  if (downloadId.value) {
    return
  }
  downloadId.value = d.datasetId
  try {
    const datasetStub: StacCollection = {
      id: d.datasetId,
      type: "Collection",
      title: d.name,
      description: "",
      extent: {
        spatial: { bbox: [[0, 0, 0, 0]] },
        temporal: { interval: [[null, null]] }
      },
      links: []
    }

    const revisionStub: StacItem = {
      id: "latest",
      type: "Feature",
      collection: d.datasetId,
      geometry: null,
      properties: { datetime: new Date().toISOString(), title: "最新版本" },
      assets: {},
      links: []
    }

    await downloadDatasetZip({
      dataset: datasetStub,
      revision: revisionStub,
      filenamePrefix: d.name
    })
    $message("已开始下载")
  } catch (e: any) {
    $message(`下载失败: ${e?.message || "未知错误"}`)
  } finally {
    downloadId.value = ""
  }
}

async function remove(d: { datasetId: string }) {
  const result = await deleteDataset(d.datasetId)
  if (result.success) {
    clearDatasetPublishEntry(d.datasetId)
    clearDatasetRejection(d.datasetId)
    clearDatasetMetric(d.datasetId)
    datasets.value = datasets.value.filter((x) => x.datasetId !== d.datasetId)
    if (mapWork.getActiveSessionDatasetId() === d.datasetId) {
      mapWork.undoOpen().then(() => bumpSession()).catch(() => {})
    }
    if (selectedId.value === d.datasetId) {
      selectedId.value = ""
      viewMode.value = "list"
    }
    $message("已删除")
  } else {
    $message(result.message || "删除失败")
  }
}

let offMetricChange: null | (() => void) = null
let offDatasetSync: null | (() => void) = null
let autoSyncTimer: number | null = null

function scheduleRefresh(includeMetrics = false) {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer)
  }
  refreshTimer = window.setTimeout(async () => {
    refreshTimer = null
    if (!dialogVisible.value) {
      return
    }
    if (includeMetrics) {
      await syncMetricsFromServer().catch(() => {})
      metricTick.value += 1
    }
    await refresh()
  }, 180)
}

onMounted(() => {
  try {
    window.addEventListener(mapWork.MY_REPOSITORY_SESSION_EVENT, bumpSession as any)
    bumpSession()
  } catch {
  }
  offMetricChange = onDatasetMetricsChange(() => {
    metricTick.value += 1
  })
  offDatasetSync = onDatasetSync(() => {
    scheduleRefresh()
  })
  if (eoApiConfig.autoSync) {
    autoSyncTimer = window.setInterval(() => {
      scheduleRefresh(true)
    }, 15000)
  }
})
onUnmounted(() => {
  offMetricChange?.()
  offDatasetSync?.()
  try {
    window.removeEventListener(mapWork.MY_REPOSITORY_SESSION_EVENT, bumpSession as any)
  } catch {
  }
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer)
    refreshTimer = null
  }
  if (autoSyncTimer !== null) {
    window.clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
})
</script>

<style scoped>
.my-repo-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

:deep(.mars-dialog__content) {
  overflow: hidden !important;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
}

.panel-title-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.back-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--mars-text-color);
}

.back-icon-btn:hover {
  color: var(--mars-primary-color, #2d8cf0);
}

.panel-header-actions {
  display: flex;
  gap: 8px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--mars-text-color);
}

.panel-controls {
  display: flex;
  gap: 8px;
  align-items: stretch;
  flex-shrink: 0;
}

.panel-controls .search-input {
  flex: 1;
  min-width: 0;
  height: 32px !important;
  background-color: var(--mars-control-bg) !important;
  border: 1px solid var(--mars-control-border) !important;
  border-radius: var(--popup-radius, 8px) !important;
  box-shadow: none !important;
}

.panel-controls .search-input:hover {
  border-color: var(--mars-hover-color) !important;
}

.panel-controls .status-select {
  width: 100px;
  flex-shrink: 0;
}

.panel-controls .sort-select {
  width: 96px;
  flex-shrink: 0;
}

.panel-controls .status-select,
.panel-controls .sort-select {
  :deep(.ant-select-selector) {
    height: 32px !important;
    min-height: 32px !important;
    align-items: center;
    padding-inline: 11px !important;
    background-color: var(--mars-control-bg) !important;
    border: 1px solid var(--mars-control-border) !important;
    border-radius: var(--popup-radius, 8px) !important;
    box-shadow: none !important;
  }

  :deep(.ant-select-selection-item),
  :deep(.ant-select-selection-placeholder) {
    line-height: 30px !important;
    font-size: 12px;
  }

  &:hover :deep(.ant-select-selector) {
    border-color: var(--mars-hover-color) !important;
  }
}

.sort-order-btn {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--mars-control-border);
  border-radius: var(--popup-radius, 8px);
  background: var(--mars-control-bg);
  color: var(--mars-control-text, var(--mars-text-color));
  cursor: pointer;
  transition:
    border-color var(--transition-fast, 150ms ease),
    background var(--transition-fast, 150ms ease),
    color var(--transition-fast, 150ms ease);
}

.sort-order-btn:hover {
  border-color: var(--mars-hover-color);
  color: var(--mars-hover-color, #5cadff);
}

.loading-container,
.empty-state {
  flex: 1;
  min-height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.loading, .empty {
  padding: 18px 0;
}

.list-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding-right: 4px;
}

.card {
  cursor: pointer;
  padding: 10px 12px;
  background: var(--mars-control-bg);
  border: 1px solid var(--mars-control-border);
  border-radius: var(--radius-8, 8px);
  display: flex;
  gap: 10px;
  transition: border-color var(--transition-fast, 150ms ease), background var(--transition-fast, 150ms ease);
}

.card:hover {
  background: color-mix(in srgb, var(--mars-hover-color) 10%, var(--mars-control-bg));
  border-color: color-mix(in srgb, var(--mars-hover-color) 55%, var(--mars-control-border));
}

.card-cover {
  width: 86px;
  flex: 0 0 86px;
}

.cover-img {
  width: 100%;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.name {
  font-size: 14px;
  font-weight: 600;
  color: var(--mars-text-color);
  line-height: 1.2;
}

.desc {
  color: var(--mars-extra-text-color);
  font-size: 12px;
  line-height: 1.4;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.meta .row {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}

.meta .row:last-child {
  margin-bottom: 0;
}

.meta .k {
  width: 42px;
  color: var(--mars-extra-text-color);
}

.meta .v {
  color: var(--mars-text-color);
  word-break: break-all;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.detail-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 10px;
  align-items: stretch;
  justify-items: stretch;
}

.detail-actions :deep(.ant-btn) {
  width: 100%;
  min-width: 0;
  padding-inline: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pagination {
  flex-shrink: 0;
  padding: 8px 0 4px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: 6px;
}

.detail {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.detail-header {
  display: flex;
  gap: 10px;
  align-items: center;
}

.detail-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--mars-text-color);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.detail-cover {
  width: 100%;
}

.detail-cover .cover-img {
  height: 140px;
}

.detail-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.detail-desc {
  color: var(--mars-extra-text-color);
  font-size: 12px;
  line-height: 1.6;
}

.open-mode {
  padding: 8px 0;
}
</style>
