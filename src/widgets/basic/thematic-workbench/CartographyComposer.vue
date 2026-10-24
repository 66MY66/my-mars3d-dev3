<template>
  <Teleport to="body">
    <section v-if="open" class="map-composer" :class="{ 'is-compact': dock.w < 800, 'tools-collapsed': !showTools }" :style="dockStyle" role="dialog" aria-modal="false" aria-label="专题制图排版工作台" @keydown.esc.stop="close" @focusout="flushHistory">
      <header class="composer-header">
        <strong><mars-icon icon="layout-two" :width="20" />制图排版工作台</strong>
        <div class="composer-header-actions">
          <span role="status">{{ status }}</span>
          <button type="button" title="撤销 (Ctrl+Z)" aria-label="撤销排版操作" :disabled="!canUndo" @click="travelHistory(-1)"><mars-icon icon="undo" :width="16" /></button>
          <button type="button" title="重做 (Ctrl+Shift+Z / Ctrl+Y)" aria-label="重做排版操作" :disabled="!canRedo" @click="travelHistory(1)"><mars-icon icon="redo" :width="16" /></button>
          <button type="button" :disabled="!imageReady || exporting" @click="exportImage()"><mars-icon icon="download" :width="16" />{{ exporting ? '导出中' : `导出 ${exportFormat.toUpperCase()}` }}</button>
          <button ref="returnButton" type="button" title="收起排版工作台" aria-label="收起排版工作台" @click="close"><mars-icon icon="close" :width="16" /></button>
        </div>
      </header>
      <div class="composer-body">
        <aside class="composer-sidebar" aria-label="制图工具">
          <div class="composer-tool-scroll">
          <section class="composer-output">
            <h3>{{ standardScene ? '规范专题校样' : '分析辅助校样' }}</h3>
            <button type="button" @click="resetStandardLayout"><mars-icon icon="layout-two" :width="17" />按规范排版</button>
            <label>输出格式<select v-model="exportFormat" aria-label="排版输出格式"><option value="png">PNG 预览</option><option value="jpg">JPG · A3 / 300 DPI</option><option value="pdf">PDF · A3 / 300 DPI</option></select></label>
            <label v-if="exportFormat === 'png'">图片宽度<select v-model.number="pngWidth" aria-label="排版图片宽度"><option :value="1680">1680 px</option><option :value="2560">2560 px</option><option :value="3840">3840 px</option></select></label>
            <details class="composer-page-settings"><summary>页面设置</summary>
              <label>安全留白（mm）<CompositionNumberInput :value="safeMargin / 4" label="排版安全留白" min="5" max="20" step="1" :disabled="!!standardScene" @change="setMargin" /></label>
              <button v-if="hasLegacySettings && !standardScene" type="button" @click="importLegacyAdornments"><mars-icon icon="upload" :width="16" />迁移旧整饰设置</button>
            </details>
            <details class="composer-inspection"><summary>出图核验</summary><template v-if="standardScene"><p v-for="issue in standardIssues" :key="issue">{{ issue }}</p><p v-if="!standardIssues.length">版式已同步，数据与质量审核待完成</p><button type="button" @click="emit('inspect-standard')">规范检查</button></template><template v-else><p>分析辅助校样，未通过应急响应制图审核。</p><p v-if="missingAgency">制图单位未填写或已隐藏</p><p v-if="hiddenAdornments.length">未显示：{{ hiddenAdornments.join('、') }}</p><p v-if="lowResolution">主图像素不足 A3 / 300 DPI，印刷可能模糊。</p></template></details>
          </section>
          <section>
            <h3>整饰元素</h3>
            <div class="composer-tools">
              <button v-for="tool in adornments" :key="tool.kind" type="button" :aria-label="`添加${tool.label}`" @click="addElement(tool.kind)">
                <mars-icon :icon="tool.icon" :width="17" />{{ tool.label }}
              </button>
              <button type="button" aria-label="添加图片" :disabled="importingPicture" @click="pictureInput?.click()"><mars-icon icon="pic" :width="17" />{{ importingPicture ? '导入中' : '图片' }}</button>
            </div>
            <input ref="pictureInput" class="composer-file-input" type="file" accept="image/png,image/jpeg" aria-label="排版图片文件" @change="importPicture" />
          </section>
          <section>
            <h3>图标库 <a :href="cartographySymbolSource.url" target="_blank" rel="noopener noreferrer" title="DB/T 116-2026 附录 B 地图符号样式">{{ cartographySymbolSource.name }}</a></h3>
            <div class="composer-symbol-tabs" role="tablist" aria-label="排版图标分类">
              <button type="button" role="tab" :aria-selected="symbolFamily === 'basic'" @click="symbolFamily = 'basic'">基础地理</button>
              <button type="button" role="tab" :aria-selected="symbolFamily === 'earthquake'" @click="symbolFamily = 'earthquake'">地震专业</button>
            </div>
            <div class="composer-tools composer-symbols" role="group" :aria-label="symbolFamily === 'basic' ? '基础地理素材' : '地震专业素材'">
              <button v-for="symbol in symbolOptions" :key="symbol.kind" type="button" draggable="true" :title="`${symbol.label} · ${symbol.reference || ''}`" :aria-label="`添加${symbol.label}图标`" @click="addSymbol(symbol.kind)" @dragstart="startSymbolTransfer(symbol.kind, $event)">
                <CartographySymbolIcon :binding="symbol" :size="24" />{{ symbol.shortLabel || symbol.label }}
              </button>
            </div>
          </section>
          <section>
            <h3>统计图表 <span>{{ chartTemplates.length }} 类</span></h3>
            <div class="composer-tools">
              <button v-for="chart in chartTemplates" :key="chart.type" type="button" :disabled="!chartsReady" :title="chart.name" :aria-label="`添加${chart.label}`" @click="addChart(chart.type)">
                <mars-icon :icon="chart.icon" :width="17" />{{ chart.label }}
              </button>
            </div>
            <p v-if="!chartsReady" class="composer-notice">当前框选区暂无统计结果</p>
          </section>
          <section>
            <h3>版面元素 <span>{{ items.length }}</span></h3>
            <div class="composer-layer-list">
              <div v-for="item in items" :key="item.id" class="composer-layer-row" :class="{ 'is-hidden': item.hidden }">
              <button type="button" :class="{ selected: selectedId === item.id }" :aria-pressed="selectedId === item.id" @click="selectedId = item.id">
                <CartographySymbolIcon v-if="item.symbolKind" :binding="cartographySymbolDefinitions[item.symbolKind]" :color="item.color" :size="15" />
                <mars-icon v-else :icon="item.kind === 'map' ? 'earth' : item.kind === 'image' ? 'pic' : item.kind === 'chart' ? 'chart-line' : 'text'" :width="15" />
                <span>{{ item.label }}</span><small v-if="item.kind === 'map'">主图</small>
              </button>
              <button v-if="item.kind !== 'map'" type="button" class="composer-visibility" :title="item.hidden ? `显示${item.label}` : `隐藏${item.label}`" :aria-label="item.hidden ? `显示${item.label}` : `隐藏${item.label}`" :aria-pressed="!item.hidden" :disabled="!!item.standardPart" @click="toggleVisibility(item)"><mars-icon :icon="item.hidden ? 'preview-close' : 'preview-open'" :width="15" /></button>
              </div>
            </div>
          </section>
          <section v-if="selected" class="composer-properties">
            <h3>{{ selected.label }}<button v-if="selected.kind !== 'map'" type="button" title="删除元素" aria-label="删除选中元素" @click="removeSelected"><mars-icon icon="delete" :width="16" /></button></h3>
            <div v-if="selected.raster" class="composer-raster-source">
              <span>{{ selected.raster.detail }}</span>
              <button v-if="selected.kind === 'map'" type="button" @click="restoreMainImage"><mars-icon icon="undo" :width="14" />恢复原始主图</button>
            </div>
            <div v-if="selected.kind !== 'map'" class="composer-appearance">
              <label>旋转角度<CompositionNumberInput :key="selected.id" :value="selected.rotation" label="元素旋转角度" step="1" @change="setRotationValue" /></label>
              <input type="range" :value="selected.rotation" min="0" max="359" step="1" aria-label="旋转角度滑块" @input="setRotation($event)" />
              <label class="composer-transparent"><input type="checkbox" :checked="selected.background === 'transparent'" aria-label="元素透明底色" @change="selected.background = ($event.target as HTMLInputElement).checked ? 'transparent' : 'white'" />透明底色</label>
              <label v-if="selected.background !== 'transparent'">底色<select v-model="selected.background" aria-label="元素底色"><option value="white">浅色</option><option value="dark">深色半透明</option></select></label>
            </div>
            <div class="composer-fields">
              <label v-for="field in geometryFields" :key="field.key">{{ field.label }}<CompositionNumberInput :key="selected.id" :value="Math.round(selected[field.key])" :label="field.label" step="1" @change="value => changeGeometry(field.key, value)" /></label>
            </div>
            <label v-if="!selected.standardPart" class="composer-corner">快速定位<select value="" aria-label="元素固定位置" @change="positionInCorner"><option value="" disabled>选择位置</option><option v-for="corner in CORNERS" :key="corner.value" :value="corner.value">{{ corner.label }}</option></select></label>
            <div v-if="selected.kind === 'symbol'" class="composer-fields">
              <label>大小<CompositionNumberInput :key="selected.id" :value="Math.round(selected.w)" label="排版图标大小" @change="setSymbolSize" /></label>
              <label v-if="!cartographySymbolDefinitions[selected.symbolKind!]?.fixedColors">颜色<input v-model="selected.color" aria-label="排版图标颜色" type="color" /></label>
              <span v-else>标准参考色</span>
              <label class="composer-symbol-opacity">透明度 {{ Math.round((selected.opacity ?? 1) * 100) }}%<input type="range" min="0" max="100" :value="(selected.opacity ?? 1) * 100" aria-label="排版图标透明度" @input="selected.opacity = Number(($event.target as HTMLInputElement).value) / 100" /></label>
            </div>
            <template v-else-if="selected.kind !== 'map' && selected.kind !== 'chart' && selected.kind !== 'image'">
              <div class="composer-fields">
                <label>字号<input v-model.number="selected.fontSize" aria-label="元素字号" type="number" min="12" max="64" /></label>
                <label>文字颜色<input v-model="selected.color" aria-label="元素颜色" type="color" /></label>
                <label>字体<select v-model="selected.font" aria-label="元素字体"><option value="sans">黑体</option><option value="serif">宋体</option></select></label>
                <label>对齐<select v-model="selected.align" aria-label="元素对齐"><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label>
              </div>
            </template>
            <div v-if="selected.kind !== 'map'" class="composer-order">
              <button type="button" @click="reorder(-1)"><mars-icon icon="down" :width="14" />下移一层</button>
              <button type="button" @click="reorder(1)"><mars-icon icon="up" :width="14" />上移一层</button>
            </div>
          </section>
          </div>
        </aside>
        <main class="composer-main">
          <div class="composer-toolbar">
            <span class="composer-tools-toggle"><button type="button" title="显示或收起制图工具" aria-label="制图工具栏" :aria-expanded="showTools" @click="showTools = !showTools"><mars-icon icon="application-menu" :width="16" /></button><small>{{ activeLayoutName || 'A3 · 420 × 297 mm' }}</small></span>
            <div>
              <label><input v-model="snapping" type="checkbox" />磁吸对齐</label>
              <button type="button" title="缩小画布" aria-label="缩小画布" @click="zoom = Math.max(0.15, zoom - 0.1)"><mars-icon icon="minus" :width="15" /></button>
              <span class="composer-zoom">{{ Math.round(zoom * 100) }}%</span>
              <button type="button" title="放大画布" aria-label="放大画布" @click="zoom = Math.min(2, zoom + 0.1)"><mars-icon icon="plus" :width="15" /></button>
              <button type="button" title="适合窗口" aria-label="适合窗口" @click="fit"><mars-icon icon="full-screen" :width="16" /></button>
            </div>
          </div>
          <div v-if="canRotate" class="composer-rotation-toolbar" role="group" aria-label="素材旋转">
            <span class="composer-rotation-name">{{ selected && selected.kind !== 'map' ? selected.label : '旋转' }}</span>
            <div class="composer-rotation-actions">
              <button type="button" title="向左旋转 90°" aria-label="向左旋转90度" :disabled="!canRotate || rotating" @click="rotateBy(-90)"><mars-icon icon="undo" :width="18" /></button>
              <label class="composer-angle-input"><CompositionNumberInput :key="selected?.id" :value="selected?.rotation || 0" label="画布旋转角度" :disabled="!canRotate || rotating" step="1" @change="setRotationValue" /><span>°</span></label>
              <button type="button" title="向右旋转 90°" aria-label="向右旋转90度" :disabled="!canRotate || rotating" @click="rotateBy(90)"><mars-icon icon="redo" :width="18" /></button>
              <button type="button" title="恢复 0°" aria-label="复位旋转角度" :disabled="!canRotate || rotating || !selected?.rotation" @click="rotateBy(-(selected?.rotation || 0))"><mars-icon icon="refresh" :width="18" /></button>
            </div>
          </div>
          <section v-if="editableText && selected" class="composer-text-editor">
            <label>{{ selected.label }}内容<textarea ref="textInput" v-model="selected.text" rows="2" maxlength="1000" aria-label="元素内容" @keydown.stop></textarea></label>
          </section>
          <div ref="viewport" class="composer-viewport" @pointerdown.self="selectedId = ''">
            <div class="composer-page-space" :style="{ width: `${PAGE.width * zoom}px`, height: `${PAGE.height * zoom}px` }">
              <div class="composer-page" :style="{ width: `${PAGE.width}px`, height: `${PAGE.height}px`, transform: `scale(${zoom})` }" @dragover.prevent @drop.prevent.stop="dropSymbol">
                <canvas ref="canvas" :width="PAGE.width" :height="PAGE.height" aria-label="专题制图版面"></canvas>
                <div class="composer-safe-area" :style="{ inset: `${safeMargin}px` }" aria-hidden="true"></div>
                <div v-for="item in visibleItems" :key="item.id" class="composer-element" :class="{ selected: selectedId === item.id }" :style="{ left: `${item.x}px`, top: `${item.y}px`, width: `${item.w}px`, height: `${item.h}px`, transform: `rotate(${item.rotation}deg)` }"
                  :data-kind="item.kind" :data-id="item.id" role="button" tabindex="0" :aria-label="`版面：${item.label}`" :aria-pressed="selectedId === item.id"
                  @pointerdown.stop="startDrag(item, $event)" @keydown="onElementKey(item, $event)" @focus="selectedId = item.id" @dblclick.stop="editText(item)">
                  <span v-if="selectedId === item.id" class="composer-selection-label">{{ item.label }}</span>
                  <button v-if="selectedId === item.id" class="composer-resize" :style="{ width: `${12 / zoom}px`, height: `${12 / zoom}px`, right: `${-6 / zoom}px`, bottom: `${-6 / zoom}px`, borderWidth: `${1 / zoom}px` }" type="button" title="调整尺寸" aria-label="调整元素尺寸" @pointerdown.stop="startDrag(item, $event, true)"></button>
                </div>
                <template v-if="selected && canRotate && rotationControl">
                  <span class="composer-rotation-stem" :style="rotationStemStyle" aria-hidden="true"></span>
                  <button class="composer-rotate" :class="{ 'is-rotating': rotating }" :style="{ left: `${rotationControl.x}px`, top: `${rotationControl.y}px`, width: `${44 / zoom}px`, height: `${44 / zoom}px` }" type="button" title="拖动旋转；Shift 按 15° 对齐，Alt 自由旋转，Esc 取消" aria-label="旋转选中元素" @pointerdown.stop="startDrag(selected, $event, false, true)" @keydown.stop="onRotationKey(selected, $event)" @dblclick.stop="rotateBy(-selected.rotation)">
                    <span class="composer-rotation-knob" :style="{ width: `${24 / zoom}px`, height: `${24 / zoom}px`, borderWidth: `${1 / zoom}px` }" aria-hidden="true"><mars-icon icon="redo" :width="14 / zoom" :height="14 / zoom" /></span>
                  </button>
                </template>
              </div>
            </div>
          </div>
          <footer class="composer-footer"><span>{{ mainMeta }}</span><span v-if="!imageReady">{{ imageError || '正在载入主图' }}</span><span v-else>安全边距 {{ safeMargin / 4 }} mm</span></footer>
        </main>
      </div>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import * as echarts from "echarts"
