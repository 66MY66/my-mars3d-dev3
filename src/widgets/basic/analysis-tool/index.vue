<template>
  <mars-dialog
    v-model:visible="widgetVisible"
    :title="title"
    :icon="icon"
    :width="dialogWidth"
    :height="dialogHeight"
    :min-width="dialogMinWidth"
    :min-height="dialogMinHeight"
    :position="dialogPosition"
    :handles="dialogHandles"
    :draggable="true"
    :persist-layout="isSpatialAnalysis ? false : true"
    :nopadding="isSpatialAnalysis"
  >
    <template v-if="toolType === 'buffer'" #headerRight>
      <button
        type="button"
          class="mars-popup-header-btn buffer-header-help"
        aria-label="解答"
        title="解答"
        @mousedown.stop
        @click="showBufferHelp"
      >
        <mars-icon icon="help" width="16" color="#FFFFFF" />
      </button>
    </template>
    <div :class="isSpatialAnalysis ? 'spatial-analysis-shell' : 'analysis-tool-shell'">
      <aside v-if="isSpatialAnalysis" class="spatial-analysis-nav" aria-label="空间分析类型">
        <button
          v-for="item in spatialNavItems"
          :key="item.type"
          type="button"
          class="spatial-nav-item"
          :class="{ active: toolType === item.type }"
          :title="item.label"
          :aria-label="item.label"
          @click="switchSpatialType(item.type)"
        >
          <mars-icon :icon="item.icon" :width="18" />
          <span class="spatial-nav-label">{{ item.shortLabel }}</span>
        </button>
      </aside>
      <div class="analysis-tool-panel">
      <div v-if="toolType === 'buffer'" class="buffer-workflow">
        <div class="steps">
          <a-steps size="small" :current="stepIndex">
            <a-step title="对象确认" />
            <a-step title="参数" />
            <a-step title="运行" />
            <a-step title="导出" />
          </a-steps>
        </div>

        <div v-if="stepIndex === 0" class="step-body">
          <div class="object-meta">
            <div class="meta-row">
              <span class="k">来源：</span>
              <span class="v">{{ bufferSourceText }}</span>
            </div>
            <div class="meta-row">
              <span class="k">面积：</span>
              <span class="v">{{ bufferAreaText }}</span>
            </div>
            <div class="meta-row">
              <span class="k">坐标系：</span>
              <span class="v">EPSG:4326</span>
            </div>
          </div>

          <div class="object-actions">
            <mars-dropdown-menu trigger="click" placement="bottomLeft">
              <mars-button>重新圈选</mars-button>
              <template #overlay>
                <a-menu @click="onReselectMenu">
                  <a-menu-item key="point">点</a-menu-item>
                  <a-menu-item key="polyline">线</a-menu-item>
                  <a-menu-item key="rectangle">矩形</a-menu-item>
                  <a-menu-item key="polygon">多边形</a-menu-item>
                </a-menu>
              </template>
            </mars-dropdown-menu>
            <mars-button @click="locateTarget" :disabled="!hasValidTarget">定位</mars-button>
            <mars-button @click="clearTarget" :disabled="!hasValidTarget">清除对象</mars-button>
          </div>

          <div class="step-footer">
            <mars-button type="primary" block :disabled="!hasValidTarget" @click="goNext">下一步</mars-button>
          </div>
        </div>

        <div v-else-if="stepIndex === 1" class="step-body">
          <div class="param-card">
            <div class="param-title">参数配置：</div>

            <div class="param-grid">
              <div class="param-row">
                <div class="label">模式：</div>
                <div class="value">
                  <mars-select v-model:value="bufferMode" :options="bufferModeOptions" />
                </div>
              </div>
              <div class="param-row">
                <div class="label">单位：</div>
                <div class="value">
                  <mars-select v-model:value="bufferDistanceUnit" :options="bufferUnitOptions" @change="onBufferUnitChange" />
                </div>
              </div>
              <div v-if="bufferMode === 'single'" class="param-row">
                <div class="label">半径：</div>
                <div class="value">
                  <mars-input-number v-model:value="bufferRadiusM" :min="0" :step="bufferDistanceUnit === 'm' ? 50 : 0.1" />
                  <span class="unit">{{ bufferDistanceUnit }}</span>
                </div>
              </div>
              <div v-else class="param-row ring-editor-row">
                <div class="label">多环距离：</div>
                <div class="value ring-editor">
                  <label v-for="(distance, index) in bufferRingDistances" :key="index" class="ring-distance-item">
                    <a-checkbox v-model:checked="bufferRingEnabled[index]" />
                    <span>{{ bufferRingLabels[index] }}</span>
                    <mars-input-number v-model:value="bufferRingDistances[index]" :min="0" :step="bufferDistanceUnit === 'm' ? 50 : 0.1" />
                    <span class="unit">{{ bufferDistanceUnit }}</span>
                  </label>
                </div>
              </div>
              <div class="param-row">
                <div class="label">实时预览：</div>
                <div class="value inline">
                  <mars-switch v-model:checked="previewOn" />
                  <span class="hint">{{ previewOn ? "ON" : "OFF" }}</span>
                </div>
              </div>
              <div class="param-row">
                <div class="label">模板：</div>
                <div class="value">
                  <mars-select
                    v-model:value="selectedTemplateId"
                    :options="templateOptions"
                    :allowClear="true"
                    placeholder="选择模板"
                    @change="applyTemplate"
                  />
                </div>
              </div>
            </div>

            <div class="quick-btns">
              <mars-button size="small" @click="setRadiusQuick(500)">500m</mars-button>
              <mars-button size="small" @click="setRadiusQuick(1000)">1km</mars-button>
              <mars-button size="small" @click="setRadiusQuick(2000)">2km</mars-button>
            </div>
            <div class="preview-actions">
              <mars-button size="small" :disabled="!canRunBuffer" @click="previewBufferNow">更新预览</mars-button>
              <mars-button size="small" danger @click="clearBufferResult">清除缓冲结果</mars-button>
            </div>
          </div>

          <div class="step-footer dual">
            <mars-button block @click="goPrev">上一步</mars-button>
            <mars-button type="primary" block :disabled="!canRunBuffer" @click="goNext">下一步</mars-button>
          </div>
        </div>

        <div v-else-if="stepIndex === 2" class="step-body">
          <div class="run-actions">
            <mars-button type="primary" block :loading="running" :disabled="!canRunBuffer" @click="runBufferAnalysis">
              开始分析
            </mars-button>
            <mars-button block :disabled="!running" @click="cancelRun">取消</mars-button>
          </div>

          <div class="progress" v-if="running || progressStageText">
            <div class="progress-title">进度：{{ progressStageText }}</div>
          </div>

          <div class="step-footer dual">
            <mars-button block @click="goPrev" :disabled="running">上一步</mars-button>
            <mars-button type="primary" block @click="goNext" :disabled="running || !resultSummary">下一步</mars-button>
          </div>
        </div>

        <div v-else class="step-body">
          <div v-if="resultSummary" class="result-summary">
            <div class="result-heading">
              <div>
                <div class="summary-title">分析结果</div>
                <div class="summary-subtitle">地图已定位到缓冲范围</div>
              </div>
              <mars-button size="small" @click="mapWork.flyToAnalysisResult()">定位结果</mars-button>
            </div>
            <div class="result-metric-grid">
              <div v-for="card in bufferResultView.cards" :key="card.key" class="result-metric-card">
                <span>{{ card.label }}</span>
                <strong>{{ card.value }}</strong>
              </div>
            </div>
            <div class="legend">
              <div class="legend-row"><span class="swatch core"></span><span class="legend-text">核心区</span></div>
              <div class="legend-row"><span class="swatch transition"></span><span class="legend-text">过渡区</span></div>
              <div class="legend-row"><span class="swatch edge"></span><span class="legend-text">外围区</span></div>
            </div>
            <div v-if="bufferResultView.rings.length" class="ring-result-list">
              <div class="section-caption">分环统计</div>
              <div v-for="ring in bufferResultView.rings" :key="ring.key" class="ring-result-row">
                <span class="ring-dot" :class="ring.level"></span>
                <span class="ring-name">{{ ring.label }}</span>
                <span class="ring-range">{{ ring.rangeText }}</span>
                <strong>{{ ring.areaText }}</strong>
              </div>
            </div>
            <div class="data-coverage-note">
              当前结果包含距离、范围和面积统计；行政区、人口、经济、房屋等内容将在对应数据图层可用时参与统计。
            </div>
            <div class="summary-actions grid2">
              <mars-button @click="exportGeoJSON">导出GeoJSON</mars-button>
              <mars-button @click="exportCSV">导出CSV</mars-button>
              <mars-button @click="generatePdf">生成PDF</mars-button>
              <mars-button @click="saveAsTemplate">另存为模板</mars-button>
            </div>
            <div v-if="sinkStatusText" class="sink-status">{{ sinkStatusText }}</div>
          </div>
          <div v-else class="empty-params">暂无结果</div>

          <div class="step-footer dual">
            <mars-button block @click="goPrev">上一步</mars-button>
            <mars-button type="primary" block @click="resetAll">重新分析</mars-button>
          </div>
        </div>
      </div>

      <!-- 参数设置 -->
      <div v-else-if="visibleParamDefs.length" class="params-list">
        <div v-for="def in visibleParamDefs" :key="def.key" class="param-item">
          <span class="param-label">{{ def.label }}：</span>
          <div class="param-content">
            <!-- 数字输入 -->
            <div v-if="def.type === 'number'" class="input-unit-wrap">
              <mars-input-number 
                v-model:value="currentParams[def.key]" 
                :min="def.constraints?.min ?? def.min" 
                :max="def.constraints?.max ?? def.max" 
                :step="def.constraints?.step ?? def.step ?? 1" 
              />
              <span v-if="getUnitText(def)" class="unit">{{ getUnitText(def) }}</span>
            </div>
            
            <!-- 滑块 -->
            <div v-if="def.type === 'slider'" class="slider-wrap">
              <mars-slider 
                v-model:value="currentParams[def.key]" 
                :min="def.constraints?.min ?? def.min" 
                :max="def.constraints?.max ?? def.max" 
                :step="def.constraints?.step ?? def.step ?? 1" 
              />
            </div>
            
            <!-- 下拉选择 -->
            <mars-select 
              v-if="def.type === 'select'" 
              v-model:value="currentParams[def.key]" 
              :options="def.constraints?.options ?? def.options" 
            />
            
            <!-- 文本输入 -->
            <mars-input 
              v-if="def.type === 'text'" 
              v-model:value="currentParams[def.key]" 
              :allowClear="true" 
            />
          </div>
        </div>
      </div>
      <div v-else class="empty-params">
        暂无参数配置
      </div>

      <!-- 操作按钮 -->
      <div v-if="toolType !== 'buffer'" class="actions">
        <mars-button type="primary" block :loading="running" @click="runAnalysis">开始分析</mars-button>
        <mars-button v-if="toolType === 'neighbor'" block @click="resetNeighborParams">重置参数</mars-button>
        <mars-button block @click="clearResult">清除结果</mars-button>
      </div>

      <div v-if="toolType !== 'buffer' && resultSummary" class="result-summary">
        <div class="summary-title">分析结果</div>
        <div v-if="toolType === 'buffer'" class="legend">
          <div class="legend-row"><span class="swatch core"></span><span class="legend-text">核心影响区（0–50km）</span></div>
          <div class="legend-row"><span class="swatch transition"></span><span class="legend-text">过渡影响区（50–100km）</span></div>
          <div class="legend-row"><span class="swatch edge"></span><span class="legend-text">边缘影响区（100–150km）</span></div>
        </div>
        <div v-if="toolType === 'overlay'" class="legend">
          <div class="legend-row"><span class="swatch a"></span><span class="legend-text">高烈度区（A）</span></div>
          <div class="legend-row"><span class="swatch b"></span><span class="legend-text">人口密集区（B）</span></div>
          <div class="legend-row"><span class="swatch r"></span><span class="legend-text">高风险重叠区（结果）</span></div>
        </div>
        <div v-if="toolType === 'neighbor' && neighborMode === 'hazard'" class="legend">
          <div class="legend-row"><span class="swatch g3"></span><span class="legend-text">深绿色：低风险/高韧性</span></div>
          <div class="legend-row"><span class="swatch g2"></span><span class="legend-text">浅绿色：中等韧性</span></div>
          <div class="legend-row"><span class="swatch y"></span><span class="legend-text">黄色：中等风险</span></div>
          <div class="legend-row"><span class="swatch o"></span><span class="legend-text">橙色：较高风险</span></div>
          <div class="legend-row"><span class="swatch red"></span><span class="legend-text">红色：高风险</span></div>
        </div>
        <div class="summary-actions">
          <mars-button v-if="toolType !== 'neighbor' || neighborMode === 'hazard'" @click="exportGeoJSON">导出GeoJSON</mars-button>
          <mars-button v-if="toolType !== 'neighbor' || neighborMode !== 'focal'" @click="exportCSV">导出CSV</mars-button>
          <mars-button v-if="toolType === 'neighbor' && neighborMode === 'focal'" @click="exportRaster('geotiff')">导出GeoTIFF</mars-button>
          <mars-button v-if="toolType === 'neighbor' && neighborMode === 'focal'" @click="exportRaster('cog')">导出COG</mars-button>
        </div>
        <div v-for="item in displaySummary" :key="item.k" class="summary-row">
          <span class="k">{{ item.label }}</span>
          <span class="v">{{ item.v }}</span>
        </div>

        <div v-if="toolType === 'neighbor' && neighborMode === 'hazard' && pointsForList.length" class="points">
          <div class="points-head">
            <div class="points-title">隐患点列表</div>
            <div class="points-topn">
              <span class="topn-label">Top</span>
              <mars-input-number v-model:value="topN" :min="1" :max="500" :step="1" />
            </div>
          </div>
          <div class="points-list">
            <div v-for="p in pointsForList" :key="p.idx" class="point-row" @click="flyToPoint(p.idx)">
              <span class="p-name">{{ p.name }}</span>
              <span class="p-meta">L{{ p.level }} · {{ p.lng.toFixed(6) }},{{ p.lat.toFixed(6) }}</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  </mars-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, inject } from "vue"
