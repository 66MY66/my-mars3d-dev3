<template>
  <mars-dialog
    :key="floatingPanelMountKey"
    v-bind="$attrs"
    title="时间轴演化"
    icon="play"
    :custom-class="dialogCustomClass"
    :draggable="!isBottomDocked"
    :width="dialogWidth"
    :height="dialogHeight"
    :min-width="dialogMinWidth"
    :min-height="dialogMinHeight"
    :handles="dialogHandles"
    :persist-layout="false"
    :position="dialogPosition"
    v-model:visible="dialogVisible"
    @move="handleDialogMove"
    @resize="handleDialogResize"
    @closed="handleClose"
  >
    <template #headerRight>
      <div class="panel-toolbar">
        <button
          type="button"
          class="panel-toolbar-btn"
          title="影像列表"
          aria-label="影像列表"
          @mousedown.stop
          @click="drawerVisible = true"
        >
          <mars-icon icon="list" width="16" />
        </button>
        <button
          type="button"
          class="panel-toolbar-btn"
          :class="{ 'is-active': isBottomDocked }"
          title="实时演示"
          aria-label="实时演示"
          @mousedown.stop
          @click="toggleLiveDemo"
        >
          <mars-icon icon="eyes" width="16" />
        </button>
        <button
          type="button"
          class="panel-toolbar-btn"
          title="恢复默认"
          aria-label="恢复默认"
          @mousedown.stop
          @click="handleReset"
        >
          <mars-icon icon="refresh" width="16" />
        </button>
      </div>
    </template>

    <div class="content" :class="{ 'content--dock': isBottomDocked }">
      <div class="row row-top">
        <a-select
          v-model:value="selectedCollection"
          placeholder="选择数据集"
          size="small"
          allow-clear
          :loading="loadingCollections"
          class="collection-select"
          @change="handleCollectionChange"
        >
          <a-select-option v-for="c in collections" :key="c.id" :value="c.id">
            {{ c.title || c.id }}
          </a-select-option>
        </a-select>

        <a-select v-model:value="granularity" size="small" class="granularity-select" @change="handleGranularityChange">
          <a-select-option value="hour">Hour</a-select-option>
          <a-select-option value="day">Day</a-select-option>
          <a-select-option value="month">Month</a-select-option>
          <a-select-option value="year">Year</a-select-option>
        </a-select>

        <button
          type="button"
          class="keyframe-toggle"
          :class="{ 'is-active': onlyKeyframes }"
          :aria-pressed="onlyKeyframes"
          @click="onlyKeyframes = !onlyKeyframes"
        >
          <span class="keyframe-toggle__thumb" />
          <span class="keyframe-toggle__label">仅关键帧</span>
        </button>
      </div>

      <div class="row time-range">
        <div class="range-item">
          <span class="label">开始</span>
          <mars-date-picker v-model:value="startTime" format="YYYY-MM-DD" size="small" :allowClear="false" popupClassName="mars-datepicker-dropdown timeline-player-datepicker-dropdown" @change="handleTimeRangeChange" />
        </div>
        <div class="range-item">
          <span class="label">结束</span>
          <mars-date-picker v-model:value="endTime" format="YYYY-MM-DD" size="small" :allowClear="false" popupClassName="mars-datepicker-dropdown timeline-player-datepicker-dropdown" @change="handleTimeRangeChange" />
        </div>
      </div>

      <div v-if="loadingItems" class="loading-state">
        <mars-icon icon="loading" spin />
        <span>加载影像列表...</span>
      </div>

      <div v-else-if="selectedCollection && effectiveItems.length === 0" class="empty-state">
        <a-empty description="该数据集无可用影像数据" />
      </div>

      <div v-else class="player">
        <div class="row progress">
          <div class="play-controls">
            <mars-button size="small" @click="handlePrevious" :disabled="currentIndex <= 0">
              <mars-icon icon="left" />
            </mars-button>
            <mars-button size="small" @click="togglePlay" :disabled="effectiveItems.length === 0" :type="isPlaying ? 'primary' : 'default'">
              <mars-icon :icon="isPlaying ? 'pause' : 'play'" />
            </mars-button>
            <mars-button size="small" @click="handleNext" :disabled="currentIndex >= effectiveItems.length - 1">
              <mars-icon icon="right" />
            </mars-button>
          </div>

          <mars-slider
            v-model:value="progressValue"
            :min="0"
            :max="Math.max(1, effectiveItems.length - 1)"
            :step="1"
            class="progress-slider"
            @change="handleProgressChange"
          />

          <span class="progress-text">{{ currentIndex + 1 }} / {{ effectiveItems.length }}</span>
        </div>

        <div v-if="currentItem" class="current-item">
          <div class="meta">
            <div class="meta-title">
              <span class="id">{{ currentItem.id }}</span>
              <a-tag v-if="isKeyframe(currentItem.id)" :color="getKeyframeTagColor(currentItem.id)">关键帧</a-tag>
            </div>
            <div class="meta-sub">
              <span class="time">{{ formatDateTime(currentItem.properties.datetime) }}</span>
              <span class="title">{{ currentItem.properties.title || "未命名" }}</span>
            </div>
          </div>
          <div class="meta-actions">
            <mars-button size="small" @click="handleKeyframeClick" :disabled="!currentItem">
              <mars-icon icon="star" />
              {{ isKeyframe(currentItem.id) ? "编辑" : "标记" }}
            </mars-button>
            <mars-button v-if="isKeyframe(currentItem.id)" size="small" danger @click="removeKeyframe(currentItem.id)">取消</mars-button>
            <mars-button size="small" @click="setRangeA" :disabled="!currentItem">设A</mars-button>
            <mars-button size="small" @click="setRangeB" :disabled="!currentItem">设B</mars-button>
            <mars-button size="small" @click="clearRange" :disabled="rangeA == null && rangeB == null">清AB</mars-button>
          </div>
        </div>

        <div class="row bottom">
          <div class="speed-control">
            <span class="label">速度</span>
            <a-select v-model:value="playSpeed" size="small" class="speed-select" @change="handleSpeedChange">
              <a-select-option :value="500">0.5s</a-select-option>
              <a-select-option :value="1000">1s</a-select-option>
              <a-select-option :value="1500">1.5s</a-select-option>
              <a-select-option :value="2000">2s</a-select-option>
              <a-select-option :value="3000">3s</a-select-option>
            </a-select>
          </div>

          <div class="opacity-control">
            <span class="label">透明度</span>
            <mars-slider v-model:value="opacityValue" :min="0" :max="100" :step="1" class="opacity-slider" @change="handleOpacityChange" />
            <span class="opacity-text">{{ opacityValue }}%</span>
          </div>
        </div>

        <div v-if="rangeLabel" class="range-hint">{{ rangeLabel }}</div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="drawerVisible"
        class="timeline-drawer-popover mars-popup-shell"
        :style="drawerPopoverStyle"
        @mousedown.stop
      >
        <div class="timeline-drawer-header" @mousedown="handleDrawerDragStart">
          <div class="timeline-drawer-title">影像列表</div>
          <div class="timeline-drawer-actions">
            <button class="timeline-drawer-action" type="button" title="默认恢复" aria-label="默认恢复" @mousedown.stop @click="resetDrawerLayout">
              <mars-icon icon="refresh" width="16" />
            </button>
            <button class="timeline-drawer-action" type="button" title="退出" aria-label="退出" @mousedown.stop @click="drawerVisible = false">
              <mars-icon icon="close" width="16" />
            </button>
          </div>
        </div>
        <div class="timeline-drawer-body">
          <div class="drawer-toolbar">
            <a-input v-model:value="searchText" placeholder="搜索 ID/标题" allowClear />
          </div>
          <a-list :data-source="pagedDrawerItems" size="small" :split="true">
            <template #renderItem="{ item }">
              <a-list-item class="drawer-item" @click="jumpToItem(item.id)">
                <div class="drawer-item-main">
                  <div class="drawer-item-title">
                    <span class="drawer-id">{{ item.id }}</span>
                    <span v-if="isKeyframe(item.id)" class="drawer-star" :style="{ color: getKeyframeTagColor(item.id) }">★</span>
                  </div>
                  <div class="drawer-item-sub">
                    <span>{{ formatDateTime(item.properties.datetime) }}</span>
                    <span class="drawer-title">{{ item.properties.title || "未命名" }}</span>
                  </div>
                  <div v-if="getKeyframeNote(item.id)" class="drawer-item-note">{{ getKeyframeNote(item.id) }}</div>
                </div>
              </a-list-item>
            </template>
          </a-list>
          <div class="drawer-pagination">
            <span class="drawer-pagination-info">
              {{ drawerPage }} / {{ drawerTotalPages }} 页，共 {{ drawerFilteredItems.length }} 条
            </span>
            <a-pagination
              size="small"
              :current="drawerPage"
              :pageSize="drawerPageSize"
              :pageSizeOptions="['10', '20', '50']"
              :total="drawerFilteredItems.length"
              show-size-changer
              show-less-items
              @change="handleDrawerPageChange"
              @showSizeChange="handleDrawerPageChange"
            />
          </div>
        </div>
        <span class="timeline-drawer-resize" aria-hidden="true" @mousedown.stop.prevent="handleDrawerResizeStart" />
      </div>
    </Teleport>

    <mars-task-modal v-model:open="keyframeEditorOpen" width="420" title="关键帧设置" @ok="saveKeyframeMeta" @cancel="closeKeyframeEditor">
      <a-form class="keyframe-editor-form" layout="vertical">
        <a-form-item label="颜色">
          <mars-color-picker v-model:value="keyframeEditorColor" placement="bottomLeft" />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="keyframeEditorNote" placeholder="可选" />
        </a-form-item>
      </a-form>
    </mars-task-modal>
  </mars-dialog>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue"
