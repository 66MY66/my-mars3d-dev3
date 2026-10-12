<template>
  <div class="top-actions" aria-label="top-actions">
    <button
      v-for="a in visible"
      :key="a.id"
      class="action"
      :class="{ active: isActivate(a.widget) }"
      type="button"
      @click="onClick(a)"
    >
      <span class="icon" v-html="getIconSvg(a.icon)"></span>
      <span class="text">{{ a.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useWidget } from "@mars/common/store/widget"
import { hasPermission } from "@/shell/permission"
import { icons } from "@/shell/icons"
import type { IconName } from "@/shell/icons"

type ActionItem = {
  id: string
  label: string
  icon: IconName
  permission?: string
  widget: string
}

const actions: ActionItem[] = [
  { id: "alert-confirm", label: "告警确认", icon: "Alarm", permission: "alert:read", widget: "alert-confirm" }
]

const { activate, disable, isActivate } = useWidget()

const visible = computed(() => {
  return actions.filter((a) => hasPermission(a.permission))
})

function getIconSvg(name: IconName) {
  const Icon = (icons as any)[name]
  if (!Icon) {
    return ""
  }
  return Icon({ theme: "outline", size: 16 }) as unknown as string
}

function onClick(a: ActionItem) {
  if (isActivate(a.widget)) {
    disable(a.widget)
    return
  }
  activate(a.widget)
}
</script>

<style scoped>
.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action {
  height: 28px;
  padding: 0 10px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.action:hover {
  color: var(--text-primary);
  background: rgba(45 140 240 / 0.08);
}

.action.active {
  color: var(--primary);
  background: rgba(45 140 240 / 0.12);
}

.icon :deep(svg) {
  display: block;
}
</style>
