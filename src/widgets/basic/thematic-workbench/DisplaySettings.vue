<template>
  <a-drawer :open="open" title="图层样式与三维" width="min(420px, 100vw)" :mask="false" :push="false" root-class-name="thematic-display-drawer" @close="emit('update:open', false)">
    <div class="display-settings">
      <div class="display-source"><strong>{{ source?.name || '尚无分析结果' }}</strong><span>{{ source ? `${source.kind === 'points' ? source.points.length + ' 个观测点' : source.kind === 'polygons' ? source.polygons?.length + ' 个面' : '截图像元'} · ${source.unit}` : '锁定范围后可导入面数据，或运行分析算子' }}</span></div>
      <div class="display-export-actions"><button type="button" :disabled="!source || composing" @click="emit('open-composer')"><mars-icon icon="layout-two" :width="16" />{{ composing ? '正在同步地图' : '制图排版' }}</button></div>
      <div class="display-tabs" role="tablist" aria-label="制图设置">
        <button v-for="item in tabs" :key="item.key" type="button" role="tab" :aria-selected="tab === item.key" :class="{ active: tab === item.key }" @click="tab = item.key">{{ item.label }}</button>
      </div>
      <div v-if="error" class="display-error" role="alert">{{ error }}</div>
      <section v-show="tab === 'style'" role="tabpanel" aria-label="通用样式">
        <div class="display-section-head"><h3>符号与色带</h3><span class="render-latency" :class="{ 'is-slow': elapsed !== null && elapsed > 200 }" role="status" aria-label="样式渲染耗时">{{ rendering ? '预览中' : elapsed === null ? '' : `${elapsed} ms · ${elapsed <= 200 ? '已更新' : '响应较慢'}` }}</span></div>
        <label class="display-field"><span>渲染方式</span><select v-model="style.mode" :disabled="!source || source.kind === 'polygons'" aria-label="渲染方式"><option value="source">{{ source?.kind === 'polygons' ? '面数值示意色' : '业务原色' }}</option><option value="classified">分级设色</option><option value="unique">唯一值分类</option><option value="raster" :disabled="source?.kind === 'points'">栅格色带</option></select></label>
        <template v-if="style.mode === 'classified'">
          <label class="display-field"><span>分级方法</span><select v-model="style.method" aria-label="分级方法"><option value="equal">等距</option><option value="quantile">分位数</option><option value="natural">自然断点</option></select></label>
          <label class="display-range"><span>分级数量 <b>{{ style.count }}</b></span><input v-model.number="style.count" type="range" min="2" max="9" aria-label="分级数量" /></label>
        </template>
        <div v-if="style.mode === 'unique'" class="display-note">{{ source?.kind === 'points' ? '分类字段：分析等级 band' : '分类字段：RGB 亮度值（最多 24 类）' }}</div>
        <div v-if="style.mode === 'raster'" class="display-pair">
          <label>映射下限<input v-model.number="style.min" type="number" aria-label="映射下限" /></label>
          <label>映射上限<input v-model.number="style.max" type="number" aria-label="映射上限" /></label>
        </div>
        <template v-if="style.mode !== 'source'">
          <div class="display-color-row"><label>低值<input v-model="style.low" type="color" aria-label="低值颜色" /></label><div class="display-color-bar" :style="{ background: `linear-gradient(90deg, ${style.low}, ${style.high})` }"></div><label>高值<input v-model="style.high" type="color" aria-label="高值颜色" /></label></div>
          <div v-if="source?.kind === 'points'" class="display-note is-warning">自定义示意色带；业务等级与原始数值不变。</div>
        </template>
        <label class="display-range"><span>图层透明度 <b>{{ Math.round(style.opacity * 100) }}%</b></span><input v-model.number="style.opacity" type="range" min="0" max="1" step="0.05" aria-label="样式透明度" /></label>
        <template v-if="source?.kind === 'points'">
          <label class="display-range"><span>符号大小 <b>{{ style.size }} px</b></span><input v-model.number="style.size" type="range" min="4" max="24" aria-label="符号大小" /></label>
          <label class="display-range"><span>边界宽度 <b>{{ style.outlineWidth }} px</b></span><input v-model.number="style.outlineWidth" type="range" min="0" max="4" step="0.5" aria-label="边界宽度" /></label>
          <label class="display-field"><span>边界颜色</span><input v-model="style.outlineColor" type="color" aria-label="边界颜色" /></label>
          <label class="display-check"><input v-model="style.labels" type="checkbox" />数值标注</label>
        </template>
        <label v-else-if="source?.kind !== 'polygons'" class="display-field"><span>NoData 值</span><input :value="style.nodata" type="number" placeholder="无" aria-label="NoData 值" @input="style.nodata = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)" /></label>
        <div class="display-section-head"><h3>当前图例</h3><span>{{ legend.length }} 类</span></div>
        <EarthquakePalette v-if="source?.businessPalette && style.mode === 'source'" :palette="source.businessPalette" />
        <ul v-else class="display-legend"><li v-for="(item, index) in legend" :key="index"><i :style="{ background: item.color }"></i><span>{{ item.label }}</span></li></ul>
        <div v-if="source?.businessPalette && style.mode !== 'source'" class="display-note is-warning">当前为自定义示意色，不采用地震业务色表。<button type="button" class="restore-palette" @click="style.mode = 'source'">恢复业务配色</button></div>
      </section>
      <section v-show="tab === '3d'" role="tabpanel" aria-label="三维效果">
        <div class="display-section-head"><h3>3D 增强</h3><a-switch v-model:checked="effects.enabled" :disabled="!source || (!displayPoints.length && !source.polygons?.length)" aria-label="启用三维效果" /></div>
        <div class="display-polygon-import">
          <div class="display-polygon-file"><span>面数据（GeoJSON）</span><button type="button" aria-label="导入 GeoJSON 面要素" @click="polygonFileInput?.click()"><mars-icon icon="upload" :width="15" />导入文件</button></div>
          <input ref="polygonFileInput" class="display-file-input" type="file" accept=".geojson,.json,application/geo+json,application/json" aria-label="选择 GeoJSON 面要素文件" @change="importPolygons" />
          <label v-if="polygonDocument" class="display-field"><span>挤出数值字段</span><select v-model="polygonField" aria-label="挤出数值字段" @change="applyPolygonField"><option v-for="field in polygonDocument.fields" :key="field" :value="field">{{ field }}</option></select></label>
          <div v-if="source?.kind === 'polygons'" class="display-note">仅渲染锁定范围内的真实面轮廓。柱高是相对数值示意，并非地形高程；色带为自定义示意色，非国标烈度配色。来源：{{ source.source }}。</div>
        </div>
        <div class="display-export-actions is-view"><button type="button" :disabled="!source" @click="mapWork.setDisplayView(true)"><mars-icon icon="cube" :width="16" />立体视角</button><button type="button" :disabled="!source" @click="mapWork.setDisplayView(false)"><mars-icon icon="map-draw" :width="16" />俯视视角</button></div>
        <label class="display-field"><span>渲染质量</span><select v-model="effects.quality" aria-label="渲染质量"><option value="auto">自动</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label>
        <div class="display-performance" role="status"><span>生效：{{ QUALITY_LABELS[quality.quality] }}</span><strong>{{ effects.enabled ? quality.fps === null ? '采样中' : quality.fps + ' FPS' : '未启用' }}</strong></div>
        <div v-if="quality.optimized && effects.enabled" class="display-note is-warning" role="status">已启用性能优化模式</div>
        <div class="display-effect-grid">
          <label v-for="item in effectOptions" :key="item.key" :class="{ selected: effects.effects.includes(item.key), disabled: effectUnavailable(item.key) }">
            <input v-model="effects.effects" type="checkbox" :value="item.key" :disabled="effectUnavailable(item.key)" :aria-label="item.label" /><mars-icon :icon="item.icon" :width="20" /><span>{{ item.label }}<small>{{ effectCount(item.key) }}</small></span>
          </label>
        </div>
        <div v-if="displayPoints.length && !hasTracks" class="display-note">轨迹缺少有效时间顺序（observedAt / track_id）。</div>
        <div v-if="effects.enabled && effects.effects.includes('scan') && !scanTargets(displayPoints).length" class="display-note">当前没有达到扫描条件的观测点。</div>
        <div v-if="effects.enabled && effects.effects.includes('heat') && !displayPoints.some(point => point.value > 0)" class="display-note">当前没有正值热力观测点。</div>
        <label v-if="hasVolume" class="display-range"><span>高度倍率 <b>{{ effects.height.toFixed(1) }}×</b></span><input v-model.number="effects.height" type="range" min="0.2" max="3" step="0.1" aria-label="柱体高度倍率" /></label>
        <label class="display-range"><span>不透明度 <b>{{ Math.round(effects.opacity * 100) }}%</b></span><input v-model.number="effects.opacity" type="range" min="0.1" max="1" step="0.05" aria-label="三维不透明度" /></label>
        <div v-if="hasVolume" class="display-check-row"><label class="display-check"><input v-model="effects.lighting" type="checkbox" />光照</label><label class="display-check"><input v-model="effects.shadows" type="checkbox" />阴影</label><label class="display-check"><input v-model="effects.labels" type="checkbox" />数值标注</label></div>
        <div v-if="effects.shadows && quality.quality !== 'high'" class="display-note">当前质量档位暂停阴影。</div>
        <label class="display-field"><span>混合模式</span><select v-model="effects.blend" aria-label="混合模式"><option value="overlay">叠加</option><option value="replace">替换专题结果层</option></select></label>
        <template v-if="effects.effects.includes('trajectory') || effects.effects.includes('scan')">
          <div class="display-section-head"><h3>动态效果</h3></div>
          <label class="display-range"><span>流动速度 <b>{{ effects.speed.toFixed(1) }}×</b></span><input v-model.number="effects.speed" type="range" min="0.2" max="3" step="0.1" aria-label="流动速度" /></label>
          <template v-if="effects.effects.includes('trajectory')"><label class="display-range"><span>粒子密度 <b>{{ effects.density }}</b></span><input v-model.number="effects.density" type="range" min="8" max="120" step="4" aria-label="粒子密度" /></label><label class="display-range"><span>尾迹长度 <b>{{ Math.round(effects.tail * 100) }}%</b></span><input v-model.number="effects.tail" type="range" min="0.05" max="1" step="0.05" aria-label="尾迹长度" /></label></template>
        </template>
        <div v-if="effects.effects.includes('heat')" class="display-heat-legend"><span>正值热力强度</span><i></i><span>低</span><span>高</span></div>
        <div class="display-note">{{ source?.kind === 'raster' ? '截图像元高度示意，非物理观测量。' : source?.kind === 'polygons' ? '面高按选定字段绝对值映射；原数值与面边界不变。' : '柱高按数值绝对值映射，方向由原图例区分。' }}</div>
      </section>
      <MapMediaExport v-show="tab === '3d'" />
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from "vue"
import { Drawer as ADrawer } from "ant-design-vue"
import * as mapWork from "./map"
import { defaultEffectSettings, orderedTracks, scanTargets, uniqueLegend, QUALITY_LABELS, type DisplayPoint, type EffectKind, type LegendEntry } from "./display-model"
import { buildColorMapping, createStyleMapper, defaultRenderStyle, stylePoints } from "./render-style"
import type { AdornmentMetrics } from "./cartography-layout"
import { cartographyContext, cartographySettings, cartographyEffects, cartographyRenderStyle } from "./cartography-state"
import MapMediaExport from "./MapMediaExport.vue"
import EarthquakePalette from "./EarthquakePalette.vue"
import type { EffectStatus } from "./thematic-3d"
import { clipPolygons, readPolygonDocument } from "./polygon-source"