import dayjs from "dayjs"
import { $message } from "@mars/components/mars-ui/index"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import { useWidget } from "@mars/common/store/widget"
import * as mapWork from "./map"
import { POPUP_PANEL_RESIZE_HANDLES } from "@mars/common/constants/popup-resize-handles"
import { getCollections as getRemoteCollections, getCollection, getItems, getLocalManifests } from "../dataset-repository/services/eoapi-datasets"
import { StacCollection, StacItem } from "../dataset-repository/types/eoapi-types"

// 生命周期钩子
useLifecycle(mapWork)

const { disable } = useWidget()

const props = withDefaults(
  defineProps<{
    visible?: boolean
  }>(),
  {
    visible: true
  }
)

const emit = defineEmits(["update:visible"])

// ============ 状态变量 ============
const dialogVisible = ref(!!props.visible)
const floatingPanelMountKey = ref(0)
const isBottomDocked = ref(false)

/** 浮动弹窗初始宽度；最小宽度需完整展示标题栏与工具按钮 */
const FLOATING_PANEL_WIDTH = 680
const FLOATING_PANEL_INITIAL_HEIGHT = 520
const FLOATING_PANEL_MIN_WIDTH = 680
const FLOATING_PANEL_MIN_HEIGHT = 280

type PanelPosition = { top?: number; right?: number; left?: number; bottom?: number }

type SavedFloatingPanel = {
  width: number
  height: number
  position: PanelPosition
}

function getMapWrapperSize() {
  const el = document.getElementById("mars-main-view")
  return {
    width: el?.offsetWidth || window.innerWidth || 1200,
    height: el?.offsetHeight || window.innerHeight || 800
  }
}

function getDrawerActivityRect() {
  const mapRoot = document.getElementById("mars-main-view")
  const rect = mapRoot?.getBoundingClientRect?.()
  if (!rect) {
    return {
      left: 0,
      top: 0,
      right: window.innerWidth || 1200,
      bottom: window.innerHeight || 800
    }
  }
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom
  }
}

function clampDrawerLayout() {
  if (typeof window === "undefined") {
    return
  }
  const rect = getDrawerActivityRect()
  const gap = 12
  const maxLeft = Math.max(rect.left + gap, rect.right - drawerLayout.width - gap)
  const maxTop = Math.max(rect.top + gap, rect.bottom - drawerLayout.height - gap)
  drawerLayout.left = Math.min(Math.max(rect.left + gap, drawerLayout.left), maxLeft)
  drawerLayout.top = Math.min(Math.max(rect.top + gap, drawerLayout.top), maxTop)
}

function getDefaultDrawerLayout() {
  if (typeof window === "undefined") {
    return {
      width: DRAWER_INITIAL_WIDTH,
      height: DRAWER_INITIAL_HEIGHT,
      left: 80,
      top: 80
    }
  }
  const rect = getDrawerActivityRect()
  const gap = 12
  const left = Math.min(Math.round(rect.left + gap), Math.max(rect.left + gap, rect.right - DRAWER_INITIAL_WIDTH - gap))
  const top = Math.min(Math.round(rect.top + gap), Math.max(rect.top + gap, rect.bottom - DRAWER_INITIAL_HEIGHT - gap))
  return {
    width: DRAWER_INITIAL_WIDTH,
    height: DRAWER_INITIAL_HEIGHT,
    left,
    top
  }
}

function resetDrawerLayout() {
  const next = getDefaultDrawerLayout()
  drawerLayout.width = next.width
  drawerLayout.height = next.height
  drawerLayout.left = next.left
  drawerLayout.top = next.top
}

function getCenteredPanelLayout() {
  if (typeof window === "undefined") {
    return {
      width: FLOATING_PANEL_WIDTH,
      height: FLOATING_PANEL_INITIAL_HEIGHT,
      position: { left: 200, top: 120 } as PanelPosition
    }
  }
  const { width: viewW, height: viewH } = getMapWrapperSize()
  const width = FLOATING_PANEL_WIDTH
  const height = FLOATING_PANEL_INITIAL_HEIGHT
  const left = Math.max(12, Math.round((viewW - width) / 2))
  const top = Math.max(12, Math.round((viewH - height) / 2))
  return { width, height, position: { left, top } as PanelPosition }
}

const defaultPanelLayout = getCenteredPanelLayout()
const panelState = reactive({
  width: defaultPanelLayout.width,
  height: defaultPanelLayout.height,
  position: defaultPanelLayout.position as PanelPosition
})

const savedFloatingPanel = ref<SavedFloatingPanel | null>(null)
const dockPanelHeight = ref(220)
let dockResizeObserver: ResizeObserver | null = null

const dialogCustomClass = computed(() =>
  isBottomDocked.value
    ? "eoapi-timeline-player-panel eoapi-timeline-player-panel--bottom-dock"
    : "eoapi-timeline-player-panel eoapi-timeline-player-panel--floating"
)

const dialogPosition = computed(() => {
  if (isBottomDocked.value) {
    return { left: 0, bottom: 0, right: 0 } as PanelPosition
  }
  return panelState.position
})