import { applyCompositionTemplate, type CompositionTemplateText } from "./composition-template"
import { applyTemplateLayout, templateLayoutProfiles } from "./composition-layout"
import { drawStandardFrame, drawStandardScale } from "./cartography-standard-layout"
import { encodeDbtMap } from "./dbt116-export"
import { PAGE, compositionMargin, constrainItem, containImage, createCompositionItem, restoreComposition, normalizeRotation, rotationBounds, reconcileCharts, useCompositionRaster, type CompositionRaster, type LinkedCompositionChart, type CompositionItem, type CompositionKind } from "./composition-model"
import { CORNERS, type Corner, type AdornmentMetrics } from "./cartography-layout"
import { compositionMetadata, migrateAdornments, placeInCorner, setCompositionMargin } from "./composition-adornments"
import { cartographySettings, cartographySnapshot } from "./cartography-state"
import { embedCartographyMetadata } from "./cartography-png"
import { composerDock } from "./composer-dock"
import CompositionNumberInput from "./CompositionNumberInput.vue"
import { compositionHistory } from "./composition-history"
import { cartographySymbolDefinitions, cartographySymbolSource, type CartographySymbolKind, type TemplateIconFamily } from "./template-icon-registry"
import { compositionSymbolImage } from "./composition-symbols"
import CartographySymbolIcon from "./CartographySymbolIcon.vue"
import { standardCompositionIssues, syncStandardComposition, type StandardComposition } from "./standard-composition"
import { rotationHandle, snapRotation } from "./composition-rotation"

