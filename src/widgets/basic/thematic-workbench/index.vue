<template>
  <mars-dialog
    ref="dialogRef"
    v-model:visible="dialogVisible"
    title="专题制图工作台"
    icon="workbench"
    custom-class="thematic-workbench-panel"
    :draggable="true"
    :width="dialogWidth"
    :height="620"
    :position="{ top: 60, right: 10 }"
    :beforeClose="handleBeforeClose"
    @closed="handleClose"
    @fold="handleFold"
  >
    <template #headerRight>
      <div class="header-actions">
        <span class="header-text-btn is-static" :title="sourceLabel">{{ sourceLabel }}</span>
        <button
          type="button"
          class="header-text-btn"
          :class="{ 'is-active': chartPanelVisible }"
          @mousedown.stop
          @click="startChartSelectionFlow"
        >
          图标展示
        </button>
        <button
          type="button"
          class="header-text-btn"
          :disabled="!isDirty"
          @mousedown.stop
          @click="saveDraft"
        >
          保存草稿
        </button>
        <button
          type="button"
          class="header-text-btn"
          @mousedown.stop
          @click="toggleWorkbenchFold"
        >
          {{ isFold ? "恢复" : "最小化" }}
        </button>
      </div>
    </template>

    <div class="workbench-shell" :class="{ 'has-chart-panel': chartPanelVisible }">
      <aside v-if="chartPanelVisible" class="chart-showcase-panel" :class="{ 'is-board-mode': chartViewMode === 'board' }">
        <div class="panel-section-head">
          <div class="panel-section-title">图标展示</div>
          <div class="panel-section-actions">
            <a-button
              type="text"
              size="small"
              class="board-mode-btn"
              :class="{ 'is-active': chartViewMode === 'board' }"
              title="画板展示"
              aria-label="画板展示"
              @click="toggleBoardMode"
            >
              <mars-icon icon="page-template" :width="16" />
            </a-button>
            <mars-button size="small" @click="() => addChart()">添加图表</mars-button>
          </div>
        </div>

        <div v-if="chartViewMode === 'list'" class="chart-list">
          <section class="chart-demo-section main-image-section">
            <div class="chart-demo-head">
              <div>
                <div class="chart-demo-title">主图</div>
                <div class="chart-demo-subtitle">截图生成主图，作为后续图表分析展示的第一张卡片</div>
              </div>
              <mars-button size="small" @click="generateMainImageDemo">生成主图</mars-button>
            </div>
            <div class="main-image-card">
              <div class="main-image-preview">
                <img v-if="mainImageUrl" :key="mainImageUrl" :src="mainImageUrl" alt="专题主图" class="main-image-tag" />
                <div v-else class="main-image-empty">点击“生成主图”后，将当前地图截图作为专题主图展示</div>
              </div>
              <div class="main-image-info">
                <div class="main-image-name">{{ mainImageTitle }}</div>
                <div class="main-image-meta">{{ mainImageMeta }}</div>
              </div>
            </div>
          </section>
          <div v-for="item in chartList" :key="item.id" class="chart-list-item">
            <div class="chart-list-item-head">
              <a-select
                v-model:value="item.type"
                class="chart-name-select"
                :aria-label="`${item.name}图表类型`"
                @change="(value: ChartType) => handleChartTypeChange(item.id, value)"
              >
                <a-select-option
                  v-for="opt in chartTypeOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}｜{{ opt.scene }}｜{{ opt.summary }}
                </a-select-option>
              </a-select>
              <button type="button" class="chart-list-item-remove" @click="removeChartItem(item.id)">移除</button>
            </div>
            <div :ref="(el) => bindChartEl(item.id, el as HTMLDivElement | null)" class="chart-list-item-canvas"></div>
          </div>
        </div>

        <div v-else class="chart-board">
          <div class="chart-board-toolbar">
            <span class="chart-board-hint">画板模式：拖拽图表移动，空白处平移，滚轮缩放</span>
            <div class="chart-board-right-actions">
              <div class="chart-board-dropdowns">
                <a-dropdown :trigger="['click']" placement="bottom">
                  <button type="button" class="chart-board-dropdown-btn">
                    <span>下载</span>
                    <mars-icon icon="down" :width="12" />
                  </button>
                  <template #overlay>
                    <a-menu @click="handleBoardDownloadMenu">
                      <a-menu-item key="view">下载当前视图</a-menu-item>
                      <a-menu-item key="board">下载画板</a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
                <a-dropdown :trigger="['click']" placement="bottom">
                  <button type="button" class="chart-board-dropdown-btn">
                    <span>画板尺寸</span>
                    <mars-icon icon="down" :width="12" />
                  </button>
                  <template #overlay>
                    <a-menu @click="handleBoardSizeMenu">
                      <a-menu-item key="1920x1080">1920*1080</a-menu-item>
                      <a-menu-item key="1080x1080">1080*1080</a-menu-item>
                      <a-menu-item key="custom">自定义</a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </div>
              <div class="chart-board-zoom">
                <button type="button" class="chart-board-zoom-btn" title="缩小" @click="zoomBoardOut">−</button>
                <span class="chart-board-zoom-label">{{ boardZoomLabel }}</span>
                <button type="button" class="chart-board-zoom-btn" title="放大" @click="zoomBoardIn">+</button>
                <button type="button" class="chart-board-zoom-btn chart-board-zoom-reset" @click="resetBoardZoom">重置</button>
              </div>
            </div>
          </div>
          <div
            ref="boardViewportRef"
            class="chart-board-viewport"
            :class="{ 'is-panning': isBoardPanning }"
            @mousedown="startBoardPan"
            @wheel.prevent="onBoardWheel"
          >
            <div
              class="chart-board-surface"
              :style="boardSurfaceStyle"
            >
              <div v-if="chartList.length === 0 && !mainImageUrl" class="chart-board-empty">
                画板为空，点击「添加图表」后可在此自由排布
              </div>
              <div
                v-if="mainImageUrl"
                class="chart-board-card chart-board-main-image-card"
                :style="{
                  left: `${BOARD_PAD}px`,
                  top: `${BOARD_PAD}px`,
                  width: `${BOARD_CARD_WIDTH * 2 + BOARD_GAP}px`,
                  height: `${BOARD_CARD_HEIGHT + 68}px`
                }"
              >
                <div class="chart-list-item-head">
                  <div class="chart-board-main-image-title">专题主图</div>
                </div>
                <div class="chart-board-main-image-body">
                  <img :key="`board_${mainImageUrl}`" :src="mainImageUrl" alt="专题主图" class="chart-board-main-image-tag" />
                </div>
              </div>
              <div
                v-for="item in chartList"
                :key="item.id"
                class="chart-board-card"
                :class="{ 'is-dragging': draggingChartId === item.id }"
                :style="getBoardCardStyle(item)"
                @mousedown.stop="startBoardDrag(item, $event)"
              >
                <div class="chart-list-item-head">
                  <a-select
                    v-model:value="item.type"
                    class="chart-name-select"
                    :aria-label="`${item.name}图表类型`"
                    @mousedown.stop
                    @change="(value: ChartType) => handleChartTypeChange(item.id, value)"
                  >
                    <a-select-option
                      v-for="opt in chartTypeOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}｜{{ opt.scene }}｜{{ opt.summary }}
                    </a-select-option>
                  </a-select>
                  <button type="button" class="chart-list-item-remove" @mousedown.stop @click="removeChartItem(item.id)">移除</button>
                </div>
                <div :ref="(el) => bindChartEl(item.id, el as HTMLDivElement | null)" class="chart-list-item-canvas chart-board-card-canvas"></div>
                <div
                  v-for="handle in boardResizeHandles"
                  :key="handle"
                  class="chart-board-handle"
                  :class="`is-${handle}`"
                  :title="isCornerHandle(handle) ? '四角等比缩放' : '边侧缩放'"
                  @mousedown.stop="startBoardResize(item, handle, $event)"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div class="thematic-panel" @mousedown="notifyPanelFront">
      <div class="panel-section-head thematic-panel-head">
        <div class="panel-section-title">专题制图</div>
      </div>

      <div class="thematic-panel-body">
      <div class="context-bar">
        <div class="context-main">
          <div class="context-title">专题图制图台</div>
          <div class="context-desc">{{ contextDesc }}</div>
        </div>
        <div class="context-actions">
          <mars-button size="small" @click="loadTemplates" :disabled="loadingTemplates">刷新模板</mars-button>
          <mars-button size="small" @click="switchToPublish">进入发布</mars-button>
        </div>
      </div>

      <div v-if="effectiveDatasetId" class="dataset-bar">
        <span class="dataset-bar-label">数据集</span>
        <span class="dataset-bar-value">{{ effectiveDatasetName }}</span>
      </div>

      <a-alert
        v-if="!effectiveDatasetId"
        type="warning"
        show-icon
        message="当前未绑定数据集"
        description="可先从数据集详情或当前任务进入专题制图工作台，发布页会自动带入当前数据集。"
      />
      <div v-else-if="isDirty" class="workbench-tip-section">
        <a-alert type="info" show-icon>
          <template #message>存在未保存编辑内容</template>
          <template #description>关闭面板或离开编辑页时会提示确认，建议先保存草稿。</template>
        </a-alert>
      </div>

      <a-tabs :active-key="activeTab" class="workbench-tabs" @change="handleTabChange">
        <a-tab-pane key="template" tab="模板库">
          <div class="template-toolbar">
            <span class="section-tip">选择模板后自动带入编辑页，可继续调整标题、图例与发布信息。</span>
          </div>
          <a-empty v-if="!loadingTemplates && templates.length === 0" description="暂无模板" />
          <div v-else class="template-grid">
            <button
              v-for="tpl in templates"
              :key="tpl.templateId"
              class="template-card"
              :class="{ active: draft.templateId === tpl.templateId }"
              type="button"
              @click="selectTemplate(tpl)"
            >
              <div class="template-name">{{ tpl.name || tpl.templateId }}</div>
              <div class="template-version">v{{ tpl.templateVersion || "1.0" }}</div>
              <div class="template-desc">{{ tpl.description || "专题图模板" }}</div>
              <div class="template-action">使用此模板</div>
            </button>
          </div>
        </a-tab-pane>

        <a-tab-pane key="editor" tab="编辑">
          <div class="editor-layout">
            <div class="editor-form">
              <a-form layout="vertical">
                <a-form-item label="模板">
                  <a-input :value="draft.templateName || '未选择模板'" disabled />
                </a-form-item>
                <a-form-item label="专题标题">
                  <a-input v-model:value="draft.title" placeholder="请输入专题标题" />
                </a-form-item>
                <a-form-item label="副标题">
                  <a-input v-model:value="draft.subtitle" placeholder="请输入副标题" />
                </a-form-item>
                <a-form-item label="图例标题">
                  <a-input v-model:value="draft.legendTitle" placeholder="请输入图例标题" />
                </a-form-item>
                <a-form-item label="配色方案">
                  <a-select v-model:value="draft.palette">
                    <a-select-option value="blue-red">蓝红渐变</a-select-option>
                    <a-select-option value="green-yellow">绿黄渐变</a-select-option>
                    <a-select-option value="purple-orange">紫橙渐变</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item label="专题说明">
                  <a-textarea v-model:value="draft.notes" :rows="5" placeholder="记录业务口径、专题说明或图层备注" />
                </a-form-item>
              </a-form>
            </div>

            <div class="editor-side">
              <div class="preview-card">
                <div class="preview-title">{{ draft.title || "未命名专题图" }}</div>
                <div class="preview-subtitle">{{ draft.subtitle || "请在左侧补充副标题" }}</div>
                <div class="preview-palette">
                  <span class="palette-title">{{ draft.legendTitle || "图例" }}</span>
                  <div class="palette-strip" :class="`palette-${draft.palette}`"></div>
                </div>
                <div class="preview-note">{{ draft.notes || "这里显示专题说明预览。" }}</div>
              </div>

              <div class="editor-actions">
                <mars-button size="small" @click="resetDraft">恢复上次草稿</mars-button>
                <mars-button size="small" type="primary" :disabled="!draft.templateId" @click="saveDraft">保存草稿</mars-button>
                <mars-button size="small" @click="switchToPublish">进入发布</mars-button>
              </div>
            </div>
          </div>
        </a-tab-pane>

        <a-tab-pane key="publish" tab="发布">
          <div class="publish-summary">
            <div class="summary-card">
              <div class="summary-title">发布摘要</div>
              <div class="summary-item"><span>数据集</span><strong>{{ effectiveDatasetName }}</strong></div>
              <div class="summary-item"><span>模板</span><strong>{{ draft.templateName || "未选择" }}</strong></div>
              <div class="summary-item"><span>标题</span><strong>{{ draft.title || "未填写" }}</strong></div>
              <div class="summary-item"><span>状态</span><strong>{{ isDirty ? "草稿未保存" : "草稿已保存" }}</strong></div>
            </div>
            <div class="summary-card">
              <div class="summary-title">发布说明</div>
              <a-form layout="vertical">
                <a-form-item label="发布名称">
                  <a-input v-model:value="draft.publishName" placeholder="请输入发布名称" />
                </a-form-item>
                <a-form-item label="发布备注">
                  <a-textarea v-model:value="draft.publishDesc" :rows="3" placeholder="请输入发布说明" />
                </a-form-item>
              </a-form>
            </div>
          </div>

          <div class="publish-body">
            <ThematicJobs :dataset-id="effectiveDatasetId || undefined" />
          </div>
        </a-tab-pane>
      </a-tabs>
      </div>
      </div>
    </div>
  </mars-dialog>

  <a-modal
    v-model:open="showCustomBoardSize"
    title="自定义画板尺寸"
    ok-text="应用"
    cancel-text="取消"
    :confirm-loading="false"
    @ok="applyCustomBoardSize"
  >
    <div class="board-size-form">
      <label class="board-size-field">
        <span>宽度</span>
        <a-input-number v-model:value="customBoardWidth" :min="640" :max="7680" :step="10" />
      </label>
      <label class="board-size-field">
        <span>高度</span>
        <a-input-number v-model:value="customBoardHeight" :min="480" :max="4320" :step="10" />
      </label>
    </div>
  </a-modal>

  <div
    v-if="selectionToolbarVisible"
    class="selection-confirm-toolbar"
    :style="selectionToolbarStyle"
  >
    <button type="button" class="selection-confirm-btn is-confirm" @click="confirmRectangleSelection">√</button>
    <button type="button" class="selection-confirm-btn is-cancel" @click="redrawRectangleSelection">×</button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue"