import {
  buildBufferRequestParams,
  buildBufferResultView,
  convertDistanceValue,
  createBufferRunCoordinator,
  type BufferDistanceUnit,
  type BufferMode
} from "./buffer-model"
import { useWidget, useWidgetStore } from "@mars/common/store/widget"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import * as mapWork from "./map"
import { toolParamDefs } from "../manage-tools/config"
import { $alert, $message } from "@mars/components/mars-ui/index"
import { smartUploadArtifact } from "../dataset-repository/services/eoapi-artifacts"
import { getCurrentDataset } from "@/shell/currentDataset"
import * as mars3d from "mars3d"
import { formatNeighborRasterSummary, getNeighborParamDefs, type NeighborMode } from "./neighbor-analysis"

// 启用map.ts生命周期
useLifecycle(mapWork)

const props = withDefaults(
  defineProps<{
    visible?: boolean
  }>(),
  {
    visible: true
  }
)

const emit = defineEmits<{
  "update:visible": [value: boolean]
}>()

const widgetVisible = computed({
  get: () => props.visible,
  set: (value) => emit("update:visible", value)
})

const { currentWidget } = useWidget()
const widgetStore = useWidgetStore()
const getCurrentWidgetName = inject<(() => string) | null>("getCurrentWidget", null)
const widgetName = getCurrentWidgetName?.() ?? "spatial-analysis"

