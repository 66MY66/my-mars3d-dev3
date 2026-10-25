<template>
  <mars-dialog
    title="图层与版本"
    custom-class="ksh002-drawer ksh002-layer-version-drawer"
    :draggable="false"
    width="32%"
    top="0"
    bottom="0"
    right="0"
    :nopadding="true"
    :zIndex="10020"
    v-model:visible="visible"
  >
    <div class="lv-wrap">
      <div class="lv-header">
        <div class="lv-title" :title="collectionTitle">{{ collectionTitle }}</div>
        <div class="lv-meta">
          <a-tag v-if="editable" color="green">可编辑</a-tag>
          <a-tag v-else color="default">只读</a-tag>
          <a-tag v-if="publishStatus === 'reviewing'" color="gold">审核中</a-tag>
          <a-tag v-else-if="publishStatus === 'published'" color="blue">已发布</a-tag>
          <a-tag v-else color="default">未发布</a-tag>
        </div>
      </div>

      <a-tabs v-model:activeKey="activeTab" class="lv-tabs" @change="handleTabChange">
        <a-tab-pane key="versions" tab="版本">
          <div class="lv-pane">
            <div class="block">
              <div class="row">
                <span class="label">当前版本</span>
                <a-select v-model:value="activeRevisionId" class="select" :options="revisionOptions" />
                <a-button size="small" :loading="manifestLoading" @click="reloadActiveManifest">加载</a-button>
              </div>
              <div class="version-actions">
                <div class="version-actions__primary">
                  <a-button size="small" :disabled="!editable || !activeManifest" :loading="saving" @click="createFromActiveManifest">
                    基于该版本创建新版本
                  </a-button>
                  <a-button size="small" :disabled="!editable || !activeRevisionId" :loading="saving" @click="rollbackToActive">
                    回滚到该版本
                  </a-button>
                  <a-button
                    size="small"
                    danger
                    :disabled="!editable || !activeRevisionId || revisionOptions.length <= 1"
                    :loading="deletingRevision"
                    @click="deleteActiveRevision"
                  >
                    删除该版本
                  </a-button>
                </div>
                <a-button size="small" class="version-actions__workspace" :disabled="!editable" :loading="saving" @click="createFromWorkspace">
                  基于当前工作区创建版本
                </a-button>
              </div>
            </div>

            <div class="block">
              <div class="row">
                <span class="label">版本对比</span>
                <a-select v-model:value="compareLeftId" class="select" :options="revisionOptions" />
                <span class="split">vs</span>
                <a-select v-model:value="compareRightId" class="select" :options="revisionOptions" />
                <a-button size="small" :loading="comparing" :disabled="!compareLeftId || !compareRightId" @click="runCompare">对比</a-button>
              </div>

              <div v-if="diffResult" class="diff-summary">
                <div class="diff-kv">
                  <span class="k">新增</span><span class="v">{{ diffResult.summary.added }}</span>
                </div>
                <div class="diff-kv">
                  <span class="k">删除</span><span class="v">{{ diffResult.summary.removed }}</span>
                </div>
                <div class="diff-kv">
                  <span class="k">变更</span><span class="v">{{ diffResult.summary.changed }}</span>
                </div>
                <div class="diff-kv">
                  <span class="k">移动</span><span class="v">{{ diffResult.summary.moved }}</span>
                </div>
                <a-button size="small" @click="openDiffModal">查看详情</a-button>
              </div>
            </div>

            <div class="publish-actions">
              <div class="publish-actions__row">
                <a-button
                  size="small"
                  class="publish-btn"
                  :disabled="!editable || publishStatus !== 'private'"
                  :loading="publishing"
                  @click="submitPublish"
                >
                  提交发布
                </a-button>
                <a-button
                  size="small"
                  class="publish-btn"
                  :disabled="!editable || publishStatus !== 'reviewing'"
                  :loading="publishing"
                  @click="cancelPublish"
                >
                  取消申请
                </a-button>
                <a-button
                  size="small"
                  class="publish-btn"
                  :disabled="!editable || publishStatus !== 'published'"
                  :loading="publishing"
                  @click="withdrawPublish"
                >
                  撤回发布
                </a-button>
              </div>
              <div v-if="publishHint" class="hint">{{ publishHint }}</div>
            </div>
          </div>
        </a-tab-pane>

        <a-tab-pane key="layers" tab="图层">
          <div class="lv-pane">
            <div class="block">
              <div class="row">
                <span class="label">编辑版本</span>
                <a-select v-model:value="activeRevisionId" class="select" :options="revisionOptions" />
                <a-button size="small" :loading="manifestLoading" @click="reloadActiveManifest">加载</a-button>
              </div>
              <div class="layer-toolbar">
                <a-button size="small" class="layer-toolbar-btn" :disabled="!editable || !activeManifest" @click="openCreateGroup">
                  新建目录
                </a-button>
                <a-button size="small" class="layer-toolbar-btn" :disabled="!editable || !activeManifest" @click="openCreateLayer">
                  新建图层
                </a-button>
                <a-button
                  type="primary"
                  size="small"
                  class="layer-toolbar-btn"
                  :disabled="!editable || !activeManifest"
                  :loading="saving"
                  @click="saveLayersAsNewRevision"
                >
                  保存为新版本
                </a-button>
              </div>
              <div v-if="!editable" class="hint">该数据集为只读（STAC 外部数据集），不支持创建/编辑版本与图层</div>
            </div>

            <div v-if="manifestLoading" class="loading">
              <a-spin tip="加载版本成果包..." />
            </div>
            <div v-else class="layer-list">
              <a-empty v-if="layerLines.length === 0" description="该版本暂无图层" />
              <div v-else class="layer-list__items">
                <div
                  v-for="line in layerLines"
                  :key="line.id"
                  class="layer-row"
                  :class="{
                    'is-group': line.isGroup,
                    'is-dragging': draggingLayerId === line.id,
                    'is-drag-over-before': dragOverLayerId === line.id && dragOverPosition === 'before',
                    'is-drag-over-after': dragOverLayerId === line.id && dragOverPosition === 'after'
                  }"
                  :draggable="editable"
                  @dragstart="handleDragStart(line.id, $event)"
                  @dragover.prevent="handleDragOver(line.id, $event)"
                  @dragleave="handleDragLeave(line.id)"
                  @drop.prevent="handleDrop(line.id)"
                  @dragend="clearDragState"
                >
                  <div class="layer-row__head">
                    <span class="layer-name" :title="line.name">{{ line.name }}</span>
                    <div class="layer-row__meta">
                      <a-tag v-if="line.isGroup" color="blue" class="tag">目录</a-tag>
                      <a-tag v-else color="default" class="tag">{{ line.sourceType }}</a-tag>
                      <span v-if="line.visible === false" class="muted">隐藏</span>
                    </div>
                  </div>
                  <div v-if="!line.isGroup && line.sourceRef" class="layer-sub" :title="line.sourceRef">{{ line.sourceRef }}</div>
                  <div class="layer-actions">
                    <a-button size="small" :disabled="!editable" @click="editLayer(line.id)">编辑</a-button>
                    <a-button size="small" :disabled="!editable" @click="moveUp(line.id)">上移</a-button>
                    <a-button size="small" :disabled="!editable" @click="moveDown(line.id)">下移</a-button>
                    <a-button size="small" danger :disabled="!editable" @click="removeLayer(line.id)">删除</a-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>

    <mars-task-modal v-model:open="editModalOpen" :title="editModalTitle" @ok="submitEdit" :okLoading="editSaving">
      <a-form layout="vertical">
        <a-form-item label="ID">
          <a-input v-model:value="editForm.id" :disabled="editMode !== 'create'" />
        </a-form-item>
        <a-form-item label="名称">
          <a-input v-model:value="editForm.name" />
        </a-form-item>
        <a-form-item label="类型">
          <a-select v-model:value="editForm.sourceType">
            <a-select-option value="group">group</a-select-option>
            <a-select-option value="xyz">xyz</a-select-option>
            <a-select-option value="wms">wms</a-select-option>
            <a-select-option value="wmts">wmts</a-select-option>
            <a-select-option value="geojson">geojson</a-select-option>
            <a-select-option value="3dtiles">3dtiles</a-select-option>
            <a-select-option value="arcgis">arcgis</a-select-option>
            <a-select-option value="image">image</a-select-option>
            <a-select-option value="unknown">unknown</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="父目录">
          <a-select v-model:value="editForm.pid" :options="groupOptions" allow-clear />
        </a-form-item>
        <a-form-item label="数据源引用" v-if="editForm.sourceType !== 'group'">
          <a-input v-model:value="editForm.sourceRef" placeholder="如：瓦片服务 URL / GeoJSON URL" />
        </a-form-item>
        <a-form-item label="可见">
          <a-switch v-model:checked="editForm.visible" />
        </a-form-item>
        <a-form-item label="透明度">
          <a-slider v-model:value="editForm.opacity" :min="0" :max="1" :step="0.05" />
        </a-form-item>
        <a-form-item label="排序值">
          <a-input-number v-model:value="editForm.order" style="width: 100%" />
        </a-form-item>
        <a-form-item label="data(JSON)">
          <a-textarea v-model:value="editForm.dataText" :rows="4" placeholder='例如：{"key":"value"}' />
        </a-form-item>
        <a-form-item label="options(JSON)">
          <a-textarea v-model:value="editForm.optionsText" :rows="4" placeholder='例如：{"clampToGround":true}' />
        </a-form-item>
      </a-form>
    </mars-task-modal>

    <mars-task-modal v-model:open="diffModalOpen" title="版本差异详情" :footer="false" width="860">
      <div v-if="diffResult" class="diff-detail">
        <div class="diff-section">
          <div class="diff-title">新增（{{ diffResult.added.length }}）</div>
          <a-empty v-if="diffResult.added.length === 0" />
          <div v-else class="diff-list">
            <div v-for="l in diffResult.added" :key="l.id" class="diff-item">{{ l.name || l.id }}</div>
          </div>
        </div>
        <div class="diff-section">
          <div class="diff-title">删除（{{ diffResult.removed.length }}）</div>
          <a-empty v-if="diffResult.removed.length === 0" />
          <div v-else class="diff-list">
            <div v-for="l in diffResult.removed" :key="l.id" class="diff-item">{{ l.name || l.id }}</div>
          </div>
        </div>
        <div class="diff-section">
          <div class="diff-title">变更（{{ diffResult.changed.length }}）</div>
          <a-empty v-if="diffResult.changed.length === 0" />
          <div v-else class="diff-list">
            <div v-for="c in diffResult.changed" :key="c.id" class="diff-item">
              <div class="diff-item-title">{{ c.name || c.id }}</div>
              <div class="diff-item-sub">{{ formatChangedKeys(c.changes) }}</div>
            </div>
          </div>
        </div>
        <div class="diff-section">
          <div class="diff-title">移动（{{ diffResult.moved.length }}）</div>
          <a-empty v-if="diffResult.moved.length === 0" />
          <div v-else class="diff-list">
            <div v-for="m in diffResult.moved" :key="m.id" class="diff-item">
              <div class="diff-item-title">{{ m.name || m.id }}</div>
              <div class="diff-item-sub">pid: {{ String(m.fromPid || "-") }} → {{ String(m.toPid || "-") }}，order: {{ m.fromOrder ?? "-" }} → {{ m.toOrder ?? "-" }}</div>
            </div>
          </div>
        </div>
      </div>
    </mars-task-modal>
  </mars-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import { $message } from "@mars/components/mars-ui/index"
