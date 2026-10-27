<template>
  <mars-dialog
    :key="floatingPanelMountKey"
    v-bind="$attrs"
    title="分屏对比"
    icon="column"
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
      <!-- 实时演示：提示移至标题栏并相对弹窗居中，样式与原提示一致 -->
      <div v-if="isBottomDocked" class="header-dock-tip" aria-hidden="true">
        拖动滑块或中间分割线调整左右视图大小
      </div>
      <div class="panel-toolbar">
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
        <!-- 仅实时演示态展示；图标与侧栏「时间轴演化」一致（Play），暂不接功能 -->
        <button
          v-if="isBottomDocked"
          type="button"
          class="panel-toolbar-btn"
          title="时间轴演示"
          aria-label="时间轴演示"
          @mousedown.stop
        >
          <mars-icon icon="play" width="16" />
        </button>
        <button
          type="button"
          class="panel-toolbar-btn"
          title="清除"
          aria-label="清除"
          :disabled="!hasLayers"
          @mousedown.stop
          @click="handleClear"
        >
          <mars-icon icon="delete" width="16" />
        </button>
        <button type="button" class="panel-toolbar-btn" title="恢复默认" aria-label="恢复默认" @mousedown.stop @click="handleReset">
          <mars-icon icon="refresh" width="16" />
        </button>
        <a-tooltip placement="bottomRight">
          <template #title>
            <div class="shortcut-tip">
              <div>Alt + S：打开分屏对比</div>
              <div>Alt + ← / →：微调分屏位置</div>
              <div>Esc：关闭当前顶层面板</div>
            </div>
          </template>
          <button type="button" class="panel-toolbar-btn" title="快捷键" aria-label="快捷键" @mousedown.stop>
            <mars-icon icon="help" width="16" />
          </button>
        </a-tooltip>
      </div>
    </template>

    <div class="panel-body" :class="{ 'panel-body--dock': isBottomDocked }">
      <div class="split-slider-section" :class="{ 'split-slider-section--dock': isBottomDocked }">
        <div class="slider-wrapper">
          <span class="split-pos-label">分屏位置</span>
          <span class="label-left">左</span>
          <mars-slider
            v-model:value="sliderValue"
            :min="0"
            :max="100"
            :step="1"
            class="split-slider"
            @change="handleSliderChange"
          />
          <span class="label-right">右</span>
        </div>
        <div v-if="!isBottomDocked" class="slider-tip">拖动滑块调整左右分屏比例</div>
      </div>

      <div class="layer-section layer-section--left" :class="{ 'layer-section--dock': isBottomDocked }">
        <div class="layer-control">
          <span class="layer-side-label">左侧影像</span>
          <a-select
            v-model:value="leftCollection"
            class="split-compare-select"
            placeholder="当前任务"
            size="small"
            :loading="loadingCollections"
            allow-clear
            @change="handleLeftCollectionChange"
          >
            <a-select-option v-for="c in collections" :key="c.id" :value="c.id">
              {{ c.title || c.id }}
            </a-select-option>
          </a-select>
          <a-select
            v-model:value="leftItem"
            class="split-compare-select"
            placeholder="图层"
            size="small"
            :loading="loadingLeftItems"
            :disabled="!leftCollection"
            allow-clear
            @change="handleLeftItemChange"
          >
            <a-select-option v-for="item in leftItems" :key="item.id" :value="item.id">
              {{ item.properties.title || item.id }}
            </a-select-option>
          </a-select>
        </div>
        <div class="layer-opacity">
          <span>透明度:</span>
          <mars-slider
            v-model:value="leftOpacity"
            :min="0"
            :max="100"
            :step="1"
            @change="handleLeftOpacityChange"
          />
        </div>
        <div v-if="leftCollection && !loadingLeftItems && leftItems.length === 0" class="empty-hint">
          <a-empty description="该数据集无可用影像" :image-style="{ height: '44px' }" />
        </div>
      </div>

      <div class="layer-section layer-section--right" :class="{ 'layer-section--dock': isBottomDocked }">
        <div class="layer-control">
          <span class="layer-side-label">右侧影像</span>
          <a-select
            v-model:value="rightCollection"
            class="split-compare-select"
            placeholder="当前任务"
            size="small"
            :loading="loadingCollections"
            allow-clear
            @change="handleRightCollectionChange"
          >
            <a-select-option v-for="c in collections" :key="c.id" :value="c.id">
              {{ c.title || c.id }}
            </a-select-option>
          </a-select>
          <a-select
            v-model:value="rightItem"
            class="split-compare-select"
            placeholder="图层"
            size="small"
            :loading="loadingRightItems"
            :disabled="!rightCollection"
            allow-clear
            @change="handleRightItemChange"
          >
            <a-select-option v-for="item in rightItems" :key="item.id" :value="item.id">
              {{ item.properties.title || item.id }}
            </a-select-option>
          </a-select>
        </div>
        <div class="layer-opacity">
          <span>透明度:</span>
          <mars-slider
            v-model:value="rightOpacity"
            :min="0"
            :max="100"
            :step="1"
            @change="handleRightOpacityChange"
          />
        </div>
        <div v-if="rightCollection && !loadingRightItems && rightItems.length === 0" class="empty-hint">
          <a-empty description="该数据集无可用影像" :image-style="{ height: '44px' }" />
        </div>
      </div>

      <div v-if="!isBottomDocked" class="tip-section">
        <a-alert type="info" show-icon>
          <template #message>
            选择两个影像进行分屏对比，拖动滑块可调整对比区域
          </template>
        </a-alert>
      </div>
    </div>

    <template v-if="!isBottomDocked" #footer>
      <div class="panel-footer">
        <span class="status-text">
          {{ layerStatusText }}
        </span>
      </div>
    </template>
  </mars-dialog>

  <teleport v-if="dialogVisible" to="#mars-main-view">
    <div
      ref="mapOverlayEl"
      class="split-compare-map-overlay"
      :class="{ 'split-compare-map-overlay--floating': !isBottomDocked }"
      :style="mapOverlayStyle"
    >
      <!-- 分割线仅在实时演示模式下显示，可左右拖动 -->
      <div
        v-if="isBottomDocked"
        class="split-divider"
        :class="{ 'is-dragging': isDraggingSplit }"
        title="拖动调整左右视图大小"
        @mousedown.prevent="onDividerMouseDown"
      >
        <span class="split-divider-grip" aria-hidden="true"></span>
      </div>
    </div>
  </teleport>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue"