function getOwnedWidgetData() {
  return widgetStore.state.widgets.find((item) => item.name === widgetName)?.data
}

/** 与底图弹窗一致：manage-basemap/index.vue 中 DIALOG_WIDTH = 340 */
const BASEMAP_DIALOG_WIDTH = 340
const SPATIAL_DIALOG_MIN_WIDTH = BASEMAP_DIALOG_WIDTH
const SPATIAL_DIALOG_MIN_HEIGHT = 120
const SPATIAL_TYPES = ["buffer", "overlay", "neighbor"] as const
type SpatialType = (typeof SPATIAL_TYPES)[number]

const spatialNavItems: Array<{ type: SpatialType; label: string; shortLabel: string; icon: string }> = [
  { type: "buffer", label: "缓冲区分析", shortLabel: "缓冲区", icon: "halo" },
  { type: "overlay", label: "叠加分析", shortLabel: "叠加分析", icon: "agreement" },
  { type: "neighbor", label: "邻域分析", shortLabel: "邻域分析", icon: "map-distance" }
]

const spatialInitialPosition = ref<{ left: number; top: number } | null>(null)

const toolType = ref("")
const currentParamDefs = ref<any[]>([])
const currentParams = ref<Record<string, any>>({})
const target = ref<any>(null)
const running = ref(false)
const resultSummary = ref<Record<string, any> | null>(null)
const resultPoints = ref<Array<{ idx: number; lng: number; lat: number; level: number; name: string; properties: any }>>([])
const topN = ref(20)
const neighborRasterSources = ref<ReturnType<typeof mapWork.getNeighborRasterSources>>([])

const neighborMode = computed<NeighborMode>(() => {
  const mode = String(currentParams.value.analysisMode ?? "hazard")
  return mode === "area" || mode === "focal" ? mode : "hazard"
})

const visibleParamDefs = computed(() => {
  if (toolType.value !== "neighbor") {
    return currentParamDefs.value
  }
  return getNeighborParamDefs(currentParamDefs.value, neighborMode.value).map((def) => {
    if (def.key === "rasterSource") {
      return { ...def, options: neighborRasterSources.value.map((source) => ({ label: source.label, value: source.id })) }
    }
    if (def.key === "rasterBand") {
      const source = neighborRasterSources.value.find((item) => item.id === String(currentParams.value.rasterSource))
      return { ...def, options: source?.bands ?? [] }
    }
    return def
  })
})

const stepIndex = ref(0)
const previewOn = ref(true)
const bufferRadiusM = ref(1000)
const bufferMode = ref<BufferMode>("multi")
const bufferDistanceUnit = ref<BufferDistanceUnit>("m")
const previousBufferDistanceUnit = ref<BufferDistanceUnit>("m")
const bufferRingDistances = ref([500, 1000, 2000])
const bufferRingEnabled = ref([true, true, true])
const bufferRingLabels = ["内环", "中环", "外环"]
const progressStageText = ref("")
const runToken = ref(0)
const bufferRunCoordinator = createBufferRunCoordinator()
const sinkStatusText = ref("")
const selectedTemplateId = ref<string | null>(null)

const bufferModeOptions = [{ label: "单环缓冲", value: "single" }, { label: "多环缓冲", value: "multi" }]
const bufferUnitOptions = [{ label: "米（m）", value: "m" }, { label: "公里（km）", value: "km" }]

const templatesStorageKey = "ksh003_buffer_templates_v1"
const templates = ref<Array<{ id: string; name: string; params: any }>>([])

const templateOptions = computed(() => {
  return templates.value.map((t) => ({ label: t.name, value: t.id }))
})

const title = computed(() => {
  if (currentWidget.data?.name) {
    return currentWidget.data.name + "设置"
  }
  switch (toolType.value) {
    case "buffer": return "缓冲区分析"
    case "overlay": return "叠加分析"
    case "neighbor": return "邻域分析"
    case "measure": return "测量工具"
    case "analysis": return "分析工具"
    default: return "分析工具"
  }
})

const icon = computed(() => {
  switch (toolType.value) {
    case "buffer": return "halo"
    case "overlay": return "agreement"
    case "neighbor": return "map-distance"
    case "measure": return "ruler"
    case "analysis": return "analysis"
    default: return "tool"
  }
})

const isSpatialAnalysis = computed(() => SPATIAL_TYPES.includes(toolType.value as SpatialType))

const dialogWidth = computed(() => {
  if (isSpatialAnalysis.value) {
    return BASEMAP_DIALOG_WIDTH
  }
  if (toolType.value === "buffer") {
    return resultSummary.value ? 420 : 360
  }
  return 320
})