const dialogWidth = computed(() => (isBottomDocked.value ? "100%" : panelState.width))
const dialogHeight = computed(() => (isBottomDocked.value ? undefined : panelState.height))
const dialogMinWidth = computed(() => (isBottomDocked.value ? undefined : FLOATING_PANEL_MIN_WIDTH))
const dialogMinHeight = computed(() => (isBottomDocked.value ? undefined : FLOATING_PANEL_MIN_HEIGHT))
const dialogHandles = computed(() => (isBottomDocked.value ? false : [...POPUP_PANEL_RESIZE_HANDLES]))

const DRAWER_INITIAL_WIDTH = 380
const DRAWER_INITIAL_HEIGHT = 300
const DRAWER_MIN_WIDTH = 380
const DRAWER_MIN_HEIGHT = 300
const drawerLayout = reactive({
  width: DRAWER_INITIAL_WIDTH,
  height: DRAWER_INITIAL_HEIGHT,
  left: 80,
  top: 80
})

const drawerPopoverStyle = computed(() => ({
  width: `${drawerLayout.width}px`,
  height: `${drawerLayout.height}px`,
  minWidth: `${DRAWER_MIN_WIDTH}px`,
  minHeight: `${DRAWER_MIN_HEIGHT}px`,
  left: `${drawerLayout.left}px`,
  top: `${drawerLayout.top}px`
}))

const loadingCollections = ref(false)
const loadingItems = ref(false)
const collections = ref<StacCollection[]>([])
const items = ref<StacItem[]>([])

// 选择状态（undefined 才会显示「选择数据集」占位提示）
const selectedCollection = ref<string | undefined>(undefined)

type Granularity = "hour" | "day" | "month" | "year"
const granularity = ref<Granularity>("day")
const onlyKeyframes = ref(false)
const keyframeIds = ref<string[]>([])
const keyframeMeta = ref<Record<string, { color?: string; note?: string }>>({})

const drawerVisible = ref(false)
const searchText = ref("")
const drawerPage = ref(1)
const drawerPageSize = ref(10)

// 时间范围
const startTime = ref(dayjs().subtract(1, "month"))
const endTime = ref(dayjs())

// 播放控制
const currentIndex = ref(0)
const progressValue = ref(0)
const isPlaying = ref(false)
const playSpeed = ref(1000) // 播放间隔（毫秒）
const opacityValue = ref(100)
let playTimer: ReturnType<typeof setInterval> | null = null
let playOverrunCount = 0
let lastTickAt = 0

const rangeA = ref<number | null>(null)
const rangeB = ref<number | null>(null)

const keyframeEditorOpen = ref(false)
const keyframeEditorId = ref<string>("")
const keyframeEditorColor = ref<string>("rgba(24,144,255,1)")
const keyframeEditorNote = ref<string>("")

const STORAGE_KEY = "ksh003_timeline_player_state_v1"
const TTL_MS = 7 * 24 * 60 * 60 * 1000

function getFloatingDialogEl(): HTMLElement | null {
  return document.querySelector(".eoapi-timeline-player-panel--floating.mars-dialog") as HTMLElement | null
}

function applyCenteredLayout() {
  const defaults = getCenteredPanelLayout()
  panelState.width = defaults.width
  panelState.height = defaults.height
  panelState.position = { ...defaults.position }
}

function syncFloatingDialogLayout() {
  if (isBottomDocked.value) {
    return
  }
  const el = getFloatingDialogEl()
  if (!el) {
    return
  }
  const left = Number(panelState.position.left)
  const top = Number(panelState.position.top)
  if (Number.isFinite(left)) {
    el.style.left = `${left}px`
  }
  if (Number.isFinite(top)) {
    el.style.top = `${top}px`
  }
  el.style.right = ""
  el.style.bottom = ""
  const width = Math.max(FLOATING_PANEL_MIN_WIDTH, Number(panelState.width) || FLOATING_PANEL_WIDTH)
  const height = Math.max(FLOATING_PANEL_MIN_HEIGHT, Number(panelState.height) || FLOATING_PANEL_INITIAL_HEIGHT)
  panelState.width = width
  panelState.height = height
  el.style.width = `${width}px`
  el.style.height = `${height}px`
}

function applyFloatingPanelLayout() {
  applyCenteredLayout()
  nextTick(() => {
    syncFloatingDialogLayout()
  })
}

function getMapRootEl(): HTMLElement | null {
  return document.getElementById("mars-main-view")
}

function updateMapDockLayout() {
  const root = getMapRootEl()
  if (!root) {
    return
  }

  if (!dialogVisible.value || !isBottomDocked.value) {
    cleanupMapDockLayout()
    return
  }

  root.classList.add("timeline-player-dock-active")
  const dockEl = document.querySelector(".eoapi-timeline-player-panel--bottom-dock") as HTMLElement | null
  if (dockEl) {
    dockPanelHeight.value = dockEl.offsetHeight
    root.style.setProperty("--timeline-player-dock-height", `${dockEl.offsetHeight}px`)
  }
  mapWork.resizeMapView?.()
}

function bindDockResizeObserver() {
  unbindDockResizeObserver()
  if (!isBottomDocked.value || typeof ResizeObserver === "undefined") {
    return
  }
  const dockEl = document.querySelector(".eoapi-timeline-player-panel--bottom-dock") as HTMLElement | null
  if (!dockEl) {
    return
  }
  dockResizeObserver = new ResizeObserver(() => {
    updateMapDockLayout()
  })
  dockResizeObserver.observe(dockEl)
}

function unbindDockResizeObserver() {
  dockResizeObserver?.disconnect()
  dockResizeObserver = null
}

function cleanupMapDockLayout() {
  unbindDockResizeObserver()
  const root = getMapRootEl()
  root?.classList.remove("timeline-player-dock-active")
  root?.style.removeProperty("--timeline-player-dock-height")
  mapWork.resizeMapView?.()
}

function toggleLiveDemo() {
  if (isBottomDocked.value) {
    isBottomDocked.value = false
    if (savedFloatingPanel.value) {
      panelState.width = Math.max(FLOATING_PANEL_MIN_WIDTH, savedFloatingPanel.value.width)
      panelState.height = Math.max(FLOATING_PANEL_MIN_HEIGHT, savedFloatingPanel.value.height)
      panelState.position = { ...savedFloatingPanel.value.position }
    } else {
      applyCenteredLayout()
    }
    $message("已退出实时演示")
  } else {
    persistDialogBox()
    savedFloatingPanel.value = {
      width: Math.max(FLOATING_PANEL_MIN_WIDTH, Number(panelState.width) || FLOATING_PANEL_WIDTH),
      height: Math.max(FLOATING_PANEL_MIN_HEIGHT, Number(panelState.height)),
      position: { ...panelState.position }
    }
    isBottomDocked.value = true
    $message("已进入实时演示")
  }
  persistStateToStorage()
  nextTick(() => {
    bindPanelFrontListener()
    if (!isBottomDocked.value) {
      syncFloatingDialogLayout()
    }
    updateMapDockLayout()
    bindDockResizeObserver()
  })
}

