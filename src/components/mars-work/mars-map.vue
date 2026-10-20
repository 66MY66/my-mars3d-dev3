<!--
  地图渲染组件 (建议使用mars3d地图的地方都用该组件)
  @copyright 火星科技 mars3d.cn
  @author 木遥 2024-12-03
-->
<template>
  <div class="mars3d-host">
    <div :id="withKeyId" class="mars3d-container"></div>
    <div v-if="statsVisible" ref="statsPanelEl" class="disaster-stats" :style="statsPanelStyle">
      <div class="stats-toolbar" @mousedown="(e) => startPanelDrag(e, 'stats')">
        <div class="stats-title">综合统计面板</div>
        <div class="stats-toolbar-actions" @mousedown.stop>
          <div class="auto-refresh" title="自动刷新">
            <a-switch v-model:checked="statsUi.autoRefresh" class="stats-auto-refresh-switch" size="small" @change="handleStatsAutoRefreshChange" />
          </div>
          <button class="stats-toolbar-btn" type="button" title="刷新" aria-label="刷新" @click="resetStatsPanelPosition">
            <mars-icon icon="refresh" width="16" />
          </button>
          <button class="stats-close" type="button" title="关闭" aria-label="关闭" @click="closeStats">
            <mars-icon icon="close" width="16" />
          </button>
        </div>
      </div>

      <div class="stats-fixed-top">
        <div class="stats-card base-card">
          <div class="card-title">基础数据总览</div>
          <div class="base-lines">
            <div class="line">
              <span>占地面积：{{ baseAreaText }}</span>
              <span class="sep">|</span>
              <span>人口总数：{{ basePopulationText }}</span>
            </div>
            <div class="line">
              <span>经济总量：{{ baseEconomyText }}</span>
              <span class="sep">|</span>
              <span class="muted">包含行政区划：{{ baseAdminText }}</span>
            </div>
          </div>
        </div>

        <div class="stats-quick-actions">
          <a-button size="small" @click="exportJSON">导出JSON</a-button>
          <a-button size="small" @click="exportCSV">导出CSV</a-button>
          <a-button size="small" @click="saveStatsPlayback">保存快照</a-button>
          <a-button size="small" @click="toggleStatsPlaybackVisible">{{ statsPlaybackVisible ? "收起回放" : "查看回放" }}</a-button>
        </div>
      </div>

      <div class="stats-scroll">
        <div v-if="statsPlaybackVisible" class="stats-card playback-card">
          <div class="card-head">
            <div class="card-head-left">
              <span class="card-name">统计结果回放</span>
              <span class="card-brief">共 {{ statsPlaybackRecords.length }} 条</span>
            </div>
            <div class="card-head-actions">
              <a-button size="small" type="text" @click="openResultPlayback">成果回放</a-button>
              <a-button size="small" type="text" :disabled="statsPlaybackRecords.length === 0" @click="clearStatsPlaybackRecords">清空</a-button>
            </div>
          </div>

          <a-empty v-if="statsPlaybackRecords.length === 0" description="暂无统计快照" />
          <div v-else class="playback-list">
            <div v-for="item in statsPlaybackRecords" :key="item.id" class="playback-item">
              <div class="playback-main">
                <div class="playback-title">{{ item.title }}</div>
                <div class="playback-meta">{{ formatStatsPlaybackDesc(item) }}</div>
              </div>
              <div class="playback-actions">
                <a-button size="small" type="text" @click="applyStatsPlayback(item)">回放</a-button>
                <a-button size="small" type="text" @click="removeStatsPlayback(item.id)">删除</a-button>
              </div>
            </div>
          </div>
        </div>

        <div class="stats-cards">
          <div
            v-for="c in orderedStatsCards"
            :key="c.key"
            class="stats-card"
            :class="{ 'is-dragging': draggedCardKey === c.key, 'is-drop-target': dragOverCardKey === c.key }"
            :draggable="statsUi.reorderMode"
            @dragstart="handleCardDragStart(c.key, $event)"
            @dragenter.prevent="handleCardDragEnter(c.key)"
            @dragover.prevent
            @drop.prevent="handleCardDrop(c.key)"
            @dragend="handleCardDragEnd"
          >
            <div class="card-head">
              <div class="card-head-left">
                <span class="card-name">{{ c.title }}</span>
                <span v-if="statsUi.collapsed[c.key]" class="card-brief">{{ getCardBrief(c.key) }}</span>
              </div>
              <div class="card-head-actions">
                <a-button
                  size="small"
                  type="text"
                  class="stats-collapse-btn"
                  :title="statsUi.collapsed[c.key] ? '展示' : '收回'"
                  :aria-label="statsUi.collapsed[c.key] ? '展示' : '收回'"
                  @click="toggleCardCollapsed(c.key)"
                >
                  <mars-icon :icon="statsUi.collapsed[c.key] ? 'preview-open' : 'preview-close'" width="16" />
                </a-button>
                <a-button size="small" type="text" @click="toggleCardOnMap(c.key)">{{ statsUi.onMap[c.key] ? "取消上图" : "上图展示" }}</a-button>
                <a-button size="small" type="text" @click="toggleReorderMode">{{ statsUi.reorderMode ? "完成" : "调整顺序" }}</a-button>
                <a-button v-if="statsUi.reorderMode" size="small" type="text" @click="moveCard(c.key, -1)">上移</a-button>
                <a-button v-if="statsUi.reorderMode" size="small" type="text" @click="moveCard(c.key, 1)">下移</a-button>
              </div>
            </div>

            <div v-if="!statsUi.collapsed[c.key]" class="card-body">
              <div v-if="c.hasLevel" class="card-level">
                <a-radio-group v-model:value="statsUi.level[c.key]" size="small" optionType="button" buttonStyle="solid">
                  <a-radio-button v-for="(lv, idx) in statsLevels" :key="lv" :value="idx">{{ lv }}</a-radio-button>
                </a-radio-group>
              </div>

              <div
                class="chart-wrap"
                :class="{
                  'is-loading': getCardState(c.key).loading,
                  'is-empty': getCardState(c.key).empty,
                  'is-error': !!getCardState(c.key).error
                }"
                @wheel.prevent="adjustCardLevel(c.key, $event)"
              >
                <div v-if="getCardState(c.key).loading" class="card-status">加载中...</div>
                <div v-else-if="getCardState(c.key).error" class="card-status error">{{ getCardState(c.key).error }}</div>
                <div v-else-if="getCardState(c.key).empty" class="card-status">暂无数据</div>
                <div v-else :ref="(el) => setChartEl(c.key, el as any)" class="chart"></div>
              </div>

              <div class="card-actions">
                <a-button size="small" :disabled="!canExportCard(c.key)" @click="exportCardExcel(c.key)">导出Excel</a-button>
                <a-button size="small" :disabled="!canExportCard(c.key)" @click="exportCardImage(c.key)">导出图片</a-button>
                <a-button size="small" :disabled="!canExportCard(c.key)" @click="exportCardPdf(c.key)">下载PDF</a-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="identifyVisible" ref="identifyPanelEl" class="identify-panel" :style="identifyPanelStyle">
      <div class="stats-head" @mousedown="(e) => startPanelDrag(e, 'identify')">
        <div class="stats-title">异常识别</div>
        <button class="stats-close" type="button" @click="identifyVisible = false">×</button>
      </div>

      <div class="identify-panel-body">
        <div class="stats-grid">
          <div class="row">
            <div class="k">任务</div>
            <div class="v">
              <span v-if="identify.jobId">#{{ identify.jobId }}</span>
              <span v-else>—</span>
            </div>
          </div>
          <div class="row">
            <div class="k">进度</div>
            <div class="v">
              <span v-if="identify.status">{{ Math.round((identify.progress || 0) * 100) }}%</span>
              <span v-else>—</span>
            </div>
          </div>
          <div v-if="identify.summary" class="row">
            <div class="k">异常数量</div>
            <div class="v">{{ identify.summary.anomalyCount ?? "—" }}</div>
          </div>
          <div v-if="identify.summary" class="row">
            <div class="k">异常面积</div>
            <div class="v">{{ identify.summary.anomalyAreaM2 ? formatArea(identify.summary.anomalyAreaM2, unitPrefs.area) : "—" }}</div>
          </div>
          <div v-if="identify.error" class="row">
            <div class="k">错误</div>
            <div class="v">{{ identify.error }}</div>
          </div>
        </div>

        <div class="legend">
          <div v-if="identify.category === 'macro'" class="legend-block">
            <div class="legend-inline">
              <span class="legend-title">图例：</span>
              <span class="tag"><span class="swatch y"></span><span class="legend-text">L1</span></span>
              <span class="tag"><span class="swatch o"></span><span class="legend-text">L2</span></span>
              <span class="tag"><span class="swatch red"></span><span class="legend-text">L3</span></span>
            </div>
          </div>
          <div v-else class="legend-block">
            <div class="legend-inline">
              <span class="legend-title">图例：</span>
              <span class="tag"><span class="swatch g3"></span><span class="legend-text">低</span></span>
              <span class="tag"><span class="swatch g2"></span><span class="legend-text">中</span></span>
              <span class="tag"><span class="swatch y"></span><span class="legend-text">较高</span></span>
              <span class="tag"><span class="swatch o"></span><span class="legend-text">高</span></span>
              <span class="tag"><span class="swatch red"></span><span class="legend-text">极高</span></span>
              <span class="tag"><span class="swatch sel"></span><span class="legend-text">选中</span></span>
            </div>
          </div>
        </div>

        <div class="stats-model">
          <div class="ctrl">
            <div class="label">异常类型</div>
            <select v-model="identify.category" class="select">
              <option value="macro">宏观异常</option>
              <option value="precursor">前兆异常</option>
              <option value="deformation">形变观测异常</option>
            </select>
          </div>
          <div class="ctrl">
            <div class="label">子类型/方法</div>
            <select v-if="identify.category === 'macro'" v-model="identify.macroType" class="select">
              <option value="groundwater">地下水异常</option>
              <option value="bio">生物异常</option>
              <option value="geosound">地声异常</option>
              <option value="geolight">地光异常</option>
              <option value="electromagnetic">电磁异常</option>
              <option value="meteorology">气象异常</option>
            </select>
            <select v-else-if="identify.category === 'precursor'" v-model="identify.precursorType" class="select">
              <option value="deformation">形变异常</option>
              <option value="electromagnetic">电磁异常</option>
              <option value="fluid">流体异常</option>
              <option value="seismicity">地震活动异常</option>
            </select>
            <select v-else v-model="identify.deformationMethod" class="select">
              <option value="nonTidal">非潮汐分析</option>
              <option value="slopeDiff">斜率差</option>
              <option value="adaptiveThreshold">自适应阈值</option>
              <option value="klFit">K-L直线拟合</option>
            </select>
          </div>
        </div>

        <div class="stats-model">
          <div class="ctrl">
            <div class="label">时间范围（起）</div>
            <input v-model="identify.dateStart" class="input" type="date" />
          </div>
          <div class="ctrl">
            <div class="label">时间范围（止）</div>
            <input v-model="identify.dateEnd" class="input" type="date" />
          </div>
        </div>

        <div class="stats-actions identify-primary-actions">
          <button class="btn" type="button" :disabled="identify.running" @click="startIdentifyFromPanel">开始识别</button>
          <button class="btn" type="button" @click="clearIdentifyResult">清理</button>
        </div>

        <div class="stats-actions identify-export-actions">
          <button class="btn" type="button" @click="exportIdentifyGeoJSON">导出GeoJSON</button>
          <button class="btn" type="button" @click="exportIdentifyCSV">导出CSV</button>
        </div>

        <button class="btn identify-stats-btn" type="button" @click="openStatsPanel">综合统计面板</button>

        <div class="stats-grid">
          <div class="row identify-top-row">
            <div class="k">结果列表</div>
            <div class="v">
              <span>Top</span>
              <input v-model.number="identify.topN" class="input topn" type="number" min="1" max="500" step="1" />
            </div>
          </div>
          <div v-if="identify.items.length" class="result-list">
            <button
              v-for="it in identifyItemsForList"
              :key="it.idx"
              type="button"
              class="result-item"
              :class="{ selected: identify.selectedIdx === it.idx }"
              @click="selectIdentifyItem(it.idx)"
            >
              <div class="r-title">{{ it.title }}</div>
              <div class="r-meta">{{ it.meta }}</div>
            </button>
          </div>
          <div v-else class="k">暂无结果</div>
        </div>

        <div v-if="identifySelectedItem" class="detail-card">
          <div class="d-title">{{ identifySelectedItem.title }}</div>
          <div class="d-meta">{{ identifySelectedItem.meta }}</div>
          <div v-if="identifySelectedItem.desc" class="d-desc">{{ identifySelectedItem.desc }}</div>
          <div v-if="identifySelectedItem.mediaUrls?.length" class="media">
            <img v-for="u in identifySelectedItem.mediaUrls" :key="u" class="media-img" :src="u" alt="media" />
          </div>
        </div>
      </div>

      <div class="resize-handle" @mousedown="(e) => startPanelResize(e, 'identify')"></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import * as mars3d from "mars3d"
import mars3dPkg from "mars3d/package.json"
import "./expand/index" // 引入插件或注册扩展js
import { getContextMenu as getNewContextMenu } from "@mars/utils/contextmenu/context-menu"
import type { ContextMenuOptions } from "@mars/utils/contextmenu/types"

import { computed, nextTick, onUnmounted, onMounted, reactive, ref, toRaw, watch } from "vue"
import { getAdaptiveStatsPeakMetrics, getStatsOverlayLod } from "@/utils/stats-overlay-metrics"
import { getIdentifyFocusAction } from "@/utils/identify-focus"
import { $alert, $message } from "@mars/components/mars-ui/index"
import { logInfo } from "@mars/utils/mars-util"
import { removeRetiredLayers } from "@/config/retired-layers"
import { normalizeRing, pointInRing } from "@/utils/region-hit"
import {
  estimateMetrics,
  formatArea,
  formatDistance,
  formatMoney,
  formatPopulation,
  metricsToCSV,
  metricsToJSONPayload,
  type DisasterMetrics,
  type DisasterModel,
  type RingLonLat,
  type UnitPrefs
} from "@/utils/disaster-metrics"
import {
  cancelQuickIdentifyJob,
  createQuickIdentifyJob,
  getQuickIdentifyJob,
  type DeformationMethod,
  type MacroAnomalyType,
  type PrecursorAnomalyType,
  type QuickIdentifyCategory,
  type QuickIdentifyJobStatus
} from "@/api/quickIdentify"

import { useWidget } from "@mars/common/store/widget"
import { hasPermission } from "@/shell/permission"
import { installMarsLogoPrimitiveGuard, MARS3D_BRANDING_SELECTOR, sweepMarsLogoPrimitives } from "./branding"
import * as echarts from "echarts"
import * as XLSX from "xlsx"

defineOptions({ name: "MarsMap" })

const { activate, disableAll } = useWidget()

// 性能优化：节流函数，减少高频事件触发
function throttle<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let lastTime = 0
  let timer: number | null = null
  return ((...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastTime >= delay) {
      lastTime = now
      fn(...args)
    } else if (!timer) {
      timer = window.setTimeout(() => {
        lastTime = Date.now()
        timer = null
        fn(...args)
      }, delay - (now - lastTime))
    }
  }) as T
}

const props = withDefaults(
  defineProps<{
    mapKey?: string // 多个地图时,可传入key区分地图
    url?: string // 传入的地图构造参数url，可为空，只传options
    options?: any // 传入的地图构造参数options，可覆盖url内的参数
  }>(),
  {
    mapKey: "default",
    url: undefined,
    options: undefined
  }
)

// 用于存放地球组件实例
let map: mars3d.Map // 地图对象
let watermarkObserver: MutationObserver | null = null
let watermarkStyleEl: HTMLStyleElement | null = null
let stopLogoPrimitiveGuard: (() => void) | null = null
let mars3dVersionMatched = false

function getMapPrimitives(mapInstance?: any) {
  const scene = mapInstance?.scene || mapInstance?.viewer?.scene || mapInstance?._viewer?.scene
  return scene?.primitives
}

function clearLogoPrimitiveGuard(): void {
  if (!stopLogoPrimitiveGuard) {
    return
  }
  try {
    stopLogoPrimitiveGuard()
  } catch {
  }
  stopLogoPrimitiveGuard = null
}

function startLogoPrimitiveGuard(mapInstance?: any): void {
  clearLogoPrimitiveGuard()
  let restore = () => {}
  let installed = false
  const timers: number[] = []
  const sweep = () => {
    const primitives = getMapPrimitives(mapInstance)
    if (!primitives) {
      return
    }
    if (!installed && typeof primitives.add === "function") {
      restore = installMarsLogoPrimitiveGuard(primitives)
      installed = true
    }
    try {
      sweepMarsLogoPrimitives(primitives)
    } catch {
    }
  }
  sweep()
  timers.push(window.setTimeout(sweep, 3500))
  timers.push(window.setTimeout(sweep, 4500))
  const interval = window.setInterval(sweep, 5000)
  stopLogoPrimitiveGuard = () => {
    timers.forEach((id) => window.clearTimeout(id))
    window.clearInterval(interval)
    restore()
  }
}

function normalizeMars3dVersion(v: unknown): string | null {
  if (typeof v === "string") {
    return v.trim()
  }
  if (typeof v === "number") {
    return String(v)
  }
  return null
}

function isMars3dExactVersion(version: string): boolean {
  const v = normalizeMars3dVersion((mars3dPkg as any)?.version)
  return v === version
}

function ensureNoWatermarkStyle(): void {
  if (watermarkStyleEl) {
    return
  }
  const style = document.createElement("style")
  style.setAttribute("data-mars-no-watermark", "1")
  style.textContent = `
.mars3d-container a[href*="mars3d.cn"],
.cesium-credit-logoContainer,
.mars3d-container .mars3d-locationbar a[href*="mars3d.cn"],
.mars3d-container .mars3d-locationbar a[href*="marsgis"],
.mars3d-container .mars3d-locationbar a[href*="mars3d"],
.mars3d-container a[href*="mars3d.cn"],
.mars3d-container a[href*="marsgis"],
.mars3d-container img[src*="mars3d.cn"],
.mars3d-container img[src*="marsgis"],
.mars3d-container img[src*="mars3d"] { display: none !important; visibility: hidden !important; opacity: 0 !important; }
`
  document.head.appendChild(style)
  watermarkStyleEl = style
}

function hideIfBranding(el: Element): void {
  if (!el) {
    return
  }
  const text = (el.textContent || "").trim()
  const href = (el as any)?.href ? String((el as any).href) : ""
  const src = (el as any)?.src ? String((el as any).src) : ""
  const hit =
    (href && /(mars3d\.cn|marsgis)/i.test(href)) ||
    (src && /(mars3d\.cn|marsgis)/i.test(src)) ||
    (text && /(火星科技|合肥火星科技有限公司|mars3d\.cn)/i.test(text)) ||
    el.classList.contains("cesium-credit-logoContainer")

  if (!hit) {
    return
  }
  try {
    ;(el as HTMLElement).style.setProperty("display", "none", "important")
    ;(el as HTMLElement).style.setProperty("visibility", "hidden", "important")
    ;(el as HTMLElement).style.setProperty("opacity", "0", "important")
  } catch {
  }
  try {
    el.remove()
  } catch {
  }
}