const dialogHeight = computed(() => {
  if (isSpatialAnalysis.value) {
    if (toolType.value === "buffer") {
      return resultSummary.value ? 620 : 560
    }
    return 480
  }
  if (toolType.value === "buffer") {
    return resultSummary.value ? 620 : 520
  }
  return undefined
})

const dialogMinWidth = computed(() => (isSpatialAnalysis.value ? SPATIAL_DIALOG_MIN_WIDTH : undefined))
const dialogMinHeight = computed(() => (isSpatialAnalysis.value ? SPATIAL_DIALOG_MIN_HEIGHT : undefined))
const dialogHandles = computed(() => isSpatialAnalysis.value)

const dialogPosition = computed(() => {
  if (isSpatialAnalysis.value) {
    return spatialInitialPosition.value ?? computeSpatialCenter()
  }
  return { top: 60, right: 10 }
})

function computeSpatialCenter() {
  if (typeof window === "undefined") {
    return { left: 200, top: 120 }
  }
  const wrapper = document.querySelector("#mars-main-view") as HTMLElement | null
  const viewW = wrapper?.clientWidth ?? window.innerWidth
  const viewH = wrapper?.clientHeight ?? window.innerHeight
  const width = BASEMAP_DIALOG_WIDTH
  const height = 560
  return {
    left: Math.max(12, Math.round((viewW - width) / 2)),
    top: Math.max(12, Math.round((viewH - height) / 2))
  }
}

function ensureSpatialInitialPosition() {
  if (spatialInitialPosition.value) {
    return
  }
  spatialInitialPosition.value = computeSpatialCenter()
}

function switchSpatialType(type: SpatialType) {
  if (toolType.value === type) {
    return
  }
  mapWork.clearAnalysisResult()
  running.value = false
  progressStageText.value = ""
  resultSummary.value = null
  resultPoints.value = []
  stepIndex.value = 0
  toolType.value = type
  initParams(type)
}

function applyWidgetData(data: any) {
  if (!data) {
    return
  }
  if (data.inputParams) {
    if (data.type) {
      toolType.value = data.type
    }
    currentParamDefs.value = data.inputParams
    initParamsFromDefs(data.inputParams)
    return
  }
  const type = data.type || currentWidget?.meta?.type
  if (type) {
    const spatialType = type as SpatialType
    if (SPATIAL_TYPES.includes(spatialType)) {
      ensureSpatialInitialPosition()
    }
    if (
      SPATIAL_TYPES.includes(spatialType) &&
      toolType.value &&
      toolType.value !== type &&
      SPATIAL_TYPES.includes(toolType.value as SpatialType)
    ) {
      switchSpatialType(spatialType)
    } else if (type !== toolType.value) {
      toolType.value = type
      initParams(type)
    }
  }
  if (data.target !== undefined) {
    target.value = data.target
  }
  if (data.sourceGraphic) {
    mapWork.linkSourceGraphic(data.sourceGraphic, handleLinkedTargetChange, clearTarget)
  }
}

function handleLinkedTargetChange(updatedTarget: any) {
  target.value = { ...updatedTarget, source: target.value?.source || "marker", sourceId: target.value?.sourceId }
  resultSummary.value = null
  schedulePreview()
}

watch(
  () => getOwnedWidgetData(),
  (data) => {
    applyWidgetData(data)
  },
  { deep: true, immediate: true }
)

watch(
  () => widgetStore.state.widgets.find((item) => item.name === widgetName)?.visible,
  (visible) => {
    if (visible) {
      if (widgetName === "spatial-analysis") {
        spatialInitialPosition.value = null
        ensureSpatialInitialPosition()
      }
      applyWidgetData(getOwnedWidgetData())
    }
  }
)

onMounted(() => {
  applyWidgetData(getOwnedWidgetData() ?? currentWidget?.data)
  loadTemplates()
  refreshNeighborRasterSources()
})

function initParams(type: string) {
  const defs = toolParamDefs[type] || []
  currentParamDefs.value = defs
  initParamsFromDefs(defs)
  if (type === "neighbor") {
    refreshNeighborRasterSources()
  }
}

function initParamsFromDefs(defs: any[]) {
  const params: Record<string, any> = {}
  defs.forEach((d) => {
    params[d.key] = d.value
  })
  currentParams.value = params
}

function refreshNeighborRasterSources() {
  neighborRasterSources.value = mapWork.getNeighborRasterSources?.() ?? []
  const selected = neighborRasterSources.value.find((source) => source.id === String(currentParams.value.rasterSource))
  const source = selected ?? neighborRasterSources.value[0]
  if (source && !selected) {
    currentParams.value.rasterSource = source.id
  }
  if (source && !source.bands.some((band) => band.value === String(currentParams.value.rasterBand))) {
    currentParams.value.rasterBand = source.bands[0]?.value ?? "1"
  }
}

function resetNeighborParams() {
  const mode = neighborMode.value
  const defaults = Object.fromEntries(currentParamDefs.value.map((def) => [def.key, def.value]))
  currentParams.value = { ...defaults, analysisMode: mode }
  refreshNeighborRasterSources()
  clearResult()
}

watch(
  () => currentParams.value.analysisMode,
  () => {
    if (toolType.value !== "neighbor") {
      return
    }
    refreshNeighborRasterSources()
    clearResult()
  }
)

watch(
  () => currentParams.value.rasterSource,
  (sourceId) => {
    if (toolType.value !== "neighbor") {
      return
    }
    const source = neighborRasterSources.value.find((item) => item.id === String(sourceId))
    if (source && !source.bands.some((band) => band.value === String(currentParams.value.rasterBand))) {
      currentParams.value.rasterBand = source.bands[0]?.value ?? "1"
    }
  }
)

const hasValidTarget = computed(() => {
  const value = target.value
  if (value?.type === "point") {
    return Array.isArray(value.coordinates) && value.coordinates.length >= 2 && value.coordinates.every(Number.isFinite)
  }
  if (value?.type === "polyline") {
    return Array.isArray(value.coordinates) && value.coordinates.length >= 2
  }
  return value?.type === "polygon" && Array.isArray(value.ring) && value.ring.length >= 3
})

const bufferSourceText = computed(() => {
  const s = String(target.value?.source || "")
  if (s === "marker") {
    const typeNames: Record<string, string> = { point: "点", polyline: "线", polygon: "面" }
    return `${typeNames[target.value?.type] || ""}标记`
  }
  if (s === "selection") {
    return "圈选"
  }
  if (s === "layer") {
    return "图层对象"
  }
  return "标记面/圈选/图层对象"
})

function ringToCartesianPositions(ring: Array<[number, number]>) {
  const Cesium = mars3d.Cesium
  return ring
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .map((p) => Cesium.Cartesian3.fromDegrees(Number(p[0]), Number(p[1])))
}