import type { Manifest, StacCollection, StacItem } from "../types/eoapi-types"
import { diffManifests } from "../services/manifest-diff"
import {
  cancelDatasetPublishRequest,
  deleteDatasetRevision,
  getRevisionManifest,
  rollbackDatasetRevision,
  saveDatasetRevision,
  submitDatasetPublishRequest,
  withdrawDatasetPublish
} from "../services/eoapi-datasets"
import { getDatasetPublishStatus, requestDatasetShare, withdrawDatasetShare } from "../services/publish-status"
import { reorderLayerByDrop, type DropPosition } from "../services/layer-reorder"
import { serializeWorkspace } from "../workspace/serialize"
import * as mapWork from "../map"

const props = defineProps<{
  open: boolean
  collection: StacCollection
  revisions: StacItem[]
}>()

const emit = defineEmits<{
  "update:open": [value: boolean]
  saved: []
}>()

const visible = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v)
})

// #region debug-point ksh002-layer-version-drawer-report
async function reportDebug(type: string, data?: Record<string, unknown>) {
  try {
    const url = String(localStorage.getItem("TRAE_DEBUG_SERVER_URL") || "").trim()
    if (!url) {
      return
    }
    const sessionId = String(localStorage.getItem("TRAE_DEBUG_SESSION_ID") || "ksh002-3x-highrisk")
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({
        t: Date.now(),
        sessionId,
        level: "info",
        type,
        message: type,
        data: data || {}
      })
    })
  } catch {
  }
}
// #endregion debug-point ksh002-layer-version-drawer-report