function handleReset() {
  stopPlay()
  granularity.value = "day"
  onlyKeyframes.value = false
  playSpeed.value = 1000
  opacityValue.value = 100
  mapWork.setTimelineOpacity(1)
  rangeA.value = null
  rangeB.value = null
  currentIndex.value = 0
  progressValue.value = 0
  if (effectiveItems.value.length > 0) {
    loadCurrentItem()
  } else {
    mapWork.clearTimelineLayer()
  }
  if (!isBottomDocked.value) {
    applyFloatingPanelLayout()
  }
  persistStateToStorage()
  $message("已恢复默认设置")
}

watch(
  () => props.visible,
  (value, prev) => {
    dialogVisible.value = !!value
    if (value) {
      isBottomDocked.value = false
      applyFloatingPanelLayout()
      if (prev === false) {
        floatingPanelMountKey.value += 1
      }
      nextTick(() => {
        cleanupMapDockLayout()
        syncFloatingDialogLayout()
        updateMapDockLayout()
        bindDockResizeObserver()
      })
    }
  }
)

watch(dialogVisible, (value) => {
  emit("update:visible", value)
  if (!value) {
    cleanupMapDockLayout()
  }
})

watch(isBottomDocked, () => {
  nextTick(() => {
    updateMapDockLayout()
    bindDockResizeObserver()
  })
})

// ============ 计算属性 ============

/**
 * 按时间范围过滤的影像列表
 */
const filteredItems = computed(() => {
  const start = startTime.value
  const end = endTime.value

  return items.value.filter((item) => {
    if (!item.properties.datetime) { return false }
    const itemTime = dayjs(item.properties.datetime)
    return itemTime >= start && itemTime <= end
  }).sort((a, b) => {
    // 按时间升序排列
    const timeA = dayjs(a.properties.datetime)
    const timeB = dayjs(b.properties.datetime)
    return timeA.valueOf() - timeB.valueOf()
  })
})

const granularItems = computed(() => {
  const src = filteredItems.value
  if (granularity.value === "hour") {
    return src
  }
  const unit = granularity.value
  const bucket = new Map<string, StacItem>()
  for (const item of src) {
    const dt = item.properties.datetime
    if (!dt) {
      continue
    }
    const key = dayjs(dt).startOf(unit).toISOString()
    if (!bucket.has(key)) {
      bucket.set(key, item)
    }
  }
  return Array.from(bucket.values()).sort((a, b) => {
    const timeA = dayjs(a.properties.datetime)
    const timeB = dayjs(b.properties.datetime)
    return timeA.valueOf() - timeB.valueOf()
  })
})

const effectiveItems = computed(() => {
  const src = granularItems.value
  if (!onlyKeyframes.value) {
    return src
  }
  const set = new Set(keyframeIds.value)
  return src.filter((i) => set.has(i.id))
})

/**
 * 当前显示的影像
 */
const currentItem = computed(() => {
  return effectiveItems.value[currentIndex.value] || null
})

const rangeLabel = computed(() => {
  if (rangeA.value == null && rangeB.value == null) {
    return ""
  }
  const a = rangeA.value != null ? rangeA.value + 1 : "-"
  const b = rangeB.value != null ? rangeB.value + 1 : "-"
  return `A-B 播放范围：${a} ~ ${b}`
})

// ============ 初始化 ============

onMounted(async () => {
  isBottomDocked.value = false
  applyFloatingPanelLayout()
  await loadCollections()
  await restoreStateFromStorage().catch(() => {})
  applyFloatingPanelLayout()
  bindPanelFrontListener()
  nextTick(() => {
    updateMapDockLayout()
    bindDockResizeObserver()
  })
})

function bindPanelFrontListener() {
  const el = document.querySelector(".eoapi-timeline-player-panel") as HTMLElement | null
  el?.addEventListener("mousedown", notifyPanelFront, true)
}

async function loadCollections() {
  loadingCollections.value = true
  try {
    const locals = getLocalManifests().map((x) => x.datasetId).filter((x) => String(x || "").startsWith("local_"))
    const localCollections: StacCollection[] = []
    for (const id of locals) {
      const r = await getCollection(id)
      if (r.success && r.data) {
        localCollections.push(r.data)
      }
    }
    const remote = await getRemoteCollections({ limit: 200 })
    const remoteCollections = remote.success && Array.isArray(remote.data) ? remote.data : []
    const seen = new Set<string>()
    const merged = [...localCollections, ...remoteCollections].filter((c) => {
      const id = String((c as any)?.id || "")
      if (!id) {
        return false
      }
      if (seen.has(id)) {
        return false
      }
      seen.add(id)
      return true
    })
    collections.value = merged
  } catch {
  } finally {
    loadingCollections.value = false
  }
}

async function handleCollectionChange(collectionId: string | undefined) {
  if (!collectionId) {
    selectedCollection.value = undefined
    stopPlay()
    mapWork.clearTimelineLayer()
    items.value = []
    currentIndex.value = 0
    progressValue.value = 0
    persistStateToStorage()
    return
  }

  // 停止播放
  stopPlay()

  // 清除当前图层
  mapWork.clearTimelineLayer()
  currentIndex.value = 0
  progressValue.value = 0

  loadingItems.value = true
  try {
    const result = await getItems(collectionId, { limit: 200 })
    items.value = result.success && Array.isArray(result.data) ? result.data : []
    updateTimeRangeFromItems()
    if (effectiveItems.value.length > 0) {
      loadCurrentItem()
    }
    persistStateToStorage()
  } catch {
    items.value = []
    mapWork.clearTimelineLayer()
    $message("影像列表加载失败")
  } finally {
    loadingItems.value = false
  }
}

/**
 * 根据影像数据自动设置时间范围
 */
function updateTimeRangeFromItems() {
  if (items.value.length === 0) { return }

  const times = items.value
    .filter((item) => item.properties.datetime)
    .map((item) => dayjs(item.properties.datetime))
    .sort((a, b) => a.valueOf() - b.valueOf())

  if (times.length > 0) {
    startTime.value = times[0]
    endTime.value = times[times.length - 1]
  }
}

// ============ 时间范围变化处理 ============

function emitTimeExtentChange() {
  try {
    const start = startTime.value ? dayjs(startTime.value).startOf("day").toISOString() : ""
    const end = endTime.value ? dayjs(endTime.value).endOf("day").toISOString() : ""
    const current = currentItem.value?.properties?.datetime ? String(currentItem.value.properties.datetime) : ""
    window.dispatchEvent(new CustomEvent("mars3d:timeExtentChange", { detail: { start: start || undefined, end: end || undefined, current: current || undefined } }))
  } catch {
  }
}

function handleTimeRangeChange() {
  stopPlay()
  currentIndex.value = 0
  progressValue.value = 0
  if (effectiveItems.value.length > 0) {
    loadCurrentItem()
  } else {
    mapWork.clearTimelineLayer()
  }
  emitTimeExtentChange()
  persistStateToStorage()
}

// ============ 播放控制 ============

function togglePlay() {
  if (isPlaying.value) {
    stopPlay()
  } else {
    startPlay()
  }
}