function removeBrandingOnce(container: ParentNode | null, mapInstance?: any): void {
  const root: ParentNode = container || document
  try {
    const hits = (root as any).querySelectorAll ? (root as any).querySelectorAll(MARS3D_BRANDING_SELECTOR) : []
    hits.forEach((el: Element) => hideIfBranding(el))
  } catch {
  }

  // Cesium may place its credit container outside the map host. Clean only
  // the credit container belonging to this map instance.
  if (mapInstance) {
    const viewer = mapInstance?.viewer || mapInstance?._viewer
    const creditContainer = viewer?.cesiumWidget?.creditContainer || viewer?._cesiumWidget?._creditContainer
    try {
      const creditHits = creditContainer?.querySelectorAll?.(MARS3D_BRANDING_SELECTOR) || []
      creditHits.forEach((el: Element) => hideIfBranding(el))
    } catch {
    }
  }

  try {
    const textHits = (root as any).querySelectorAll ? (root as any).querySelectorAll("a,span,div") : []
    textHits.forEach((el: Element) => {
      if ((el as HTMLElement).childElementCount > 0) {
        return
      }
      hideIfBranding(el)
    })
  } catch {
  }
}

function startNoWatermarkGuard(container: HTMLElement | null, mapInstance?: any): void {
  if (!mars3dVersionMatched) {
    return
  }
  startLogoPrimitiveGuard(mapInstance)
  ensureNoWatermarkStyle()
  removeBrandingOnce(container, mapInstance)
  if (document.body && document.body !== container) {
    removeBrandingOnce(document.body, mapInstance)
  }

  if (watermarkObserver) {
    try {
      watermarkObserver.disconnect()
    } catch {
    }
    watermarkObserver = null
  }

  const root = container || document.body
  if (!root) {
    return
  }

  // Some Cesium/Mars3D builds append their credit node directly under body
  // instead of the map host. Observe body as well, while hideIfBranding keeps
  // the cleanup limited to known branding signatures.
  const observerTargets: Node[] = [root]
  if (document.body && document.body !== root) {
    observerTargets.push(document.body)
  }
  const viewer = mapInstance?.viewer || mapInstance?._viewer
  const creditContainer = viewer?.cesiumWidget?.creditContainer || viewer?._cesiumWidget?._creditContainer
  if (creditContainer && creditContainer !== root) {
    observerTargets.push(creditContainer)
  }

  watermarkObserver = new MutationObserver((muts) => {
    muts.forEach((m) => {
      m.addedNodes.forEach((n) => {
        if (!n || n.nodeType !== 1) {
          return
        }
        const el = n as Element
        hideIfBranding(el)
        removeBrandingOnce(container, mapInstance)
      })
    })
  })

  try {
    observerTargets.forEach((target) => watermarkObserver?.observe(target, { childList: true, subtree: true }))
  } catch {
    try {
      watermarkObserver.observe(document.body, { childList: true, subtree: true })
    } catch {
    }
  }
}

const statsVisible = ref(false)
const identifyVisible = ref(false)
const statsPanelEl = ref<HTMLElement | null>(null)
const identifyPanelEl = ref<HTMLElement | null>(null)
const statsPanelPos = reactive<{ left: number | null; top: number | null }>({ left: null, top: null })
const viewport = reactive({ w: window.innerWidth, h: window.innerHeight })
const statsRingMeta = reactive<{ source: "none" | "selection" | "buffer" | "view" }>({ source: "none" })

const statsLevels = ["省", "市", "区", "县", "镇", "村"] as const
type StatsLevelName = typeof statsLevels[number]
type StatsRingSource = "none" | "selection" | "buffer" | "view"
type StatsPlaybackRecord = {
  id: string
  ts: number
  title: string
  ring: RingLonLat
  source: StatsRingSource
  metrics: DisasterMetrics
  model: DisasterModel
  unitPrefs: UnitPrefs
  statsUi: {
    autoRefresh: boolean
    cardsOrder: string[]
    collapsed: Record<string, boolean>
    onMap: Record<string, boolean>
    level: Record<string, number>
  }
}

type StatsCardState = {
  loading: boolean
  empty: boolean
  error: string | null
}

const statsUi = reactive<{
  autoRefresh: boolean
  reorderMode: boolean
  cardsOrder: string[]
  collapsed: Record<string, boolean>
  onMap: Record<string, boolean>
  level: Record<string, number>
}>({
  autoRefresh: false,
  reorderMode: false,
  cardsOrder: ["population", "economy", "housing", "radiation", "vegetation"],
  collapsed: {
    population: false,
    economy: false,
    housing: false,
    radiation: false,
    vegetation: false
  },
  onMap: {
    population: false,
    economy: false,
    housing: false,
    radiation: false,
    vegetation: false
  },
  level: {
    population: 2,
    economy: 2,
    housing: 2,
    radiation: 2,
    vegetation: 2
  }
})

const statsCards = [
  { key: "population", title: "人口分布统计", hasLevel: true },
  { key: "economy", title: "经济分布统计", hasLevel: true },
  { key: "housing", title: "房屋抗震系数分布", hasLevel: true },
  { key: "radiation", title: "热辐射时序变化", hasLevel: false },
  { key: "vegetation", title: "植被覆盖变化", hasLevel: false }
] as const
type StatsCardKey = (typeof statsCards)[number]["key"]

const orderedStatsCards = computed(() => {
  const byKey = new Map(statsCards.map((c) => [c.key, c]))
  const ordered: any[] = []
  const order = Array.isArray(statsUi.cardsOrder) ? statsUi.cardsOrder : []
  order.forEach((k) => {
    const hit = byKey.get(k as StatsCardKey)
    if (hit) {
      ordered.push(hit)
      byKey.delete(k as StatsCardKey)
    }
  })
  byKey.forEach((v) => ordered.push(v))
  return ordered
})

const chartEls = new Map<string, HTMLElement>()
const chartInstances = new Map<string, echarts.ECharts>()
let statsAutoTimer: number | null = null
let statsOverlayLayer: any = null
let statsOverlayByKey = new Map<string, any[]>()
const statsOverlayLabels = new Map<any, any>()
let statsOverlayCameraTimer: number | null = null
let statsOverlayCameraHandler: (() => void) | null = null
let statsThemeObserver: MutationObserver | null = null
const statsDataByKey = new Map<string, Array<Record<string, any>>>()
const statsUpdatedAtByKey = new Map<string, number>()
const statsAdminLabelCache = new Map<string, string[]>()
const statsAdminLabelPromiseCache = new Map<string, Promise<string[]>>()
const statsAreaFeatureCache = new Map<string, Promise<any[]>>()
const statsAdminPointCache = new Map<string, Promise<string>>()
const statsAdminWarmCache = new Map<string, Promise<void>>()
const statsCardState = reactive<Record<string, StatsCardState>>({
  population: { loading: false, empty: false, error: null },
  economy: { loading: false, empty: false, error: null },
  housing: { loading: false, empty: false, error: null },
  radiation: { loading: false, empty: false, error: null },
  vegetation: { loading: false, empty: false, error: null }
})
const draggedCardKey = ref<string>("")
const dragOverCardKey = ref<string>("")
const statsPlaybackStorageKey = "mars3d_disaster_stats_playback_v1"
const statsPlaybackMaxRecords = 20
const statsPlaybackVisible = ref(false)
const statsPlaybackRecords = ref<StatsPlaybackRecord[]>([])
const identifyPanelPos = reactive<{ left: number | null; top: number | null; width: number | null; height: number | null }>({
  left: null,
  top: null,
  width: 360,
  height: 620
})
const activeRing = ref<RingLonLat>([])
const metrics = reactive<DisasterMetrics>({ areaM2: 0, perimeterM: 0, population: 0, lossYuan: 0 })
const unitPrefs = reactive<UnitPrefs>({ area: "km2", distance: "km", population: "wan", money: "wan" })
const model = reactive<DisasterModel>({ populationDensityPerKm2: 1000, lossPerPersonYuan: 5000 })
const statsStorageKey = "mars3d_disaster_stats_prefs_v1"
const identify = reactive<{
  category: QuickIdentifyCategory
  macroType: MacroAnomalyType
  precursorType: PrecursorAnomalyType
  deformationMethod: DeformationMethod
  dateStart: string
  dateEnd: string
  topN: number
  running: boolean
  jobId: string | null
  status: QuickIdentifyJobStatus["status"] | null
  progress: number
  summary: QuickIdentifyJobStatus["summary"] | null
  error: string | null
  items: Array<{
    idx: number
    title: string
    meta: string
    lng: number
    lat: number
    level: number
    desc?: string
    mediaUrls?: string[]
    props?: any
  }>
  selectedIdx: number | null
  geojson: any | null
}>({
  category: "precursor",
  macroType: "groundwater",
  precursorType: "deformation",
  deformationMethod: "nonTidal",
  dateStart: "",
  dateEnd: "",
  topN: 20,
  running: false,
  jobId: null,
  status: null,
  progress: 0,
  summary: null,
  error: null,
  items: [],
  selectedIdx: null,
  geojson: null
})
let identifyPollTimer: number | null = null
let identifyHeatLayer: any = null
let identifyGraphicLayer: any = null
let identifySelectedGraphic: any = null
let identifyGraphicByIdx = new Map<number, any>()
let precursorOverviewCamera: any = null
let drawingOverviewCamera: any = null

// 性能优化：存储事件处理函数引用，用于组件卸载时清理
let disasterStatsHandlers: {
  updateFromEvent: ((e: any) => void) | null
  drawCreated: ((e: any) => void) | null
  throttledUpdate: ((e: any) => void) | null
} | null = null
let thermalAnomalyHandler: ((e: any) => void) | null = null

const basemapStorageKey = "mars3d_basemap_state_v1"

// #region debug-point stats-blank-chart:reporter
function statsBlankChartDebug(hypothesisId: string, msg: string, data?: Record<string, any>) {
  fetch("http://127.0.0.1:7777/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "stats-blank-chart",
      runId: "pre-fix",
      hypothesisId,
      location: "src/components/mars-work/mars-map.vue",
      msg: `[DEBUG] ${msg}`,
      data: data || {},
      ts: Date.now()
    })
  }).catch(() => {})
}
// #endregion

function loadPrefs() {
  try {
    const raw = localStorage.getItem(statsStorageKey)
    if (!raw) {
      return
    }
    const data = JSON.parse(raw)
    if (data?.statsUi) {
      if (typeof data.statsUi.autoRefresh === "boolean") {
        statsUi.autoRefresh = data.statsUi.autoRefresh
      }
      if (Array.isArray(data.statsUi.cardsOrder)) {
        statsUi.cardsOrder = data.statsUi.cardsOrder
      }
      if (data.statsUi.collapsed && typeof data.statsUi.collapsed === "object") {
        Object.assign(statsUi.collapsed, data.statsUi.collapsed)
      }
      if (data.statsUi.onMap && typeof data.statsUi.onMap === "object") {
        Object.assign(statsUi.onMap, data.statsUi.onMap)
      }
      if (data.statsUi.level && typeof data.statsUi.level === "object") {
        Object.assign(statsUi.level, data.statsUi.level)
      }
    }
    if (data?.unitPrefs) {
      Object.assign(unitPrefs, data.unitPrefs)
    }
    if (data?.model) {
      Object.assign(model, data.model)
    }
    if (data?.identify) {
      Object.assign(identify, data.identify)
      identify.running = false
      identify.jobId = null
      identify.status = null
      identify.progress = 0
      identify.summary = null
      identify.error = null
      identify.items = []
      identify.selectedIdx = null
      identify.geojson = null
    }
    if (data?.panelPos?.stats) {
      Object.assign(statsPanelPos, data.panelPos.stats)
    }
    if (data?.panelPos?.identify) {
      Object.assign(identifyPanelPos, data.panelPos.identify)
    }
  } catch {}
}

function restoreBasemapFromStorage() {
  if (!map) {
    return
  }
  let id = ""
  try {
    const raw = localStorage.getItem(basemapStorageKey)
    if (raw) {
      const v = JSON.parse(raw)
      id = String(v?.id || "").trim()
    }
  } catch {}
  if (!id) {
    return
  }
  try {
    const basemaps = map.getBasemaps(true) || []
    const exists = basemaps.some((b: any) => b && String(b.id) === id)
    if (!exists) {
      return
    }
    const active = basemaps.find((b: any) => b && b.isAdded && b.show)
    if (active && String(active.id) === id) {
      return
    }
    const mapAny: any = map as any
    mapAny._lastUserBasemapId = id
    mapAny._lastUserBasemapChangeAt = Date.now()
    map.basemap = id
    map.scene?.requestRender?.()
  } catch {}
}

function savePrefs() {
  try {
    const keepIdentify = {
      category: identify.category,
      macroType: identify.macroType,
      precursorType: identify.precursorType,
      deformationMethod: identify.deformationMethod,
      dateStart: identify.dateStart,
      dateEnd: identify.dateEnd,
      topN: identify.topN
    }
    const panelPos = { stats: statsPanelPos, identify: identifyPanelPos }
    const keepStatsUi = {
      autoRefresh: statsUi.autoRefresh,
      cardsOrder: statsUi.cardsOrder,
      collapsed: statsUi.collapsed,
      onMap: statsUi.onMap,
      level: statsUi.level
    }
    localStorage.setItem(statsStorageKey, JSON.stringify({ statsUi: keepStatsUi, unitPrefs, model, identify: keepIdentify, panelPos }))
  } catch {}
}

function cloneRing(ring: RingLonLat): RingLonLat {
  return Array.isArray(ring) ? ring.map((item) => [Number(item?.[0] || 0), Number(item?.[1] || 0)] as [number, number]) : []
}

function snapshotStatsUi() {
  return {
    autoRefresh: !!statsUi.autoRefresh,
    cardsOrder: Array.isArray(statsUi.cardsOrder) ? [...statsUi.cardsOrder] : [],
    collapsed: { ...statsUi.collapsed },
    onMap: { ...statsUi.onMap },
    level: { ...statsUi.level }
  }
}

function readStatsPlaybackRecords(): StatsPlaybackRecord[] {
  try {
    const raw = localStorage.getItem(statsPlaybackStorageKey)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .map((item: any): StatsPlaybackRecord => {
        let money: UnitPrefs["money"] = "wan"
        if (item?.unitPrefs?.money === "yuan") {
          money = "yuan"
        } else if (item?.unitPrefs?.money === "yi") {
          money = "yi"
        }
        return {
          id: String(item?.id || ""),
          ts: Number(item?.ts || 0),
          title: String(item?.title || ""),
          ring: cloneRing(item?.ring || []),
          source: (["none", "selection", "buffer", "view"].includes(String(item?.source)) ? item.source : "none") as StatsRingSource,
          metrics: {
            areaM2: Number(item?.metrics?.areaM2 || 0),
            perimeterM: Number(item?.metrics?.perimeterM || 0),
            population: Number(item?.metrics?.population || 0),
            lossYuan: Number(item?.metrics?.lossYuan || 0)
          },
          model: {
            populationDensityPerKm2: Number(item?.model?.populationDensityPerKm2 || 0),
            lossPerPersonYuan: Number(item?.model?.lossPerPersonYuan || 0)
          },
          unitPrefs: {
            area: item?.unitPrefs?.area === "m2" ? "m2" : "km2",
            distance: item?.unitPrefs?.distance === "m" ? "m" : "km",
            population: item?.unitPrefs?.population === "person" ? "person" : "wan",
            money
          } as UnitPrefs,
          statsUi: {
            autoRefresh: !!item?.statsUi?.autoRefresh,
            cardsOrder: Array.isArray(item?.statsUi?.cardsOrder) ? item.statsUi.cardsOrder.map((x: any) => String(x)) : [],
            collapsed: typeof item?.statsUi?.collapsed === "object" && item?.statsUi?.collapsed ? { ...item.statsUi.collapsed } : {},
            onMap: typeof item?.statsUi?.onMap === "object" && item?.statsUi?.onMap ? { ...item.statsUi.onMap } : {},
            level: typeof item?.statsUi?.level === "object" && item?.statsUi?.level ? { ...item.statsUi.level } : {}
          }
        }
      })
      .filter((item: StatsPlaybackRecord) => item.id && item.ts && item.ring.length >= 3)
      .sort((a: StatsPlaybackRecord, b: StatsPlaybackRecord) => b.ts - a.ts)
      .slice(0, statsPlaybackMaxRecords)
  } catch {
    return []
  }
}

function writeStatsPlaybackRecords(records: StatsPlaybackRecord[]) {
  try {
    localStorage.setItem(statsPlaybackStorageKey, JSON.stringify(records.slice(0, statsPlaybackMaxRecords)))
  } catch {}
}

function loadStatsPlaybackRecords() {
  statsPlaybackRecords.value = readStatsPlaybackRecords()
}

watch([unitPrefs, model], savePrefs, { deep: true })
watch(
  () => [identify.category, identify.macroType, identify.precursorType, identify.deformationMethod, identify.dateStart, identify.dateEnd, identify.topN],
  savePrefs
)
watch(
  () => [statsUi.autoRefresh, statsUi.reorderMode, statsUi.cardsOrder, statsUi.collapsed, statsUi.onMap, statsUi.level],
  savePrefs,
  { deep: true }
)

const areaText = computed(() => formatArea(metrics.areaM2, unitPrefs.area))
const perimeterText = computed(() => formatDistance(metrics.perimeterM, unitPrefs.distance))
const populationText = computed(() => formatPopulation(metrics.population, unitPrefs.population))
const lossText = computed(() => formatMoney(metrics.lossYuan, unitPrefs.money))
const baseAreaText = computed(() => areaText.value)
const basePopulationText = computed(() => populationText.value)
const baseEconomyText = computed(() => lossText.value)
const baseAdminText = computed(() => {
  const ring = activeRing.value
  if (!ring || ring.length < 3) {
    return "—"
  }
  if (statsRingMeta.source === "view") {
    return "当前视图范围"
  }
  if (statsRingMeta.source === "buffer") {
    return "点位缓冲区"
  }
  return "圈选区域"
})
const identifyItemsForList = computed(() => {
  const n = Math.max(1, Math.min(500, Number(identify.topN) || 20))
  return [...identify.items].sort((a, b) => (b.level || 0) - (a.level || 0)).slice(0, n)
})
const identifySelectedItem = computed(() => {
  if (!identify.selectedIdx) {
    return null
  }
  return identify.items.find((x) => x.idx === identify.selectedIdx) || null
})
const statsPanelStyle = computed(() => {
  const s: any = {}
  const { width, height } = getStatsPanelSize(viewport.w, viewport.h)
  s.width = `${width}px`
  s.height = `${height}px`
  if (statsPanelPos.left != null) {
    s.left = `${statsPanelPos.left}px`
    s.right = "auto"
  }
  if (statsPanelPos.top != null) {
    s.top = `${statsPanelPos.top}px`
  }
  return s
})
const identifyPanelStyle = computed(() => {
  const s: any = {}
  if (identifyPanelPos.left != null) {
    s.left = `${identifyPanelPos.left}px`
    s.right = "auto"
  }
  if (identifyPanelPos.top != null) {
    s.top = `${identifyPanelPos.top}px`
  }
  if (identifyPanelPos.width != null) {
    s.width = `${identifyPanelPos.width}px`
  }
  if (identifyPanelPos.height != null) {
    s.height = `${identifyPanelPos.height}px`
  }
  return s
})