const props = defineProps<{
  open: boolean; scopeKey: string; mainImage: string; mainTitle: string; mainMeta: string; source: string; time: string
  metrics: AdornmentMetrics | null; legend: Array<{ label: string; color: string }>; charts: LinkedCompositionChart[]; chartsReady: boolean
  chartOption:(type: string) => echarts.EChartsOption; chartRevision: unknown
  anchorSelector: string
  description?: string; agency?: string
  standardScene?: StandardComposition | null
}>()
const emit = defineEmits<{
  "update:open": [value: boolean]
  "add-chart": [type: string]
  "remove-chart": [id: string]
  "chart-layouts": [layouts: CompositionItem[]]
  "restore-charts": [charts: LinkedCompositionChart[]]
  "edit-copy": [kind: string, text: string]
  "standard-issues": [issues: string[]]
  "preview": [image: string]
  "inspect-standard": []
}>()
const adornments: Array<{ kind: CompositionKind; label: string; icon: string }> = [
  { kind: "title", label: "标题", icon: "text" }, { kind: "legend", label: "图例", icon: "list" },
  { kind: "scale", label: "比例尺", icon: "ruler" }, { kind: "north", label: "指北针", icon: "compass" },
  { kind: "time", label: "时间", icon: "time" }, { kind: "source", label: "来源", icon: "link" },
  { kind: "description", label: "内容说明", icon: "notes" }, { kind: "agency", label: "制图单位", icon: "building-four" },
  { kind: "text", label: "文本", icon: "edit" }
]
const chartTemplates = [
  { type: "contour", label: "折线图", name: "空间剖面曲线", icon: "chart-line" },
  { type: "deformation-bar", label: "柱状图", name: "像素等级占比", icon: "chart-histogram" },
  { type: "population-distribution", label: "饼图", name: "色彩覆盖占比", icon: "chart-pie" },
  { type: "heatmap", label: "热力图", name: "空间热度矩阵", icon: "application-menu" },
  { type: "terrain-density", label: "散点图", name: "像素空间分布", icon: "chart-scatter" },
  { type: "trend-line", label: "通道图", name: "RGB 通道均值", icon: "chart-histogram" }
]
const geometryFields = [{ key: "x", label: "水平位置" }, { key: "y", label: "垂直位置" }, { key: "w", label: "元素宽度" }, { key: "h", label: "元素高度" }] as const
const items = ref<CompositionItem[]>([]); const selectedId = ref("")
const visibleItems = computed(() => items.value.filter(item => !item.hidden))
const safeMargin = computed(() => props.standardScene ? PAGE.margin : compositionMargin(items.value.find(item => item.kind === "map")?.safeMargin))
const hiddenAdornments = computed(() => adornments.filter(tool => tool.kind !== "text" && !visibleItems.value.some(item => item.kind === tool.kind)).map(tool => tool.label))
const hasLegacySettings = ref(false)
function setMargin(mm: number) {
  if (props.standardScene) { return }
  flushHistory(); items.value = setCompositionMargin(items.value, mm * 4); flushHistory()
}
function positionInCorner(event: Event) {
  const input = event.target as HTMLSelectElement
  const corner = input.value as Corner
  if (selected.value && !selected.value.standardPart && CORNERS.some(item => item.value === corner)) {
    flushHistory(); Object.assign(selected.value, placeInCorner(selected.value, corner, safeMargin.value)); flushHistory()
  }
  input.value = ""
}
function toggleVisibility(item: CompositionItem) {
  if (item.kind === "map" || item.standardPart) { return }
  flushHistory(); item.hidden = !item.hidden; flushHistory()
}
function importLegacyAdornments() {
  if (props.standardScene) { return }
  flushHistory(); items.value = migrateAdornments(items.value, cartographySettings); flushHistory(); save()
  status.value = "旧整饰设置已迁移，可撤销"
}
const pictureInput = ref<HTMLInputElement>()
const importingPicture = ref(false)
async function importPicture(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]; input.value = ""
  if (!file || importingPicture.value) { return }
  const scope = props.scopeKey
  importingPicture.value = true
  try {
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 5 * 1024 * 1024) { throw new Error("请选择不超过 5MB 的 PNG/JPG 图片") }
    const bitmap = await createImageBitmap(file)
    try {
      const canvas = document.createElement("canvas")
      const ratio = Math.min(1, 1600 / bitmap.width, 1600 / bitmap.height)
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      if (scope !== props.scopeKey || !props.open) { return }
      const added = useRaster({ image: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height, label: file.name, detail: "附加图片", legend: [] }, "inset")
      if (!added) { throw new Error("图片过大或版面元素已满，请缩小图片后重试") }
      flushHistory(); save()
    } finally { bitmap.close() }
  } catch (error) { status.value = error instanceof Error ? error.message : "图片导入失败" } finally { importingPicture.value = false }
}
const standardIssues = computed(() => standardCompositionIssues(items.value, props.standardScene || null))
const activeLayoutName = computed(() => templateLayoutProfiles[items.value.find(item => item.kind === "map")?.templateKind || ""]?.name || "")
const symbolFamily = ref<TemplateIconFamily>("basic")
const symbolOptions = computed(() => Object.values(cartographySymbolDefinitions).filter(symbol => !symbol.legacy && symbol.family === symbolFamily.value).map(symbol => ({ ...symbol, kind: symbol.kind as CartographySymbolKind })))
const symbolImages = new Map<string, { image: HTMLImageElement; ready: Promise<boolean> }>()
const rasterImages = new Map<string, { image: HTMLImageElement; ready: Promise<boolean> }>()
function rasterImage(raster: CompositionRaster) {
  const cached = rasterImages.get(raster.image)
  if (cached) { return cached }
  if (rasterImages.size > 60) { rasterImages.clear() }
  const image = new Image()
  const ready = new Promise<boolean>(resolve => {
    image.onload = () => { resolve(true); schedulePaint() }
    image.onerror = () => { resolve(false); status.value = "结果图片加载失败" }
  })
  image.src = raster.image
  const entry = { image, ready }; rasterImages.set(raster.image, entry); return entry
}
function applyTemplate(raster: CompositionRaster, text: CompositionTemplateText) {
  flushHistory()
  const next = applyCompositionTemplate(items.value, raster, text)
  if (next === items.value) { status.value = "版面元素已满或图片不可用，无法套用版式"; return false }
  items.value = next
  selectedId.value = next.find(item => item.kind === "map")?.id || ""
  flushHistory(); save()
  return true
}
function useRaster(raster: CompositionRaster, role: "main" | "inset", keepSelection = false) {
  flushHistory()
  const next = useCompositionRaster(items.value, raster, role)
  if (next === items.value) { status.value = "无法添加结果，请检查图片或版面元素数量"; return false }
  if (role === "inset") { Object.assign(next[next.length - 1], constrainItem(next[next.length - 1], [], false, safeMargin.value)) }
  items.value = next
  if (!keepSelection) { selectedId.value = (role === "main" ? next.find(item => item.kind === "map") : next[next.length - 1])?.id || "" }
  return true
}
function restoreMainImage() {
  const item = items.value.find(item => item.kind === "map")
  if (!item?.raster) { return }
  flushHistory(); delete item.raster; item.label = "主图"
}
function symbolImage(item: CompositionItem) {
  const key = `${item.symbolKind}:${item.color}`
  const cached = symbolImages.get(key)
  if (cached) { return cached }
  if (symbolImages.size > 100) { symbolImages.clear() }
  const image = new Image()
  const ready = new Promise<boolean>(resolve => {
    image.onload = () => { resolve(true); schedulePaint() }
    image.onerror = () => { resolve(false); status.value = "图标加载失败" }
  })
  image.src = compositionSymbolImage(item.symbolKind!, item.color)
  const entry = { image, ready }; symbolImages.set(key, entry); return entry
}
function addSymbol(kind: CartographySymbolKind, style: { size?: number; rotation?: number; opacity?: number; color?: string } = {}, point?: { x: number; y: number }) {
  if (!Object.prototype.hasOwnProperty.call(cartographySymbolDefinitions, kind) || items.value.length >= 60) { return }
  flushHistory()
  const definition = cartographySymbolDefinitions[kind]
  const map = items.value.find(item => item.kind === "map")
  const count = items.value.filter(item => item.kind === "symbol").length
  const size = Math.max(22, Math.min(240, Number(style.size) || 96))
  const item = { ...createCompositionItem("symbol"), symbolKind: kind, label: definition.label, color: style.color && /^#[\da-f]{6}$/i.test(style.color) ? style.color : definition.accent, opacity: Number.isFinite(style.opacity) ? Math.max(0, Math.min(1, style.opacity!)) : 1, rotation: normalizeRotation(style.rotation), w: size, h: size, positioned: true }
  item.x = (point?.x ?? (map ? map.x + map.w / 2 : PAGE.width / 2) + count % 6 * 24) - size / 2
  item.y = (point?.y ?? (map ? map.y + map.h / 2 : PAGE.height / 2) + count % 6 * 24) - size / 2
  Object.assign(item, constrainItem(item, [], false, safeMargin.value))
  items.value.push(item); selectedId.value = item.id; symbolFamily.value = definition.family
}
function setSymbolSize(value: number) {
  if (selected.value?.kind !== "symbol") { return }
  const size = Math.max(22, Math.min(240, value))
  Object.assign(selected.value, constrainItem({ ...selected.value, w: size, h: size }, [], false, safeMargin.value), { positioned: true })
}
function startSymbolTransfer(kind: CartographySymbolKind, event: DragEvent) {
  event.dataTransfer?.setData("application/x-cartography-symbol", kind)
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = "copy" }
}
function dropSymbol(event: DragEvent) {
  const kind = event.dataTransfer?.getData("application/x-cartography-symbol") as CartographySymbolKind
  if (!kind || !canvas.value) { return }
  const rect = canvas.value.getBoundingClientRect()
  addSymbol(kind, {}, { x: (event.clientX - rect.left) / zoom.value, y: (event.clientY - rect.top) / zoom.value })
}
const history = compositionHistory()
const canUndo = ref(false); const canRedo = ref(false)
let historyReady = false; let restoringHistory = false; let historyTimer = 0
function updateHistoryButtons() { canUndo.value = history.canUndo; canRedo.value = history.canRedo }
function flushHistory() {
  window.clearTimeout(historyTimer)
  if (!historyReady || restoringHistory || stopDrag) { return }
  history.record(items.value); updateHistoryButtons()
}
async function travelHistory(direction: -1 | 1) {
  if (restoringHistory) { return }
  stopDrag?.(); flushHistory()
  const snapshot = history.step(direction)
  if (!snapshot) { return }
  restoringHistory = true
  items.value = snapshot
  if (!snapshot.some(item => item.id === selectedId.value)) { selectedId.value = snapshot[snapshot.length - 1]?.id || "" }
  emit("restore-charts", snapshot.filter(item => item.kind === "chart" && item.linkedId).map(item => ({ id: item.linkedId!, type: item.chartType!, name: item.label })))
  chartCache.clear(); schedulePaint()
  await nextTick()
  restoringHistory = false; updateHistoryButtons(); save()
}
function onHistoryKey(event: KeyboardEvent) {
  if (!props.open || event.defaultPrevented || event.isComposing || !(event.ctrlKey || event.metaKey) || event.altKey) { return }
  const target = event.target as HTMLElement
  if (!target.closest(".map-composer") && !target.closest(props.anchorSelector)) { return }
  if (target.closest("input, textarea, select, [contenteditable=true]")) { return }
  const key = event.key.toLowerCase()
  if (key !== "z" && key !== "y") { return }
  event.preventDefault(); event.stopPropagation()
  travelHistory(key === "y" || event.shiftKey ? 1 : -1)
}
const selected = computed(() => items.value.find(item => item.id === selectedId.value))
const canRotate = computed(() => !!selected.value && !selected.value.hidden && selected.value.kind !== "map")
const rotating = ref(false)
const rotationOrbit = ref<{ offset: number; radius: number } | null>(null)
const rotationControl = computed(() => {
  const item = selected.value
  if (!item || !canRotate.value) { return null }
  const orbit = rotationOrbit.value
  if (!orbit) { return rotationHandle(item, item.rotation, zoom.value) }
  const angle = item.rotation * Math.PI / 180 + orbit.offset
  const cx = item.x + item.w / 2; const cy = item.y + item.h / 2
  const anchorRadius = orbit.radius - 40 / zoom.value
  return { x: cx + orbit.radius * Math.cos(angle), y: cy + orbit.radius * Math.sin(angle), anchorX: cx + anchorRadius * Math.cos(angle), anchorY: cy + anchorRadius * Math.sin(angle) }
})
const rotationStemStyle = computed(() => {
  const handle = rotationControl.value
  if (!handle) { return {} }
  const dx = handle.x - handle.anchorX; const dy = handle.y - handle.anchorY
  return { left: `${handle.anchorX}px`, top: `${handle.anchorY}px`, width: `${Math.hypot(dx, dy)}px`, height: `${1 / zoom.value}px`, transform: `rotate(${Math.atan2(dy, dx)}rad)` }
})
const editableText = computed(() => selected.value && ["title", "source", "time", "text", "description", "agency", "legend"].includes(selected.value.kind))
const textInput = ref<HTMLTextAreaElement>()
async function editText(item: CompositionItem) {
  if (!["title", "source", "time", "text", "description", "agency", "legend"].includes(item.kind)) { return }
  selectedId.value = item.id
  showTools.value = true
  await nextTick()
  textInput.value?.focus({ preventScroll: true })
  textInput.value?.select()
}
const canvas = ref<HTMLCanvasElement>(); const viewport = ref<HTMLElement>(); const returnButton = ref<HTMLButtonElement>()
const zoom = ref(0.6); const snapping = ref(true); const exporting = ref(false); const imageReady = ref(false); const imageError = ref(""); const status = ref("")
const exportFormat = ref<"png" | "jpg" | "pdf">("png")
const pngWidth = ref(1680)
const missingAgency = computed(() => !visibleItems.value.find(item => item.kind === "agency")?.text.replace(/制图单位|待填写|[：:\s]/g, ""))
const lowResolution = computed(() => {
  const map = items.value.find(item => item.kind === "map")
  return !!map && (map.raster?.width || props.metrics?.selectionWidth || 0) < map.w * 300 / 101.6
})
let currentScope = ""; let loadedImage: HTMLImageElement | null = null; let loadVersion = 0; let frame = 0; let saveTimer = 0
let resizeObserver: ResizeObserver | null = null; let stopDrag: (() => void) | null = null; let previousFocus: HTMLElement | null = null
const chartCache = new Map<string, HTMLCanvasElement>()
const storageKey = () => `mars3d:composition:v1:${props.scopeKey}`
const dock = ref({ x: 0, y: 0, w: 0, h: 0 })
const showTools = ref(true)
const dockStyle = computed(() => ({ left: `${dock.value.x}px`, top: `${dock.value.y}px`, width: `${dock.value.w}px`, height: `${dock.value.h}px`, visibility: dock.value.w > 0 && dock.value.h > 0 ? "visible" as const : "hidden" as const }))
let anchorResize: ResizeObserver | null = null
let anchorMutation: MutationObserver | null = null
function positionDock() {
  const anchor = document.querySelector<HTMLElement>(props.anchorSelector)
  if (!anchor) { dock.value = { x: 0, y: 0, w: 0, h: 0 }; return }
  const rect = anchor.getBoundingClientRect()
  const next = composerDock({ x: rect.left, y: rect.top, w: rect.width, h: rect.height }, { width: window.innerWidth, height: window.innerHeight })
  if (window.innerWidth <= 900) { Object.assign(next, { x: 12, y: 86, w: window.innerWidth - 24, h: Math.max(0, window.innerHeight - 108) }) }
  if (next.w < 480 && dock.value.w >= 480) { showTools.value = false }
  dock.value = next
}
function stopDock() {
  anchorResize?.disconnect(); anchorMutation?.disconnect()
  window.removeEventListener("resize", positionDock)
  window.removeEventListener("scroll", positionDock, true)
  document.removeEventListener("keydown", onHistoryKey, true)
}
function observeDock() {
  stopDock(); positionDock()
  showTools.value = dock.value.w >= 600
  const anchor = document.querySelector(props.anchorSelector)
  if (anchor) {
    anchorResize = new ResizeObserver(positionDock); anchorResize.observe(anchor)
    anchorMutation = new MutationObserver(positionDock); anchorMutation.observe(anchor, { attributes: true, attributeFilter: ["style", "class"] })
  }
  window.addEventListener("resize", positionDock)
  window.addEventListener("scroll", positionDock, true)
  document.addEventListener("keydown", onHistoryKey, true)
}