import { $message } from "@mars/components/mars-ui/index"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import { useWidget } from "@mars/common/store/widget"
import * as mapWork from "./map"
import { POPUP_PANEL_RESIZE_HANDLES } from "@mars/common/constants/popup-resize-handles"
import { eoapiGet } from "../dataset-repository/services/eoapi-client"
import { getCollection, getItems, getLocalManifests } from "../dataset-repository/services/eoapi-datasets"
import { StacCollection, StacItem, StacItemsResponse, StacCollectionsResponse } from "../dataset-repository/types/eoapi-types"
import {
  getLayerStatusText,
  isSameImageSelection,
  SPLIT_COMPARE_FAILURE_TEXT,
  SPLIT_COMPARE_SAME_IMAGE_TEXT
} from "./status"

const props = withDefaults(
  defineProps<{
    visible?: boolean
  }>(),
  {
    visible: true
  }
)

const emit = defineEmits(["update:visible"])

useLifecycle(mapWork)

const { disable } = useWidget()

const dialogVisible = ref(!!props.visible)
const floatingPanelMountKey = ref(0)
const sliderValue = ref(50)
const isBottomDocked = ref(false)

const STORAGE_KEY = "ksh003_split_compare_state_v1"
const TTL_MS = 7 * 24 * 60 * 60 * 1000

/** 浮动弹窗固定宽度；初始高度按当前面板内容完整展示估算 */
const FLOATING_PANEL_WIDTH = 480
const FLOATING_PANEL_INITIAL_HEIGHT = 540
/** 最小高度：标题栏 + 底部状态栏（内容区可缩至 0） */
const FLOATING_PANEL_MIN_HEIGHT = 88

