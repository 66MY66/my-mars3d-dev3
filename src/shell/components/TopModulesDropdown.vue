<template>
  <nav class="modules-nav" aria-label="卫星遥感软件模块">
    <button
      v-for="module in modules"
      :key="module.id"
      class="module-button"
      type="button"
      @click="onModuleClick(module)"
    >
      {{ module.label }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { useWidget } from "@mars/common/store/widget"

type ModuleItem = {
  id: string
  label: string
}

const modules: ModuleItem[] = [
  { id: "preprocess", label: "预处理" },
  { id: "risk-monitoring", label: "风险监测" },
  { id: "anomaly-monitoring", label: "异常监测" },
  { id: "loss-assessment", label: "损失评估" },
  { id: "data-management", label: "数据管理" },
  { id: "visualization", label: "可视化" }
]

const ANOMALY_LAYER_NAME = "演化过程演示"
const LOSS_WIDGET = "loss-assessment-blank"

const { activate, disable, disableAll, isActivate } = useWidget()

function goToFreshMap() {
  disableAll(true)
}

function reloadInitial3DView() {
  const url = new URL(window.location.href)
  const mode = String(process.env.ROUTER_MODE || "hash")
  if (mode === "history") {
    const base = String(process.env.BASE_URL || "/")
    url.pathname = base.endsWith("/") ? base : `${base}/`
    url.hash = ""
  } else {
    url.hash = "#/"
  }
  window.history.replaceState(null, "", url.toString())
  window.location.reload()
}

function onModuleClick(module: ModuleItem) {
  if (module.id === "visualization") {
    reloadInitial3DView()
    return
  }
  if (module.id === "loss-assessment") {
    if (isActivate(LOSS_WIDGET)) {
      disable(LOSS_WIDGET)
      return
    }
    goToFreshMap()
    activate(LOSS_WIDGET)
    return
  }
  if (module.id !== "anomaly-monitoring") {
    return
  }
  disableAll()
  activate({
    name: "manage-layers",
    data: {
      focusName: ANOMALY_LAYER_NAME,
      ensureVisible: true
    }
  })
}
</script>

<style scoped>
.modules-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.module-button {
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--syc-menu-text-secondary, var(--text-secondary));
  cursor: pointer;
  font-size: 12px;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.module-button:hover {
  color: var(--syc-menu-text, var(--text-primary));
  background: rgba(255 255 255 / 0.08);
}
</style>