function save() {
  if (!currentScope || currentScope !== props.scopeKey) { return }
  try { localStorage.setItem(storageKey(), JSON.stringify(items.value)); status.value = "排版已保存" } catch { status.value = "排版保留在本次会话" }
}
function close() { stopDrag?.(); flushHistory(); save(); emit("update:open", false); previousFocus?.focus() }
function fit() {
  if (rotating.value) { return }
  if (viewport.value) { zoom.value = Math.max(0.15, Math.min(1, (viewport.value.clientWidth - 48) / PAGE.width, (viewport.value.clientHeight - 48) / PAGE.height)) }
}
function addElement(kind: CompositionKind) {
  const existing = kind !== "text" && items.value.find(item => item.kind === kind)
  if (existing) { existing.hidden = false; selectedId.value = existing.id; return }
  if (items.value.length >= 60) { status.value = "版面最多容纳 60 个元素"; return }
  const date = new Date(props.time)
  const time = Number.isNaN(date.getTime()) ? props.time : date.toLocaleString()
  const texts: Partial<Record<CompositionKind, string>> = { title: props.mainTitle || "专题主图", source: props.source || "当前地图截图（RGB 像元）", time: time || new Date().toLocaleString(), text: "专题说明", description: props.description || "内容说明待填写", agency: props.agency || "制图单位待填写" }
  const item = createCompositionItem(kind, texts[kind] || "")
  Object.assign(item, constrainItem(item, [], false, safeMargin.value))
  items.value.push(item); selectedId.value = item.id
}
function resetStandardLayout() {
  if (props.standardScene) { flushHistory(); items.value = syncStandardComposition(items.value, props.standardScene, true); flushHistory(); return }
  flushHistory()
  for (const tool of adornments.filter(tool => tool.kind !== "text")) { addElement(tool.kind) }
  items.value = applyTemplateLayout(items.value, items.value.find(item => item.kind === "map")?.templateKind || "choropleth")
  const map = items.value.find(item => item.kind === "map")
  if (map) { map.safeMargin = PAGE.margin }
  selectedId.value = ""; chartCache.clear(); flushHistory(); save(); fit()
}
function addChart(type: string) {
  const template = chartTemplates.find(chart => chart.type === type)
  if (!template || !props.chartsReady || items.value.length >= 60) { return }
  emit("add-chart", type)
}
function syncCharts(restore = false) {
  if (currentScope !== props.scopeKey || restoringHistory) { return }
  const previousIds = new Set(items.value.map(item => item.id))
  items.value = reconcileCharts(items.value, props.charts, restore)
  const added = items.value.filter(item => item.kind === "chart" && !previousIds.has(item.id))
  if (added.length) { selectedId.value = added[added.length - 1].id }
  if (!items.value.some(item => item.id === selectedId.value)) { selectedId.value = "" }
  chartCache.clear(); schedulePaint()
}
function selectChart(id: string) {
  const item = items.value.find(item => item.linkedId === id)
  if (item) { selectedId.value = item.id }
}
function updateChart(id: string, patch: Partial<CompositionItem>) {
  const item = items.value.find(item => item.linkedId === id)
  if (!item) { return }
  const rotation = normalizeRotation(patch.rotation ?? item.rotation)
  Object.assign(item, constrainItem({ ...item, ...patch, rotation }, [], false, safeMargin.value), { rotation, background: patch.background ?? item.background, positioned: true })
  selectedId.value = item.id
}
defineExpose({ selectChart, updateChart, addSymbol, useRaster, applyTemplate, exportProof: exportImage })
function setRotation(event: Event) {
  setRotationValue(Number((event.target as HTMLInputElement).value))
}
function setRotationValue(value: number) {
  const item = selected.value
  if (!item || item.kind === "map") { return }
  item.rotation = normalizeRotation(value)
  Object.assign(item, constrainItem(item, [], false, safeMargin.value), { positioned: true })
}
function rotateBy(delta: number) {
  if (!canRotate.value || rotating.value) { return }
  flushHistory(); setRotationValue(selected.value!.rotation + delta); flushHistory()
}
function onRotationKey(item: CompositionItem, event: KeyboardEvent) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { return }
  event.preventDefault(); selectedId.value = item.id
  setRotationValue(item.rotation + (["ArrowLeft", "ArrowDown"].includes(event.key) ? -1 : 1) * (event.shiftKey ? 15 : 1))
}
function removeSelected() {
  if (selected.value?.kind === "map") { return }
  if (selected.value?.linkedId) { emit("remove-chart", selected.value.linkedId); return }
  items.value = items.value.filter(item => item.id !== selectedId.value); selectedId.value = ""
}
function reorder(direction: number) {
  const index = items.value.findIndex(item => item.id === selectedId.value); const target = index + direction
  if (index < 1 || target < 1 || target >= items.value.length) { return }
  const [item] = items.value.splice(index, 1); items.value.splice(target, 0, item)
}
function changeGeometry(key: "x" | "y" | "w" | "h", value: number) {
  if (selected.value) { Object.assign(selected.value, constrainItem({ ...selected.value, [key]: value }, [], false, safeMargin.value), { positioned: true }) }
}
function startDrag(item: CompositionItem, event: PointerEvent, resize = false, rotate = false) {
  if (event.button !== 0) { return }
  event.preventDefault(); stopDrag?.(); flushHistory(); selectedId.value = item.id
  const start = { x: event.clientX, y: event.clientY, positioned: item.positioned, rect: { x: item.x, y: item.y, w: item.w, h: item.h } }
  if (rotate && rotationControl.value) {
    const dx = rotationControl.value.x - (item.x + item.w / 2); const dy = rotationControl.value.y - (item.y + item.h / 2)
    rotationOrbit.value = { offset: Math.atan2(dy, dx) - item.rotation * Math.PI / 180, radius: Math.hypot(dx, dy) }
  }
  rotating.value = rotate
  const page = canvas.value!.getBoundingClientRect()
  const center = { x: page.left + (item.x + item.w / 2) * zoom.value, y: page.top + (item.y + item.h / 2) * zoom.value }
  const startAngle = Math.atan2(event.clientY - center.y, event.clientX - center.x)
  const startRotation = item.rotation
  const target = event.currentTarget as HTMLElement
  target.focus({ preventScroll: true })
  target.setPointerCapture(event.pointerId)
  const move = (next: PointerEvent) => {
    if (next.pointerId !== event.pointerId) { return }
    if (rotate) {
      if (Math.hypot(next.clientX - start.x, next.clientY - start.y) < 3) { return }
      const degrees = startRotation + (Math.atan2(next.clientY - center.y, next.clientX - center.x) - startAngle) * 180 / Math.PI
      const rotation = snapRotation(degrees, next.shiftKey, next.altKey)
      Object.assign(item, start.rect, { rotation, positioned: true })
      return
    }
    const dx = (next.clientX - start.x) / zoom.value; const dy = (next.clientY - start.y) / zoom.value
    item.positioned = true
    const angle = item.rotation * Math.PI / 180
    const dw = dx * Math.cos(angle) + dy * Math.sin(angle); const dh = -dx * Math.sin(angle) + dy * Math.cos(angle)
    const w = Math.max(item.kind === "symbol" ? 22 : 80, start.rect.w + dw); const h = item.kind === "symbol" ? w : Math.max(44, start.rect.h + dh)
    const actualW = w - start.rect.w; const actualH = h - start.rect.h
    const rect = resize
      ? { x: start.rect.x + (actualW * Math.cos(angle) - actualH * Math.sin(angle) - actualW) / 2, y: start.rect.y + (actualW * Math.sin(angle) + actualH * Math.cos(angle) - actualH) / 2, w, h }
      : { ...start.rect, x: start.rect.x + dx, y: start.rect.y + dy }
    Object.assign(item, constrainItem({ ...rect, kind: item.kind, rotation: item.rotation }, visibleItems.value.filter(entry => entry.id !== item.id).map(entry => rotationBounds(entry, entry.rotation)), !resize && snapping.value, safeMargin.value))
  }
  const finish = (cancelled = false) => {
    target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", end); target.removeEventListener("pointercancel", cancel); target.removeEventListener("lostpointercapture", end)
    document.removeEventListener("keydown", escape, true)
    if (target.hasPointerCapture(event.pointerId)) { target.releasePointerCapture(event.pointerId) }
    if (cancelled) {
      Object.assign(item, start.rect, { rotation: startRotation })
      if (start.positioned === undefined) { delete item.positioned } else { item.positioned = start.positioned }
    } else if (rotate) { Object.assign(item, constrainItem(item, [], false, safeMargin.value)) }
    rotating.value = false; rotationOrbit.value = null; stopDrag = null; flushHistory(); chartCache.clear(); schedulePaint(); save()
  }
  const end = () => finish()
  const cancel = () => finish(true)
  const escape = (key: KeyboardEvent) => {
    if (key.key !== "Escape") { return }
    key.preventDefault(); key.stopImmediatePropagation(); cancel()
  }
  document.addEventListener("keydown", escape, true)
  target.addEventListener("pointermove", move); target.addEventListener("pointerup", end); target.addEventListener("pointercancel", cancel); target.addEventListener("lostpointercapture", end)
  stopDrag = end
}
function onElementKey(item: CompositionItem, event: KeyboardEvent) {
  selectedId.value = item.id
  if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelected(); return }
  const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  if (delta[event.key]) {
    event.preventDefault(); const [x, y] = delta[event.key]; const step = event.shiftKey ? 10 : 1
    item.positioned = true
    Object.assign(item, constrainItem({ ...item, x: item.x + x * step, y: item.y + y * step }, [], false, safeMargin.value))
  }
}