type PanelPosition = { left?: number; top?: number; right?: number; bottom?: number }

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

function getDefaultPanelLayout() {
  return getCenteredPanelLayout()
}

const defaultPanelLayout = getDefaultPanelLayout()
const panelState = reactive({
  width: defaultPanelLayout.width,
  height: defaultPanelLayout.height,
  position: defaultPanelLayout.position as PanelPosition
})

const savedFloatingPanel = ref<SavedFloatingPanel | null>(null)

const collections = ref<StacCollection[]>([])
const loadingCollections = ref(false)

const leftCollection = ref<string | undefined>(undefined)
const leftItems = ref<StacItem[]>([])
const loadingLeftItems = ref(false)
const leftItem = ref<string | undefined>(undefined)
const leftOpacity = ref(100)

const rightCollection = ref<string | undefined>(undefined)
const rightItems = ref<StacItem[]>([])
const loadingRightItems = ref(false)
const rightItem = ref<string | undefined>(undefined)
const rightOpacity = ref(100)

const dialogCustomClass = computed(() =>
  isBottomDocked.value ? "split-compare-panel split-compare-panel--bottom-dock" : "split-compare-panel split-compare-panel--floating"
)

const dialogPosition = computed(() => {
  if (isBottomDocked.value) {
    return { left: 0, bottom: 0, right: 0 } as PanelPosition
  }
  return panelState.position
})

const dialogWidth = computed(() => (isBottomDocked.value ? "100%" : panelState.width))
const dialogHeight = computed(() => (isBottomDocked.value ? undefined : panelState.height))
const dialogMinWidth = computed(() => (isBottomDocked.value ? undefined : FLOATING_PANEL_WIDTH))
const dialogMinHeight = computed(() => (isBottomDocked.value ? undefined : FLOATING_PANEL_MIN_HEIGHT))
const dialogHandles = computed(() => (isBottomDocked.value ? false : [...POPUP_PANEL_RESIZE_HANDLES]))

const dockPanelHeight = ref(220)
const mapOverlayEl = ref<HTMLElement | null>(null)
const isDraggingSplit = ref(false)

const mapOverlayStyle = computed(() => ({
  "--split-compare-position": `${sliderValue.value}%`,
  "--split-compare-dock-height": isBottomDocked.value ? `${dockPanelHeight.value}px` : "0px"
}))

let dockResizeObserver: ResizeObserver | null = null

const hasLayers = computed(() => {
  return leftItem.value || rightItem.value
})

const layerStatusText = computed(() => {
  return getLayerStatusText({
    loading: loadingCollections.value || loadingLeftItems.value || loadingRightItems.value,
    leftLoaded: !!leftItem.value,
    rightLoaded: !!rightItem.value
  })
})

function applyCenteredLayout() {
  const defaults = getCenteredPanelLayout()
  panelState.width = defaults.width
  panelState.height = defaults.height
  panelState.position = { ...defaults.position }
}

function getFloatingDialogEl(): HTMLElement | null {
  return document.querySelector(".split-compare-panel--floating.mars-dialog") as HTMLElement | null
}

/** 同步浮动弹窗布局到 panelState（保留用户拉伸后的宽高） */
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
  const width = Math.max(FLOATING_PANEL_WIDTH, Number(panelState.width) || FLOATING_PANEL_WIDTH)
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

function updateMapSplitLayout() {
  const root = getMapRootEl()
  if (!root) {
    return
  }

  if (!dialogVisible.value) {
    cleanupMapSplitLayout()
    return
  }

  root.classList.add("split-compare-active")
  root.style.setProperty("--split-compare-position", `${sliderValue.value}%`)

  if (isBottomDocked.value) {
    root.classList.add("split-compare-dock-active")
    const dockEl = document.querySelector(".split-compare-panel--bottom-dock") as HTMLElement | null
    if (dockEl) {
      dockPanelHeight.value = dockEl.offsetHeight
      root.style.setProperty("--split-compare-dock-height", `${dockEl.offsetHeight}px`)
    }
  } else {
    root.classList.remove("split-compare-dock-active")
    root.style.setProperty("--split-compare-dock-height", "0px")
  }

  mapWork.setDualViewMode(true)
  applySplitPercent(sliderValue.value, false)
  mapWork.resizeMapView()
}

