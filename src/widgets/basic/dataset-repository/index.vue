<template>
  <mars-dialog
    title="数据集仓库"
    :custom-class="layerVersionOverlayActive ? 'ksh002-drawer ksh002-drawer--overlay-inactive' : 'ksh002-drawer'"
    :draggable="false"
    width="32%"
    top="0"
    bottom="0"
    right="0"
    v-model:visible="dialogVisible"
    :defaultFold="drawerFolded"
    :thumbnail="thumbnail"
    @fold="onFold"
  >
    <template #headerRight>
      <button
        v-if="viewMode === 'list'"
        type="button"
          class="mars-popup-header-btn dataset-repo-header-btn"
        :class="{ active: layoutCompactActive }"
        title="排列方式"
        aria-label="排列方式"
        @click.stop="toggleLayout"
      >
        <mars-icon :icon="layoutCompactActive ? 'grid-nine' : 'view-list'" :width="16" />
      </button>
      <button
        type="button"
          class="mars-popup-header-btn dataset-repo-header-btn"
        title="重新加载"
        aria-label="重新加载"
        @click.stop="handleReload"
      >
        <mars-icon icon="refresh" :width="16" />
      </button>
    </template>

    <div :class="['dataset-repo-panel', { 'dataset-repo-panel--inactive': layerVersionOverlayActive }]">
      <DatasetEntry
        v-if="viewMode === 'list'"
        ref="entryRef"
        @select="handleSelect"
        @create="openCreate"
        @layout-change="handleLayoutChange"
      />

      <DatasetDetail
        v-else
        :collection-id="selectedCollectionId"
        @back="backToList"
        @layerVersionOpenChange="handleLayerVersionOpenChange"
        @navigate="handleNavigate"
        @openInMap="noop"
      />
    </div>
  </mars-dialog>

  <SaveManifestDialog v-model:open="showSaveDialog" @saved="handleSaved" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import { $message } from "@mars/components/mars-ui/index"
import { useWidget } from "@mars/common/store/widget"
import { setCurrentDataset } from "@/shell/currentDataset"
import { emitDatasetSync } from "./services/dataset-sync"
import * as mapWork from "./map"
import DatasetEntry from "./components/DatasetEntry.vue"
import DatasetDetail from "./components/DatasetDetail.vue"
import SaveManifestDialog from "./components/SaveManifestDialog.vue"

useLifecycle(mapWork)

const props = defineProps<{
  visible?: boolean
  restoreCollectionId?: string
}>()

const emit = defineEmits<{
  "update:visible": [value: boolean]
}>()

const { currentWidget } = useWidget()

const dialogVisible = computed({
  get: () => props.visible ?? false,
  set: (v) => emit("update:visible", v)
})

const foldStorageKey = "ksh002_drawer_folded_dataset-repository"
const drawerFolded = ref(localStorage.getItem(foldStorageKey) === "1")
const thumbnail = {
  right: 0,
  top: 12,
  width: 30,
  height: 30
}

function onFold(folded: boolean) {
  drawerFolded.value = folded
  localStorage.setItem(foldStorageKey, folded ? "1" : "0")
}

const viewMode = ref<"list" | "detail">("list")
const selectedCollectionId = ref("")
const layerVersionOverlayActive = ref(false)

function restoreDetailIfNeeded() {
  const fromProp = String(props.restoreCollectionId || "").trim()
  const fromWidget = String((currentWidget as any)?.data?.props?.restoreCollectionId || "").trim()
  const targetId = fromProp || fromWidget
  if (!targetId) {
    return
  }
  selectedCollectionId.value = targetId
  viewMode.value = "detail"
  // 一次性恢复，避免下次打开仍被强制进详情
  try {
    const data = (currentWidget as any)?.data
    if (data?.props?.restoreCollectionId) {
      delete data.props.restoreCollectionId
    }
  } catch {
  }
}

watch(
  () => dialogVisible.value,
  (visible) => {
    if (!visible) {
      return
    }
    restoreDetailIfNeeded()
  },
  { immediate: true }
)

watch(
  () => [props.restoreCollectionId, (currentWidget as any)?.data?.props?.restoreCollectionId],
  () => {
    if (dialogVisible.value) {
      restoreDetailIfNeeded()
    }
  }
)

const showSaveDialog = ref(false)
const entryRef = ref<InstanceType<typeof DatasetEntry> | null>(null)
const layoutCompactActive = ref(false)

function handleReload() {
  emitDatasetSync({ reason: "refresh", source: "dataset-repository:reload" })
  entryRef.value?.reload?.()
}

function toggleLayout() {
  entryRef.value?.toggleLayout?.()
}

function handleLayoutChange(compact: boolean) {
  layoutCompactActive.value = compact
}

function handleSelect(collection: any) {
  selectedCollectionId.value = String(collection?.id || "")
  if (!selectedCollectionId.value) {
    $message("数据集 ID 无效")
    return
  }
  viewMode.value = "detail"
}

function backToList() {
  layerVersionOverlayActive.value = false
  viewMode.value = "list"
}

function handleNavigate(datasetId: string) {
  const targetId = String(datasetId || "").trim()
  if (!targetId) {
    return
  }
  selectedCollectionId.value = targetId
  viewMode.value = "detail"
}

function handleLayerVersionOpenChange(open: boolean) {
  layerVersionOverlayActive.value = open
}

function openCreate() {
  showSaveDialog.value = true
}

function handleSaved(data: { datasetId: string; revisionId: string }) {
  setCurrentDataset({ datasetId: data.datasetId, name: data.datasetId, source: "save" })
  $message("已保存，可在“我的仓库”查看")
  showSaveDialog.value = false
}

function noop() {
}
</script>

<style scoped>
.dataset-repo-panel {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dataset-repo-panel--inactive {
  pointer-events: none;
}

.dataset-repo-panel--inactive :deep(.ksh002-layer-version-drawer) {
  pointer-events: auto;
}

:deep(.mars-dialog__content) {
  overflow: hidden !important;
}
</style>

<style>
.ksh002-drawer--overlay-inactive {
  pointer-events: none;
}

.ksh002-drawer--overlay-inactive .ksh002-layer-version-drawer {
  pointer-events: auto;
}
</style>