function textBlock(ctx: CanvasRenderingContext2D, item: CompositionItem, text: string) {
  let fontSize = Math.max(12, Math.min(64, Number(item.fontSize) || 19)); let lines: string[] = []
  const family = item.font === "serif" ? "SimSun, serif" : '"Microsoft YaHei", sans-serif'
  do {
    ctx.font = `${item.kind === "title" ? 600 : 400} ${fontSize}px ${family}`
    lines = []; let line = ""
    for (const char of text) {
      if (char === "\n" || (line && ctx.measureText(line + char).width > item.w - 20)) { lines.push(line); line = char === "\n" ? "" : char } else { line += char }
    }
    lines.push(line)
    if (lines.length * fontSize * 1.4 <= item.h - 12 || fontSize <= 10) { break }
    fontSize--
  } while (fontSize >= 10)
  ctx.fillStyle = item.color; ctx.textBaseline = "top"; ctx.textAlign = item.align
  let x = item.x + 10
  if (item.align === "center") { x = item.x + item.w / 2 }
  if (item.align === "right") { x = item.x + item.w - 10 }
  lines.forEach((line, i) => ctx.fillText(line, x, item.y + 6 + i * fontSize * 1.4, item.w - 20))
}
function chartImage(item: CompositionItem, pixelRatio = 2) {
  const key = `${item.id}:${item.chartType}:${item.background}:${Math.round(item.w)}:${Math.round(item.h)}:${pixelRatio}`
  if (chartCache.has(key)) { return chartCache.get(key)! }
  const el = document.createElement("div")
  const instance = echarts.init(el, undefined, { width: Math.round(item.w), height: Math.round(item.h), renderer: "canvas" })
  try {
    instance.setOption({ ...props.chartOption(item.chartType || "contour"), animation: false })
    const image = instance.getRenderedCanvas({ pixelRatio, backgroundColor: item.background === "white" ? "#ffffff" : "transparent" })
    if (chartCache.size > 40) { chartCache.clear() }
    chartCache.set(key, image); return image
  } finally { instance.dispose() }
}
const standardPreviewCanvas = document.createElement("canvas")
standardPreviewCanvas.width = PAGE.width; standardPreviewCanvas.height = PAGE.height
function paint(target = canvas.value || (props.standardScene ? standardPreviewCanvas : undefined), outputScale = 1) {
  frame = 0
  const ctx = target?.getContext("2d")
  if (!ctx) { return }
  ctx.save(); ctx.scale(outputScale, outputScale)
  ctx.clearRect(0, 0, PAGE.width, PAGE.height); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, PAGE.width, PAGE.height)
  const mapItem = items.value.find(item => item.kind === "map")
  const mainBitmap = mapItem?.raster ? rasterImage(mapItem.raster).image : loadedImage
  if (mapItem && !props.standardScene) { drawStandardFrame(ctx, mapItem) }
  for (const item of [...visibleItems.value].sort((a, b) => (cartographySymbolDefinitions[a.symbolKind!]?.priority || 0) - (cartographySymbolDefinitions[b.symbolKind!]?.priority || 0))) {
    ctx.save()
    ctx.translate(item.x + item.w / 2, item.y + item.h / 2); ctx.rotate(item.rotation * Math.PI / 180); ctx.translate(-item.x - item.w / 2, -item.y - item.h / 2)
    ctx.beginPath(); ctx.rect(item.x, item.y, item.w, item.h); ctx.clip()
    const standardItem = props.standardScene?.items.find(entry => entry.id === item.id)
    const standardStyle = standardItem && (["font", "fontSize", "color", "align", "background"] as const).every(key => item[key] === standardItem[key])
    if (standardStyle && item.standardPart && item.raster && item.text === item.raster.detail) {
      const image = rasterImage(item.raster).image
      if (image.complete && image.naturalWidth) { ctx.drawImage(image, item.x, item.y, item.w, item.h) }
    } else if (item.kind === "map") {
      if (mainBitmap?.complete && mainBitmap.naturalWidth) {
        const rect = containImage(item, mainBitmap.naturalWidth, mainBitmap.naturalHeight)
        ctx.drawImage(mainBitmap, rect.x, rect.y, rect.w, rect.h)
      }
    } else {
      if (item.background === "white") { ctx.fillStyle = "#ffffff"; ctx.fillRect(item.x, item.y, item.w, item.h) }
      if (item.background === "dark") { ctx.fillStyle = "rgba(4, 18, 30, 0.86)"; ctx.fillRect(item.x, item.y, item.w, item.h) }
      if (item.kind === "image" && item.raster) {
        const image = rasterImage(item.raster).image
        if (image.complete && image.naturalWidth) {
          const rect = containImage(item, image.naturalWidth, image.naturalHeight)
          ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h)
        }
      } else if (item.kind === "symbol" && item.symbolKind) {
        const image = symbolImage(item).image
        if (image.complete && image.naturalWidth) {
          const rect = containImage(item, image.naturalWidth, image.naturalHeight)
          ctx.globalAlpha = item.opacity ?? 1
          ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h)
        }
      } else if (item.kind === "chart") {
        if (props.chartsReady) { ctx.drawImage(chartImage(item, Math.max(2, outputScale)), item.x, item.y, item.w, item.h) } else { textBlock(ctx, item, "暂无当前范围统计结果") }
      } else if (item.kind === "legend") {
        const entries = mapItem?.raster?.legend ?? props.legend
        textBlock(ctx, { ...item, h: 40, fontSize: 22 }, item.text || "图例")
        if (!entries.length) { textBlock(ctx, { ...item, y: item.y + 40, h: item.h - 40 }, mapItem?.raster ? `${mapItem.raster.label}（无分级图例）` : "底图截图（无专题分级）") } else {
          const columns = item.legendFlow === "columns" ? Math.min(5, entries.length) : Math.ceil(entries.length / Math.max(1, Math.floor((item.h - 44) / 32)))
          const rows = Math.ceil(entries.length / columns)
          const rowHeight = Math.min(32, (item.h - 44) / rows)
          const columnWidth = item.w / columns
          entries.forEach((entry, i) => {
            const x = item.x + i % columns * columnWidth
            const y = item.y + 42 + Math.floor(i / columns) * rowHeight
            ctx.fillStyle = entry.color; ctx.fillRect(x + 10, y + 5, 22, Math.max(4, rowHeight - 10))
            textBlock(ctx, { ...item, x: x + 36, y, w: columnWidth - 40, h: rowHeight, fontSize: Math.min(item.fontSize, rowHeight / 1.4) }, entry.label)
          })
        }
      } else if (item.kind === "scale") {
        const rect = mapItem && mainBitmap?.naturalWidth ? containImage(mapItem, mainBitmap.naturalWidth, mainBitmap.naturalHeight) : null
        const mpp = props.metrics && rect ? props.metrics.metersPerPixel * props.metrics.selectionWidth / rect.w : 0
        if (!drawStandardScale(ctx, item, mpp, item.color)) { textBlock(ctx, item, "比例尺：当前范围不足 5 km 或缺少尺度") }
      } else if (item.kind === "north") {
        if (props.metrics) {
          ctx.translate(item.x + item.w / 2, item.y + item.h / 2); ctx.rotate(props.metrics.northAngle)
          const radius = Math.min(item.w / 2 - 12, item.h / 2 - 24)
          ctx.fillStyle = item.color; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center"
          ctx.strokeText("N", 0, -radius - 8); ctx.fillText("N", 0, -radius - 8)
          ctx.beginPath(); ctx.moveTo(0, -radius); ctx.lineTo(-radius / 3, radius); ctx.lineTo(0, radius / 2); ctx.lineTo(radius / 3, radius); ctx.closePath(); ctx.stroke(); ctx.fill()
        } else { textBlock(ctx, item, "北向未获取") }
      } else { textBlock(ctx, item, item.text) }
    }
    if (item.frameColor) { ctx.strokeStyle = item.frameColor; ctx.lineWidth = 3; ctx.strokeRect(item.x + 2, item.y + 2, item.w - 4, item.h - 4) }
    if (item.ruleColor) { ctx.fillStyle = item.ruleColor; ctx.fillRect(item.x, item.y + item.h - 5, item.w, 5) }
    ctx.restore()
  }
  if (props.standardScene) {
    ctx.fillStyle = "rgba(153,25,25,0.32)"; ctx.font = "bold 34px sans-serif"; ctx.textAlign = "center"
    ctx.fillText(props.standardScene.usage === "test" ? "合成测试 · 禁止业务使用" : "校样 · 未完成质量审核", PAGE.width / 2, PAGE.height - 12)
    if (target === canvas.value || target === standardPreviewCanvas) {
      window.clearTimeout(previewTimer)
      previewTimer = window.setTimeout(() => { if (props.standardScene && target) { emit("preview", target.toDataURL("image/png")) } }, 180)
    }
  }
  ctx.restore()
}
let previewTimer = 0
function schedulePaint() { if ((props.open || props.standardScene) && !frame) { frame = requestAnimationFrame(() => paint()) } }
async function exportImage(format = exportFormat.value, density = 300) {
  if (!imageReady.value || exporting.value) { return }
  exporting.value = true
  try {
    const loaded = await Promise.all([...visibleItems.value.filter(item => item.kind === "symbol").map(item => symbolImage(item).ready), ...visibleItems.value.filter(item => item.raster).map(item => rasterImage(item.raster!).ready)])
    if (loaded.some(success => !success)) { throw new Error("素材加载失败") }
    const target = document.createElement("canvas")
    const scale = format === "png" ? pngWidth.value / PAGE.width : density / 101.6
    target.width = Math.round(PAGE.width * scale); target.height = Math.round(PAGE.height * scale)
    paint(target, scale)
    const ctx = target.getContext("2d")!
    ctx.save(); ctx.scale(scale, scale); ctx.translate(PAGE.width / 2, PAGE.height / 2); ctx.rotate(-0.3)
    ctx.fillStyle = "rgba(153, 25, 25, 0.35)"; ctx.font = "bold 48px sans-serif"; ctx.textAlign = "center"
    const watermark = props.standardScene?.usage === "test" ? "合成测试 · 禁止业务使用" : "校样 · 非正式应急响应成果"
    ctx.fillText(watermark, 0, 0); ctx.restore()
    const title = items.value.find(item => item.kind === "title")?.text || props.mainTitle || "专题制图"
    let blob = format === "png"
      ? await new Promise<Blob>((resolve, reject) => target.toBlob(value => value ? resolve(value) : reject(new Error("图片编码失败")), "image/png"))
      : await encodeDbtMap(target, format, density, title, watermark)
    if (format === "png" && !props.standardScene) {
      const metadata = compositionMetadata(items.value, { ...cartographySnapshot(), metrics: props.metrics, legend: items.value.find(item => item.kind === "map")?.raster?.legend ?? props.legend })
      blob = await embedCartographyMetadata(blob, metadata)
    }
    const url = URL.createObjectURL(blob); const link = document.createElement("a")
    link.href = url; link.download = `${title.replace(/[\\/:*?"<>|]/g, "_")}-校样.${format}`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000); save(); status.value = "排版图片已导出"
  } catch { status.value = "导出失败，请检查主图后重试" } finally { exporting.value = false }
}

