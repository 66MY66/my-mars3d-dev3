<template>
  <HeaderIconButton title="通知" icon="Alarm" :badge="unreadCount > 0 ? unreadCount : undefined" @click="openPanel" />

  <teleport to="body">
    <div v-if="visible" class="mask" @click.self="closePanel">
      <div class="panel" role="dialog" aria-modal="true" aria-label="通知">
        <div class="panel-header">
          <div class="title">通知</div>
          <div class="header-actions">
            <button class="mark" type="button" @click="markAllRead">全部已读</button>
            <button class="close" type="button" aria-label="关闭" @click="closePanel">×</button>
          </div>
        </div>

        <div class="filter-bar">
          <div class="filters">
            <button
              v-for="tab in filterTabs"
              :key="tab.key"
              class="filter-tab"
              :class="{ active: activeFilter === tab.key }"
              type="button"
              @click="activeFilter = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>
          <div class="sorts">
            <button
              class="sort-tab"
              :class="{ active: sortField === 'time' }"
              type="button"
              :title="sortTooltip('time')"
              @click="toggleSort('time')"
            >
              {{ sortTabLabel("time") }}
            </button>
            <button
              class="sort-tab"
              :class="{ active: sortField === 'severity' }"
              type="button"
              :title="sortTooltip('severity')"
              @click="toggleSort('severity')"
            >
              {{ sortTabLabel("severity") }}
            </button>
          </div>
        </div>

        <div class="list">
          <button v-for="n in displayedList" :key="n.id" class="item" type="button" @click="openItem(n.id)">
            <span class="dot" :style="{ background: n.severityColor }"></span>
            <span class="text">
              <span class="name">{{ n.title }}</span>
              <span class="meta">{{ n.timeLabel }}</span>
            </span>
          </button>
          <div v-if="displayedList.length === 0" class="empty">暂无通知</div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import { useWidget } from "@mars/common/store/widget"
import HeaderIconButton from "@/shell/components/HeaderIconButton.vue"
import {
  getSeverityColor,
  getSeverityRank,
  parseNotificationSeverity,
  useNotificationStore
} from "@/shell/notificationStore"

type FilterKey = "unread" | "read" | "all"
type SortField = "time" | "severity"
type SortOrder = "asc" | "desc"

const { activate } = useWidget()
const { listForView, unreadCount, markAllRead, markRead, getById } = useNotificationStore()

const visible = ref(false)
const activeFilter = ref<FilterKey>("unread")
const sortField = ref<SortField>("time")
const sortOrder = ref<SortOrder>("desc")

const filterTabs: { key: FilterKey; label: string }[] = [
  { key: "unread", label: "未读" },
  { key: "read", label: "已读" },
  { key: "all", label: "全部" }
]

const enrichedList = computed(() =>
  listForView.value.map((n) => {
    const severity = parseNotificationSeverity(n.title)
    return {
      ...n,
      severity,
      severityColor: getSeverityColor(severity)
    }
  })
)

const filteredList = computed(() => {
  const list = enrichedList.value
  if (activeFilter.value === "unread") {
    return list.filter((n) => !n.read)
  }
  if (activeFilter.value === "read") {
    return list.filter((n) => n.read)
  }
  return list
})

const displayedList = computed(() => {
  const list = [...filteredList.value]
  const dir = sortOrder.value === "asc" ? 1 : -1
  list.sort((a, b) => {
    if (sortField.value === "time") {
      return (a.createdAt - b.createdAt) * dir
    }
    return (getSeverityRank(a.severity) - getSeverityRank(b.severity)) * dir
  })
  return list
})

function sortTooltip(field: SortField): string {
  const label = field === "time" ? "按发布时间" : "按重要程度"
  if (sortField.value !== field) {
    return label
  }
  return `${label}${sortOrder.value === "asc" ? "（正序）" : "（倒序）"}`
}

function sortTabLabel(field: SortField): string {
  const label = field === "time" ? "按时间" : "按重要程度"
  if (sortField.value !== field) {
    return label
  }
  return `${label}${sortOrder.value === "asc" ? "↑" : "↓"}`
}

function toggleSort(field: SortField) {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc"
    return
  }
  sortField.value = field
  sortOrder.value = "desc"
}

function openPanel() {
  visible.value = true
}

function closePanel() {
  visible.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && visible.value) {
    closePanel()
  }
}

function openItem(id: string) {
  markRead(id)
  const item = getById(id)
  if (!item?.widget) {
    return
  }
  if (item.type === "alert" && item.payload?.alert) {
    activate(
      {
        name: item.widget,
        data: {
          notificationId: item.id,
          alertInfo: item.payload.alert
        }
      },
      true
    )
    closePanel()
    return
  }
  activate(item.widget)
  closePanel()
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown)
})
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0 0 0 / 35%);
  display: grid;
  place-items: center;
  z-index: 10000;
}

.panel {
  width: min(420px, calc(100vw - 32px));
  height: min(480px, calc(100vh - 64px));
  display: flex;
  flex-direction: column;
  border-radius: var(--popup-radius, 8px);
  border: 1px solid var(--layout-border);
  background: var(--bg-overlay);
  box-shadow: var(--shadow-2);
  overflow: hidden;
  backdrop-filter: blur(var(--overlay-blur));
}

.panel-header {
  height: 48px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--layout-border);
  flex-shrink: 0;
}

.title {
  font-size: 14px;
  font-weight: 650;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mark {
  border: none;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  font-size: 12px;
  padding: 0 8px;
  height: 32px;
  border-radius: 0;
}

.mark:hover {
  background: rgba(45 140 240 / 0.08);
}

.close {
  width: 32px;
  height: 32px;
  border-radius: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
}

.close:hover {
  background: rgba(45 140 240 / 0.08);
  color: var(--text-primary);
}

.filter-bar {
  height: 40px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--layout-border);
  flex-shrink: 0;
  background: var(--bg-overlay);
}

.filters {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.filter-tab {
  border: none;
  background: transparent;
  padding: 0;
  font-size: 12px;
  line-height: 1.4;
  color: #86909c;
  cursor: pointer;
  transition: color var(--transition-fast);
}

.filter-tab:hover {
  color: var(--text-primary);
}

.filter-tab.active {
  color: var(--text-primary);
  font-weight: 600;
}

.sorts {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.sort-tab {
  height: 24px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  font-size: 12px;
  line-height: 22px;
  color: #86909c;
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
  white-space: nowrap;
}

.sort-tab:hover {
  color: var(--text-primary);
  background: rgba(45 140 240 / 0.08);
}

.sort-tab.active {
  color: var(--primary, #2d8cf0);
  border-color: color-mix(in srgb, var(--primary, #2d8cf0) 35%, transparent);
  background: rgba(45 140 240 / 0.12);
  font-weight: 600;
}

.list {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 6px;
}

.item {
  width: 100%;
  border: 1px solid transparent;
  background: transparent;
  padding: 8px 10px;
  border-radius: 0;
  display: flex;
  gap: 10px;
  cursor: pointer;
  text-align: left;
}

.item:hover {
  background: rgba(45 140 240 / 0.08);
  border-color: rgba(45 140 240 / 0.2);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  flex: 0 0 auto;
}

.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  font-size: 11px;
  color: var(--text-secondary);
}

.empty {
  height: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  box-sizing: border-box;
}
</style>
