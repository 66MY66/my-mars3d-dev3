<template>
  <div class="dataset-detail">
    <div v-if="!datasetId" class="hint">选择左侧数据集查看详情</div>
    <a-space v-else direction="vertical" :size="8" style="width: 100%">
      <a-alert v-if="error" type="error" :message="error" show-icon />
      <a-card size="small" :title="dataset?.name || datasetId">
        <div class="meta">{{ dataset?.description || datasetId }}</div>
        <div class="meta" style="margin-top: 4px">可见性：{{ dataset?.visibility || "unknown" }}</div>
        <a-space :size="8" style="margin-top: 8px">
          <a-button size="small" @click="reload">刷新</a-button>
          <a-button size="small" :disabled="sharing" @click="toggleShare">{{ shareText }}</a-button>
          <a-button size="small" :disabled="forking" @click="openFork">派生</a-button>
          <a-button size="small" type="primary" :disabled="!selectedRevisionId" :loading="importing" @click="importSelected">
            导入所选版本
          </a-button>
        </a-space>
      </a-card>

      <a-card size="small" title="版本/条目">
        <a-list :data-source="revisions" :loading="loading" size="small" bordered>
          <template #renderItem="{ item }">
            <a-list-item class="rev-row" @click="selectedRevisionId = item.revisionId">
              <a-radio :checked="selectedRevisionId === item.revisionId" />
              <div class="rev-main">
                <div class="rev-title">{{ item.revisionId }}</div>
                <div class="rev-desc">{{ item.message || item.createdAt || '' }}</div>
              </div>
            </a-list-item>
          </template>
        </a-list>
      </a-card>

      <mars-task-modal v-model:open="importOpen" title="选择导入内容" :okLoading="importing" @ok="confirmImport">
        <a-form layout="vertical">
          <a-form-item label="导入策略" required>
            <a-radio-group v-model:value="importStrategy">
              <a-radio value="overlay">叠加</a-radio>
              <a-radio value="replace">替换</a-radio>
            </a-radio-group>
          </a-form-item>
          <a-form-item label="图层选择">
            <a-space :size="8" style="margin-bottom: 8px">
              <a-button size="small" @click="selectAllLayers">全选</a-button>
              <a-button size="small" @click="clearAllLayers">全不选</a-button>
            </a-space>
            <a-checkbox-group v-model:value="checkedLayerIds">
              <a-space direction="vertical" :size="6" style="width: 100%">
                <a-checkbox v-for="l in previewLayers" :key="l.id" :value="l.id">
                  {{ l.name || l.id }}
                </a-checkbox>
              </a-space>
            </a-checkbox-group>
          </a-form-item>
          <a-checkbox v-model:checked="restoreView">恢复视角</a-checkbox>
          <a-checkbox v-model:checked="restoreDraw" style="margin-left: 12px">恢复标绘</a-checkbox>
        </a-form>
      </mars-task-modal>

      <mars-task-modal v-model:open="forkOpen" title="派生数据集" :okLoading="forking" @ok="confirmFork">
        <a-form layout="vertical">
          <a-form-item label="新数据集名称" required>
            <a-input v-model:value="forkName" />
          </a-form-item>
          <a-form-item label="派生自版本">
            <a-input v-model:value="selectedRevisionId" disabled />
          </a-form-item>
        </a-form>
      </mars-task-modal>
    </a-space>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { $message } from "@mars/components/mars-ui/index"
import { forkDataset, getDataset, getRevisions, getRevisionManifest, setDatasetShare } from "../services/eoapi-datasets"
import type { EoapiDataset, EoapiRevision, Manifest } from "../types/eoapi-types"
import { restoreWorkspace } from "../workspace/restore"
import { getMap } from "../map"

const props = defineProps<{
  datasetId: string
}>()

const datasetId = computed(() => String(props.datasetId || "").trim())
const loading = ref(false)
const importing = ref(false)
const error = ref("")
const dataset = ref<EoapiDataset | null>(null)
const revisions = ref<EoapiRevision[]>([])
const selectedRevisionId = ref<string>("")

const importOpen = ref(false)
const importStrategy = ref<"overlay" | "replace">("overlay")
const previewManifest = ref<Manifest | null>(null)
const previewLayers = ref<Array<{ id: string; name?: string }>>([])
const checkedLayerIds = ref<string[]>([])
const restoreView = ref(true)
const restoreDraw = ref(true)

const sharing = ref(false)
const forking = ref(false)
const forkOpen = ref(false)
const forkName = ref("")

const shareText = computed(() => {
  const v = dataset.value?.visibility
  if (v === "shared") {
    return "设为私有"
  }
  return "设为共享"
})