watch(() => props.mainImage, url => {
  const version = ++loadVersion
  loadedImage = null; imageReady.value = false; imageError.value = ""
  if (!url) { schedulePaint(); return }
  const image = new Image()
  image.onload = () => { if (version === loadVersion) { loadedImage = image; imageReady.value = true; schedulePaint() } }
  image.onerror = () => { if (version === loadVersion) { imageError.value = "主图载入失败，请返回分析重新生成"; schedulePaint() } }
  image.src = url
}, { immediate: true })
watch(() => [props.open, props.scopeKey], async () => {
  resizeObserver?.disconnect()
  stopDock()
  stopDrag?.(); flushHistory()
  if (!props.open) { return }
  try { hasLegacySettings.value = !!localStorage.getItem("mars3d:cartography-layout:v1") } catch { hasLegacySettings.value = false }
  const resetHistory = currentScope !== props.scopeKey || !items.value.length
  if (resetHistory) { historyReady = false }
  previousFocus = document.activeElement as HTMLElement
  if (currentScope !== props.scopeKey || !items.value.length) {
    currentScope = props.scopeKey
    let saved: CompositionItem[] | null = null
    try { saved = restoreComposition(JSON.parse(localStorage.getItem(storageKey()) || "null")) } catch { /* A corrupt local layout must not prevent editing. */ }
    if (saved) { items.value = saved; selectedId.value = saved[0].id } else {
      items.value = [createCompositionItem("map")]
      for (const tool of adornments.filter(tool => tool.kind !== "text")) { addElement(tool.kind) }
      selectedId.value = items.value[0].id
    }
  }
  if (props.standardScene) { items.value = syncStandardComposition(items.value, props.standardScene) } else { syncCharts(true) }
  if (resetHistory) { history.reset(items.value); historyReady = true; updateHistoryButtons() }
  await nextTick(); observeDock(); await nextTick(); fit(); schedulePaint(); returnButton.value?.focus()
  resizeObserver = new ResizeObserver(fit)
  if (viewport.value) { resizeObserver.observe(viewport.value) }
}, { immediate: true })
watch(items, () => { emit("chart-layouts", items.value.filter(item => item.kind === "chart").map(item => ({ ...item }))); schedulePaint(); status.value = "正在保存"; window.clearTimeout(saveTimer); saveTimer = window.setTimeout(save, 350) }, { deep: true })
watch(items, () => {
  if (!historyReady || restoringHistory || stopDrag) { return }
  window.clearTimeout(historyTimer)
  const editing = document.activeElement?.closest(".map-composer input, .map-composer textarea")
  if (editing) { canUndo.value = true; canRedo.value = false; historyTimer = window.setTimeout(flushHistory, 500) } else { flushHistory() }
}, { deep: true, flush: "post" })
watch(() => props.charts, () => { if (!props.standardScene) { syncCharts() } }, { deep: true })
watch(() => props.standardScene, scene => {
  if (!scene) { return }
  const changedScope = currentScope !== props.scopeKey
  if (changedScope) {
    currentScope = props.scopeKey; historyReady = false
    try { items.value = restoreComposition(JSON.parse(localStorage.getItem(storageKey()) || "null")) || [] } catch { items.value = [] }
  }
  flushHistory(); items.value = syncStandardComposition(items.value, scene); schedulePaint()
  if (changedScope) { history.reset(items.value); historyReady = true; updateHistoryButtons() }
})
watch(standardIssues, issues => emit("standard-issues", issues), { immediate: true })
watch(() => [props.mainTitle, props.description, props.agency], (values, previous) => {
  if (props.standardScene) { return }
  for (const [index, kind] of ["title", "description", "agency"].entries()) {
    const item = items.value.find(item => item.kind === kind)
    if (item && values[index] !== undefined && values[index] !== previous[index]) { item.text = values[index]! }
  }
})
watch(() => items.value.filter(item => ["title", "description", "agency", "source", "legend", "time"].includes(item.kind)).map(item => ({ id: item.id, kind: item.kind, text: item.text })), (values, previous) => {
  for (const item of values) {
    const before = previous.find(entry => entry.id === item.id)
    if (before && item.text !== before.text) { emit("edit-copy", item.kind, item.text) }
  }
})
watch(() => [props.chartRevision, props.legend, props.metrics], () => { chartCache.clear(); schedulePaint() }, { deep: true })
onBeforeUnmount(() => { stopDock(); stopDrag?.(); save(); loadVersion++; resizeObserver?.disconnect(); cancelAnimationFrame(frame); window.clearTimeout(saveTimer); window.clearTimeout(historyTimer); window.clearTimeout(previewTimer); chartCache.clear() })
</script>