function getPanelBounds(which: "stats" | "identify") {
  const panelEl = which === "stats" ? statsPanelEl.value : identifyPanelEl.value
  const host = panelEl?.closest?.(".mars3d-host") as HTMLElement | null
  const rect = host?.getBoundingClientRect()
  if (rect) {
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
  }
  return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight }
}

function clampStatsPanelToMap() {
  const el = statsPanelEl.value
  if (!el) {
    return
  }
  const rect = el.getBoundingClientRect()
  const bounds = getPanelBounds("stats")
  const currentLeft = statsPanelPos.left != null ? statsPanelPos.left : rect.left - bounds.left
  const currentTop = statsPanelPos.top != null ? statsPanelPos.top : rect.top - bounds.top
  const maxLeft = Math.max(0, bounds.width - rect.width - 12)
  const maxTop = Math.max(0, bounds.height - rect.height - 12)
  statsPanelPos.left = Math.max(0, Math.min(maxLeft, currentLeft))
  statsPanelPos.top = Math.max(0, Math.min(maxTop, currentTop))
}

function clampIdentifyPanelToMap() {
  const el = identifyPanelEl.value
  if (!el) {
    return
  }
  const rect = el.getBoundingClientRect()
  const bounds = getPanelBounds("identify")
  const currentLeft = identifyPanelPos.left != null ? identifyPanelPos.left : rect.left - bounds.left
  const currentTop = identifyPanelPos.top != null ? identifyPanelPos.top : rect.top - bounds.top
  const width = identifyPanelPos.width != null ? identifyPanelPos.width : rect.width
  const height = identifyPanelPos.height != null ? identifyPanelPos.height : rect.height
  const maxWidth = Math.max(320, bounds.width - 12)
  const maxHeight = Math.max(260, bounds.height - 12)
  const clampedWidth = Math.min(width, maxWidth)
  const clampedHeight = Math.min(height, maxHeight)

  identifyPanelPos.width = clampedWidth
  identifyPanelPos.height = clampedHeight
  identifyPanelPos.left = Math.max(0, Math.min(Math.max(0, bounds.width - clampedWidth - 12), currentLeft))
  identifyPanelPos.top = Math.max(0, Math.min(Math.max(0, bounds.height - clampedHeight - 12), currentTop))
}

function startPanelDrag(e: MouseEvent, which: "stats" | "identify") {
  if ((e.target as HTMLElement)?.closest?.("button,select,input,textarea")) {
    return
  }
  const el = which === "stats" ? statsPanelEl.value : identifyPanelEl.value
  const pos = which === "stats" ? statsPanelPos : identifyPanelPos
  if (!el) {
    return
  }
  const rect = el.getBoundingClientRect()
  const bounds = getPanelBounds(which)
  const startX = e.clientX
  const startY = e.clientY
  const startLeft = pos.left != null ? pos.left : rect.left - bounds.left
  const startTop = pos.top != null ? pos.top : rect.top - bounds.top

  const onMove = (ev: MouseEvent) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    const maxLeft = Math.max(0, bounds.width - rect.width - 12)
    const maxTop = Math.max(0, bounds.height - rect.height - 12)
    pos.left = Math.max(0, Math.min(maxLeft, startLeft + dx))
    pos.top = Math.max(0, Math.min(maxTop, startTop + dy))
  }
  const onUp = () => {
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
    savePrefs()
  }
  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
}

function resetStatsPanelPosition() {
  statsPanelPos.left = null
  statsPanelPos.top = null
  savePrefs()
  nextTick(() => resizeAllCharts())
  $message("已恢复弹窗初始位置", "success")
}

function handleStatsAutoRefreshChange(checked: boolean) {
  $message(checked ? "已打开自动刷新" : "已关闭自动刷新", "success")
}

function startPanelResize(e: MouseEvent, which: "identify") {
  const el = identifyPanelEl.value
  if (!el) {
    return
  }
  e.preventDefault()
  e.stopPropagation()

  const rect = el.getBoundingClientRect()
  const bounds = getPanelBounds(which)
  const startX = e.clientX
  const startY = e.clientY
  const startW = identifyPanelPos.width != null ? identifyPanelPos.width : rect.width
  const startH = identifyPanelPos.height != null ? identifyPanelPos.height : rect.height
  const left = identifyPanelPos.left != null ? identifyPanelPos.left : rect.left - bounds.left
  const top = identifyPanelPos.top != null ? identifyPanelPos.top : rect.top - bounds.top

  const onMove = (ev: MouseEvent) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    const minW = 320
    const minH = 260
    const maxW = Math.max(minW, bounds.width - left - 12)
    const maxH = Math.max(minH, bounds.height - top - 12)
    identifyPanelPos.width = Math.max(minW, Math.min(maxW, startW + dx))
    identifyPanelPos.height = Math.max(minH, Math.min(maxH, startH + dy))
  }
  const onUp = () => {
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
    savePrefs()
  }
  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
}

function getStatsPanelSize(w: number, h: number): { width: number; height: number } {
  if (w <= 600) {
    const maxW = Math.max(320, w - 24)
    const maxH = Math.max(260, h - 24)
    return { width: maxW, height: Math.min(560, maxH) }
  }
  let base = { width: 860, height: 640 }
  if (w >= 3600 || h >= 2000) {
    base = { width: 1200, height: 820 }
  } else if (w >= 1900 || h >= 1080) {
    base = { width: 980, height: 720 }
  }
  const maxW = Math.max(320, w - 24)
  const maxH = Math.max(260, h - 24)
  return { width: Math.min(base.width, maxW), height: Math.min(base.height, maxH) }
}

function getThemeName(): string | undefined {
  const theme = document?.documentElement?.getAttribute?.("data-theme")
  return theme === "dark" ? "dark" : undefined
}

function getCardLabel(row: Record<string, any>) {
  return String(row["区划"] ?? row["月份"] ?? "未命名")
}

function getCardValueByKey(key: StatsCardKey, row: Record<string, any>) {
  if (key === "population") {
    return Math.max(0, Number(row["人口"] || 0))
  }
  if (key === "economy") {
    return Math.max(0, Number(row["经济"] || 0))
  }
  if (key === "housing") {
    return Math.max(0, Number(row["抗震系数"] || 0))
  }
  return Math.max(0, Number(row["数值"] || 0))
}

function formatCardValue(key: StatsCardKey, value: number) {
  if (key === "population") {
    return formatPopulation(value, unitPrefs.population)
  }
  if (key === "economy") {
    return formatMoney(value, unitPrefs.money)
  }
  if (key === "housing") {
    return `${value.toFixed(2)}`
  }
  if (key === "radiation") {
    return `${value.toFixed(2)}`
  }
  return `${value.toFixed(3)}`
}

function getStatsGradientColor(ratio: number) {
  if (ratio >= 0.85) {
    return "#ff4d4f"
  }
  if (ratio >= 0.65) {
    return "#fa8c16"
  }
  if (ratio >= 0.45) {
    return "#fadb14"
  }
  if (ratio >= 0.25) {
    return "#13c2c2"
  }
  return "#2f54eb"
}

function getStatsCategoryColor(key: StatsCardKey) {
  const colors: Record<StatsCardKey, string> = {
    population: "#F76560",
    economy: "#FBE842",
    housing: "#B5E241",
    radiation: "#57A9FB",
    vegetation: "#E13EDB"
  }
  return colors[key]
}

/** 相邻侧面固定明暗，顶面单独更亮，不随数值或视角改变 */
const STATS_PRISM_FACE_SHADE = [0.08, 0.38, 0.18, 0.5]
/** 柱身竖向高度相对原尺度的比例，只缩小上下尺寸 */
const STATS_PRISM_HEIGHT_SCALE = 0.5
/** 矩形底面阶段的面积比例，作为当前底面面积的基准 */
const STATS_PRISM_FOOTPRINT_AREA_SCALE = 1 / 3
/** 在当前底面面积上再缩小到 1/2，并改为正方形 */
const STATS_PRISM_SQUARE_AREA_SCALE = 1 / 2

function getStatsPrismTopColor(baseColor: string) {
  return mixHexColor(baseColor, "#ffffff", 0.46)
}

function getStatsPrismFaceColor(baseColor: string, faceIndex: number) {
  const shade = STATS_PRISM_FACE_SHADE[faceIndex] ?? 0.24
  return mixHexColor(baseColor, "#141414", shade)
}

const statsPrismSideImages = new Map<string, string>()

function getStatsPrismSideImage(faceColor: string) {
  const cached = statsPrismSideImages.get(faceColor)
  if (cached) {
    return cached
  }
  const bottomColor = mixHexColor(faceColor, "#ffffff", 0.82)
  const canvas = document.createElement("canvas")
  canvas.width = 4
  canvas.height = 128
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return ""
  }
  const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0)
  gradient.addColorStop(0, bottomColor)
  gradient.addColorStop(1, faceColor)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const image = canvas.toDataURL("image/png")
  statsPrismSideImages.set(faceColor, image)
  return image
}

function applyOpaqueGradient(wallGraphic: any, faceColor: string) {
  const Cesium = (mars3d as any).Cesium
  const wall = wallGraphic?.entity?.wall
  if (!wall || !Cesium) {
    return
  }
  wall.material = new Cesium.ImageMaterialProperty({
    image: getStatsPrismSideImage(faceColor),
    color: Cesium.Color.WHITE,
    transparent: false
  })
}

/** 按统计区面积推算方柱底边与最大高度（原站三维柱尺度） */
function hexToRgb(hex: string) {
  const normalized = String(hex || "").replace("#", "")
  const source = normalized.length === 3
    ? normalized.split("").map((part) => `${part}${part}`).join("")
    : normalized.padStart(6, "0").slice(0, 6)
  const value = Number.parseInt(source, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  }
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function mixHexColor(hex: string, target: string, weight: number) {
  const sourceRgb = hexToRgb(hex)
  const targetRgb = hexToRgb(target)
  return rgbToHex(
    sourceRgb.r + (targetRgb.r - sourceRgb.r) * weight,
    sourceRgb.g + (targetRgb.g - sourceRgb.g) * weight,
    sourceRgb.b + (targetRgb.b - sourceRgb.b) * weight
  )
}

function getStatsPeakMetrics(cameraHeight = 50000) {
  return getAdaptiveStatsPeakMetrics(Number(metrics.areaM2) || 0, cameraHeight)
}

function buildStatsTooltip(key: StatsCardKey, row: Record<string, any>, ratio: number) {
  return `
    <div style="min-width: 160px">
      <div style="font-weight: 600; margin-bottom: 4px;">${getCardLabel(row)}</div>
      <div>卡片：${statsCards.find((item) => item.key === key)?.title || key}</div>
      <div>数值：${formatCardValue(key, getCardValueByKey(key, row))}</div>
      <div>强度：${Math.round(ratio * 100)}%</div>
    </div>
  `
}

function ensureStatsOverlayLayer() {
  if (statsOverlayLayer || !map) {
    return
  }
  statsOverlayLayer = new mars3d.layer.GraphicLayer({ name: "综合统计上图" })
  map.addLayer(statsOverlayLayer)
  statsOverlayLayer.on?.(mars3d.EventType.mouseOver, (event: any) => {
    const label = statsOverlayLabels.get(event?.graphic)
    if (label) {
      label.show = true
    }
  })
  statsOverlayLayer.on?.(mars3d.EventType.mouseOut, (event: any) => {
    const label = statsOverlayLabels.get(event?.graphic)
    if (label) {
      label.show = true
    }
  })
}

function getRingBbox(ring: RingLonLat): [number, number, number, number] | null {
  if (!Array.isArray(ring) || ring.length < 3) {
    return null
  }
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  ring.forEach(([lng, lat]) => {
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      west = Math.min(west, lng)
      south = Math.min(south, lat)
      east = Math.max(east, lng)
      north = Math.max(north, lat)
    }
  })
  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
    return null
  }
  return [west, south, east, north]
}

function getRingCentroid(ring: RingLonLat) {
  let sumLng = 0
  let sumLat = 0
  let count = 0
  ring.forEach(([lng, lat]) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return
    }
    sumLng += lng
    sumLat += lat
    count += 1
  })
  if (!count) {
    return { lng: 0, lat: 0 }
  }
  return { lng: sumLng / count, lat: sumLat / count }
}

function hashSeed(parts: Array<string | number>): number {
  const s = parts.map((p) => String(p)).join("|")
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildFallbackStatsLabels(levelIdx: number, count = 8) {
  const safeLevelIdx = Math.max(0, Math.min(statsLevels.length - 1, Number(levelIdx) || 0))
  return Array.from({ length: count }).map((_, i) => `${statsLevels[safeLevelIdx]}${i + 1}`)
}

function makeStatsAdminCacheKey(levelIdx: number, ring: RingLonLat) {
  const bbox = getRingBbox(ring)
  if (!bbox) {
    return `${levelIdx}|none`
  }
  return `${levelIdx}|${bbox.map((n) => Number(n).toFixed(3)).join(",")}`
}

function makeStatsAdminPointKey(levelIdx: number, point: { lng: number; lat: number }) {
  return `${levelIdx}|${Number(point.lng).toFixed(4)},${Number(point.lat).toFixed(4)}`
}

function normalizeAdminName(value: any) {
  const text = String(value ?? "").trim()
  return text && text !== "[]" && text !== "null" && text !== "undefined" ? text : ""
}

function getStatsSampleLimit(levelIdx: number) {
  if (levelIdx <= 2) {
    return 8
  }
  return 4
}

function computeGeoJsonCoordsBbox(coords: any): [number, number, number, number] | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  const walk = (input: any) => {
    if (!Array.isArray(input)) {
      return
    }
    if (input.length >= 2 && typeof input[0] === "number" && typeof input[1] === "number") {
      const lng = Number(input[0])
      const lat = Number(input[1])
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        west = Math.min(west, lng)
        south = Math.min(south, lat)
        east = Math.max(east, lng)
        north = Math.max(north, lat)
      }
      return
    }
    input.forEach(walk)
  }
  walk(coords)
  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
    return null
  }
  return [west, south, east, north]
}

function featureContainsPoint(feature: any, point: { lng: number; lat: number }) {
  const bbox = feature?.bbox
  if (bbox) {
    if (point.lng < bbox[0] || point.lng > bbox[2] || point.lat < bbox[1] || point.lat > bbox[3]) {
      return false
    }
  }
  const geometry = feature?.geometry || {}
  let polygons: any[] = []
  if (geometry.type === "Polygon") {
    polygons = [geometry.coordinates]
  } else if (geometry.type === "MultiPolygon") {
    polygons = geometry.coordinates
  }
  for (const polygon of polygons) {
    const outer = normalizeRing(Array.isArray(polygon) ? polygon[0] : [])
    if (!outer.length || !pointInRing(point, outer)) {
      continue
    }
    const holes = Array.isArray(polygon) ? polygon.slice(1) : []
    const inHole = holes.some((hole: any) => {
      const ring = normalizeRing(hole)
      return ring.length >= 3 && pointInRing(point, ring)
    })
    if (!inHole) {
      return true
    }
  }
  return false
}

async function fetchStatsAreaFeatures(adcode: string) {
  const key = String(adcode || "100000")
  if (!statsAreaFeatureCache.has(key)) {
    const url = `https://data.mars3d.cn/file/geojson/areas/${key}_full.json`
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null
    const timer =
      controller && typeof window !== "undefined"
        ? window.setTimeout(() => controller.abort(new Error("stats area geojson timeout")), 5000)
        : null
    const task = fetch(url, controller ? { signal: controller.signal } : undefined)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        return res.json()
      })
      .then((json) => {
        const features = Array.isArray(json?.features) ? json.features : []
        const mapped = features.map((feature: any) => {
          const props = feature?.properties || {}
          return {
            ...feature,
            adcode: String(props.adcode || ""),
            parentAdcode: String(props?.parent?.adcode || ""),
            name: normalizeAdminName(props.name),
            level: normalizeAdminName(props.level),
            childrenNum: Number(props.childrenNum || 0),
            bbox: computeGeoJsonCoordsBbox(feature?.geometry?.coordinates)
          }
        })
        return mapped
      })
      .finally(() => {
        if (timer != null) {
          window.clearTimeout(timer)
        }
      })
    statsAreaFeatureCache.set(key, task)
  }
  return statsAreaFeatureCache.get(key) || Promise.resolve([])
}

async function resolveStatsGeoJsonAdminName(point: { lng: number; lat: number }, levelIdx: number) {
  const provinces = await fetchStatsAreaFeatures("100000")
  const province = provinces.find((item: any) => featureContainsPoint(item, point))
  if (!province) {
    return ""
  }
  if (levelIdx <= 0) {
    return province.name
  }

  let city = null as any
  if (province.childrenNum > 0) {
    const cities = await fetchStatsAreaFeatures(province.adcode)
    city = cities.find((item: any) => featureContainsPoint(item, point)) || null
  }
  if (levelIdx === 1) {
    return city?.name || province.name
  }

  let district = null as any
  if (city?.childrenNum > 0) {
    const districts = await fetchStatsAreaFeatures(city.adcode)
    district = districts.find((item: any) => featureContainsPoint(item, point)) || null
  }
  return district?.name || city?.name || province.name
}

function resolveStatsGeoJsonAdminNameCached(point: { lng: number; lat: number }, levelIdx: number) {
  const cacheKey = makeStatsAdminPointKey(levelIdx, point)
  if (!statsAdminPointCache.has(cacheKey)) {
    const task = resolveStatsGeoJsonAdminName(point, levelIdx).catch((error) => {
      statsAdminPointCache.delete(cacheKey)
      throw error
    })
    statsAdminPointCache.set(cacheKey, task)
  }
  return statsAdminPointCache.get(cacheKey) || Promise.resolve("")
}