const bufferAreaText = computed(() => {
  if (target.value?.type !== "polygon") {
    if (target.value?.type === "point") {
      return "点要素"
    }
    if (target.value?.type === "polyline") {
      return "线要素"
    }
    return "—"
  }
  const ring = target.value?.ring as Array<[number, number]> | undefined
  if (!ring || ring.length < 3) {
    return "—"
  }
  try {
    const positions = ringToCartesianPositions(ring)
    const area = mars3d.MeasureUtil.getArea(positions)
    if (!Number.isFinite(area) || area <= 0) {
      return "—"
    }
    if (area >= 1_000_000) {
      return `${(area / 1_000_000).toFixed(2)} km²`
    }
    return `${Math.round(area).toLocaleString()} ㎡`
  } catch {
    return "—"
  }
})

const canRunBuffer = computed(() => {
  if (toolType.value !== "buffer") {
    return false
  }
  if (!hasValidTarget.value) {
    return false
  }
  const r = Number(bufferRadiusM.value)
  if (bufferMode.value === "single") {
    return Number.isFinite(r) && r > 0
  }
  return bufferRingDistances.value.some((distance, index) => bufferRingEnabled.value[index] && Number.isFinite(Number(distance)) && Number(distance) > 0)
})

async function runAnalysis() {
  if (!toolType.value) {
    return
  }

  if (!target.value?.ring || target.value.ring.length < 3) {
    $alert("请在标记面区域内右键打开分析", title.value)
    return
  }

  try {
    running.value = true
    resultSummary.value = null
    const summary = await mapWork.runToolAnalysis(toolType.value, currentParams.value, target.value)
    resultSummary.value = summary || null
    resultPoints.value = mapWork.getAnalysisPoints()
  } catch (e: any) {
    $alert(e?.message || "分析失败", title.value)
  } finally {
    running.value = false
  }
}

function goNext() {
  stepIndex.value = Math.min(3, stepIndex.value + 1)
}

function goPrev() {
  stepIndex.value = Math.max(0, stepIndex.value - 1)
}

function resetAll() {
  bufferRunCoordinator.cancel()
  stepIndex.value = 0
  progressStageText.value = ""
  sinkStatusText.value = ""
  resultSummary.value = null
  resultPoints.value = []
  mapWork.clearAnalysisResult()
}

function clearResult() {
  mapWork.clearAnalysisResult()
  resultSummary.value = null
  resultPoints.value = []
}

const pointsForList = computed(() => {
  const sorted = [...resultPoints.value].sort((a, b) => (b.level || 0) - (a.level || 0))
  return sorted.slice(0, Math.max(1, Math.min(500, Number(topN.value) || 20)))
})

function getUnitText(def: any) {
  if (def?.unit) {
    return def.unit
  }
  if (def?.unitKey) {
    const v = String(currentParams.value?.[def.unitKey] ?? "")
    if (v === "km") {
      return "km"
    }
    if (v === "m") {
      return "m"
    }
  }
  return ""
}

const displaySummary = computed(() => {
  const s = resultSummary.value || {}
  const items: Array<{ k: string; label: string; v: string }> = []
  const push = (k: string, label: string, v: any) => items.push({ k, label, v: v == null ? "—" : String(v) })

  if (toolType.value === "buffer") {
    const fmtD = (meters: any) => {
      const v = Number(meters)
      if (!Number.isFinite(v)) {
        return "—"
      }
      return v >= 1000 ? `${Number((v / 1000).toFixed(3))} km` : `${Math.round(v).toLocaleString()} m`
    }
    if (s.mode) { push("mode", "缓冲类型", s.mode === "multi" ? "多环缓冲" : "单环缓冲") }
    if (s.sourceType) { push("sourceType", "对象类型", ({ point: "点", polyline: "线", polygon: "面" } as any)[s.sourceType] || s.sourceType) }
    if (Array.isArray(s.distancesM)) { s.distancesM.forEach((distance: number, index: number) => push(`ring${index}`, `${bufferRingLabels[index] || `第${index + 1}环`}距离`, fmtD(distance))) }
    if (s.radiusM != null) { push("radiusM", "单环半径", fmtD(s.radiusM)) }
    if (s.areaM2 != null) { push("areaM2", "面积", `${Math.round(Number(s.areaM2)).toLocaleString()} m²`) }
    if (s.totalAreaM2 != null && s.areaM2 == null) { push("totalAreaM2", "最外层面积", `${Math.round(Number(s.totalAreaM2)).toLocaleString()} m²`) }
    return items
  }

  if (toolType.value === "overlay") {
    if (s.operation) {
      let m = "差集(A-B)"
      if (s.operation === "intersect") {
        m = "交集"
      } else if (s.operation === "union") {
        m = "并集"
      }
      push("operation", "运算方式", m)
    }
    if (s.empty) { push("empty", "叠加结果", "无相交/无结果") }
    if (s.areaM2 != null) { push("areaM2", "结果面积", `${Math.round(Number(s.areaM2)).toLocaleString()} m²`) }
    if (s.perimeterM != null) { push("perimeterM", "结果周长", `${Math.round(Number(s.perimeterM)).toLocaleString()} m`) }
    return items
  }

  if (toolType.value === "neighbor") {
    if (s.analysisMode === "area" || s.analysisMode === "focal") {
      const source = neighborRasterSources.value.find((item) => item.id === String(s.rasterSourceId))
      if (source) { push("rasterSource", "栅格数据源", source.label) }
      if (s.band != null) { push("band", "波段", s.band) }
      formatNeighborRasterSummary(s).forEach((item) => push(item.key, item.label, item.value))
      if (s.analysisMode === "focal") {
        const statistics: Record<string, string> = { mean: "均值", maximum: "最大值", minimum: "最小值", stddev: "标准差" }
        push("statistic", "统计方法", statistics[s.statistic] || s.statistic)
        push("window", "邻域窗口", `${s.windowShape === "circle" ? "圆形" : "方形"} ${s.windowSize}×${s.windowSize}`)
        push("previewResolution", "预览精度", s.previewResolution === "medium" ? "中分辨率" : "低分辨率")
      }
      return items
    }
    if (s.dataset) { push("dataset", "数据集", s.dataset === "hazard-point" ? "隐患点" : s.dataset) }
    if (s.radiusM != null) {
      const u = String(currentParams.value?.distanceUnit ?? "m")
      const v = Number(s.radiusM)
      if (Number.isFinite(v) && u === "km") {
        push("radiusM", "邻域半径", `${(v / 1000).toFixed(3)} km`)
      } else {
        push("radiusM", "邻域半径", `${Math.round(v).toLocaleString()} m`)
      }
    }
    if (s.count != null) { push("count", "隐患点数量", `${Number(s.count)}`) }
    if (s.render) {
      let m = "热力图+点"
      if (s.render === "heat") {
        m = "仅热力图"
      } else if (s.render === "point") {
        m = "仅点"
      }
      push("render", "呈现方式", m)
    }
    if (s.areaM2 != null) { push("areaM2", "邻域面积", `${Math.round(Number(s.areaM2)).toLocaleString()} m²`) }
    if (s.perimeterM != null) { push("perimeterM", "邻域周长", `${Math.round(Number(s.perimeterM)).toLocaleString()} m`) }
    return items
  }

  Object.keys(s).forEach((k) => push(k, k, s[k]))
  return items
})