const activeTab = ref<"versions" | "layers">("versions")
const activeRevisionId = ref("")
const compareLeftId = ref("")
const compareRightId = ref("")
const comparing = ref(false)
const diffResult = ref<any>(null)
const diffModalOpen = ref(false)

const manifestLoading = ref(false)
const saving = ref(false)
const deletingRevision = ref(false)
const publishing = ref(false)
const publishHint = ref("")
const draggingLayerId = ref("")
const dragOverLayerId = ref("")
const dragOverPosition = ref<DropPosition>("before")

const activeManifest = ref<Manifest | null>(null)
const layersDraft = ref<any[]>([])

const editModalOpen = ref(false)
const editSaving = ref(false)
const editMode = ref<"create" | "edit">("create")
const editModalTitle = computed(() => (editMode.value === "create" ? "新建图层/目录" : "编辑图层/目录"))
const editForm = ref<any>({
  id: "",
  name: "",
  sourceType: "xyz",
  sourceRef: "",
  pid: undefined,
  visible: true,
  opacity: 1,
  order: 0,
  dataText: "",
  optionsText: ""
})

const editable = computed(() => {
  const id = String(props.collection?.id || "")
  if (!id) {
    return false
  }
  if (id.startsWith("local_") || id.startsWith("ds_")) {
    return true
  }
  const hasVisibility = (props.collection?.summaries as any)?.visibility
  return !!hasVisibility
})

const publishStatus = computed(() => getDatasetPublishStatus(String(props.collection?.id || "")))

const collectionTitle = computed(() => props.collection?.title || props.collection?.id || "")

const revisionOptions = computed(() => {
  const list = Array.isArray(props.revisions) ? props.revisions : []
  return list.map((it) => ({
    value: String(it.id),
    label: String(it.properties?.title || it.id)
  }))
})

const groupOptions = computed(() => {
  const groups = layersDraft.value.filter((l) => String(l?.sourceType || "") === "group")
  return groups.map((g: any) => ({ value: String(g.id), label: String(g.name || g.id) }))
})

type LayerLine = {
  id: string
  name: string
  sourceType: string
  sourceRef: string
  pid?: string | number
  order?: number
  visible?: boolean
  isGroup: boolean
  depth: number
}