function bindDockResizeObserver() {
  unbindDockResizeObserver()
  if (!isBottomDocked.value || typeof ResizeObserver === "undefined") {
    return
  }
  const dockEl = document.querySelector(".split-compare-panel--bottom-dock") as HTMLElement | null
  if (!dockEl) {
    return
  }
  dockResizeObserver = new ResizeObserver(() => {
    updateMapSplitLayout()
  })
  dockResizeObserver.observe(dockEl)
}

function unbindDockResizeObserver() {
  dockResizeObserver?.disconnect()
  dockResizeObserver = null
}

function cleanupMapSplitLayout() {
  unbindDockResizeObserver()
  const root = getMapRootEl()
  root?.classList.remove("split-compare-active")
  root?.classList.remove("split-compare-dock-active")
  root?.style.removeProperty("--split-compare-position")
  root?.style.removeProperty("--split-compare-dock-height")
  mapWork.setDualViewMode(false)
  mapWork.resizeMapView()
}

function applySplitPercent(percent: number, persist = true) {
  const snapped = snapSplitValue(Math.round(percent))
  if (sliderValue.value !== snapped) {
    sliderValue.value = snapped
  }
  mapWork.setSplitPosition(snapped / 100)
  getMapRootEl()?.style.setProperty("--split-compare-position", `${snapped}%`)
  if (persist) {
    persistStateToStorage()
  }
}

function onDividerMouseDown(e: MouseEvent) {
  if (!dialogVisible.value) {
    return
  }
  isDraggingSplit.value = true
  updateSplitFromClientX(e.clientX)

  const onMove = (ev: MouseEvent) => {
    updateSplitFromClientX(ev.clientX)
  }
  const onUp = () => {
    isDraggingSplit.value = false
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
    persistStateToStorage()
  }
  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
}

function updateSplitFromClientX(clientX: number) {
  const overlay = mapOverlayEl.value || (document.querySelector(".split-compare-map-overlay") as HTMLElement | null)
  if (!overlay) {
    return
  }
  const rect = overlay.getBoundingClientRect()
  if (!rect.width) {
    return
  }
  const percent = ((clientX - rect.left) / rect.width) * 100
  applySplitPercent(percent, false)
}

function toggleLiveDemo() {
  if (isBottomDocked.value) {
    isBottomDocked.value = false
    if (savedFloatingPanel.value) {
      panelState.width = Math.max(FLOATING_PANEL_WIDTH, savedFloatingPanel.value.width)
      panelState.height = Math.max(FLOATING_PANEL_MIN_HEIGHT, savedFloatingPanel.value.height)
      panelState.position = { ...savedFloatingPanel.value.position }
    } else {
      applyCenteredLayout()
    }
    $message("已退出实时演示")
  } else {
    persistDialogBox()
    savedFloatingPanel.value = {
      width: Math.max(FLOATING_PANEL_WIDTH, Number(panelState.width) || FLOATING_PANEL_WIDTH),
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
    updateMapSplitLayout()
    bindDockResizeObserver()
  })
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
        syncFloatingDialogLayout()
        updateMapSplitLayout()
        bindDockResizeObserver()
      })
    }
  }
)

watch(dialogVisible, (value) => {
  emit("update:visible", value)
  if (value) {
    nextTick(() => {
      updateMapSplitLayout()
      bindDockResizeObserver()
    })
  } else {
    cleanupMapSplitLayout()
  }
})

watch(isBottomDocked, () => {
  nextTick(() => {
    updateMapSplitLayout()
    bindDockResizeObserver()
  })
})

watch(sliderValue, () => {
  if (dialogVisible.value) {
    applySplitPercent(sliderValue.value, false)
  }
})