import * as echarts from "echarts"
import { $message } from "@mars/components/mars-ui/index"
import { useWidget } from "@mars/common/store/widget"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import { getCurrentDataset, onCurrentDatasetChange, type CurrentDataset } from "@/shell/currentDataset"
import { getTemplates } from "../dataset-repository/services/eoapi-thematics"
import type { ThematicTemplate } from "../dataset-repository/types/eoapi-types"
import ThematicJobs from "../dataset-repository/components/ThematicJobs.vue"
import * as mapWork from "./map"
import { captureCoverImage } from "../dataset-repository/map"

useLifecycle(mapWork)

type WorkbenchTab = "template" | "editor" | "publish"
type ChartType = "heatmap" | "population-distribution" | "terrain-density" | "contour" | "deformation-bar" | "trend-line"
type ChartViewMode = "list" | "board"

type ChartListItem = {
  id: string
  type: ChartType
  name: string
  x: number
  y: number
  w: number
  h: number
}

type ChartTypeMeta = {
  label: string
  value: ChartType
  scene: string
  summary: string
}

const BASE_DIALOG_WIDTH = 480
const SHELL_GAP = 12
const BOARD_CARD_WIDTH = 340
const BOARD_CARD_HEIGHT = 280
const BOARD_GAP = 16
const BOARD_PAD = 24
const BOARD_SCALE_MIN = 0.5
const BOARD_SCALE_MAX = 1.8
const BOARD_SCALE_STEP = 0.1
const DEFAULT_BOARD_WIDTH = 1920
const DEFAULT_BOARD_HEIGHT = 1080
const BOARD_CARD_HEAD_HEIGHT = 40
const BOARD_CARD_PADDING = 10
const BOARD_CARD_GAP = 8
const BOARD_CARD_MIN_WIDTH = 240
const BOARD_CARD_MIN_HEIGHT = 200
const BOARD_CARD_MAX_WIDTH = 720
const BOARD_CARD_MAX_HEIGHT = 640
const BOARD_SNAP_THRESHOLD = 8

type BoardResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"
type BoardRect = { x: number; y: number; w: number; h: number }

const boardResizeHandles: BoardResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]

const chartTypeOptions: ChartTypeMeta[] = [
  { label: "地域热点热力图", value: "heatmap", scene: "异常区域筛查", summary: "展示主图范围内热点强弱、风险升温和重点区域聚集情况。" },
  { label: "区域分级对比图", value: "population-distribution", scene: "行政分区对比", summary: "展示核心区、缓冲区、外围区等不同地域单元的指标对比。" },
  { label: "点位密度分布图", value: "terrain-density", scene: "目标聚集分析", summary: "展示监测点、设施点、隐患点在主图范围内的密度和分布。" },
  { label: "剖面等值变化图", value: "contour", scene: "连续面剖析", summary: "展示高程、强度、形变量等连续数值在地域内的变化。" },
  { label: "等级统计柱状图", value: "deformation-bar", scene: "风险等级评估", summary: "展示形变等级、风险等级、告警等级等分类统计结果。" },
  { label: "多期趋势分析图", value: "trend-line", scene: "时序变化追踪", summary: "展示同一区域在多时段下的变化趋势和对比关系。" }
]

const DEFAULT_CHART_TYPE: ChartType = "heatmap"

type DraftState = {
  templateId: string
  templateName: string
  title: string
  subtitle: string
  legendTitle: string
  palette: string
  notes: string
  publishName: string
  publishDesc: string
}

const props = withDefaults(defineProps<{
  visible?: boolean
  datasetId?: string
  datasetName?: string
  source?: string
  targetName?: string
  initialTab?: WorkbenchTab
}>(), {
  visible: true,
  source: "toolbar",
  targetName: "",
  initialTab: "template"
})