function normalizeLayersToLines(layers: any[]): LayerLine[] {
  const list = Array.isArray(layers) ? layers : []
  const byId: Record<string, any> = {}
  for (const l of list) {
    const id = String(l?.id || "").trim()
    if (id) {
      byId[id] = l
    }
  }

  const children: Record<string, string[]> = {}
  const roots: string[] = []
  for (const l of list) {
    const id = String(l?.id || "").trim()
    if (!id) {
      continue
    }
    const pid = l?.pid != null ? String(l.pid) : ""
    if (pid && byId[pid]) {
      children[pid] = children[pid] || []
      children[pid].push(id)
    } else {
      roots.push(id)
    }
  }

  const orderOf = (id: string) => {
    const l = byId[id]
    const o = Number(l?.order)
    return Number.isFinite(o) ? o : 0
  }

  const sortedChildren = (ids: string[]) => [...ids].sort((a, b) => orderOf(a) - orderOf(b))

  const walk = (id: string, depth: number, acc: LayerLine[]) => {
    const l = byId[id]
    if (!l) {
      return
    }
    const isGroup = String(l?.sourceType || "") === "group"
    acc.push({
      id: String(l.id),
      name: String(l.name || l.id),
      sourceType: String(l.sourceType || ""),
      sourceRef: String(l.sourceRef || ""),
      pid: l.pid,
      order: l.order,
      visible: l.visible,
      isGroup,
      depth
    })
    const kids = children[id] || []
    for (const cid of sortedChildren(kids)) {
      walk(cid, depth + 1, acc)
    }
  }

  const result: LayerLine[] = []
  for (const id of sortedChildren(roots)) {
    walk(id, 0, result)
  }
  return result
}

const layerLines = computed(() => normalizeLayersToLines(layersDraft.value))

function handleTabChange(key: string) {
  // #region debug-point ksh002-layer-version-drawer-tab-change
  reportDebug("ksh002-layer-version-drawer.tab-change", {
    key,
    activeTab: activeTab.value,
    visible: visible.value,
    activeRevisionId: activeRevisionId.value,
    layerCount: layersDraft.value.length
  }).catch(() => {})
  // #endregion debug-point ksh002-layer-version-drawer-tab-change
}

function resetDiff() {
  diffResult.value = null
  diffModalOpen.value = false
}

async function loadManifestForRevision(revisionId: string) {
  // #region debug-point ksh002-layer-version-drawer-load-start
  reportDebug("ksh002-layer-version-drawer.load-start", {
    revisionId,
    activeTab: activeTab.value,
    visible: visible.value,
    revisionsCount: props.revisions.length
  }).catch(() => {})
  // #endregion debug-point ksh002-layer-version-drawer-load-start
  if (!revisionId) {
    activeManifest.value = null
    layersDraft.value = []
    return
  }
  manifestLoading.value = true
  try {
    const res = await getRevisionManifest(String(props.collection?.id || ""), revisionId)
    if (!res.success || !res.data) {
      $message(res.message || "加载版本成果包失败")
      activeManifest.value = null
      layersDraft.value = []
      return
    }
    activeManifest.value = res.data
    const cloned = JSON.parse(JSON.stringify(res.data.layers || []))
    layersDraft.value = Array.isArray(cloned) ? cloned : []
    // #region debug-point ksh002-layer-version-drawer-load-success
    reportDebug("ksh002-layer-version-drawer.load-success", {
      revisionId,
      activeTab: activeTab.value,
      layersCount: layersDraft.value.length
    }).catch(() => {})
    // #endregion debug-point ksh002-layer-version-drawer-load-success
  } catch (e: any) {
    $message(e?.message || "加载版本成果包失败")
    activeManifest.value = null
    layersDraft.value = []
    // #region debug-point ksh002-layer-version-drawer-load-error
    reportDebug("ksh002-layer-version-drawer.load-error", {
      revisionId,
      activeTab: activeTab.value,
      message: e?.message || "加载版本成果包失败"
    }).catch(() => {})
    // #endregion debug-point ksh002-layer-version-drawer-load-error
  } finally {
    manifestLoading.value = false
  }
}

async function reloadActiveManifest() {
  resetDiff()
  await loadManifestForRevision(activeRevisionId.value)
}

async function createFromActiveManifest() {
  if (!activeManifest.value) {
    return
  }
  saving.value = true
  try {
    const dsId = String(props.collection?.id || "")
    const res = await saveDatasetRevision(dsId, {
      message: `基于 ${activeRevisionId.value} 创建`,
      manifest: activeManifest.value
    })
    if (!res.success) {
      $message(res.message || "创建版本失败")
      return
    }
    $message("已创建新版本")
    emit("saved")
  } finally {
    saving.value = false
  }
}

async function rollbackToActive() {
  const dsId = String(props.collection?.id || "")
  if (!dsId || !activeRevisionId.value) {
    return
  }
  saving.value = true
  try {
    const res = await rollbackDatasetRevision(dsId, activeRevisionId.value)
    if (!res.success) {
      $message(res.message || "回滚失败")
      return
    }
    $message("已回滚（产生新版本）")
    emit("saved")
  } finally {
    saving.value = false
  }
}

async function deleteActiveRevision() {
  const dsId = String(props.collection?.id || "")
  const revisionId = String(activeRevisionId.value || "")
  if (!dsId || !revisionId) {
    return
  }
  if (revisionOptions.value.length <= 1) {
    $message("至少保留一个版本")
    return
  }
  if (!window.confirm(`确认删除版本 ${revisionId} 吗？`)) {
    return
  }
  deletingRevision.value = true
  try {
    const nextActive = revisionOptions.value.find((opt) => String(opt.value) !== revisionId)?.value
    const res = await deleteDatasetRevision(dsId, revisionId)
    if (!res.success) {
      $message(res.message || "删除版本失败")
      return
    }
    activeRevisionId.value = String(nextActive || "")
    activeManifest.value = null
    layersDraft.value = []
    resetDiff()
    $message("已删除版本")
    emit("saved")
  } finally {
    deletingRevision.value = false
  }
}