onMounted(async () => {
  isBottomDocked.value = false
  applyFloatingPanelLayout()
  window.addEventListener("keydown", handleKeydown, true)
  window.addEventListener("ksh003:split-compare-error", handleSplitCompareError as any)
  bindPanelFrontListener()
  if (dialogVisible.value) {
    updateMapSplitLayout()
  }
  await loadCollections()
  await restoreStateFromStorage().catch(() => {})
  applyFloatingPanelLayout()
  nextTick(() => {
    if (dialogVisible.value) {
      updateMapSplitLayout()
    }
    bindDockResizeObserver()
  })
})

function bindPanelFrontListener() {
  const el = document.querySelector(".split-compare-panel") as HTMLElement | null
  el?.addEventListener("mousedown", notifyPanelFront, true)
}

function visualTileUrl(item: StacItem | undefined) {
  return String(item?.assets?.visual?.href || "")
}

async function fetchSplitItems(collectionId: string): Promise<StacItem[]> {
  if (collectionId.startsWith("local_")) {
    const result = await getItems(collectionId, { limit: 50 })
    const rows = result.success && Array.isArray(result.data) ? result.data : []
    return rows.filter((item) => visualTileUrl(item))
  }
  const result = await eoapiGet<StacItemsResponse>(`/collections/${collectionId}/items`, {
    params: { limit: 50 }
  })
  return result.success && result.data ? (result.data.features || []) : []
}

async function loadCollections() {
  loadingCollections.value = true
  try {
    const merged: StacCollection[] = []
    try {
      const result = await eoapiGet<StacCollectionsResponse>("/collections")
      if (result.success && result.data?.collections) {
        merged.push(...result.data.collections)
      }
    } catch (error) {
      console.error("[分屏对比] 加载远程数据集失败:", error)
    }
    const localIds = getLocalManifests()
      .map((item) => item.datasetId)
      .filter((id) => String(id || "").startsWith("local_"))
    for (const id of localIds) {
      const visuals = await fetchSplitItems(id)
      if (!visuals.length) {
        continue
      }
      const collection = await getCollection(id)
      if (collection.success && collection.data) {
        merged.push(collection.data)
      }
    }
    const seen = new Set<string>()
    collections.value = merged.filter((collection) => {
      const id = String(collection?.id || "")
      if (!id || seen.has(id)) {
        return false
      }
      seen.add(id)
      return true
    })
  } catch (error) {
    console.error("[分屏对比] 加载数据集失败:", error)
    $message(SPLIT_COMPARE_FAILURE_TEXT)
  } finally {
    loadingCollections.value = false
  }
}

async function handleLeftCollectionChange(collectionId: string | undefined) {
  leftItem.value = undefined
  leftItems.value = []

  if (!collectionId) {
    return
  }

  loadingLeftItems.value = true
  try {
    leftItems.value = await fetchSplitItems(collectionId)
  } catch (error) {
    console.error("[分屏对比] 加载左侧影像列表失败:", error)
    $message(SPLIT_COMPARE_FAILURE_TEXT)
  } finally {
    loadingLeftItems.value = false
  }
}

function handleLeftItemChange(itemId: string | undefined) {
  if (!itemId || !leftCollection.value) {
    return
  }
  if (isSameImageSelection(leftCollection.value, itemId, rightCollection.value, rightItem.value)) {
    $message(SPLIT_COMPARE_SAME_IMAGE_TEXT)
  }

  const tileUrl = visualTileUrl(leftItems.value.find((item) => item.id === itemId))
  const success = mapWork.loadLeftLayer(`${leftCollection.value}_${itemId}`, leftCollection.value, itemId, tileUrl || undefined)

  if (success) {
    $message(`左侧已加载: ${itemId}`)
    persistStateToStorage()
  } else {
    $message(SPLIT_COMPARE_FAILURE_TEXT)
  }
}

function handleLeftOpacityChange(value: number) {
  mapWork.setLayerOpacity("left", value / 100)
  persistStateToStorage()
}

async function handleRightCollectionChange(collectionId: string | undefined) {
  rightItem.value = undefined
  rightItems.value = []

  if (!collectionId) {
    return
  }

  loadingRightItems.value = true
  try {
    rightItems.value = await fetchSplitItems(collectionId)
  } catch (error) {
    console.error("[分屏对比] 加载右侧影像列表失败:", error)
    $message(SPLIT_COMPARE_FAILURE_TEXT)
  } finally {
    loadingRightItems.value = false
  }
}

