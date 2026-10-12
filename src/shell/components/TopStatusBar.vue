<template>
  <div class="status" :aria-label="a11y.ariaLabel('status')">
    <span class="module" :title="moduleLabel">当前模块：{{ moduleLabel }}</span>
    <span class="divider" :aria-hidden="a11y.ariaHidden()"></span>
    <span class="sync" :class="`sync--${syncStatus}`" :title="syncMessage">{{ syncLabel }}</span>
    <span class="divider" :aria-hidden="a11y.ariaHidden()"></span>
    <div class="a11y-control" :title="a11yHint">
      <span class="a11y-label">{{ a11yLabel }}</span>
      <a-switch
        class="a11y-switch"
        size="small"
        :checked="a11y.enabled.value"
        @change="handleA11yChange"
      />
    </div>
    <span class="divider" :aria-hidden="a11y.ariaHidden()"></span>
    <span class="time">{{ timeText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import { onDatasetSyncStatus, type DatasetSyncConnectionStatus } from "@/widgets/basic/dataset-repository/services/dataset-sync"
import { useA11yService } from "@/utils/a11y/service"

const moduleStorageKey = "current_module_label"

const moduleLabel = ref<string>(localStorage.getItem(moduleStorageKey) || "卫星遥感软件")
const now = ref<Date>(new Date())
const syncStatus = ref<DatasetSyncConnectionStatus>("idle")
const syncMessage = ref("")
const a11y = useA11yService()

const timeText = computed(() => {
  const d = now.value
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
})

const syncLabel = computed(() => {
  const labels: Record<DatasetSyncConnectionStatus, string> = {
    idle: "同步未启用",
    connecting: "同步连接中",
    connected: "同步已连接",
    reconnecting: "同步重连中",
    offline: "网络已断开",
    error: "同步异常"
  }
  return labels[syncStatus.value] || "同步未启用"
})

const a11yLabel = computed(() => {
  if (!a11y.enabled.value) {
    return "无障碍关闭"
  }
  if (a11y.degraded.value) {
    return "无障碍降级"
  }
  return "无障碍开启"
})

const a11yHint = computed(() => {
  if (!a11y.enabled.value) {
    return "已手动关闭无障碍语义增强"
  }
  if (a11y.degraded.value) {
    return a11y.reason.value || "当前环境能力不足，已自动切换为轻量模式"
  }
  return "已开启无障碍语义增强"
})

let timer = 0
let disposeSyncStatus: null | (() => void) = null

function onModuleChange(e: Event) {
  const detail = (e as CustomEvent).detail as any
  const label = String(detail?.label || "").trim()
  if (!label) {
    return
  }
  moduleLabel.value = label
  localStorage.setItem(moduleStorageKey, label)
}

function handleA11yChange(checked: boolean) {
  a11y.setA11yEnabled(!!checked)
}

onMounted(() => {
  a11y.refreshA11ySupport()
  window.addEventListener("moduleChange", onModuleChange as EventListener)
  disposeSyncStatus = onDatasetSyncStatus((detail) => {
    syncStatus.value = detail.status
    syncMessage.value = detail.message || ""
  })
  timer = window.setInterval(() => {
    now.value = new Date()
  }, 1000 * 20)
})

onUnmounted(() => {
  window.removeEventListener("moduleChange", onModuleChange as EventListener)
  disposeSyncStatus?.()
  disposeSyncStatus = null
  if (timer) {
    window.clearInterval(timer)
    timer = 0
  }
})
</script>

<style scoped>
.status {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid var(--overlay-border);
  background: var(--bg-overlay);
  color: #B8C2D1;
  font-size: 12px;
  max-width: 420px;
  backdrop-filter: blur(var(--overlay-blur));
}

.module {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.divider {
  width: 1px;
  height: 14px;
  background: var(--overlay-border);
}

.time {
  color: #B8C2D1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.a11y-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.a11y-label {
  color: var(--text-secondary);
}

.a11y-switch.ant-switch {
  min-width: 40px !important;
  width: 40px !important;
  height: 22px !important;
  line-height: 20px !important;
  padding: 0 !important;
  border: 1.5px solid rgba(184, 194, 209, 0.55) !important;
  border-radius: 999px !important;
  background: transparent !important;
  box-sizing: border-box !important;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.a11y-switch.ant-switch:hover {
  border-color: rgba(45, 140, 240, 0.65) !important;
}

.a11y-switch.ant-switch :deep(.ant-switch-handle) {
  width: 16px !important;
  height: 16px !important;
  top: 1.5px !important;
  inset-inline-start: 2px !important;
}

.a11y-switch.ant-switch :deep(.ant-switch-handle)::before {
  border-radius: 50% !important;
  background: #b8c2d1 !important;
  box-shadow: none !important;
}

.a11y-switch.ant-switch-checked {
  background: rgba(45, 140, 240, 0.16) !important;
  border-color: #2d8cf0 !important;
}

.a11y-switch.ant-switch-checked :deep(.ant-switch-handle) {
  inset-inline-start: calc(100% - 19px) !important;
}

.a11y-switch.ant-switch-checked :deep(.ant-switch-handle)::before {
  background: #2d8cf0 !important;
}

.a11y-switch.ant-switch :deep(.ant-switch-inner) {
  display: none !important;
}

.sync {
  white-space: nowrap;
}

.sync--connected {
  color: #52c41a;
}

.sync--reconnecting,
.sync--connecting {
  color: #faad14;
}

.sync--offline,
.sync--error {
  color: #ff7875;
}
</style>