function buildStatsSamplePoints(ring: RingLonLat, maxCount = 10) {
  const bbox = getRingBbox(ring)
  if (!bbox) {
    return []
  }
  const points: Array<{ lng: number; lat: number }> = []
  const center = getRingCentroid(ring)
  if (pointInRing(center, ring)) {
    points.push(center)
  }

  const steps = 4
  for (let row = 0; row < steps; row++) {
    for (let col = 0; col < steps; col++) {
      const lng = bbox[0] + ((col + 0.5) / steps) * (bbox[2] - bbox[0])
      const lat = bbox[1] + ((row + 0.5) / steps) * (bbox[3] - bbox[1])
      const point = { lng, lat }
      if (!pointInRing(point, ring)) {
        continue
      }
      const dup = points.some((item) => Math.abs(item.lng - lng) < 1e-6 && Math.abs(item.lat - lat) < 1e-6)
      if (!dup) {
        points.push(point)
      }
      if (points.length >= maxCount) {
        return points
      }
    }
  }

  if (!points.length) {
    points.push(center)
  }
  return points
}

function prewarmStatsAdminHierarchy(levelIdx: number, ring: RingLonLat) {
  if (!Array.isArray(ring) || ring.length < 3) {
    return
  }
  const cacheKey = makeStatsAdminCacheKey(levelIdx, ring)
  if (statsAdminWarmCache.has(cacheKey)) {
    return
  }
  const center = getRingCentroid(ring)
  const task = resolveStatsGeoJsonAdminNameCached(center, Math.min(levelIdx, 2))
    .then(() => undefined)
    .catch(() => undefined)
  statsAdminWarmCache.set(cacheKey, task)
}

async function fetchStatsAdminLabels(levelIdx: number, ring: RingLonLat) {
  const samplePoints = buildStatsSamplePoints(ring, getStatsSampleLimit(levelIdx))
  const labels = await Promise.all(
    samplePoints.map(async (location) => {
      try {
        return resolveStatsGeoJsonAdminNameCached(location, levelIdx)
      } catch {
        return ""
      }
    })
  )
  return Array.from(new Set(labels.map(normalizeAdminName).filter(Boolean))).slice(0, 8)
}

function ensureStatsAdminLabels(levelIdx: number, ring: RingLonLat) {
  if (!Array.isArray(ring) || ring.length < 3) {
    return
  }
  const cacheKey = makeStatsAdminCacheKey(levelIdx, ring)
  if (statsAdminLabelCache.has(cacheKey) || statsAdminLabelPromiseCache.has(cacheKey)) {
    return
  }
  prewarmStatsAdminHierarchy(levelIdx, ring)
  const task = fetchStatsAdminLabels(levelIdx, ring)
    .then((labels) => {
      statsAdminLabelCache.set(cacheKey, labels.length ? labels : buildFallbackStatsLabels(levelIdx))
      statsAdminLabelPromiseCache.delete(cacheKey)
      if (statsVisible.value) {
        refreshStats(false)
      }
      return statsAdminLabelCache.get(cacheKey) || []
    })
    .catch(() => {
      const fallback = buildFallbackStatsLabels(levelIdx)
      statsAdminLabelCache.set(cacheKey, fallback)
      statsAdminLabelPromiseCache.delete(cacheKey)
      return fallback
    })
  statsAdminLabelPromiseCache.set(cacheKey, task)
}

function buildCardData(key: StatsCardKey): Array<Record<string, any>> {
  const now = Date.now()
  const ring = activeRing.value
  const bbox = getRingBbox(ring)
  const seed = hashSeed([key, statsUi.level[key] ?? 0, bbox?.join(",") || "none", Math.round(metrics.areaM2)])
  const rnd = mulberry32(seed)
  // #region debug-point D:build-card-input
  statsBlankChartDebug("D", "buildCardData input", {
    key,
    ringLength: Array.isArray(ring) ? ring.length : -1,
    hasBbox: !!bbox,
    areaM2: Number(metrics.areaM2 || 0),
    population: Number(metrics.population || 0),
    lossYuan: Number(metrics.lossYuan || 0),
    level: Number(statsUi.level[key] ?? -1)
  })
  // #endregion

  if (key === "radiation" || key === "vegetation") {
    const rows: Array<Record<string, any>> = []
    const start = new Date()
    start.setMonth(start.getMonth() - 11)
    start.setDate(1)
    const base = key === "radiation" ? 30 + rnd() * 20 : 0.35 + rnd() * 0.25
    const amp = key === "radiation" ? 10 + rnd() * 18 : 0.08 + rnd() * 0.12
    for (let i = 0; i < 12; i++) {
      const d = new Date(start)
      d.setMonth(start.getMonth() + i)
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const label = `${d.getFullYear()}-${mm}`
      const seasonal = Math.sin((i / 12) * Math.PI * 2) * amp
      const noise = (rnd() - 0.5) * amp * 0.25
      const v = Math.max(0, base + seasonal + noise)
      rows.push({ 月份: label, 数值: key === "radiation" ? Number(v.toFixed(2)) : Number(v.toFixed(3)) })
    }
    statsUpdatedAtByKey.set(key, now)
    // #region debug-point D:build-card-output-timeseries
    statsBlankChartDebug("D", "buildCardData output", {
      key,
      rowsLength: rows.length,
      sample: rows.slice(0, 2)
    })
    // #endregion
    return rows
  }

  const lvIdx = Math.max(0, Math.min(statsLevels.length - 1, Number(statsUi.level[key] ?? 2)))
  const cacheKey = makeStatsAdminCacheKey(lvIdx, ring)
  const labels = statsAdminLabelCache.get(cacheKey) || buildFallbackStatsLabels(lvIdx)
  const weights = labels.map(() => 0.35 + rnd() * 1.25)
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1
  let total = Math.max(0, Number(metrics.areaM2) || 0)
  if (key === "population") {
    total = Math.max(0, Number(metrics.population) || 0)
  } else if (key === "economy") {
    total = Math.max(0, Number(metrics.lossYuan) || 0)
  }
  const rows: Array<Record<string, any>> = labels.map((name, i) => {
    const share = weights[i] / totalWeight
    let value: number
    if (key === "population") {
      value = Math.round(total * share)
      return { 区划: name, 人口: value }
    }
    if (key === "economy") {
      value = Math.round(total * share)
      return { 区划: name, 经济: value }
    }
    value = Number((0.1 + rnd() * 0.9).toFixed(2))
    return { 区划: name, 抗震系数: value }
  })

  statsUpdatedAtByKey.set(key, now)
  // #region debug-point D:build-card-output
  statsBlankChartDebug("D", "buildCardData output", {
    key,
    rowsLength: rows.length,
    total,
    sample: rows.slice(0, 2)
  })
  // #endregion
  return rows
}

function buildEChartsOption(key: StatsCardKey, rows: Array<Record<string, any>>) {
  if (key === "radiation" || key === "vegetation") {
    const x = rows.map((r) => r["月份"])
    const y = rows.map((r) => r["数值"])
    return {
      animation: false,
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 18, top: 24, bottom: 32 },
      xAxis: { type: "category", data: x, axisLabel: { rotate: 0 } },
      yAxis: { type: "value" },
      series: [
        {
          type: "line",
          data: y,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 2 }
        }
      ]
    }
  }

  const nameKey = "区划"
  let valueKey = "抗震系数"
  if (key === "population") {
    valueKey = "人口"
  } else if (key === "economy") {
    valueKey = "经济"
  }
  const x = rows.map((r) => r[nameKey])
  const y = rows.map((r) => r[valueKey])
  let color = "#722ed1"
  if (key === "population") {
    color = "#2f54eb"
  } else if (key === "economy") {
    color = "#13c2c2"
  }
  return {
    animation: false,
    tooltip: { trigger: "axis" },
    grid: { left: 46, right: 18, top: 24, bottom: 40 },
    xAxis: { type: "category", data: x, axisLabel: { rotate: 0 } },
    yAxis: { type: "value" },
    series: [
      {
        type: "bar",
        data: y,
        itemStyle: { color },
        barMaxWidth: 26
      }
    ]
  }
}

function getCardBrief(key: string): string {
  const rows = statsDataByKey.get(key) || []
  const updatedAt = statsUpdatedAtByKey.get(key)
  const timeText = updatedAt ? new Date(updatedAt).toLocaleTimeString() : ""
  return rows.length ? `共${rows.length}条${timeText ? " · " + timeText : ""}` : "暂无数据"
}

function getCardState(key: string): StatsCardState {
  return statsCardState[key] || { loading: false, empty: false, error: null }
}

function updateCardState(key: string, patch: Partial<StatsCardState>) {
  if (!statsCardState[key]) {
    statsCardState[key] = { loading: false, empty: false, error: null }
  }
  Object.assign(statsCardState[key], patch)
}

function canExportCard(key: string) {
  const state = getCardState(key)
  return !state.loading && !state.error && !state.empty && (statsDataByKey.get(key)?.length || 0) > 0
}

function initOrReinitChart(key: StatsCardKey) {
  const el = chartEls.get(key)
  if (!el) {
    // #region debug-point B:init-missing-el
    statsBlankChartDebug("B", "initOrReinitChart skipped: missing element", { key })
    // #endregion
    return
  }
  const old = chartInstances.get(key)
  if (old && !old.isDisposed?.()) {
    old.dispose()
  }
  const theme = getThemeName()
  const chart = echarts.init(el, theme)
  chartInstances.set(key, chart)
  // #region debug-point A:init-chart
  statsBlankChartDebug("A", "initOrReinitChart completed", {
    key,
    width: el.clientWidth,
    height: el.clientHeight,
    offsetWidth: el.offsetWidth,
    offsetHeight: el.offsetHeight,
    theme: theme || "default"
  })
  // #endregion
}

function resizeAllCharts() {
  chartInstances.forEach((c) => {
    try {
      c.resize?.()
    } catch {}
  })
}

function renderCard(key: StatsCardKey) {
  const chart = chartInstances.get(key)
  if (!chart) {
    // #region debug-point B:render-missing-chart
    statsBlankChartDebug("B", "renderCard skipped: chart instance missing", {
      key,
      hasEl: chartEls.has(key)
    })
    // #endregion
    return
  }
  updateCardState(key, { loading: true, empty: false, error: null })
  try {
    const ring = activeRing.value
    const chartEl = chartEls.get(key)
    const card = statsCards.find((item) => item.key === key)
    if (card?.hasLevel) {
      const lvIdx = Math.max(0, Math.min(statsLevels.length - 1, Number(statsUi.level[key] ?? 2)))
      ensureStatsAdminLabels(lvIdx, ring)
    }
    // #region debug-point A:render-start
    statsBlankChartDebug("A", "renderCard start", {
      key,
      ringLength: Array.isArray(ring) ? ring.length : -1,
      elWidth: chartEl?.clientWidth ?? -1,
      elHeight: chartEl?.clientHeight ?? -1,
      chartWidth: chart.getWidth?.() ?? -1,
      chartHeight: chart.getHeight?.() ?? -1
    })
    // #endregion
    if (!Array.isArray(ring) || ring.length < 3) {
      statsDataByKey.set(key, [])
      chart.clear?.()
      updateCardState(key, { loading: false, empty: true, error: null })
      // #region debug-point D:render-empty-ring
      statsBlankChartDebug("D", "renderCard empty: invalid ring", {
        key,
        ringLength: Array.isArray(ring) ? ring.length : -1
      })
      // #endregion
      return
    }
    const rows = buildCardData(key)
    statsDataByKey.set(key, rows)
    if (!rows.length) {
      chart.clear?.()
      updateCardState(key, { loading: false, empty: true, error: null })
      // #region debug-point D:render-empty-rows
      statsBlankChartDebug("D", "renderCard empty: no rows", { key })
      // #endregion
      return
    }
    const option = buildEChartsOption(key, rows)
    // #region debug-point C:set-option-before
    statsBlankChartDebug("C", "renderCard before setOption", {
      key,
      rowsLength: rows.length,
      firstLabel: getCardLabel(rows[0] || {}),
      chartWidth: chart.getWidth?.() ?? -1,
      chartHeight: chart.getHeight?.() ?? -1
    })
    // #endregion
    chart.setOption(option as any, true)
    updateCardState(key, { loading: false, empty: false, error: null })
    // #region debug-point C:set-option-after
    statsBlankChartDebug("C", "renderCard after setOption", {
      key,
      rowsLength: rows.length,
      state: getCardState(key)
    })
    // #endregion
  } catch (error: any) {
    statsDataByKey.set(key, [])
    chart.clear?.()
    updateCardState(key, { loading: false, empty: false, error: error?.message || "图表渲染失败" })
    // #region debug-point C:set-option-error
    statsBlankChartDebug("C", "renderCard error", {
      key,
      error: error?.message || "unknown"
    })
    // #endregion
  }
}

function refreshStats(showToast = true) {
  ;(orderedStatsCards.value || []).forEach((c: any) => {
    const key = c.key as StatsCardKey
    if (!chartInstances.has(key) && chartEls.get(key)) {
      initOrReinitChart(key)
    }
    renderCard(key)
    if (statsUi.onMap[key]) {
      renderOverlayForCard(key)
    }
  })
  if (showToast) {
    $message("已刷新", "success")
  }
}

function closeStats() {
  statsVisible.value = false
  statsUi.reorderMode = false
}

function closeIdentify() {
  identifyVisible.value = false
  clearIdentifyResult()
}

let widgetVisibleHandler: EventListener | null = null
let modalOpenHandler: EventListener | null = null
let workspaceClearHandler: EventListener | null = null

function clearWorkspaceLayers(_options?: { clearStorage?: boolean }) {
  if (!map) {
    return
  }
  clearIdentifyResult()
  Object.keys(statsUi.onMap).forEach((key) => {
    statsUi.onMap[key] = false
    clearOverlayForCard(key)
  })
  statsOverlayLayer?.setShow?.(false)
  if (drawingOverviewCamera && typeof map.setCameraView === "function") {
    try {
      map.setCameraView(drawingOverviewCamera, { duration: 0.8 })
    } catch {
    }
  }
  map.scene?.requestRender?.()
}

function setChartEl(key: string, el: HTMLElement | null) {
  if (!key) {
    return
  }
  if (!el) {
    chartEls.delete(key)
    const inst = chartInstances.get(key)
    if (inst && !inst.isDisposed?.()) {
      inst.dispose()
    }
    chartInstances.delete(key)
    // #region debug-point B:set-chart-el-null
    statsBlankChartDebug("B", "setChartEl cleared element", { key })
    // #endregion
    return
  }
  chartEls.set(key, el)
  // #region debug-point A:set-chart-el
  statsBlankChartDebug("A", "setChartEl assigned element", {
    key,
    width: el.clientWidth,
    height: el.clientHeight,
    offsetWidth: el.offsetWidth,
    offsetHeight: el.offsetHeight
  })
  // #endregion
  const chart = chartInstances.get(key as StatsCardKey)
  if (chart) {
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      requestAnimationFrame(() => {
        try {
          chart.resize?.()
        } catch {}
        // #region debug-point A:resize-existing-chart
        statsBlankChartDebug("A", "setChartEl resized existing chart", {
          key,
          elWidth: el.clientWidth,
          elHeight: el.clientHeight,
          chartWidth: chart.getWidth?.() ?? -1,
          chartHeight: chart.getHeight?.() ?? -1
        })
        // #endregion
      })
    }
    return
  }
  if (!chartInstances.has(key)) {
    initOrReinitChart(key as StatsCardKey)
    renderCard(key as StatsCardKey)
  }
}

async function toggleCardCollapsed(key: string) {
  statsUi.collapsed[key] = !statsUi.collapsed[key]
  await nextTick()
  const chart = chartInstances.get(key)
  if (chart) {
    try {
      chart.resize?.()
    } catch {}
  }
}

function toggleReorderMode() {
  statsUi.reorderMode = !statsUi.reorderMode
  if (!statsUi.reorderMode) {
    draggedCardKey.value = ""
    dragOverCardKey.value = ""
  }
}

function moveCard(key: string, delta: number) {
  const order = Array.isArray(statsUi.cardsOrder) ? [...statsUi.cardsOrder] : []
  const idx = order.indexOf(key)
  if (idx < 0) {
    order.push(key)
    statsUi.cardsOrder = order
    return
  }
  const next = idx + delta
  if (next < 0 || next >= order.length) {
    return
  }
  const tmp = order[next]
  order[next] = order[idx]
  order[idx] = tmp
  statsUi.cardsOrder = order
}

function reorderCard(key: string, targetKey: string) {
  if (!key || !targetKey || key === targetKey) {
    return
  }
  const order = Array.isArray(statsUi.cardsOrder) ? [...statsUi.cardsOrder] : []
  const fromIndex = order.indexOf(key)
  const toIndex = order.indexOf(targetKey)
  if (fromIndex < 0 || toIndex < 0) {
    return
  }
  order.splice(fromIndex, 1)
  order.splice(toIndex, 0, key)
  statsUi.cardsOrder = order
}

function handleCardDragStart(key: string, event: DragEvent) {
  if (!statsUi.reorderMode) {
    event.preventDefault()
    return
  }
  draggedCardKey.value = key
  dragOverCardKey.value = key
  try {
    event.dataTransfer?.setData("text/plain", key)
    event.dataTransfer!.effectAllowed = "move"
  } catch {
  }
}

function handleCardDragEnter(key: string) {
  if (!statsUi.reorderMode || !draggedCardKey.value) {
    return
  }
  dragOverCardKey.value = key
}

function handleCardDrop(key: string) {
  if (!statsUi.reorderMode || !draggedCardKey.value) {
    return
  }
  reorderCard(draggedCardKey.value, key)
  draggedCardKey.value = ""
  dragOverCardKey.value = ""
}

function handleCardDragEnd() {
  draggedCardKey.value = ""
  dragOverCardKey.value = ""
}

function adjustCardLevel(key: string, event: WheelEvent) {
  const card = statsCards.find((item) => item.key === key)
  if (!card?.hasLevel) {
    return
  }
  const current = Math.max(0, Math.min(statsLevels.length - 1, Number(statsUi.level[key] ?? 2)))
  const next = event.deltaY > 0 ? Math.min(statsLevels.length - 1, current + 1) : Math.max(0, current - 1)
  if (next === current) {
    return
  }
  statsUi.level[key] = next
}

function toggleCardOnMap(key: string) {
  const next = !statsUi.onMap[key]
  statsUi.onMap[key] = next
  if (!next) {
    clearOverlayForCard(key)
    return
  }
  renderOverlayForCard(key as StatsCardKey)
}

function clearOverlayForCard(key: string) {
  const list = statsOverlayByKey.get(key) || []
  if (statsOverlayLayer) {
    try {
      list.forEach((g) => {
        statsOverlayLabels.delete(g)
        statsOverlayLayer.removeGraphic?.(g, true)
      })
    } catch {}
  }
  statsOverlayByKey.delete(key)
}