function handleRightItemChange(itemId: string | undefined) {
  if (!itemId || !rightCollection.value) {
    return
  }
  if (isSameImageSelection(leftCollection.value, leftItem.value, rightCollection.value, itemId)) {
    $message(SPLIT_COMPARE_SAME_IMAGE_TEXT)
  }

  const tileUrl = visualTileUrl(rightItems.value.find((item) => item.id === itemId))
  const success = mapWork.loadRightLayer(`${rightCollection.value}_${itemId}`, rightCollection.value, itemId, tileUrl || undefined)

  if (success) {
    $message(`右侧已加载: ${itemId}`)
    persistStateToStorage()
  } else {
    $message(SPLIT_COMPARE_FAILURE_TEXT)
  }
}

function handleRightOpacityChange(value: number) {
  mapWork.setLayerOpacity("right", value / 100)
  persistStateToStorage()
}

function handleSliderChange(value: number) {
  applySplitPercent(value, true)
}

function snapSplitValue(value: number): number {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  const snapPoints = [0, 50, 100]
  for (const sp of snapPoints) {
    if (Math.abs(v - sp) <= 3) {
      return sp
    }
  }
  return v
}

function handleClear() {
  mapWork.clearCompareLayers()
  leftCollection.value = undefined
  leftItem.value = undefined
  leftItems.value = []
  rightCollection.value = undefined
  rightItem.value = undefined
  rightItems.value = []
  sliderValue.value = 50
  $message("已清除所有对比图层")
  persistStateToStorage()
}

function handleReset() {
  handleClear()
  leftOpacity.value = 100
  rightOpacity.value = 100
  if (!isBottomDocked.value) {
    applyFloatingPanelLayout()
  }
  persistStateToStorage()
  $message("已恢复默认设置")
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
  panelState.width = Math.max(FLOATING_PANEL_WIDTH, el.offsetWidth)
  panelState.height = Math.max(FLOATING_PANEL_MIN_HEIGHT, el.offsetHeight)
  panelState.position = {
    left: el.offsetLeft,
    top: el.offsetTop
  }
  persistStateToStorage()
}

function handleClose() {
  isBottomDocked.value = false
  cleanupMapSplitLayout()
  mapWork.clearCompareLayers()
  disable("split-screen-compare")
}

onUnmounted(() => {
  cleanupMapSplitLayout()
  mapWork.clearCompareLayers()
  window.removeEventListener("keydown", handleKeydown, true)
  window.removeEventListener("ksh003:split-compare-error", handleSplitCompareError as any)
  const el = document.querySelector(".split-compare-panel") as HTMLElement | null
  el?.removeEventListener("mousedown", notifyPanelFront, true)
})

function handleSplitCompareError(e: Event) {
  const detail = (e as CustomEvent).detail as any
  const side = String(detail?.side || "")
  if (side !== "left" && side !== "right") {
    return
  }
  if (side === "left") {
    leftItem.value = undefined
    mapWork.clearSideLayer("left")
  } else {
    rightItem.value = undefined
    mapWork.clearSideLayer("right")
  }
  persistStateToStorage()
  if (detail?.message) {
    console.error(`[分屏对比] ${side === "left" ? "左侧" : "右侧"}影像加载失败:`, detail.message)
  }
  $message(SPLIT_COMPARE_FAILURE_TEXT)
}

function notifyPanelFront() {
  if (typeof window === "undefined") {
    return
  }
  window.dispatchEvent(new CustomEvent("mars3d:widget-visible", { detail: { name: "split-screen-compare", visible: true } }))
}

function handleKeydown(e: KeyboardEvent) {
  if (!dialogVisible.value) {
    return
  }
  if (!e.altKey) {
    return
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault()
    applySplitPercent(sliderValue.value - 1, true)
    return
  }
  if (e.key === "ArrowRight") {
    e.preventDefault()
    applySplitPercent(sliderValue.value + 1, true)
  }
}

