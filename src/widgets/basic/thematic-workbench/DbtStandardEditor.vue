<template>
  <section class="dbt-editor" aria-label="地震应急响应标准制图编辑">
    <header><strong>{{ template.name }}</strong><span>{{ mapCode }} · {{ DBT_CLASSIFICATION }}</span></header>
    <div class="dbt-actions">
      <button v-if="!doc" type="button" :disabled="busy" @click="doc = emptyDbtDocument()"><mars-icon icon="plus" :width="16" />新建图件</button>
      <button type="button" :disabled="busy || mapBusy" @click="loadTest"><mars-icon icon="play" :width="16" />加载测试数据</button>
      <button type="button" :disabled="busy || mapBusy" @click="input?.click()"><mars-icon icon="upload" :width="16" />导入制图数据</button>
      <button type="button" title="下载空数据结构" aria-label="下载标准数据结构" @click="downloadDocument(false)"><mars-icon icon="download" :width="16" /></button>
      <input ref="input" hidden type="file" accept=".json,.geojson" aria-label="标准制图数据文件" @change="importDocument" />
    </div>
    <p v-if="error" role="alert" class="dbt-error">{{ error }}</p>
    <p v-if="doc?.usage === 'test'" class="dbt-test" role="status">合成测试数据 · 非真实震情 · 禁止业务使用</p>
    <section class="dbt-map-source" aria-label="地图与草稿预览">
      <div class="dbt-actions">
        <button type="button" :disabled="mapBusy || busy" @click="requestMap(false)"><mars-icon icon="refresh" :width="16" />取当前视图</button>
        <button type="button" :disabled="mapBusy || busy" @click="requestMap(true)"><mars-icon icon="rectangle" :width="16" />框选底图</button>
        <button v-if="hasStandardExtent && useMapDraft" type="button" :disabled="busy" @click="layoutOnly = false"><mars-icon icon="map" :width="16" />返回数据图件</button>
      </div>
      <p v-if="mapError" role="alert" class="dbt-error">{{ mapError }}</p>
      <p class="dbt-status" role="status">{{ mapBusy ? '正在采集地图画面…' : useMapDraft ? '底图草稿 · 未生成专题成果' : '数据图件 · 待质量审核' }}</p>
      <button class="dbt-inline-preview" type="button" aria-label="展开标准图件预览" @click="openProof"><img v-if="composedPreview || preview" :src="composedPreview || preview" alt="标准模板当前草稿预览" /><span v-else>版式生成中</span></button>
      <ul v-if="useMapDraft" class="dbt-missing"><li>正式震情：{{ doc?.event.time && doc.event.place && doc.event.magnitude ? '已填写，待核验' : '待补齐' }}</li><li>规范范围：{{ hasStandardExtent ? '已计算，待复核' : '待快速评估烈度面' }}</li><li>专题数据：{{ requiredData.filter(item => !item.present).map(item => item.label).join('、') || '已载入，待核验' }}</li></ul>
    </section>
    <div class="dbt-actions"><button type="button" @click="openProof"><mars-icon icon="layout-two" :width="16" />{{ !embedded && proofOpen ? '收起图件' : '制图排版' }}</button><button type="button" :disabled="!doc" @click="downloadDocument(true)"><mars-icon icon="save" :width="16" />保存制图数据</button><button type="button" :disabled="!undoStack.length || busy" aria-label="撤销标准制图操作" title="撤销" @click="historyStep(false)"><mars-icon icon="undo" :width="16" /></button><button type="button" :disabled="!redoStack.length || busy" aria-label="重做标准制图操作" title="重做" @click="historyStep(true)"><mars-icon icon="redo" :width="16" /></button></div>
    <dl class="dbt-spec"><dt>幅面</dt><dd>A3 横向 · 420 × 297 mm</dd><dt>坐标</dt><dd>{{ useMapDraft ? '底图屏幕影像 · 未地理配准' : `${doc?.crs || '待导入'} · 地理坐标（度）` }}</dd><dt>范围</dt><dd>{{ extentLabel }}</dd><dt>版式</dt><dd>标题 / 图件 / 说明 / 注释</dd></dl>
    <template v-if="doc">
      <details open><summary>震情与出图信息</summary>
        <div v-if="doc.classification" class="dbt-pair"><label>专题实例<select v-model="doc.classification.instance" aria-label="专题实例"><option v-for="(label, code) in dbtInstances[templateId]" :key="code" :value="code">{{ code }} · {{ label }}</option></select></label><label>空间范围代码<select v-model="doc.classification.spatial" aria-label="空间范围代码"><option v-for="(label, code) in dbtSpatialCodes" :key="code" :value="code">{{ code }} · {{ label }}</option></select></label></div>
        <label>发震时间<input v-model="doc.event.time" aria-label="标准发震时间" /></label>
        <label>震中地名<input v-model="doc.event.place" aria-label="标准震中地名" /></label>
        <div class="dbt-pair"><label>震级<input v-model.number="doc.event.magnitude" type="number" min="0" max="10" step="0.1" /></label><label>震级类型<input v-model="doc.event.magnitudeType" /></label></div>
        <label>正式震情来源<input v-model="doc.event.authority" /></label><label>公告编号或链接<input v-model="doc.event.bulletin" /></label>
        <div class="dbt-pair"><label>经度<input v-model.number="doc.event.longitude" type="number" step="0.001" /></label><label>纬度<input v-model.number="doc.event.latitude" type="number" step="0.001" /></label></div>
        <div class="dbt-pair"><label>震中所属省区<input v-model="doc.region.province" aria-label="震中所属省区" /></label><label>所属地市州<input v-model="doc.region.prefecture" /></label></div>
        <label class="dbt-check"><input v-model="doc.region.offshore" type="checkbox" />近海海域</label>
        <label>制图分区<select v-model="doc.region.zone"><option value="R1">R1 稀疏区</option><option value="R2">R2 稠密区</option><option value="R3">R3 近海海域</option></select></label>
        <p class="dbt-status">表 1 归属校验：{{ derivedRegion || '行政归属待补充' }}</p>
        <label>行政归属依据<input v-model="doc.region.evidence" /></label>
        <label>CGCS2000 坐标依据<input v-model="doc.crsEvidence" /></label>
        <label>制作单位<input v-model="doc.agency" aria-label="标准制作单位" /></label><label>制图时间<input v-model="doc.createdAt" aria-label="标准制图时间" /></label>
        <label>内容说明<textarea v-model="doc.description" rows="5" maxlength="900" aria-label="标准内容说明"></textarea></label>
      </details>
      <details v-if="templateId === 'T30201000' && doc.assessment" open><summary>快速评估参数</summary><div class="dbt-pair"><label>长轴长度 km<input v-model.number="doc.assessment.longAxisKm" type="number" min="0" /></label><label>短轴长度 km<input v-model.number="doc.assessment.shortAxisKm" type="number" min="0" /></label></div><label>长轴走向 °<input v-model.number="doc.assessment.azimuth" type="number" min="0" max="359.99" /></label></details>
      <details><summary>数据图层 · 当前类别显示 {{ visibleLayers.length }} 层</summary>
        <div class="dbt-pair"><label>新增图层类型<select v-model="newRole"><option v-for="(name, role) in dbtRoleNames" :key="role" :value="role">{{ name }}</option></select></label><button type="button" @click="addLayer"><mars-icon icon="plus" :width="16" />添加图层</button></div>
        <details v-for="layer in doc.layers" :key="layer.id" class="dbt-layer"><summary>{{ layer.name }} · {{ layer.data.features.length }} 要素{{ layer.raster ? ' · 栅格' : '' }}</summary>
          <label class="dbt-check"><input type="checkbox" :checked="layer.enabled !== false" @change="layer.enabled = ($event.target as HTMLInputElement).checked" />参与制图</label>
          <label>图层名称<input v-model="layer.name" /></label>
          <div class="dbt-actions"><button type="button" @click="chooseLayer(layer.id)"><mars-icon icon="upload" :width="16" />替换要素或栅格</button><button type="button" aria-label="删除数据图层" title="删除图层" @click="doc.layers = doc.layers.filter(item => item.id !== layer.id)"><mars-icon icon="delete" :width="16" /></button></div>
          <label>权威来源机构<input v-model="layer.authority" /></label><label>来源编号或链接<input v-model="layer.source" /></label>
          <div class="dbt-pair"><label>数据日期<input v-model="layer.publishedAt" /></label><label>比例尺分母<input v-model.number="layer.scale" type="number" min="1" /></label></div>
          <label>密级声明<select v-model="layer.security"><option value="">待核验</option><option value="public">非涉密公开数据</option><option value="declassified">已脱密数据</option></select></label>
          <label>坐标转换或原始坐标依据<input v-model="layer.crsEvidence" /></label>
          <template v-if="layer.coverage"><span>数据覆盖范围（度）</span><div class="dbt-pair"><label v-for="(label, key) in boundLabels" :key="key">{{ label }}<input v-model.number="layer.coverage[key]" type="number" step="0.001" /></label></div></template>
          <label>范围内完整性依据<textarea v-model="layer.coverageEvidence" rows="2"></textarea></label>
          <p v-if="requirements[layer.role]" class="dbt-status">本图所需：{{ requirements[layer.role] }}</p>
          <template v-if="layer.raster"><label>栅格表达<select v-model="layer.raster.rendering"><option value="hillshade">分级地形晕渲</option><option value="imagery">遥感影像</option><option value="classified">分类栅格</option></select></label><label>匀光 / 晕渲依据<input v-model="layer.raster.radiometry" /></label><span>栅格地理定位（度）</span><div class="dbt-pair"><label v-for="(label, key) in boundLabels" :key="key">{{ label }}<input v-model.number="layer.raster.bounds[key]" type="number" step="0.001" /></label></div></template>
          <label v-if="layer.role === 'economy'">指标单位<input v-model="layer.unit" /></label>
          <label v-if="layer.role === 'pga'">GB 18306 / GB 55002 参数对应依据<textarea v-model="layer.parameterEvidence" rows="2"></textarea></label>
          <label v-if="layer.legend?.length">配色依据<input v-model="layer.colorStandard" /></label>
        </details>
        <input ref="layerInput" hidden type="file" accept=".json,.geojson,.png,.jpg,.jpeg" aria-label="图层数据文件" @change="importLayer" />
      </details>
      <details open v-if="statistics.length"><summary>专题统计</summary><table class="dbt-table"><thead><tr><th>指标</th><th>数值</th><th>单位</th></tr></thead><tbody><tr v-for="(row, i) in statistics" :key="i"><td>{{ row.label }}</td><td>{{ row.value === null ? '待核实' : Number(row.value.toFixed(2)).toLocaleString() }}</td><td>{{ row.unit }}</td></tr></tbody></table><p v-for="note in statisticNotes" :key="note" class="dbt-status">{{ note }}</p></details>
    </template>
    <details class="dbt-quality"><summary>正式出图检查 · {{ blocking.length }} 项待处理</summary>
      <ul><li v-for="(issue, i) in allIssues" :key="i" :class="`is-${issue.severity}`"><b>{{ issue.clause }}</b> {{ issue.message }}</li></ul>
      <div class="dbt-review"><label v-for="(entry, i) in dbtReviewClauses" :key="entry.clause"><input v-model="reviewed[i]" type="checkbox" :disabled="!doc || doc.usage !== 'operational'" />{{ entry.clause }} · {{ entry.label }}</label><label>复核人<input v-model="reviewer" aria-label="标准复核人" /></label><label>复核依据<textarea v-model="reviewEvidence" rows="2" aria-label="标准复核依据"></textarea></label></div>
    </details>
    <div class="dbt-pair"><label>输出格式<select v-model="format" aria-label="标准输出格式"><option value="pdf">PDF</option><option value="jpg">JPG</option></select></label><label>分辨率<select v-model.number="dpi" aria-label="标准输出DPI"><option :value="300">300 DPI</option><option :value="450">450 DPI</option><option :value="600">600 DPI</option></select></label></div>
    <div class="dbt-actions"><button type="button" :disabled="!doc || busy" @click="exportMap(false)"><mars-icon icon="download" :width="16" />导出校样</button><button type="button" :disabled="!canExport || busy" @click="exportMap(true)"><mars-icon icon="download" :width="16" />正式出图</button><button type="button" title="下载检查记录" aria-label="下载标准检查记录" @click="downloadReport"><mars-icon icon="inspection" :width="16" /></button></div>
    <p class="dbt-status" role="status">{{ status }}</p>
    <details><summary>标准与数据来源</summary><p>{{ DBT_STANDARD }}</p><p>{{ DBT_CLASSIFICATION }}</p><a v-for="source in sources" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.name }}</a></details>
    <Teleport to="body">
      <section v-if="!embedded && active && proofOpen" class="dbt-proof" :style="proofStyle" role="dialog" aria-label="标准制图排版工作台">
        <header><strong>标准制图排版</strong><span>A3 · 制作要求报批稿</span><button type="button" aria-label="关闭标准图件预览" title="关闭预览" @click="proofOpen = false"><mars-icon icon="close" :width="18" /></button></header>
        <div class="dbt-proof-tools"><span>{{ useMapDraft ? '底图草稿' : doc?.usage === 'test' ? '合成测试校样' : '待审核校样' }}</span><button type="button" aria-label="缩小标准图件" @click="zoom = Math.max(0.5, zoom - 0.25)"><mars-icon icon="minus" :width="16" /></button><span>{{ Math.round(zoom * 100) }}%</span><button type="button" aria-label="放大标准图件" @click="zoom = Math.min(3, zoom + 0.25)"><mars-icon icon="plus" :width="16" /></button><button type="button" title="适合窗口" aria-label="适合标准图件窗口" @click="zoom = 1"><mars-icon icon="full-screen" :width="16" /></button></div>
        <div class="dbt-proof-scroll"><img v-if="preview" :src="preview" :style="{ width: `${previewWidth * zoom}px` }" alt="按照制作要求四区版式绘制的实际校样" /><span v-else>{{ busy ? '正在渲染' : '图件准备中' }}</span></div>
        <footer>{{ status || template.name }}</footer>
      </section>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import type { FeatureCollection } from "geojson"