function renderOverlayForCard(key: StatsCardKey) {
  if (!map) {
    return
  }
  ensureStatsOverlayLayer()
  clearOverlayForCard(key)
  const rows = statsDataByKey.get(key) || buildCardData(key)
  statsDataByKey.set(key, rows)
  const ring = activeRing.value
  const bbox = getRingBbox(ring)
  const center = map.getCenter?.()
  let west = bbox?.[0]
  let south = bbox?.[1]
  let east = bbox?.[2]
  let north = bbox?.[3]
  if (!bbox && center) {
    west = center.lng - 0.08
    east = center.lng + 0.08
    south = center.lat - 0.06
    north = center.lat + 0.06
  }
  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
    return
  }
  const seed = hashSeed([key, west, south, east, north])
  const rnd = mulberry32(seed)
  const n = Math.min(6, rows.length)
  const graphics: any[] = []
  const numericValues = rows.slice(0, n).map((row) => getCardValueByKey(key, row))
  const maxValue = Math.max(...numericValues, 0)
  const Cesium = (mars3d as any).Cesium
  const cameraHeight = Number(map.camera?.positionCartographic?.height ?? 50000)
  const lod = getStatsOverlayLod(cameraHeight)
  const { radius, dotSize, maxHeight } = getStatsPeakMetrics(cameraHeight)
  const peakMaxDistance = lod === "point" ? 140000 : 280000
  const samplePoint = () => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const candidate = {
        lng: (west as number) + rnd() * ((east as number) - (west as number)),
        lat: (south as number) + rnd() * ((north as number) - (south as number))
      }
      if (!ring.length || pointInRing(candidate, ring)) {
        return candidate
      }
    }
    const centroid = getRingCentroid(ring)
    return pointInRing(centroid, ring) ? centroid : { lng: west as number, lat: south as number }
  }
  for (let i = 0; i < n; i++) {
    const point = samplePoint()
    const lng = point.lng
    const lat = point.lat
    const row = rows[i] || {}
    const numericValue = getCardValueByKey(key, row)
    const ratio = maxValue > 0 ? Math.max(0.08, Math.min(1, numericValue / maxValue)) : 0.1
    const height = Math.max(800, ratio * maxHeight)
    const color = getStatsCategoryColor(key)
    const tooltip = buildStatsTooltip(key, row, ratio)
    const columnHeight = height * STATS_PRISM_HEIGHT_SCALE
    const topColor = getStatsPrismTopColor(color)
    let ground = 0
    try {
      const sampled = map.getHeight?.([lng, lat])
      if (Number.isFinite(sampled)) {
        ground = sampled
      }
    } catch {
      ground = 0
    }
    const topAlt = ground + columnHeight
    const metersPerDegLat = 111320
    const metersPerDegLng = Math.max(1, metersPerDegLat * Math.cos((lat * Math.PI) / 180))
    const span = Math.max(radius * 6, maxHeight * 0.22) * Math.sqrt(STATS_PRISM_FOOTPRINT_AREA_SCALE)
    const currentArea = span * (span * 0.72)
    const squareSide = Math.sqrt(currentArea * STATS_PRISM_SQUARE_AREA_SCALE)
    const halfLng = squareSide / 2 / metersPerDegLng
    const halfLat = squareSide / 2 / metersPerDegLat
    const footprint = [
      [lng - halfLng, lat - halfLat],
      [lng + halfLng, lat - halfLat],
      [lng + halfLng, lat + halfLat],
      [lng - halfLng, lat + halfLat]
    ]
    const columnAttr = {
      statsKey: key,
      row,
      value: numericValue,
      height,
      ratio,
      visualType: "peak-main"
    }
    footprint.forEach((corner, faceIndex) => {
      const next = footprint[(faceIndex + 1) % footprint.length]
      const faceColor = getStatsPrismFaceColor(color, faceIndex)
      const wallGraphic = new mars3d.graphic.WallEntity({
        positions: [
          [corner[0], corner[1], ground],
          [next[0], next[1], ground]
        ],
        style: {
          diffHeight: columnHeight,
          materialType: "Color",
          color: faceColor,
          opacity: 1,
          outline: false,
          closure: false,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, peakMaxDistance)
        },
        tooltip,
        popup: tooltip,
        attr: columnAttr
      })
      statsOverlayLayer.addGraphic(wallGraphic)
      applyOpaqueGradient(wallGraphic, faceColor)
      graphics.push(wallGraphic)
    })
    const topGraphic = new mars3d.graphic.PolygonEntity({
      positions: footprint.map(([cornerLng, cornerLat]) => [cornerLng, cornerLat, topAlt]),
      style: {
        height: topAlt,
        perPositionHeight: true,
        color: topColor,
        opacity: 1,
        outline: false,
        clampToGround: false,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, peakMaxDistance)
      },
      tooltip,
      popup: tooltip,
      attr: columnAttr
    })
    statsOverlayLayer.addGraphic(topGraphic)
    graphics.push(topGraphic)

    const dotGraphic = new mars3d.graphic.PointEntity({
      position: [lng, lat, 8],
      style: {
        color,
        pixelSize: dotSize,
        outline: true,
        outlineColor: mixHexColor(color, "#ffffff", 0.72),
        outlineWidth: 2,
        clampToGround: false,
        scaleByDistance: new Cesium.NearFarScalar(5000, 1.15, 260000, 0.35),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(90000, 2000000)
      },
      tooltip,
      popup: tooltip,
      attr: {
        statsKey: key,
        row,
        value: numericValue,
        height,
        ratio,
        visualType: "dot-far"
      }
    })
    statsOverlayLayer.addGraphic(dotGraphic)
    graphics.push(dotGraphic)

    const labelGraphic = new mars3d.graphic.PointEntity({
      position: [lng, lat, topAlt],
      style: {
        color: topColor,
        pixelSize: 1,
        outline: false,
        clampToGround: false,
        show: true,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 180000),
        label: {
          text: formatCardValue(key, numericValue),
          color: "#1a1a1a",
          outline: true,
          outlineColor: "#ffffff",
          outlineWidth: 3,
          font_size: 13,
          font_weight: "bold",
          horizontalOrigin: (mars3d as any).Cesium?.HorizontalOrigin?.CENTER,
          verticalOrigin: (mars3d as any).Cesium?.VerticalOrigin?.BOTTOM,
          pixelOffsetY: -4
        }
      },
      tooltip,
      popup: tooltip,
      attr: {
        statsKey: key,
        row,
        value: numericValue,
        height,
        ratio,
        visualType: "label-top"
      }
    })
    statsOverlayLayer.addGraphic(labelGraphic)
    graphics.push(labelGraphic)
    statsOverlayLabels.set(topGraphic, labelGraphic)

    // Keep overlay rendering side-effect free: drawing statistics must never
    // change the user's current map view or camera position.
  }
  statsOverlayByKey.set(key, graphics)
}

function scheduleStatsOverlayCameraUpdate() {
  if (statsOverlayCameraTimer != null || !map) {
    return
  }
  statsOverlayCameraTimer = window.setTimeout(() => {
    statsOverlayCameraTimer = null
    if (!map || !statsOverlayLayer) {
      return
    }
    // Keep existing graphics during camera motion. Rebuilding the layer here
    // causes the columns to disappear briefly on every cameraChanged event.
    map.scene?.requestRender?.()
  }, 120)
}

function bindStatsOverlayCameraAdapter() {
  if (!map || statsOverlayCameraHandler) {
    return
  }
  statsOverlayCameraHandler = scheduleStatsOverlayCameraUpdate
  map.on(mars3d.EventType.cameraChanged, statsOverlayCameraHandler)
}

function unbindStatsOverlayCameraAdapter() {
  if (statsOverlayCameraTimer != null) {
    window.clearTimeout(statsOverlayCameraTimer)
    statsOverlayCameraTimer = null
  }
  if (map && statsOverlayCameraHandler) {
    map.off(mars3d.EventType.cameraChanged, statsOverlayCameraHandler)
  }
  statsOverlayCameraHandler = null
}

function downloadDataUrl(filename: string, dataUrl: string) {
  try {
    const a = document.createElement("a")
    a.href = dataUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch {
    $message("下载失败")
  }
}

function exportCardExcel(key: string) {
  const rows = statsDataByKey.get(key) || []
  if (!rows.length) {
    $message("暂无可导出的数据")
    return
  }
  try {
    const wb = XLSX.utils.book_new()
    const baseSheet = XLSX.utils.json_to_sheet([
      { 指标: "占地面积", 值: baseAreaText.value },
      { 指标: "人口总数", 值: basePopulationText.value },
      { 指标: "经济总量", 值: baseEconomyText.value },
      { 指标: "行政区划", 值: baseAdminText.value }
    ])
    XLSX.utils.book_append_sheet(wb, baseSheet, "基础总览")
    const dataSheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, dataSheet, "卡片数据")
    const title = statsCards.find((c) => c.key === key)?.title || key
    XLSX.writeFile(wb, `${title}_${Date.now()}.xlsx`)
    $message("已导出Excel", "success")
  } catch {
    $message("导出失败")
  }
}

function exportCardImage(key: string) {
  const chart = chartInstances.get(key)
  if (!chart) {
    $message("图表未就绪")
    return
  }
  try {
    const theme = getThemeName()
    const bg = theme === "dark" ? "#141414" : "#ffffff"
    const dataUrl = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: bg })
    const title = statsCards.find((c) => c.key === key)?.title || key
    downloadDataUrl(`${title}_${Date.now()}.png`, dataUrl)
    $message("已导出图片", "success")
  } catch {
    $message("导出失败")
  }
}

function exportCardPdf(key: string) {
  const title = statsCards.find((c) => c.key === key)?.title || key
  const rows = statsDataByKey.get(key) || []
  const chart = chartInstances.get(key)
  if (!chart) {
    $message("图表未就绪")
    return
  }
  try {
    const theme = getThemeName()
    const bg = theme === "dark" ? "#141414" : "#ffffff"
    const img = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: bg })
    const w = window.open("", "_blank")
    if (!w) {
      $message("浏览器拦截了弹窗")
      return
    }
    const tableRows = rows
      .slice(0, 30)
      .map((r) => `<tr>${Object.values(r).map((v) => `<td>${String(v ?? "")}</td>`).join("")}</tr>`)
      .join("")
    const tableHead = rows.length ? `<tr>${Object.keys(rows[0]).map((k) => `<th>${k}</th>`).join("")}</tr>` : ""
    w.document.open()
    w.document.write(
      `
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>${title}</title>
          <style>
            body{font-family:Arial,Helvetica,sans-serif;padding:16px;}
            h1{font-size:16px;margin:0 0 10px;}
            .meta{font-size:12px;color:#666;margin-bottom:10px;}
            img{width:100%;max-width:980px;border:1px solid #ddd;}
            table{border-collapse:collapse;margin-top:10px;font-size:12px;}
            th,td{border:1px solid #ddd;padding:6px 8px;}
            th{background:#f5f5f5;}
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">占地面积：${baseAreaText.value}；人口总数：${basePopulationText.value}；经济总量：${baseEconomyText.value}</div>
          <img src="${img}" />
          ${rows.length ? `<table>${tableHead}${tableRows}</table>` : ""}
          <script>
            setTimeout(() => { window.print(); }, 300);
          </` +
        `script>
        </body>
      </html>
    `
    )
    w.document.close()
    $message("已打开打印窗口", "success")
  } catch {
    $message("导出失败")
  }
}

const handleViewportResize = throttle(() => {
  viewport.w = window.innerWidth
  viewport.h = window.innerHeight
  nextTick(() => {
    if (statsVisible.value) {
      clampStatsPanelToMap()
    }
    resizeAllCharts()
  })
}, 120)

function setupStatsThemeObserver() {
  if (statsThemeObserver) {
    return
  }
  statsThemeObserver = new MutationObserver((muts) => {
    const changed = muts.some((m) => m.type === "attributes" && m.attributeName === "data-theme")
    if (!changed) {
      return
    }
    ;(orderedStatsCards.value || []).forEach((c: any) => initOrReinitChart(c.key))
    nextTick(() => {
      ;(orderedStatsCards.value || []).forEach((c: any) => renderCard(c.key))
      resizeAllCharts()
    })
  })
  statsThemeObserver.observe(document.documentElement, { attributes: true })
}

function stopAutoRefresh() {
  if (statsAutoTimer != null) {
    window.clearInterval(statsAutoTimer)
    statsAutoTimer = null
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  if (!statsUi.autoRefresh) {
    return
  }
  statsAutoTimer = window.setInterval(() => {
    if (statsVisible.value) {
      refreshStats(false)
    }
  }, 10000)
}

watch(
  () => statsVisible.value,
  async (v) => {
    if (!v) {
      return
    }
    ensureStatsRingForPanel()
    await nextTick()
    clampStatsPanelToMap()
    setupStatsThemeObserver()
    ;(orderedStatsCards.value || []).forEach((c: any) => {
      const key = c.key as StatsCardKey
      if (chartEls.get(key) && !chartInstances.has(key)) {
        initOrReinitChart(key)
      }
    })
    refreshStats()
    startAutoRefresh()
  }
)

watch(
  () => statsUi.autoRefresh,
  () => startAutoRefresh()
)

watch(
  () => ({ ...statsUi.level }),
  () => {
    if (!statsVisible.value) {
      return
    }
    ;(orderedStatsCards.value || []).forEach((c: any) => {
      const key = c.key as StatsCardKey
      if (chartInstances.has(key)) {
        renderCard(key)
      }
      if (statsUi.onMap[key]) {
        renderOverlayForCard(key)
      }
    })
  },
  { deep: true }
)

function classifyRingSource(ring: RingLonLat): "selection" | "buffer" {
  if (Array.isArray(ring) && ring.length >= 50 && ring.length <= 80) {
    return "buffer"
  }
  return "selection"
}

function getViewRectangleRing(): RingLonLat | null {
  if (!map) {
    return null
  }
  try {
    const Cesium = mars3d.Cesium
    const rect = map.camera?.computeViewRectangle?.()
    if (!rect) {
      return null
    }
    const west = Cesium.Math.toDegrees(rect.west)
    const south = Cesium.Math.toDegrees(rect.south)
    const east = Cesium.Math.toDegrees(rect.east)
    const north = Cesium.Math.toDegrees(rect.north)
    return normalizeRing([
      [west, south],
      [east, south],
      [east, north],
      [west, north]
    ])
  } catch {
    return null
  }
}

function ensureStatsRingForPanel() {
  if (activeRing.value && activeRing.value.length >= 3) {
    return
  }
  const ring = getViewRectangleRing()
  if (ring && ring.length >= 3) {
    updateMetrics(ring, "view")
  }
}

function openStatsPanel() {
  ensureStatsRingForPanel()
  const levelsToWarm = Array.from(
    new Set(
      statsCards
        .filter((item) => item.hasLevel)
        .map((item) => Math.max(0, Math.min(statsLevels.length - 1, Number(statsUi.level[item.key] ?? 2))))
    )
  )
  levelsToWarm.forEach((levelIdx) => prewarmStatsAdminHierarchy(levelIdx, activeRing.value))
  statsVisible.value = true
}

function updateMetrics(ring: RingLonLat, source?: "selection" | "buffer" | "view") {
  activeRing.value = ring
  statsRingMeta.source = source || (ring && ring.length >= 3 ? classifyRingSource(ring) : "none")
  const next = estimateMetrics(ring, model)
  metrics.areaM2 = next.areaM2
  metrics.perimeterM = next.perimeterM
  metrics.population = next.population
  metrics.lossYuan = next.lossYuan
  const levelsToWarm = Array.from(
    new Set(
      statsCards
        .filter((item) => item.hasLevel)
        .map((item) => Math.max(0, Math.min(statsLevels.length - 1, Number(statsUi.level[item.key] ?? 2))))
    )
  )
  levelsToWarm.forEach((levelIdx) => prewarmStatsAdminHierarchy(levelIdx, ring))
  if (statsVisible.value) {
    refreshStats(false)
  }
}

function exportJSON() {
  try {
    const payload = metricsToJSONPayload(activeRing.value, model, metrics)
    mars3d.Util.downloadFile(`综合统计面板_${Date.now()}.json`, JSON.stringify(payload, null, 2))
    $message("已导出JSON", "success")
  } catch {
    $message("导出失败")
  }
}

function exportCSV() {
  try {
    const csv = metricsToCSV(model, metrics)
    mars3d.Util.downloadFile(`综合统计面板_${Date.now()}.csv`, csv)
    $message("已导出CSV", "success")
  } catch {
    $message("导出失败")
  }
}

function buildStatsPlaybackTitle() {
  let sourceLabel = "圈选区域"
  if (statsRingMeta.source === "view") {
    sourceLabel = "视图范围"
  } else if (statsRingMeta.source === "buffer") {
    sourceLabel = "缓冲区"
  }
  return `${sourceLabel} · ${new Date().toLocaleString()}`
}

function saveStatsPlayback() {
  const ring = cloneRing(activeRing.value)
  if (ring.length < 3) {
    $message("暂无可保存的统计结果")
    return
  }
  const record: StatsPlaybackRecord = {
    id: `stats_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    title: buildStatsPlaybackTitle(),
    ring,
    source: statsRingMeta.source,
    metrics: {
      areaM2: Number(metrics.areaM2 || 0),
      perimeterM: Number(metrics.perimeterM || 0),
      population: Number(metrics.population || 0),
      lossYuan: Number(metrics.lossYuan || 0)
    },
    model: {
      populationDensityPerKm2: Number(model.populationDensityPerKm2 || 0),
      lossPerPersonYuan: Number(model.lossPerPersonYuan || 0)
    },
    unitPrefs: {
      area: unitPrefs.area,
      distance: unitPrefs.distance,
      population: unitPrefs.population,
      money: unitPrefs.money
    },
    statsUi: snapshotStatsUi()
  }
  const next = [record, ...readStatsPlaybackRecords()].slice(0, statsPlaybackMaxRecords)
  writeStatsPlaybackRecords(next)
  loadStatsPlaybackRecords()
  statsPlaybackVisible.value = true
  $message("已保存统计快照", "success")
}

function toggleStatsPlaybackVisible() {
  statsPlaybackVisible.value = !statsPlaybackVisible.value
  if (statsPlaybackVisible.value) {
    loadStatsPlaybackRecords()
  }
}

async function applyStatsPlayback(record: StatsPlaybackRecord) {
  if (!record?.ring?.length) {
    $message("回放记录无效")
    return
  }
  Object.assign(unitPrefs, record.unitPrefs || {})
  Object.assign(model, record.model || {})
  statsUi.autoRefresh = !!record.statsUi?.autoRefresh
  statsUi.cardsOrder = Array.isArray(record.statsUi?.cardsOrder) ? [...record.statsUi.cardsOrder] : [...statsUi.cardsOrder]
  Object.keys(statsUi.collapsed).forEach((key) => {
    statsUi.collapsed[key] = false
  })
  Object.assign(statsUi.collapsed, record.statsUi?.collapsed || {})
  Object.keys(statsUi.level).forEach((key) => {
    statsUi.level[key] = 2
  })
  Object.assign(statsUi.level, record.statsUi?.level || {})
  Object.keys(statsUi.onMap).forEach((key) => {
    statsUi.onMap[key] = false
    clearOverlayForCard(key)
  })
  updateMetrics(cloneRing(record.ring), record.source === "none" ? undefined : record.source)
  Object.assign(statsUi.onMap, record.statsUi?.onMap || {})
  statsVisible.value = true
  await nextTick()
  refreshStats(false)
  ;(orderedStatsCards.value || []).forEach((c: any) => {
    const key = c.key as StatsCardKey
    if (statsUi.onMap[key]) {
      renderOverlayForCard(key)
    }
  })
  $message("已回放统计快照", "success")
}

function removeStatsPlayback(id: string) {
  if (!id) {
    return
  }
  writeStatsPlaybackRecords(readStatsPlaybackRecords().filter((item) => item.id !== id))
  loadStatsPlaybackRecords()
}

function clearStatsPlaybackRecords() {
  writeStatsPlaybackRecords([])
  loadStatsPlaybackRecords()
  $message("已清空统计快照", "success")
}

function formatStatsPlaybackDesc(record: StatsPlaybackRecord) {
  const area = formatArea(Number(record?.metrics?.areaM2 || 0), record?.unitPrefs?.area || "km2")
  const population = formatPopulation(Number(record?.metrics?.population || 0), record?.unitPrefs?.population || "wan")
  return `${new Date(record.ts).toLocaleString()} · ${area} · ${population}`
}

function openResultPlayback() {
  activate({ name: "result-playback" })
}

function prepareRegionExtract() {
  const ring = activeRing.value
  if (!ring || ring.length < 3) {
    $message("暂无可提取的区域")
    return
  }
  try {
    const payload = { region: ring, time: Date.now() }
    localStorage.setItem("mars3d_region_extract_ready", JSON.stringify(payload))
    $message("已准备数据提取", "success")
  } catch {
    $message("数据提取准备失败")
  }
}

function exportIdentifyGeoJSON() {
  if (!identify.geojson) {
    $message("暂无异常识别结果")
    return
  }
  try {
    mars3d.Util.downloadFile(`异常识别_${identify.category}_${Date.now()}.geojson`, JSON.stringify(identify.geojson, null, 2))
    $message("已导出GeoJSON", "success")
  } catch {
    $message("导出失败")
  }
}

function exportIdentifyCSV() {
  if (!identify.geojson) {
    $message("暂无异常识别结果")
    return
  }
  try {
    const header = ["idx", "title", "level", "lng", "lat", "meta"].join(",")
    const rows = identify.items.map((it) => {
      const safe = (v: any) => {
        const s = String(v ?? "")
        if (/[",\n]/.test(s)) {
          return `"${s.replaceAll('"', '""')}"`
        }
        return s
      }
      return [it.idx, it.title, it.level, it.lng.toFixed(6), it.lat.toFixed(6), it.meta].map(safe).join(",")
    })
    mars3d.Util.downloadFile(`异常识别_${identify.category}_${Date.now()}.csv`, [header, ...rows].join("\n"))
    $message("已导出CSV", "success")
  } catch {
    $message("导出失败")
  }
}