const bufferResultView = computed(() => buildBufferResultView(resultSummary.value || {}))

function flyToPoint(idx: number) {
  mapWork.flyToAnalysisPoint(idx)
}

function exportGeoJSON() {
  mapWork.exportAnalysisGeoJSON(toolType.value || "unknown")
}

function exportCSV() {
  mapWork.exportAnalysisCSV(toolType.value || "unknown", resultSummary.value)
}

async function exportRaster(format: "geotiff" | "cog") {
  try {
    await mapWork.exportNeighborRasterResult(format, currentParams.value, target.value)
  } catch (e: any) {
    $alert(e?.message || "栅格导出失败", title.value)
  }
}

function showBufferHelp() {
  $alert(
    "①对象确认→②参数配置→③运行与预览→④导出与保存。\n支持重新圈选(矩形/多边形)、定位、清除对象；参数支持 500m/1km/2km 快捷与实时预览。",
    "缓冲区分析"
  )
}

function buildBufferParams(): Record<string, any> {
  return buildBufferRequestParams({
    mode: bufferMode.value,
    unit: bufferDistanceUnit.value,
    distance: Number(bufferRadiusM.value),
    ringDistances: bufferRingDistances.value.map(Number),
    enabledRingIndexes: bufferRingEnabled.value.map((enabled, index) => enabled ? index : -1).filter((index) => index >= 0)
  })
}

async function runBufferAnalysis() {
  if (!canRunBuffer.value) {
    return
  }
  if (previewTimer) {
    window.clearTimeout(previewTimer)
    previewTimer = null
  }
  const bufferToken = bufferRunCoordinator.beginAnalysis()
  const token = Date.now()
  runToken.value = token
  sinkStatusText.value = ""
  progressStageText.value = "数据准备"
  try {
    running.value = true
    resultSummary.value = null
    window.setTimeout(() => {
      if (runToken.value === token) {
        progressStageText.value = "计算"
      }
    }, 300)
    const summary = await mapWork.runToolAnalysis("buffer", buildBufferParams(), target.value)
    if (runToken.value !== token || !bufferRunCoordinator.isCurrent(bufferToken) || !summary) {
      return
    }
    progressStageText.value = "渲染"
    resultSummary.value = summary || null
    resultPoints.value = mapWork.getAnalysisPoints()
    mapWork.flyToAnalysisResult()
    window.setTimeout(() => {
      if (runToken.value === token) {
        progressStageText.value = "完成"
      }
    }, 150)
    stepIndex.value = 3
    await autoSinkOutputs()
  } catch (e: any) {
    if (runToken.value === token) {
      $alert(e?.message || "分析失败", title.value)
    }
  } finally {
    bufferRunCoordinator.finish(bufferToken)
    if (runToken.value === token) {
      running.value = false
    }
  }
}

function cancelRun() {
  bufferRunCoordinator.cancel()
  if (previewTimer) {
    window.clearTimeout(previewTimer)
    previewTimer = null
  }
  runToken.value = Date.now()
  running.value = false
  progressStageText.value = ""
}

function locateTarget() {
  if (!hasValidTarget.value) {
    return
  }
  mapWork.flyToTarget(target.value, 1.2)
}

function clearTarget() {
  mapWork.unlinkSourceGraphic()
  target.value = null
  mapWork.clearTargetGraphic()
  mapWork.clearAnalysisResult()
  resultSummary.value = null
  resultPoints.value = []
  sinkStatusText.value = ""
}

async function onReselectMenu(info: any) {
  const key = String(info?.key || "")
  const type = (["point", "polyline", "rectangle", "polygon"].includes(key) ? key : "polygon") as "point" | "polyline" | "rectangle" | "polygon"
  const picked = await mapWork.startSelectTarget(type as any)
  if (!picked) {
    $message("圈选失败")
    return
  }
  mapWork.unlinkSourceGraphic()
  target.value = { ...picked, source: "selection" }
  mapWork.linkDrawnTarget(handleLinkedTargetChange, clearTarget)
  resultSummary.value = null
  resultPoints.value = []
  mapWork.clearAnalysisResult()
  if (previewOn.value) {
    schedulePreview()
  }
}

function setRadiusQuick(v: number) {
  const value = convertDistanceValue(v, "m", bufferDistanceUnit.value)
  bufferRadiusM.value = value
  bufferRingDistances.value = [value, value * 2, value * 3]
}

function onBufferUnitChange() {
  const from = previousBufferDistanceUnit.value
  const to = bufferDistanceUnit.value
  bufferRadiusM.value = convertDistanceValue(bufferRadiusM.value, from, to)
  bufferRingDistances.value = bufferRingDistances.value.map((value) => convertDistanceValue(value, from, to))
  previousBufferDistanceUnit.value = to
}

function previewBufferNow() {
  schedulePreview(true)
}

function clearBufferResult() {
  bufferRunCoordinator.cancel()
  if (previewTimer) {
    window.clearTimeout(previewTimer)
    previewTimer = null
  }
  runToken.value = Date.now()
  mapWork.clearAnalysisResult()
  resultSummary.value = null
  resultPoints.value = []
  progressStageText.value = ""
}

function loadTemplates() {
  const raw = localStorage.getItem(templatesStorageKey)
  if (!raw) {
    templates.value = []
    return
  }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      templates.value = parsed
      return
    }
  } catch {
  }
  templates.value = []
}

function persistTemplates() {
  try {
    localStorage.setItem(templatesStorageKey, JSON.stringify(templates.value))
  } catch {
  }
}

function applyTemplate() {
  const id = selectedTemplateId.value
  if (!id) {
    return
  }
  const t = templates.value.find((x) => x.id === id)
  if (!t) {
    return
  }
  const p = t.params || {}
  if (Number.isFinite(Number(p.radiusM))) {
    bufferRadiusM.value = Number(p.radiusM)
  }
  if (p.mode === "single" || p.mode === "multi") { bufferMode.value = p.mode }
  if (p.unit === "m" || p.unit === "km") { bufferDistanceUnit.value = p.unit; previousBufferDistanceUnit.value = p.unit }
  if (Array.isArray(p.ringDistances)) { bufferRingDistances.value = p.ringDistances.map(Number) }
  if (Array.isArray(p.ringEnabled)) { bufferRingEnabled.value = p.ringEnabled.map(Boolean) }
  if (typeof p.previewOn === "boolean") {
    previewOn.value = p.previewOn
  }
  if (previewOn.value) {
    schedulePreview()
  }
}