function persistStateToStorage() {
  try {
    const payload = {
      ts: Date.now(),
      sliderValue: sliderValue.value,
      leftCollection: leftCollection.value,
      leftItem: leftItem.value,
      leftOpacity: leftOpacity.value,
      rightCollection: rightCollection.value,
      rightItem: rightItem.value,
      rightOpacity: rightOpacity.value,
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

  // 布局不在冷启动时恢复，避免首次打开仍显示旧版弹窗尺寸/位置
  if (typeof parsed.sliderValue === "number") {
    sliderValue.value = snapSplitValue(parsed.sliderValue)
    mapWork.setSplitPosition(sliderValue.value / 100)
  }

  if (typeof parsed.leftOpacity === "number") {
    leftOpacity.value = parsed.leftOpacity
    mapWork.setLayerOpacity("left", leftOpacity.value / 100)
  }
  if (typeof parsed.rightOpacity === "number") {
    rightOpacity.value = parsed.rightOpacity
    mapWork.setLayerOpacity("right", rightOpacity.value / 100)
  }

  if (parsed.leftCollection) {
    leftCollection.value = parsed.leftCollection
    await handleLeftCollectionChange(parsed.leftCollection)
    if (parsed.leftItem) {
      leftItem.value = parsed.leftItem
      handleLeftItemChange(parsed.leftItem)
    }
  }
  if (parsed.rightCollection) {
    rightCollection.value = parsed.rightCollection
    await handleRightCollectionChange(parsed.rightCollection)
    if (parsed.rightItem) {
      rightItem.value = parsed.rightItem
      handleRightItemChange(parsed.rightItem)
    }
  }
}

defineExpose({
  loadLeftLayer: (collectionId: string, itemId: string) => {
    leftCollection.value = collectionId
    handleLeftCollectionChange(collectionId)
    leftItem.value = itemId
    handleLeftItemChange(itemId)
  },
  loadRightLayer: (collectionId: string, itemId: string) => {
    rightCollection.value = collectionId
    handleRightCollectionChange(collectionId)
    rightItem.value = itemId
    handleRightItemChange(itemId)
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
}

.shortcut-tip {
  display: grid;
  gap: 6px;
}

.panel-body {
  /* 左右 12px 与标题栏 --popup-header-padding 对齐；上下用 body token */
  padding: var(--popup-body-padding, 14px) 12px;
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.panel-body--dock {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-areas:
    "split split"
    "left right";
  gap: 8px;
  padding: 8px 12px !important;
  box-sizing: border-box;
  height: auto !important;
  overflow: visible;

  .split-slider-section {
    grid-area: split;
    margin-bottom: 0;
  }

  .layer-section--left {
    grid-area: left;
    margin-bottom: 0;
  }

  .layer-section--right {
    grid-area: right;
    margin-bottom: 0;
  }
}

.split-slider-section--dock {
  padding: 8px 10px;
  background: transparent;
  border: 1px solid var(--overlay-border);

  .slider-wrapper {
    gap: 8px;
  }

  .split-pos-label {
    font-size: 12px;
  }
}

.layer-section--dock {
  padding: 8px;
  background: transparent;
  border: 1px solid var(--overlay-border);

  .layer-control {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .layer-side-label {
    font-size: 12px;
  }

  .layer-opacity span {
    min-width: 44px;
  }
}

.split-slider-section {
  margin-bottom: 20px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--popup-item-radius, 8px);

  .slider-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;

    .split-pos-label {
      flex-shrink: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary, #fff);
      white-space: nowrap;
    }

    .label-left,
    .label-right {
      color: var(--text-secondary, #aaa);
      font-size: 12px;
      min-width: 20px;
      flex-shrink: 0;
    }

    .split-slider {
      flex: 1;
      min-width: 0;
    }
  }

  .slider-tip {
    color: var(--text-secondary, #888);
    font-size: 11px;
    margin-top: 5px;
    text-align: center;
  }
}

.layer-section {
  margin-bottom: 15px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--popup-item-radius, 8px);

  .layer-side-label {
    flex-shrink: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    white-space: nowrap;
  }

  .layer-control {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;

    :deep(.ant-select) {
      flex: 1;
      min-width: 0;
    }

    :deep(.split-compare-select) {
      .ant-select-selector {
        border-radius: var(--popup-item-radius, 8px);
      }

      .ant-select-selection-placeholder {
        color: rgba(255, 255, 255, 0.45);
        font-size: 14px;
      }

      .ant-select-selection-item {
        font-size: 14px;
      }
    }
  }

  .layer-opacity {
    display: flex;
    align-items: center;
    gap: 10px;

    span {
      color: var(--text-secondary, #aaa);
      font-size: 12px;
      min-width: 50px;
    }

    .mars-slider {
      flex: 1;
    }
  }
}

.tip-section {
  margin-top: 10px;

  :deep(.ant-alert) {
    background: rgba(52, 152, 219, 0.15);
    border-color: rgba(52, 152, 219, 0.3);
  }
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 4px 0;

  .status-text {
    color: var(--text-secondary, #aaa);
    font-size: 12px;
  }

  .dock-hint {
    color: var(--text-secondary, #888);
    font-size: 12px;
    white-space: nowrap;
  }
}
</style>

<style lang="less">
.split-compare-panel--floating.mars-dialog {
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
    /* 取消默认 content padding，改由 .panel-body 统一左右边距，避免叠加错位 */
    padding: 0 !important;
  }

  .mars-dialog__footer {
    padding-left: 12px !important;
    padding-right: 12px !important;
    box-sizing: border-box;
  }
}

.split-compare-panel--bottom-dock.mars-dialog {
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
    position: relative;
    cursor: default !important;
    background: var(--bg-overlay) !important;
    backdrop-filter: blur(var(--overlay-blur));
    -webkit-backdrop-filter: blur(var(--overlay-blur));
    border: 1px solid var(--overlay-border);
    border-bottom: none;
    box-shadow: var(--overlay-shadow);
    border-radius: var(--popup-radius, 8px) var(--popup-radius, 8px) 0 0;
  }

  /* 与原 .slider-tip--dock-top 字号/色号一致，仅改到标题栏水平居中 */
  .header-dock-tip {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    margin: 0;
    font-size: 11px;
    line-height: 1.3;
    color: var(--text-secondary, #888);
    white-space: nowrap;
    pointer-events: none;
    z-index: 1;
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

#mars-main-view.split-compare-active .centerDiv-container {
  position: relative;
  overflow: hidden;
}

#mars-main-view.split-compare-dock-active .centerDiv-container {
  box-sizing: border-box;
  padding-bottom: var(--split-compare-dock-height, 180px);
}

/* 双视图时状态条挂在公共父容器：全宽、压在左右视图之上，不随分屏比例变化 */
#mars-main-view.split-compare-active .centerDiv-container > .mars3d-locationbar.split-compare-locationbar {
  position: absolute !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  bottom: var(--split-compare-dock-height, 0px) !important;
  z-index: 9991 !important;
  box-sizing: border-box;
  pointer-events: none;
}

.split-compare-map-overlay {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: var(--split-compare-dock-height, 180px);
  pointer-events: none;
  z-index: 9990;

  &.split-compare-map-overlay--floating {
    bottom: 0;
  }

  .split-divider {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--split-compare-position, 50%);
    width: 10px;
    margin-left: -5px;
    cursor: col-resize;
    pointer-events: auto;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;

    &.is-dragging,
    &:hover {
      .split-divider-grip {
        background: var(--color-primary, #2d8cf0);
        box-shadow: 0 0 10px rgba(45, 140, 240, 0.55);
      }
    }
  }

  .split-divider-grip {
    display: block;
    width: 2px;
    height: 56px;
    max-height: 40%;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 0 6px rgba(45, 140, 240, 0.35);
    transition: background 0.15s ease, box-shadow 0.15s ease;
  }
}

@media (max-width: 960px) {
  .split-compare-panel--bottom-dock .panel-body--dock {
    grid-template-columns: 1fr;
    grid-template-areas:
      "split"
      "left"
      "right";
  }
}
</style>