function openIdentifyPanel() {
  identifyVisible.value = true
  nextTick(() => {
    clampIdentifyPanelToMap()
  })
}

function selectIdentifyItem(idx: number) {
  const action = getIdentifyFocusAction(identify.category, identify.selectedIdx, idx)
  if (action === "restore") {
    restorePrecursorOverview()
    return
  }
  if (identify.category === "precursor" && identify.selectedIdx == null && map && typeof map.getCameraView === "function") {
    try {
      precursorOverviewCamera = { ...map.getCameraView() }
    } catch {
      precursorOverviewCamera = null
    }
  }
  identify.selectedIdx = idx
  flyToIdentifyItem(idx)
}

function restorePrecursorOverview() {
  if (identify.category !== "precursor" || !map || !precursorOverviewCamera) {
    return
  }
  try {
    if (identifySelectedGraphic && typeof identifySelectedGraphic.closeHighlight === "function") {
      identifySelectedGraphic.closeHighlight()
    }
    map.setCameraView(precursorOverviewCamera, { duration: 0.8 })
  } catch {
  }
  identifySelectedGraphic = null
  identify.selectedIdx = null
  precursorOverviewCamera = null
}

function flyToIdentifyItem(idx: number) {
  const it = identify.items.find((x) => x.idx === idx)
  if (!it || !map) {
    return
  }
  const graphic = identifyGraphicByIdx.get(idx)
  if (graphic) {
    try {
      if (identifySelectedGraphic && typeof identifySelectedGraphic.closeHighlight === "function") {
        identifySelectedGraphic.closeHighlight()
      }
    } catch {}
    identifySelectedGraphic = graphic
    graphic.flyTo?.({ radius: 1800 })
    graphic.openHighlight?.()
    return
  }
  try {
    const cartesian = mars3d.Cesium.Cartesian3.fromDegrees(it.lng, it.lat, 0)
    map.flyToPoint(cartesian, { radius: 1800, maximumHeight: map.camera.positionCartographic.height })
  } catch {}
}

function startIdentifyFromPanel() {
  const ring = activeRing.value
  if (!ring || ring.length < 3) {
    $message("暂无可识别的区域")
    return
  }
  startQuickIdentify(ring)
}

// 使用用户传入的 mapKey 拼接生成 withKeyId 作为当前显示容器的id
const withKeyId = computed(() => `mars3d-container-${props.mapKey}`)

// onload事件将在地图渲染后触发
const emit = defineEmits(["onload"])

function clearIdentifyResult() {
  try {
    if (identifyPollTimer != null) {
      window.clearTimeout(identifyPollTimer)
      identifyPollTimer = null
    }
    if (identify.jobId) {
      cancelQuickIdentifyJob(identify.jobId).catch(() => {})
    }
    identify.running = false
    identify.jobId = null
    identify.status = null
    identify.progress = 0
    identify.summary = null
    identify.error = null
    identify.items = []
    identify.selectedIdx = null
    precursorOverviewCamera = null
    identify.geojson = null

    if (identifyHeatLayer && map) {
      map.removeLayer(identifyHeatLayer, true)
      identifyHeatLayer = null
    }
    if (identifyGraphicLayer && map) {
      map.removeLayer(identifyGraphicLayer, true)
      identifyGraphicLayer = null
    }
    identifySelectedGraphic = null
    identifyGraphicByIdx = new Map<number, any>()
  } catch {}
}

async function pollIdentify(jobId: string) {
  if (!identify.running) {
    return
  }
  try {
    const st = await getQuickIdentifyJob(jobId)
    identify.status = st.status
    identify.progress = st.progress ?? identify.progress
    identify.summary = st.summary ?? null
    identify.error = st.error ?? null

    if (st.status === "done") {
      identify.running = false
      if (st.resultGeojson && map) {
        try {
          identify.geojson = st.resultGeojson
          const features = st.resultGeojson?.features ?? []
          const items: Array<{
            idx: number
            title: string
            meta: string
            lng: number
            lat: number
            level: number
            desc?: string
            mediaUrls?: string[]
            props?: any
          }> = []
          const heatPositions: Array<{ lng: number; lat: number; value: number }> = []

          if (identifyHeatLayer) {
            map.removeLayer(identifyHeatLayer, true)
            identifyHeatLayer = null
          }
          if (identifyGraphicLayer) {
            map.removeLayer(identifyGraphicLayer, true)
            identifyGraphicLayer = null
          }
          identifyGraphicLayer = new mars3d.layer.GraphicLayer({ name: "异常识别结果" })
          map.addLayer(identifyGraphicLayer)
          identifyGraphicByIdx = new Map<number, any>()
          identifyGraphicLayer.on(mars3d.EventType.click, (evt: any) => {
            const idx = Number(evt?.graphic?.attr?.idx)
            if (Number.isFinite(idx)) {
              selectIdentifyItem(idx)
            }
          })

          features.forEach((f: any, i: number) => {
            const geom = f?.geometry
            if (geom?.type !== "Point" || !Array.isArray(geom.coordinates)) {
              return
            }
            const [lng, lat] = geom.coordinates
            if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
              return
            }
            const props = f?.properties || {}
            const idx = Number(props.idx ?? i + 1)
            const kind = String(props.kind ?? identify.category)
            const level = Number(props.level ?? 1)
            const title = String(props.title ?? props.name ?? props.typeText ?? `异常点${idx}`)
            const time = props.time ? String(props.time) : ""
            const subType = String(props.macroType ?? props.subType ?? "")
            const meta = [kind, subType, time].filter(Boolean).join(" · ")

            items.push({
              idx,
              title,
              meta,
              lng,
              lat,
              level,
              desc: props.desc ? String(props.desc) : undefined,
              mediaUrls: Array.isArray(props.mediaUrls) ? props.mediaUrls : undefined,
              props
            })

            let color = "#ff4d4f"
            if (identify.category === "macro") {
              color = "#ffea00"
              if (level >= 3) {
                color = "#d50000"
              } else if (level === 2) {
                color = "#ff6d00"
              }
            }
            const graphic = new mars3d.graphic.PointEntity({
              position: [lng, lat],
              style: {
                color,
                pixelSize: 9,
                outline: true,
                outlineColor: "#ffffff",
                outlineWidth: 2,
                clampToGround: true,
                highlight: { outlineColor: "#ff4d4f", outlineWidth: 4 }
              },
              attr: { idx, ...props }
            })
            identifyGraphicLayer.addGraphic(graphic)
            identifyGraphicByIdx.set(idx, graphic)

            if (identify.category !== "macro") {
              const value = Number(props.value ?? props.temp ?? props.anomaly ?? level)
              if (Number.isFinite(value)) {
                heatPositions.push({ lng, lat, value })
              }
            }
          })

          identify.items = items
          // Precursor points remain in the user's overview until explicitly clicked.
          // Other identification categories retain their existing first-result focus.
          const defaultIdentifyIdx = items.length ? items[0].idx : null
          identify.selectedIdx = identify.category === "precursor" ? null : defaultIdentifyIdx
          if (identify.selectedIdx) {
            flyToIdentifyItem(identify.selectedIdx)
          }

          if (identify.category !== "macro" && heatPositions.length > 0) {
            identifyHeatLayer = new mars3d.layer.HeatLayer({
              name: "异常热力图",
              positions: heatPositions,
              valueColumn: "value",
              heatStyle: {
                maxOpacity: 0.85,
                minOpacity: 0.15,
                blur: 0.85,
                radius: 28,
                gradient: { 0.3: "#1b5e20", 0.55: "#66bb6a", 0.75: "#ffea00", 0.9: "#ff6d00", 1.0: "#d50000" }
              },
              style: { type: "image", opacity: 0.85, clampToGround: true }
            })
            map.addLayer(identifyHeatLayer)
          }
        } catch {}
      }
      return
    }

    if (st.status === "failed") {
      identify.running = false
      return
    }
  } catch (err: any) {
    identify.error = err?.message || "请求失败"
  }
  identifyPollTimer = window.setTimeout(() => pollIdentify(jobId), 1200)
}

async function startQuickIdentify(ring: RingLonLat) {
  clearIdentifyResult()
  identify.running = true
  identify.status = "queued"
  identify.progress = 0
  identify.error = null
  identifyVisible.value = true

  try {
    const timeRange =
      identify.dateStart && identify.dateEnd
        ? ([`${identify.dateStart}T00:00:00Z`, `${identify.dateEnd}T23:59:59Z`] as [string, string])
        : undefined
    const { jobId } = await createQuickIdentifyJob({
      regionType: "disaster",
      ring,
      category: identify.category,
      macroType: identify.macroType,
      precursorType: identify.precursorType,
      deformationMethod: identify.deformationMethod,
      timeRange,
      products: [identify.category]
    })
    identify.jobId = jobId
    identify.status = "running"
    identifyPollTimer = window.setTimeout(() => pollIdentify(jobId), 500)
  } catch (err: any) {
    identify.running = false
    identify.status = "failed"
    identify.error = err?.message || "请求失败"
  }
}

/**
 * 将右键菜单/子菜单在视口内完整显示（最小位移调整）
 */
function clampMenuWithinViewport(
  menuEl: HTMLElement,
  anchorX: number,
  anchorY: number,
  options?: { offsetX?: number; offsetY?: number; padding?: number }
) {
  const offsetX = options?.offsetX ?? 10
  const offsetY = options?.offsetY ?? 10
  const padding = options?.padding ?? 8
  const vw = window.innerWidth
  const vh = window.innerHeight

  let left = anchorX + offsetX
  let top = anchorY + offsetY
  const width = menuEl.offsetWidth || menuEl.getBoundingClientRect().width
  const height = menuEl.offsetHeight || menuEl.getBoundingClientRect().height

  if (left + width > vw - padding) {
    left = Math.max(padding, anchorX - width - offsetX)
  }
  if (left < padding) {
    left = padding
  }
  if (top + height > vh - padding) {
    top = Math.max(padding, anchorY - height - offsetY)
  }
  if (top < padding) {
    top = padding
  }

  menuEl.style.left = `${Math.round(left)}px`
  menuEl.style.top = `${Math.round(top)}px`
}

function adjustContextSubMenuPosition(parentLi: HTMLElement) {
  const subMenu = parentLi.querySelector(".mars3d-sub-menu") as HTMLElement | null
  if (!subMenu) {
    return
  }

  const padding = 8
  const parentRect = parentLi.getBoundingClientRect()
  subMenu.style.display = "block"
  subMenu.style.visibility = "hidden"
  subMenu.style.left = "calc(100% - 8px)"
  subMenu.style.right = "auto"
  subMenu.style.top = "0px"

  const subRect = subMenu.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (parentRect.right - 8 + subRect.width > vw - padding) {
    subMenu.style.left = "auto"
    subMenu.style.right = "calc(100% - 8px)"
  }

  const nextSubRect = subMenu.getBoundingClientRect()
  let topOffset = 0
  if (nextSubRect.bottom > vh - padding) {
    topOffset = vh - padding - nextSubRect.bottom
  }
  if (parentRect.top + topOffset < padding) {
    topOffset = padding - parentRect.top
  }
  subMenu.style.top = `${Math.round(topOffset)}px`
  subMenu.style.visibility = "visible"
}

/**
 * 渲染右键菜单项
 * 根据 show 函数过滤并渲染菜单项到 DOM
 */
function renderContextMenuItems(menuItems: any[], cm: any, eventArg: any) {
  const ul = cm._containerUl

  if (!ul || !menuItems) {
    return
  }

  // 清空现有内容
  ul.innerHTML = ""

  const safeEval = (v: any, fallback: any) => {
    if (typeof v === "function") {
      try {
        return v(eventArg)
      } catch {
        return fallback
      }
    }
    return v ?? fallback
  }

  const closeMenu = () => {
    cm._container.style.display = "none"
    if (cm._containerUl) {
      cm._containerUl.style.display = "none"
    }
  }

  // 遍历菜单项并渲染
  menuItems.forEach((item: any, idx: number) => {
    // 检查 show 函数
    const shouldShow = !!safeEval(item.show, true)

    if (!shouldShow) {
      return
    }

    const li = document.createElement("li")
    li.setAttribute("data-index", String(idx))

    if (item.type === "line") {
      li.className = "mars3d-contextmenu-divider"
    } else {
      li.className = "mars3d-contextmenu-item"

      const disabled = !!safeEval(item.disabled, false)
      const disabledReason = String(safeEval(item.disabledReason, ""))
      if (disabled) {
        li.className += " is-disabled"
        if (disabledReason) {
          li.title = disabledReason
        }
      }

      const a = document.createElement("a")
      a.href = "javascript:void(0)"

      if (item.icon) {
        const icon = document.createElement("i")
        icon.className = "mars3d-contextmenu-icon " + item.icon
        a.appendChild(icon)
      }

      const text = safeEval(item.text, "")
      a.appendChild(document.createTextNode(String(text)))
      li.appendChild(a)

      // 子菜单处理
      if (item.children && item.children.length > 0) {
        li.className += " mars3d-contextmenu-hasChildren"

        const subUl = document.createElement("ul")
        subUl.className = "mars3d-sub-menu"

        item.children.forEach((subItem: any) => {
          const subShouldShow = !!safeEval(subItem.show, true)
          if (!subShouldShow) {
            return
          }
          const subLi = document.createElement("li")
          const subA = document.createElement("a")
          subA.href = "javascript:void(0)"
          const subDisabled = !!safeEval(subItem.disabled, false)
          const subDisabledReason = String(safeEval(subItem.disabledReason, ""))
          if (subDisabled) {
            subLi.className = "is-disabled"
            if (subDisabledReason) {
              subLi.title = subDisabledReason
            }
          }
          if (subItem.icon) {
            const subIcon = document.createElement("i")
            subIcon.className = "mars3d-contextmenu-icon " + subItem.icon
            subA.appendChild(subIcon)
          }
          const subText = safeEval(subItem.text, "")
          subA.appendChild(document.createTextNode(String(subText)))
          subLi.appendChild(subA)

          if (subItem.callback && !subDisabled) {
            subLi.onclick = (e) => {
              e.stopPropagation()
              subItem.callback(eventArg)
              closeMenu()
            }
          } else if (subDisabled) {
            subLi.onclick = (e) => {
              e.stopPropagation()
              if (subDisabledReason) {
                $message(subDisabledReason, "info")
              }
            }
          }

          subUl.appendChild(subLi)
        })

        li.appendChild(subUl)

        li.addEventListener("mouseenter", () => {
          subUl.style.display = "block"
          requestAnimationFrame(() => adjustContextSubMenuPosition(li))
        })

        li.addEventListener("mouseleave", () => {
          subUl.style.display = "none"
          subUl.style.visibility = "hidden"
        })
      }

      // 点击事件
      if (item.callback && !disabled) {
        li.onclick = () => {
          item.callback(eventArg)
          closeMenu()
        }
      } else if (disabled) {
        li.onclick = () => {
          if (disabledReason) {
            $message(disabledReason, "info")
          }
        }
      }
    }

    ul.appendChild(li)
  })
}

