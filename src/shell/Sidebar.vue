<template>
  <aside class="sidebar" :class="{ collapsed }" ref="rootRef">
    <div class="sidebar-inner">
      <div class="side-menu">
        <template v-for="(g, gi) in grouped" :key="g.name">
          <button
            v-if="!collapsed"
            type="button"
            class="group-title"
            :class="{ 'has-active': g.items.some(isItemActive), 'is-collapsed': isGroupCollapsed(g.name) }"
            :aria-expanded="!isGroupCollapsed(g.name)"
            @click="toggleGroup(g.name)"
          >
            <span class="group-title-arrow" v-html="downArrowSvg" aria-hidden="true"></span>
            <span class="group-title-text">{{ g.name }}</span>
          </button>
          <div v-show="collapsed || !isGroupCollapsed(g.name)" class="group-items">
            <template v-for="item in g.items" :key="item.id">
              <div v-if="item.kind === 'divider' && !collapsed" class="menu-divider" :aria-hidden="a11y.ariaHidden()"></div>
              <a-tooltip
                v-else-if="item.kind === 'placeholder' && !collapsed"
                title="请先从「数据集仓库」导入并加载数据集，加载成功后此处会出现「当前任务」菜单"
                :mouseEnterDelay="0.4"
                placement="right"
              >
                <div class="menu-placeholder" :aria-hidden="a11y.ariaHidden()"></div>
              </a-tooltip>
              <!-- divider / placeholder：收起态不渲染，避免预留空图标方框 -->
              <a-tooltip
                v-else-if="!item.kind"
                :title="collapsed ? item.label : null"
                :mouseEnterDelay="0.5"
                :autoAdjustOverflow="true"
                placement="right"
              >
                <button
                  class="menu-item"
                  :class="{ active: isItemActive(item) }"
                  type="button"
                  @click="onClick(item)"
                  @keydown="onKeydown"
                  :aria-label="a11y.ariaLabel(item.label)"
                >
                  <span class="menu-icon" :class="{ 'is-placeholder': !hasMenuIcon(item.icon) }">
                    <span v-if="hasMenuIcon(item.icon)" v-html="getIconSvg(item.icon)" aria-hidden="true"></span>
                  </span>
                  <span v-if="!collapsed" class="menu-text">{{ item.label }}</span>
                </button>
              </a-tooltip>
            </template>
          </div>
          <div v-if="gi !== grouped.length - 1" class="group-divider" :aria-hidden="a11y.ariaHidden()"></div>
        </template>
      </div>
    </div>
    <!-- 底部收起/展开按钮 -->
    <div
      class="sidebar-footer"
      @click="$emit('toggle')"
      :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
      role="button"
      :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
      tabindex="0"
      @keydown.enter="$emit('toggle')"
    >
      <span class="toggle-icon" v-html="collapsed ? expandSvg : collapseSvg"></span>
      <span v-if="!collapsed" class="toggle-text">收起菜单</span>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import { Down } from "@icon-park/svg"
import { useWidget } from "@mars/common/store/widget"
import { icons } from "@/shell/icons"
import toolbarConfig from "@/config/toolbar.json"
import { hasPermission } from "@/shell/permission"
import type { ToolbarItemConfig } from "@/shell/toolbar"
import type { IconName } from "@/shell/icons"
import { getCurrentDataset, onCurrentDatasetChange, type CurrentDataset } from "@/shell/currentDataset"
import { useA11yService } from "@/utils/a11y/service"

type MenuItem = {
  id: string
  label: string
  icon?: IconName
  group?: string
  permission?: string
  action?: any
  kind?: "divider" | "placeholder"
}

const props = defineProps<{
  collapsed: boolean
}>()

defineEmits(["toggle"])

const { activate, disable, isActivate } = useWidget()
const a11y = useA11yService()