const emit = defineEmits(["update:visible"])

const { disable } = useWidget()
const dialogRef = ref<any>(null)
const dialogVisible = ref(!!props.visible)
const isFold = ref(false)
const loadingTemplates = ref(false)
const templates = ref<ThematicTemplate[]>([])
const activeTab = ref<WorkbenchTab>(props.initialTab)
const chartPanelVisible = ref(false)
const chartViewMode = ref<ChartViewMode>("list")
const chartList = ref<ChartListItem[]>([])
const mainImageUrl = ref("")
const mainImageTitle = ref("专题主图")
const mainImageMeta = ref("未生成主图")
const selectionToolbarVisible = ref(false)
const selectionToolbarLeft = ref(0)
const selectionToolbarTop = ref(0)
const selectionAreaText = ref("未框选区域")
const chartElMap = new Map<string, HTMLDivElement>()
const chartInstanceMap = new Map<string, echarts.ECharts>()
const boardScale = ref(1)
const boardWidth = ref(DEFAULT_BOARD_WIDTH)
const boardHeight = ref(DEFAULT_BOARD_HEIGHT)
const boardViewportRef = ref<HTMLDivElement | null>(null)
const isBoardPanning = ref(false)
const draggingChartId = ref<string | null>(null)
const showCustomBoardSize = ref(false)
const customBoardWidth = ref(DEFAULT_BOARD_WIDTH)
const customBoardHeight = ref(DEFAULT_BOARD_HEIGHT)
const currentDataset = ref<CurrentDataset | null>(getCurrentDataset())
const savedDraftJson = ref("")

const draft = reactive<DraftState>(createEmptyDraft())

let disposeDatasetWatch: null | (() => void) = null
let panelMouseDownHandler: null | ((evt: Event) => void) = null
let widgetVisibleHandler: null | ((evt: Event) => void) = null
let boardDragCleanup: null | (() => void) = null

const effectiveDatasetId = computed(() => String(props.datasetId || currentDataset.value?.datasetId || ""))
const effectiveDatasetName = computed(() => String(props.datasetName || currentDataset.value?.name || effectiveDatasetId.value || "当前数据集"))
const dialogWidth = computed(() => (
  chartPanelVisible.value ? BASE_DIALOG_WIDTH * 3 + SHELL_GAP : BASE_DIALOG_WIDTH
))
const boardZoomLabel = computed(() => `${Math.round(boardScale.value * 100)}%`)
const selectionToolbarStyle = computed(() => ({
  left: `${selectionToolbarLeft.value}px`,
  top: `${selectionToolbarTop.value}px`
}))
const boardSurfaceStyle = computed(() => ({
  width: `${boardWidth.value}px`,
  height: `${boardHeight.value}px`,
  transform: `scale(${boardScale.value})`,
  transformOrigin: "0 0"
}))
const sourceLabel = computed(() => {
  if (props.source === "dataset-detail") {
    return "数据集详情入口"
  }
  if (props.source === "context-menu") {
    return "地图右键入口"
  }
  if (props.source === "sidebar") {
    return "左侧工具栏入口"
  }
  return "工具栏入口"
})
const contextDesc = computed(() => {
  const target = String(props.targetName || "").trim()
  if (target) {
    return `${sourceLabel.value}已进入制图台，当前目标：${target}`
  }
  return `${sourceLabel.value}已进入制图台，可在模板库、编辑、发布三个阶段持续操作`
})
const isDirty = computed(() => JSON.stringify(snapshotDraft()) !== savedDraftJson.value)

watch(
  () => props.visible,
  (value) => {
    dialogVisible.value = !!value
  }
)

watch(dialogVisible, (value) => {
  emit("update:visible", value)
  if (!value) {
    chartPanelVisible.value = false
    clearChartPanelState()
  }
})

watch(chartPanelVisible, (visible) => {
  if (visible) {
    nextTick(() => {
      renderAllCharts()
    })
  } else {
    clearChartPanelState()
  }
})

watch(
  () => [effectiveDatasetId.value, effectiveDatasetName.value],
  () => {
    loadDraft()
  },
  { immediate: true }
)

onMounted(() => {
  loadTemplates()
  mapWork.eventTarget.on("selectionCreated", handleSelectionCreated)
  mapWork.eventTarget.on("selectionConfirmed", handleSelectionConfirmed)
  mapWork.eventTarget.on("selectionCanceled", handleSelectionCanceled)
  mapWork.eventTarget.on("selectionHint", handleSelectionHint)
  disposeDatasetWatch = onCurrentDatasetChange((dataset) => {
    currentDataset.value = dataset
  })
  const panel = document.querySelector(".thematic-workbench-panel") as HTMLElement | null
  if (panel) {
    panelMouseDownHandler = () => notifyPanelFront()
    panel.addEventListener("mousedown", panelMouseDownHandler, true)
  }
  widgetVisibleHandler = (evt: Event) => {
    const detail = (evt as CustomEvent).detail as any
    const name = String(detail?.name || "")
    const visible = !!detail?.visible
    if (!visible || name === "thematic-workbench" || !dialogVisible.value || isFold.value) {
      return
    }
    dialogRef.value?.fold?.()
  }
  window.addEventListener("mars3d:widget-visible", widgetVisibleHandler as EventListener)
  notifyPanelFront()
})

onUnmounted(() => {
  mapWork.eventTarget.off("selectionCreated", handleSelectionCreated)
  mapWork.eventTarget.off("selectionConfirmed", handleSelectionConfirmed)
  mapWork.eventTarget.off("selectionCanceled", handleSelectionCanceled)
  mapWork.eventTarget.off("selectionHint", handleSelectionHint)
  disposeDatasetWatch?.()
  disposeDatasetWatch = null
  boardDragCleanup?.()
  boardDragCleanup = null
  clearChartPanelState()
  const panel = document.querySelector(".thematic-workbench-panel") as HTMLElement | null
  if (panel && panelMouseDownHandler) {
    panel.removeEventListener("mousedown", panelMouseDownHandler, true)
  }
  panelMouseDownHandler = null
  if (widgetVisibleHandler) {
    window.removeEventListener("mars3d:widget-visible", widgetVisibleHandler as EventListener)
  }
  widgetVisibleHandler = null
})

function createEmptyDraft(): DraftState {
  return {
    templateId: "",
    templateName: "",
    title: "",
    subtitle: "",
    legendTitle: "形变强度",
    palette: "blue-red",
    notes: "",
    publishName: "",
    publishDesc: ""
  }
}

function snapshotDraft(): DraftState {
  return {
    templateId: draft.templateId,
    templateName: draft.templateName,
    title: draft.title,
    subtitle: draft.subtitle,
    legendTitle: draft.legendTitle,
    palette: draft.palette,
    notes: draft.notes,
    publishName: draft.publishName,
    publishDesc: draft.publishDesc
  }
}

function applyDraft(next: DraftState) {
  draft.templateId = next.templateId
  draft.templateName = next.templateName
  draft.title = next.title
  draft.subtitle = next.subtitle
  draft.legendTitle = next.legendTitle
  draft.palette = next.palette
  draft.notes = next.notes
  draft.publishName = next.publishName
  draft.publishDesc = next.publishDesc
}

function getDraftStorageKey() {
  return `mars3d_thematic_workbench_draft_v1_${effectiveDatasetId.value || "global"}`
}

function buildDefaultDraft(): DraftState {
  const base = createEmptyDraft()
  base.title = effectiveDatasetName.value ? `${effectiveDatasetName.value}专题图` : ""
  base.publishName = effectiveDatasetName.value ? `${effectiveDatasetName.value}-专题成果` : ""
  return base
}

function loadDraft() {
  const fallback = buildDefaultDraft()
  try {
    const raw = localStorage.getItem(getDraftStorageKey()) || ""
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DraftState>
      applyDraft({
        ...fallback,
        ...parsed
      })
    } else {
      applyDraft(fallback)
    }
  } catch {
    applyDraft(fallback)
  }
  savedDraftJson.value = JSON.stringify(snapshotDraft())
}

async function loadTemplates() {
  loadingTemplates.value = true
  try {
    const result = await getTemplates({ limit: 24 })
    templates.value = result.success && result.data ? result.data.templates || [] : []
  } finally {
    loadingTemplates.value = false
  }
}

function selectTemplate(template: ThematicTemplate) {
  draft.templateId = template.templateId
  draft.templateName = template.name || template.templateId
  if (!draft.title || draft.title === `${effectiveDatasetName.value}专题图`) {
    draft.title = `${draft.templateName} - ${effectiveDatasetName.value}`
  }
  if (!draft.publishName || draft.publishName === `${effectiveDatasetName.value}-专题成果`) {
    draft.publishName = `${effectiveDatasetName.value}-${draft.templateName}`
  }
  activeTab.value = "editor"
  $message("模板已带入编辑页", "success")
}

function startChartSelectionFlow() {
  selectionToolbarVisible.value = false
  chartPanelVisible.value = false
  dialogVisible.value = false
  mainImageMeta.value = "请在地图上双击一次确定起点，再双击一次确定终点，完成矩形主图框选"
  mapWork.beginRectangleSelection()
}

