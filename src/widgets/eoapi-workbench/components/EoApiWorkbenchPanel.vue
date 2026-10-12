<template>
  <div class="eoapi-workbench">
    <div class="header">
      <div class="title">eoAPI 工作台</div>
      <EoApiToolbar>
        <template #left>
          <a-button size="small" @click="onSyncView">同步视图</a-button>
          <a-button size="small" @click="onPickCoord">选取坐标</a-button>
          <a-switch v-model:checked="autoSync" size="small" />
          <span class="sync-text">自动同步</span>
        </template>
        <template #right>
          <a-button size="small" @click="openSave">保存成果</a-button>
          <EoApiStatusBadge />
        </template>
      </EoApiToolbar>
    </div>

    <a-tabs v-model:activeKey="activeTab" size="small">
      <a-tab-pane key="datasets" tab="数据集">
        <div class="split">
          <DatasetEntry @select="onSelectDataset" />
          <DatasetDetail :datasetId="currentDatasetId" />
        </div>
      </a-tab-pane>
      <a-tab-pane key="thematics" tab="专题">
        <ThematicJobs :dataset-id="currentDatasetId" />
      </a-tab-pane>
    </a-tabs>

    <mars-task-modal v-model:open="saveOpen" title="保存成果" :okLoading="saving" @ok="onSave">
      <a-form layout="vertical">
        <a-form-item label="保存目标" required>
          <a-radio-group v-model:value="saveTarget">
            <a-radio value="newDataset">新建数据集</a-radio>
            <a-radio value="newRevision" :disabled="!currentDatasetId">保存为新版本</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item v-if="saveTarget === 'newDataset'" label="数据集名称" required>
          <a-input v-model:value="datasetName" />
        </a-form-item>

        <a-form-item label="可见性" required>
          <a-radio-group v-model:value="visibility">
            <a-radio value="private">私有</a-radio>
            <a-radio value="shared">共享</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item label="版本说明">
          <a-input v-model:value="message" />
        </a-form-item>

        <a-form-item label="标签（逗号分隔）">
          <a-input v-model:value="tagsText" />
        </a-form-item>

        <a-space :size="10">
          <a-checkbox v-model:checked="includeView">包含视角</a-checkbox>
          <a-checkbox v-model:checked="includeLayers">包含图层</a-checkbox>
          <a-checkbox v-model:checked="includeDraw">包含标绘</a-checkbox>
        </a-space>
      </a-form>
    </mars-task-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { $message } from "@mars/components/mars-ui/index"
import DatasetEntry from "./DatasetEntry.vue"
import DatasetDetail from "./DatasetDetail.vue"
import ThematicJobs from "./ThematicJobs.vue"
import EoApiStatusBadge from "./EoApiStatusBadge.vue"
import EoApiToolbar from "./EoApiToolbar.vue"
import "../styles/eoapi-panel.less"
import eoApiConfig from "../services/eoapi-config"
import * as mapWork from "../map"
import { createDataset, createRevision } from "../services/eoapi-datasets"
import { serializeWorkspace } from "../workspace/serialize"

const activeTab = ref<"datasets" | "thematics">("datasets")
const currentDatasetId = ref<string>("")

function onSelectDataset(id: string) {
  currentDatasetId.value = id
}

const autoSync = ref<boolean>(eoApiConfig.autoSync)

const saveOpen = ref(false)
const saving = ref(false)
const saveTarget = ref<"newDataset" | "newRevision">("newDataset")
const datasetName = ref("")
const message = ref("")
const visibility = ref<"private" | "shared">("private")
const tagsText = ref("")
const includeView = ref(true)
const includeLayers = ref(true)
const includeDraw = ref(true)

const tags = computed(() =>
  tagsText.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
)

function openSave() {
  if (currentDatasetId.value) {
    saveTarget.value = "newRevision"
  } else {
    saveTarget.value = "newDataset"
  }
  if (!datasetName.value) {
    datasetName.value = `成果-${new Date().toLocaleString()}`
  }
  saveOpen.value = true
}

async function onSave() {
  if (saving.value) {
    return
  }
  if (saveTarget.value === "newDataset" && !datasetName.value.trim()) {
    $message("请输入数据集名称")
    return
  }

  const map = mapWork.getMap()
  if (!map) {
    $message("地图未就绪")
    return
  }

  saving.value = true

  try {
    const manifest = serializeWorkspace(map, {
      includeView: includeView.value,
      includeLayers: includeLayers.value,
      includeDraw: includeDraw.value
    })

    if (saveTarget.value === "newDataset") {
      const ds = await createDataset({
        name: datasetName.value.trim(),
        visibility: visibility.value,
        tags: tags.value
      })
      if (!ds.success || !ds.data?.datasetId) {
        $message(ds.message || "新建数据集失败")
        saving.value = false
        return
      }
      const did = ds.data.datasetId
      const rev = await createRevision(did, { message: message.value.trim() || undefined, manifest })
      if (!rev.success) {
        $message(rev.message || "保存版本失败")
        saving.value = false
        return
      }
      currentDatasetId.value = did
      activeTab.value = "datasets"
      $message("保存成功", "success")
      saveOpen.value = false
      saving.value = false
      return
    }

    const did = currentDatasetId.value
    if (!did) {
      $message("请先选择数据集")
      saving.value = false
      return
    }
    const rev = await createRevision(did, { message: message.value.trim() || undefined, manifest })
    if (!rev.success) {
      $message(rev.message || "保存失败")
      saving.value = false
      return
    }
    $message("保存成功", "success")
    saveOpen.value = false
  } finally {
    saving.value = false
  }
}

function onSyncView() {
  mapWork.syncViewOnce()
}

function onPickCoord() {
  mapWork.pickCoordinateOnce()
}

onMounted(() => {
  mapWork.eventTarget.on("openDataset", (e: any) => {
    const did = String(e?.datasetId || "")
    if (!did) {
      return
    }
    currentDatasetId.value = did
    activeTab.value = "datasets"
  })

  mapWork.eventTarget.on("pickedCoord", (e: any) => {
    const p = e?.point
    if (p && typeof p.lng === "number" && typeof p.lat === "number") {
      $message(`坐标：${p.lng.toFixed(6)}, ${p.lat.toFixed(6)}`, "success")
    }
  })

  mapWork.eventTarget.on("viewChange", () => {
    if (!autoSync.value) {
      return
    }
    mapWork.syncViewOnce()
  })
})
</script>

<style lang="less" scoped>
.title {
  font-size: 14px;
  font-weight: 650;
  color: var(--mars-text-color);
}

.sync-text {
  font-size: 12px;
  color: var(--mars-extra-text-color);
}
</style>