async function reload() {
  const id = datasetId.value
  if (!id) {
    dataset.value = null
    revisions.value = []
    selectedRevisionId.value = ""
    return
  }

  loading.value = true
  error.value = ""

  const d = await getDataset(id)
  if (d.success) {
    dataset.value = d.data || null
  } else {
    dataset.value = { datasetId: id, name: id }
  }

  const r = await getRevisions(id)
  if (!r.success) {
    error.value = r.message || "加载版本失败"
    revisions.value = []
    selectedRevisionId.value = ""
  } else {
    revisions.value = (r.data || []).filter((x) => x.revisionId)
    selectedRevisionId.value = revisions.value[0]?.revisionId || ""
  }

  loading.value = false
}

async function importSelected() {
  const did = datasetId.value
  const rid = selectedRevisionId.value
  if (!did || !rid) {
    return
  }

  importing.value = true
  const res = await getRevisionManifest(did, rid)
  if (!res.success || !res.data) {
    importing.value = false
    $message(res.message || "未找到成果包(manifest)")
    return
  }
  previewManifest.value = res.data
  const ls = Array.isArray(res.data.layers) ? res.data.layers : []
  previewLayers.value = ls.map((l: any, idx: number) => ({
    id: String(l?.id ?? `layer_${idx}`),
    name: typeof l?.name === "string" ? l.name : undefined
  }))
  checkedLayerIds.value = previewLayers.value.map((l) => l.id)
  importOpen.value = true
  importing.value = false
}

function selectAllLayers() {
  checkedLayerIds.value = previewLayers.value.map((l) => l.id)
}

function clearAllLayers() {
  checkedLayerIds.value = []
}

async function confirmImport() {
  const did = datasetId.value
  const rid = selectedRevisionId.value
  const data = previewManifest.value
  if (!did || !rid || !data) {
    return
  }

  const map = getMap()
  if (!map) {
    $message("地图未就绪")
    return
  }
  if (checkedLayerIds.value.length === 0) {
    $message("请至少选择一个图层")
    return
  }

  importing.value = true
  try {
    const prefix = `eoapi_${did}_`
    const layers = safeArray<any>(data.layers)
      .filter((l) => checkedLayerIds.value.includes(String(l?.id)))
      .map((l: any) => ({ ...l, id: `${prefix}${l.id}` }))

    const manifest: Manifest = { ...data, layers }

    await restoreWorkspace(map, manifest, {
      strategy: importStrategy.value,
      layerIdPrefix: prefix,
      restoreView: restoreView.value,
      restoreDraw: restoreDraw.value
    })

    importOpen.value = false
    $message("导入完成", "success")
  } finally {
    importing.value = false
  }
}

function safeArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

async function toggleShare() {
  const did = datasetId.value
  if (!did || sharing.value) {
    return
  }
  sharing.value = true
  try {
    const next = dataset.value?.visibility === "shared" ? "private" : "shared"
    const res = await setDatasetShare(did, { visibility: next })
    if (!res.success) {
      $message(res.message || "设置失败")
      return
    }
    dataset.value = dataset.value ? { ...dataset.value, visibility: next as any } : dataset.value
    $message("设置成功", "success")
  } finally {
    sharing.value = false
  }
}

function openFork() {
  const did = datasetId.value
  if (!did) {
    return
  }
  if (!forkName.value) {
    forkName.value = `${dataset.value?.name || did}-派生`
  }
  forkOpen.value = true
}

async function confirmFork() {
  const did = datasetId.value
  if (!did || forking.value) {
    return
  }
  if (!forkName.value.trim()) {
    $message("请输入新数据集名称")
    return
  }
  forking.value = true
  try {
    const res = await forkDataset(did, { revisionId: selectedRevisionId.value || undefined, name: forkName.value.trim() })
    if (!res.success || !res.data?.datasetId) {
      $message(res.message || "派生失败")
      return
    }
    $message("派生成功", "success")
    forkOpen.value = false
  } finally {
    forking.value = false
  }
}

watch(
  () => datasetId.value,
  () => {
    reload()
  }
)

onMounted(reload)
</script>

<style lang="less" scoped>
.hint {
  font-size: 12px;
  color: var(--mars-text-color-placeholder);
  padding: 6px 0;
}

.meta {
  font-size: 12px;
  color: var(--mars-text-color);
  opacity: 0.9;
}

.rev-row {
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.rev-main {
  min-width: 0;
}

.rev-title {
  font-size: 12px;
  font-weight: 650;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.rev-desc {
  font-size: 12px;
  color: var(--mars-text-color-placeholder);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