async function createFromWorkspace() {
  const map = mapWork.getMap()
  if (!map) {
    $message("地图未初始化")
    return
  }
  const dsId = String(props.collection?.id || "")
  saving.value = true
  try {
    const manifest = serializeWorkspace(map, {
      includeViewState: true,
      includeLayers: true,
      includeDrawFeatures: true
    })
    const res = await saveDatasetRevision(dsId, { message: "从工作区保存", manifest })
    if (!res.success) {
      $message(res.message || "保存版本失败")
      return
    }
    $message("已保存为新版本")
    emit("saved")
  } finally {
    saving.value = false
  }
}

async function runCompare() {
  comparing.value = true
  try {
    const dsId = String(props.collection?.id || "")
    const leftRes = await getRevisionManifest(dsId, compareLeftId.value)
    const rightRes = await getRevisionManifest(dsId, compareRightId.value)
    if (!leftRes.success || !leftRes.data) {
      $message(leftRes.message || "左侧版本成果包不可用")
      return
    }
    if (!rightRes.success || !rightRes.data) {
      $message(rightRes.message || "右侧版本成果包不可用")
      return
    }
    diffResult.value = diffManifests(leftRes.data, rightRes.data)
  } finally {
    comparing.value = false
  }
}

function openDiffModal() {
  diffModalOpen.value = true
}

function formatChangedKeys(changes: Array<{ key?: string }> | undefined): string {
  return Array.isArray(changes)
    ? changes.map((change) => String(change?.key || "")).filter(Boolean).join("、")
    : ""
}

function openCreateGroup() {
  editMode.value = "create"
  editForm.value = {
    id: `group_${Date.now()}`,
    name: "新建目录",
    sourceType: "group",
    sourceRef: "",
    pid: undefined,
    visible: true,
    opacity: 1,
    order: nextOrderValue(),
    dataText: "",
    optionsText: ""
  }
  editModalOpen.value = true
}

function openCreateLayer() {
  editMode.value = "create"
  editForm.value = {
    id: `layer_${Date.now()}`,
    name: "新建图层",
    sourceType: "xyz",
    sourceRef: "",
    pid: undefined,
    visible: true,
    opacity: 1,
    order: nextOrderValue(),
    dataText: "",
    optionsText: ""
  }
  editModalOpen.value = true
}

function editLayer(layerId: string) {
  const l = layersDraft.value.find((x: any) => String(x?.id || "") === String(layerId))
  if (!l) {
    return
  }
  editMode.value = "edit"
  editForm.value = {
    id: String(l.id),
    name: String(l.name || ""),
    sourceType: String(l.sourceType || "unknown"),
    sourceRef: String(l.sourceRef || ""),
    pid: l.pid != null ? String(l.pid) : undefined,
    visible: l.visible !== false,
    opacity: Number.isFinite(Number(l.opacity)) ? Number(l.opacity) : 1,
    order: Number.isFinite(Number(l.order)) ? Number(l.order) : 0,
    dataText: l.data ? JSON.stringify(l.data, null, 2) : "",
    optionsText: l.options ? JSON.stringify(l.options, null, 2) : ""
  }
  editModalOpen.value = true
}

function nextOrderValue(): number {
  const list = layersDraft.value
  if (!Array.isArray(list) || !list.length) {
    return 0
  }
  const max = Math.max(...list.map((l: any) => (Number.isFinite(Number(l?.order)) ? Number(l.order) : 0)))
  return max + 1
}

function submitEdit() {
  if (editSaving.value) {
    return
  }
  const id = String(editForm.value.id || "").trim()
  if (!id) {
    $message("ID 不能为空")
    return
  }
  const sourceType = String(editForm.value.sourceType || "").trim()
  if (!sourceType) {
    $message("类型不能为空")
    return
  }
  if (sourceType !== "group") {
    const ref = String(editForm.value.sourceRef || "").trim()
    if (!ref) {
      $message("数据源引用不能为空")
      return
    }
  }

  const parseJson = (txt: string) => {
    const raw = String(txt || "").trim()
    if (!raw) {
      return undefined
    }
    return JSON.parse(raw)
  }

  editSaving.value = true
  try {
    const data = (() => {
      try {
        return parseJson(editForm.value.dataText)
      } catch {
        $message("data(JSON) 格式错误")
        return "__invalid__"
      }
    })()
    if (data === "__invalid__") {
      return
    }
    const options = (() => {
      try {
        return parseJson(editForm.value.optionsText)
      } catch {
        $message("options(JSON) 格式错误")
        return "__invalid__"
      }
    })()
    if (options === "__invalid__") {
      return
    }

    const next = {
      id,
      name: String(editForm.value.name || "").trim() || id,
      sourceType: sourceType as any,
      sourceRef: sourceType === "group" ? "" : String(editForm.value.sourceRef || "").trim(),
      pid: editForm.value.pid ? String(editForm.value.pid) : undefined,
      visible: !!editForm.value.visible,
      opacity: Number.isFinite(Number(editForm.value.opacity)) ? Number(editForm.value.opacity) : 1,
      order: Number.isFinite(Number(editForm.value.order)) ? Number(editForm.value.order) : 0,
      data,
      options
    } as any

    if (editMode.value === "create") {
      if (layersDraft.value.some((x: any) => String(x?.id || "") === id)) {
        $message("ID 已存在")
        return
      }
      layersDraft.value.push(next)
    } else {
      const idx = layersDraft.value.findIndex((x: any) => String(x?.id || "") === id)
      if (idx === -1) {
        return
      }
      layersDraft.value.splice(idx, 1, next)
    }
    editModalOpen.value = false
  } finally {
    editSaving.value = false
  }
}