function openChartPanel() {
  chartPanelVisible.value = true
  dialogVisible.value = true
  nextTick(() => {
    ensureDemoContent()
    renderAllCharts()
  })
}

function handleSelectionCreated(event: any) {
  const anchor = event?.anchor || {}
  selectionToolbarLeft.value = Number(anchor.left || window.innerWidth / 2)
  selectionToolbarTop.value = Number(anchor.top || window.innerHeight - 80)
  selectionToolbarVisible.value = true
  mainImageMeta.value = "已完成主图范围框选，待确认"
}

function handleSelectionHint() {
  mainImageMeta.value = "已记录矩形起点，请再次双击确定终点"
}

async function handleSelectionConfirmed(event: any) {
  const rectangle = event?.rectangle || {}
  const west = Number(rectangle.west || 0).toFixed(4)
  const south = Number(rectangle.south || 0).toFixed(4)
  const east = Number(rectangle.east || 0).toFixed(4)
  const north = Number(rectangle.north || 0).toFixed(4)
  selectionAreaText.value = `框选范围：西${west} / 南${south} / 东${east} / 北${north}`
  mainImageMeta.value = selectionAreaText.value
  selectionToolbarVisible.value = false
  try {
    const blob = await mapWork.captureSelectionImage({
      targetWidth: 1280,
      targetHeight: 720,
      mime: "image/jpeg",
      quality: 0.9
    })
    if (blob && blob.size > 0) {
      if (mainImageUrl.value) {
        URL.revokeObjectURL(mainImageUrl.value)
      }
      mainImageUrl.value = URL.createObjectURL(blob)
      mainImageMeta.value = `${selectionAreaText.value} · ${new Date().toLocaleString()}`
    } else {
      await generateMainImageDemo()
    }
  } catch {
    await generateMainImageDemo()
  } finally {
    openChartPanel()
  }
}

function handleSelectionCanceled() {
  selectionToolbarVisible.value = false
  dialogVisible.value = true
}

function confirmRectangleSelection() {
  mapWork.confirmRectangleSelection()
}

function redrawRectangleSelection() {
  selectionToolbarVisible.value = false
  mainImageMeta.value = "已取消当前框选，请重新绘制主图范围"
  mapWork.redrawRectangleSelection()
}

function ensureDemoContent() {
  if (!mainImageUrl.value) {
    generateMainImageDemo().catch(() => {})
  }
  if (chartList.value.length === 0) {
    addChart(chartTypeOptions[0]?.value || DEFAULT_CHART_TYPE)
  }
}

function getChartTypeLabel(type: ChartType): string {
  return chartTypeOptions.find((item) => item.value === type)?.label || type
}

function buildChartName(type: ChartType, index = 1): string {
  const label = getChartTypeLabel(type)
  return index > 1 ? `${label} ${index}` : label
}

function getBoardSlot(index: number) {
  const cols = 2
  const col = index % cols
  const row = Math.floor(index / cols)
  const startY = mainImageUrl.value ? BOARD_PAD + BOARD_CARD_HEIGHT + BOARD_GAP + 84 : BOARD_PAD
  return {
    x: BOARD_PAD + col * (BOARD_CARD_WIDTH + BOARD_GAP),
    y: startY + row * (BOARD_CARD_HEIGHT + BOARD_GAP),
    w: BOARD_CARD_WIDTH,
    h: BOARD_CARD_HEIGHT
  }
}

function layoutChartsOnBoard() {
  chartList.value.forEach((item, index) => {
    const slot = getBoardSlot(index)
    item.x = slot.x
    item.y = slot.y
    item.w = slot.w
    item.h = slot.h
  })
}

function getBoardCardStyle(item: ChartListItem) {
  return {
    left: `${item.x}px`,
    top: `${item.y}px`,
    width: `${item.w}px`,
    height: `${item.h}px`
  }
}

function clampBoardScale(value: number) {
  return Math.min(BOARD_SCALE_MAX, Math.max(BOARD_SCALE_MIN, Number(value.toFixed(2))))
}

function setBoardScale(value: number) {
  boardScale.value = clampBoardScale(value)
  nextTick(() => {
    renderAllCharts()
  })
}

function zoomBoardIn() {
  setBoardScale(boardScale.value + BOARD_SCALE_STEP)
}

function zoomBoardOut() {
  setBoardScale(boardScale.value - BOARD_SCALE_STEP)
}

function resetBoardZoom() {
  setBoardScale(1)
}

function onBoardWheel(event: WheelEvent) {
  const delta = event.deltaY > 0 ? -BOARD_SCALE_STEP : BOARD_SCALE_STEP
  setBoardScale(boardScale.value + delta)
}

function toggleBoardMode() {
  if (chartViewMode.value === "board") {
    chartViewMode.value = "list"
    nextTick(() => {
      renderAllCharts()
    })
    return
  }

  chartViewMode.value = "board"
  layoutChartsOnBoard()
  nextTick(() => {
    renderAllCharts()
  })
}

function startBoardPan(event: MouseEvent) {
  if (event.button !== 0) {
    return
  }

  const target = event.target as HTMLElement | null
  if (target?.closest(".chart-board-card, .chart-list-item-remove, .chart-name-select, .ant-select, .chart-board-handle")) {
    return
  }

  const viewport = boardViewportRef.value
  if (!viewport) {
    return
  }

  event.preventDefault()
  boardDragCleanup?.()

  const startX = event.clientX
  const startY = event.clientY
  const originLeft = viewport.scrollLeft
  const originTop = viewport.scrollTop
  isBoardPanning.value = true

  const onMove = (moveEvent: MouseEvent) => {
    viewport.scrollLeft = originLeft - (moveEvent.clientX - startX)
    viewport.scrollTop = originTop - (moveEvent.clientY - startY)
  }

  const onUp = () => {
    isBoardPanning.value = false
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
    boardDragCleanup = null
  }

  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
  boardDragCleanup = onUp
}

function isCornerHandle(handle: BoardResizeHandle) {
  return handle === "nw" || handle === "ne" || handle === "se" || handle === "sw"
}

function clampBoardRect(rect: BoardRect): BoardRect {
  const w = Math.max(BOARD_CARD_MIN_WIDTH, Math.min(BOARD_CARD_MAX_WIDTH, rect.w))
  const h = Math.max(BOARD_CARD_MIN_HEIGHT, Math.min(BOARD_CARD_MAX_HEIGHT, rect.h))
  const x = Math.max(0, Math.min(boardWidth.value - w, rect.x))
  const y = Math.max(0, Math.min(boardHeight.value - h, rect.y))
  return { x, y, w, h }
}

function snapBoardValue(value: number, targets: number[], threshold = BOARD_SNAP_THRESHOLD) {
  let bestAbs = threshold + 1
  let snapped = value
  targets.forEach((target) => {
    const delta = target - value
    const abs = Math.abs(delta)
    if (abs <= threshold && abs < bestAbs) {
      bestAbs = abs
      snapped = target
    }
  })
  return snapped
}

function collectEdgeTargets(excludeId: string) {
  const lefts: number[] = [0]
  const rights: number[] = [boardWidth.value]
  const tops: number[] = [0]
  const bottoms: number[] = [boardHeight.value]

  chartList.value.forEach((other) => {
    if (other.id === excludeId) {
      return
    }
    lefts.push(other.x, other.x + other.w)
    rights.push(other.x, other.x + other.w)
    tops.push(other.y, other.y + other.h)
    bottoms.push(other.y, other.y + other.h)
  })

  return { lefts, rights, tops, bottoms }
}

function snapBoardMoveRect(rect: BoardRect, excludeId: string): BoardRect {
  const { lefts, rights, tops, bottoms } = collectEdgeTargets(excludeId)
  const left = snapBoardValue(rect.x, lefts)
  const right = snapBoardValue(rect.x + rect.w, rights)
  const top = snapBoardValue(rect.y, tops)
  const bottom = snapBoardValue(rect.y + rect.h, bottoms)

  let x = rect.x
  let y = rect.y

  const leftDelta = Math.abs(left - rect.x)
  const rightDelta = Math.abs(right - (rect.x + rect.w))
  if (leftDelta <= BOARD_SNAP_THRESHOLD || rightDelta <= BOARD_SNAP_THRESHOLD) {
    x = leftDelta <= rightDelta ? left : right - rect.w
  }

  const topDelta = Math.abs(top - rect.y)
  const bottomDelta = Math.abs(bottom - (rect.y + rect.h))
  if (topDelta <= BOARD_SNAP_THRESHOLD || bottomDelta <= BOARD_SNAP_THRESHOLD) {
    y = topDelta <= bottomDelta ? top : bottom - rect.h
  }

  return clampBoardRect({ ...rect, x, y })
}