const initMars3d = async () => {
  // 获取配置
  let mapOptions
  if (props.url) {
    // 存在url时才读取
    mapOptions = await mars3d.Util.fetchJson({ url: props.url })
    if (mapOptions) {
      mapOptions.layers = removeRetiredLayers(mapOptions.layers || [])
      mapOptions.basemaps = removeRetiredLayers(mapOptions.basemaps || [])
    }
  }

  if (props.options) {
    // 存在叠加的属性时
    let exOptions
    if (props.options.then) {
      exOptions = toRaw(await props.options)
    } else {
      exOptions = toRaw(props.options)
    }

    if (mapOptions) {
      mapOptions = mars3d.Util.merge(mapOptions, exOptions) // 合并配置
    } else {
      mapOptions = exOptions
    }
  }

  logInfo("地图构造参数", mapOptions)

  const bingKey = import.meta.env.VITE_BING_KEY || import.meta.env.VITE_BING_MAPS_KEY
  if (bingKey && (mars3d.Cesium as any)?.BingMapsApi) {
    ;(mars3d.Cesium as any).BingMapsApi.defaultKey = bingKey
  }

  mars3dVersionMatched = isMars3dExactVersion("3.10.12")
  map = new mars3d.Map(withKeyId.value, mapOptions)
  bindStatsOverlayCameraAdapter()
  try {
    const containerEl = document.getElementById(withKeyId.value)
    startNoWatermarkGuard(containerEl, map)
  } catch {
  }
  restoreBasemapFromStorage()

  // 针对不同终端的优化配置
  if (mars3d.Util.isPCBroswer()) {
    map.zoomFactor = 2.0 // 滚轮放大的步长参数

    // 注意：requestRenderMode 已禁用，因为会导致图层切换后地图不更新的问题
    // 如果确实需要启用按需渲染，必须确保所有图层操作都调用 scene.requestRender()
    // map.scene.requestRenderMode = true

    // IE浏览器额外优化
    if (window.navigator.userAgent.toLowerCase().indexOf("msie") >= 0) {
      map.viewer.targetFrameRate = 20 // 限制帧率
    }
  } else {
    map.zoomFactor = 5.0 // 滚轮放大的步长参数

    // 移动设备优化
    // 注意：requestRenderMode 已禁用，因为会导致图层切换后地图不更新的问题
    // map.scene.requestRenderMode = true
    map.scene.fog.enabled = false
    map.scene.skyAtmosphere.show = false
    map.scene.globe.showGroundAtmosphere = false
  }

  // 二三维切换不用动画
  if (map.viewer.sceneModePicker) {
    map.viewer.sceneModePicker.viewModel.duration = 0.0
  }

  // 自定义右键菜单配置（存储在私有变量中，不通过 map.bindContextMenu 暴露给 mars3d 框架，
  // 避免框架内部也读取并渲染同一份配置导致 UI 风格随机切换）
  const customContextMenuConfig = getContextMenu()

  // 禁用 mars3d 框架 contextmenu 控件，确保不会自动弹出
  try {
    const cmCtrl: any = (map as any).contextmenu
    if (cmCtrl) {
      cmCtrl.enabled = false
    }
  } catch {
    // 忽略
  }

  // 替换 Mars3D 默认 contextmenu：自行拾取对象并渲染菜单，确保 UI 风格一致
  const canvas = map.viewer.canvas as HTMLCanvasElement
  const Cesium = mars3d.Cesium

  canvas.oncontextmenu = function (e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    const cm: any = (map as any).contextmenu
    if (!cm) {
      return false
    }

    // 确保仅保留一层菜单 DOM
    if (cm._container) {
      cm._container.style.display = "none"
    }
    if (cm._containerUl) {
      cm._containerUl.style.display = "none"
    }
    cm._show = false

    // 初始化 _eventResult 如果不存在
    if (!cm._eventResult) {
      cm._eventResult = {}
    }

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // 使用 Cesium 获取点击位置的地理坐标
    const cartesian = map.viewer.camera.pickEllipsoid(
      new Cesium.Cartesian2(x, y),
      map.viewer.scene.globe.ellipsoid
    )

    // 检测点击位置的图形对象（用于上下文菜单判断）
    // 性能优化：使用 Map 缓存 primitive -> graphic 映射，O(1) 查找
    let pickedGraphic = null
    let pickedLayer = null
    try {
      const scene = map.viewer.scene
      const graphicLayer = map.graphicLayer

      // 获取 graphicLayer 的所有 graphics
      const graphics = graphicLayer.getGraphics?.() || []

      // 性能优化：构建 primitive -> graphic 的快速查找映射
      const primitiveMap = new Map<any, any>()
      const entityMap = new Map<any, any>()

      for (const g of graphics) {
        if (g.primitive) {
          primitiveMap.set(g.primitive, g)
        }
        if (g._entity) {
          entityMap.set(g._entity, g)
        }
      }

      // 快速查找函数
      const findGraphicByPicked = (picked: any): any => {
        if (!picked) {
          return null
        }
        // 方式1：直接匹配 primitive
        if (picked.primitive && primitiveMap.has(picked.primitive)) {
          return primitiveMap.get(picked.primitive)
        }
        // 方式2：匹配 billboard
        if (picked.id?._billboard && primitiveMap.has(picked.id._billboard)) {
          return primitiveMap.get(picked.id._billboard)
        }
        // 方式3：匹配 entity
        if (picked.id && entityMap.has(picked.id)) {
          return entityMap.get(picked.id)
        }
        // 方式4：匹配 entity._graphic
        if (picked.id?._graphic && primitiveMap.has(picked.id._graphic)) {
          return primitiveMap.get(picked.id._graphic)
        }
        if (picked.id?.graphic && primitiveMap.has(picked.id.graphic)) {
          return primitiveMap.get(picked.id.graphic)
        }
        return null
      }

      // 方法1：使用 drillPick 获取对象（限制深度为 3）
      const drilled = scene.drillPick(new Cesium.Cartesian2(x, y), 3)

      if (drilled && drilled.length > 0) {
        for (const picked of drilled) {
          pickedGraphic = findGraphicByPicked(picked)
          if (pickedGraphic) {
            break
          }
        }
      }

      // 方法2：如果 drillPick 没找到，只搜索 4 个关键方向（性能优化：从 64 次减少到 4 次）
      if (!pickedGraphic && graphics.length > 0) {
        const searchOffsets = [
          { dx: 10, dy: 0 }, // 右
          { dx: -10, dy: 0 }, // 左
          { dx: 0, dy: 10 }, // 下
          { dx: 0, dy: -10 } // 上
        ]

        for (const { dx, dy } of searchOffsets) {
          const testPos = new Cesium.Cartesian2(x + dx, y + dy)
          const picked = scene.pick(testPos)
          if (picked) {
            pickedGraphic = findGraphicByPicked(picked)
            if (pickedGraphic) {
              break
            }
          }
        }
      }

      // 设置图层信息
      if (pickedGraphic) {
        pickedLayer = graphicLayer
      }
    } catch {
      // 忽略拾取错误
    }

    // 填充事件结果
    cm._eventResult.cartesian = cartesian
    cm._eventResult.windowCoordinates = new Cesium.Cartesian2(x, y)
    cm._eventResult.windowPosition = new Cesium.Cartesian2(x, y)
    cm._eventResult.position = new Cesium.Cartesian2(x, y)
    cm._eventResult.graphic = pickedGraphic
    cm._eventResult.layer = pickedLayer
    cm._eventResult.target = pickedGraphic || pickedLayer
    cm._eventResult.type = "contextmenu"

    // 使用自定义菜单配置渲染（不经过 mars3d 框架的菜单系统）
    renderContextMenuItems(customContextMenuConfig, cm, cm._eventResult)

    // 定位并显示菜单（必须同时设置 container 和 containerUl 的 display）
    cm._container.style.position = "fixed"
    cm._container.style.display = "block"
    cm._container.style.zIndex = "9999"
    cm._containerUl.style.display = "block"
    requestAnimationFrame(() => {
      clampMenuWithinViewport(cm._container, e.clientX, e.clientY)
    })
    cm._show = true

    return false
  }

  // 点击其他地方关闭菜单
  const closeContextMenu = () => {
    const cm: any = (map as any).contextmenu
    if (cm && cm._container) {
      cm._container.style.display = "none"
      if (cm._containerUl) {
        cm._containerUl.style.display = "none"
      }
      cm._show = false
    }
  }

  // 监听 Mars3D 左键点击关闭菜单
  map.on(mars3d.EventType.click, closeContextMenu)

  // 监听 DOM 级别点击关闭菜单（备用）
  document.addEventListener("click", (e) => {
    const cm: any = (map as any).contextmenu
    if (cm && cm._container && cm._container.style.display === "block") {
      // 检查点击是否在菜单外部
      if (!cm._container.contains(e.target as Node)) {
        cm._container.style.display = "none"
        if (cm._containerUl) {
          cm._containerUl.style.display = "none"
        }
        cm._show = false
      }
    }
  })

  loadPrefs()
  loadStatsPlaybackRecords()
  installDisasterStats()
  installThermalAnomalyShortcut()

  // webgl渲染失败后，刷新页面
  map.on(mars3d.EventType.renderError, async () => {
    await $alert("程序内存消耗过大，请重启浏览器")
    window.location.reload()
  })

  onMapLoad() // map构造完成后的一些处理

  emit("onload", map)
}

// map构造完成后的一些处理，可以按需注释和选用
function onMapLoad() {
  // Mars3D地图内部使用，如右键菜单弹窗
  // @ts-ignore
  window.globalAlert = $alert
  // @ts-ignore
  window.globalMsg = $message

  // 用于 config.json 中 西藏垭口 图层的详情按钮 演示
  // @ts-ignore
  window.showPopupDetails = (item: any) => {
    $alert(item.NAME)
  }

  // 添加图层变化监听，确保地图渲染正常
  installLayerChangeMonitor()

  // 【测试】 用于 config.json中配置的图层，绑定额外方法和参数
  const tiles3dLayer = map.getLayerById(204012) // 上海市区
  if (tiles3dLayer) {
    tiles3dLayer.options.onSetOpacity = function (opacity: number) {
      tiles3dLayer.style = {
        color: {
          conditions: [
            ["${floor} >= 200", "rgba(45, 0, 75," + 0.5 * opacity + ")"],
            ["${floor} >= 100", "rgba(170, 162, 204," + opacity + ")"],
            ["${floor} >= 50", "rgba(224, 226, 238," + opacity + ")"],
            ["${floor} >= 25", "rgba(252, 230, 200," + opacity + ")"],
            ["${floor} >= 10", "rgba(248, 176, 87," + opacity + ")"],
            ["${floor} >= 5", "rgba(198, 106, 11," + opacity + ")"],
            ["true", "rgba(127, 59, 8," + opacity + ")"]
          ]
        }
      }
    }
  }
}

/**
 * 安装图层变化监控器
 * 确保图层添加/移除/显隐时地图能正确渲染
 */
function installLayerChangeMonitor() {
  if (!map) { return }

  const layerHandlers = new WeakMap<any, { show: VoidFunction; hide: VoidFunction }>()

  const bindLayer = (layer: any) => {
    if (!layer || typeof layer.on !== "function" || typeof layer.off !== "function") {
      return
    }
    if (layerHandlers.has(layer)) {
      return
    }
    const show = () => ensureMapRender()
    const hide = () => ensureMapRender()
    layer.on(mars3d.EventType.show, show)
    layer.on(mars3d.EventType.hide, hide)
    layerHandlers.set(layer, { show, hide })
  }

  const unbindLayer = (layer: any) => {
    const h = layerHandlers.get(layer)
    if (!h || !layer || typeof layer.off !== "function") {
      return
    }
    layer.off(mars3d.EventType.show, h.show)
    layer.off(mars3d.EventType.hide, h.hide)
    layerHandlers.delete(layer)
  }

  // 监听图层添加事件
  map.on(mars3d.EventType.addLayer, (e: any) => {
    if (e?.layer) {
      bindLayer(e.layer)
    }
    ensureMapRender()
  })

  // 监听图层移除事件
  map.on(mars3d.EventType.removeLayer, (e: any) => {
    if (e?.layer) {
      unbindLayer(e.layer)
    }
    ensureMapRender()
  })

  try {
    map.getLayers()?.forEach((layer: any) => bindLayer(layer))
  } catch {}

  // 定期检查并确保地球可见（防止地图消失的最后保障）
  let lastGlobeCheckTime = 0
  const globeCheckInterval = setInterval(() => {
    if (!map || !map.scene) {
      clearInterval(globeCheckInterval)
      return
    }

    const now = Date.now()
    if (now - lastGlobeCheckTime > 2000) { // 每2秒检查一次
      lastGlobeCheckTime = now
      ensureGlobeVisible()
    }
  }, 500)

  // 保存清理函数引用
  ;(map as any)._layerMonitorCleanup = () => {
    clearInterval(globeCheckInterval)
    try {
      map.getLayers()?.forEach((layer: any) => unbindLayer(layer))
    } catch {}
  }
}

/**
 * 确保地图渲染
 * 在图层变化等操作后调用，强制触发地图重绘
 */
function ensureMapRender() {
  if (!map || !map.scene) { return }

  const scene = map.scene

  // 方式1：请求渲染
  scene.requestRender()

  // 方式2：轻微调整相机高度来触发更新（不引人注意）
  if (map.camera) {
    try {
      const camera = map.camera
      const originalHeight = camera.positionCartographic.height
      // 只在高度变化很小或静止时才触发
      if (originalHeight > 0) {
        // 不实际改变相机，只是通过 requestRender 确保渲染
      }
    } catch (e) {
      // 忽略相机操作错误
    }
  }

  // 方式3：确保时钟在走动（如果需要动画）
  if (map.viewer && map.viewer.clock && !map.viewer.clock.shouldAnimate) {
    // 不强制启用动画，只是确保渲染
  }
}

/**
 * 确保地球可见
 * 最后防线：防止地图/地球因为各种原因消失
 */
function ensureGlobeVisible() {
  if (!map || !map.scene || !map.scene.globe) { return }

  try {
    const globe = map.scene.globe

    // 确保地球显示
    if (!globe.show) {
      logInfo("检测到地球被隐藏，正在恢复...")
      globe.show = true
      map.scene.requestRender()
    }

    // 确保场景在渲染（如果之前启用了 requestRenderMode 但没有正确触发）
    if (map.scene.requestRenderMode) {
      map.scene.requestRender()
    }

    // 检查底图是否存在
    const basemaps = map.getBasemaps(true) || []
    if (basemaps.length > 0) {
      const activeBasemap = basemaps.find((b: any) => b && b.isAdded && b.show)
      const imageryCount = (map.viewer as any)?.imageryLayers?.length ?? 0
      if (imageryCount === 0) {
        const mapAny: any = map as any
        const lastUserChangeAt = Number(mapAny._lastUserBasemapChangeAt || 0)
        if (lastUserChangeAt && Date.now() - lastUserChangeAt < 4000) {
          return
        }
        const now = Date.now()
        if (mapAny._lastBasemapRestoreAt && now - mapAny._lastBasemapRestoreAt < 2000) {
          return
        }
        mapAny._lastBasemapRestoreAt = now

        const desiredId = mapAny._lastUserBasemapId
        const desired = desiredId ? basemaps.find((b: any) => b && b.id === desiredId) : null
        const candidate = desired || activeBasemap || basemaps.find((b: any) => b && b.show) || basemaps[0]
        if (candidate && candidate.id != null) {
          logInfo("检测到底图异常，正在恢复底图...")
          map.basemap = candidate.id
          map.scene.requestRender()
        }
      }
    }
  } catch (e) {
    logInfo("确保地球可见时出错", e)
  }
}

function getContextMenu() {
  const menuOptions: ContextMenuOptions = {
    onToast: (msg, type) => $message(msg, type || "info"),
    onAlert: (msg, title) => $alert(msg, title),
    onConfirm: async (title, content) => {
      return new Promise((resolve) => {
        const confirmed = window.confirm(`${title}\n\n${content}`)
        resolve(confirmed)
      })
    },
    hasPermission: (code: string) => {
      if (code.startsWith("analysis:")) {
        return true
      }
      return hasPermission(code)
    },
    onSelectBufferRadius: async (defaultRadius?: number) => {
      return new Promise((resolve) => {
        const options = [
          { label: "500m", value: 500 },
          { label: "1km", value: 1000 },
          { label: "2km", value: 2000 },
          { label: "5km", value: 5000 },
          { label: "自定义", value: -1 }
        ]
        const defaultLabel = options.find(o => o.value === (defaultRadius || 1000))?.label || "1km"
        const input = prompt(
          `请选择缓冲区半径:\n\n预设选项: 500m, 1km, 2km, 5km\n\n或直接输入数值(米):\n当前默认: ${defaultLabel}`,
          String(defaultRadius || 1000)
        )
        if (input === null) {
          resolve(null) // 用户取消
          return
        }
        const value = parseInt(input, 10)
        if (value > 0) {
          resolve(value)
        } else {
          $message("请输入有效的半径数值", "error")
          resolve(null)
        }
      })
    },
    activateWidget: (name, data) => activate({ name, data }),
    startQuickIdentify: (ring) => {
      updateMetrics(ring)
      identifyVisible.value = true
      startQuickIdentify(ring)
    },
    openDisasterStats: (ring) => {
      updateMetrics(ring)
      statsVisible.value = true
    }
  }

  return getNewContextMenu(map, menuOptions)
}

function installDisasterStats() {
  const layer: any = map.graphicLayer
  if (!layer || layer.__disasterStatsInstalled) {
    return
  }
  layer.__disasterStatsInstalled = true

  const toLonLatRing = (positions: any): RingLonLat => {
    if (!Array.isArray(positions)) {
      return []
    }
    if (positions.length >= 3 && Array.isArray(positions[0])) {
      return normalizeRing(positions)
    }
    if (positions.length >= 3 && typeof positions[0] === "object" && positions[0] && "x" in positions[0]) {
      const out: RingLonLat = []
      positions.forEach((c: any) => {
        try {
          const pt = mars3d.LngLatPoint.fromCartesian(c)
          out.push([pt.lng, pt.lat])
        } catch {}
      })
      return out
    }
    return []
  }

  const updateFromEvent = (e: any) => {
    const graphic = e?.graphic
    if (graphic?.attr?.regionType !== "disaster") {
      return
    }
    let ring = normalizeRing(graphic?.coord ?? graphic?.coordinates ?? [])
    if (ring.length < 3) {
      ring = toLonLatRing(e?.positions)
    }
    if (ring.length < 3) {
      ring = normalizeRing(e?.lnglats ?? [])
    }
    if (ring.length < 3) {
      return
    }
    updateMetrics(ring)
    statsVisible.value = true
  }

  const handleDrawCreated = (e: any) => {
    if (map && typeof map.getCameraView === "function") {
      try {
        drawingOverviewCamera = { ...map.getCameraView() }
      } catch {
        drawingOverviewCamera = null
      }
    }
    updateFromEvent(e)
  }

  // 性能优化：对高频事件使用节流（100ms），减少 CPU 占用
  const throttledUpdate = throttle(updateFromEvent, 100)

  // 存储事件处理函数引用，用于卸载时清理
  disasterStatsHandlers = { updateFromEvent, drawCreated: handleDrawCreated, throttledUpdate }

  layer.on(mars3d.EventType.drawStart, updateFromEvent)
  layer.on(mars3d.EventType.drawMouseMove, throttledUpdate) // 高频事件，节流
  layer.on(mars3d.EventType.drawAddPoint, updateFromEvent)
  layer.on(mars3d.EventType.drawCreated, handleDrawCreated)
  layer.on(mars3d.EventType.editMovePoint, throttledUpdate) // 高频事件，节流
  layer.on(mars3d.EventType.updatePosition, throttledUpdate) // 高频事件，节流
}