function removeLayer(layerId: string) {
  const id = String(layerId || "")
  const idx = layersDraft.value.findIndex((x: any) => String(x?.id || "") === id)
  if (idx === -1) {
    return
  }
  const hasChild = layersDraft.value.some((x: any) => String(x?.pid || "") === id)
  if (hasChild) {
    $message("该目录/图层存在子项，请先删除子项")
    return
  }
  layersDraft.value.splice(idx, 1)
}

function moveUp(layerId: string) {
  reorderSibling(layerId, -1)
}

function moveDown(layerId: string) {
  reorderSibling(layerId, 1)
}

function handleDragStart(layerId: string, event: DragEvent): void {
  if (!editable.value) {
    return
  }
  draggingLayerId.value = String(layerId)
  event.dataTransfer?.setData("text/plain", String(layerId))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move"
  }
}

function handleDragOver(layerId: string, event: DragEvent): void {
  const target = event.currentTarget as HTMLElement | null
  if (!target || !draggingLayerId.value || draggingLayerId.value === String(layerId)) {
    return
  }
  const rect = target.getBoundingClientRect()
  dragOverLayerId.value = String(layerId)
  dragOverPosition.value = event.clientY - rect.top < rect.height / 2 ? "before" : "after"
}

function handleDragLeave(layerId: string): void {
  if (dragOverLayerId.value === String(layerId)) {
    dragOverLayerId.value = ""
  }
}

function handleDrop(targetId: string): void {
  const draggedId = draggingLayerId.value
  if (!draggedId || draggedId === String(targetId)) {
    clearDragState()
    return
  }
  const next = reorderLayerByDrop(layersDraft.value as any, draggedId, String(targetId), dragOverPosition.value)
  if (next !== layersDraft.value) {
    layersDraft.value = next as any
  }
  clearDragState()
}

function clearDragState(): void {
  draggingLayerId.value = ""
  dragOverLayerId.value = ""
}

function reorderSibling(layerId: string, delta: -1 | 1) {
  const id = String(layerId || "")
  const current = layersDraft.value.find((x: any) => String(x?.id || "") === id)
  if (!current) {
    return
  }
  const pid = current?.pid != null ? String(current.pid) : "__root__"
  const siblings = layersDraft.value
    .filter((x: any) => (x?.pid != null ? String(x.pid) : "__root__") === pid)
    .sort((a: any, b: any) => (Number(a?.order) || 0) - (Number(b?.order) || 0))

  const idx = siblings.findIndex((x: any) => String(x?.id || "") === id)
  const nextIdx = idx + delta
  if (idx === -1 || nextIdx < 0 || nextIdx >= siblings.length) {
    return
  }
  const a = siblings[idx]
  const b = siblings[nextIdx]
  const orderA = Number.isFinite(Number(a?.order)) ? Number(a.order) : 0
  const orderB = Number.isFinite(Number(b?.order)) ? Number(b.order) : 0
  a.order = orderB
  b.order = orderA
}

async function saveLayersAsNewRevision() {
  if (!activeManifest.value) {
    return
  }
  const dsId = String(props.collection?.id || "")
  saving.value = true
  try {
    const next: Manifest = {
      ...(activeManifest.value as any),
      layers: JSON.parse(JSON.stringify(layersDraft.value || [])),
      createdAt: Date.now()
    }
    const res = await saveDatasetRevision(dsId, { message: "图层编辑保存", manifest: next })
    if (!res.success) {
      $message(res.message || "保存失败")
      return
    }
    $message("已保存为新版本")
    emit("saved")
  } finally {
    saving.value = false
  }
}

async function submitPublish() {
  publishing.value = true
  publishHint.value = ""
  try {
    const dsId = String(props.collection?.id || "")
    const res = await submitDatasetPublishRequest(dsId)
    if (!res.success) {
      $message(res.message || "提交发布失败")
      return
    }
    requestDatasetShare(dsId, "shared")
    publishHint.value = "已提交发布申请（当前后端未返回审核结果时，状态以本地记录为准）"
  } finally {
    publishing.value = false
  }
}

async function cancelPublish() {
  publishing.value = true
  publishHint.value = ""
  try {
    const dsId = String(props.collection?.id || "")
    const res = await cancelDatasetPublishRequest(dsId)
    if (!res.success) {
      $message(res.message || "取消申请失败")
      return
    }
    withdrawDatasetShare(dsId)
    publishHint.value = "已取消发布申请"
  } finally {
    publishing.value = false
  }
}

async function withdrawPublish() {
  publishing.value = true
  publishHint.value = ""
  try {
    const dsId = String(props.collection?.id || "")
    const res = await withdrawDatasetPublish(dsId)
    if (!res.success) {
      $message(res.message || "撤回发布失败")
      return
    }
    withdrawDatasetShare(dsId)
    publishHint.value = "已撤回发布"
  } finally {
    publishing.value = false
  }
}