function startPlay() {
  if (effectiveItems.value.length === 0) { return }

  isPlaying.value = true
  playOverrunCount = 0
  lastTickAt = performance.now()

  if (granularity.value === "hour" && effectiveItems.value.length > 500) {
    granularity.value = "day"
    $message("影像数量较多，已自动降级为 Day 粒度")
  }

  playTimer = setInterval(() => {
    const now = performance.now()
    const delta = now - lastTickAt
    lastTickAt = now
    if (delta > playSpeed.value * 1.6) {
      playOverrunCount += 1
    } else {
      playOverrunCount = Math.max(0, playOverrunCount - 1)
    }
    if (playOverrunCount >= 3) {
      applyDegrade()
      playOverrunCount = 0
    }

    const maxIndex = effectiveItems.value.length - 1
    const a = rangeA.value
    const b = rangeB.value
    if (a != null && b != null) {
      const start = Math.min(a, b)
      const end = Math.max(a, b)
      if (currentIndex.value < start) {
        currentIndex.value = start
      } else if (currentIndex.value >= end) {
        currentIndex.value = start
      } else {
        currentIndex.value += 1
      }
    } else {
      if (currentIndex.value < maxIndex) {
        currentIndex.value++
      } else {
        currentIndex.value = 0
      }
    }
    progressValue.value = currentIndex.value
    loadCurrentItem()
  }, playSpeed.value)
}

function stopPlay() {
  isPlaying.value = false
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
}

function handlePrevious() {
  stopPlay()
  if (currentIndex.value > 0) {
    currentIndex.value--
    progressValue.value = currentIndex.value
    loadCurrentItem()
  }
}

function handleNext() {
  stopPlay()
  if (currentIndex.value < filteredItems.value.length - 1) {
    currentIndex.value++
    progressValue.value = currentIndex.value
    loadCurrentItem()
  }
}

function handleProgressChange(value: number) {
  stopPlay()
  currentIndex.value = value
  progressValue.value = value
  loadCurrentItem()
  persistStateToStorage()
}

// ============ 加载当前影像 ============

function loadCurrentItem() {
  const item = currentItem.value
  if (!item || !selectedCollection.value) { return }
  mapWork.cacheItem(item.id, item)

  const success = mapWork.loadTimelineItem(
    selectedCollection.value,
    item.id
  )

  if (success) {
    // 飞到影像范围（如果有 bbox）
    if (item.bbox && item.bbox.length >= 4) {
      mapWork.flyToBbox(item.bbox as [number, number, number, number], 0.5)
    }
  }
  emitTimeExtentChange()
}

// ============ 透明度控制 ============

function handleOpacityChange(value: number) {
  mapWork.setTimelineOpacity(value / 100)
  persistStateToStorage()
}

function handleSpeedChange() {
  if (isPlaying.value) {
    stopPlay()
    startPlay()
  }
  persistStateToStorage()
}

function handleGranularityChange() {
  stopPlay()
  currentIndex.value = 0
  progressValue.value = 0
  const srcCount = filteredItems.value.length
  const nextCount = granularItems.value.length
  if (srcCount > nextCount && nextCount > 0) {
    $message("已按粒度聚合，部分帧已跳过")
  }
  if (effectiveItems.value.length > 0) {
    loadCurrentItem()
  } else {
    mapWork.clearTimelineLayer()
  }
  persistStateToStorage()
}

function isKeyframe(id: string) {
  return keyframeIds.value.includes(id)
}

function getKeyframeTagColor(id: string): string {
  const meta = keyframeMeta.value[String(id || "")]
  return String(meta?.color || "rgba(24,144,255,1)")
}

function getKeyframeNote(id: string): string {
  const meta = keyframeMeta.value[String(id || "")]
  return String(meta?.note || "").trim()
}

function openKeyframeEditor(id: string) {
  const safeId = String(id || "").trim()
  if (!safeId) {
    return
  }
  keyframeEditorId.value = safeId
  keyframeEditorColor.value = getKeyframeTagColor(safeId)
  keyframeEditorNote.value = getKeyframeNote(safeId)
  keyframeEditorOpen.value = true
}

function closeKeyframeEditor() {
  keyframeEditorOpen.value = false
  keyframeEditorId.value = ""
}

function handleKeyframeClick() {
  const item = currentItem.value
  if (!item) {
    return
  }
  const id = item.id
  if (!isKeyframe(id)) {
    keyframeIds.value.push(id)
    if (!keyframeMeta.value[id]) {
      keyframeMeta.value[id] = { color: "rgba(24,144,255,1)", note: "" }
    }
    persistStateToStorage()
    $message("已标记为关键帧")
  }
  openKeyframeEditor(id)
}

function removeKeyframe(id: string) {
  const safeId = String(id || "").trim()
  if (!safeId) {
    return
  }
  const idx = keyframeIds.value.indexOf(safeId)
  if (idx >= 0) {
    keyframeIds.value.splice(idx, 1)
  }
  if (keyframeMeta.value[safeId]) {
    delete keyframeMeta.value[safeId]
  }
  persistStateToStorage()
  $message("已取消关键帧")
}

function saveKeyframeMeta() {
  const id = String(keyframeEditorId.value || "").trim()
  if (!id) {
    closeKeyframeEditor()
    return
  }
  if (!isKeyframe(id)) {
    keyframeIds.value.push(id)
  }
  keyframeMeta.value[id] = {
    color: String(keyframeEditorColor.value || "").trim() || "rgba(24,144,255,1)",
    note: String(keyframeEditorNote.value || "").trim()
  }
  persistStateToStorage()
  closeKeyframeEditor()
  $message("已更新关键帧设置")
}

function setRangeA() {
  rangeA.value = currentIndex.value
  if (rangeB.value != null && rangeA.value != null && rangeA.value > rangeB.value) {
    const tmp = rangeA.value
    rangeA.value = rangeB.value
    rangeB.value = tmp
  }
  persistStateToStorage()
}

function setRangeB() {
  rangeB.value = currentIndex.value
  if (rangeA.value != null && rangeB.value != null && rangeA.value > rangeB.value) {
    const tmp = rangeA.value
    rangeA.value = rangeB.value
    rangeB.value = tmp
  }
  persistStateToStorage()
}

function clearRange() {
  rangeA.value = null
  rangeB.value = null
  persistStateToStorage()
}

const drawerFilteredItems = computed(() => {
  const q = (searchText.value || "").trim().toLowerCase()
  const src = granularItems.value
  if (!q) {
    return src
  }
  return src.filter((i) => {
    const title = (i.properties.title || "").toLowerCase()
    return i.id.toLowerCase().includes(q) || title.includes(q)
  })
})

const pagedDrawerItems = computed(() => {
  const start = (drawerPage.value - 1) * drawerPageSize.value
  return drawerFilteredItems.value.slice(start, start + drawerPageSize.value)
})

const drawerTotalPages = computed(() => {
  return Math.max(1, Math.ceil(drawerFilteredItems.value.length / drawerPageSize.value))
})

function handleDrawerPageChange(page: number, pageSize?: number) {
  if (typeof pageSize === "number" && pageSize > 0 && pageSize !== drawerPageSize.value) {
    drawerPageSize.value = pageSize
    drawerPage.value = 1
    return
  }
  drawerPage.value = Math.min(Math.max(1, page), drawerTotalPages.value)
}

function handleDrawerDragStart(event: MouseEvent) {
  if (event.button !== 0) {
    return
  }
  const startX = event.clientX
  const startY = event.clientY
  const startLeft = drawerLayout.left
  const startTop = drawerLayout.top

  const handleMove = (moveEvent: MouseEvent) => {
    drawerLayout.left = startLeft + moveEvent.clientX - startX
    drawerLayout.top = startTop + moveEvent.clientY - startY
    clampDrawerLayout()
  }
  const handleUp = () => {
    document.removeEventListener("mousemove", handleMove)
    document.removeEventListener("mouseup", handleUp)
  }
  document.addEventListener("mousemove", handleMove)
  document.addEventListener("mouseup", handleUp)
}