import { DBT_STANDARD, DBT_CLASSIFICATION, dbtTemplates, dbtTitle, dbtReviewClauses, dbtVisibleLayers, dbtScopedLayers, emptyDbtDocument, inspectDbtDocument, readDbtDocument, standardBounds, type DbtDocument, type DbtTemplateId, type DbtIssue } from "./dbt116-standard"
import { baseRequirements, dbtInstances, dbtMapCode, dbtRegion, dbtRoleNames, dbtSpatialCodes, dbtStatistics } from "./dbt-cartography-rules"
import { renderDbtMap } from "./dbt116-renderer"
import { encodeDbtMap } from "./dbt116-export"
import { downloadBlob, canvasBlob } from "./export-media"
import { composerDock } from "./composer-dock"
import { draftRequirements, type DbtMapPreview } from "./dbt-draft-preview"
import { standardComposition, type StandardComposition } from "./standard-composition"

const props = defineProps<{ templateId: DbtTemplateId; active: boolean; mapPreview?: DbtMapPreview | null; mapBusy?: boolean; mapError?: string; embedded?: boolean; compositionIssues?: string[]; composedPreview?: string }>()
const emit = defineEmits<{ captureMap: []; selectRange: []; rendered: [scene: StandardComposition]; openComposition: []; exportProof: [format: "jpg" | "pdf", dpi: number] }>()
const doc = ref<DbtDocument | null>(emptyDbtDocument())
const input = ref<HTMLInputElement>(); const error = ref(""); const status = ref(""); const busy = ref(false)
const preview = ref(""); const proofOpen = ref(false); const zoom = ref(1)
const layoutOnly = ref(false); let awaitingMap = false
const previewWidth = ref(480)
const dpi = ref(300); const format = ref<"jpg" | "pdf">("pdf")
const reviewed = ref<boolean[]>([]); const reviewer = ref(""); const reviewEvidence = ref("")
const renderIssues = ref<DbtIssue[]>([])
const renderReady = ref(false)
const newRole = ref("boundary"); const layerInput = ref<HTMLInputElement>(); let targetLayer = ""
const boundLabels = { west: "西", south: "南", east: "东", north: "北" }
const undoStack = ref<string[]>([]); const redoStack = ref<string[]>([])
let previousSnapshot = JSON.stringify(doc.value); let restoring = false; let lastHistory = 0
const proofStyle = ref<Record<string, string>>({})
const template = computed(() => dbtTemplates.find(item => item.id === props.templateId)!)
const hasStandardExtent = computed(() => { try { return !!doc.value && !!standardBounds(doc.value, props.templateId) } catch { return false } })
const useMapDraft = computed(() => layoutOnly.value || !hasStandardExtent.value)
const requiredData = computed(() => draftRequirements(doc.value, props.templateId))
const visibleLayers = computed(() => doc.value ? dbtVisibleLayers(doc.value, props.templateId) : [])
const scopedLayers = computed(() => doc.value ? dbtScopedLayers(doc.value, props.templateId) : [])
const statistics = computed(() => doc.value ? dbtStatistics(doc.value, props.templateId, scopedLayers.value) : [])
const statisticNotes = computed(() => [...new Set(statistics.value.map(row => row.note).filter(Boolean))])
const requirements = computed<Record<string, string>>(() => doc.value ? baseRequirements(doc.value, props.templateId, visibleLayers.value) : {})
const derivedRegion = computed(() => doc.value && dbtRegion(doc.value.region.province, doc.value.region.prefecture, doc.value.region.offshore))
const mapCode = computed(() => { try { return dbtMapCode(props.templateId, doc.value?.classification?.instance, doc.value?.classification?.spatial) } catch { return "分类编码待核验" } })
const allIssues = computed(() => [...inspectDbtDocument(doc.value, props.templateId), ...renderIssues.value, ...(props.compositionIssues || []).map(message => ({ clause: "9 / 10.1", message, severity: "error" as const }))])
const blocking = computed(() => allIssues.value.filter(issue => issue.severity === "error"))
const canExport = computed(() => !!doc.value && !useMapDraft.value && renderReady.value && !blocking.value.length && dbtReviewClauses.every((_, i) => reviewed.value[i]) && !!reviewer.value.trim() && !!reviewEvidence.value.trim())
const extentLabel = computed(() => {
  if (useMapDraft.value) {
    const bounds = props.mapPreview?.bounds
    return bounds ? `草稿框选：西${bounds.west.toFixed(3)} / 南${bounds.south.toFixed(3)} / 东${bounds.east.toFixed(3)} / 北${bounds.north.toFixed(3)} · 非规范出图范围` : "当前视图草稿 · 规范范围待评估"
  }
  const extent = doc.value && standardBounds(doc.value, props.templateId)
  return extent ? `${extent.west.toFixed(3)}°—${extent.east.toFixed(3)}° E / ${extent.south.toFixed(3)}°—${extent.north.toFixed(3)}° N · 烈度区外扩 10 km` : "待导入快速评估烈度面"
})
const sources = [
  { name: "国家地震科学数据中心：数据服务流程", url: "https://data.earthquake.cn/fwlc/info/2024/334672344.html" },
  { name: "官方断层样例：2025-06-05 洱源地震（CRS84）", url: "https://data.earthquake.cn/gxdt/info/2025/334673554.html" },
  { name: "基础地理信息数据目录", url: "https://www.webmap.cn/commres.do?method=result100W" }
]
let disposed = false; let version = 0; let timer: ReturnType<typeof setTimeout> | undefined; let observer: ResizeObserver | undefined
function positionProof() {
  const panel = window.document.querySelector(".thematic-workbench-panel")?.getBoundingClientRect()
  if (!panel) { return }
  const rect = composerDock({ x: panel.left, y: panel.top, w: panel.width, h: panel.height }, { width: window.innerWidth, height: window.innerHeight })
  if (window.innerWidth <= 900) { Object.assign(rect, { x: 12, y: 86, w: window.innerWidth - 24, h: window.innerHeight - 108 }) }
  proofStyle.value = { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` }
  previewWidth.value = Math.max(80, Math.min(rect.w - 38, (rect.h - 180) * 420 / 297))
}
async function render() {
  if (!props.active || disposed) { return }
  const current = ++version; const snapshot = doc.value ? JSON.parse(JSON.stringify(doc.value)) : null
  busy.value = true
  try {
    const canvas = window.document.createElement("canvas")
    const result = await renderDbtMap(canvas, snapshot ? readDbtDocument(snapshot) : null, props.templateId, { layoutOnly: useMapDraft.value, mapPreview: props.mapPreview })
    const blob = await canvasBlob(canvas)
    if (disposed || current !== version || !props.active) { return }
    if (preview.value) { URL.revokeObjectURL(preview.value) }; preview.value = URL.createObjectURL(blob)
    renderIssues.value = result.issues.map(message => ({ clause: "9 / 10.1", message, severity: "error" }))
    renderReady.value = true; error.value = ""
    status.value = "请选择测试数据或导入制图数据"
    if (snapshot) {
      status.value = props.mapPreview ? "底图已接入四区版式 · 专题数据与规范范围待补齐" : "四区版式已生成 · 底图待采集"
      if (result.bounds) { status.value = `${visibleLayers.value.length} 个图层已渲染 · 质量审核未完成` }
    }
    if (props.embedded) { emit("rendered", standardComposition(canvas, snapshot, props.templateId, result.legendY, !result.bounds)) }
  } catch (err) { if (current === version) { error.value = err instanceof Error ? err.message : "渲染失败"; renderReady.value = false; renderIssues.value = [{ clause: "10.1", message: error.value, severity: "error" }] } } finally { if (current === version) { busy.value = false } }
}
function openProof() { if (props.embedded) { emit("openComposition") } else { proofOpen.value = !proofOpen.value } }
function updateCopy(kind: string, text: string) {
  if (!doc.value) { return }
  if (kind === "description") { doc.value.description = text }
  if (kind === "agency") { doc.value.agency = text }
  if (kind === "time") { doc.value.createdAt = text }
}
function importTemplateLayer(data: FeatureCollection & { metadata?: Record<string, unknown> }, role: string, name: string) {
  if (!doc.value || !dbtRoleNames[role]) { return }
  try {
    const snapshot: DbtDocument = JSON.parse(JSON.stringify(doc.value)); const metadata = data.metadata || {}
    const id = `template:${role}`
    snapshot.layers = snapshot.layers.filter(layer => layer.id !== id)
    snapshot.layers.push({ id, name, role, crs: typeof metadata.crs === "string" ? metadata.crs : "CRS84", source: typeof metadata.source === "string" ? metadata.source : name, authority: "", publishedAt: "", security: "", scale: 1000000, unit: typeof metadata.unit === "string" ? metadata.unit : undefined, data: JSON.parse(JSON.stringify(data)) })
    if (metadata.usage === "test") { snapshot.usage = "test" }
    doc.value = readDbtDocument(snapshot); error.value = ""
  } catch (err) { error.value = err instanceof Error ? err.message : "模板数据接入失败" }
}
defineExpose({ updateCopy, importTemplateLayer })
function requestMap(selection: boolean) {
  awaitingMap = true; proofOpen.value = false
  if (selection) { emit("selectRange") } else { emit("captureMap") }
}
function addLayer() {
  if (!doc.value) { return }
  doc.value.layers.push({ id: crypto.randomUUID(), name: dbtRoleNames[newRole.value], role: newRole.value, crs: "EPSG:4490", source: "", authority: "", publishedAt: "", security: "", scale: 1000000, coverage: standardBounds(doc.value, props.templateId) || { west: 0, south: 0, east: 1, north: 1 }, data: { type: "FeatureCollection", features: [] } })
}
function chooseLayer(id: string) { targetLayer = id; layerInput.value?.click() }
async function importLayer(event: Event) {
  const element = event.target as HTMLInputElement; const file = element.files?.[0]; if (!file || !doc.value) { return }
  const revision = version; const id = targetLayer
  try {
    if (file.size > 20 * 1024 * 1024) { throw new Error("单层数据不能超过 20 MB") }
    const snapshot = JSON.parse(JSON.stringify(doc.value)) as DbtDocument; const layer = snapshot.layers.find(item => item.id === id)
    if (!layer) { return }
    if (/\.(png|jpe?g)$/i.test(file.name)) {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
      layer.raster = { image: data, bounds: { ...layer.coverage! }, rendering: layer.role === "dem" ? "hillshade" : "imagery", radiometry: "" }
      layer.data.features = []
    } else { layer.data = JSON.parse(await file.text()); delete layer.raster }
    const validated = readDbtDocument(snapshot)
    if (!disposed && revision === version) { doc.value = validated; error.value = "" }
  } catch (err) { error.value = err instanceof Error ? err.message : "图层导入失败" } finally { element.value = "" }
}
function historyStep(redo: boolean) {
  const from = redo ? redoStack.value : undoStack.value; const to = redo ? undoStack.value : redoStack.value
  if (!from.length || busy.value) { return }
  // History restores editable drafts too; validation runs in the preview/export pipeline.
  to.push(JSON.stringify(doc.value)); const value = JSON.parse(from.pop()!); restoring = true; doc.value = value
}
function keydown(event: KeyboardEvent) {
  if (!props.active || event.defaultPrevented || !(event.ctrlKey || event.metaKey) || (event.target instanceof HTMLElement && event.target.closest('input,textarea,[contenteditable="true"],.map-composer'))) { return }
  if (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y") { event.preventDefault(); historyStep(event.shiftKey || event.key.toLowerCase() === "y") }
}
async function loadTest() {
  error.value = ""; const id = props.templateId; const revision = ++version; busy.value = true
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/dbt116-test/${id}.json`)
    if (!response.ok) { throw new Error("测试数据加载失败") }
    const next = readDbtDocument(await response.json())
    if (disposed || revision !== version || id !== props.templateId) { return }
    awaitingMap = false; layoutOnly.value = false; doc.value = next; proofOpen.value = window.innerWidth > 900
  } catch (err) { error.value = err instanceof Error ? err.message : "测试数据读取失败" } finally { if (revision === version) { busy.value = false } }
}
async function importDocument(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) { return }
  const revision = ++version
  try {
    if (file.size > 20 * 1024 * 1024) { throw new Error("标准数据包不能超过 20 MB") }
    const next = readDbtDocument(JSON.parse(await file.text()))
    if (disposed || revision !== version) { return }
    awaitingMap = false; layoutOnly.value = false; doc.value = next; proofOpen.value = window.innerWidth > 900; error.value = ""
  } catch (err) { error.value = err instanceof Error ? err.message : "导入失败" }
  ;(event.target as HTMLInputElement).value = ""
}
function downloadDocument(current: boolean) {
  const value = current && doc.value ? doc.value : emptyDbtDocument()
  downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), `${props.templateId}-${current ? "制图数据" : "空数据结构"}.json`)
}
async function report() {
  const data = JSON.stringify(doc.value)
  const record = JSON.parse(JSON.stringify({ standard: DBT_STANDARD, classification: DBT_CLASSIFICATION, template: props.templateId, code: mapCode.value, usage: doc.value?.usage || "unknown", checkedAt: new Date().toISOString(), scope: doc.value && standardBounds(doc.value, props.templateId), statistics: statistics.value, issues: allIssues.value, review: dbtReviewClauses.map((entry, i) => ({ ...entry, confirmed: !!reviewed.value[i] })), reviewer: reviewer.value, evidence: reviewEvidence.value, formalExportEnabled: canExport.value }))
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data))
  return { ...record, dataSha256: Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("") }
}
async function downloadReport() { const record = await report(); downloadBlob(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }), `${record.code}-条款检查.json`) }
async function exportMap(formal: boolean) {
  if (!doc.value || busy.value || (formal && !canExport.value)) { return }
  if (props.embedded && !formal) { emit("exportProof", format.value, dpi.value); return }
  const id = props.templateId; const revision = version; const density = dpi.value; const extension = format.value
  busy.value = true; error.value = ""
  try {
    const snapshot = readDbtDocument(JSON.parse(JSON.stringify(doc.value)))
    const canvas = window.document.createElement("canvas")
    const result = await renderDbtMap(canvas, snapshot, id, { dpi: density, draft: !formal, layoutOnly: !formal && useMapDraft.value, mapPreview: formal ? null : props.mapPreview })
    if (formal && result.issues.length) { renderIssues.value = result.issues.map(message => ({ clause: "9 / 10.1", severity: "error", message })); throw new Error(result.issues.join("；")) }
    const blob = await encodeDbtMap(canvas, extension, density, dbtTitle(snapshot, id), `${DBT_STANDARD}; ${DBT_CLASSIFICATION}; ${mapCode.value}; ${formal ? "人工复核成果" : "校样非正式成果"}`)
    if (disposed || revision !== version || !props.active) { return }
    downloadBlob(blob, `${dbtTitle(snapshot, id)}-${formal ? "审核出图" : "校样"}-${density}dpi.${extension}`)
    if (formal) { await downloadReport() }
    status.value = `已导出 ${canvas.width} × ${canvas.height} px · A3 · ${density} DPI${formal ? "" : " · 校样"}`
  } catch (err) { error.value = err instanceof Error ? err.message : "导出失败" } finally { busy.value = false }
}
watch([doc, () => props.templateId], () => {
  if (doc.value) {
    doc.value.classification ||= { instance: "00", spatial: "6" }; doc.value.assessment ||= {}
    for (const layer of doc.value.layers) { layer.coverage ||= layer.raster?.bounds ? { ...layer.raster.bounds } : { west: 0, south: 0, east: 1, north: 1 } }
  }
  const snapshot = JSON.stringify(doc.value)
  if (!restoring && previousSnapshot !== snapshot) {
    if (Date.now() - lastHistory > 600) { undoStack.value.push(previousSnapshot) }
    while (undoStack.value.length > 10 || undoStack.value.reduce((sum, item) => sum + item.length, 0) > 25_000_000) { undoStack.value.shift() }
    redoStack.value = []; lastHistory = Date.now()
  }
  restoring = false; previousSnapshot = snapshot
  version++; reviewed.value = []; renderReady.value = false; renderIssues.value = []; clearTimeout(timer); timer = setTimeout(render, 180)
}, { deep: true })
watch(() => props.templateId, () => { if (doc.value?.classification) { doc.value.classification.instance = "00" }; error.value = ""; proofOpen.value = false })
watch([() => props.mapPreview, layoutOnly], () => {
  if (awaitingMap && props.mapPreview) { awaitingMap = false; layoutOnly.value = true }
  version++; renderReady.value = false; clearTimeout(timer); timer = setTimeout(render, 180)
})
watch(() => props.active, async active => {
  version++; observer?.disconnect(); window.removeEventListener("resize", positionProof); window.removeEventListener("keydown", keydown)
  if (!active) { clearTimeout(timer); busy.value = false; return }
  if (!props.mapPreview && !props.mapBusy && !hasStandardExtent.value) { requestMap(false) }
  await nextTick(); positionProof(); observer = new ResizeObserver(positionProof)
  const panel = window.document.querySelector(".thematic-workbench-panel"); if (panel) { observer.observe(panel) }
  window.addEventListener("resize", positionProof); window.addEventListener("keydown", keydown); render()
}, { immediate: true })
onBeforeUnmount(() => { disposed = true; version++; clearTimeout(timer); observer?.disconnect(); window.removeEventListener("resize", positionProof); window.removeEventListener("keydown", keydown); if (preview.value) { URL.revokeObjectURL(preview.value) } })
</script>