watch(
  () => props.revisions,
  (list) => {
    const first = Array.isArray(list) && list.length ? String(list[0].id) : ""
    if (!activeRevisionId.value) {
      activeRevisionId.value = first
    }
    if (!compareLeftId.value) {
      compareLeftId.value = first
    }
    if (!compareRightId.value) {
      compareRightId.value = Array.isArray(list) && list.length > 1 ? String(list[1].id) : first
    }
    if (visible.value && first) {
      loadManifestForRevision(activeRevisionId.value || first).catch(() => {})
    }
    // #region debug-point ksh002-layer-version-drawer-revisions-watch
    reportDebug("ksh002-layer-version-drawer.revisions-watch", {
      first,
      activeTab: activeTab.value,
      visible: visible.value,
      revisionsCount: Array.isArray(list) ? list.length : 0,
      activeRevisionId: activeRevisionId.value
    }).catch(() => {})
    // #endregion debug-point ksh002-layer-version-drawer-revisions-watch
  },
  { immediate: true, deep: true }
)

watch(
  () => visible.value,
  (v) => {
    if (v) {
      const first = Array.isArray(props.revisions) && props.revisions.length ? String(props.revisions[0].id) : ""
      if (!activeRevisionId.value) {
        activeRevisionId.value = first
      }
      if (activeRevisionId.value) {
        loadManifestForRevision(activeRevisionId.value).catch(() => {})
      }
    } else {
      resetDiff()
      activeTab.value = "versions"
    }
    // #region debug-point ksh002-layer-version-drawer-visible-watch
    reportDebug("ksh002-layer-version-drawer.visible-watch", {
      visible: v,
      activeTab: activeTab.value,
      activeRevisionId: activeRevisionId.value,
      revisionsCount: props.revisions.length
    }).catch(() => {})
    // #endregion debug-point ksh002-layer-version-drawer-visible-watch
  }
)

watch(
  () => activeTab.value,
  async (tab, prev) => {
    await nextTick()
    const drawerEl = document.querySelector(".ksh002-layer-version-drawer")
    const activeDomTab = drawerEl?.querySelector(".ant-tabs-tab.ant-tabs-tab-active")?.textContent?.trim() || ""
    const activePaneText =
      Array.from(drawerEl?.querySelectorAll(".ant-tabs-tabpane") || [])
        .filter((panel) => {
          const style = window.getComputedStyle(panel as HTMLElement)
          return style.display !== "none"
        })
        .map((panel) => panel.textContent?.trim()?.slice(0, 120) || "")
        .join(" | ") || ""
    // #region debug-point ksh002-layer-version-drawer-active-tab-watch
    reportDebug("ksh002-layer-version-drawer.active-tab-watch", {
      tab,
      prev,
      visible: visible.value,
      activeRevisionId: activeRevisionId.value,
      layerCount: layersDraft.value.length,
      activeDomTab,
      activePaneText
    }).catch(() => {})
    // #endregion debug-point ksh002-layer-version-drawer-active-tab-watch
  }
)
</script>

<style scoped>
.lv-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: var(--mars-text-color);
}

.lv-header {
  flex-shrink: 0;
  padding: 12px 12px 0 12px;
}

