<template>
  <section class="dbt-editor" aria-label="地震应急响应标准制图编辑">
    <header><strong>{{ template.name }}</strong><span>{{ mapCode }} · {{ DBT_CLASSIFICATION }}</span></header>
    <section class="dbt-readiness" aria-label="制图就绪状态"><dl>
      <dt>图幅数据</dt><dd>{{ dataSummary }}</dd>
      <dt>坐标基准</dt><dd :class="{ 'needs-check': doc?.crs !== 'EPSG:4490' }">{{ coordinateSummary }}</dd>
      <dt>图幅范围</dt><dd>{{ hasStandardExtent ? '评估烈度范围 · 外扩 10 km' : doc?.usage === 'reference' ? '参考分析范围 · 非正式成果' : hasDrawingExtent ? '原始数据覆盖范围 · 规范范围待补齐' : '待导入快速评估烈度面' }}</dd>
      <dt>出图状态</dt><dd :class="{ 'needs-check': !internalRelease && !canExport }">{{ internalRelease ? '在线地图 · 待人工审核' : canExport ? '检查与人工复核已完成' : `待审核 · ${blockingGroups} 类数据或版式问题` }}</dd>
    </dl></section>
    <div class="dbt-actions">
      <button type="button" :disabled="busy || mapBusy" @click="newDocument"><mars-icon icon="plus" :width="16" />新建图件</button>
      <button v-if="allowFixtures" type="button" :disabled="busy || mapBusy" @click="readMapLayers"><mars-icon icon="layers" :width="16" />读取地图业务图层</button>
      <button v-if="allowFixtures" type="button" :disabled="busy || mapBusy" @click="input?.click()"><mars-icon icon="upload" :width="16" />导入制图数据</button>
      <button type="button" title="下载空数据结构" aria-label="下载标准数据结构" @click="downloadDocument(false)"><mars-icon icon="download" :width="16" /></button>
      <input v-if="allowFixtures" ref="input" hidden type="file" accept=".json,.geojson" aria-label="标准制图数据文件" @change="importDocument" />
    </div>
    <details v-if="allowFixtures"><summary>测试校样</summary><button type="button" :disabled="busy || mapBusy" @click="loadTest"><mars-icon icon="play" :width="16" />加载测试数据</button></details>
    <details v-if="allowFixtures && ['T30102000', 'T30203000'].includes(templateId)"><summary>项目数据目录</summary><LocalCartographySources :template-id="templateId" :disabled="busy || mapBusy" :map-bounds="mapPreview?.bounds" @loading="localLoading" @document="importLocalReference" /></details>
    <details v-if="allowFixtures && templateId === 'T30102000'"><summary>本地人口与 GDP 原始数据</summary><ProjectRasterSources /></details>
    <section v-if="allowFixtures && templateId === 'T30102000'" aria-label="数值人口栅格导入">
      <label>人口像元指标<select v-model="populationMetric" aria-label="人口像元指标"><option value="" disabled>根据数据说明确认指标单位</option><option value="people-per-cell">人 / 原始像元</option><option value="people-per-km2">人 / km²</option></select></label>
      <button type="button" :disabled="busy || mapBusy" @click="populationInput?.click()"><mars-icon icon="upload" :width="16" />导入人口 GeoTIFF</button>
      <input ref="populationInput" hidden type="file" accept=".tif,.tiff" aria-label="人口GeoTIFF文件" @change="importPopulation" />
    </section>
    <p v-if="error" role="alert" class="dbt-error">{{ error }}</p>
    <p v-if="doc?.usage === 'test'" class="dbt-test" role="status">合成测试数据 · 非真实震情 · 禁止业务使用</p>
    <p v-if="doc?.usage === 'reference'" class="dbt-test" role="status">{{ doc.reference?.notice }}</p>
    <section class="dbt-map-source" aria-label="地图与草稿预览">
      <div v-if="!embedded || allowFixtures" class="dbt-actions">
        <button type="button" :disabled="mapBusy || busy" @click="requestMap(false)"><mars-icon icon="refresh" :width="16" />取当前视图</button>
        <button type="button" :disabled="mapBusy || busy" @click="requestMap(true)"><mars-icon icon="rectangle" :width="16" />框选底图</button>
        <button v-if="hasDrawingExtent && useMapDraft" type="button" :disabled="busy" @click="layoutOnly = false"><mars-icon icon="map" :width="16" />返回数据图件</button>
      </div>
      <p v-if="mapError" role="alert" class="dbt-error">{{ mapError }}</p>
      <p class="dbt-status" role="status">{{ mapBusy ? '正在采集地图画面…' : useMapDraft ? '底图草稿 · 未生成专题成果' : '数据图件 · 待质量审核' }}</p>
      <button class="dbt-inline-preview" type="button" :disabled="busy || !renderReady" aria-label="展开标准图件预览" @click="openProof"><img v-if="renderReady && (composedPreview || preview)" :src="composedPreview || preview" alt="标准模板当前草稿预览" /><span v-else>{{ error ? '图件未生成 · 请检查当前数据' : '版式生成中' }}</span></button>
      <ul v-if="useMapDraft" class="dbt-missing"><li>正式震情：{{ doc?.event.time && doc.event.place && doc.event.magnitude ? '已填写，待核验' : '待补齐' }}</li><li>规范范围：{{ hasStandardExtent ? '已计算，待复核' : '待快速评估烈度面' }}</li><li>专题数据：{{ requiredData.filter(item => !item.present).map(item => item.label).join('、') || '已载入，待核验' }}</li></ul>
    </section>
    <div class="dbt-actions"><button type="button" :disabled="busy" @click="openProof"><mars-icon icon="layout-two" :width="16" />{{ !embedded && proofOpen ? '收起图件' : '制图排版' }}</button><button type="button" :disabled="!doc" @click="downloadDocument(true)"><mars-icon icon="save" :width="16" />保存制图数据</button><button type="button" :disabled="!undoStack.length || busy" aria-label="撤销标准制图操作" title="撤销" @click="historyStep(false)"><mars-icon icon="undo" :width="16" /></button><button type="button" :disabled="!redoStack.length || busy" aria-label="重做标准制图操作" title="重做" @click="historyStep(true)"><mars-icon icon="redo" :width="16" /></button></div>
    <dl class="dbt-spec"><dt>幅面</dt><dd>A3 横向 · 420 × 297 mm</dd><dt>坐标</dt><dd>{{ useMapDraft ? '底图屏幕影像 · 未地理配准' : `${doc?.crs || '待导入'} · 地理坐标（度）` }}</dd><dt>范围</dt><dd>{{ extentLabel }}</dd><dt>版式</dt><dd>标题 / 图件 / 说明 / 注释</dd></dl>
    <template v-if="doc">
      <details ref="informationForm" :open="allowFixtures"><summary>震情与出图信息</summary>
        <fieldset :disabled="!allowFixtures">
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
        </fieldset>
        <label>制作单位<input v-model="doc.agency" aria-label="标准制作单位" /></label><label>制图时间<input v-model="doc.createdAt" aria-label="标准制图时间" /></label>
        <label>内容说明<textarea v-model="doc.description" rows="5" maxlength="900" aria-label="标准内容说明"></textarea></label>
      </details>
      <details v-if="templateId === 'T30201000' && doc.assessment" open><summary>快速评估参数</summary><fieldset :disabled="!allowFixtures"><div class="dbt-pair"><label>长轴长度 km<input v-model.number="doc.assessment.longAxisKm" type="number" min="0" /></label><label>短轴长度 km<input v-model.number="doc.assessment.shortAxisKm" type="number" min="0" /></label></div><label>长轴走向 °<input v-model.number="doc.assessment.azimuth" type="number" min="0" max="359.99" /></label></fieldset></details>
      <details><summary>数据图层 · 当前类别显示 {{ visibleLayers.length }} 层</summary>
        <div v-if="allowFixtures" class="dbt-pair"><label>新增图层类型<select v-model="newRole"><option v-for="(name, role) in dbtRoleNames" :key="role" :value="role">{{ name }}</option></select></label><button type="button" @click="addLayer"><mars-icon icon="plus" :width="16" />添加图层</button></div>
        <details v-for="layer in doc.layers" :key="layer.id" class="dbt-layer"><summary>{{ layer.name }} · {{ layer.sourceGrid ? `${layer.sourceGrid.width} × ${layer.sourceGrid.height} 参考采样格` : layer.data.features.length + ' 要素' }}{{ layer.grid ? ` · ${layer.grid.width} × ${layer.grid.height} 原始像元` : '' }}{{ layer.raster ? ' · 栅格' : '' }}</summary>
          <fieldset :disabled="!!layer.onlineSource || !allowFixtures">
          <p v-if="layer.grid">{{ layer.grid.metric === 'people-per-cell' ? '原值：人/格' : '原值：人/km²' }} · {{ layer.grid.crs }} · 零值与缺测分别处理</p>
          <label class="dbt-check"><input type="checkbox" :checked="layer.enabled !== false" @change="layer.enabled = ($event.target as HTMLInputElement).checked" />参与制图</label>
          <label>图层名称<input v-model="layer.name" /></label>
          <div v-if="allowFixtures" class="dbt-actions"><button v-if="!layer.grid && !layer.sourceGrid && !layer.sourceReference" type="button" @click="chooseLayer(layer.id)"><mars-icon icon="upload" :width="16" />替换要素或栅格</button><button type="button" aria-label="删除数据图层" title="删除图层" @click="doc.layers = doc.layers.filter(item => item.id !== layer.id)"><mars-icon icon="delete" :width="16" /></button></div>
          <label>权威来源机构<input v-model="layer.authority" /></label><label>来源编号或链接<input v-model="layer.source" /></label>
          <div class="dbt-pair"><label>数据日期<input v-model="layer.publishedAt" /></label><label>比例尺分母<input v-model.number="layer.scale" type="number" min="1" /></label></div>
          <label>密级声明<select v-model="layer.security"><option value="">待核验</option><option value="public">非涉密公开数据</option><option value="declassified">已脱密数据</option></select></label>
          <label>坐标转换或原始坐标依据<input v-model="layer.crsEvidence" /></label>
          <template v-if="layer.coverage"><span>数据覆盖范围（度）</span><div class="dbt-pair"><label v-for="(label, key) in boundLabels" :key="key">{{ label }}<input v-model.number="layer.coverage[key]" type="number" step="0.001" /></label></div></template>
          <label>范围内完整性依据<textarea v-model="layer.coverageEvidence" rows="2"></textarea></label>
          <p v-if="requirements[layer.role]" class="dbt-status">本图所需：{{ requirements[layer.role] }}</p>
          <template v-if="layer.raster"><label>栅格表达<select v-model="layer.raster.rendering"><option value="hillshade">分级地形晕渲</option><option value="imagery">遥感影像</option><option value="classified">分类栅格</option></select></label><label>匀光 / 晕渲依据<input v-model="layer.raster.radiometry" /></label><span>栅格地理定位（度）</span><div class="dbt-pair"><label v-for="(label, key) in boundLabels" :key="key">{{ label }}<input v-model.number="layer.raster.bounds[key]" type="number" step="0.001" /></label></div></template>
          <label v-if="layer.role === 'economy'">指标单位<input v-model="layer.unit" /></label>
          <template v-if="['population', 'economy'].includes(layer.role) && !layer.raster && !layer.grid && !layer.sourceGrid">
            <label>数值字段<select :value="layer.thematic?.field || (layer.role === 'population' ? 'population' : 'value')" aria-label="专题数值字段" @change="layer.thematic = { ...layer.thematic, field: ($event.target as HTMLSelectElement).value }"><option v-for="field in numericLayerFields(layer)" :key="field" :value="field">{{ field }}</option></select></label>
            <label>原始指标口径<select :value="layer.thematic?.inputMetric || ''" aria-label="原始指标口径" @change="layer.thematic = { ...layer.thematic, inputMetric: ($event.target as HTMLSelectElement).value as 'density' | 'total' }"><option value="" disabled>待来源元数据或人工确认</option><option value="total">统计单元总量</option><option value="density">已为单位面积密度</option></select></label>
            <label>专题表达<select :value="layer.thematic?.mode || (layer.data.features.every(f => ['Polygon', 'MultiPolygon'].includes(f.geometry.type)) ? 'density' : 'total')" @change="layer.thematic = { ...layer.thematic, mode: ($event.target as HTMLSelectElement).value as 'density' | 'total' }"><option value="density">单位面积密度</option><option value="total">统计单元总量</option></select></label>
            <label>分级方法<select :value="layer.thematic?.method || 'natural'" @change="layer.thematic = { ...layer.thematic, method: ($event.target as HTMLSelectElement).value as 'natural' | 'equal' | 'quantile' }"><option value="natural">自然断点</option><option value="equal">等距</option><option value="quantile">分位数</option></select></label>
            <label>分级数量<input type="number" min="2" max="9" :value="layer.thematic?.count || 5" @change="layer.thematic = { ...layer.thematic, count: Number(($event.target as HTMLInputElement).value) }" /></label>
          </template>
          <label v-if="layer.role === 'pga'">GB 18306 / GB 55002 参数对应依据<textarea v-model="layer.parameterEvidence" rows="2"></textarea></label>
          <label v-if="layer.legend?.length">配色依据<input v-model="layer.colorStandard" /></label>
          </fieldset>
        </details>
        <input v-if="allowFixtures" ref="layerInput" hidden type="file" accept=".json,.geojson,.png,.jpg,.jpeg" aria-label="图层数据文件" @change="importLayer" />
      </details>
      <details open v-if="statistics.length"><summary>专题统计</summary><table class="dbt-table"><thead><tr><th>指标</th><th>数值</th><th>单位</th></tr></thead><tbody><tr v-for="(row, i) in statistics" :key="i"><td>{{ row.label }}</td><td>{{ row.value === null ? '待核实' : Number(row.value.toFixed(2)).toLocaleString() }}</td><td>{{ row.unit }}</td></tr></tbody></table><p v-for="note in statisticNotes" :key="note" class="dbt-status">{{ note }}</p></details>
    </template>
    <section v-if="internalRelease" class="dbt-online-review" aria-label="当前地图审核入口"><button type="button" @click="emit('reviewMap')"><mars-icon icon="inspection" :width="16" />人工审核与发布</button><span>单位内部 · 当前地图版本</span></section>
    <details class="dbt-quality"><summary>{{ internalRelease ? '规范应急图件专项检查' : `正式出图检查 · ${blockingGroups} 类待处理` }}</summary>
      <div v-if="internalRelease" class="dbt-actions"><button type="button" @click="emit('reviewMap')"><mars-icon icon="inspection" :width="16" />转到当前地图人工审核</button></div>
      <CartographyReleaseChecks :issues="allIssues" />
      <div v-if="!internalRelease" class="dbt-review"><label v-for="(entry, i) in dbtReviewClauses" :key="entry.clause"><input v-model="reviewed[i]" type="checkbox" :disabled="!doc || busy || mapBusy" />{{ entry.clause }} · {{ entry.label }}</label><label>复核人<input v-model="reviewer" aria-label="标准复核人" /></label><label>复核依据<textarea v-model="reviewEvidence" rows="2" aria-label="标准复核依据"></textarea></label></div>
    </details>
    <div class="dbt-pair"><label>输出格式<select v-model="format" aria-label="标准输出格式"><option value="pdf">PDF</option><option value="jpg">JPG</option></select></label><label>分辨率<select v-model.number="dpi" aria-label="标准输出DPI"><option :value="300">300 DPI</option><option :value="450">450 DPI</option><option :value="600">600 DPI</option></select></label></div>
    <div class="dbt-actions"><button type="button" :disabled="!doc || busy || !renderReady" @click="exportMap(false)"><mars-icon icon="download" :width="16" />导出校样</button><button type="button" :disabled="!canExport || busy" @click="exportMap(true)"><mars-icon icon="download" :width="16" />正式出图</button><button type="button" title="下载检查记录" aria-label="下载标准检查记录" @click="downloadReport"><mars-icon icon="inspection" :width="16" /></button></div>
    <p class="dbt-status" role="status">{{ status }}</p>
    <details><summary>标准与数据来源</summary><p>{{ DBT_STANDARD }}</p><p>{{ DBT_CLASSIFICATION }}</p><a v-for="source in sources" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.name }}</a></details>
    <Teleport to="body">
      <section v-if="!embedded && active && proofOpen" class="dbt-proof" :style="proofStyle" role="dialog" aria-label="标准制图排版工作台">
        <header><strong>标准制图排版</strong><span>A3 · DB/T 116-2026 提前采用</span><button type="button" aria-label="关闭标准图件预览" title="关闭预览" @click="proofOpen = false"><mars-icon icon="close" :width="18" /></button></header>
        <div class="dbt-proof-tools"><span>{{ useMapDraft ? '底图草稿' : doc?.usage === 'test' ? '合成测试校样' : '待审核校样' }}</span><button type="button" aria-label="缩小标准图件" @click="zoom = Math.max(0.5, zoom - 0.25)"><mars-icon icon="minus" :width="16" /></button><span>{{ Math.round(zoom * 100) }}%</span><button type="button" aria-label="放大标准图件" @click="zoom = Math.min(3, zoom + 0.25)"><mars-icon icon="plus" :width="16" /></button><button type="button" title="适合窗口" aria-label="适合标准图件窗口" @click="zoom = 1"><mars-icon icon="full-screen" :width="16" /></button></div>
        <div class="dbt-proof-scroll"><img v-if="preview" :src="preview" :style="{ width: `${previewWidth * zoom}px` }" alt="按照制作要求四区版式绘制的实际校样" /><span v-else>{{ busy ? '正在渲染' : '图件准备中' }}</span></div>
        <footer>{{ status || template.name }}</footer>
      </section>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import type { FeatureCollection } from "geojson"