const activeKeyStorage = "sidebar_active_tool"
const activeId = ref<string>(localStorage.getItem(activeKeyStorage) || "")
const rootRef = ref<HTMLElement | null>(null)
const collapsedGroups = ref<Record<string, boolean>>({})

function isGroupCollapsed(name: string): boolean {
  return !!collapsedGroups.value[name]
}

function toggleGroup(name: string) {
  collapsedGroups.value = {
    ...collapsedGroups.value,
    [name]: !collapsedGroups.value[name]
  }
}

const downArrowSvg = computed(() => Down({ theme: "outline", size: 14 }) as unknown as string)


const items = (toolbarConfig as ToolbarItemConfig[]).map((i) => {
  return {
    ...i,
    icon: i.icon as IconName
  }
})

const visibleItems = computed(() => {
  return items.filter((i) => hasPermission(i.permission))
})

const currentDataset = ref<CurrentDataset | null>(getCurrentDataset())

const groupOrder = ["常用", "专题制图", "数据服务", "工具", "成果管理", "风险监测", "灾害评估", "主要", "次要", "帮助"]
const grouped = computed(() => {
  const idMap = new Map<string, MenuItem>()
  items.forEach((i: any) => idMap.set(i.id, i))

  const hasDataset = !!currentDataset.value?.datasetId
  const currentDatasetLabel = "当前任务"

  const achievement: MenuItem[] = [
    idMap.get("dataset-repository") || {
      id: "dataset-repository",
      label: "数据集仓库",
      icon: "Box",
      group: "成果管理",
      action: { type: "widget.toggle", widget: "dataset-repository" }
    },
    idMap.get("my-repository") || {
      id: "my-repository",
      label: "我的仓库",
      icon: "PreviewOpen",
      group: "成果管理",
      action: { type: "widget.toggle", widget: "my-repository" }
    },
    ...(hasDataset
      ? ([
          { id: "divider-1", label: "", kind: "divider" },
          {
            id: "current-task",
            label: currentDatasetLabel,
            icon: "DataSwitching",
            group: "成果管理",
            action: { type: "widget.toggle", widget: "current-task" }
          },
          { id: "divider-2", label: "", kind: "divider" }
        ] as MenuItem[])
      : ([{ id: "current-task-placeholder", label: "", kind: "placeholder" }] as MenuItem[])),
    idMap.get("save-result") || {
      id: "save-result",
      label: "保存成果",
      icon: "Save",
      group: "成果管理",
      action: { type: "widget.toggle", widget: "save-result" }
    },
    idMap.get("result-playback") || {
      id: "result-playback",
      label: "成果回放",
      icon: "History",
      group: "成果管理",
      action: { type: "widget.toggle", widget: "result-playback" }
    }
  ]

  const map = new Map<string, MenuItem[]>()
  map.set("成果管理", achievement)

  visibleItems.value.forEach((i) => {
    const name = i.group || "常用"
    if (name === "成果管理") {
      return
    }
    const list = map.get(name) || []
    list.push(i)
    map.set(name, list)
  })
  return groupOrder
    .filter((name) => (map.get(name) || []).length > 0)
    .map((name) => ({ name, items: map.get(name) || [] }))
})

function getIconSvg(name?: IconName) {
  if (!name) {
    return ""
  }
  const Icon = (icons as any)[name]
  if (!Icon) {
    return ""
  }
  return Icon({ theme: "outline", size: 16 }) as unknown as string
}

function hasMenuIcon(name?: IconName) {
  if (!name) {
    return false
  }
  return !!(icons as any)[name]
}

function isItemActive(item: any) {
  if (item?.kind) {
    return false
  }
  const widget = item?.action?.widget
  if (widget) {
    return isActivate(widget)
  }
  return activeId.value === item.id
}