<style scoped lang="less">
.map-composer { position: fixed; z-index: 1500; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #718792; border-radius: 6px; box-shadow: 0 8px 24px #07192340; background: #f4f6f7; color: #263b46; font: 14px "Microsoft YaHei", sans-serif; letter-spacing: 0; }
.map-composer * { box-sizing: border-box; }
.map-composer button, .map-composer input, .map-composer select, .map-composer textarea { font: inherit; color: inherit; }
.map-composer button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 32px; padding: 5px 9px; border: 1px solid #c8d2d8; border-radius: 4px; background: #fff; cursor: pointer; }
.map-composer button:hover { border-color: #167eaa; background: #edf7fb; }
.map-composer button:disabled { opacity: .45; cursor: not-allowed; }
.map-composer button:focus-visible, .map-composer input:focus-visible, .map-composer select:focus-visible, .map-composer textarea:focus-visible { outline: 2px solid #168ec4; outline-offset: 2px; }
.composer-header { min-height: 58px; padding: 10px 18px; border-bottom: 1px solid #c8d2d8; display: flex; align-items: center; justify-content: space-between; gap: 14px; background: #fff; }
.composer-header strong { display: flex; align-items: center; gap: 10px; font-size: 17px; white-space: nowrap; }
.composer-header strong :deep(.mars-icon) { color: #0789bd; }
.composer-header-actions { display: flex; align-items: center; gap: 10px; }
.composer-header-actions > span { font-size: 12px; color: #4c7164; }
.composer-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 220px minmax(0, 1fr); }
.tools-collapsed .composer-body { grid-template-columns: minmax(0, 1fr); }
.tools-collapsed .composer-sidebar { display: none; }
.composer-tools-toggle { display: flex; align-items: center; }
.is-compact .composer-header { padding: 8px 10px; min-height: 48px; flex-wrap: wrap; gap: 8px; }
.is-compact .composer-header strong { font-size: 14px; }
.is-compact .composer-header-actions { gap: 6px; margin-left: auto; }
.is-compact .composer-header-actions > span { display: none; }
.is-compact .composer-body { grid-template-columns: 174px minmax(0, 1fr); }
.is-compact.tools-collapsed .composer-body { grid-template-columns: minmax(0, 1fr); }
.is-compact .composer-sidebar section { padding: 10px; }
.is-compact .composer-tools { gap: 5px; }
.is-compact .composer-tools button { gap: 3px; padding: 4px; font-size: 12px; }
.is-compact .composer-toolbar { padding: 8px; }
.is-compact .composer-toolbar label { margin-right: 0; }
.is-compact .composer-viewport { padding: 12px; }
.is-compact .composer-order { flex-wrap: wrap; }
.composer-sidebar { min-height: 0; overflow: hidden; display: flex; flex-direction: column; border-right: 1px solid #c8d2d8; background: #fff; }
.composer-tool-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.composer-text-editor { flex: 0 0 auto; max-height: 40%; overflow-y: auto; padding: 10px 16px; border-bottom: 1px solid #c8d2d8; }
.composer-text-editor label { display: flex; flex-direction: column; gap: 8px; font-size: 13px; font-weight: 600; }
.composer-text-editor textarea { width: 100%; min-height: 48px; max-height: 80px; resize: none; border: 1px solid #1283a2; border-radius: 3px; padding: 8px; background: #fff; color: #263b46; font-weight: 400; }
.composer-sidebar section { padding: 16px; border-bottom: 1px solid #e0e6e9; }
.composer-output { display: grid; gap: 10px; }
.composer-output label { display: grid; gap: 6px; font-size: 12px; }
.composer-output select { width: 100%; padding: 6px; background: transparent; border: 1px solid #718792; }
.composer-page-settings { font-size: 12px; }
.composer-page-settings summary, .composer-inspection summary { cursor: pointer; color: inherit; }
.composer-page-settings label { margin-top: 10px; }
.composer-page-settings :deep(input) { width: 100%; min-width: 0; padding: 6px 8px; border: 1px solid #718792; border-radius: 3px; background: transparent; }
.composer-page-settings > button { margin-top: 10px; width: 100%; font-size: 12px; }
.composer-file-input { display: none; }
.composer-inspection { font-size: 12px; line-height: 1.6; }
.composer-inspection p { margin: 8px 0; }
.composer-sidebar h3 { color: inherit; margin: 0 0 12px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 600; }
.composer-sidebar h3 span { color: #788b93; font-size: 12px; font-weight: 400; }
.composer-tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.composer-tools button { justify-content: flex-start; min-height: 38px; white-space: nowrap; font-size: 12px; padding: 5px 6px; gap: 5px; }
.composer-tools :deep(.mars-icon) { color: #1283a2; }
.composer-symbol-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 10px; border-bottom: 1px solid #526a78; }
.composer-symbol-tabs button { border: 0; border-radius: 0; padding: 6px 2px; font-size: 12px; white-space: nowrap; background: transparent; }
.composer-symbol-tabs button[aria-selected=true] { box-shadow: inset 0 -2px #1287b6; color: #1287b6; }
.composer-sidebar h3 a { color: #527486; font-size: 11px; font-weight: 400; margin-left: auto; }
:global(html[data-theme="dark"] .composer-sidebar h3 a) { color: #a9cad9; }
.composer-symbols button { flex-direction: column; height: 62px; white-space: nowrap; font-size: 12px; padding: 5px; gap: 5px; }
.composer-symbol-opacity { grid-column: 1 / -1; }
.composer-raster-source { display: grid; gap: 8px; font-size: 12px; overflow-wrap: anywhere; }
.composer-layer-list { display: grid; gap: 3px; max-height: 180px; overflow-y: auto; }
.composer-layer-row { display: flex; align-items: center; min-width: 0; }
.composer-layer-row > button:first-child { flex: 1; min-width: 0; }
.composer-layer-row.is-hidden > button:first-child { opacity: .6; }
.composer-layer-list .composer-visibility { flex: 0 0 32px; width: 32px; justify-content: center; padding: 4px; }
.composer-layer-list button { border: 0; justify-content: flex-start; text-align: left; min-width: 0; }
.composer-layer-list button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.composer-layer-list button.selected { background: #e5f4fa; color: #096a91; box-shadow: inset 3px 0 #1287b6; }
.composer-layer-list small { margin-left: auto; flex-shrink: 0; color: #6b7d85; }
.composer-properties label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #526773; }
.composer-properties input, .composer-properties select, .composer-properties textarea { width: 100%; min-width: 0; border: 1px solid #bac8cf; border-radius: 3px; padding: 6px; background: #fff; color: #263b46; }
.composer-properties textarea { resize: vertical; }
.composer-corner { margin-top: 12px; }
.composer-properties input[type=color] { padding: 3px; height: 33px; }
.composer-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.composer-order { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 14px; }
.composer-order button { min-width: 0; white-space: nowrap; font-size: 12px; gap: 3px; padding: 5px 3px; }
.composer-appearance { display: grid; gap: 10px; margin-bottom: 12px; }
.composer-appearance input[type=range] { width: 100%; padding: 0; accent-color: #1283a2; }
.composer-appearance .composer-transparent { flex-direction: row; align-items: center; }
.composer-appearance input[type=checkbox] { width: auto; accent-color: #1283a2; }
.composer-main { display: flex; min-width: 0; min-height: 0; flex-direction: column; }
.composer-toolbar { padding: 9px 18px; background: #f9fbfc; border-bottom: 1px solid #c8d2d8; display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
.composer-toolbar small { margin-left: 10px; color: #788b93; }
.composer-toolbar > div { display: flex; align-items: center; gap: 7px; }
.composer-toolbar label { display: flex; align-items: center; gap: 6px; margin-right: 10px; white-space: nowrap; }
.composer-toolbar input { accent-color: #1283a2; }
.composer-zoom { display: inline-block; width: 44px; text-align: center; font-size: 12px; }
.composer-viewport { flex: 1; min-height: 0; overflow: auto; padding: 24px; background: #dfe5e8; overscroll-behavior: contain; }
.composer-page-space { position: relative; margin: 0 auto; }
.composer-page { position: absolute; left: 0; top: 0; transform-origin: top left; background: white; box-shadow: 0 3px 20px #273b4924; }
.composer-page canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.composer-safe-area { position: absolute; inset: 40px; border: 1px dashed #c1cbd2; pointer-events: none; }
.composer-element { position: absolute; cursor: move; touch-action: none; outline: none; }
.composer-element:hover { outline: 1px solid #269ed2; }
.composer-element.selected { outline: 2px solid #0589c5; }
.composer-element.selected:not([data-kind=map]) { z-index: 2; }
.map-composer .composer-rotate { position: absolute; z-index: 4; transform: translate(-50%, -50%); min-height: 0; padding: 0; border: 0; border-radius: 50%; background: transparent !important; cursor: grab; touch-action: none; }
.composer-rotation-knob { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; box-sizing: border-box; border: 1px solid #0589c5; border-radius: 50%; background: #fff; color: #087da7; pointer-events: none; }
.composer-rotate:hover .composer-rotation-knob, .composer-rotate.is-rotating .composer-rotation-knob { background: #eaf7fc; }
.map-composer .composer-rotate:active { cursor: grabbing; }
/* The global button reset must not square off this circular gesture target. */
.map-composer .composer-rotate { border-radius: 50% !important; }
.composer-rotation-stem { position: absolute; z-index: 3; background: #0589c5; transform-origin: left center; pointer-events: none; }
.composer-rotation-toolbar { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 6px 12px; border-bottom: 1px solid #c8d2d8; }
.composer-rotation-name { flex: 1 1 0; min-width: 0; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.composer-rotation-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.composer-rotation-actions button { width: 44px; height: 44px; padding: 0; flex-shrink: 0; }
.composer-angle-input { display: flex; align-items: center; gap: 3px; }
.composer-angle-input :deep(input) { width: 68px; height: 36px; border: 1px solid #bac8cf; border-radius: 3px; padding: 4px 6px; background: transparent; color: inherit; }
:global(html[data-theme="dark"] .composer-rotation-toolbar) { border-color: #41545e; background: #24343d; }
:global(html[data-theme="dark"] .composer-angle-input input) { border-color: #526a78; color-scheme: dark; }
.composer-selection-label { position: absolute; left: 0; top: -27px; height: 25px; max-width: 100%; padding: 2px 8px; background: #0477ae; color: #fff; font-size: 16px; white-space: nowrap; overflow: hidden; }
.map-composer .composer-resize { position: absolute; right: -8px; bottom: -8px; width: 16px; height: 16px; min-height: 0; padding: 0; background: #fff; border: 2px solid #0589c5; border-radius: 0; cursor: nwse-resize; touch-action: none; }
.composer-footer { display: flex; justify-content: space-between; gap: 15px; padding: 8px 18px; font-size: 11px; color: #61747d; background: #f9fbfc; }
.composer-footer > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.composer-footer > span:last-child { white-space: nowrap; }
.composer-notice { font-size: 12px; color: #927126; margin: 10px 0 0; }
:global(html[data-theme="dark"] .map-composer) { background: #1f292e; color: #e3edf2; color-scheme: dark; }
:global(html[data-theme="dark"] .composer-header),
:global(html[data-theme="dark"] .composer-sidebar) { background: #202d34; border-color: #41545e; }
:global(html[data-theme="dark"] .composer-sidebar section) { border-color: #41545e; }
:global(html[data-theme="dark"] .map-composer button),
:global(html[data-theme="dark"] .composer-properties input),
:global(html[data-theme="dark"] .composer-properties select),
:global(html[data-theme="dark"] .composer-properties textarea),
:global(html[data-theme="dark"] .composer-text-editor textarea) { background: #293c46; color: #e3edf2; border-color: #526a78; }
:global(html[data-theme="dark"] .map-composer button:hover),
:global(html[data-theme="dark"] .composer-layer-list button.selected) { background: #1d5269; color: #fff; }
:global(html[data-theme="dark"] .composer-properties label),
:global(html[data-theme="dark"] .composer-header-actions > span) { color: #bbd3df; }
:global(html[data-theme="dark"] .composer-toolbar),
:global(html[data-theme="dark"] .composer-footer) { background: #24343d; border-color: #41545e; color: #b9ced8; }
:global(html[data-theme="dark"] .composer-viewport) { background: #35454d; }
:global(html[data-theme="dark"] .composer-sidebar h3 span),
:global(html[data-theme="dark"] .composer-toolbar small),
:global(html[data-theme="dark"] .composer-layer-list small) { color: #a9bdc7; }
:global(html[data-theme="dark"] .composer-tools .mars-icon) { color: #66c6e8; }
@media (max-width: 760px) {
  .composer-header { flex-wrap: wrap; padding: 8px 12px; gap: 8px; }
  .composer-header strong { font-size: 15px; }
  .composer-header-actions { width: 100%; justify-content: flex-end; }
  .composer-header-actions > span { margin-right: auto; }
  .composer-body { grid-template-columns: 180px minmax(0, 1fr); }
  .composer-sidebar section { padding: 12px 9px; }
  .composer-tools { gap: 6px; }
  .composer-tools button { padding: 5px; font-size: 12px; gap: 3px; }
  .composer-toolbar { padding: 8px; }
  .composer-toolbar > div { flex-wrap: wrap; }
  .composer-toolbar label { width: 100%; }
  .composer-toolbar small { display: block; margin: 0; }
  .composer-viewport { padding: 12px; }
  .composer-footer { padding: 8px; }
  .composer-footer > span:last-child { display: none; }
  .composer-order { flex-wrap: wrap; }
}
</style>