import { DBT_STANDARD, DBT_CLASSIFICATION, dbtTemplates, dbtTitle, dbtReviewClauses, dbtVisibleLayers, dbtScopedLayers, emptyDbtDocument, inspectDbtDocument, readDbtDocument, mergeDbtSourceLayer, standardBounds, type DbtDocument, type DbtTemplateId, type DbtIssue, type DbtLayer } from "./dbt116-standard"
import { baseRequirements, dbtInstances, dbtMapCode, dbtRegion, dbtRoleNames, dbtSpatialCodes, dbtStatistics } from "./dbt-cartography-rules"
import { renderDbtMap } from "./dbt116-renderer"
import { encodeDbtMap } from "./dbt116-export"
import { downloadBlob, canvasBlob } from "./export-media"
import { composerDock } from "./composer-dock"
import { draftRequirements, type DbtMapPreview } from "./dbt-draft-preview"
import { standardComposition, type StandardComposition } from "./standard-composition"
import { standardPublicationBlockers, type StandardPublicationState, type StandardPublicationBundle } from "./standard-publication"
import { getBusinessDataSources } from "./map"
import { businessStandardLayer } from "./business-standard-layer"
import ProjectRasterSources from "./ProjectRasterSources.vue"
import LocalCartographySources from "./LocalCartographySources.vue"
import { readPopulationGeoTiff } from "./population-geotiff"
import type { PopulationGrid } from "./population-grid"
import { dbtDrawingBounds } from "./dbt116-standard"
import { standardPreviewPath } from "./standard-preview-source"
import { revalidateBackendDocument } from "./backend-standard-document"
import { CARTOGRAPHY_RULESET } from "./cartography-standards"
import { onlineLayerDescription, onlineMapDescription, onlineProofTitle } from "./online-layer-description"
import { layerEventParameters } from "./backend-event-parameters"
import CartographyReleaseChecks from "./CartographyReleaseChecks.vue"
import { groupCartographyIssues, uniqueCartographyIssues } from "./cartography-release-checks"