function snapBoardResizeRect(rect: BoardRect, handle: BoardResizeHandle, excludeId: string): BoardRect {
  const { lefts, rights, tops, bottoms } = collectEdgeTargets(excludeId)
  let { x, y, w, h } = rect

  if (handle.includes("w")) {
    const snappedLeft = snapBoardValue(x, lefts)
    w = Math.max(BOARD_CARD_MIN_WIDTH, w + (x - snappedLeft))
    x = snappedLeft
  }
  if (handle.includes("e")) {
    const snappedRight = snapBoardValue(x + w, rights)
    w = Math.max(BOARD_CARD_MIN_WIDTH, snappedRight - x)
  }
  if (handle.includes("n")) {
    const snappedTop = snapBoardValue(y, tops)
    h = Math.max(BOARD_CARD_MIN_HEIGHT, h + (y - snappedTop))
    y = snappedTop
  }
  if (handle.includes("s")) {
    const snappedBottom = snapBoardValue(y + h, bottoms)
    h = Math.max(BOARD_CARD_MIN_HEIGHT, snappedBottom - y)
  }

  return clampBoardRect({ x, y, w, h })
}

function applyBoardRect(item: ChartListItem, rect: BoardRect) {
  item.x = rect.x
  item.y = rect.y
  item.w = rect.w
  item.h = rect.h
}

function startBoardDrag(item: ChartListItem, event: MouseEvent) {
  if (event.button !== 0) {
    return
  }

  const target = event.target as HTMLElement | null
  if (target?.closest(".chart-list-item-remove, .chart-name-select, .ant-select, .chart-board-handle")) {
    return
  }

  event.preventDefault()
  boardDragCleanup?.()

  const startX = event.clientX
  const startY = event.clientY
  const originX = item.x
  const originY = item.y
  draggingChartId.value = item.id
  isBoardPanning.value = false

  const onMove = (moveEvent: MouseEvent) => {
    const dx = (moveEvent.clientX - startX) / boardScale.value
    const dy = (moveEvent.clientY - startY) / boardScale.value
    const next = snapBoardMoveRect(
      {
        x: originX + dx,
        y: originY + dy,
        w: item.w,
        h: item.h
      },
      item.id
    )
    applyBoardRect(item, next)
  }

  const onUp = () => {
    draggingChartId.value = null
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
    boardDragCleanup = null
  }

  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
  boardDragCleanup = onUp
}

function startBoardResize(item: ChartListItem, handle: BoardResizeHandle, event: MouseEvent) {
  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  boardDragCleanup?.()

  const startX = event.clientX
  const startY = event.clientY
  const origin: BoardRect = { x: item.x, y: item.y, w: item.w, h: item.h }
  const aspect = origin.w / Math.max(1, origin.h)
  draggingChartId.value = item.id
  isBoardPanning.value = false

  const onMove = (moveEvent: MouseEvent) => {
    const dx = (moveEvent.clientX - startX) / boardScale.value
    const dy = (moveEvent.clientY - startY) / boardScale.value
    let next: BoardRect = { ...origin }

    if (isCornerHandle(handle)) {
      if (handle === "se") {
        if (Math.abs(dx) >= Math.abs(dy)) {
          next.w = origin.w + dx
          next.h = next.w / aspect
        } else {
          next.h = origin.h + dy
          next.w = next.h * aspect
        }
      } else if (handle === "sw") {
        if (Math.abs(dx) >= Math.abs(dy)) {
          next.w = origin.w - dx
          next.h = next.w / aspect
          next.x = origin.x + origin.w - next.w
        } else {
          next.h = origin.h + dy
          next.w = next.h * aspect
          next.x = origin.x + origin.w - next.w
        }
      } else if (handle === "ne") {
        if (Math.abs(dx) >= Math.abs(dy)) {
          next.w = origin.w + dx
          next.h = next.w / aspect
          next.y = origin.y + origin.h - next.h
        } else {
          next.h = origin.h - dy
          next.w = next.h * aspect
          next.y = origin.y + origin.h - next.h
        }
      } else {
        if (Math.abs(dx) >= Math.abs(dy)) {
          next.w = origin.w - dx
          next.h = next.w / aspect
          next.x = origin.x + origin.w - next.w
          next.y = origin.y + origin.h - next.h
        } else {
          next.h = origin.h - dy
          next.w = next.h * aspect
          next.x = origin.x + origin.w - next.w
          next.y = origin.y + origin.h - next.h
        }
      }
    } else if (handle === "e") {
      next.w = origin.w + dx
    } else if (handle === "w") {
      next.w = origin.w - dx
      next.x = origin.x + dx
    } else if (handle === "s") {
      next.h = origin.h + dy
    } else if (handle === "n") {
      next.h = origin.h - dy
      next.y = origin.y + dy
    }

    next = snapBoardResizeRect(clampBoardRect(next), handle, item.id)
    applyBoardRect(item, next)
    nextTick(() => {
      renderChartItem(item.id)
    })
  }

  const onUp = () => {
    draggingChartId.value = null
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
    boardDragCleanup = null
    nextTick(() => {
      renderChartItem(item.id)
    })
  }

  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
  boardDragCleanup = onUp
}

function setBoardSize(width: number, height: number) {
  boardWidth.value = Math.max(640, Math.round(width))
  boardHeight.value = Math.max(480, Math.round(height))
  chartList.value.forEach((item) => {
    item.x = Math.max(0, Math.min(boardWidth.value - item.w, item.x))
    item.y = Math.max(0, Math.min(boardHeight.value - item.h, item.y))
  })
  nextTick(() => {
    renderAllCharts()
  })
}

function handleBoardSizeMenu(info: { key: string | number }) {
  const key = String(info.key)
  if (key === "1920x1080") {
    setBoardSize(1920, 1080)
    return
  }
  if (key === "1080x1080") {
    setBoardSize(1080, 1080)
    return
  }
  if (key === "custom") {
    customBoardWidth.value = boardWidth.value
    customBoardHeight.value = boardHeight.value
    showCustomBoardSize.value = true
  }
}

function applyCustomBoardSize() {
  setBoardSize(Number(customBoardWidth.value) || DEFAULT_BOARD_WIDTH, Number(customBoardHeight.value) || DEFAULT_BOARD_HEIGHT)
  showCustomBoardSize.value = false
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const link = document.createElement("a")
  link.href = dataUrl
  link.download = filename
  link.click()
}

function paintBoardToCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = boardWidth.value
  canvas.height = boardHeight.value
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return canvas
  }

  ctx.fillStyle = "#1a2330"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = "rgba(255,255,255,0.06)"
  ctx.lineWidth = 1
  for (let x = 0; x <= canvas.width; x += 24) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, canvas.height)
    ctx.stroke()
  }
  for (let y = 0; y <= canvas.height; y += 24) {
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(canvas.width, y + 0.5)
    ctx.stroke()
  }

  chartList.value.forEach((item) => {
    ctx.fillStyle = "rgba(17, 22, 28, 0.92)"
    ctx.strokeStyle = "rgba(255,255,255,0.14)"
    ctx.lineWidth = 1
    ctx.beginPath()
    if (typeof (ctx as any).roundRect === "function") {
      ;(ctx as any).roundRect(item.x, item.y, item.w, item.h, 12)
    } else {
      ctx.rect(item.x, item.y, item.w, item.h)
    }
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = "rgba(255,255,255,0.78)"
    ctx.font = "12px Microsoft YaHei, sans-serif"
    ctx.fillText(item.name || getChartTypeLabel(item.type), item.x + 12, item.y + 22)

    const chartCanvasWidth = Math.max(1, item.w - BOARD_CARD_PADDING * 2)
    const chartCanvasHeight = Math.max(1, item.h - BOARD_CARD_PADDING * 2 - BOARD_CARD_HEAD_HEIGHT - BOARD_CARD_GAP)
    const chartLeft = item.x + BOARD_CARD_PADDING
    const chartTop = item.y + BOARD_CARD_PADDING + BOARD_CARD_HEAD_HEIGHT + BOARD_CARD_GAP

    const instance = chartInstanceMap.get(item.id)
    const chartCanvas = instance?.getDom()?.querySelector("canvas") as HTMLCanvasElement | null
    if (chartCanvas) {
      ctx.drawImage(chartCanvas, chartLeft, chartTop, chartCanvasWidth, chartCanvasHeight)
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.04)"
      ctx.fillRect(chartLeft, chartTop, chartCanvasWidth, chartCanvasHeight)
    }
  })

  return canvas
}

function handleBoardDownloadMenu(info: { key: string | number }) {
  const key = String(info.key)
  const source = paintBoardToCanvas()

  if (key === "board") {
    downloadDataUrl(`画板_${boardWidth.value}x${boardHeight.value}_${Date.now()}.png`, source.toDataURL("image/png"))
    $message("已下载画板", "success")
    return
  }

  if (key === "view") {
    const viewport = boardViewportRef.value
    if (!viewport) {
      $message("当前视图不可用")
      return
    }

    const scale = boardScale.value || 1
    const sx = Math.max(0, Math.floor(viewport.scrollLeft / scale))
    const sy = Math.max(0, Math.floor(viewport.scrollTop / scale))
    const sw = Math.max(1, Math.min(boardWidth.value - sx, Math.ceil(viewport.clientWidth / scale)))
    const sh = Math.max(1, Math.min(boardHeight.value - sy, Math.ceil(viewport.clientHeight / scale)))

    const viewCanvas = document.createElement("canvas")
    viewCanvas.width = sw
    viewCanvas.height = sh
    const ctx = viewCanvas.getContext("2d")
    if (!ctx) {
      $message("导出失败")
      return
    }
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
    downloadDataUrl(`当前视图_${sw}x${sh}_${Date.now()}.png`, viewCanvas.toDataURL("image/png"))
    $message("已下载当前视图", "success")
  }
}