function onClick(item: any) {
  if (item?.kind) {
    return
  }
  activeId.value = item.id
  localStorage.setItem(activeKeyStorage, item.id)

  const action = item.action
  if (action?.widget === "thematic-workbench") {
    activate({
      name: "thematic-workbench",
      data: {
        props: {
          datasetId: String(currentDataset.value?.datasetId || ""),
          datasetName: String(currentDataset.value?.name || currentDataset.value?.datasetId || ""),
          source: "sidebar",
          targetName: String(currentDataset.value?.name || currentDataset.value?.datasetId || "当前数据集"),
          initialTab: "template"
        }
      }
    })
    return
  }
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


function onKeydown(e: KeyboardEvent) {
  const key = e.key
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
    return
  }
  const root = rootRef.value
  if (!root) {
    return
  }
  const buttons = Array.from(root.querySelectorAll("button.menu-item")) as HTMLButtonElement[]
  if (!buttons.length) {
    return
  }
  const current = e.currentTarget as HTMLElement | null
  const curIndex = current ? buttons.findIndex((b) => b === current) : -1
  if (curIndex === -1) {
    return
  }
  e.preventDefault()
  e.stopPropagation()
  let nextIndex = curIndex
  if (key === "Home") {
    nextIndex = 0
  } else if (key === "End") {
    nextIndex = buttons.length - 1
  } else if (key === "ArrowDown") {
    nextIndex = Math.min(buttons.length - 1, curIndex + 1)
  } else if (key === "ArrowUp") {
    nextIndex = Math.max(0, curIndex - 1)
  }
  buttons[nextIndex]?.focus?.()
}

let disposeDatasetWatch: null | (() => void) = null

onMounted(() => {
  disposeDatasetWatch = onCurrentDatasetChange((ds) => {
    currentDataset.value = ds
  })
})

onUnmounted(() => {
  disposeDatasetWatch?.()
  disposeDatasetWatch = null
})

const collapseSvg = computed(() => {
  const Icon = icons.Left
  return Icon({ theme: "outline", size: 14 }) as unknown as string
})

const expandSvg = computed(() => {
  const Icon = icons.Right
  return Icon({ theme: "outline", size: 14 }) as unknown as string
})
</script>