const props = defineProps<{ open: boolean; title?: string; composing?: boolean }>()
const emit = defineEmits<{ "update:open": [value: boolean]; "open-composer": [] }>()
const tabs = [{ key: "style", label: "图层样式" }, { key: "3d", label: "3D 效果" }]
const tab = ref("style")
const source = shallowRef<mapWork.DisplaySource | null>(null)
const style = reactive(defaultRenderStyle())
const effects = reactive(defaultEffectSettings())
const quality = ref<EffectStatus>({ quality: "high", fps: null, optimized: false, count: 0 })
const displayPoints = shallowRef<DisplayPoint[]>([])
const polygonDocument = shallowRef<ReturnType<typeof readPolygonDocument> | null>(null)
const polygonField = ref("")
const polygonFilename = ref("")
const polygonFileInput = ref<HTMLInputElement | null>(null)
const legend = ref<LegendEntry[]>([])
const error = ref("")
const elapsed = ref<number | null>(null)
const rendering = ref(false)
const metrics = ref<AdornmentMetrics | null>(null)
const adorn = cartographySettings
const exportLegend = computed(() => {
  const rows = [...legend.value]
  if (effects.enabled && effects.effects.includes("heat")) { rows.push({ label: "热力柱 · 低正值", color: "#ffdf66" }, { label: "热力柱 · 高正值", color: "#c72626" }) }
  if (effects.enabled && effects.effects.includes("trajectory")) { rows.push({ label: "时间顺序轨迹", color: "#27b6bc" }, { label: "流动高光", color: "#ffdf80" }) }
  if (effects.enabled && effects.effects.includes("scan")) { rows.push(...uniqueLegend(scanTargets(displayPoints.value)).map(item => ({ ...item, label: `扫描圈 · ${item.label}` }))) }
  return rows
})
const hasTracks = computed(() => orderedTracks(displayPoints.value).length > 0)
const hasVolume = computed(() => effects.effects.some(kind => ["columns", "heat", "extrusion"].includes(kind)))
function effectCount(kind: EffectKind) {
  if (kind === "extrusion") { return `${source.value?.polygons?.length || 0} 个面` }
  if (kind === "trajectory") { return `${orderedTracks(displayPoints.value).length} 条轨迹` }
  if (kind === "heat") { return `${displayPoints.value.filter(point => point.value > 0).length} 个正值点` }
  if (kind === "scan") { return `${scanTargets(displayPoints.value).length} 个候选点` }
  return `${displayPoints.value.length} 个观测点`
}
const effectOptions: Array<{ key: EffectKind; label: string; icon: string }> = [
  { key: "columns", label: "立体柱", icon: "chart-histogram" }, { key: "heat", label: "热力柱", icon: "fire" },
  { key: "trajectory", label: "轨迹流", icon: "bezier-curve" }, { key: "scan", label: "扫描圈", icon: "radar-chart" },
  { key: "extrusion", label: "面挤出", icon: "layers" }
]
function effectUnavailable(kind: EffectKind) {
  if (kind === "extrusion") { return source.value?.kind !== "polygons" }
  if (kind === "trajectory") { return !hasTracks.value }
  return !displayPoints.value.length
}
let sourcePixels: ImageData | null = null
let pixelValues: number[] = []
let rasterMapper: ReturnType<typeof createStyleMapper> | null = null
let styledCanvas: HTMLCanvasElement | null = null
let rasterStyleKey = ""
let styleRevision = 0
let scheduledAt = 0
let renderFrame = 0
let revision = 0
let disposed = false

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("图像读取失败")); image.src = url })
}
let sourceReady = Promise.resolve()
function receiveSource(event: { source: mapWork.DisplaySource | null }) {
  sourceReady = loadSource(event)
  return sourceReady
}
async function loadSource(event: { source: mapWork.DisplaySource | null }) {
  const id = ++revision
  const previousPalette = source.value?.businessPalette
  source.value = event.source
  displayPoints.value = []
  legend.value = event.source?.legend || []
  mapWork.disableDisplayEffects()
  sourcePixels = null
  pixelValues = []
  rasterMapper = null
  styledCanvas = null
  rasterStyleKey = ""
  metrics.value = mapWork.getMapAdornmentMetrics()
  if (!event.source) { displayPoints.value = []; legend.value = []; mapWork.disableDisplayEffects(); return }
  const current = event.source
  if (current.businessPalette && current.businessPalette !== previousPalette) { style.mode = "source" }
  if (current.kind === "polygons") { style.mode = "source"; effects.effects = ["extrusion"]; effects.blend = "replace"; effects.enabled = !current.flatPolygons }
  if (current.opacity !== undefined) { style.opacity = current.opacity }
  if (!adorn.title || adorn.title === "专题分析图") { adorn.title = props.title || current.name }
  adorn.source = current.source
  adorn.legendTitle = `${current.unit} / 图例`
  if (current.kind === "raster") {
    try {
      const image = await loadImage(current.image)
      if (id !== revision || disposed) { return }
      const canvas = document.createElement("canvas")
      canvas.width = Math.min(640, image.naturalWidth)
      canvas.height = Math.max(1, Math.round(image.naturalHeight * canvas.width / image.naturalWidth))
      const context = canvas.getContext("2d", { willReadFrequently: true })!
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      sourcePixels = context.getImageData(0, 0, canvas.width, canvas.height)
      const data = sourcePixels.data
      pixelValues = Array.from({ length: canvas.width * canvas.height }, (_, i) => data[i * 4 + 3] ? Math.round(data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722) : NaN)
      rasterMapper = createStyleMapper(pixelValues)
    } catch (err) { error.value = String(err); return }
  }
  scheduleStyle()
}

