<template>
  <Transition name="slide-down">
    <div v-if="visible" class="import-toast">
      <div class="toast-header">
        <div class="toast-texts">
          <div class="toast-title">导入成功</div>
          <div class="toast-sub" :title="datasetName">
            <span class="toast-name">{{ datasetName }}</span>
            <span v-if="layerCount" class="toast-layer-info">· {{ layerCount }} 图层</span>
            <span v-if="groupCount" class="toast-layer-info">· {{ groupCount }} 分组</span>
          </div>
        </div>
        <a-button type="text" size="small" class="close-btn" @click="handleClose">
          ×
        </a-button>
      </div>
      <div class="toast-actions">
        <a-button size="small" class="toast-action-btn" @click="handleLocate">
          定位到范围
        </a-button>
        <a-button size="small" class="toast-action-btn" @click="handleOpenLayerManager">
          打开图层管理
        </a-button>
        <a-button size="small" danger class="toast-action-btn toast-action-btn--danger" @click="handleUndo">
          撤销导入
        </a-button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from "vue"
import { useWidget } from "@mars/common/store/widget"
import * as mapWork from "../map"

const props = defineProps<{
  visible: boolean
  datasetName: string
  groupId?: string
  bbox?: [number, number, number, number]
  snapshotManifest?: any
  layerCount?: number
  groupCount?: number
  autoClose?: boolean
  autoCloseDelay?: number
}>()

const emit = defineEmits<{
  "update:visible": [value: boolean]
  undo: []
  close: []
}>()

const { activate } = useWidget()

// 自动关闭计时器
let autoCloseTimer: number | null = null
const DEFAULT_AUTO_CLOSE_DELAY = 15000

function handleLocate() {
  if (props.bbox && props.bbox.length >= 4) {
    mapWork.flyToBbox(props.bbox)
  }
}

function handleOpenLayerManager() {
  const focusPid = props.groupId
  if (focusPid) {
    activate({
      name: "manage-layers",
      data: { focusPid }
    })
    return
  }
  activate("manage-layers")
}

function handleUndo() {
  emit("undo")
}

function handleClose() {
  emit("close")
  emit("update:visible", false)
}

// 启动自动关闭计时器
function startAutoCloseTimer() {
  if (props.autoClose === false) {
    return
  }
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
  }
  const delay = Number.isFinite(Number(props.autoCloseDelay)) ? Number(props.autoCloseDelay) : DEFAULT_AUTO_CLOSE_DELAY
  if (delay <= 0) {
    return
  }
  autoCloseTimer = window.setTimeout(() => {
    emit("update:visible", false)
    emit("close")
  }, delay)
}

// 清除计时器
function clearAutoCloseTimer() {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
    autoCloseTimer = null
  }
}

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      startAutoCloseTimer()
    } else {
      clearAutoCloseTimer()
    }
  }
)

onUnmounted(() => {
  clearAutoCloseTimer()
})
</script>

<style scoped lang="less">
.import-toast {
  position: relative;
  z-index: 9999;
  display: grid;
  gap: 10px;
  padding: 12px;
  margin-bottom: 16px;
  background: var(--popup-surface);
  border-radius: var(--popup-radius);
  box-shadow: var(--popup-shadow);
  border: 1px solid var(--popup-border);
  width: 100%;
  box-sizing: border-box;
}

.toast-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.toast-texts {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 2px;
  text-align: left;
}

.toast-title {
  color: var(--mars-text-color);
  font-size: 14px;
  font-weight: 600;
  line-height: 18px;
  text-align: left;
}

.toast-sub {
  color: var(--mars-extra-text-color);
  font-size: 12px;
  line-height: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  justify-content: flex-start;
  text-align: left;
}

.toast-name {
  max-width: 320px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-layer-info {
  color: var(--mars-extra-text-color);
}

.toast-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.toast-actions :deep(.toast-action-btn) {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  font-size: 13px;
  border-radius: 10px;
  border: 1px solid var(--popup-border, rgba(23, 35, 61, 0.14));
  background: color-mix(in srgb, var(--popup-surface, #fff) 88%, transparent);
  color: var(--mars-text-color, var(--text-primary));
  box-shadow: none;

  &:hover {
    border-color: var(--color-primary, #2d8cf0);
    color: var(--color-primary, #2d8cf0);
    background: color-mix(in srgb, var(--color-primary, #2d8cf0) 8%, transparent);
  }
}

.toast-actions :deep(.toast-action-btn--danger) {
  color: rgba(231, 76, 60, 0.95);
  border-color: rgba(231, 76, 60, 0.28);

  &:hover {
    color: #e74c3c;
    border-color: rgba(231, 76, 60, 0.5);
    background: rgba(231, 76, 60, 0.08);
  }
}

.close-btn {
  color: var(--mars-extra-text-color);
  padding: 0 6px;
  height: 22px;
  line-height: 22px;
  min-width: 22px;
  border-radius: 6px;
  flex-shrink: 0;

  &:hover {
    color: var(--mars-text-color);
  }
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