<style scoped>
.dbt-editor { color: #e8f0f5; padding: 4px 0 20px; font-size: 14px; }
.dbt-map-source { border-top: 1px solid #3f5966; border-bottom: 1px solid #3f5966; padding-bottom: 8px; }.dbt-editor .dbt-inline-preview { width: 100%; aspect-ratio: 420/297; padding: 0; overflow: hidden; background: #fff; color: #26343b; }.dbt-inline-preview img { display: block; width: 100%; height: 100%; object-fit: contain; }.dbt-editor .dbt-missing { color: #efcc8b; font-size: 13px; }.dbt-editor .dbt-missing li { margin: 4px 0; }
.dbt-editor .dbt-check { display: flex; align-items: center; }.dbt-table { width: 100%; border-collapse: collapse; margin-top: 10px; }.dbt-table th, .dbt-table td { padding: 7px 4px; border-bottom: 1px solid #3f5966; text-align: left; font-weight: normal; }.dbt-layer { margin-top: 8px; }.dbt-layer summary { overflow-wrap: anywhere; }
.dbt-editor header { display: grid; gap: 8px; margin-bottom: 16px; }.dbt-editor header strong { font-size: 17px; line-height: 1.5; }.dbt-editor header span, small { color: #a9c0cc; }
.dbt-editor button, .dbt-proof button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; border: 1px solid #4c6d7b; background: #263f4b; color: #eaf5fa; padding: 7px 10px; cursor: pointer; white-space: nowrap; border-radius: 3px; }
.dbt-editor button:disabled { opacity: .5; cursor: not-allowed; }.dbt-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.dbt-editor label { display: grid; gap: 6px; margin: 10px 0; }.dbt-editor input:not([type=checkbox]), .dbt-editor select, .dbt-editor textarea { min-width: 0; width: 100%; box-sizing: border-box; background: #20323e; color: #edf5f8; border: 1px solid #527386; padding: 8px; border-radius: 3px; font: inherit; color-scheme: dark; }.dbt-editor textarea { resize: vertical; }
.dbt-editor details { border-top: 1px solid #3f5966; padding: 12px 0; }.dbt-editor summary { cursor: pointer; font-weight: 600; }.dbt-editor a { display: block; color: #85d7eb; margin: 10px 0; }.dbt-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }.dbt-spec { display: grid; grid-template-columns: 48px minmax(0,1fr); gap: 8px; line-height: 1.6; }.dbt-spec dd { margin: 0; color: #b9d2dd; overflow-wrap: anywhere; }.dbt-spec dt { color: #ecf4f7; }
.dbt-editor ul { padding-left: 20px; }.dbt-editor li { margin: 9px 0; line-height: 1.6; }.dbt-editor li small { display: block; }.dbt-quality .is-error, .dbt-error { color: #ffb8af; }.dbt-quality .is-warning, .dbt-test { color: #f3d48d; }.dbt-review label:has(input[type=checkbox]) { display: flex; align-items: flex-start; line-height: 1.6; }.dbt-review input[type=checkbox] { flex: none; margin-top: 5px; }.dbt-status { color: #85d7cb; line-height: 1.6; }
.dbt-proof { position: fixed; z-index: 1100; display: flex; flex-direction: column; background: #26353c; border: 1px solid #708891; border-radius: 6px; color: #e4f0f5; overflow: hidden; box-sizing: border-box; }
.dbt-proof header { display: flex; align-items: center; gap: 14px; padding: 14px; border-bottom: 1px solid #48616c; min-width: 0; }.dbt-proof header strong { font-size: 18px; }.dbt-proof header span { font-size: 12px; margin-left: auto; }.dbt-proof header button { width: 36px; flex: none; }.dbt-proof-tools { display: flex; align-items: center; gap: 10px; padding: 9px 14px; }.dbt-proof-tools span:first-child { margin-right: auto; font-size: 13px; }.dbt-proof-tools button { width: 34px; padding: 4px; }.dbt-proof-scroll { flex: 1; min-height: 0; overflow: auto; padding: 18px; display: flex; align-items: flex-start; }.dbt-proof-scroll img { display: block; flex: none; height: auto; object-fit: contain; margin: auto; }.dbt-proof footer { font-size: 12px; min-height: 20px; padding: 8px 14px; overflow-wrap: anywhere; border-top: 1px solid #48616c; }
@media(max-width: 700px) { .dbt-proof header > span { display: none; }.dbt-proof header button { margin-left: auto; }.dbt-proof-scroll { padding: 8px; } }
</style>
