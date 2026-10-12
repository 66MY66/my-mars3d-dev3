<template>
  <div class="toolbar">
    <template v-for="(g, gi) in grouped" :key="g.name">
      <div class="toolbar-group">
        <ToolIconButton v-for="item in g.items" :key="item.id" :title="item.label" :icon="item.icon" @click="onClick(item)" />
      </div>
      <div v-if="gi !== grouped.length - 1" class="divider" aria-hidden="true"></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useWidget } from "@mars/common/store/widget"
import ToolIconButton from "@/shell/components/ToolIconButton.vue"
import toolbarConfig from "@/config/toolbar.json"
import { hasPermission } from "@/shell/permission"
import type { ToolbarItemConfig } from "@/shell/toolbar"
import type { IconName } from "@/shell/icons"
import { icons } from "@/shell/icons"

const { activate, disable, isActivate } = useWidget()

const items = (toolbarConfig as ToolbarItemConfig[]).map((i) => {
  const iconName = i.icon as IconName
  return {
    ...i,
    icon: iconName,
    iconValid: Boolean(icons[iconName])
  }
})

const visibleItems = computed(() => {
  return items.filter((i) => i.iconValid && hasPermission(i.permission))
})

const groupOrder = ["常用", "专题制图", "数据服务", "工具", "成果管理", "风险监测", "灾害评估", "主要", "次要", "帮助"]

const grouped = computed(() => {
  const map = new Map<string, any[]>()
  visibleItems.value.forEach((i) => {
    const name = i.group || "常用"
    const list = map.get(name) || []
    list.push(i)
    map.set(name, list)
  })
  return groupOrder
    .filter((name) => (map.get(name) || []).length > 0)
    .map((name) => ({ name, items: map.get(name) || [] }))
})

function onClick(item: { action: ToolbarItemConfig["action"] }) {
  const action = item.action
  if (action.type === "widget.toggle") {
    if (isActivate(action.widget)) {
      disable(action.widget)
    } else {
      activate(action.widget)
    }
    return
  }
  if (action.type === "widget.open") {
    activate(action.widget)
    return
  }
  if (action.type === "widget.close") {
    disable(action.widget)
  }
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--border-light);
  opacity: 0.9;
  margin: 0 4px;
}
</style>