function handleDrawerResizeStart(event: MouseEvent) {
  if (event.button !== 0) {
    return
  }
  const startX = event.clientX
  const startY = event.clientY
  const startWidth = drawerLayout.width
  const startHeight = drawerLayout.height

  const handleMove = (moveEvent: MouseEvent) => {
    const rect = getDrawerActivityRect()
    const maxWidth = Math.max(DRAWER_MIN_WIDTH, rect.right - drawerLayout.left - 12)
    const maxHeight = Math.max(DRAWER_MIN_HEIGHT, rect.bottom - drawerLayout.top - 12)
    drawerLayout.width = Math.min(maxWidth, Math.max(DRAWER_MIN_WIDTH, startWidth + moveEvent.clientX - startX))
    drawerLayout.height = Math.min(maxHeight, Math.max(DRAWER_MIN_HEIGHT, startHeight + moveEvent.clientY - startY))
  }
  const handleUp = () => {
    document.removeEventListener("mousemove", handleMove)
    document.removeEventListener("mouseup", handleUp)
  }
  document.addEventListener("mousemove", handleMove)
  document.addEventListener("mouseup", handleUp)
}

watch([searchText, drawerVisible], () => {
  drawerPage.value = 1
})

watch(drawerVisible, (visible) => {
  if (visible) {
    resetDrawerLayout()
  }
})

watch(drawerFilteredItems, () => {
  if (drawerPage.value > drawerTotalPages.value) {
    drawerPage.value = drawerTotalPages.value
  }
})

watch(effectiveItems, () => {
  if (currentIndex.value >= effectiveItems.value.length) {
    currentIndex.value = Math.max(0, effectiveItems.value.length - 1)
    progressValue.value = currentIndex.value
  }
})

function jumpToItem(itemId: string) {
  if (onlyKeyframes.value && !isKeyframe(itemId)) {
    onlyKeyframes.value = false
  }
  const idx = effectiveItems.value.findIndex((i) => i.id === itemId)
  if (idx < 0) {
    const idx2 = granularItems.value.findIndex((i) => i.id === itemId)
    if (idx2 < 0) {
      return
    }
    currentIndex.value = 0
  } else {
    currentIndex.value = idx
  }
  progressValue.value = currentIndex.value
  stopPlay()
  loadCurrentItem()
  persistStateToStorage()
}

function applyDegrade() {
  if (granularity.value === "hour") {
    granularity.value = "day"
    $message("播放卡顿，已自动降级为 Day 粒度")
    handleGranularityChange()
    return
  }
  if (granularity.value === "day") {
    granularity.value = "month"
    $message("播放卡顿，已自动降级为 Month 粒度")
    handleGranularityChange()
    return
  }
  if (granularity.value === "month") {
    granularity.value = "year"
    $message("播放卡顿，已自动降级为 Year 粒度")
    handleGranularityChange()
    return
  }
  if (playSpeed.value < 2000) {
    playSpeed.value = 2000
    $message("播放卡顿，已自动降低播放速度")
    handleSpeedChange()
  }
}

// ============ 格式化函数 ============

function formatDateTime(datetime: string): string {
  if (!datetime) { return "未知" }
  return dayjs(datetime).format("YYYY-MM-DD HH:mm:ss")
}

// ============ 关闭面板 ============

function handleClose() {
  stopPlay()
  isBottomDocked.value = false
  cleanupMapDockLayout()
  mapWork.clearTimelineLayer()
  disable("eoapi-timeline-player")
}

// ============ 清理 ============

onUnmounted(() => {
  stopPlay()
  cleanupMapDockLayout()
  mapWork.clearTimelineLayer()
  const el = document.querySelector(".eoapi-timeline-player-panel") as HTMLElement | null
  el?.removeEventListener("mousedown", notifyPanelFront, true)
})

function notifyPanelFront() {
  if (typeof window === "undefined") {
    return
  }
  window.dispatchEvent(new CustomEvent("mars3d:widget-visible", { detail: { name: "eoapi-timeline-player", visible: true } }))
}

function handleDialogMove() {
  persistDialogBox()
  syncFloatingDialogLayout()
}

function handleDialogResize() {
  persistDialogBox()
  syncFloatingDialogLayout()
}

function persistDialogBox() {
  if (isBottomDocked.value) {
    return
  }
  const el = getFloatingDialogEl()
  if (!el) {
    return
  }
  panelState.width = Math.max(FLOATING_PANEL_MIN_WIDTH, el.offsetWidth)
  panelState.height = Math.max(FLOATING_PANEL_MIN_HEIGHT, el.offsetHeight)
  panelState.position = {
    left: el.offsetLeft,
    top: el.offsetTop
  }
  persistStateToStorage()
}

