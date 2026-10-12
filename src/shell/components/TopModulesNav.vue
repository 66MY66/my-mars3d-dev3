<template>
  <nav class="top-modules" aria-label="modules">
    <button
      v-for="m in modules"
      :key="m.id"
      class="tab"
      :class="{ active: activeId === m.id }"
      type="button"
      @click="onSelect(m)"
    >
      {{ m.label }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useWidget } from "@mars/common/store/widget"
import { $message } from "@mars/components/mars-ui/index"

type ModuleItem = {
  id: string
  label: string
  widget?: string
}

const storageKey = "top_module_active"

const modules: ModuleItem[] = [
  { id: "risk-area", label: "风险区域检测", widget: "mid-short-macro" },
  { id: "station-preprocess", label: "地面站数据预处理", widget: "disaster-loss-assessment" },
  { id: "macro-anomaly", label: "地震中短期宏观异常监测子系统" },
  { id: "rapid-risk", label: "地震灾害损失与影响快速风险评估子系统" },
  { id: "disaster-backup", label: "地震数据灾备与大数据管理子系统" }
]

const { activate } = useWidget()
const activeId = ref<string>(localStorage.getItem(storageKey) || modules[0].id)

function onSelect(m: ModuleItem) {
  activeId.value = m.id
  localStorage.setItem(storageKey, m.id)
  if (m.widget) {
    activate(m.widget)
    return
  }
  $message("该模块暂未接入", "warning")
}
</script>

<style scoped>
.top-modules {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: auto hidden;
  padding: 0 6px;
}

.tab {
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-10);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.tab:hover {
  background: color-mix(in srgb, var(--bg-elevated) 85%, var(--primary-hover));
  border-color: color-mix(in srgb, var(--primary) 35%, transparent);
  color: var(--text-primary);
}

.tab.active {
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  border-color: color-mix(in srgb, var(--primary) 45%, transparent);
  color: var(--primary);
}
</style>