const props = defineProps<{ templateId: DbtTemplateId; active: boolean; queryBounds?: { west: number; south: number; east: number; north: number } | null; mapPreview?: DbtMapPreview | null; mapBusy?: boolean; mapError?: string; embedded?: boolean; releaseMode?: "internal" | "standard"; compositionIssues?: string[]; composedPreview?: string; allowFixtures?: boolean }>()
const emit = defineEmits<{ captureMap: []; selectRange: []; rendered: [scene: StandardComposition]; renderFailed: []; openComposition: []; resetSources: []; reviewMap: []; exportProof: [format: "jpg" | "pdf", dpi: number] }>()
const internalRelease = computed(() => props.embedded && props.releaseMode !== "standard")
const doc = ref<DbtDocument | null>(emptyDbtDocument())
const input = ref<HTMLInputElement>(); const error = ref(""); const status = ref("")
const informationForm = ref<HTMLDetailsElement>()
const rendering = ref(false); const importing = ref(false)
const busy = computed({ get: () => rendering.value || importing.value, set: (value: boolean) => { rendering.value = value } })
const populationInput = ref<HTMLInputElement>(); const populationMetric = ref<PopulationGrid["metric"] | "">("")
const preview = ref(""); const proofOpen = ref(false); const zoom = ref(1)
const layoutOnly = ref(false); let awaitingMap = false
const previewWidth = ref(480)
const dpi = ref(300); const format = ref<"jpg" | "pdf">("pdf")
const reviewed = ref<boolean[]>([]); const reviewer = ref(""); const reviewEvidence = ref("")
const renderIssues = ref<DbtIssue[]>([])
const annotationAudit = shallowRef<{ placed: number; unplaced: Array<{ id: string; text: string; reason: string }>; generalized: Array<{ id: string; text: string; reason: string }> } | null>(null)
const renderReady = ref(false)
const publicationRevision = ref(0)
const newRole = ref("boundary"); const layerInput = ref<HTMLInputElement>(); let targetLayer = ""
const boundLabels = { west: "西", south: "南", east: "东", north: "北" }
const undoStack = ref<string[]>([]); const redoStack = ref<string[]>([])
let previousSnapshot = JSON.stringify(doc.value); let restoring = false; let lastHistory = 0
const proofStyle = ref<Record<string, string>>({})
const template = computed(() => dbtTemplates.find(item => item.id === props.templateId)!)
const hasStandardExtent = computed(() => { try { return !!doc.value && !!standardBounds(doc.value, props.templateId) } catch { return false } })
const hasDrawingExtent = computed(() => { try { return !!doc.value && !!dbtDrawingBounds(doc.value, props.templateId) } catch { return false } })
const useMapDraft = computed(() => layoutOnly.value || !hasDrawingExtent.value)
const requiredData = computed(() => draftRequirements(doc.value, props.templateId))
const visibleLayers = computed(() => doc.value ? dbtVisibleLayers(doc.value, props.templateId) : [])
const dataSummary = computed(() => {
  const vectors = visibleLayers.value.reduce((sum, layer) => sum + layer.data.features.length, 0)
  const cells = visibleLayers.value.reduce((sum, layer) => sum + (layer.grid ? layer.grid.width * layer.grid.height : 0), 0)
  const samples = visibleLayers.value.reduce((sum, layer) => sum + (layer.sourceGrid ? layer.sourceGrid.width * layer.sourceGrid.height : 0), 0)
  if (!visibleLayers.value.length) { return "待导入业务数据" }
  return `${visibleLayers.value.length} 层 · ${vectors.toLocaleString()} 个要素${cells ? ` · ${cells.toLocaleString()} 个原始像元` : ""}${samples ? ` · ${samples.toLocaleString()} 个参考采样格` : ""}`
})
const coordinateSummary = computed(() => {
  if (!doc.value?.layers.length) { return "未绑定源数据" }
  const crs = [...new Set([doc.value.crs, ...visibleLayers.value.map(layer => layer.crs)])]
  if (crs.length > 1) { return "图层坐标不一致 · 禁止直接叠加" }
    if (crs[0] !== "EPSG:4490") { return `${crs[0]} · 非 CGCS2000 正式图件` }
    return doc.value.crsEvidence && visibleLayers.value.every(layer => layer.crsEvidence) ? "CGCS2000 · 已附坐标依据，待复核" : "CGCS2000 · 来源依据及转换成果待补齐"
})
const scopedLayers = computed(() => doc.value ? dbtScopedLayers(doc.value, props.templateId) : [])
const statistics = computed(() => doc.value ? dbtStatistics(doc.value, props.templateId, scopedLayers.value, dbtDrawingBounds(doc.value, props.templateId) || undefined) : [])
const statisticNotes = computed(() => [...new Set(statistics.value.map(row => row.note).filter(Boolean))])
const requirements = computed<Record<string, string>>(() => doc.value ? baseRequirements(doc.value, props.templateId, visibleLayers.value) : {})
const derivedRegion = computed(() => doc.value && dbtRegion(doc.value.region.province, doc.value.region.prefecture, doc.value.region.offshore))
const mapCode = computed(() => { try { return dbtMapCode(props.templateId, doc.value?.classification?.instance, doc.value?.classification?.spatial) } catch { return "分类编码待核验" } })
const allIssues = computed(() => uniqueCartographyIssues([...inspectDbtDocument(doc.value, props.templateId), ...(!props.allowFixtures && doc.value?.usage === "operational" && !doc.value.backendDocument ? [{ clause: "后台审核绑定", severity: "error" as const, message: "生产图件必须绑定后台审核数据包" }] : []), ...renderIssues.value, ...(props.compositionIssues || []).map(message => ({ clause: "9 / 10.1", message, severity: "error" as const }))]))
const blockingGroups = computed(() => groupCartographyIssues(allIssues.value).filter(group => group.blocking).length)
const publicationBlockers = computed(() => standardPublicationBlockers({
  hasDocument: !!doc.value,
usage: doc.value?.usage,
mapDraft: useMapDraft.value,
renderReady: renderReady.value,
  issues: allIssues.value,
reviewCount: dbtReviewClauses.filter((_, i) => reviewed.value[i]).length,
  reviewTotal: dbtReviewClauses.length,
reviewer: reviewer.value,
evidence: reviewEvidence.value
}))
const canExport = computed(() => !publicationBlockers.value.length)
const publication = computed<StandardPublicationState>(() => ({
  templateId: props.templateId,
  revision: publicationRevision.value,
name: template.value.name,
title: doc.value ? dbtTitle(doc.value, props.templateId) : template.value.name,
  code: mapCode.value,
preview: renderReady.value ? props.composedPreview || preview.value : "",
hasDocument: !!doc.value,
usage: doc.value?.usage || "unknown",
  busy: busy.value,
ready: canExport.value,
format: format.value,
dpi: dpi.value,
  blockers: publicationBlockers.value,
issues: allIssues.value,
reviewCount: dbtReviewClauses.filter((_, i) => reviewed.value[i]).length,
  reviewTotal: dbtReviewClauses.length,
status: status.value,
error: error.value
}))
const extentLabel = computed(() => {
  if (useMapDraft.value) {
    const bounds = props.mapPreview?.bounds
    return bounds ? `草稿框选：西${bounds.west.toFixed(3)} / 南${bounds.south.toFixed(3)} / 东${bounds.east.toFixed(3)} / 北${bounds.north.toFixed(3)} · 非规范出图范围` : "当前视图草稿 · 规范范围待评估"
  }
  const extent = doc.value && standardBounds(doc.value, props.templateId)
  const dataExtent = doc.value && dbtDrawingBounds(doc.value, props.templateId)
  if (extent) { return `${extent.west.toFixed(3)}°—${extent.east.toFixed(3)}° E / ${extent.south.toFixed(3)}°—${extent.north.toFixed(3)}° N · 烈度区外扩 10 km` }
  return dataExtent ? `${dataExtent.west.toFixed(3)}°—${dataExtent.east.toFixed(3)}° E / ${dataExtent.south.toFixed(3)}°—${dataExtent.north.toFixed(3)}° N · 数据覆盖预览，非规范范围` : "待导入快速评估烈度面"
})
const sources = [
  { name: "国家地震科学数据中心：数据服务流程", url: "https://data.earthquake.cn/fwlc/info/2024/334672344.html" },
  { name: "官方断层样例：2025-06-05 洱源地震（CRS84）", url: "https://data.earthquake.cn/gxdt/info/2025/334673554.html" },
  { name: "基础地理信息数据目录", url: "https://www.webmap.cn/commres.do?method=result100W" }
]
let disposed = false; let version = 0; let sourceRevision = 0; let inputRevision = 0; let lastRenderError = ""
let renderEpoch = 0; let pendingEpoch = -1; let pendingRender: Promise<void> | undefined
let timer: ReturnType<typeof setTimeout> | undefined; let observer: ResizeObserver | undefined
function beginInput() { version++; renderEpoch++; rendering.value = false; importing.value = true; return { ticket: ++inputRevision, source: sourceRevision, template: props.templateId } }
function inputCurrent(token: ReturnType<typeof beginInput>) { return !disposed && props.active && token.ticket === inputRevision && token.source === sourceRevision && token.template === props.templateId }
function finishInput(token: ReturnType<typeof beginInput>) { if (token.ticket === inputRevision) { importing.value = false } }
function positionProof() {
  const panel = window.document.querySelector(".thematic-workbench-panel")?.getBoundingClientRect()
  if (!panel) { return }
  const rect = composerDock({ x: panel.left, y: panel.top, w: panel.width, h: panel.height }, { width: window.innerWidth, height: window.innerHeight })
  if (window.innerWidth <= 900) { Object.assign(rect, { x: 12, y: 86, w: window.innerWidth - 24, h: window.innerHeight - 108 }) }
  proofStyle.value = { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` }
  previewWidth.value = Math.max(80, Math.min(rect.w - 38, (rect.h - 180) * 420 / 297))
}
async function render() {
  if (pendingRender && pendingEpoch === renderEpoch) { return pendingRender }
  pendingEpoch = renderEpoch
  const task = renderSnapshot(); pendingRender = task
  try { await task } finally { if (pendingRender === task) { pendingRender = undefined } }
}
async function renderSnapshot() {
  if (!props.active || disposed) { return }
  const current = ++version; const id = props.templateId; const snapshot = doc.value ? JSON.parse(JSON.stringify(doc.value)) : null
  busy.value = true
  status.value = "正在检查图层与来源"
  try {
    const canvas = window.document.createElement("canvas")
    const result = await renderDbtMap(canvas, snapshot ? readDbtDocument(snapshot) : null, props.templateId, { layoutOnly: useMapDraft.value, mapPreview: props.mapPreview, onProgress: stage => { if (current === version) { status.value = stage } } })
    if (current === version) { status.value = "正在编码校样图像" }
    const blob = await canvasBlob(canvas)
    if (disposed || current !== version || !props.active) { return }
    annotationAudit.value = result.annotations ? { placed: result.annotations.placed.length, unplaced: result.annotations.skipped.filter(entry => !["outside", "generalized", "duplicate"].includes(entry.reason)), generalized: result.annotations.skipped.filter(entry => ["generalized", "duplicate"].includes(entry.reason)) } : null
    if (preview.value) { URL.revokeObjectURL(preview.value) }; preview.value = URL.createObjectURL(blob)
    renderIssues.value = result.issues.map(message => ({ clause: "9 / 10.1", message, severity: "error" }))
    renderReady.value = true; if (error.value === lastRenderError) { error.value = "" }; lastRenderError = ""
    status.value = "请绑定后端业务数据或导入有来源依据的制图数据"
    if (snapshot) {
      status.value = props.mapPreview ? "底图已接入四区版式 · 专题数据与规范范围待补齐" : "四区版式已生成 · 底图待采集"
      if (result.bounds) { status.value = `${visibleLayers.value.length} 个图层已渲染 · 质量审核未完成` }
    }
    if (props.embedded) {
      const scene = standardComposition(canvas, snapshot, id, result.legendY, !result.bounds)
      scene.renderAtDpi = async density => {
        if (disposed || current !== version || !props.active || props.templateId !== id) { throw new Error("制图数据已变化，请等待最新校样后再导出") }
        const high = window.document.createElement("canvas")
        const rendered = await renderDbtMap(high, snapshot ? readDbtDocument(snapshot) : null, id, { dpi: density, draft: true, layoutOnly: !result.bounds, mapPreview: props.mapPreview })
        const resolution = rendered.issues.find(message => message.includes("DPI"))
        if (resolution) { throw new Error(`${resolution}；请提高校样源图精度并重新叠加`) }
        if (disposed || current !== version || !props.active) { throw new Error("导出期间数据已变化，请重新生成") }
        return standardComposition(high, snapshot, id, rendered.legendY, !rendered.bounds)
      }
      emit("rendered", scene)
    }
  } catch (err) { if (current === version) { error.value = err instanceof Error ? err.message : "渲染失败"; lastRenderError = error.value; renderReady.value = false; renderIssues.value = [{ clause: "10.1", message: error.value, severity: "error" }]; if (preview.value) { URL.revokeObjectURL(preview.value); preview.value = "" }; emit("renderFailed") } } finally { if (current === version) { busy.value = false } }
}
async function openProof() {
  if (!await preparePreview()) { return }
  if (props.embedded) { emit("openComposition") } else { proofOpen.value = !proofOpen.value }
}
async function preparePreview() {
  await nextTick(); clearTimeout(timer)
  if (renderReady.value && !busy.value) { return true }
  await render()
  if (!renderReady.value && informationForm.value) {
    informationForm.value.open = true
    await nextTick()
    informationForm.value.scrollIntoView({ block: "start" })
    informationForm.value.querySelector<HTMLTextAreaElement>('textarea[aria-label="标准内容说明"]')?.focus({ preventScroll: true })
  }
  return renderReady.value && !busy.value
}
function updateCopy(kind: string, text: string) {
  if (!doc.value) { return }
  if (kind === "description") { doc.value.description = text }
  if (kind === "agency") { doc.value.agency = text }
  if (kind === "time") { doc.value.createdAt = text }
}
function importTemplateLayer(data: FeatureCollection & { metadata?: Record<string, unknown> }, role: string, name: string) {
  if (!doc.value || !dbtRoleNames[role]) { return }
  try {
    const snapshot: DbtDocument = JSON.parse(JSON.stringify(doc.value))
    const id = `template:${role}`
    doc.value = mergeDbtSourceLayer(snapshot, businessStandardLayer({ id, name, document: data as any }, role)); error.value = ""
  } catch (err) { error.value = err instanceof Error ? err.message : "模板数据接入失败" }
}
function readMapLayers() {
  const snapshot: DbtDocument = JSON.parse(JSON.stringify(doc.value || emptyDbtDocument()))
  const skipped: string[] = []; let count = 0
  for (const source of getBusinessDataSources()) {
    try {
      const layer = businessStandardLayer({ ...source, id: `map:${source.id}` })
      const next = mergeDbtSourceLayer(snapshot, layer)
      snapshot.layers = next.layers; snapshot.crs = next.crs; count++
    } catch (err) { skipped.push(`${source.name}：${err instanceof Error ? err.message : "不可用"}`) }
  }
  if (count) { doc.value = snapshot; layoutOnly.value = false; emit("resetSources") }
  status.value = `已读取 ${count} 个业务图层；震情、数据完整性与来源仍须核验`
  error.value = skipped.join("；") || (count ? "" : "地图中没有可读取的规范业务图层")
}
function setPublicationOutput(extension: "jpg" | "pdf", density: number) {
  if (busy.value || !["jpg", "pdf"].includes(extension) || ![300, 450, 600].includes(density)) { return }
  format.value = extension; dpi.value = density
}
type MapWorkBounds = { west: number; south: number; east: number; north: number }
let lastOnlineDescription = ""
let lastOnlineEvent = ""
function replaceOnlineLayers(layers: DbtLayer[], bounds: MapWorkBounds | null, title: string) {
  const snapshot = JSON.parse(JSON.stringify(doc.value || emptyDbtDocument())) as DbtDocument
  snapshot.layers = snapshot.layers.filter(layer => !layer.onlineSource)
  const event = layerEventParameters(layers)
  if (event) { snapshot.event = { ...event.event }; lastOnlineEvent = JSON.stringify(snapshot.event) } else if (lastOnlineEvent) {
    if (JSON.stringify(snapshot.event) === lastOnlineEvent) { snapshot.event = emptyDbtDocument().event }
    lastOnlineEvent = ""
  }
  if (layers.length && bounds) {
    const crs = layers[0].crs
    if (layers.some(layer => layer.crs !== crs) || snapshot.layers.some(layer => layer.crs !== crs)) { error.value = "在线与现有图层坐标不一致，不能直接混合或改写标签"; emit("renderFailed"); return false }
    snapshot.crs = crs; snapshot.usage = "reference"
    snapshot.createdAt ||= new Date().toISOString()
    const sourceDescription = onlineLayerDescription(layers)
    snapshot.reference = { title: onlineProofTitle(title, layers, event?.name), bounds: { ...bounds }, notice: sourceDescription }
    snapshot.layers.push(...JSON.parse(JSON.stringify(layers)))
    if (props.templateId === "T30102000") {
      let instance = "00"
      if (layers.length === 1 && layers[0].role === "population") { instance = "01" }
      if (layers.length === 1 && layers[0].role === "economy") { instance = "03" }
      snapshot.classification = { instance, spatial: "6" }
    }
    const description = onlineMapDescription(layers)
    if (!snapshot.description || snapshot.description === lastOnlineDescription || snapshot.description === sourceDescription) { snapshot.description = description }
    lastOnlineDescription = description
  } else if (!snapshot.layers.length && snapshot.reference?.title.endsWith("· 在线数据校样")) {
    delete snapshot.reference; delete snapshot.usage; snapshot.crs = "EPSG:4490"; snapshot.crsEvidence = ""
    if (snapshot.description === lastOnlineDescription) { snapshot.description = "" }
    lastOnlineDescription = ""
  }
  doc.value = snapshot; layoutOnly.value = false; error.value = ""; return true
}
function acceptBackendDocument(value: DbtDocument) {
  const next = readDbtDocument(value)
  if (!next.backendDocument || next.usage !== "operational") { throw new Error("缺少后台审核绑定") }
  doc.value = next; layoutOnly.value = false; error.value = ""; status.value = "已绑定后台审核版本，待当前图件质量检查与复核"
}
function clearBackendDocument() { if (doc.value?.backendDocument) { doc.value = emptyDbtDocument(); layoutOnly.value = false } }
defineExpose({ updateCopy, importTemplateLayer, replaceOnlineLayers, acceptBackendDocument, clearBackendDocument, publication, setPublicationOutput, exportMap, downloadReport, preparePublication, preparePreview })
function requestMap(selection: boolean) {
  awaitingMap = true; proofOpen.value = false
  if (selection) { emit("selectRange") } else { emit("captureMap") }
}
function addLayer() {
  if (!doc.value) { return }
  doc.value.layers.push({ id: crypto.randomUUID(), name: dbtRoleNames[newRole.value], role: newRole.value, crs: doc.value.crs, source: "", authority: "", publishedAt: "", security: "", scale: 1000000, data: { type: "FeatureCollection", features: [] } })
}
function chooseLayer(id: string) { targetLayer = id; layerInput.value?.click() }
function numericLayerFields(layer: DbtLayer) {
  return [...new Set(layer.data.features.flatMap(feature => Object.keys((feature.properties || {}) as Record<string, unknown>)))].map(String).filter(field => layer.data.features.every(feature => (feature.properties as Record<string, unknown> | undefined)?.[field] === null || typeof (feature.properties as Record<string, unknown> | undefined)?.[field] === "number"))
}
function newDocument() {
  if (doc.value?.layers.length && !window.confirm("新建图件将清空当前图件数据，请确认已保存。是否继续？")) { return }
  awaitingMap = false; layoutOnly.value = false; error.value = ""; populationMetric.value = ""; doc.value = emptyDbtDocument()
  emit("resetSources")
}
let localToken: ReturnType<typeof beginInput> | undefined
function localLoading(value: boolean) { if (value) { localToken = beginInput() } else if (localToken) { finishInput(localToken); localToken = undefined } }
function importLocalReference(value: DbtDocument) {
  if (!localToken || !inputCurrent(localToken)) { return }
  if (doc.value?.layers.length && !window.confirm("载入将建立独立参考图并替换当前图件。已保存当前数据并继续？")) { return }
  awaitingMap = false; layoutOnly.value = false; doc.value = readDbtDocument(value); error.value = ""; status.value = "已载入项目原始数据参考图 · 未叠加虚构震情"
}
async function importPopulation(event: Event) {
  if (!props.allowFixtures) { error.value = "当前制图仅接入后台数据，不读取本地人口文件"; return }
  const element = event.target as HTMLInputElement; const file = element.files?.[0]
  if (!file || !doc.value) { return }
  const token = beginInput()
  const snapshot = JSON.parse(JSON.stringify(doc.value)) as DbtDocument
  const metric = populationMetric.value
  error.value = ""
  try {
    if (!metric) { throw new Error("请根据数据说明先确认人口像元指标，不自动猜测人数或人口密度") }
    if (file.size > 256 * 1024 * 1024) { throw new Error("人口 GeoTIFF 超过 256 MB，请先提供区域原始像元子集") }
    const grid = await readPopulationGeoTiff(await file.arrayBuffer(), file.name, metric)
    if (snapshot.layers.some(layer => layer.crs !== grid.crs)) { throw new Error("现有图层与人口栅格坐标不一致，请新建图件或提供有依据的同坐标数据，不能直接叠加") }
    snapshot.classification = { instance: "01", spatial: snapshot.classification?.spatial || "6" }
    snapshot.layers = snapshot.layers.filter(layer => layer.role !== "population")
    const next = mergeDbtSourceLayer(snapshot, { id: crypto.randomUUID(), name: file.name, role: "population", source: `${file.name} · SHA-256 ${grid.sourceSha256}`, crs: grid.crs, crsEvidence: `原始 GeoTIFF GeoKey：${grid.crs}；原始像元，未改写坐标或插值`, authority: "", publishedAt: "", security: "", scale: 1000000, coverage: grid.bounds, coverageEvidence: "原始栅格矩形覆盖；缺测另行统计，待完整性审核", grid, data: { type: "FeatureCollection", features: [] } })
    if (!inputCurrent(token)) { return }
    awaitingMap = false; layoutOnly.value = false; doc.value = next
    emit("resetSources")
  } catch (err) { if (inputCurrent(token)) { error.value = err instanceof Error ? err.message : "人口导入失败" } } finally { element.value = ""; finishInput(token) }
}
async function importLayer(event: Event) {
  if (!props.allowFixtures) { error.value = "当前制图仅接入后台数据，不读取本地图层文件"; return }
  const element = event.target as HTMLInputElement; const file = element.files?.[0]; if (!file || !doc.value) { return }
  const token = beginInput(); const id = targetLayer
  try {
    if (file.size > 20 * 1024 * 1024) { throw new Error("单层数据不能超过 20 MB") }
    const snapshot = JSON.parse(JSON.stringify(doc.value)) as DbtDocument; const layer = snapshot.layers.find(item => item.id === id)
    if (!layer) { return }
    if (/\.(png|jpe?g)$/i.test(file.name)) {
      if (!layer.coverage) { throw new Error("图片缺少原始地理定位，不能把当前图幅或虚构范围当作图片覆盖范围") }
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
      layer.raster = { image: data, bounds: { ...layer.coverage! }, rendering: layer.role === "dem" ? "hillshade" : "imagery", radiometry: "" }
      layer.data.features = []
    } else { layer.data = JSON.parse(await file.text()); delete layer.raster }
    delete layer.grid
    const validated = readDbtDocument(snapshot)
    if (inputCurrent(token)) { doc.value = validated; error.value = "" }
  } catch (err) { if (inputCurrent(token)) { error.value = err instanceof Error ? err.message : "图层导入失败" } } finally { element.value = ""; finishInput(token) }
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
  if (!props.allowFixtures) { return }
  error.value = ""; const id = props.templateId; const token = beginInput()
  try {
    const path = standardPreviewPath(id) || `data/dbt116-test/${id}.json`
    const response = await fetch(`${import.meta.env.BASE_URL}${path}`)
    if (!response.ok) { throw new Error("测试数据加载失败") }
    const next = readDbtDocument(await response.json())
    if (!inputCurrent(token)) { return }
    awaitingMap = false; layoutOnly.value = false; doc.value = next; proofOpen.value = window.innerWidth > 900
  } catch (err) { if (inputCurrent(token)) { error.value = err instanceof Error ? err.message : "测试数据读取失败" } } finally { finishInput(token) }
}
async function importDocument(event: Event) {
  if (!props.allowFixtures) { error.value = "当前制图仅接入后台数据，不读取本地制图文件"; return }
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) { return }
  const token = beginInput()
  try {
    if (file.size > 20 * 1024 * 1024) { throw new Error("标准数据包不能超过 20 MB") }
    const next = readDbtDocument(JSON.parse(await file.text()))
    if (!props.allowFixtures && next.usage === "test") { throw new Error("生产制图不接入合成测试数据，请提供真实业务数据") }
    if (!props.allowFixtures && next.layers.some(layer => layer.onlineSource)) { throw new Error("在线数据任务需恢复配置并重新读取后端，不能将旧校样图片当作当前数据") }
    if (!inputCurrent(token)) { return }
    awaitingMap = false; layoutOnly.value = false; doc.value = next; proofOpen.value = window.innerWidth > 900; error.value = ""
    emit("resetSources")
  } catch (err) { if (inputCurrent(token)) { error.value = err instanceof Error ? err.message : "导入失败" } } finally { finishInput(token); (event.target as HTMLInputElement).value = "" }
}
function downloadDocument(current: boolean) {
  const value = current && doc.value ? doc.value : emptyDbtDocument()
  downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), `${props.templateId}-${current ? "制图数据" : "空数据结构"}.json`)
}
async function report() {
  const data = JSON.stringify(doc.value)
    const record = JSON.parse(JSON.stringify({ standard: DBT_STANDARD, ruleset: CARTOGRAPHY_RULESET, classification: DBT_CLASSIFICATION, backendDocument: doc.value?.backendDocument, template: props.templateId, code: mapCode.value, usage: doc.value?.usage || "unknown", checkedAt: new Date().toISOString(), scope: doc.value && standardBounds(doc.value, props.templateId), statistics: statistics.value, annotations: annotationAudit.value, issues: allIssues.value, review: dbtReviewClauses.map((entry, i) => ({ ...entry, confirmed: !!reviewed.value[i] })), reviewer: reviewer.value, evidence: reviewEvidence.value, formalExportEnabled: canExport.value }))
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data))
  return { ...record, dataSha256: Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("") }
}
async function downloadReport() { const record = await report(); downloadBlob(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }), `${record.code}-条款检查.json`) }
async function preparePublication(): Promise<StandardPublicationBundle> {
  if (!doc.value || busy.value || !canExport.value) { throw new Error("当前图件未完成正式出图检查或正在处理") }
  const id = props.templateId; const revision = publicationRevision.value; const density = dpi.value; const extension = format.value
  const snapshot = readDbtDocument(JSON.parse(JSON.stringify(doc.value)))
  busy.value = true; error.value = ""
  try {
    if (!props.allowFixtures) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000)
      try { await revalidateBackendDocument(snapshot, id, controller.signal) } finally { clearTimeout(timer) }
    }
    const review = await report()
    const canvas = window.document.createElement("canvas")
    const result = await renderDbtMap(canvas, snapshot, id, { dpi: density, draft: false, layoutOnly: false, mapPreview: null })
    if (result.issues.length) {
      renderIssues.value = result.issues.map(message => ({ clause: "9 / 10.1", severity: "error", message }))
      throw new Error(result.issues.join("；"))
    }
    const title = dbtTitle(snapshot, id)
    const blob = await encodeDbtMap(canvas, extension, density, title, `${DBT_STANDARD}; ${DBT_CLASSIFICATION}; ${review.code}; 人工复核成果`)
    if (disposed || revision !== publicationRevision.value || !props.active || !canExport.value) { throw new Error("图件或复核信息已变化，请重新检查后发布") }
    const filename = `${title}-审核出图-${density}dpi.${extension}`.replace(/[\\/:*?"<>|]/g, "_")
    return { templateId: id, title, code: review.code, revision, format: extension, dpi: density, document: snapshot, review, file: new File([blob], filename, { type: blob.type }) }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "正式图件生成失败"
    throw err
  } finally { busy.value = false }
}
async function exportMap(formal: boolean) {
  if (!doc.value || busy.value || (formal && !canExport.value)) { return }
  if (!renderReady.value) { error.value = "当前数据尚未生成图件，不能导出上一次预览"; return }
  if (formal) {
    try {
      const bundle = await preparePublication()
      downloadBlob(bundle.file, bundle.file.name)
      downloadBlob(new Blob([JSON.stringify(bundle.review, null, 2)], { type: "application/json" }), `${bundle.code}-条款检查.json`)
      status.value = `已导出正式图件 · A3 · ${bundle.dpi} DPI`
    } catch { /* preparePublication exposes the actionable error in the editor and publication panel. */ }
    return
  }
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
watch([doc, () => props.templateId, reviewed, reviewer, reviewEvidence, layoutOnly, format, dpi, () => props.compositionIssues], () => {
  publicationRevision.value++
}, { deep: true, flush: "sync" })
watch([doc, () => props.templateId], () => {
  if (doc.value) {
    doc.value.classification ||= { instance: "00", spatial: "6" }; doc.value.assessment ||= {}
    for (const layer of doc.value.layers) { if (!layer.coverage && layer.raster?.bounds) { layer.coverage = { ...layer.raster.bounds } } }
  }
  const snapshot = JSON.stringify(doc.value)
  if (!restoring && previousSnapshot !== snapshot) {
    if (Date.now() - lastHistory > 600) { undoStack.value.push(previousSnapshot) }
    while (undoStack.value.length > 10 || undoStack.value.reduce((sum, item) => sum + item.length, 0) > 25_000_000) { undoStack.value.shift() }
    redoStack.value = []; lastHistory = Date.now()
  }
  restoring = false; previousSnapshot = snapshot
  sourceRevision++; version++; renderEpoch++; reviewed.value = []; renderReady.value = false; renderIssues.value = []; clearTimeout(timer); timer = setTimeout(render, 180)
}, { deep: true })
watch(() => props.templateId, () => { if (doc.value?.classification) { doc.value.classification.instance = "00" }; error.value = ""; proofOpen.value = false })
watch([() => props.mapPreview, layoutOnly], () => {
  if (awaitingMap && props.mapPreview) { awaitingMap = false; layoutOnly.value = true }
  version++; renderEpoch++; renderReady.value = false; clearTimeout(timer); timer = setTimeout(render, 180)
})
watch(() => props.active, async active => {
  version++; renderEpoch++; observer?.disconnect(); window.removeEventListener("resize", positionProof); window.removeEventListener("keydown", keydown)
  if (!active) { inputRevision++; importing.value = false; clearTimeout(timer); busy.value = false; return }
  if (props.allowFixtures && !props.mapPreview && !props.mapBusy && !hasStandardExtent.value) { requestMap(false) }
  await nextTick(); positionProof(); observer = new ResizeObserver(positionProof)
  const panel = window.document.querySelector(".thematic-workbench-panel"); if (panel) { observer.observe(panel) }
  window.addEventListener("resize", positionProof); window.addEventListener("keydown", keydown); render()
}, { immediate: true })
onBeforeUnmount(() => { disposed = true; version++; clearTimeout(timer); observer?.disconnect(); window.removeEventListener("resize", positionProof); window.removeEventListener("keydown", keydown); if (preview.value) { URL.revokeObjectURL(preview.value) } })
</script>

<style scoped>
.dbt-editor { color: var(--thematic-ink); padding: 4px 0 20px; font-size: 14px; }
.dbt-editor fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }.dbt-editor fieldset:disabled input,.dbt-editor fieldset:disabled textarea,.dbt-editor fieldset:disabled select { color: var(--thematic-ink); opacity: 1; }
.dbt-readiness { border-block: 1px solid var(--thematic-line); padding: 12px 0; margin-bottom: 14px; }.dbt-readiness dl { margin: 0; display: grid; grid-template-columns: 76px minmax(0,1fr); gap: 7px 12px; font-size: 13px; line-height: 1.6; }.dbt-readiness dt { color: var(--thematic-muted); }.dbt-readiness dd { margin: 0; overflow-wrap: anywhere; }.dbt-readiness .needs-check { color: var(--thematic-warning); }
.dbt-map-source { border-top: 1px solid var(--thematic-line); border-bottom: 1px solid var(--thematic-line); padding-bottom: 8px; }.dbt-editor .dbt-inline-preview { width: 100%; aspect-ratio: 420/297; padding: 0; overflow: hidden; background: #fff; color: #26343b; }.dbt-inline-preview img { display: block; width: 100%; height: 100%; object-fit: contain; }.dbt-editor .dbt-missing { color: var(--thematic-warning); font-size: 13px; }.dbt-editor .dbt-missing li { margin: 4px 0; }
.dbt-editor .dbt-check { display: flex; align-items: center; }.dbt-table { width: 100%; border-collapse: collapse; margin-top: 10px; }.dbt-table th, .dbt-table td { padding: 7px 4px; border-bottom: 1px solid var(--thematic-line); text-align: left; font-weight: normal; }.dbt-layer { margin-top: 8px; }.dbt-layer summary { overflow-wrap: anywhere; }
.dbt-editor header { display: grid; gap: 8px; margin-bottom: 16px; }.dbt-editor header strong { font-size: 17px; line-height: 1.5; }.dbt-editor header span, small { color: var(--thematic-muted); }
.dbt-editor button, .dbt-proof button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; border: 1px solid var(--thematic-line); background: var(--thematic-subtle); color: var(--thematic-ink); padding: 7px 10px; cursor: pointer; white-space: nowrap; border-radius: 3px; }
.dbt-editor button:disabled { opacity: 1; color: var(--thematic-disabled-ink); background: var(--thematic-disabled-bg); cursor: not-allowed; }.dbt-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.dbt-online-review { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding-block: 12px; }.dbt-online-review span { color: var(--thematic-muted); font-size: 13px; }
.dbt-editor label { display: grid; gap: 6px; margin: 10px 0; }.dbt-editor input:not([type=checkbox]), .dbt-editor select, .dbt-editor textarea { min-width: 0; width: 100%; box-sizing: border-box; background: var(--thematic-control); color: var(--thematic-ink); border: 1px solid var(--thematic-line); padding: 8px; border-radius: 3px; font: inherit; color-scheme: var(--thematic-scheme); }.dbt-editor textarea { resize: vertical; }
.dbt-editor details { border-top: 1px solid var(--thematic-line); padding: 12px 0; }.dbt-editor summary { cursor: pointer; font-weight: 600; }.dbt-editor a { display: block; color: var(--thematic-accent); margin: 10px 0; }.dbt-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }.dbt-spec { display: grid; grid-template-columns: 48px minmax(0,1fr); gap: 8px; line-height: 1.6; }.dbt-spec dd { margin: 0; color: var(--thematic-muted); overflow-wrap: anywhere; }.dbt-spec dt { color: var(--thematic-ink); }
.dbt-editor ul { padding-left: 20px; }.dbt-editor li { margin: 9px 0; line-height: 1.6; }.dbt-editor li small { display: block; }.dbt-quality .is-error, .dbt-error { color: var(--thematic-danger); }.dbt-quality .is-warning, .dbt-test { color: var(--thematic-warning); }.dbt-review label:has(input[type=checkbox]) { display: flex; align-items: flex-start; line-height: 1.6; }.dbt-review input[type=checkbox] { flex: none; margin-top: 5px; }.dbt-status { color: var(--thematic-success); line-height: 1.6; }
.dbt-proof { position: fixed; z-index: 1100; display: flex; flex-direction: column; background: #26353c; border: 1px solid #708891; border-radius: 6px; color: #e4f0f5; overflow: hidden; box-sizing: border-box; }
.dbt-proof header { display: flex; align-items: center; gap: 14px; padding: 14px; border-bottom: 1px solid #48616c; min-width: 0; }.dbt-proof header strong { font-size: 18px; }.dbt-proof header span { font-size: 12px; margin-left: auto; }.dbt-proof header button { width: 36px; flex: none; }.dbt-proof-tools { display: flex; align-items: center; gap: 10px; padding: 9px 14px; }.dbt-proof-tools span:first-child { margin-right: auto; font-size: 13px; }.dbt-proof-tools button { width: 34px; padding: 4px; }.dbt-proof-scroll { flex: 1; min-height: 0; overflow: auto; padding: 18px; display: flex; align-items: flex-start; }.dbt-proof-scroll img { display: block; flex: none; height: auto; object-fit: contain; margin: auto; }.dbt-proof footer { font-size: 12px; min-height: 20px; padding: 8px 14px; overflow-wrap: anywhere; border-top: 1px solid #48616c; }
@media(max-width: 700px) { .dbt-proof header > span { display: none; }.dbt-proof header button { margin-left: auto; }.dbt-proof-scroll { padding: 8px; } }
</style>