function persistStateToStorage() {
  try {
    const payload = {
      ts: Date.now(),
      selectedCollection: selectedCollection.value,
      startTime: startTime.value?.toISOString?.() || null,
      endTime: endTime.value?.toISOString?.() || null,
      granularity: granularity.value,
      onlyKeyframes: onlyKeyframes.value,
      keyframeIds: keyframeIds.value,
      keyframeMeta: keyframeMeta.value,
      rangeA: rangeA.value,
      rangeB: rangeB.value,
      playSpeed: playSpeed.value,
      opacityValue: opacityValue.value,
      isBottomDocked: isBottomDocked.value,
      savedFloatingPanel: savedFloatingPanel.value,
      panel: {
        width: panelState.width,
        height: panelState.height,
        position: panelState.position
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
  }
}

async function restoreStateFromStorage() {
  let raw = ""
  try {
    raw = localStorage.getItem(STORAGE_KEY) || ""
  } catch {
    raw = ""
  }
  if (!raw) {
    return
  }
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    return
  }
  if (!parsed?.ts || Date.now() - parsed.ts > TTL_MS) {
    return
  }
  if (parsed.savedFloatingPanel) {
    savedFloatingPanel.value = parsed.savedFloatingPanel
  }
  if (parsed.panel?.width) {
    panelState.width = Math.max(FLOATING_PANEL_MIN_WIDTH, Number(parsed.panel.width))
  }
  if (parsed.panel?.height) {
    panelState.height = Math.max(FLOATING_PANEL_MIN_HEIGHT, Number(parsed.panel.height))
  }
  if (parsed.panel?.position) {
    panelState.position = parsed.panel.position
  }
  if (parsed.granularity) {
    granularity.value = parsed.granularity
  }
  if (typeof parsed.onlyKeyframes === "boolean") {
    onlyKeyframes.value = parsed.onlyKeyframes
  }
  if (Array.isArray(parsed.keyframeIds)) {
    keyframeIds.value = parsed.keyframeIds.filter((x: any) => typeof x === "string")
  }
  if (parsed.keyframeMeta && typeof parsed.keyframeMeta === "object") {
    const next: Record<string, { color?: string; note?: string }> = {}
    Object.entries(parsed.keyframeMeta as any).forEach(([k, v]) => {
      const id = String(k || "").trim()
      if (!id) {
        return
      }
      if (!v || typeof v !== "object") {
        return
      }
      const color = typeof (v as any).color === "string" ? String((v as any).color) : undefined
      const note = typeof (v as any).note === "string" ? String((v as any).note) : undefined
      next[id] = { color, note }
    })
    keyframeMeta.value = next
  }
  if (typeof parsed.rangeA === "number") {
    rangeA.value = parsed.rangeA
  }
  if (typeof parsed.rangeB === "number") {
    rangeB.value = parsed.rangeB
  }
  if (typeof parsed.playSpeed === "number") {
    playSpeed.value = parsed.playSpeed
  }
  if (typeof parsed.opacityValue === "number") {
    opacityValue.value = parsed.opacityValue
    mapWork.setTimelineOpacity(opacityValue.value / 100)
  }
  if (parsed.startTime) {
    startTime.value = dayjs(parsed.startTime)
  }
  if (parsed.endTime) {
    endTime.value = dayjs(parsed.endTime)
  }
  if (parsed.selectedCollection) {
    selectedCollection.value = parsed.selectedCollection
    await handleCollectionChange(parsed.selectedCollection)
  }
}

// 暴露方法供外部调用
defineExpose({
  playCollection: (collectionId: string) => {
    selectedCollection.value = collectionId
    handleCollectionChange(collectionId)
    setTimeout(() => {
      startPlay()
    }, 500)
  },
  loadItem: (collectionId: string, itemId: string) => {
    selectedCollection.value = collectionId
    handleCollectionChange(collectionId)
  }
})
</script>

<style scoped lang="less">
.panel-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: calc(var(--popup-radius, 8px) - 2px);
  color: var(--mars-text-color, var(--text-primary));
  cursor: pointer;
  transition: background var(--transition-fast, 0.2s ease), color var(--transition-fast, 0.2s ease), opacity var(--transition-fast, 0.2s ease);

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &.is-active {
    color: var(--color-primary, #2d8cf0);
    background: rgba(45, 140, 240, 0.12);
  }

  :deep(.mars-icon),
  :deep(svg) {
    display: block;
    flex: 0 0 auto;
  }
}

.content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* 左右 12px 与标题栏对齐；取消 content 默认 padding 后由此统一控制 */
  padding: var(--popup-body-padding, 14px) 12px;
  flex: 1;
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.content--dock {
  gap: 8px;
  padding: 8px 12px !important;

  .current-item {
    padding: 8px;
  }

  .progress-slider {
    min-width: 160px;
  }

  .opacity-control {
    min-width: 200px;
  }
}

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .row-top {
    justify-content: flex-start;
    gap: 12px;
  }

  .collection-select {
    flex: 1;
    min-width: 160px;

    :deep(.ant-select-selection-placeholder) {
      color: var(--mars-control-placeholder, rgba(255, 255, 255, 0.45));
      font-size: 14px;
    }
  }

  .granularity-select {
    flex: 0 0 auto;
    min-width: 100px;
  }

  .hint {
    color: var(--mars-control-placeholder);
    font-size: 12px;
  }

  .keyframe-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
    color: var(--mars-control-placeholder);
    font-size: 12px;
    line-height: 18px;
    cursor: pointer;
    transition:
      color var(--transition-fast, 150ms ease);

    &:hover {
      color: var(--mars-text-color, #ffffff);
    }

    &.is-active {
      color: var(--mars-text-color, #ffffff);
    }
  }

  .keyframe-toggle__thumb {
    position: relative;
    width: 34px;
    height: 20px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.10);
    transition: background var(--transition-fast, 150ms ease);

    &::after {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 14px;
      height: 14px;
      content: "";
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.24);
      transition: transform var(--transition-fast, 150ms ease);
    }
  }

  .keyframe-toggle.is-active .keyframe-toggle__thumb {
    background: var(--color-primary, #2d8cf0);

    &::after {
      transform: translateX(14px);
    }
  }

  .keyframe-toggle__label {
    white-space: nowrap;
  }

  .time-range {
    justify-content: space-between;
    gap: 12px;
  }

  .range-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    :deep(.mars-date-picker) {
      width: 150px;
      height: 32px;
      border-radius: 10px;
    }
  }

  .label {
    color: var(--mars-control-placeholder);
    font-size: 12px;
    min-width: 34px;
  }

  .loading-state,
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px 0;
    color: var(--mars-control-placeholder);
  }

  .player {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .progress {
    align-items: center;
  }

  .play-controls {
    display: flex;
    gap: 8px;

    :deep(.mars-button) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
    }
  }

  .progress-slider {
    flex: 1;
    min-width: 220px;
  }

  .progress-text {
    color: var(--mars-control-placeholder);
    font-size: 12px;
    min-width: 46px;
    text-align: right;
  }

  .current-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }

  .meta {
    min-width: 0;
    display: grid;
    gap: 6px;
  }

  .meta-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .id {
    font-weight: 650;
    color: var(--mars-text-color);
  }

  .meta-sub {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    color: var(--mars-control-placeholder);
    font-size: 12px;
  }

  .meta-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;

    :deep(.mars-button) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
  }

  .bottom {
    justify-content: space-between;
    gap: 12px;
  }

  .speed-control {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .speed-select {
    width: 110px;
  }

  .opacity-control {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 260px;
  }

  .opacity-slider {
    flex: 1;
  }

  .opacity-text {
    min-width: 46px;
    text-align: right;
    color: var(--mars-control-placeholder);
    font-size: 12px;
  }

  .range-hint {
    color: var(--mars-control-placeholder);
    font-size: 12px;
  }

.timeline-drawer-popover {
  position: fixed;
  z-index: 10020;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--mars-text-color, var(--text-primary));
  background: var(--popup-surface, rgba(23, 35, 61, 0.88));
  border: 1px solid var(--popup-border, rgba(255, 255, 255, 0.14));
  border-radius: var(--popup-radius, 16px);
  box-shadow: var(--popup-shadow, 0 12px 30px rgba(15, 23, 42, 0.14));
  backdrop-filter: blur(var(--popup-blur, 14px));
}

.timeline-drawer-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  min-height: var(--popup-header-height, 52px);
  padding: var(--popup-header-padding, 0 14px);
  border-bottom: 1px solid var(--popup-border, rgba(255, 255, 255, 0.14));
  cursor: move;
  user-select: none;
}

.timeline-drawer-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: inherit;
  font-size: var(--popup-title-font-size, 16px);
  font-weight: var(--popup-title-font-weight, 600);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-drawer-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.timeline-drawer-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 8px;
  transition: background var(--transition-fast, 150ms ease), color var(--transition-fast, 150ms ease);

  &:hover {
    color: var(--color-primary, #2d8cf0);
    background: rgba(45, 140, 240, 0.12);
  }

  :deep(.mars-icon),
  :deep(svg) {
    display: block;
    flex: 0 0 auto;
  }
}

.timeline-drawer-body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 10px;
  flex: 1;
  min-height: 0;
  padding: 14px;
  overflow: hidden;
}