function addChart(type: ChartType = DEFAULT_CHART_TYPE) {
  if (chartList.value.length >= chartTypeOptions.length) {
    $message(`最多可添加 ${chartTypeOptions.length} 个图表`)
    return
  }
  const nextType = type === DEFAULT_CHART_TYPE
    ? (chartTypeOptions.find((item) => !chartList.value.some((chart) => chart.type === item.value))?.value || DEFAULT_CHART_TYPE)
    : type
  const chartType = chartTypeOptions.some((item) => item.value === nextType) ? nextType : DEFAULT_CHART_TYPE
  const sameTypeCount = chartList.value.filter((item) => item.type === chartType).length + 1
  const id = `chart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const slot = getBoardSlot(chartList.value.length)
  chartList.value.push({
    id,
    type: chartType,
    name: buildChartName(chartType, sameTypeCount),
    x: slot.x,
    y: slot.y,
    w: slot.w,
    h: slot.h
  })
  nextTick(() => {
    renderChartItem(id)
  })
}

async function generateMainImageDemo() {
  try {
    const blob = await captureCoverImage({
      minWidth: 960,
      minHeight: 540,
      targetWidth: 1280,
      targetHeight: 720,
      mime: "image/jpeg",
      quality: 0.9,
      title: mainImageTitle.value
    })
    if (mainImageUrl.value) {
      URL.revokeObjectURL(mainImageUrl.value)
    }
    mainImageUrl.value = URL.createObjectURL(blob)
    mainImageMeta.value = `${effectiveDatasetName.value} · 当前地图截图主图 · ${new Date().toLocaleString()}`
    await nextTick()
    $message("已生成主图演示截图", "success")
  } catch {
    $message("主图截图生成失败")
  }
}

function handleChartTypeChange(id: string, type: ChartType) {
  const item = chartList.value.find((entry) => entry.id === id)
  if (!item) {
    return
  }
  item.type = type
  item.name = getChartTypeLabel(type)
  nextTick(() => {
    renderChartItem(id)
  })
}

function removeChartItem(id: string) {
  disposeChartItem(id)
  chartList.value = chartList.value.filter((item) => item.id !== id)
}

function bindChartEl(id: string, el: HTMLDivElement | null) {
  if (el) {
    chartElMap.set(id, el)
    nextTick(() => {
      renderChartItem(id)
    })
    return
  }
  disposeChartItem(id)
}

function disposeChartItem(id: string) {
  chartElMap.delete(id)
  const instance = chartInstanceMap.get(id)
  if (instance) {
    instance.dispose()
    chartInstanceMap.delete(id)
  }
}

function clearChartPanelState() {
  boardDragCleanup?.()
  boardDragCleanup = null
  chartList.value.forEach((item) => {
    disposeChartItem(item.id)
  })
  chartList.value = []
  chartElMap.clear()
  chartInstanceMap.clear()
  chartViewMode.value = "list"
  boardScale.value = 1
  boardWidth.value = DEFAULT_BOARD_WIDTH
  boardHeight.value = DEFAULT_BOARD_HEIGHT
  isBoardPanning.value = false
  draggingChartId.value = null
  showCustomBoardSize.value = false
}

function renderAllCharts() {
  chartList.value.forEach((item) => {
    renderChartItem(item.id)
  })
}

function getBlankChartOption(type: ChartType): echarts.EChartsOption {
  const axisStyle = {
    axisLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11 },
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } }
  }
  const placeholder = getChartTypeLabel(type)

  if (type === "heatmap") {
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 24, bottom: 36 },
      xAxis: { type: "category", data: ["A", "B", "C", "D"], ...axisStyle },
      yAxis: { type: "category", data: ["1", "2", "3"], ...axisStyle },
      visualMap: {
        min: 0,
        max: 10,
        show: false,
        inRange: { color: ["#1d39c4", "#69c0ff", "#ff7875"] }
      },
      graphic: blankGraphic(`${placeholder}（空白）`),
      series: [{ type: "heatmap", data: [] }]
    }
  }

  if (type === "population-distribution") {
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 24, bottom: 36 },
      xAxis: { type: "category", data: ["城区", "郊区", "农村"], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      graphic: blankGraphic(`${placeholder}（空白）`),
      series: [{ type: "bar", data: [] }]
    }
  }

  if (type === "terrain-density") {
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 24, bottom: 36 },
      xAxis: { type: "value", ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      graphic: blankGraphic(`${placeholder}（空白）`),
      series: [{ type: "scatter", symbolSize: 10, data: [] }]
    }
  }

  if (type === "contour") {
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 24, bottom: 36 },
      xAxis: { type: "category", data: [], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      graphic: blankGraphic(`${placeholder}（空白）`),
      series: [{ type: "line", smooth: true, data: [] }]
    }
  }

  if (type === "trend-line") {
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 24, bottom: 36 },
      xAxis: { type: "category", data: [], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      graphic: blankGraphic(`${placeholder}（空白）`),
      series: [{ type: "line", smooth: true, data: [] }]
    }
  }

  return {
    animation: false,
    grid: { left: 48, right: 16, top: 24, bottom: 36 },
    xAxis: { type: "category", data: [], ...axisStyle },
    yAxis: { type: "value", ...axisStyle },
    graphic: blankGraphic(`${placeholder}（空白）`),
    series: [{ type: "bar", data: [] }]
  }
}

function blankGraphic(text: string): echarts.EChartsOption["graphic"] {
  return [
    {
      type: "text",
      left: "center",
      top: "middle",
      style: {
        text,
        fill: "rgba(255,255,255,0.35)",
        fontSize: 12
      }
    }
  ]
}

/*
function getDemoChartOption(type: ChartType): echarts.EChartsOption {
  const axisStyle = {
    axisLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11 },
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } }
  }

  if (type === "heatmap") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "地域热点强度", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 30, top: 28, bottom: 36 },
      xAxis: { type: "category", data: ["A", "B", "C", "D"], ...axisStyle },
      yAxis: { type: "category", data: ["1", "2", "3"], ...axisStyle },
      visualMap: {
        min: 0,
        max: 10,
        right: 0,
        top: "middle",
        itemWidth: 8,
        itemHeight: 70,
        textStyle: { color: "rgba(255,255,255,0.48)" },
        inRange: { color: ["#1d39c4", "#69c0ff", "#ff7875"] }
      },
      series: [{ type: "heatmap", data: [[0, 0, 3], [1, 0, 6], [2, 0, 8], [3, 0, 4], [0, 1, 5], [1, 1, 9], [2, 1, 7], [3, 1, 6], [0, 2, 2], [1, 2, 4], [2, 2, 8], [3, 2, 5]], label: { show: true, color: "#fff", fontSize: 10 } }]
    }
  }

  if (type === "population-distribution") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "区域等级对比", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      xAxis: { type: "category", data: ["核心区", "扩展区", "外围区", "缓冲区"], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      series: [{ type: "bar", data: [86, 64, 48, 31], barWidth: 18, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#7ad3ff" }, { offset: 1, color: "#2f7df6" }]) } }]
    }
  }

  if (type === "terrain-density") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "点位密度散点", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      xAxis: { type: "value", ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      series: [{ type: "scatter", symbolSize: (val: number[]) => Math.max(10, val[2] / 2), itemStyle: { color: "#4dd8ff", opacity: 0.8 }, data: [[12, 28, 18], [18, 34, 26], [24, 16, 22], [30, 40, 34], [36, 26, 28], [44, 18, 20], [50, 33, 30], [58, 24, 16]] }]
    }
  }

  if (type === "contour") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "剖面等值变化", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      xAxis: { type: "category", data: ["P1", "P2", "P3", "P4", "P5", "P6"], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      series: [{ type: "line", smooth: true, areaStyle: { color: "rgba(101, 191, 255, 0.16)" }, lineStyle: { color: "#65bfff", width: 2 }, data: [18, 26, 34, 29, 42, 31] }]
    }
  }

  if (type === "trend-line") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "多期趋势追踪", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      xAxis: { type: "category", data: ["T1", "T2", "T3", "T4", "T5", "T6"], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      legend: { top: 4, right: 8, textStyle: { color: "rgba(255,255,255,0.55)", fontSize: 10 } },
      series: [
        { type: "line", smooth: true, name: "当前", lineStyle: { color: "#49c1ff", width: 2 }, data: [32, 41, 38, 46, 58, 61] },
        { type: "line", smooth: true, name: "基线", lineStyle: { color: "#ffc857", width: 2 }, data: [26, 29, 31, 35, 39, 44] }
      ]
    }
  }

  return {
    animation: false,
    backgroundColor: "transparent",
    title: { text: "等级统计", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
    grid: { left: 48, right: 16, top: 28, bottom: 36 },
    xAxis: { type: "category", data: ["I级", "II级", "III级", "IV级"], ...axisStyle },
    yAxis: { type: "value", ...axisStyle },
    series: [{ type: "bar", data: [14, 26, 18, 9], barWidth: 18, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#ffb56b" }, { offset: 1, color: "#ff7b54" }]) } }]
  }
}
*/

function getDemoChartOption(type: ChartType): echarts.EChartsOption {
  const axisStyle = {
    axisLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11 },
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } }
  }

  if (type === "heatmap") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "热点强度热力图", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 30, top: 28, bottom: 36 },
      xAxis: { type: "category", data: ["一区", "二区", "三区", "四区"], ...axisStyle },
      yAxis: { type: "category", data: ["北段", "中段", "南段"], ...axisStyle },
      visualMap: {
        min: 0,
        max: 10,
        right: 0,
        top: "middle",
        itemWidth: 8,
        itemHeight: 70,
        textStyle: { color: "rgba(255,255,255,0.48)" },
        inRange: { color: ["#1d39c4", "#69c0ff", "#ff7875"] }
      },
      series: [{ type: "heatmap", data: [[0, 0, 3], [1, 0, 6], [2, 0, 8], [3, 0, 4], [0, 1, 5], [1, 1, 9], [2, 1, 7], [3, 1, 6], [0, 2, 2], [1, 2, 4], [2, 2, 8], [3, 2, 5]], label: { show: true, color: "#fff", fontSize: 10 } }]
    }
  }

  if (type === "population-distribution") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "区域等级对比图", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      xAxis: { type: "category", data: ["核心区", "扩展区", "外围区", "缓冲区"], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      series: [{ type: "bar", data: [86, 64, 48, 31], barWidth: 18, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#7ad3ff" }, { offset: 1, color: "#2f7df6" }]) } }]
    }
  }

  if (type === "terrain-density") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "点位密度散点图", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      xAxis: { type: "value", ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      series: [{ type: "scatter", symbolSize: (val: number[]) => Math.max(10, val[2] / 2), itemStyle: { color: "#4dd8ff", opacity: 0.8 }, data: [[12, 28, 18], [18, 34, 26], [24, 16, 22], [30, 40, 34], [36, 26, 28], [44, 18, 20], [50, 33, 30], [58, 24, 16]] }]
    }
  }

  if (type === "contour") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "剖面等值变化图", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      xAxis: { type: "category", data: ["样点一", "样点二", "样点三", "样点四", "样点五", "样点六"], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      series: [{ type: "line", smooth: true, areaStyle: { color: "rgba(101, 191, 255, 0.16)" }, lineStyle: { color: "#65bfff", width: 2 }, data: [18, 26, 34, 29, 42, 31] }]
    }
  }

  if (type === "trend-line") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "多期趋势追踪图", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      xAxis: { type: "category", data: ["一期", "二期", "三期", "四期", "五期", "六期"], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      legend: { top: 4, right: 8, textStyle: { color: "rgba(255,255,255,0.55)", fontSize: 10 } },
      series: [
        { type: "line", smooth: true, name: "当前值", lineStyle: { color: "#49c1ff", width: 2 }, data: [32, 41, 38, 46, 58, 61] },
        { type: "line", smooth: true, name: "基准值", lineStyle: { color: "#ffc857", width: 2 }, data: [26, 29, 31, 35, 39, 44] }
      ]
    }
  }

  return {
    animation: false,
    backgroundColor: "transparent",
    title: { text: "等级统计柱状图", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
    grid: { left: 48, right: 16, top: 28, bottom: 36 },
    xAxis: { type: "category", data: ["一级", "二级", "三级", "四级"], ...axisStyle },
    yAxis: { type: "value", ...axisStyle },
    series: [{ type: "bar", data: [14, 26, 18, 9], barWidth: 18, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#ffb56b" }, { offset: 1, color: "#ff7b54" }]) } }]
  }
}

function renderChartItem(id: string) {
  const el = chartElMap.get(id)
  const item = chartList.value.find((entry) => entry.id === id)
  if (!el || !item || !chartPanelVisible.value) {
    return
  }

  let instance = chartInstanceMap.get(id)
  if (!instance) {
    instance = echarts.init(el)
    chartInstanceMap.set(id, instance)
  }

  instance.setOption(getDemoChartOption(item.type), true)
  instance.resize()
}

function saveDraft() {
  if (!draft.templateId) {
    $message("请先选择模板")
    return
  }
  localStorage.setItem(getDraftStorageKey(), JSON.stringify(snapshotDraft()))
  savedDraftJson.value = JSON.stringify(snapshotDraft())
  $message("专题草稿已保存", "success")
}

function resetDraft() {
  if (isDirty.value && !window.confirm("当前存在未保存修改，确认恢复到上次保存的草稿吗？")) {
    return
  }
  loadDraft()
}

function switchToPublish() {
  if (!draft.templateId) {
    $message("请先选择模板并完成编辑")
    return
  }
  activeTab.value = "publish"
}

function handleTabChange(nextKey: string) {
  const next = (nextKey || "template") as WorkbenchTab
  if (activeTab.value === "editor" && next !== "editor" && isDirty.value) {
    const ok = window.confirm("编辑内容尚未保存，确认切换页签吗？")
    if (!ok) {
      return
    }
  }
  activeTab.value = next
}

function handleFold(status: boolean) {
  isFold.value = status
}

function toggleWorkbenchFold() {
  dialogRef.value?.toggle?.()
}

function notifyPanelFront() {
  if (typeof window === "undefined") {
    return
  }
  window.dispatchEvent(new CustomEvent("mars3d:widget-visible", { detail: { name: "thematic-workbench", visible: true } }))
}

function handleBeforeClose() {
  if (!isDirty.value) {
    return true
  }
  return window.confirm("当前专题制图草稿尚未保存，确认关闭并放弃修改吗？")
}

function handleClose() {
  disable("thematic-workbench")
}
</script>

<style lang="less" scoped>
.workbench-shell {
  display: flex;
  align-items: stretch;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.workbench-shell.has-chart-panel .thematic-panel {
  min-width: 0;
}

.panel-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.panel-section-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.board-mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
}

.board-mode-btn:hover {
  color: var(--mars-primary-color, #2d8cf0);
}

.board-mode-btn.is-active {
  color: var(--color-primary, #41a8ff);
  background: color-mix(in srgb, var(--color-primary, #41a8ff) 16%, transparent);
}

.panel-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--mars-text-color);
}

.chart-showcase-panel {
  flex: 2;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--popup-border, var(--mars-border-color));
  border-radius: var(--popup-item-radius, 8px);
  background: color-mix(in srgb, var(--popup-surface, #11161c) 90%, #fff 10%);
  box-sizing: border-box;
  min-height: 0;
  overflow: hidden;
}

.chart-showcase-panel.is-board-mode {
  background: color-mix(in srgb, var(--popup-surface, #11161c) 82%, #1a2330 18%);
}

.chart-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 2px;
}

.chart-demo-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  background: color-mix(in srgb, var(--text-primary, #fff) 3%, transparent);
}

.chart-demo-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.chart-demo-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--mars-text-color, #fff);
}

.chart-demo-subtitle {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
}

.main-image-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.main-image-preview {
  position: relative;
  width: 100%;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 10%, transparent);
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(53, 77, 110, 0.9), rgba(17, 22, 28, 0.92));
}

.main-image-tag {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 320px;
  max-height: 420px;
  object-fit: contain;
}

.main-image-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 196px;
  padding: 16px;
  text-align: center;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
}

.main-image-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.main-image-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--mars-text-color, #fff);
}

.main-image-meta {
  font-size: 12px;
  line-height: 1.5;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
}

.chart-list-empty {
  flex: 1;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border: 1px dashed color-mix(in srgb, var(--text-primary, #fff) 14%, transparent);
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}

.chart-list-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  background: color-mix(in srgb, var(--text-primary, #fff) 3%, transparent);
}

.selection-confirm-toolbar {
  position: fixed;
  z-index: 5000;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transform: translate(-50%, 0);
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(10, 18, 30, 0.9);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
}

.selection-confirm-btn {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
}

.selection-confirm-btn.is-confirm {
  background: linear-gradient(135deg, #29c46a, #167c43);
}

.selection-confirm-btn.is-cancel {
  background: linear-gradient(135deg, #ff8a65, #d94841);
}

.chart-list-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chart-name-select {
  flex: 1;
  min-width: 0;
}

.chart-list-item-remove {
  flex-shrink: 0;
  height: 24px;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
  font-size: 12px;
  cursor: pointer;

  &:hover {
    color: var(--color-error, #ff7875);
  }
}

.chart-list-item-canvas {
  width: 100%;
  height: 220px;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.1));
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  background: color-mix(in srgb, var(--text-primary, #fff) 2%, transparent);
}

.chart-board {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-board-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.chart-board-hint {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart-board-right-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.chart-board-dropdowns {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.chart-board-dropdown-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 16%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    color: var(--mars-text-color, #fff);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 35%, transparent);
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 10%, transparent);
  }

  :deep(.mars-icon) {
    display: inline-flex;
    opacity: 0.75;
  }
}

.chart-board-text-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 16%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
  font-size: 12px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: var(--mars-text-color, #fff);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 35%, transparent);
  }
}

.chart-board-zoom {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.chart-board-zoom-btn {
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 16%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
  font-size: 13px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: var(--mars-text-color, #fff);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 35%, transparent);
  }
}

.chart-board-zoom-reset {
  font-size: 12px;
}

.chart-board-zoom-label {
  min-width: 44px;
  text-align: center;
  font-size: 12px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
}

.chart-board-viewport {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    color-mix(in srgb, var(--popup-surface, #11161c) 88%, #243044 12%);
  background-size: 24px 24px, 24px 24px, auto;
  cursor: grab;

  &.is-panning {
    cursor: grabbing;
  }
}

.chart-board-surface {
  position: relative;
  box-sizing: border-box;
}

.chart-board-empty {
  position: absolute;
  left: 50%;
  top: 40%;
  transform: translate(-50%, -50%);
  padding: 16px 20px;
  border: 1px dashed color-mix(in srgb, var(--text-primary, #fff) 14%, transparent);
  border-radius: 10px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
  background: color-mix(in srgb, var(--popup-surface, #11161c) 70%, transparent);
  pointer-events: none;
}

.chart-board-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.14));
  border-radius: 12px;
  background: color-mix(in srgb, var(--popup-surface, #11161c) 92%, #fff 8%);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
  box-sizing: border-box;
  cursor: grab;
  user-select: none;

  &.is-dragging {
    cursor: grabbing;
    z-index: 5;
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 55%, transparent);
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.36);
  }
}

.chart-board-card-canvas {
  flex: 1;
  min-height: 0;
  height: auto;
  pointer-events: none;
}

.chart-board-main-image-card {
  cursor: default;
  z-index: 2;
}

.chart-board-main-image-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--mars-text-color, #fff);
}

.chart-board-main-image-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(53, 77, 110, 0.9), rgba(17, 22, 28, 0.92));
}

.chart-board-main-image-tag {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.chart-board-handle {
  position: absolute;
  z-index: 3;
  background: transparent;
}

.chart-board-handle.is-n,
.chart-board-handle.is-s {
  left: 12px;
  right: 12px;
  height: 8px;
  cursor: ns-resize;
}

.chart-board-handle.is-n {
  top: -4px;
}

.chart-board-handle.is-s {
  bottom: -4px;
}

.chart-board-handle.is-e,
.chart-board-handle.is-w {
  top: 12px;
  bottom: 12px;
  width: 8px;
  cursor: ew-resize;
}

.chart-board-handle.is-e {
  right: -4px;
}

.chart-board-handle.is-w {
  left: -4px;
}

.chart-board-handle.is-nw,
.chart-board-handle.is-ne,
.chart-board-handle.is-se,
.chart-board-handle.is-sw {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--color-primary, #41a8ff) 70%, #fff 30%);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.25);
  opacity: 0;
}

.chart-board-card:hover .chart-board-handle.is-nw,
.chart-board-card:hover .chart-board-handle.is-ne,
.chart-board-card:hover .chart-board-handle.is-se,
.chart-board-card:hover .chart-board-handle.is-sw,
.chart-board-card.is-dragging .chart-board-handle.is-nw,
.chart-board-card.is-dragging .chart-board-handle.is-ne,
.chart-board-card.is-dragging .chart-board-handle.is-se,
.chart-board-card.is-dragging .chart-board-handle.is-sw {
  opacity: 1;
}

.chart-board-handle.is-nw {
  top: -5px;
  left: -5px;
  cursor: nwse-resize;
}

.chart-board-handle.is-ne {
  top: -5px;
  right: -5px;
  cursor: nesw-resize;
}

.chart-board-handle.is-se {
  right: -5px;
  bottom: -5px;
  cursor: nwse-resize;
}

.chart-board-handle.is-sw {
  left: -5px;
  bottom: -5px;
  cursor: nesw-resize;
}

.board-size-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}

.board-size-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--mars-text-color);
  font-size: 13px;
}

.header-text-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 18%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--popup-surface, #11161c) 72%, #fff 8%);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.78));
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  box-sizing: border-box;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover:not(:disabled):not(.is-static) {
    color: var(--mars-text-color, #fff);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 40%, transparent);
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 12%, transparent);
  }

  &.is-active {
    color: var(--color-primary, #41a8ff);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 55%, transparent);
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 16%, transparent);
    font-weight: 600;
  }

  &.is-static {
    cursor: default;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-color: transparent;
    background: transparent;
    padding: 0;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.thematic-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.thematic-panel-head {
  padding: 0 2px;
}

.thematic-panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 2px;
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.context-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--mars-border-color);
  background: rgba(65, 168, 255, 0.06);
}

.context-main {
  min-width: 0;
}

.context-title {
  font-size: 15px;
  font-weight: 650;
  color: var(--mars-text-color);
}

.context-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--mars-text-color-secondary);
}

.dataset-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--mars-border-color);
  border-radius: var(--popup-item-radius, 8px);
  background: color-mix(in srgb, var(--popup-surface, #11161c) 92%, #fff 8%);
}

.dataset-bar-label {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--mars-text-color-secondary);
}

.dataset-bar-value {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary, #41a8ff);
  line-height: 1.4;
  word-break: break-word;
}

/* 参照分屏对比 tip 面板：蓝透底 + 高对比文字，适配深色主题 */
.workbench-tip-section {
  :deep(.ant-alert) {
    background: rgba(52, 152, 219, 0.15);
    border: 1px solid rgba(52, 152, 219, 0.3);
    border-radius: var(--popup-item-radius, 8px);
  }

  :deep(.ant-alert-message) {
    color: var(--mars-text-color, #ffffff) !important;
    font-weight: 600;
  }

  :deep(.ant-alert-description) {
    color: var(--text-secondary, rgba(255, 255, 255, 0.78)) !important;
  }

  :deep(.ant-alert-icon) {
    color: #5cadff;
  }
}

.context-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.workbench-tabs {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 参照弹窗标题「专题制图工作台」：16px / 600 */
.workbench-tabs :deep(.ant-tabs-tab) {
  font-size: var(--popup-title-font-size, 16px);
  font-weight: var(--popup-title-font-weight, 600);
  line-height: 24px;
  padding: 8px 0;
}

.workbench-tabs :deep(.ant-tabs-tab-btn) {
  font-size: inherit;
  font-weight: inherit;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
}

.workbench-tabs :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: var(--mars-text-color, #ffffff);
  font-weight: var(--popup-title-font-weight, 600);
}

.workbench-tabs :deep(.ant-tabs-nav) {
  flex-shrink: 0;
}

.workbench-tabs :deep(.ant-tabs-content-holder) {
  min-height: 0;
  flex: 1;
  overflow: visible;
}

.workbench-tabs :deep(.ant-tabs-content),
.workbench-tabs :deep(.ant-tabs-tabpane) {
  height: auto;
  min-height: 100%;
}

.template-toolbar {
  margin-bottom: 12px;
}

.section-tip {
  font-size: 12px;
  color: var(--mars-text-color-secondary);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.template-card {
  border: 1px solid var(--mars-border-color);
  background: var(--mars-bg-color);
  text-align: left;
  padding: 12px;
  display: grid;
  gap: 8px;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.template-card:hover,
.template-card.active {
  border-color: #41a8ff;
  transform: translateY(-1px);
}

.template-name {
  font-size: 14px;
  font-weight: 650;
  color: var(--mars-text-color);
}

.template-version,
.template-desc,
.template-action {
  font-size: 12px;
  color: var(--mars-text-color-secondary);
}

.template-action {
  color: #41a8ff;
}

.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  gap: 16px;
  height: 100%;
}

.editor-form,
.editor-side,
.publish-body {
  min-height: 0;
}

.editor-side {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 12px;
}

.preview-card,
.summary-card {
  border: 1px solid var(--mars-border-color);
  background: var(--mars-bg-color);
  padding: 12px;
  display: grid;
  gap: 10px;
}

.preview-title,
.summary-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--mars-text-color);
}

.preview-subtitle,
.preview-note,
.summary-item span {
  font-size: 12px;
  color: var(--mars-text-color-secondary);
}

.preview-palette {
  display: grid;
  gap: 8px;
}

.palette-title {
  font-size: 12px;
  color: var(--mars-text-color);
}

.palette-strip {
  height: 12px;
  border-radius: 999px;
}

.palette-blue-red {
  background: linear-gradient(90deg, #2f54eb 0%, #69c0ff 50%, #ff4d4f 100%);
}

.palette-green-yellow {
  background: linear-gradient(90deg, #389e0d 0%, #73d13d 50%, #fadb14 100%);
}

.palette-purple-orange {
  background: linear-gradient(90deg, #722ed1 0%, #b37feb 50%, #fa8c16 100%);
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.publish-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.summary-item strong {
  color: var(--mars-text-color);
  text-align: right;
}

.publish-body {
  height: calc(100% - 162px);
}

@media (max-width: 1100px) {
  .workbench-shell.has-chart-panel {
    flex-direction: column;
  }

  .chart-showcase-panel {
    width: 100%;
  }

  .editor-layout,
  .publish-summary {
    grid-template-columns: 1fr;
  }

  .context-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .context-actions,
  .editor-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .publish-body {
    height: auto;
  }
}
</style>