function scheduleStyle() {
  styleRevision++
  scheduledAt = performance.now()
  elapsed.value = null
  cancelAnimationFrame(renderFrame)
  renderFrame = requestAnimationFrame(applyStyle)
}
async function applyStyle() {
  renderFrame = 0
  const current = source.value
  if (!current) { return }
  if (current.templateInput) { style.mode = "source" }
  const started = scheduledAt || performance.now()
  const stamp = revision
  const styleStamp = styleRevision
  const slowTimer = setTimeout(() => { rendering.value = true }, 200)
  try {
    error.value = ""
    if (current.kind === "points") {
      displayPoints.value = stylePoints(current.points, style)
      if (style.mode === "source") { legend.value = current.legend } else { legend.value = style.mode === "classified" ? buildColorMapping(current.points.map((point) => point.value), style).legend : uniqueLegend(displayPoints.value) }
      mapWork.applyPointDisplay(displayPoints.value, style)
    } else if (sourcePixels) {
      const { data, width, height } = sourcePixels
      const values = pixelValues
      const nextKey = JSON.stringify([style.mode, style.method, style.count, style.low, style.high, style.min, style.max, style.nodata])
      if (styledCanvas && nextKey === rasterStyleKey) {
        mapWork.applyRasterDisplay(styledCanvas, style.opacity)
      } else {
      const mapping = style.mode === "source" ? null : rasterMapper!(style)
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext("2d")!
      const output = new ImageData(new Uint8ClampedArray(data), width, height)
      const lookup = Array.from({ length: 256 }, (_, value) => {
        const color = mapping?.color(value)
        return color ? [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16)) : null
      })
      values.forEach((value, i) => {
        if (!Number.isFinite(value) || value === style.nodata) { output.data[i * 4 + 3] = 0; return }
        const rgb = lookup[value]
        if (rgb) { output.data.set(rgb, i * 4) }
      })
      context.putImageData(output, 0, 0)
      mapWork.applyRasterDisplay(canvas, style.opacity)
      styledCanvas = canvas
      rasterStyleKey = nextKey
      legend.value = mapping?.legend || (current.legend.length ? current.legend : [{ label: "当前计算结果（RGB）", color: "#648a91" }])
      const points: DisplayPoint[] = []
      const rect = current.rectangle
      for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 12))) {
        for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 18))) {
          const i = y * width + x
          if (!output.data[i * 4 + 3]) { continue }
          const color = "#" + Array.from(output.data.slice(i * 4, i * 4 + 3)).map((v) => v.toString(16).padStart(2, "0")).join("")
          points.push({ lon: rect.west + (x + 0.5) / width * (rect.east - rect.west), lat: rect.north - (y + 0.5) / height * (rect.north - rect.south), value: values[i], color, band: "截图像元", label: `RGB ${values[i]}` })
        }
      }
      displayPoints.value = points
      }
    }
    await applyEffects()
    await mapWork.afterDisplayRender()
    if (stamp === revision && styleStamp === styleRevision) { elapsed.value = Math.round(performance.now() - started) }
  } catch (err) { if (stamp === revision && styleStamp === styleRevision) { error.value = err instanceof Error ? err.message : "渲染失败" } } finally { clearTimeout(slowTimer); if (styleStamp === styleRevision) { rendering.value = false } }
}
async function applyEffects() {
  if (!source.value) { mapWork.disableDisplayEffects(); return }
  if (!hasTracks.value && effects.effects.includes("trajectory")) { effects.effects = effects.effects.filter((item) => item !== "trajectory") }
  try { await mapWork.updateDisplayEffects(displayPoints.value, effects) } catch (err) { effects.enabled = false; error.value = `3D 不可用，已保留二维结果：${err instanceof Error ? err.message : err}` }
}
async function importPolygons(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) { return }
  try {
    if (file.size > 10 * 1024 * 1024) { throw new Error("GeoJSON 文件不能超过 10 MB") }
    const parsed = readPolygonDocument(JSON.parse(await file.text()))
    polygonDocument.value = parsed
    polygonField.value = parsed.fields.find((field) => /^(value|intensity|risk|score)$/i.test(field)) || parsed.fields[0]
    polygonFilename.value = file.name
    applyPolygonField()
  } catch (err) { error.value = err instanceof Error ? err.message : "GeoJSON 导入失败" }
  ;(event.target as HTMLInputElement).value = ""
}
function applyPolygonField() {
  const bounds = mapWork.getLockedSelection()
  if (!bounds || !polygonDocument.value) { error.value = "请先框选并锁定制图范围"; return }
  try {
    const polygons = clipPolygons(polygonDocument.value.document, polygonField.value, bounds)
    error.value = ""
    mapWork.setDisplayPolygonSource(polygons, polygonField.value, polygonFilename.value)
  } catch (err) { error.value = err instanceof Error ? err.message : "面要素裁切失败" }
}
function receiveQuality(status: EffectStatus) {
  quality.value = status
  if (status.error) { error.value = status.error; effects.enabled = false }
}
function refreshMetrics() { metrics.value = mapWork.getMapAdornmentMetrics() }
function syncCartographyContext() { cartographyContext.value = { legend: exportLegend.value.map(item => ({ ...item })), metrics: metrics.value, symbols: mapWork.getCartographySymbols() } }
async function prepareCapture() {
  await sourceReady
  cancelAnimationFrame(renderFrame)
  await applyStyle()
  if (error.value) { throw new Error(error.value) }
  if (source.value?.kind === "raster") { await mapWork.waitForTemplateRaster() }
  refreshMetrics(); syncCartographyContext()
}
defineExpose({ prepareCapture })
watch(style, scheduleStyle, { deep: true })
watch(effects, applyEffects, { deep: true })
watch(effects, value => { cartographyEffects.value = JSON.parse(JSON.stringify(value)) }, { deep: true, immediate: true })
watch([style, () => source.value?.businessPalette], () => {
  cartographyRenderStyle.value = JSON.parse(JSON.stringify({ ...style, businessPalette: style.mode === "source" ? source.value?.businessPalette : undefined }))
}, { deep: true, immediate: true })
watch([exportLegend, metrics], syncCartographyContext, { deep: true })
watch(() => props.open, (value) => { if (value) { metrics.value = mapWork.getMapAdornmentMetrics() } })
onMounted(() => {
  mapWork.eventTarget.on("displayDataChanged", receiveSource)
  mapWork.eventTarget.on("displayQualityChanged", receiveQuality)
  mapWork.eventTarget.on("selectionBoundsChanged", refreshMetrics)
  for (const event of ["symbolPlaced", "symbolMoved", "symbolRemoved", "symbolsCleared"]) { mapWork.eventTarget.on(event, syncCartographyContext) }
  receiveSource({ source: mapWork.getDisplaySource() })
})
onUnmounted(() => {
  disposed = true
  revision++
  cancelAnimationFrame(renderFrame)
  mapWork.disableDisplayEffects()
  mapWork.eventTarget.off("displayDataChanged", receiveSource)
  mapWork.eventTarget.off("displayQualityChanged", receiveQuality)
  mapWork.eventTarget.off("selectionBoundsChanged", refreshMetrics)
  for (const event of ["symbolPlaced", "symbolMoved", "symbolRemoved", "symbolsCleared"]) { mapWork.eventTarget.off(event, syncCartographyContext) }
})
</script>