function saveAsTemplate() {
  const name = window.prompt("模板名称")
  if (!name) {
    return
  }
  const id = `${Date.now()}`
  templates.value.unshift({
    id,
    name,
    params: {
      radiusM: Number(bufferRadiusM.value),
      mode: bufferMode.value,
      unit: bufferDistanceUnit.value,
      ringDistances: [...bufferRingDistances.value],
      ringEnabled: [...bufferRingEnabled.value],
      previewOn: !!previewOn.value
    }
  })
  persistTemplates()
  selectedTemplateId.value = id
  $message("已保存模板")
}

function generatePdf() {
  if (!resultSummary.value) {
    return
  }
  const s = resultSummary.value || {}
  const rows = displaySummary.value.map((i) => `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${i.label}</td><td style="padding:6px 10px;border:1px solid #ddd;">${i.v}</td></tr>`).join("")
  const html = `
  <html><head><meta charset="utf-8" /><title>缓冲区分析报告</title></head>
  <body style="font-family: Arial, sans-serif;">
    <h2>缓冲区分析报告</h2>
    <div>生成时间：${new Date().toLocaleString()}</div>
    <div>来源：${bufferSourceText.value}</div>
    <div>面积：${bufferAreaText.value}</div>
    <table style="border-collapse:collapse;margin-top:10px;">${rows}</table>
  </body></html>`
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700")
  if (!w) {
    $message("弹窗被拦截")
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  window.setTimeout(() => {
    try {
      w.focus()
      w.print()
    } catch {
    }
  }, 200)
}

let previewTimer: number | null = null
function schedulePreview(force = false) {
  if (!previewOn.value && !force) {
    return
  }
  if (!hasValidTarget.value) {
    return
  }
  if (running.value) {
    return
  }
  if (previewTimer) {
    window.clearTimeout(previewTimer)
  }
  previewTimer = window.setTimeout(async () => {
    previewTimer = null
    if (running.value) {
      return
    }
    const previewToken = bufferRunCoordinator.beginPreview()
    if (!previewToken) {
      return
    }
    try {
      await mapWork.runToolAnalysis("buffer", buildBufferParams(), target.value)
    } catch {
    }
  }, 450)
}

watch([bufferRadiusM, bufferMode, bufferDistanceUnit, bufferRingDistances, bufferRingEnabled, previewOn, target], () => {
  if (toolType.value !== "buffer") {
    return
  }
  if (stepIndex.value > 1) {
    return
  }
  if (!previewOn.value) {
    mapWork.clearAnalysisResult()
    return
  }
  schedulePreview()
}, { deep: true })

function toCsvValue(v: any) {
  const s = String(v ?? "")
  if (/[",\n]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
}

async function autoSinkOutputs() {
  const ds = getCurrentDataset()
  const datasetId = ds?.datasetId
  if (!datasetId) {
    return
  }
  const fc = mapWork.getAnalysisFeatureCollection()
  if (!fc) {
    return
  }
  try {
    sinkStatusText.value = "正在沉淀到当前任务目录…"
    const now = Date.now()
    const geoFile = new File([JSON.stringify(fc, null, 2)], `缓冲区分析_${now}.geojson`, { type: "application/geo+json" })
    const points = mapWork.getAnalysisPoints()
    let csvText = ""
    if (points.length > 0) {
      const header = ["idx", "name", "level", "lng", "lat"].join(",")
      const rows = points.map((p) => [p.idx, p.name, p.level, p.lng.toFixed(6), p.lat.toFixed(6)].map(toCsvValue).join(","))
      csvText = [header, ...rows].join("\n")
    } else {
      const s = resultSummary.value || {}
      const rows = Object.keys(s).map((k) => `${toCsvValue(k)},${toCsvValue((s as any)[k])}`)
      csvText = ["key,value", ...rows].join("\n")
    }
    const csvFile = new File([csvText], `缓冲区分析_${now}.csv`, { type: "text/csv" })
    await smartUploadArtifact({ file: geoFile, name: "缓冲区分析结果(GeoJSON)", type: "export", datasetId })
    await smartUploadArtifact({ file: csvFile, name: "缓冲区分析结果(CSV)", type: "export", datasetId })
    const paramsFile = new File([JSON.stringify(buildBufferParams(), null, 2)], `缓冲区分析参数_${now}.json`, { type: "application/json" })
    await smartUploadArtifact({ file: paramsFile, name: "缓冲区分析参数(JSON)", type: "other", datasetId })
    sinkStatusText.value = "已沉淀到当前任务目录"
  } catch {
    sinkStatusText.value = "沉淀失败（不影响分析结果）"
  }
}
</script>

<style lang="less" scoped>
.spatial-analysis-shell {
  display: flex;
  height: 100%;
  min-height: 0;
}

.analysis-tool-shell {
  height: 100%;
}

.spatial-analysis-nav {
  flex: 0 0 72px;
  width: 72px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 4px;
  border-right: 1px solid var(--border-light, rgba(255, 255, 255, 0.12));
  background: color-mix(in srgb, var(--popup-surface, #1a1f26) 90%, transparent);
}

.spatial-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 52px;
  padding: 6px 2px;
  border: 1px solid transparent;
  border-radius: calc(var(--popup-radius, 8px) - 2px);
  background: transparent;
  color: var(--mars-text-color, inherit);
  cursor: pointer;
  transition: background var(--transition-fast, 0.2s ease), border-color var(--transition-fast, 0.2s ease), color var(--transition-fast, 0.2s ease);

  &:hover {
    background: color-mix(in srgb, var(--text-primary, #fff) 8%, transparent);
    border-color: color-mix(in srgb, var(--text-primary, #fff) 12%, transparent);
  }

  &.active {
    color: var(--color-primary, #2d8cf0);
    background: color-mix(in srgb, var(--color-primary, #2d8cf0) 14%, transparent);
    border-color: color-mix(in srgb, var(--color-primary, #2d8cf0) 28%, transparent);
  }
}

.spatial-nav-label {
  font-size: 10px;
  line-height: 1.25;
  white-space: normal;
  text-align: center;
  word-break: keep-all;
}

.spatial-analysis-shell .analysis-tool-panel {
  flex: 1;
  min-width: 0;
  overflow: auto;
}

.analysis-tool-panel {
  padding: 10px;

  .buffer-workflow {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .steps {
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border-light);
    }

    .step-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 360px;
    }

    .object-meta {
      border: 1px solid var(--border-light);
      border-radius: var(--popup-item-radius, 8px);
      padding: 10px;
      display: grid;
      gap: 6px;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      .k { color: var(--mars-text-color-placeholder); }
      .v { color: var(--mars-text-color); font-variant-numeric: tabular-nums; }
    }

    .object-actions {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }

    .param-card {
      border: 1px solid var(--border-light);
      border-radius: var(--popup-item-radius, 8px);
      padding: 10px;
      display: grid;
      gap: 10px;
    }

    .param-title {
      font-weight: 650;
      color: var(--mars-text-color);
    }

    .param-grid {
      display: grid;
      gap: 10px;
    }

    .param-row {
      display: grid;
      grid-template-columns: 70px 1fr;
      align-items: center;
      gap: 10px;
      .label { color: var(--mars-text-color-placeholder); text-align: right; }
      .value { display: flex; align-items: center; gap: 8px; }
      .value.inline { gap: 10px; }
      .unit { color: var(--mars-text-color-placeholder); white-space: nowrap; }
      .hint { color: var(--mars-text-color-placeholder); }
    }

    .quick-btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .ring-editor-row { align-items: start; }
    .ring-editor { display: grid !important; gap: 8px; }
    .ring-distance-item {
      display: grid;
      grid-template-columns: auto 42px minmax(90px, 1fr) auto;
      align-items: center;
      gap: 6px;
      color: var(--mars-text-color);
    }
    .preview-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .run-actions {
      display: grid;
      gap: 8px;
    }

    .progress-title {
      color: var(--mars-text-color-placeholder);
      font-size: 12px;
    }

    .summary-actions.grid2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 6px;
    }

    .result-summary {
      display: grid;
      gap: 12px;
    }

    .result-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .summary-title {
      color: var(--mars-text-color);
      font-size: 16px;
      font-weight: 650;
    }

    .summary-subtitle,
    .section-caption {
      color: var(--mars-text-color-placeholder);
      font-size: 12px;
    }

    .result-metric-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .result-metric-card {
      min-width: 0;
      padding: 10px;
      border: 1px solid color-mix(in srgb, var(--color-primary, #2d8cf0) 24%, transparent);
      border-radius: var(--popup-item-radius, 8px);
      background: color-mix(in srgb, var(--color-primary, #2d8cf0) 8%, transparent);
      display: grid;
      gap: 5px;

      span {
        color: var(--mars-text-color-placeholder);
        font-size: 12px;
      }

      strong {
        color: var(--mars-text-color);
        font-size: 15px;
        font-variant-numeric: tabular-nums;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .legend-row {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--mars-text-color-placeholder);
      font-size: 12px;
    }

    .swatch,
    .ring-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      flex: 0 0 auto;
    }

    .swatch.core,
    .ring-dot.core { background: #d50000; }
    .swatch.transition,
    .ring-dot.transition { background: #ff6d00; }
    .swatch.edge,
    .ring-dot.edge { background: #ffea00; }

    .ring-result-list {
      display: grid;
      gap: 7px;
    }

    .ring-result-row {
      display: grid;
      grid-template-columns: auto 54px 1fr auto;
      align-items: center;
      gap: 7px;
      padding: 8px 9px;
      border-bottom: 1px solid var(--border-light);
      color: var(--mars-text-color);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }

    .ring-range {
      color: var(--mars-text-color-placeholder);
    }

    .data-coverage-note {
      padding: 9px 10px;
      border-left: 3px solid var(--color-primary, #2d8cf0);
      background: color-mix(in srgb, var(--color-primary, #2d8cf0) 7%, transparent);
      color: var(--mars-text-color-placeholder);
      font-size: 12px;
      line-height: 1.55;
    }

    .sink-status {
      margin-top: 10px;
      color: var(--mars-text-color-placeholder);
      font-size: 12px;
    }

    .step-footer {
      margin-top: auto;
      display: grid;
      gap: 8px;
    }

    .step-footer.dual {
      grid-template-columns: 1fr 1fr;
    }
  }
  
  .params-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 20px;
  }
  
  .param-item {
    display: flex;
    align-items: center;
    gap: 10px;
    
    .param-label {
      width: 70px;
      text-align: right;
      color: var(--mars-text-color);
    }
    
    .param-content {
      flex: 1;
      display: flex;
      align-items: center;
      
      .input-unit-wrap {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 5px;
        
        .unit {
          color: var(--mars-text-color-placeholder);
          white-space: nowrap;
        }
      }
      
      .slider-wrap {
        width: 100%;
      }
    }
  }
  
  .empty-params {
    text-align: center;
    color: var(--mars-text-color-placeholder);
    padding: 20px 0;
  }
  
  .actions {
    margin-top: 10px;
    display: grid;
    gap: 8px;
  }

  .result-summary {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--border-light);

    .summary-title {
      font-weight: 650;
      margin-bottom: 8px;
      color: var(--mars-text-color);
    }

    .summary-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
    }

    .legend {
      display: grid;
      gap: 6px;
      margin-bottom: 10px;
    }

    .legend-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .swatch {
      width: 14px;
      height: 10px;
      border: 1px solid var(--border-light);
      border-radius: 4px;
    }

    .legend-text {
      color: var(--mars-text-color-placeholder);
      font-size: 12px;
    }

    .swatch.core { background: #d50000; }
    .swatch.transition { background: #ff6d00; }
    .swatch.edge { background: #ffea00; }
    .swatch.a { background: #d50000; }
    .swatch.b { background: #1677ff; }
    .swatch.r { background: #8e24aa; }
    .swatch.g3 { background: #1b5e20; }
    .swatch.g2 { background: #66bb6a; }
    .swatch.y { background: #ffea00; }
    .swatch.o { background: #ff6d00; }
    .swatch.red { background: #d50000; }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 4px 0;

      .k {
        color: var(--mars-text-color-placeholder);
      }
      .v {
        color: var(--mars-text-color);
        font-variant-numeric: tabular-nums;
      }
    }

    .points {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed var(--border-light);
    }

    .points-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }

    .points-title {
      font-weight: 650;
      color: var(--mars-text-color);
    }

    .points-topn {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .topn-label {
      color: var(--mars-text-color-placeholder);
      white-space: nowrap;
    }

    .points-list {
      max-height: 220px;
      overflow: auto;
      display: grid;
      gap: 6px;
    }

    .point-row {
      border: 1px solid var(--border-light);
      border-radius: var(--popup-item-radius, 8px);
      padding: 8px;
      cursor: pointer;
      display: grid;
      gap: 2px;
    }

    .p-name {
      color: var(--mars-text-color);
      font-weight: 600;
    }

    .p-meta {
      color: var(--mars-text-color-placeholder);
      font-variant-numeric: tabular-nums;
      font-size: 12px;
    }
  }
}
</style>