.lv-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: var(--mars-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lv-meta {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* Tabs：导航固定顶部，仅面板内容滚动；字号对齐数据集名称 */
.lv-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 12px 12px;
  color: var(--mars-text-color);
}

.lv-tabs :deep(.ant-tabs-nav) {
  flex-shrink: 0;
  margin: 8px 0 0;
  position: sticky;
  top: 0;
  z-index: 3;
  background: color-mix(in srgb, var(--popup-surface, rgba(23, 35, 61, 0.92)) 92%, transparent);
  backdrop-filter: blur(8px);
}

.lv-tabs :deep(.ant-tabs-nav::before) {
  border-bottom-color: var(--popup-border, rgba(255, 255, 255, 0.12));
}

.lv-tabs :deep(.ant-tabs-tab) {
  padding: 10px 0;
  font-size: 16px;
  line-height: 24px;
  color: var(--mars-extra-text-color, var(--mars-text-color-secondary));
}

.lv-tabs :deep(.ant-tabs-tab .ant-tabs-tab-btn) {
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.lv-tabs :deep(.ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: var(--mars-primary-color, #2d8cf0);
}

.lv-tabs :deep(.ant-tabs-ink-bar) {
  background: var(--mars-primary-color, #2d8cf0);
}

.lv-tabs :deep(.ant-tabs-content-holder) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.lv-tabs :deep(.ant-tabs-content) {
  height: 100%;
}

.lv-tabs :deep(.ant-tabs-tabpane) {
  height: 100%;
}

.lv-tabs :deep(.ant-empty-description) {
  color: var(--mars-extra-text-color, var(--mars-text-color-secondary));
}

.lv-pane {
  height: 100%;
  overflow: auto;
  padding-top: 12px;
}

.block {
  border: 1px solid var(--popup-border, rgba(255, 255, 255, 0.12));
  border-radius: var(--popup-item-radius, 8px);
  padding: 12px;
  margin-bottom: 12px;
  background: color-mix(in srgb, var(--popup-surface, rgba(35, 52, 79, 0.82)) 88%, transparent);
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.row.actions {
  margin-top: 10px;
}

/* 版本操作：三按钮左对齐，间距 8px，不过度拉开 */
.version-actions {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.version-actions__primary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.version-actions__workspace {
  align-self: flex-start;
}

.label {
  width: 68px;
  flex-shrink: 0;
  font-size: 14px;
  color: var(--mars-extra-text-color, var(--mars-text-color-secondary));
}

.select {
  min-width: 160px;
  flex: 1;
}

/* 下拉：去掉外层直角描边，只保留 selector 圆角边框 */
.lv-wrap :deep(.ant-select) {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
}

.lv-wrap :deep(.ant-select .ant-select-selector) {
  border: 1px solid var(--mars-control-border, var(--popup-border)) !important;
  border-radius: var(--popup-item-radius, 8px) !important;
  background-color: var(--mars-control-bg) !important;
  box-shadow: none !important;
  outline: none !important;
}

.lv-wrap :deep(.ant-select:hover .ant-select-selector),
.lv-wrap :deep(.ant-select-focused .ant-select-selector),
.lv-wrap :deep(.ant-select-open .ant-select-selector) {
  border-color: var(--mars-hover-color, #5cadff) !important;
  border-radius: var(--popup-item-radius, 8px) !important;
  box-shadow: none !important;
}

.lv-wrap :deep(.ant-select-selection-search-input) {
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.split {
  color: var(--mars-extra-text-color, var(--mars-text-color-secondary));
}

.hint {
  margin-top: 8px;
  color: var(--mars-extra-text-color, var(--mars-text-color-secondary));
  font-size: 12px;
  line-height: 18px;
}

/* 发布三按钮：无外层板块框，等宽铺满左右对齐，字号不变、扩大按钮底 */
.publish-actions {
  margin-bottom: 12px;
}

.publish-actions__row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  width: 100%;
}

.publish-btn {
  flex: 1 1 0;
  min-width: 0;
  height: 36px !important;
  padding: 0 12px !important;
  font-size: 12px !important;
  line-height: 20px !important;
  border-radius: var(--popup-item-radius, 8px) !important;
}

/* 图层工具栏：三按钮等宽铺满左右对齐 */
.layer-toolbar {
  margin-top: 10px;
  display: flex;
  align-items: stretch;
  gap: 8px;
  width: 100%;
}

.layer-toolbar-btn {
  flex: 1 1 0;
  min-width: 0;
  height: 36px !important;
  padding: 0 8px !important;
  font-size: 12px !important;
  line-height: 20px !important;
  border-radius: var(--popup-item-radius, 8px) !important;
}

.loading {
  padding: 18px 0;
}

.layer-list {
  padding-bottom: 8px;
}

.layer-list__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 图层列表项：目录与叶子项统一左对齐（不再按 depth 递增缩进） */
.layer-row {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  width: 100%;
  border: 1px solid var(--popup-border, rgba(255, 255, 255, 0.12));
  border-radius: var(--popup-item-radius, 8px);
  padding: 12px;
  background: var(--mars-control-bg, rgba(255, 255, 255, 0.04));
  box-sizing: border-box;
  cursor: grab;
  transition: border-color 160ms ease, background 160ms ease, opacity 160ms ease;
}

.layer-row:active {
  cursor: grabbing;
}

.layer-row.is-dragging {
  opacity: 0.45;
}

.layer-row.is-drag-over-before::before,
.layer-row.is-drag-over-after::after {
  content: "";
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  border-radius: 2px;
  background: var(--mars-primary-color, #1677ff);
  pointer-events: none;
}

.layer-row.is-drag-over-before::before {
  top: -5px;
}

.layer-row.is-drag-over-after::after {
  bottom: -5px;
}

.layer-row.is-group {
  background: color-mix(in srgb, var(--popup-surface, rgba(35, 52, 79, 0.82)) 72%, transparent);
}

.layer-row__head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.layer-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  text-align: left;
  color: var(--mars-text-color);
}

.layer-row__meta {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  flex-shrink: 0;
}

.tag {
  margin: 0;
}

.muted {
  color: var(--mars-extra-text-color, var(--mars-text-color-secondary));
  font-size: 12px;
  line-height: 18px;
}

.layer-sub {
  width: 100%;
  color: var(--mars-extra-text-color, var(--mars-text-color-secondary));
  font-size: 12px;
  line-height: 18px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.diff-summary {
  margin-top: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.diff-kv {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 8px;
  border-radius: var(--popup-item-radius, 8px);
  border: 1px solid var(--popup-border, rgba(255, 255, 255, 0.08));
  background: color-mix(in srgb, var(--mars-primary-color, #2d8cf0) 10%, transparent);
}

.diff-kv .k {
  color: var(--mars-extra-text-color, var(--mars-text-color-secondary));
}

.diff-kv .v {
  font-weight: 600;
  color: var(--mars-text-color);
}

.diff-detail {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  color: var(--mars-text-color);
}

.diff-section {
  border: 1px solid var(--popup-border, rgba(255, 255, 255, 0.12));
  border-radius: var(--popup-item-radius, 8px);
  padding: 12px;
  background: color-mix(in srgb, var(--popup-surface, rgba(35, 52, 79, 0.82)) 88%, transparent);
}

.diff-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--mars-text-color);
}

.diff-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diff-item {
  padding: 8px 10px;
  border-radius: var(--popup-item-radius, 8px);
  border: 1px solid var(--popup-border, rgba(255, 255, 255, 0.08));
  background: var(--mars-control-bg, rgba(255, 255, 255, 0.04));
  color: var(--mars-text-color);
}

.diff-item-title {
  font-weight: 600;
  color: var(--mars-text-color);
}

.diff-item-sub {
  margin-top: 4px;
  color: var(--mars-extra-text-color, var(--mars-text-color-secondary));
  font-size: 12px;
}
</style>