<style scoped>
.sidebar {
  position: absolute;
  left: 0;
  top: 54px;
  bottom: 0;
  width: 240px;
  box-sizing: border-box;
  transition: width var(--transition-mid);
  background: var(--syc-menu-bg);
  border-right: 1px solid #e5e6eb;
  z-index: 20;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar-inner {
  flex: 1;
  min-height: 0;
  /* SYC 规范：内边距 8px 基础间距 */
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: space-between;
}

/* 底部收起/展开按钮 */
.sidebar-footer {
  flex-shrink: 0;
  box-sizing: border-box;
  width: 100%;
  height: 42px;
  padding: 13px 12px;
  border-top: none;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  cursor: pointer;
  color: var(--syc-menu-text-secondary);
  transition: color var(--transition-fast), background var(--transition-fast);
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
  background: transparent;
  outline: none;
}

.sidebar-footer:hover {
  color: var(--syc-menu-text);
  background: color-mix(in srgb, var(--syc-menu-active-bg) 60%, transparent);
}

.sidebar-footer:focus-visible {
  outline: 2px solid var(--syc-submenu-active);
  outline-offset: -2px;
}

.toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.toggle-icon :deep(svg) {
  display: block;
  width: 16px;
  height: 16px;
}

.toggle-text {
  color: #4e5969;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  white-space: nowrap;
}

.sidebar.collapsed .sidebar-footer {
  padding: 13px 12px;
  justify-content: center;
}

.side-menu {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 一级分组标题：左侧箭头 + Caption 字阶，点击展开/收起子菜单 */
.sidebar .group-title {
  width: 100%;
  height: 42px;
  min-height: 42px;
  margin: 0 0 2px;
  padding: 10px 12px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  color: var(--syc-menu-text-secondary);
  text-align: left;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.sidebar .group-title:hover {
  color: var(--syc-menu-text);
  background: color-mix(in srgb, var(--syc-menu-active-bg) 45%, transparent);
  border-radius: 3px;
}

.group-title-arrow {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-fast);
}

.group-title-arrow :deep(svg) {
  display: block;
}

.sidebar .group-title.is-collapsed .group-title-arrow {
  transform: rotate(-90deg);
}

.group-title-text {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  letter-spacing: 0.01em;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar .group-title.has-active .group-title-text {
  color: var(--syc-menu-text);
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 0;
  margin-bottom: 2px;
}

.menu-divider {
  height: 1px;
  background: transparent;
  border-bottom: 1px dashed var(--layout-border);
  margin: 4px 8px;
  pointer-events: none;
}

.menu-placeholder {
  height: 0;
  border-bottom: 1px dashed var(--layout-border);
  margin: 4px 8px;
  pointer-events: none;
}

/* SYC 规范：二级菜单项样式 */
.menu-item {
  width: 100%;
  height: var(--syc-menu-item-height);
  border-radius: 0;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--syc-menu-icon-gap);
  padding: 0 8px;
  cursor: pointer;
  position: relative;
  outline: none;
  color: var(--syc-menu-text-secondary);
  text-align: left;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.menu-item:focus {
  outline: none;
}

.menu-item:focus-visible {
  outline: 2px solid var(--syc-submenu-active);
  outline-offset: 2px;
}

.menu-item:hover {
  color: var(--syc-menu-text);
  background: color-mix(in srgb, var(--syc-menu-active-bg) 60%, transparent);
}

/* SYC 规范：选中状态 - 左侧 #5cadff 高亮条 */
.menu-item.active {
  color: var(--syc-submenu-active);
  background: var(--syc-menu-active-bg);
  position: relative;
}

.menu-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  /* SYC 规范：选中高亮色 #5cadff */
  background: var(--syc-submenu-active);
  border-radius: 2px;
}

.menu-icon {
  width: var(--syc-menu-icon-size);
  height: var(--syc-menu-icon-size);
  flex-shrink: 0;
  color: currentColor;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.menu-icon.is-placeholder {
  border: 1px solid color-mix(in srgb, var(--syc-menu-text) 28%, transparent);
  border-radius: 2px;
  background: color-mix(in srgb, var(--syc-menu-text) 8%, transparent);
}

.menu-icon :deep(svg) {
  display: block;
  width: var(--syc-menu-icon-size);
  height: var(--syc-menu-icon-size);
}

.menu-text {
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  color: inherit;
  text-align: left;
}

.group-divider {
  height: 1px;
  background: var(--layout-border);
  margin: 6px 8px;
  flex-shrink: 0;
}

/* 收起状态样式 */
.sidebar.collapsed .group-title {
  display: none;
}

.sidebar.collapsed .group-divider {
  display: block;
}

.sidebar.collapsed .menu-item {
  justify-content: center;
  padding: 0;
  height: 40px;
}

.sidebar.collapsed .menu-text {
  display: none;
}

.sidebar.collapsed .group-items {
  gap: 3px;
}

.sidebar.collapsed .menu-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.sidebar.collapsed .menu-item.active::before {
  left: 4px;
  top: 8px;
  bottom: 8px;
}

/* 滚动条样式 */
.side-menu::-webkit-scrollbar {
  width: 4px;
}

.side-menu::-webkit-scrollbar-track {
  background: transparent;
}

.side-menu::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--syc-menu-text) 15%, transparent);
  border-radius: 2px;
}

.side-menu::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--syc-menu-text) 25%, transparent);
}

@media (max-width: 900px) {
  .sidebar {
    width: var(--sidebar-collapsed-width);
    top: var(--layout-header-height);
  }

  .sidebar .group-title {
    display: none;
  }

  .sidebar .group-divider {
    display: block;
  }

  .sidebar .menu-item {
    justify-content: center;
    padding: 0;
    height: 40px;
  }

  .sidebar .menu-text {
    display: none;
  }
}
</style>