<style scoped>
.decoration-toggles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 6px; margin-bottom: 16px; }
.decoration-toggles label { display: flex; align-items: center; gap: 5px; font-size: 12px; }
.display-settings { --ink: var(--mars-text-color, #20343d); --muted: var(--mars-text-color-secondary, #617581); color: var(--ink); font-size: 13px; letter-spacing: 0; }
.display-source { display: grid; gap: 6px; padding-bottom: 16px; border-bottom: 1px solid #7c949530; overflow-wrap: anywhere; }
.display-source strong { font-size: 15px; }
.display-source span, .display-section-head > span { color: var(--muted); font-size: 12px; }
.display-tabs { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); margin: 12px 0 18px; border-bottom: 1px solid #7c949540; }
.display-tabs button { padding: 12px 0; background: none; border: 0; border-bottom: 2px solid transparent; color: var(--muted); cursor: pointer; }
.display-tabs button.active { color: #1675cc; border-color: #1675cc; font-weight: 600; }
.display-settings section { min-width: 0; }
.display-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 20px 0 14px; }
.display-section-head:first-child { margin-top: 0; }
.display-section-head h3 { font-size: 14px; color: inherit; margin: 0; }
.display-field { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 14px 0; }
.display-field.is-stacked { display: grid; grid-template-columns: minmax(0, 1fr); justify-content: stretch; gap: 7px; }
.display-field span { flex-shrink: 0; }
.display-field b { color: #cc5050; }
.display-settings select, .display-settings input:not([type=checkbox]):not([type=range]):not([type=color]):not([type=radio]), .display-settings textarea { width: 100%; min-width: 0; min-height: 34px; border: 1px solid #7c949565; border-radius: 4px; background: var(--bg-elevated, #fff); color: inherit; padding: 6px 8px; }
.display-field > select, .display-field > input:not([type=color]) { max-width: 214px; }
.display-field.is-stacked > input { max-width: none; }
.display-range { display: grid; gap: 9px; margin: 20px 0; }
.display-range > span { display: flex; justify-content: space-between; }
.display-range b { font-variant-numeric: tabular-nums; color: #238e9d; }
.display-range input { width: 100%; accent-color: #168b9b; }
.display-pair { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 12px; }
.display-pair label { display: grid; gap: 6px; min-width: 0; }
.display-color-row { display: flex; align-items: center; gap: 12px; margin: 16px 0; }
.display-color-row label { display: grid; gap: 5px; font-size: 11px; }
.display-color-bar { height: 12px; flex: 1; }
.display-settings input[type=color] { width: 40px; height: 28px; padding: 2px; border: 1px solid #7c949565; background: none; border-radius: 3px; }
.display-check { display: flex; gap: 7px; align-items: center; }
.display-check-row { display: flex; gap: 20px; flex-wrap: wrap; }
.display-check input, .display-effect-grid input { accent-color: #168b9b; }
.display-note { font-size: 12px; line-height: 1.6; color: var(--muted); margin: 12px 0; overflow-wrap: anywhere; }
.display-note.is-warning { color: #a86a19; border-left: 2px solid #c99032; padding-left: 9px; }
.display-error { padding: 10px; color: #bf3b32; border: 1px solid #d57e7055; background: #cf53450c; line-height: 1.6; }
.display-legend { display: grid; gap: 10px; padding: 0; list-style: none; }
.display-legend li { display: flex; align-items: center; gap: 10px; overflow-wrap: anywhere; }
.display-legend i { width: 24px; height: 13px; border: 1px solid #84949866; flex-shrink: 0; }
.restore-palette { display: block; margin-top: 8px; padding: 4px 0; border: 0; background: transparent; color: var(--mars-primary-color, #237fbe); cursor: pointer; text-decoration: underline; }
.render-latency { font-variant-numeric: tabular-nums; color: var(--mars-text-color-secondary, #617581); }
.render-latency.is-slow { color: #a86a19; }
:global(:root[data-theme=dark] .render-latency.is-slow) { color: #f0c66b; }
.display-performance { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #7c949530; color: var(--muted); }
.display-performance strong { color: #27925d; font-variant-numeric: tabular-nums; }
.display-effect-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 18px 0; }
.display-effect-grid label { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 64px; padding: 10px 8px; border: 1px solid #7c949550; border-radius: 4px; cursor: pointer; }
.display-effect-grid label > span { min-width: 0; overflow-wrap: anywhere; }
.display-effect-grid small { display: block; margin-top: 3px; color: var(--muted); font-size: 11px; }
.display-effect-grid label:focus-within { outline: 2px solid #2195c6; outline-offset: 2px; }
.display-effect-grid .disabled { cursor: not-allowed; }
.display-effect-grid .selected { border-color: #168b9b; background: #168b9b10; }
.display-effect-grid .disabled { opacity: .5; }
.display-polygon-file { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; }
.display-polygon-file button { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 11px; border: 1px solid #7c949565; border-radius: 3px; background: transparent; color: inherit; cursor: pointer; }
.display-file-input { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
.display-heat-legend { display: grid; grid-template-columns: 1fr 1fr; font-size: 11px; gap: 6px; margin-top: 16px; }
.display-heat-legend > span:first-child, .display-heat-legend i { grid-column: 1 / -1; }
.display-heat-legend > span:last-child { text-align: right; }
.display-heat-legend i { height: 10px; background: linear-gradient(90deg,#ffdf66,#c72626); }
.adornment-checks { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 6px; padding-bottom: 14px; border-bottom: 1px solid #7c949530; }
.adornment-checks button { display: flex; align-items: center; justify-content: center; gap: 5px; min-width: 0; min-height: 36px; padding: 5px; border: 1px solid #7c949550; border-radius: 4px; background: transparent; color: #d7a65f; font: inherit; font-size: 12px; cursor: pointer; }
.adornment-checks button.complete { color: #58c89a; }
.adornment-checks button.selected { border-color: #48aade; background: color-mix(in srgb, #48aade 13%, transparent); color: var(--ink); font-weight: 600; }
.adornment-editor { min-height: 108px; }
.display-scale-presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 0; margin: 0 0 18px; border: 0; }
.display-scale-presets legend { margin-bottom: 9px; color: var(--ink); font-size: 13px; }
.display-scale-presets legend b { color: #db685e; }
.display-scale-presets label { display: flex; align-items: center; gap: 5px; min-height: 36px; padding: 5px; border: 1px solid #7c949550; border-radius: 4px; font-size: 12px; cursor: pointer; }
.display-scale-presets label.selected { border-color: #48aade; background: #48aade18; }
.display-scale-presets input[type=radio] { width: 14px; height: 14px; min-height: 0; flex: 0 0 14px; margin: 0; padding: 0; accent-color: #238fac; }
.adornment-readout { display: flex; align-items: center; gap: 10px; min-height: 38px; margin: 14px 0; color: var(--muted); }
.adornment-readout strong { margin-left: auto; color: var(--ink); font-variant-numeric: tabular-nums; }
.adornment-readout button { min-height: 30px; padding: 0 9px; border: 1px solid #7c949565; border-radius: 4px; background: transparent; color: var(--ink); cursor: pointer; }
.display-export-actions { display: flex; gap: 10px; margin-top: 22px; }
.display-export-actions.is-view { margin-top: 0; margin-bottom: 20px; }
.display-export-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 36px; flex: 1; border: 1px solid #7c949565; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
.display-export-actions .primary { color: #fff; background: #147a92; border-color: #147a92; }
.display-settings button:disabled { opacity: .5; cursor: not-allowed; }
.display-settings :is(button,select,input,textarea):focus-visible { outline: 2px solid #2195c6; outline-offset: 2px; }
.adornment-preview { display: block; margin-top: 20px; border: 1px solid #7c949540; }
.adornment-preview img { display: block; width: 100%; height: auto; }
:global(.thematic-display-drawer .ant-drawer-content) { background: var(--bg-primary, #fff); color: var(--mars-text-color, #20343d); }
:global(.thematic-display-drawer .ant-drawer-body) { padding: 18px 22px; background: var(--bg-primary, #fff); }
:global(.thematic-display-drawer .ant-drawer-header) { background: var(--bg-primary, #fff); border-bottom-color: #7c949540; }
:global(:root[data-theme=dark] .thematic-display-drawer .display-note.is-warning) { color: #f0c66b; }
:global(:root[data-theme=dark] .thematic-display-drawer .display-tabs button.active) { color: #6cb6fa; }
:global(:root[data-theme=dark] .thematic-display-drawer .display-range b) { color: #6ccdd7; }
:global(:root[data-theme=dark] .thematic-display-drawer .display-performance strong) { color: #68d6a6; }
:global(:root[data-theme=dark] .thematic-display-drawer :is(select,input)) { color-scheme: dark; }
.display-settings option { color: var(--ink); background: var(--bg-elevated, #fff); }
:global(:root[data-theme=dark] .thematic-display-drawer .display-error) { color: #ffad9c; }
:global(.thematic-display-drawer .ant-drawer-title), :global(.thematic-display-drawer .ant-drawer-close) { color: var(--mars-text-color, #20343d); }
@media (max-width: 480px) { :global(.thematic-display-drawer .ant-drawer-content-wrapper) { width: min(420px, 100vw) !important; } }
</style>
