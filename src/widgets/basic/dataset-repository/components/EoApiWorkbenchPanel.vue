<template>
  <mars-dialog
    v-bind="$attrs"
    ref="dialogRef"
    v-model:visible="dialogVisible"
    title="数据集仓库"
    icon="global"
    custom-class="eoapi-workbench-panel ksh002-drawer"
    :draggable="false"
    width="32%"
    top="0"
    bottom="0"
    right="0"
    :defaultFold="drawerFolded"
    :thumbnail="thumbnail"
    @fold="onFold"
    @close="handleClose"
  >
    <template #headerRight>
      <button class="ksh002-drawer-toggle" type="button" @click="toggleFold">
        <mars-icon icon="right" :width="18" />
      </button>
    </template>
    <!-- 内容区 -->
    <div class="panel-body">
      <mars-state
        :loading="isLoading"
        loadingText="连接 eoAPI 服务..."
        :error="loadError"
        :errorTitle="loadErrorTitle"
        :errorMessage="loadErrorMessage"
        @retry="handleRetry"
      >
        <template #errorExtra>
          <a-button size="small" @click="handleOpenExternal">打开外部</a-button>
        </template>
        <div class="workbench-content">
          <iframe
            class="eoapi-browser-iframe"
            :src="browserUrl"
            frameborder="0"
            allowfullscreen
          />
        </div>
      </mars-state>
    </div>

    <!-- 状态栏 -->
    <template #footer>
      <div class="panel-footer">
        <EoApiStatusBadge :status="serviceStatus" :show-latency="true" />
        <span v-if="currentBounds" class="current-bounds">
          范围: {{ formatBounds(currentBounds) }}
        </span>
      </div>
    </template>
  </mars-dialog>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted } from "vue"
import { useWidget } from "@mars/common/store/widget"
import * as mapWork from "../map"
import { checkHealth } from "../services/eoapi-client"
import { EoApiServiceStatus } from "../types/eoapi-types"
import EoApiStatusBadge from "./EoApiStatusBadge.vue"

const { disable } = useWidget()

// 对话框显示状态（初始为 true，因为 widget 已被激活）
const dialogVisible = ref(true)
const dialogRef = ref<any>(null)

const eoApiBrowserUrl = import.meta.env.VITE_EOAPI_BROWSER_URL || "http://192.168.0.15:5954"
const browserUrl = computed(() => {
  const base = String(eoApiBrowserUrl || "").replace(/\/+$/, "")
  return base ? `${base}/` : ""
})

// ============ 状态变量 ============
const foldStorageKey = "ksh002_drawer_folded_dataset-repository"
const drawerFolded = ref(localStorage.getItem(foldStorageKey) === "1")
const thumbnail = {
  right: 0,
  top: 12,
  width: 30,
  height: 44,
  icon: "left-expand"
}

const isLoading = ref(true)
const loadError = ref(false)
const loadErrorTitle = ref("")
const loadErrorMessage = ref("")
const currentBounds = ref<[number, number, number, number] | null>(null)

// 服务状态
const serviceStatus = ref<EoApiServiceStatus>({
  available: false,
  latency: 0,
  lastCheck: 0
})

// ============ 初始化 ============

onMounted(async () => {
  await initWorkbench()
})

function toggleFold() {
  dialogRef.value?.toggle?.()
}

function onFold(v: boolean) {
  drawerFolded.value = v
  localStorage.setItem(foldStorageKey, v ? "1" : "0")
}

async function initWorkbench() {
  isLoading.value = true
  loadError.value = false

  try {
    // 检查服务健康状态
    serviceStatus.value = await checkHealth()

    // 即使服务不可用也显示界面，只是数据会使用模拟数据
    // 获取当前地图范围
    currentBounds.value = mapWork.getCurrentBounds()

  } catch (error: any) {
    console.warn("[eoAPI] 初始化警告:", error.message)
  } finally {
    isLoading.value = false
  }
}

// ============ 事件处理 ============

function handleClose() {
  disable("dataset-repository")
}

async function handleRetry() {
  await initWorkbench()
}

function handleOpenExternal() {
  // 打开独立页面（兜底方案）
  window.open(browserUrl.value, "_blank")
}

// ============ 辅助函数 ============

function formatBounds(bounds: [number, number, number, number]): string {
  if (!bounds) { return "" }
  const [minLon, minLat, maxLon, maxLat] = bounds
  return `${minLon.toFixed(2)}, ${minLat.toFixed(2)} - ${maxLon.toFixed(2)}, ${maxLat.toFixed(2)}`
}
</script>

<style scoped lang="less">
.eoapi-workbench-panel {
  .panel-body {
    display: flex;
    flex: 1;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .workbench-content {
    display: flex;
    flex: 1;
    min-height: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
  }

  .eoapi-browser-iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }

  .panel-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 4px 0;

    .current-bounds {
      color: var(--mars-extra-text-color);
      font-size: 12px;
    }
  }
}
</style>