function installThermalAnomalyShortcut() {
  const layer: any = map.graphicLayer
  if (!layer || layer.__thermalAnomalyShortcutInstalled) {
    return
  }
  layer.__thermalAnomalyShortcutInstalled = true

  const toLonLatRing = (positions: any): RingLonLat => {
    if (!Array.isArray(positions)) {
      return []
    }
    if (positions.length >= 3 && Array.isArray(positions[0])) {
      return normalizeRing(positions)
    }
    if (positions.length >= 3 && typeof positions[0] === "object" && positions[0] && "x" in positions[0]) {
      const out: RingLonLat = []
      positions.forEach((c: any) => {
        try {
          const pt = mars3d.LngLatPoint.fromCartesian(c)
          out.push([pt.lng, pt.lat])
        } catch {}
      })
      return out
    }
    return []
  }

  // 性能优化：存储事件处理函数引用，用于卸载时清理
  thermalAnomalyHandler = (e: any) => {
    let graphic = e?.graphic
    if (!graphic) {
      return
    }

    if (graphic?.attr?.measure === true && graphic?.attr?.parentId && typeof layer.getGraphicById === "function") {
      const parent = layer.getGraphicById(graphic.attr.parentId)
      if (parent) {
        graphic = parent
      }
    }

    if (graphic?.attr?.analysisType !== "thermalAnomaly") {
      return
    }

    let ring = normalizeRing(graphic?.coord ?? graphic?.coordinates ?? [])
    if (ring.length < 3) {
      ring = toLonLatRing(graphic?.positions ?? e?.positions)
    }
    if (ring.length < 3) {
      ring = normalizeRing(e?.lnglats ?? [])
    }
    if (ring.length < 3) {
      return
    }

    updateMetrics(ring)
    identifyVisible.value = true
    startQuickIdentify(ring)
    try {
      e?.stopPropagation?.()
    } catch {}
    try {
      map.contextmenu.show = false
    } catch {}
  }

  layer.on(mars3d.EventType.rightClick, thermalAnomalyHandler)
}

// 以投影到米坐标后采用鞋带公式计算面积（km2）
function computeAreaKm2(lonlat: Array<[number, number]>): number {
  const pts = lonlat.map((p) => mars3d.PointTrans.proj4Trans([p[0], p[1]], "EPSG:4326", mars3d.CRS.CGCS2000_GK_Zone_3))
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    sum += x1 * y2 - x2 * y1
  }
  const areaMeters2 = Math.abs(sum) / 2
  return areaMeters2 / 1_000_000
}

onMounted(() => {
  window.addEventListener("resize", handleViewportResize)
  widgetVisibleHandler = ((e: Event) => {
    const detail = (e as CustomEvent).detail as any
    if (!detail?.visible) {
      return
    }
    if (statsVisible.value) {
      closeStats()
    }
    if (identifyVisible.value) {
      closeIdentify()
    }
  }) as EventListener
  modalOpenHandler = (() => {
    if (statsVisible.value) {
      closeStats()
    }
    if (identifyVisible.value) {
      closeIdentify()
    }
  }) as EventListener
  workspaceClearHandler = ((e: Event) => {
    const detail = (e as CustomEvent).detail as any
    clearWorkspaceLayers(detail || undefined)
  }) as EventListener
  window.addEventListener("mars3d:widget-visible", widgetVisibleHandler)
  window.addEventListener("mars3d:modal-open", modalOpenHandler)
  window.addEventListener("mars3d:workspace-clear", workspaceClearHandler)
  initMars3d()
})
// 组件卸载之前销毁mars3d实例
onUnmounted(() => {
  window.removeEventListener("resize", handleViewportResize)
  clearLogoPrimitiveGuard()
  if (watermarkObserver) {
    try {
      watermarkObserver.disconnect()
    } catch {}
    watermarkObserver = null
  }
  if (watermarkStyleEl) {
    try {
      watermarkStyleEl.remove()
    } catch {}
    watermarkStyleEl = null
  }
  if (widgetVisibleHandler) {
    window.removeEventListener("mars3d:widget-visible", widgetVisibleHandler)
    widgetVisibleHandler = null
  }
  if (modalOpenHandler) {
    window.removeEventListener("mars3d:modal-open", modalOpenHandler)
    modalOpenHandler = null
  }
  if (workspaceClearHandler) {
    window.removeEventListener("mars3d:workspace-clear", workspaceClearHandler)
    workspaceClearHandler = null
  }
  stopAutoRefresh()
  unbindStatsOverlayCameraAdapter()
  if (statsThemeObserver) {
    try {
      statsThemeObserver.disconnect()
    } catch {}
    statsThemeObserver = null
  }
  chartInstances.forEach((c) => {
    try {
      c.dispose?.()
    } catch {}
  })
  chartInstances.clear()
  chartEls.clear()
  statsDataByKey.clear()
  statsUpdatedAtByKey.clear()
  statsOverlayByKey.forEach((_v, k) => clearOverlayForCard(k))
  statsOverlayByKey = new Map<string, any[]>()
  if (statsOverlayLayer && map) {
    try {
      map.removeLayer(statsOverlayLayer, true)
    } catch {}
  }
  statsOverlayLayer = null

  // 性能优化：清理事件监听器，防止内存泄漏
  if (map?.graphicLayer) {
    const layer: any = map.graphicLayer
    if (disasterStatsHandlers) {
      layer.off(mars3d.EventType.drawStart, disasterStatsHandlers.updateFromEvent)
      layer.off(mars3d.EventType.drawMouseMove, disasterStatsHandlers.throttledUpdate)
      layer.off(mars3d.EventType.drawAddPoint, disasterStatsHandlers.updateFromEvent)
      layer.off(mars3d.EventType.drawCreated, disasterStatsHandlers.drawCreated)
      layer.off(mars3d.EventType.editMovePoint, disasterStatsHandlers.throttledUpdate)
      layer.off(mars3d.EventType.updatePosition, disasterStatsHandlers.throttledUpdate)
      disasterStatsHandlers = null
    }
    if (thermalAnomalyHandler) {
      layer.off(mars3d.EventType.rightClick, thermalAnomalyHandler)
      thermalAnomalyHandler = null
    }
  }

  // 清理图层监控器
  if (map && (map as any)._layerMonitorCleanup) {
    try {
      (map as any)._layerMonitorCleanup()
    } catch (e) {
      // 忽略清理错误
    }
  }

  if (map) {
    map.destroy()
    map = null
  }
  clearIdentifyResult()
  logInfo("map销毁完成", map)
})
</script>

<style lang="less">
.mars3d-host {
  position: relative;
  height: 100%;
}

.disaster-stats {
  position: absolute;
  top: 0;
  left: 0;
  right: auto;
  border: 1px solid var(--overlay-border);
  background: var(--bg-overlay);
  box-shadow: var(--overlay-shadow);
  backdrop-filter: blur(var(--overlay-blur));
  border-radius: var(--popup-radius, 8px);
  overflow: visible;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  min-height: 0;
  user-select: none;

  .ant-btn {
    border-radius: var(--popup-item-radius, 8px);
  }
}

.stats-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
  cursor: move;
  background: transparent;
  user-select: none;
  -webkit-user-select: none;
}

.stats-toolbar:focus,
.stats-toolbar:focus-visible,
.stats-toolbar:active {
  background: transparent;
  outline: none;
}

.stats-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auto-refresh {
  display: inline-flex;
  align-items: center;
}

.disaster-stats .stats-auto-refresh-switch.ant-switch {
  min-width: 46px !important;
  width: 46px !important;
  height: 24px !important;
  padding: 0 !important;
  border: 1px solid var(--overlay-border) !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.1) !important;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.14) !important;
  transition: background var(--transition-fast, 0.2s ease), border-color var(--transition-fast, 0.2s ease), box-shadow var(--transition-fast, 0.2s ease) !important;
}

.disaster-stats .stats-auto-refresh-switch.ant-switch:hover {
  border-color: rgba(45, 140, 240, 0.38) !important;
  background: rgba(45, 140, 240, 0.14) !important;
}

.disaster-stats .stats-auto-refresh-switch.ant-switch-checked {
  border-color: rgba(45, 140, 240, 0.68) !important;
  background: var(--primary-color, #2d8cf0) !important;
  box-shadow: 0 0 0 3px rgba(45, 140, 240, 0.14) !important;
}

.disaster-stats .stats-auto-refresh-switch.ant-switch .ant-switch-handle {
  top: 1px !important;
  inset-inline-start: 1px !important;
  width: 20px !important;
  height: 20px !important;
}

.disaster-stats .stats-auto-refresh-switch.ant-switch-checked .ant-switch-handle {
  inset-inline-start: calc(100% - 21px) !important;
}

.disaster-stats .stats-auto-refresh-switch.ant-switch .ant-switch-handle::before {
  border-radius: 50% !important;
  background: #ffffff !important;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.24) !important;
}

.stats-toolbar-btn,
.stats-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--transition-fast, 0.2s ease), color var(--transition-fast, 0.2s ease);

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}

.stats-fixed-top {
  flex-shrink: 0;
  display: grid;
  gap: 10px;
}

.stats-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: grid;
  gap: 10px;
  padding-right: 2px;
}

.stats-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stats-card {
  border: 1px solid var(--overlay-border);
  background: transparent;
  border-radius: var(--popup-item-radius, 8px);
  padding: 10px;
  display: grid;
  gap: 8px;
  transition: border-color 0.2s ease, background-color 0.2s ease, opacity 0.2s ease;
}

.stats-collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: var(--popup-item-radius, 8px);
}

.stats-card.is-dragging {
  opacity: 0.68;
}

.stats-card.is-drop-target {
  border-color: #1677ff;
  background: rgba(22, 119, 255, 0.08);
}

.base-card .card-title {
  font-weight: 650;
  color: var(--text-primary);
  font-size: 13px;
}

.base-lines .line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--text-primary);
  font-size: 12px;
}

.sep {
  color: var(--text-secondary);
}

.muted {
  color: var(--text-secondary);
}

.stats-cards {
  display: grid;
  gap: 10px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.card-head-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.card-name {
  font-weight: 650;
  color: var(--text-primary);
  font-size: 13px;
  white-space: nowrap;
}

.card-brief {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 340px;
}

.card-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  user-select: none;
}

.card-body {
  display: grid;
  gap: 8px;
}

.card-level {
  display: flex;
  justify-content: flex-start;
}

.chart-wrap {
  border: 1px solid var(--overlay-border);
  min-height: 220px;
  position: relative;
}

.chart-wrap.is-loading,
.chart-wrap.is-empty,
.chart-wrap.is-error {
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-status {
  color: var(--text-secondary);
  font-size: 12px;
}

.card-status.error {
  color: #ff7875;
}

.chart {
  height: 220px;
  width: 100%;
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.playback-card {
  gap: 10px;
}

.playback-list {
  display: grid;
  gap: 8px;
}

.playback-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--overlay-border);
  padding: 8px 10px;
}

.playback-main {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.playback-title {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 650;
}

.playback-meta {
  color: var(--text-secondary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playback-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.identify-panel {
  position: absolute;
  top: 12px;
  right: 384px;
  width: min(360px, calc(100vw - 24px));
  border: 1px solid var(--overlay-border);
  background: var(--bg-overlay);
  box-shadow: var(--overlay-shadow);
  backdrop-filter: blur(var(--overlay-blur));
  border-radius: var(--popup-radius, 8px);
  z-index: 9997;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.identify-panel .stats-head {
  z-index: 2;
  min-height: var(--popup-header-height, 44px);
  padding: var(--popup-header-padding, 0 12px);
  border-bottom: 1px solid var(--overlay-border);
  border-radius: var(--popup-radius, 8px) var(--popup-radius, 8px) 0 0;
  background: var(--popup-header-bg);
  backdrop-filter: blur(var(--popup-blur, 14px));
  cursor: move;
}

.identify-panel .stats-title {
  font-size: var(--popup-title-font-size, 16px);
  font-weight: var(--popup-title-font-weight, 600);
}

.identify-panel .stats-close {
  width: 32px;
  height: 32px;
  border-radius: var(--popup-item-radius, 8px);
  color: var(--text-secondary);
  font-size: 18px;
  line-height: 1;
}

.identify-panel .stats-close:hover,
.identify-panel .stats-close:focus-visible {
  color: var(--text-primary);
  background: rgba(45, 140, 240, 0.14);
  outline: none;
}

.identify-panel-body {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 10px;
  padding: 12px;
  overflow: auto;
  scrollbar-gutter: stable;
}

.identify-panel-body::-webkit-scrollbar,
.result-list::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.identify-panel-body::-webkit-scrollbar-track,
.result-list::-webkit-scrollbar-track {
  border-radius: 999px;
  background: transparent;
}

.identify-panel-body::-webkit-scrollbar-thumb,
.result-list::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(98, 112, 138, 0.42);
  background-clip: padding-box;
}

.identify-panel-body::-webkit-scrollbar-thumb:hover,
.result-list::-webkit-scrollbar-thumb:hover {
  background: rgba(45, 140, 240, 0.52);
  background-clip: padding-box;
}

.resize-handle {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  border-right: 2px solid var(--overlay-border);
  border-bottom: 2px solid var(--overlay-border);
  border-radius: 0 0 var(--popup-item-radius, 8px) 0;
}

.legend {
  display: grid;
  gap: 6px;
}

.legend-block {
  border: 1px solid var(--overlay-border);
  border-radius: var(--popup-item-radius, 8px);
  padding: 6px 8px;
}

.legend-title {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.legend-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--overlay-border);
  border-radius: 999px;
  padding: 2px 6px;
}

.swatch {
  width: 10px;
  height: 10px;
  border: 1px solid var(--overlay-border);
  border-radius: 50%;
}

.legend-text {
  color: var(--text-secondary);
  font-size: 12px;
}

.swatch.g3 { background: #1b5e20; }
.swatch.g2 { background: #66bb6a; }
.swatch.y { background: #ffea00; }
.swatch.o { background: #ff6d00; }
.swatch.red { background: #d50000; }
.swatch.sel { background: transparent; border: 2px solid #ff4d4f; width: 10px; height: 10px; }

.stats-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  user-select: none;
}

.stats-title {
  font-weight: 650;
  color: var(--text-primary);
  font-size: 14px;
  background: transparent;
  user-select: none;
  -webkit-user-select: none;
}

.stats-title:focus,
.stats-title:focus-visible,
.stats-title:active,
.stats-title::selection {
  background: transparent;
  color: var(--text-primary);
  outline: none;
}

.stats-grid {
  display: grid;
  gap: 8px;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.k {
  color: var(--text-secondary);
  font-size: 12px;
}

.v {
  color: var(--text-primary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.stats-controls,
.stats-model {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.ctrl .label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.select,
.input {
  width: 100%;
  height: 30px;
  border: 1px solid var(--overlay-border);
  background: transparent;
  color: var(--text-primary);
  padding: 0 8px;
}

.identify-panel .select,
.identify-panel .input {
  border-radius: var(--popup-item-radius, 8px);
  background: rgba(255, 255, 255, 0.08);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
}

.identify-panel .select:hover,
.identify-panel .input:hover {
  border-color: var(--border-strong);
}

.identify-panel .select:focus,
.identify-panel .input:focus {
  border-color: var(--primary);
  box-shadow: var(--focus-ring-shadow);
  outline: none;
}

.input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.unit {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.stats-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.identify-panel .stats-actions {
  justify-content: flex-start;
  flex-wrap: wrap;
}

.identify-panel .btn {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--overlay-border);
  border-radius: var(--popup-item-radius, 8px);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
}

.identify-panel .btn:hover,
.identify-panel .btn:focus-visible {
  border-color: var(--primary);
  background: rgba(45, 140, 240, 0.14);
  box-shadow: var(--focus-ring-shadow);
  outline: none;
}

.identify-panel .btn:active {
  background: rgba(45, 140, 240, 0.22);
  border-color: var(--primary-active);
}

.identify-stats-btn {
  width: 100%;
  min-height: 32px;
}

.identify-panel .btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.identify-panel .btn:disabled:hover,
.identify-panel .btn:disabled:focus-visible {
  border-color: var(--overlay-border);
  background: transparent;
}

.topn {
  width: 90px;
  height: 28px;
  padding: 0 6px;
}

.identify-top-row {
  align-items: center;
}

.identify-top-row .v {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.result-list {
  display: grid;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
  padding-top: 6px;
}

.result-item {
  border: 1px solid var(--overlay-border);
  border-radius: var(--popup-item-radius, 8px);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  padding: 8px;
  cursor: pointer;
  display: grid;
  gap: 2px;
  transition: background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.result-item:hover,
.result-item:focus-visible {
  border-color: var(--primary);
  background: rgba(45, 140, 240, 0.1);
  box-shadow: var(--focus-ring-shadow);
  outline: none;
}

.result-item.selected {
  border-color: #ff4d4f;
  background: rgba(255, 77, 79, 0.1);
}

.r-title {
  font-size: 12px;
  font-weight: 650;
}

.r-meta {
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.detail-card {
  border: 1px solid var(--overlay-border);
  border-radius: var(--popup-item-radius, 8px);
  padding: 10px;
  display: grid;
  gap: 6px;
}

.d-title {
  font-size: 13px;
  font-weight: 650;
  color: var(--text-primary);
}

.d-meta {
  font-size: 12px;
  color: var(--text-secondary);
}

.d-desc {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.4;
}

.media {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.media-img {
  width: 100%;
  border: 1px solid var(--overlay-border);
  border-radius: var(--popup-item-radius, 8px);
}

@media (max-width: 600px) {
  .disaster-stats {
    left: 12px;
    right: 12px;
    top: auto;
    bottom: 12px;
    width: auto;
  }
  .stats-controls,
  .stats-model {
    grid-template-columns: 1fr;
  }
  .identify-panel {
    left: 12px;
    right: 12px;
    top: auto;
    bottom: 12px;
    width: auto;
  }
  .resize-handle {
    display: none;
  }
}

/**给控件工具按钮栏加边框样式*/
.cesium-geocoder-searchButton,
.cesium-viewer-geocoderContainer form .cesium-geocoder-input {
  border-image: url("https://data.mars3d.cn/img/control/border.svg") 1 round stretch;
}

.mars3d-region-hover-tip {
  position: absolute;
  top: 0;
  left: 0;
  padding: 6px 8px;
  border: 1px solid var(--overlay-border);
  background: var(--bg-overlay);
  box-shadow: var(--overlay-shadow);
  backdrop-filter: blur(var(--overlay-blur));
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1;
  pointer-events: none;
  opacity: 0.95;
  transform: translate(-9999px, -9999px);
  transition: opacity var(--transition-fast), transform var(--transition-fast);
  z-index: 9999;
}

/* 自定义Popup样式*/
.mars3d-popup-btn-custom {
  padding: 3px 10px;
  border: 1px solid #209ffd;
  background: #209ffd1c;
  color: #ffffff;
}

/* 自定义Popup样式*/
.mars3d-popup-btn-custom {
  padding: 3px 10px;
  border: 1px solid #209ffd;
  background: #209ffd1c;
  color: var(--mars-text-color, #ffffff);
}
</style>