.timeline-drawer-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;

  &::after {
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 8px;
    height: 8px;
    content: "";
    border-right: 1px solid var(--mars-control-placeholder, rgba(255, 255, 255, 0.45));
    border-bottom: 1px solid var(--mars-control-placeholder, rgba(255, 255, 255, 0.45));
  }
}

  .drawer-toolbar {
    display: flex;
    gap: 8px;

    :deep(.ant-input-affix-wrapper) {
      display: flex;
      align-items: center;
      width: 100%;
      height: 36px;
      padding: 0 12px;
      border: 1px solid var(--mars-control-border, rgba(255, 255, 255, 0.14)) !important;
      border-radius: 10px;
      background: var(--mars-control-bg, rgba(255, 255, 255, 0.08)) !important;
      background-color: var(--mars-control-bg, rgba(255, 255, 255, 0.08)) !important;
      box-shadow: none;
    }

    :deep(.ant-input-affix-wrapper:hover),
    :deep(.ant-input-affix-wrapper-focused) {
      border-color: var(--color-primary, #2d8cf0) !important;
      box-shadow: 0 0 0 3px rgba(45, 140, 240, 0.12);
    }

    :deep(.ant-input) {
      height: 34px;
      padding: 0;
      border: 0 !important;
      border-color: transparent !important;
      border-radius: 0 !important;
      background: transparent !important;
      background-color: transparent !important;
      box-shadow: none !important;
      color: var(--mars-control-text, var(--text-primary));
      outline: none !important;

      &::placeholder {
        color: #C9CDD4 !important;
      }
    }

    :deep(.ant-input-affix-wrapper > input.ant-input),
    :deep(.ant-input-affix-wrapper .ant-input) {
      background: transparent !important;
      background-color: transparent !important;
    }

    :deep(.ant-input-clear-icon) {
      background: transparent !important;
      color: var(--mars-control-placeholder);
    }
  }

  :deep(.ant-list) {
    margin: 0;
    overflow: auto;
  }

  :deep(.ant-list-items) {
    margin: 0;
    padding: 0;
  }

  .drawer-item {
    cursor: pointer;
    padding: 10px 0 !important;
  }

  .drawer-item-main {
    display: grid;
    gap: 4px;
    min-width: 0;
    width: 100%;
  }

  .drawer-item-title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .drawer-id {
    font-weight: 650;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .drawer-star {
    color: #faad14;
  }

  .drawer-item-sub {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    color: var(--text-secondary);
    font-size: 12px;
  }

  .drawer-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 260px;
  }

  .drawer-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .drawer-pagination-info {
    flex: 1;
    min-width: 112px;
    color: var(--mars-control-placeholder);
    font-size: 12px;
    line-height: 18px;
    white-space: nowrap;
  }

  .drawer-pagination {
    :deep(.ant-pagination) {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      margin: 0;
    }

    :deep(.ant-pagination-prev button),
    :deep(.ant-pagination-next button) {
      color: #C9CDD4 !important;
    }

    :deep(.ant-pagination-prev button svg),
    :deep(.ant-pagination-next button svg) {
      color: #C9CDD4 !important;
    }

    :deep(.ant-pagination-disabled .ant-pagination-prev button),
    :deep(.ant-pagination-disabled .ant-pagination-next button) {
      color: rgba(201, 205, 212, 0.35) !important;
    }

    :deep(.ant-pagination-disabled .ant-pagination-prev button svg),
    :deep(.ant-pagination-disabled .ant-pagination-next button svg) {
      color: rgba(201, 205, 212, 0.35) !important;
    }

    :deep(.ant-select-selector) {
      height: 24px !important;
      border-radius: 8px !important;
    }

    :deep(.ant-select-selection-item) {
      color: #C9CDD4 !important;
      line-height: 22px !important;
    }

    :deep(.ant-select-selection-item svg),
    :deep(.ant-select-arrow) {
      color: #C9CDD4 !important;
    }
  }

  .keyframe-editor-form {
    display: grid;
    gap: 16px;

    :deep(.ant-form-item) {
      margin-bottom: 0;
    }

    :deep(.ant-form-item-label) {
      padding-bottom: 8px;
    }

    :deep(.ant-form-item-label > label) {
      height: 22px;
      color: var(--mars-control-placeholder);
      font-size: 12px;
      line-height: 22px;
    }

    :deep(.mars-color-view),
    :deep(.ant-input) {
      height: 36px;
      border-radius: 10px;
    }

    :deep(.mars-color-bg) {
      border-color: var(--mars-control-border, rgba(255, 255, 255, 0.14));
      border-radius: 10px;
      background: var(--mars-control-bg, rgba(255, 255, 255, 0.08));
    }

    :deep(.mars-color-picker) {
      top: 6px;
      left: 6px;
      width: 24px;
      height: 24px;
      border-radius: 8px;
    }

    :deep(.mars-color-label) {
      top: 7px;
      left: 40px;
      font-size: 14px;
      line-height: 22px;
    }

    :deep(.ant-input) {
      padding: 0 12px;
      border-color: var(--mars-control-border, rgba(255, 255, 255, 0.14)) !important;
      background: var(--mars-control-bg, rgba(255, 255, 255, 0.08)) !important;
    }
  }
</style>

<style lang="less">
.ant-popover-placement-bottomLeft {
  z-index: 10030;
}

.eoapi-timeline-player-panel--floating.mars-dialog {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;

  .mars-dialog__content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    /* 取消默认 content padding，改由 .content 统一左右边距 */
    padding: 0 !important;
  }
}

.eoapi-timeline-player-panel--bottom-dock.mars-dialog {
  top: auto !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  height: auto !important;
  padding: 0 !important;
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  border-radius: 0 !important;
  z-index: 9997;

  .mars-dialog__handle {
    display: none !important;
  }

  .mars-dialog__header {
    cursor: default !important;
    background: var(--bg-overlay) !important;
    backdrop-filter: blur(var(--overlay-blur));
    -webkit-backdrop-filter: blur(var(--overlay-blur));
    border: 1px solid var(--overlay-border);
    border-bottom: none;
    box-shadow: var(--overlay-shadow);
    border-radius: var(--popup-radius, 8px) var(--popup-radius, 8px) 0 0;
  }

  .mars-dialog__content {
    height: auto !important;
    max-height: min(42vh, 320px);
    overflow-y: auto;
    background: var(--bg-overlay) !important;
    backdrop-filter: blur(var(--overlay-blur));
    -webkit-backdrop-filter: blur(var(--overlay-blur));
    border-left: 1px solid var(--overlay-border);
    border-right: 1px solid var(--overlay-border);
    box-shadow: var(--overlay-shadow);
    padding: 0 !important;
  }
}

.timeline-player-datepicker-dropdown {
  .ant-picker-panel {
    width: auto;
  }

  .ant-picker-date-panel .ant-picker-content {
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0 4px;
  }

  .ant-picker-date-panel .ant-picker-content th,
  .ant-picker-date-panel .ant-picker-cell {
    width: 36px;
    height: 32px;
    padding: 0;
    text-align: center;
  }

  .ant-picker-cell {
    display: table-cell !important;
    vertical-align: middle;
  }

  .ant-picker-cell-inner {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin: 0 auto;
    border-radius: 8px;
    line-height: 28px;
  }

  .ant-picker-cell-in-view:hover .ant-picker-cell-inner,
  .ant-picker-cell-in-view.ant-picker-cell-selected .ant-picker-cell-inner {
    background: var(--color-primary, #2d8cf0) !important;
    color: #ffffff !important;
  }

  .ant-picker-cell-in-view:active .ant-picker-cell-inner {
    background: var(--primary-active, #1f70d6) !important;
  }

  .ant-picker-cell:not(.ant-picker-cell-in-view) .ant-picker-cell-inner {
    visibility: hidden;
    pointer-events: none;
  }

  .ant-picker-cell-in-view.ant-picker-cell-today .ant-picker-cell-inner::before {
    border-color: var(--color-primary, #2d8cf0);
    border-radius: 8px;
  }
}

#mars-main-view.timeline-player-dock-active .centerDiv-container {
  box-sizing: border-box;
  padding-bottom: var(--timeline-player-dock-height, 180px);
}
</style>
