<template>
  <section ref="root" class="workflow-data" aria-label="专题数据接入" :inert="generating || toolsBusy || undefined">
    <ProductRequirements :topic="topic" :layers="loaded" :states="states" :busy="busy" @locate="focusRequirement" />
    <header><strong>地图图层</strong><span>{{ loaded.length }} 层</span></header>
    <ul v-if="loaded.length" class="operator-layers" aria-label="地图图层列表">
      <li v-for="(layer, index) in orderedLayers" :key="layer.id" :data-layer-id="layer.id">
        <label class="check"><input type="checkbox" :checked="layer.enabled !== false" :aria-label="`${layer.name}图层显示`" :disabled="busy || generating" @change="presentation(layerKey(layer), { enabled: ($event.target as HTMLInputElement).checked })" />{{ layer.name }}</label>
        <div class="actions"><button type="button" :disabled="busy || generating" :aria-label="`${layer.name}符号化与渲染`" @click="openLayerStyle(layerKey(layer))"><mars-icon icon="config" :width="15" />样式</button><button type="button" title="图层上移" :aria-label="`${layer.name}上移`" :disabled="index === 0 || busy || generating" @click="moveLayer(layer, -1)"><mars-icon icon="up" :width="15" /></button><button type="button" title="图层下移" :aria-label="`${layer.name}下移`" :disabled="index === orderedLayers.length - 1 || busy || generating" @click="moveLayer(layer, 1)"><mars-icon icon="down" :width="15" /></button><button type="button" title="移除图层" :aria-label="`${layer.name}移除`" :disabled="busy || generating" @click="invalidate(layerKey(layer))"><mars-icon icon="delete" :width="15" /></button></div>
        <label class="opacity-control">透明度 {{ Math.round((layer.opacity ?? 1) * 100) }}%<input type="range" min="0" max="1" step=".05" :value="layer.opacity ?? 1" :aria-label="`${layer.name}图层透明度`" :disabled="busy || generating" @input="presentation(layerKey(layer), { opacity: Number(($event.target as HTMLInputElement).value) })" /></label>
        <template v-if="backgroundNote(layer)"><label class="background-display">背景网格表达<select :value="backgroundDisplays[layerKey(layer)] || 'grid'" :aria-label="`${layer.name}背景网格表达`" :disabled="busy || generating" @change="changeBackgroundDisplay(layerKey(layer), ($event.target as HTMLSelectElement).value)"><option value="grid">原始网格轮廓与读数</option><option value="fill">原值填色（参考）</option></select></label><p class="background-note notice" role="status">{{ backgroundNote(layer) }}</p></template>
      </li>
    </ul>
    <LayerStyleEditor v-if="styleLayer && !styleLayer.raster" :key="styleLayer.id" :layer="styleLayer" :busy="busy || generating" @close="styleKey = ''" @apply="applyLayerStyle" @restore="restoreLayerStyle" />
    <LayerAnalysisTools v-if="loaded.length" ref="analysisTools" :layers="loaded" :scope-key="scopeFingerprint(bounds)" :busy="busy || generating" @busy="toolsBusy = $event" @add="addAnalysisLayer" />
    <div v-if="autoMatch && bounds" class="content-matches">
      <div class="actions"><button type="button" class="generate-map" :disabled="busy || generating || !matchedRequirements.length" @click="generateMatched"><mars-icon icon="play" :width="16" />{{ generateLabel }}</button><button type="button" class="prepare-data" :disabled="busy || generating || !active" @click="openDataPreparation()"><mars-icon icon="folder-open" :width="16" />选择后端资料</button></div>
      <p v-if="!busy && coreMissing.length" class="notice" role="status">待准备：{{ coreMissing.join('；') }}</p>
      <div v-if="contentTopics.length > 1" class="content-topics"><label v-for="entry in contentTopics" :key="entry.key"><input v-model="contentTopic" type="radio" name="content-topic" :value="entry.key" :disabled="busy" />{{ entry.label }}</label></div>
      <label v-if="topicDates.length > 1">资料时点<select :value="topicDate" aria-label="专题资料时点" :disabled="busy || generating" @change="changeTopicDate(($event.target as HTMLSelectElement).value)"><option v-for="date in topicDates" :key="date" :value="date">{{ date }}</option></select></label>
      <p v-else-if="topicDate" class="muted">资料时点：{{ topicDate }}</p>
      <ul v-if="!busy && !loaded.length"><li v-for="entry in matchedRequirements" :key="entry.key"><strong>{{ entry.label }}</strong><span>{{ contentChoices[entry.key][0].recommendation?.label || '已匹配' }}</span></li></ul>
    </div>
    <p v-if="!bounds" class="notice" role="status">尚未确认地图框选范围</p>
    <p v-else-if="!availableRequirements.length" class="notice" role="status">尚未选择专题图层。</p>
    <template v-else>
      <div class="actions"><button type="button" :disabled="busy || !active || !hasAdapters" @click="queryAll"><mars-icon icon="refresh" :width="16" />{{ busy ? '正在加载' : '刷新可用图层' }}</button><button type="button" :disabled="!loaded.length || busy" @click="emit('view-map')"><mars-icon icon="eyes" :width="16" />查看地图</button><button type="button" :disabled="!loaded.length || busy || composeReady === false" @click="emit('compose')"><mars-icon icon="layout-two" :width="16" />排版校样</button></div>
      <details class="quality local-data-draft"><summary>图层方案</summary><div class="actions"><button type="button" :disabled="busy" title="仅在当前浏览器保存后端图层编号与样式参数，不保存数据文件或审核状态" @click="saveTask"><mars-icon icon="save" :width="16" />保存数据配置</button><button type="button" :disabled="busy || !savedTask" title="同专题、同查询范围恢复参数，并重新读取后端数据" @click="restoreTask"><mars-icon icon="history" :width="16" />恢复数据配置</button></div></details>
    </template>
    <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="status" role="status">{{ status }}</p>
    <details v-if="contentProblems.length" class="quality"><summary>资料查询详情 · {{ contentProblems.length }} 项</summary><ul><li v-for="problem in contentProblems" :key="problem">{{ problem }}</li></ul></details>
    <div class="actions"><button v-for="(token, collection) in cursors" :key="collection" type="button" :disabled="busy || !token" @click="more(collection)"><mars-icon icon="more" :width="16" />继续读取 {{ collection === '*' ? '更多专题数据' : collection }}</button></div>
    <details :open="!autoMatch || undefined" class="matched-settings"><summary v-if="autoMatch">更换资料与渲染设置</summary><div class="requirement-list">
      <section v-for="entry in availableRequirements" :key="entry.key" class="requirement" :data-requirement-key="entry.key" tabindex="-1" :aria-label="entry.label">
        <div class="requirement-heading"><strong>{{ entry.label }}</strong><span :class="{ warning: states[entry.key] !== 'unverified' }">{{ stateLabel(entry.key) }}</span></div>
        <p class="muted">{{ entry.group === 'required' ? '必需图层' : entry.group === 'topic' ? '专题图层 · 任选其一' : '参考图层' }}</p>
        <template v-if="(entry.adapter || manualItems[entry.key]) && bounds">
          <label v-if="candidates[entry.key]?.length">数据条目<select :value="selected[entry.key] || ''" :aria-label="`${entry.label}数据条目`" :disabled="busy" @change="changeItem(entry.key, ($event.target as HTMLSelectElement).value)"><option value="">请选择数据</option><option v-for="item in candidates[entry.key]" :key="candidateKey(entry.key, item)" :value="candidateKey(entry.key, item)">{{ remoteItemTitle(item) }} · {{ remoteItemTime(item) }}</option></select></label>
          <template v-if="currentItem(entry.key)">
            <label>显示内容<select :value="assetKeys[entry.key]" :aria-label="`${entry.label}资产`" :disabled="busy" @change="changeAsset(entry.key, ($event.target as HTMLSelectElement).value)"><option v-for="asset in assetsFor(entry.key)" :key="asset.key" :value="asset.key">{{ asset.title }}</option></select></label>
            <label v-if="backendResultFields(currentItem(entry.key)!).length">显示指标<select :value="vectorFields[entry.key]" :aria-label="`${entry.label}显示指标`" :disabled="busy" @change="vectorFields[entry.key] = ($event.target as HTMLSelectElement).value; invalidate(entry.key)"><option v-for="field in backendResultFields(currentItem(entry.key)!)" :key="field.key" :value="field.key">{{ field.label }}</option></select></label>
            <details v-if="currentAsset(entry.key)?.kind === 'raster'" class="quality print-precision"><summary>出图精度</summary><label>校样源图精度<select :value="sourceDpi[entry.key] || 300" :aria-label="`${entry.label}源图DPI`" :disabled="busy" @change="changeDpi(entry.key, Number(($event.target as HTMLSelectElement).value))"><option :value="150">150 DPI</option><option :value="300">300 DPI</option><option :value="450">450 DPI</option><option :value="600">600 DPI</option></select></label></details>
            <details v-if="currentAsset(entry.key)?.numeric" class="quality render-style"><summary>渲染样式 · {{ displayLabel(entry.key) }}</summary>
              <label v-if="currentAsset(entry.key)!.bands.length > 1">波段<select :value="options[entry.key].band" :aria-label="`${entry.label}栅格波段`" :disabled="busy" @change="changeBand(entry.key, Number(($event.target as HTMLSelectElement).value))"><option v-for="(name, i) in currentAsset(entry.key)!.bands" :key="i" :value="i + 1">{{ name }}</option></select></label>
              <label v-if="isClassified(entry.key) && !options[entry.key].fixedBreaks" class="check"><input v-model="options[entry.key].automatic" type="checkbox" :disabled="busy" @change="invalidate(entry.key)" />按选区原值自动分级</label>
              <label v-if="isTemperature(entry.key)" class="check"><input v-model="options[entry.key].automatic" type="checkbox" :disabled="busy" @change="invalidate(entry.key)" />按选区原值自动拉伸</label>
              <template v-if="options[entry.key].fixedBreaks"><div class="pair"><label v-for="(_, i) in options[entry.key].fixedBreaks" :key="i">固定上界 {{ i + 1 }}<input v-model.number="options[entry.key].fixedBreaks![i]" type="number" step="any" :aria-label="`${entry.label}固定断点${i + 1}`" :disabled="busy" @change="invalidate(entry.key)" /></label></div><button type="button" :disabled="busy" @click="unlockClasses(entry.key)"><mars-icon icon="unlock" :width="16" />恢复选区自动分级</button></template>
              <div v-if="isClassified(entry.key) && options[entry.key].automatic" class="pair"><label>分级方法<select v-model="options[entry.key].method" :disabled="busy" @change="invalidate(entry.key)"><option value="quantile">分位数</option><option value="natural">自然断点</option><option value="equal">等距</option></select></label><label>分级数量<input v-model.number="options[entry.key].count" type="number" min="2" max="9" :disabled="busy" @input="invalidate(entry.key)" /></label></div>
              <div v-else class="pair"><label>显示下限<input v-model.number="options[entry.key].minimum" type="number" step="any" :disabled="busy || (isTemperature(entry.key) && options[entry.key].automatic)" @input="invalidate(entry.key)" /></label><label>显示上限<input v-model.number="options[entry.key].maximum" type="number" step="any" :disabled="busy || (isTemperature(entry.key) && options[entry.key].automatic)" @input="invalidate(entry.key)" /></label></div>
              <label v-if="topic === 'raster-threshold'">原值分类阈值<input v-model.number="options[entry.key].threshold" :aria-label="`${entry.label}分类阈值`" type="number" step="any" placeholder="填写有依据的阈值" :disabled="busy" @input="invalidate(entry.key)" /></label>
              <p v-if="isClassified(entry.key) && options[entry.key].method === 'natural'" class="muted">大于 2048 个有效像元时，断点按确定性样本估计；原始像元统计不降采样。</p>
            </details>
            <div class="actions"><button type="button" :disabled="busy || !active || !currentAsset(entry.key)" @click="render(entry)"><mars-icon icon="layers" :width="16" />{{ entry.adapter === 'business-vector' ? '读取专题数据' : '叠加渲染' }}</button><button type="button" :disabled="busy || !bindings[entry.key]" @click="invalidate(entry.key)"><mars-icon icon="delete" :width="16" />移除</button></div>
          </template>
          <p v-if="states[entry.key] === 'failed'" class="error" role="alert">{{ messages[entry.key] || '图层加载失败，请重试或检查网络。' }}</p>
          <p v-else-if="states[entry.key] === 'empty'" class="notice" role="status">当前查询未自动匹配到该类资产。</p>
        </template>
        <template v-if="bindings[entry.key]">
          <button v-if="isClassified(entry.key) && bindings[entry.key].onlineSource?.rendering?.classBreaks?.length && !options[entry.key].fixedBreaks" type="button" :disabled="busy" @click="lockClasses(entry.key)"><mars-icon icon="lock" :width="16" />固定当前分级断点</button>
          <div v-if="entry.adapter !== 'business-vector'" class="pair"><label class="check"><input type="checkbox" :checked="bindings[entry.key].enabled !== false" :aria-label="`${entry.label}显示`" :disabled="busy" @change="presentation(entry.key, { enabled: ($event.target as HTMLInputElement).checked })" />显示图层</label><label>透明度 {{ Math.round((bindings[entry.key].opacity ?? 1) * 100) }}%<input type="range" min="0" max="1" step="0.05" :value="bindings[entry.key].opacity ?? 1" :aria-label="`${entry.label}透明度`" :disabled="busy" @input="presentation(entry.key, { opacity: Number(($event.target as HTMLInputElement).value) })" /></label></div>
          <ul v-if="bindings[entry.key].legend?.length" class="legend"><li v-for="row in bindings[entry.key].legend" :key="row.label"><CartographyLegendSwatch :row="row" />{{ row.label }}</li></ul>
          <p v-if="rejectedCount(entry.key)" class="notice" role="status">源数据有 {{ rejectedCount(entry.key) }} 个退化或无效要素未绘制，详情见数据说明；不视为完整合格图层。</p>
          <p v-if="coverageGapCount(entry.key)" class="notice" role="alert">仅部分覆盖选区：未覆盖区域不是空白地物，需要补齐对应图幅后才能正式出图；校样中已标示缺失范围。</p>
          <p v-if="assessmentWarning(entry.key)" class="notice" role="status">{{ assessmentWarning(entry.key) }}</p>
          <p v-if="isTemperature(entry.key)" class="notice" role="status">按后端原始温度指标显示；单位与用途以来源说明为准，不据此判定热异常。</p>
          <p v-if="bindings[entry.key].onlineSource?.rendering?.kind?.startsWith('后台预设设色')" class="notice" role="status">后台预设设色，分级阈值和完整图例待核验。</p>
          <dl v-if="eventParameters(entry.key)" class="statistics"><dt>发震时间（UTC）</dt><dd>{{ eventParameters(entry.key)!.event.time }}</dd><dt>震中地名</dt><dd>{{ eventParameters(entry.key)!.event.place }}</dd><dt>经度 / 纬度</dt><dd>{{ eventParameters(entry.key)!.event.longitude }} / {{ eventParameters(entry.key)!.event.latitude }}</dd><dt>震级 / 类型</dt><dd>{{ eventParameters(entry.key)!.event.magnitude }} / {{ eventParameters(entry.key)!.event.magnitudeType || '未注明' }}</dd><dt>深度</dt><dd>{{ eventParameters(entry.key)!.depthKm ?? '未提供' }} km</dd><dt>Mw</dt><dd>{{ eventParameters(entry.key)!.mw ?? '未提供' }}</dd></dl>
        </template>
        <details class="quality layer-provenance"><summary>数据说明与溯源</summary>
          <p class="muted">{{ entry.note }}</p>
          <p v-if="currentItem(entry.key)" class="muted">目录单位：{{ remoteCatalogUnit(currentItem(entry.key)!, assetKeys[entry.key]) }}</p>
          <template v-if="currentAsset(entry.key)?.numeric"><button type="button" :disabled="busy || !active" @click="queryPoint(entry.key)"><mars-icon icon="search" :width="16" />查询选区中心原值</button><p v-if="pointValues[entry.key]" class="muted">经度 {{ pointValues[entry.key].longitude.toFixed(5) }} / 纬度 {{ pointValues[entry.key].latitude.toFixed(5) }}：{{ pointValues[entry.key].value ?? '缺测' }} · {{ remoteCatalogUnit(currentItem(entry.key)!, assetKeys[entry.key]) }}</p></template>
          <template v-if="currentItem(entry.key)?.assets.height"><button type="button" :disabled="busy || !active" @click="queryPoint(entry.key, true)"><mars-icon icon="search" :width="16" />查询选区中心派生高度</button><p v-if="heightValues[entry.key]" class="muted">经度 {{ heightValues[entry.key].longitude.toFixed(5) }} / 纬度 {{ heightValues[entry.key].latitude.toFixed(5) }}：{{ heightValues[entry.key].value ?? '缺测' }} 原始派生值；不是实际地形或人口/GDP 原值。</p></template>
          <p v-if="messages[entry.key]" :class="states[entry.key] === 'failed' ? 'error' : 'notice'">{{ messages[entry.key] }}</p>
          <p v-if="normalizedCount(entry.key)" class="muted">{{ normalizedCount(entry.key) }} 个要素的连续重复顶点已去重；未移动或新增坐标，处理记录保留在制图数据中。</p>
          <p v-if="(bindings[entry.key]?.data as any)?.metadata?.geometryNormalizations?.length" class="muted">重叠多部件已按几何并集表达，未改动业务属性；处理前后面积与部件数记录随图件保存。</p>
          <template v-if="bindings[entry.key]">
          <p v-if="bindings[entry.key].onlineSource?.rendering" class="muted">{{ bindings[entry.key].onlineSource!.rendering!.engine }} · {{ bindings[entry.key].onlineSource!.rendering!.kind }}</p>
          <p v-if="bindings[entry.key].onlineSource?.rendering?.sourceWidth" class="muted">后端源图 {{ bindings[entry.key].onlineSource!.rendering!.sourceWidth }} × {{ bindings[entry.key].onlineSource!.rendering!.sourceHeight }} px · {{ bindings[entry.key].onlineSource!.rendering!.sourceDpi }} DPI · 不提高原始地面分辨率</p>
          <p class="muted">{{ bindings[entry.key].source }} · {{ bindings[entry.key].publishedAt || '时间未提供' }} · {{ bindings[entry.key].crs }}</p>
          <dl v-if="bindings[entry.key].onlineSource?.statistics" class="statistics"><dt>有效原始像元</dt><dd>{{ bindings[entry.key].onlineSource!.statistics!.valid }}</dd><dt>缺测像元</dt><dd>{{ bindings[entry.key].onlineSource!.statistics!.missing }}</dd><dt>原值最小／最大</dt><dd>{{ bindings[entry.key].onlineSource!.statistics!.minimum }} / {{ bindings[entry.key].onlineSource!.statistics!.maximum }}</dd></dl>
          <p v-if="bindings[entry.key].onlineSource?.statistics" class="notice">按选区内像元中心统计原始值；零值保留，缺测不作零。不推算人口总数、GDP 金额或灾损。</p>
          </template>
        </details>
      </section>
    </div></details>
    <p v-if="loaded.length" class="notice" role="status">资料状态与图件业务审核分别记录；发布前在复核页面确认当前版本。</p>
    <BackendLayerPicker ref="backendPicker" :active="active" :bounds="bounds" :busy="busy" :requirements="requirements" @assign="assignBackendLayer" />
    <BackendResultDocuments v-if="bounds" :active="active" :bounds="bounds" />
    <details class="quality missing-layers"><summary>尚未叠加与源资料 · {{ pendingRequirements.length }} 项</summary><section v-for="entry in pendingRequirements" :key="entry.key" :data-requirement-key="entry.key" tabindex="-1"><strong>{{ entry.label }}</strong><p class="muted">{{ entry.key === 'distance' ? '由真实震中与目标位置计算，不要求另交一份距离文件' : candidates[entry.key]?.length ? '后端有可用图层，请在上方叠加' : entry.key === 'dem' ? '基础地理压缩包中有等高线和高程点；当前未发布可直接上图的 DEM，源文件可从后端目录打开' : '当前查询未匹配到可直接叠加资产，可从后端目录选择；不代表后台没有数据' }}</p></section></details>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import * as mapWork from "./map"
import { workflowRequirements, workflowMissing, workflowRequiresCore, workflowName, workflowCollection, workflowAssets, matchesWorkflowItem, containsBounds, intersectBounds, scopeFingerprint, clipWorkflowVector, type WorkflowRequirement, type WorkflowStatus } from "./cartography-workflow"
import { searchRemoteItems, searchStacPage, refreshRemoteItem, remoteLayerAssets, remoteItemTitle, remoteItemTime, remoteItemNotice, remoteCatalogUnit, remoteBounds, remoteVector, remotePoint, remoteHeightPoint, remoteItemPath, type RemotePoint, type RemoteItem } from "./remote-cartography-source"
import { readCartographyWindow, type SourceWindowOptions } from "./cartography-source-window"
import { backendDisplay, backendRange, classifiedDisplay, backendRenderPlan, backendRasterLayer, backendMapLayer } from "./cartography-backend-render"
import type { DbtLayer } from "./dbt116-standard"
import { remoteReferenceStyle } from "./remote-reference-style"
import { backendResultFields, presentBackendResult, type BackgroundDisplay } from "./backend-result-layers"
import BackendResultDocuments from "./BackendResultDocuments.vue"
import BackendLayerPicker from "./BackendLayerPicker.vue"
import { supplementalItem, presentSupplementalVector, supplementalAssetBounds, isEmptyScopedVector, EmptyScopedVectorError, supplementalSheetKeys, mergeSupplementalSheets } from "./supplemental-cartography"
import { layerCoverageGaps, needsCoverageCheck } from "./cartography-coverage"
import { layerGeographicLabels } from "./cartography-labels"
import { readBackendEventVector, layerEventParameters, eventParametersAsset } from "./backend-event-parameters"
import { compositionSymbolImage } from "./composition-symbols"
import CartographyLegendSwatch from "./CartographyLegendSwatch.vue"
import { mapPublicationHash } from "./result-map-publication"
import { expressionLayer, bindExpressionFields } from "./expression-presentation"
import type { BusinessMapResult } from "./business-map-data"
import { inspectScopedCatalog, contentBindings, type ContentBinding } from "./backend-content-routing"
import { inspectJsonContent, recommendExpression, prepareContentDocument } from "./content-routing"
import { selectContentRole } from "./content-role-selection"
import LayerStyleEditor from "./LayerStyleEditor.vue"
import LayerAnalysisTools from "./LayerAnalysisTools.vue"
import { layerStyleDocument } from "./layer-style-options"
import { renderTemplateDocument, type TemplateOptions } from "./template-renderer"
import { businessResult } from "./business-map-data"
import ProductRequirements from "./ProductRequirements.vue"
import { isAssessmentKind } from "./assessment-products"
import { imageryPairs, comparisonBounds, type ImageryComparison } from "./imagery-comparison"

const props = withDefaults(defineProps<{ topic: string; bounds: mapWork.RectInfo | null; active: boolean; composeReady?: boolean; autoMatch?: boolean }>(), { composeReady: true, autoMatch: false })
const emit = defineEmits<{ change: [layers: DbtLayer[], bounds: mapWork.RectInfo | null]; compose: []; "view-map": []; "expression-input-ready": []; "generate-expression": [] }>()
const contentChoices = shallowRef<Record<string, ContentBinding[]>>({})
const matchedRequirements = computed(() => requirements.value.filter(entry => contentChoices.value[entry.key]?.length))
const generating = ref(false)
const coreMissing = computed(() => workflowRequiresCore(props.topic) ? workflowMissing(props.topic, [...matchedRequirements.value.map(entry => entry.key), ...loaded.value.filter(layer => layer.enabled !== false && !layer.onlineSource?.rendering?.parameters?.inputOnly).map(layer => layer.id.replace(/^online:/, ""))]) : [])
const coreMatchesReady = computed(() => !coreMissing.value.length)
const generateLabel = computed(() => { if (generating.value) { return "正在叠加图层" }; return coreMatchesReady.value || !matchedRequirements.value.length ? "生成专题效果" : "显示参考资料" })
const contentTopics = computed(() => matchedRequirements.value.filter(entry => entry.group === "topic"))
const contentTopic = ref("")
function itemDate(item: RemoteItem) { const date = String(item.properties["grid:year"] || item.properties.datetime || ""); return /^\d{4}(?:$|-\d{2}-\d{2})/.test(date) ? date.slice(0, 10) : "" }
const topicDates = computed(() => [...new Set((contentChoices.value[contentTopic.value] || []).map(source => itemDate(source.item)).filter(Boolean))].sort().reverse())
const topicDate = computed(() => { const item = currentItem(contentTopic.value); return item ? itemDate(item) : "" })
function changeTopicDate(date: string) {
  const choice = contentChoices.value[contentTopic.value]?.find(source => itemDate(source.item) === date)
  if (!choice) { return }
  changeItem(contentTopic.value, candidateKey(contentTopic.value, choice.item)); changeAsset(contentTopic.value, choice.asset.key)
}
const contentProblems = ref<string[]>([])
const manualItems = shallowRef<Record<string, RemoteItem>>({})
const referenceRequirement: WorkflowRequirement = { key: "catalog-reference", label: "其他参考图层", role: "business", group: "optional", note: "由后端目录选择的真实资产，保留源数据语义" }
const requirements = computed(() => [...workflowRequirements(props.topic), ...(manualItems.value[referenceRequirement.key] ? [referenceRequirement] : [])])
const root = ref<HTMLElement>()
const backendPicker = ref<InstanceType<typeof BackendLayerPicker>>()
function openDataPreparation(key?: string) { backendPicker.value?.open(key || requirements.value.find(entry => entry.group === "required" && !bindings.value[entry.key])?.key) }
function focusRequirement(keys: string[]) {
  if (keys.some(key => bindings.value[key]?.onlineSource?.rendering?.parameters?.inputOnly)) { emit("expression-input-ready"); return }
  const missing = keys.find(key => !candidates.value[key]?.length && requirements.value.some(entry => entry.key === key && entry.adapter))
  if (missing) { openDataPreparation(missing); return }
  const sections = Array.from(root.value?.querySelectorAll<HTMLElement>("[data-requirement-key]") || [])
  const target = keys.map(key => sections.find(section => section.dataset.requirementKey === key)).find(Boolean)
  if (!target) { status.value = "当前专题未配置该类业务图层" }
  const details = target?.closest("details") || root.value?.querySelector<HTMLDetailsElement>(".missing-layers")
  if (details) { details.open = true }
  const destination = target || details?.querySelector<HTMLElement>("summary")
  destination?.focus({ preventScroll: true }); destination?.scrollIntoView({ block: "center", behavior: "smooth" })
}
const availableRequirements = computed(() => requirements.value.filter(entry => entry.adapter || manualItems.value[entry.key] || contentChoices.value[entry.key]?.length))
const hasAdapters = computed(() => requirements.value.some(entry => entry.adapter))
const candidates = shallowRef<Record<string, RemoteItem[]>>({}); const selected = ref<Record<string, string>>({}); const assetKeys = ref<Record<string, string>>({})
const options = ref<Record<string, SourceWindowOptions>>({}); const states = ref<Record<string, WorkflowStatus>>({}); const messages = ref<Record<string, string>>({})
const sourceDpi = ref<Record<string, number>>({})
const vectorFields = ref<Record<string, string>>({})
const backgroundDisplays = ref<Record<string, BackgroundDisplay>>({})
function backgroundNote(layer: DbtLayer) { return (layer.data as any)?.metadata?.backendResultPresentation?.note || "" }
async function changeBackgroundDisplay(key: string, value: string) {
  const entry = requirements.value.find(entry => entry.key === key)
  if (!entry || !["grid", "fill"].includes(value)) { return }
  backgroundDisplays.value[key] = value as BackgroundDisplay
  await render(entry)
}
const heightValues = ref<Record<string, RemotePoint>>({})
const pointValues = ref<Record<string, RemotePoint>>({})
const fixedStyles = ref<Record<string, SourceWindowOptions>>({})
const cursors = ref<Record<string, string>>({})
const bindings = shallowRef<Record<string, DbtLayer>>({}); const loaded = computed(() => Object.values(bindings.value)); const pendingRequirements = computed(() => requirements.value.filter(entry => !bindings.value[entry.key]))
const items = computed(() => Object.values(candidates.value).flat())
const styleKey = ref("")
const toolsBusy = ref(false)
const analysisTools = ref<InstanceType<typeof LayerAnalysisTools>>()
function clearAnalysisPreview() { analysisTools.value?.clearPreview() }
const styleLayer = computed(() => bindings.value[styleKey.value])
const orderedLayers = computed(() => [...loaded.value].sort((a, b) => (b.order ?? 0) - (a.order ?? 0)))
function layerKey(layer: DbtLayer) { return Object.keys(bindings.value).find(key => bindings.value[key].id === layer.id)! }
function moveLayer(layer: DbtLayer, direction: number) {
  const list = [...orderedLayers.value]; const index = list.findIndex(entry => entry.id === layer.id); const next = index + direction
  if (next < 0 || next >= list.length) { return }
  ;[list[index], list[next]] = [list[next], list[index]]
  list.forEach((entry, i) => presentation(layerKey(entry), { order: list.length - i }))
}
async function openLayerStyle(key: string) {
  styleKey.value = key
  if (!bindings.value[key]?.raster) { await nextTick(); root.value?.querySelector<HTMLElement>('[aria-label="图层符号化与渲染"]')?.scrollIntoView?.({ block: "start", behavior: "smooth" }); return }
  focusRequirement([key])
  const section = root.value?.querySelector<HTMLElement>(`[data-requirement-key="${key}"]`)
  const settings = section?.querySelector<HTMLDetailsElement>(".render-style")
  if (settings) { settings.open = true; settings.scrollIntoView({ block: "center" }) }
}
async function restoreLayerStyle() { const entry = requirements.value.find(entry => entry.key === styleKey.value); if (entry) { await render(entry) } }
async function applyLayerStyle(kind: string, options: TemplateOptions) {
  const key = styleKey.value; const layer = bindings.value[key]
  if (busy.value || generating.value || !props.bounds || !props.active || !layer) { return }
  const ticket = revision; const scope = { ...props.bounds }; const controller = new AbortController(); request = controller; busy.value = true; error.value = ""
  try {
    const original = layerStyleDocument(layer)
    const scene = renderTemplateDocument(kind, bindExpressionFields(original, options), scope, options)
    const result = await businessResult(original, scene, scope, options)
    controller.signal.throwIfAborted()
    if (ticket !== revision || bindings.value[key] !== layer) { return }
    await mapWork.renderTemplateScene(scene, options.radius, controller.signal, key)
    if (ticket !== revision || bindings.value[key] !== layer) { return }
    bindings.value = { ...bindings.value, [key]: expressionLayer(layer, result) }
    mapWork.updateWorkflowPresentation(key, bindings.value[key]); publish()
    status.value = `${layer.name}表达已更新，其他图层保持不变。`
  } catch (err) { if (ticket === revision && !controller.signal.aborted) { error.value = err instanceof Error ? err.message : "图层表达失败" } } finally { if (ticket === revision) { busy.value = false } }
}
async function addAnalysisLayer(source: DbtLayer, result: BusinessMapResult) {
  if (busy.value || !props.bounds || scopeFingerprint(result.bounds) !== scopeFingerprint(props.bounds)) { return }
  const sourceKey = layerKey(source); const snapshot = sourceSnapshots.get(sourceKey)
  if (!snapshot) { error.value = "输入图层已变化，请重新执行分析"; return }
  const key = `derived:${source.id}:${result.scene.kind}`; const ticket = revision; const controller = new AbortController(); request = controller; busy.value = true
  try {
    await mapWork.renderTemplateScene(result.scene, result.options.radius, controller.signal, key)
    if (ticket !== revision) { return }
    const layer = expressionLayer({ ...source, id: `online:${key}`, role: "business", name: `${workflowName(result.scene.kind)} · ${source.name}`, order: 90 }, result)
    sourceSnapshots.set(key, snapshot); bindings.value = { ...bindings.value, [key]: layer }; mapWork.updateWorkflowPresentation(key, layer); publish(); status.value = "分析结果已加入地图，原始输入图层保持不变。"
  } catch (err) { if (!controller.signal.aborted) { error.value = err instanceof Error ? err.message : "分析结果未能加入地图" } } finally { if (ticket === revision) { busy.value = false } }
}
type ProofInput = { item: RemoteItem; asset: ReturnType<typeof remoteLayerAssets>[number]; scope: mapWork.RectInfo; plan: ReturnType<typeof backendRenderPlan>; mapFingerprint: string }
const proofInputs = new Map<string, ProofInput>()
const sourceSnapshots = new Map<string, RemoteItem>()
const busy = ref(false); const error = ref(""); const status = ref(""); const savedTask = ref(false)
let request: AbortController | undefined; let revision = 0; let disposed = false
const storageKey = "mars3d.cartography.workflow.v1"
const stateLabels: Record<WorkflowStatus, string> = { pending: "待查询", loading: "读取中", empty: "未匹配到该类图层", failed: "读取失败", unverified: "已渲染 · 待核验" }
function stateLabel(key: string) {
  if (!requirements.value.find(r => r.key === key)?.adapter && !manualItems.value[key]) { return "可从后端目录选择" }
  if (states.value[key] === "pending" && candidates.value[key]?.length) { return "可叠加" }
  if (states.value[key] === "unverified" && requirements.value.find(r => r.key === key)?.adapter === "business-vector") { return bindings.value[key]?.onlineSource?.rendering?.parameters?.expression ? "已应用表达方法" : "已读取 · 待应用表达方法" }
  if (states.value[key] === "unverified" && coverageGapCount(key)) { return "部分覆盖 · 需补图幅" }
  return stateLabels[states.value[key] || "pending"]
}
function candidateKey(key: string, item: RemoteItem) { return props.autoMatch || requirements.value.find(r => r.key === key)?.adapter === "business-vector" ? JSON.stringify([item.collection, item.id]) : item.id }
function currentItem(key: string) { return candidates.value[key]?.find(item => candidateKey(key, item) === selected.value[key]) }
function selectedImageryPair() {
  const before = contentChoices.value["imagery-before"] || []; const after = contentChoices.value["imagery-after"] || []
  const selectedSource = (key: string, source: (typeof before)[number]) => candidateKey(key, source.item) === selected.value[key] && source.asset.key === assetKeys.value[key]
  return imageryPairs([...before.filter(source => selectedSource("imagery-before", source)), ...after.filter(source => selectedSource("imagery-after", source))]).find(pair => selectedSource("imagery-before", pair.before as (typeof before)[number]) && selectedSource("imagery-after", pair.after as (typeof before)[number]))
}
function searchCollection(collection: string, bounds: mapWork.RectInfo, signal: AbortSignal, token?: string) {
  return collection === "*" ? searchStacPage({ bbox: [bounds.west, bounds.south, bounds.east, bounds.north], limit: 50 }, signal, token) : searchRemoteItems(collection, bounds, signal, token)
}
function rejectedCount(key: string) { return Number((bindings.value[key]?.data as { metadata?: Record<string, any> })?.metadata?.rejectedCount || 0) }
function normalizedCount(key: string) { return Number((bindings.value[key]?.data as { metadata?: Record<string, any> })?.metadata?.normalizedFeatures?.length || 0) }
function coverageGapCount(key: string) { const layer = bindings.value[key]; return props.bounds && layer && needsCoverageCheck(layer) ? layerCoverageGaps(layer, props.bounds).length : 0 }
function assessmentWarning(key: string) { return String((bindings.value[key]?.data as { metadata?: Record<string, any> })?.metadata?.assessmentWarning || "") }
function eventParameters(key: string) { return bindings.value[key] ? layerEventParameters([bindings.value[key]]) : undefined }
function isTemperature(key: string) { const item = currentItem(key); const asset = currentAsset(key); return !!item && !!asset && backendDisplay(item, asset) === "temperature" }
function assetsFor(key: string) {
  const item = currentItem(key); const entry = requirements.value.find(entry => entry.key === key)
  if (!item || !entry) { return [] }
  if (entry.adapter === "event-parameters") { return eventParametersAsset(item) }
  const choices = contentChoices.value[key]?.filter(source => source.item.collection === item.collection && source.item.id === item.id)
  if (choices?.length) { return choices.map(source => source.asset) }
  if (manualItems.value[key]) { return remoteLayerAssets(item) }
  if (!entry.adapter) { return [] }
  const assets = workflowAssets(item, entry.adapter, props.bounds)
  if (item.id !== "SP-swchina-basegeo-250k" || assets.length < 2) { return assets }
  return [{ ...assets[0], title: `${entry.label} · 自动拼接 ${assets.length} 幅已发布图幅` }]
}
function currentAsset(key: string) { return assetsFor(key).find(asset => asset.key === assetKeys.value[key]) }
function isClassified(key: string) { const item = currentItem(key); const asset = currentAsset(key); return !!item && !!asset && classifiedDisplay(item, asset, props.topic) }
function displayLabel(key: string) {
  const item = currentItem(key); const asset = currentAsset(key)
  if (!item || !asset) { return "未选择资产" }
  if (props.topic === "raster-threshold") { return "原值阈值二分类 · 非业务预警结论" }
  if (isClassified(key)) { return "分级设色" }
  return ({ rgb: "真彩色", preset: "后台预设设色", surface: "后台三维成果设色（平面参考）", reflectance: "反射率灰度", brightness: "亮温色带（非地表温度）", temperature: "地表温度原值连续色带（单位待核验）", population: "人口连续色带", economy: "经济连续色带", rate: "形变速率发散色带", scalar: "原值灰度拉伸" })[backendDisplay(item, asset)]
}
function publish() { emit("change", loaded.value, props.bounds ? { ...props.bounds } : null) }
function setExpression(result: BusinessMapResult) {
  const entry = Object.entries(bindings.value).find(([, layer]) => layer.id === result.document.metadata.onlineLayerId)
  if (!entry || scopeFingerprint(result.bounds) !== scopeFingerprint(props.bounds)) { throw new Error("专题来源或范围已改变，请重新读取并渲染") }
  bindings.value = { ...bindings.value, [entry[0]]: expressionLayer(entry[1], result) }; status.value = "专题效果已生成，可查看地图或进入排版校样。"; publish()
}
function invalidateExpression() {
  let changed = false
  const next = { ...bindings.value }
  for (const [key, layer] of Object.entries(next)) {
    if (!layer.onlineSource?.rendering?.parameters?.expression) { continue }
    next[key] = { ...layer, legend: [], onlineSource: { ...layer.onlineSource, rendering: { engine: "未渲染", kind: "业务要素已读取，表达方法待应用", parameters: { inputOnly: true } } } }; changed = true
  }
  if (changed) { bindings.value = next; publish() }
}
function lockClasses(key: string) {
  const source = bindings.value[key]?.onlineSource
  if (!source?.rendering?.classBreaks?.length || source.statistics?.minimum == null) { return }
  const minimum = source.statistics.minimum; const last = source.rendering.classBreaks.at(-1)!
  options.value[key] = { ...options.value[key], automatic: false, minimum, maximum: last > minimum ? last : minimum + Math.max(1, Math.abs(minimum) * Number.EPSILON * 2), fixedBreaks: [...source.rendering.classBreaks] }
  fixedStyles.value[key] = options.value[key]
  status.value = "分级断点已固定；重新渲染时不按当前选区重算，界外值归入首尾级。"
}
function unlockClasses(key: string) { delete fixedStyles.value[key]; delete options.value[key].fixedBreaks; options.value[key].automatic = true; invalidate(key) }
function presentation(key: string, value: { opacity?: number; enabled?: boolean; order?: number }) {
  const layer = bindings.value[key]
  if (!layer) { return }
  bindings.value = { ...bindings.value, [key]: { ...layer, ...value } }
  mapWork.updateWorkflowPresentation(key, bindings.value[key]); publish()
}
function invalidate(key: string) { delete pointValues.value[key]; delete heightValues.value[key]; sourceSnapshots.delete(key); proofInputs.delete(key); mapWork.clearWorkflowLayers(key); const next = { ...bindings.value }; delete next[key]; bindings.value = next; states.value[key] = "pending"; publish() }
function changeDpi(key: string, dpi: number) {
  sourceDpi.value[key] = dpi
  const layer = bindings.value[key]; const input = proofInputs.get(key)
  if (!layer?.raster || !layer.onlineSource || !input) { return }
  const rendering = { ...layer.onlineSource.rendering, proofUrl: undefined, proofUrls: undefined, sourceWidth: undefined, sourceHeight: undefined, sourceDpi: undefined }
  bindings.value = { ...bindings.value, [key]: { ...layer, raster: { ...layer.raster, image: "" }, onlineSource: { ...layer.onlineSource, fingerprint: input.mapFingerprint, rendering } } }; publish()
}
function changeAsset(key: string, value: string) { invalidate(key); if (props.topic === "imagery-comparison") { invalidate(key === "imagery-before" ? "imagery-after" : "imagery-before") }; assetKeys.value[key] = value; const asset = currentAsset(key); const item = currentItem(key); const range = asset && item && asset.numeric ? backendRange(item, asset) : [0, 1]; options.value[key] = { band: 1, minimum: range[0], maximum: range[1], automatic: isClassified(key) || isTemperature(key), method: "quantile", count: 5, ...(isClassified(key) ? fixedStyles.value[key] : {}) } }
function changeBand(key: string, band: number) { invalidate(key); const range = backendRange(currentItem(key)!, currentAsset(key)!, band); Object.assign(options.value[key], { band, minimum: range[0], maximum: range[1] }) }
function changeItem(key: string, value: string) { selected.value[key] = value; const item = currentItem(key); if (props.autoMatch && item) { manualItems.value = { ...manualItems.value, [key]: item } }; vectorFields.value[key] = item ? backendResultFields(item)[0]?.key || "" : ""; changeAsset(key, assetsFor(key)[0]?.key || "") }
function reset() { revision++; request?.abort(); busy.value = false; generating.value = false; contentChoices.value = {}; contentProblems.value = []; manualItems.value = {}; pointValues.value = {}; heightValues.value = {}; sourceSnapshots.clear(); proofInputs.clear(); mapWork.clearWorkflowLayers(); candidates.value = {}; cursors.value = {}; selected.value = {}; assetKeys.value = {}; options.value = {}; sourceDpi.value = {}; vectorFields.value = {}; backgroundDisplays.value = {}; states.value = {}; messages.value = {}; bindings.value = {}; error.value = ""; status.value = ""; publish() }
async function assignBackendLayer(value: { item: RemoteItem; asset: string; key: string }) {
  if (busy.value || !props.active || !props.bounds) { return }
  manualItems.value = { ...manualItems.value, [value.key]: value.item }
  candidates.value = { ...candidates.value, [value.key]: [value.item] }
  changeItem(value.key, candidateKey(value.key, value.item)); changeAsset(value.key, value.asset)
  const entry = requirements.value.find(entry => entry.key === value.key)
  if (entry) { await render(entry) }
}
async function queryPoint(key: string, height = false) {
  const item = currentItem(key); const bounds = props.bounds
  if (!item || !bounds || busy.value || !props.active) { return }
  const ticket = revision; const controller = new AbortController(); request = controller; busy.value = true; error.value = ""
  try {
    const longitude = (bounds.west + bounds.east) / 2; const latitude = (bounds.south + bounds.north) / 2
    const asset = currentAsset(key)
    if (!height && !asset) { return }
    const value = height ? await remoteHeightPoint(item, longitude, latitude, controller.signal) : await remotePoint(item, asset!, options.value[key].band, longitude, latitude, controller.signal)
    if (ticket === revision && !disposed && props.active) { (height ? heightValues : pointValues).value[key] = value }
  } catch (err) { if (ticket === revision && !controller.signal.aborted) { error.value = err instanceof Error ? err.message : "后台点查失败" } } finally { if (ticket === revision) { busy.value = false } }
}
watch([() => props.topic, () => scopeFingerprint(props.bounds)], reset)
watch(() => props.topic, () => { fixedStyles.value = {} }, { flush: "sync" })
watch(() => props.active, active => { if (!active) { reset() } })
watch([() => props.topic, () => scopeFingerprint(props.bounds), () => props.active], () => {
  if (props.active && props.bounds && hasAdapters.value) { queryAll().catch(err => { error.value = err instanceof Error ? err.message : "图层查询失败" }) }
}, { immediate: true })
async function queryAll() {
  if (!props.active || !props.bounds || busy.value) { return }
  if (props.autoMatch) { await matchContent(); return }
  const previous = { ...selected.value }; reset(); const token = revision; const scope = { ...props.bounds }; const controller = new AbortController(); request = controller
  busy.value = true
  try {
    const collections = [...new Set(requirements.value.flatMap(r => r.adapter ? [workflowCollection(r.adapter)] : []))]
    let anyFailure = false
    for (const collection of collections) {
      controller.signal.throwIfAborted()
      try {
        const result = await searchCollection(collection, scope, controller.signal)
        if (disposed || token !== revision || !props.active) { return }
        if (result.nextToken) { cursors.value[collection] = result.nextToken }
        for (const entry of requirements.value.filter(r => r.adapter && workflowCollection(r.adapter) === collection)) {
          const items = result.items.filter(item => matchesWorkflowItem(item, entry.adapter!) && workflowAssets(item, entry.adapter!, scope).length && intersectBounds(scope, remoteBounds(item.bbox))).sort((a, b) => a.id.localeCompare(b.id))
          candidates.value = { ...candidates.value, [entry.key]: items }; states.value[entry.key] = items.length ? "pending" : "empty"
          if (items.length) { changeItem(entry.key, items.some(i => candidateKey(entry.key, i) === previous[entry.key]) ? previous[entry.key] : candidateKey(entry.key, items[0])) }
          messages.value[entry.key] = items.length ? "" : "本次查询未自动匹配到该类数据；后端目录仍可选择。"
          if (result.hasMore) { messages.value[entry.key] = "目录结果尚未完整，请缩小范围或补齐检索分页；未查询到不等于没有数据。" }
        }
      } catch (err) {
        if (controller.signal.aborted || token !== revision) { return }
        anyFailure = true
        for (const entry of requirements.value.filter(r => r.adapter && workflowCollection(r.adapter) === collection)) { states.value[entry.key] = "failed"; messages.value[entry.key] = err instanceof Error ? err.message : "后端读取失败" }
      }
    }
    const configured = requirements.value.filter(entry => entry.adapter).length
    const available = Object.values(candidates.value).filter(items => items.length).length
    if (anyFailure) { status.value = "部分图层加载失败，请重试。" } else if (available) { status.value = `已找到 ${available} 类可用图层。` } else { status.value = configured ? "本次查询未自动匹配专题图层。" : "尚未选择专题图层。" }
  } finally { if (token === revision) { busy.value = false } }
}
async function matchContent() {
  reset(); const ticket = revision; const scope = { ...props.bounds! }; const controller = new AbortController(); request = controller; busy.value = true
  const timer = setTimeout(() => controller.abort(), 150000)
  try {
    const catalog = await inspectScopedCatalog(scope, controller.signal, text => { if (ticket === revision) { status.value = text } })
    if (disposed || ticket !== revision || !props.active) { return }
    contentProblems.value = catalog.problems
    const business = requirements.value.find(entry => entry.adapter === "business-vector")
    const businessFingerprints = new Set(business ? contentBindings(catalog, business, props.topic).slice(0, 1).map(source => source.fingerprint) : [])
    const intensityRequirement = requirements.value.find(entry => entry.adapter === "assessment-intensity")
    const intensitySource = intensityRequirement ? contentBindings(catalog, intensityRequirement, props.topic)[0] : undefined
    for (const entry of requirements.value) {
      let choices = contentBindings(catalog, entry, props.topic)
      if (entry.adapter !== "business-vector" && entry.group === "optional") { choices = choices.filter(source => !businessFingerprints.has(source.fingerprint)) }
      if (entry.adapter === "event-parameters" && intensitySource) {
        const related = choices.filter(source => source.item.collection === intensitySource.item.collection && source.item.id === intensitySource.item.id)
        if (related.length) { choices = related }
      }
      contentChoices.value = { ...contentChoices.value, [entry.key]: choices }
      const unique = [...new Map(choices.map(source => [candidateKey(entry.key, source.item), source.item])).values()]
      candidates.value = { ...candidates.value, [entry.key]: unique }; states.value[entry.key] = choices.length ? "pending" : "empty"
      if (!choices.length) { continue }
      manualItems.value = { ...manualItems.value, [entry.key]: choices[0].item }
      changeItem(entry.key, candidateKey(entry.key, choices[0].item)); changeAsset(entry.key, choices[0].asset.key)
      messages.value[entry.key] = choices[0].evidence.join("；")
    }
    contentTopic.value = contentTopics.value[0]?.key || ""
    status.value = matchedRequirements.value.length ? `已按数据内容匹配 ${matchedRequirements.value.length} 类资料，可直接生成专题效果。` : "当前范围没有满足此模板的资料；请保留模板并补齐对应数据，不使用底图或编号代替指标。"
    if (matchedRequirements.value.length && !coreMatchesReady.value) { status.value = `已匹配 ${matchedRequirements.value.length} 类参考资料；本产品核心成果尚未匹配，可显示参考地图，不能作为本产品出图。` }
    if (props.topic === "imagery-comparison" && !matchedRequirements.value.length) { status.value = "当前范围尚未匹配可比的前后两期RGB影像；需核对事件时间、配准依据、分辨率、波段和处理级别。" }
    if (!catalog.complete || catalog.problems.length) { status.value += " 部分目录或文件尚未完成读取，未匹配项不等于后台没有数据。" }
  } catch (err) { if (ticket === revision) { const message = err instanceof Error ? err.message : "数据内容识别失败"; error.value = controller.signal.aborted ? "数据内容识别已取消或超时，请重试" : message } } finally { clearTimeout(timer); if (ticket === revision) { busy.value = false } }
}
async function generateMatched() {
  if (busy.value || generating.value || !props.active) { return }
  if (props.topic === "imagery-comparison" && !selectedImageryPair()) { error.value = "尚无可比的灾前灾后两期影像：需事件时间、配准依据、相同分辨率、波段与处理级别"; return }
  const ticket = revision; generating.value = true
  try {
    for (const entry of matchedRequirements.value) {
      if (entry.group === "topic" && entry.key !== contentTopic.value) { continue }
      if (ticket !== revision || disposed || !props.active) { return }
      await render(entry)
    }
    const failed = matchedRequirements.value.filter(entry => states.value[entry.key] === "failed" || states.value[entry.key] === "empty")
    if (failed.length) { error.value = failed.map(entry => `${entry.label}：${messages.value[entry.key] || "选区内没有适用要素"}`).join("；") }
    if (ticket === revision && requirements.value.some(entry => entry.adapter === "business-vector" && bindings.value[entry.key])) { emit("generate-expression") }
  } finally { generating.value = false }
}
async function more(collection: string) {
  if (busy.value || !props.active || !props.bounds || !cursors.value[collection]) { return }
  const ticket = revision; const controller = new AbortController(); request = controller; busy.value = true; error.value = ""
  try {
    const result = await searchCollection(collection, props.bounds, controller.signal, cursors.value[collection])
    if (ticket !== revision || disposed || !props.active) { return }
    for (const entry of requirements.value.filter(r => r.adapter && workflowCollection(r.adapter) === collection)) {
      const existing = candidates.value[entry.key] || []
      const found = result.items.filter(item => matchesWorkflowItem(item, entry.adapter!) && workflowAssets(item, entry.adapter!, props.bounds).length && intersectBounds(props.bounds!, remoteBounds(item.bbox)))
      const merged = [...new Map([...existing, ...found].map(item => [candidateKey(entry.key, item), item])).values()]
      if (merged.length > 1000) { throw new Error("候选超过 1000 条，请缩小范围或增加后端筛选") }
      candidates.value = { ...candidates.value, [entry.key]: merged }
      if (!selected.value[entry.key] && merged.length) { changeItem(entry.key, candidateKey(entry.key, merged[0])) }
      messages.value[entry.key] = result.hasMore ? "目录尚有后续记录，未读取到不等于不存在。" : "当前检索分页已读取完成。"
    }
    delete cursors.value[collection]
    if (result.nextToken) { cursors.value[collection] = result.nextToken }
    status.value = result.hasMore && !result.nextToken ? "后台有后续页但未提供可用分页令牌，当前不是完整目录。" : "已追加后端数据目录。"
  } catch (err) { if (ticket === revision) { error.value = err instanceof Error ? err.message : "分页读取失败" } } finally { if (ticket === revision) { busy.value = false } }
}
async function render(entry: WorkflowRequirement) {
  if (busy.value || !props.active || !props.bounds) { return }
  const candidate = currentItem(entry.key); const chosen = currentAsset(entry.key)
  if (!candidate || !chosen || (!entry.adapter && !manualItems.value[entry.key])) { return }
  invalidate(entry.key); const token = revision; const scope = { ...props.bounds }; const controller = new AbortController(); request = controller
  busy.value = true; states.value[entry.key] = "loading"; error.value = ""
  const timer = setTimeout(() => controller.abort(), 150000)
  try {
    const item = await refreshRemoteItem(candidate, controller.signal)
    if (props.topic === "imagery-comparison" && await mapPublicationHash(item) !== await mapPublicationHash(candidate)) { throw new Error("影像目录版本已变化，请刷新可用图层后重新核对两期资料") }
    const manual = !!manualItems.value[entry.key]
    if (!manual && (!entry.adapter || !matchesWorkflowItem(item, entry.adapter))) { throw new Error("条目结构或资产类型已变化，请重新查询") }
    let availableAssets = manual ? remoteLayerAssets(item) : workflowAssets(item, entry.adapter!, scope)
    if (entry.adapter === "event-parameters") { availableAssets = eventParametersAsset(item) }
    let asset = availableAssets.find(a => a.key === chosen.key)
    if (asset && props.autoMatch) { asset = contentChoices.value[entry.key]?.find(source => source.item.collection === item.collection && source.item.id === item.id && source.asset.key === chosen.key)?.asset || asset }
    if (!asset) { throw new Error("数据资产已变化，请重新查询") }
    if (entry.adapter === "business-vector" && asset.kind !== "vector") { throw new Error("本产品需要带真实要素与属性的矢量资料；栅格可作为参考图层加载，不能直接绑定为业务字段") }
    const pair = props.topic === "imagery-comparison" ? selectedImageryPair() : undefined
    if (props.topic === "imagery-comparison" && !pair) { throw new Error("两期影像不满足事件前后、配准及指标一致性，请重新匹配") }
    const comparison: ImageryComparison | undefined = pair ? { ...pair.comparison, side: entry.key === "imagery-before" ? "before" : "after" } : undefined
    const displayScope = comparisonBounds(scope, comparison)
    let raw: Awaited<ReturnType<typeof readCartographyWindow>> | null = null
    let statisticsNotice = ""
    if (asset.kind === "raster" && asset.numeric) {
      try { raw = await readCartographyWindow(item, asset, scope, { ...options.value[entry.key], statisticsOnly: true }, controller.signal) } catch (err) {
        if (err instanceof Error && err.message.includes("100 万") && !classifiedDisplay(item, asset, props.topic)) { statisticsNotice = "选区超过原始像元统计上限，仅加载后台瓦片，未生成选区统计。" } else { throw err }
      }
    }
    const plan = asset.kind === "raster" ? backendRenderPlan(item, asset, props.topic, options.value[entry.key], raw) : null
    if (plan?.kind === "temperature" && options.value[entry.key].automatic !== false) { options.value[entry.key].minimum = plan.params.minimum; options.value[entry.key].maximum = plan.params.maximum }
    const raster = plan ? await backendMapLayer(item, asset, displayScope, plan, controller.signal) : null
    const eventSource = entry.adapter === "event-parameters"
    const sourceUrl = eventSource ? `http://192.168.10.15:5951${remoteItemPath(item)}` : item.assets[asset.key].href
    const fromSupplement = supplementalItem(item) && !eventSource
    let vector = eventSource ? readBackendEventVector(item, scope) : null
    const sheetKeys = fromSupplement ? supplementalSheetKeys(item, asset.key, scope) : [asset.key]
    if (!eventSource && asset.kind === "vector") {
      const documents = []
      for (const key of sheetKeys) {
        const part = remoteLayerAssets(item).find(a => a.key === key)!
        try { documents.push(await remoteVector(item, part, controller.signal, scope)) } catch (err) { if (!isEmptyScopedVector(err)) { throw err } }
      }
      if (!documents.length) { throw new EmptyScopedVectorError("后台图幅已读取，但当前选区内没有对应要素") }
      vector = fromSupplement && item.id === "SP-swchina-basegeo-250k" ? mergeSupplementalSheets(documents, sheetKeys, item) : documents[0]
    }
    if (vector && !fromSupplement && !eventSource) { vector = clipWorkflowVector(vector, scope) }
    if (vector && props.autoMatch && contentChoices.value[entry.key]?.length) { vector = selectContentRole(vector, entry.adapter || entry.key) }
    if (vector && entry.adapter === "business-vector" && props.autoMatch) {
      const recommendation = recommendExpression(inspectJsonContent(vector), props.topic)
      // Reading an input is not a product approval; field and semantic checks run before expression rendering.
      if (recommendation) { vector = prepareContentDocument(vector, recommendation, contentChoices.value[entry.key]?.find(source => source.item.id === item.id && source.asset.key === asset.key)?.fingerprint || "", props.topic) }
    }
    if (entry.adapter === "business-vector" && !vector) { throw new Error("本产品需要带真实要素与属性的矢量资料；栅格可作为参考图层加载，不能直接绑定为业务字段") }
    if (vector && !vector.features.length) { throw new Error("目录覆盖框相交，但选区内没有真实矢量要素") }
    const inputOnly = entry.adapter === "business-vector"
    const assessmentScene = entry.adapter === "assessment-product" && vector && isAssessmentKind(props.topic) ? renderTemplateDocument(props.topic, vector, scope) : null
    const resultStyle = !inputOnly && vector && backendResultFields(item).length ? presentBackendResult(item, vector, vectorFields.value[entry.key], backgroundDisplays.value[entry.key]) : null
    if (resultStyle) { vector = resultStyle.document }
    const supplementalStyle = !inputOnly && vector && fromSupplement ? presentSupplementalVector(item, asset.key, vector) : null
    if (supplementalStyle) { vector = supplementalStyle.document }
    controller.signal.throwIfAborted()
    if (disposed || token !== revision || !props.active) { return }
    const fingerprint = raster?.fingerprint || Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ item, vector, scope })))), b => b.toString(16).padStart(2, "0")).join("")
    controller.signal.throwIfAborted()
    if (disposed || token !== revision || !props.active) { return }
    let tileError = ""
    const onError = (message: string) => {
      if (disposed || token !== revision || !props.active) { return }
      tileError = message; mapWork.clearWorkflowLayers(entry.key)
      sourceSnapshots.delete(entry.key)
      const next = { ...bindings.value }; delete next[entry.key]; bindings.value = next
      states.value[entry.key] = "failed"; messages.value[entry.key] = message; publish()
    }
    const vectorStyle = vector ? remoteReferenceStyle({ collection: item.collection, itemId: item.id }) : undefined
    const labels = (supplementalStyle || eventSource || resultStyle) && vector ? layerGeographicLabels({ id: `online:${entry.key}`, name: entry.label, role: entry.role, data: vector, authority: "", source: sourceUrl, publishedAt: "", crs: "EPSG:4326", security: "", scale: 0 }) : undefined
    const eventSymbol = eventSource ? { type: "billboard", styleOptions: { image: compositionSymbolImage("dbt-current-epicenter", "#202020"), width: 28, height: 28, clampToGround: true } } : undefined
    if (!inputOnly && !assessmentScene) { await mapWork.showWorkflowLayer(entry.key, { name: `${entry.label} · ${remoteItemTitle(item)}`, raster: raster?.raster, document: supplementalStyle?.mapDocument || vector || undefined, symbol: eventSymbol || supplementalStyle?.symbol || resultStyle?.symbol, labels, vectorStyle, opacity: 1, onError }, controller.signal) }
    if (tileError) { throw new Error(tileError) }
    controller.signal.throwIfAborted()
    if (disposed || token !== revision || !props.active) { mapWork.clearWorkflowLayers(entry.key); return }
    const coverage = vector?.metadata.sourceBounds || raw?.sourceBounds || supplementalAssetBounds(asset.key) || remoteBounds(item.bbox)
    const thematicOrder = vector ? 70 : 30
    const layer: DbtLayer = { id: `online:${entry.key}`, name: entry.label, role: entry.role, opacity: 1, order: entry.key === "imagery" ? 10 : thematicOrder, authority: "", source: sourceUrl, publishedAt: String(item.properties["grid:year"] || item.properties.datetime || ""), crs: raster ? "EPSG:4326" : vector?.metadata.crs || "CRS84", security: "", scale: 0, data: vector || { type: "FeatureCollection", features: [] }, coverage, coverageEvidence: containsBounds(coverage, scope) ? "源覆盖框包含选区；像元缺测及业务完整性仍待核验" : "源数据仅覆盖部分选区", unit: "原始值（单位依据待核验）", legend: plan?.legend, raster: raster ? { image: "", bounds: raster.bounds, rendering: asset.numeric ? "classified" : "imagery", radiometry: `${plan!.label}；Mars3D 原生 XYZ 上图；出图时按相同参数获取高分辨率图像` } : undefined, onlineSource: { collection: item.collection, itemId: item.id, asset: asset.key, revision: String(item.properties.updated || ""), fingerprint, scope, statistics: raw?.statistics, rendering: { engine: raster ? "Mars3D.XyzLayer" : "Mars3D.GeoJsonLayer", kind: plan?.label || "真实几何参考", tileUrl: raster?.tileUrl, classBreaks: raw?.breaks, parameters: plan?.params } } }
    layer.security = String(item.properties["security:classification"] || item.properties["perm:level"] || item.properties.visibility || "")
    layer.onlineSource!.sourceItemSha256 = await mapPublicationHash(item)
    if (comparison) {
      layer.onlineSource!.rendering!.parameters = { ...layer.onlineSource!.rendering!.parameters, comparison }
      layer.legend = [{ label: `${comparison.side === "before" ? "西半部·灾前" : "东半部·灾后"} ${comparison.side === "before" ? comparison.beforeTime : comparison.afterTime}`, color: comparison.side === "before" ? "#2a7f9c" : "#ab5a36" }]
      layer.unit = "可比RGB影像"; layer.colorStandard = "同一地理框架的前后影像对照，不生成灾损统计"
    }
    if (tileError) { throw new Error(tileError) }
    if (!raster) { layer.onlineSource!.rendering!.parameters = { vectorField: vectorFields.value[entry.key] || "", contentRole: vector?.metadata.contentSelection?.role, ...(resultStyle ? { resultDisplay: resultStyle.display } : {}) } }
    if (disposed || token !== revision || !props.active || controller.signal.aborted) { return }
    if (eventSource) { layer.order = 100; layer.legend = [{ label: "震中（后台随包参考）", color: "#ffce00" }]; layer.onlineSource!.rendering!.kind = "后台条目震情参数 · 非审核目录事件"; layer.coverageEvidence = "震中坐标来自后台条目属性，不代表选区要素完整性" }
    if (!eventSource && !needsCoverageCheck(layer)) { layer.coverageEvidence = "目录范围为要素包络，不作为选区覆盖完整性证明" }
    mapWork.updateWorkflowPresentation(entry.key, layer)
    if (entry.group === "topic" && ["T30102000", "raster-ramp", "raster-threshold", "contour"].includes(props.topic)) {
      for (const key of Object.keys(bindings.value)) { if (key !== entry.key && requirements.value.find(r => r.key === key)?.group === "topic") { invalidate(key) } }
    }
    if (vectorStyle && !inputOnly) { layer.color = vectorStyle.color; layer.legend = [{ label: vectorStyle.label, color: vectorStyle.color }] }
    if (inputOnly) { layer.onlineSource!.rendering!.kind = "业务要素已读取，表达方法待应用"; layer.onlineSource!.rendering!.engine = "未渲染"; layer.onlineSource!.rendering!.parameters = { inputOnly: true }; layer.name = remoteItemTitle(item) }
    if (resultStyle) { layer.legend = resultStyle.legend; layer.unit = resultStyle.unit; layer.colorStandard = `${resultStyle.label}，按选区后台原值表达；${resultStyle.note}`; layer.onlineSource!.rendering!.kind = resultStyle.label }
    if (supplementalStyle) {
      layer.legend = supplementalStyle.legend; layer.color = supplementalStyle.color; layer.colorStandard = `${supplementalStyle.label}，真实几何参考表达`; layer.unit = entry.role === "intensity" ? "度（评估）" : "几何参考"; layer.onlineSource!.rendering!.kind = supplementalStyle.label
      layer.order = ({ boundary: 55, water: 45, transport: 50, settlement: 60, intensity: 70, fault: 80 } as Record<string, number>)[entry.role] || 60
      if (item.id === "SP-swchina-basegeo-250k") { layer.scale = 250000; layer.publishedAt = "" }
    }
    if (assessmentScene && vector) {
      const original = { ...vector, metadata: { ...vector.metadata, onlineLayerId: layer.id } }
      const assessed = await businessResult(original, assessmentScene, scope, {})
      controller.signal.throwIfAborted()
      if (disposed || token !== revision || !props.active) { return }
      await mapWork.renderTemplateScene(assessmentScene, undefined, controller.signal, entry.key)
      Object.assign(layer, expressionLayer(layer, assessed)); layer.name = entry.label; layer.publishedAt = assessmentScene.time
      mapWork.updateWorkflowPresentation(entry.key, layer)
    }
    if (raster && plan) { proofInputs.set(entry.key, { item, asset, scope: displayScope, plan, mapFingerprint: fingerprint }) }
    sourceSnapshots.set(entry.key, item)
    bindings.value = { ...bindings.value, [entry.key]: layer }; states.value[entry.key] = "unverified"; messages.value[entry.key] = `${coverageGapCount(entry.key) ? "仅部分覆盖。" : ""}${sheetKeys.length > 1 ? `已自动拼接 ${sheetKeys.length} 个相邻图幅。` : ""}${remoteItemNotice(item)}${statisticsNotice}`; publish()
    status.value = inputOnly ? "专题要素已读取，请选择指标并应用表达方法。" : `${entry.label}已显示在地图上。`
    if (inputOnly && !generating.value) { emit("expression-input-ready") }
  } catch (err) {
    if (token === revision && !disposed) { mapWork.clearWorkflowLayers(entry.key); states.value[entry.key] = isEmptyScopedVector(err) ? "empty" : "failed"; messages.value[entry.key] = err instanceof Error ? err.message : "渲染失败"; if (controller.signal.aborted) { messages.value[entry.key] = "读取超时或任务已取消，请重试" }; publish() }
  } finally { clearTimeout(timer); if (token === revision) { busy.value = false } }
}
async function prepareComposition() {
  if (!props.active || !props.bounds || !loaded.value.length || busy.value) { return false }
  clearAnalysisPreview()
  const ticket = revision; const scope = scopeFingerprint(props.bounds); const controller = new AbortController(); request = controller
  busy.value = true; error.value = ""; status.value = "正在准备出图图像，地图图层保留。"
  try {
    const prepared: Record<string, DbtLayer> = { ...bindings.value }
    const originals = { ...bindings.value }
    for (const [key, layer] of Object.entries(prepared)) {
      const snapshot = sourceSnapshots.get(key)
      if (!snapshot) { throw new Error("图层来源记录已变化，请重新叠加") }
      const current = await refreshRemoteItem(snapshot, controller.signal)
      if (JSON.stringify(current) !== JSON.stringify(snapshot)) { throw new Error("后端源数据版本已变化，请重新叠加后出图") }
      if (layer.raster) {
        const input = proofInputs.get(key)
        if (!input || !layer.onlineSource) { throw new Error("图层来源记录已变化，请重新叠加") }
        if (layer.raster.image) { continue }
        const raster = await backendRasterLayer(current, input.asset, input.scope, input.plan, controller.signal, sourceDpi.value[key] || 300)
        if (raster.tileUrl !== layer.onlineSource.rendering?.tileUrl) { throw new Error("地图与出图渲染参数不一致，未生成替代图像") }
        if (ticket !== revision || disposed || !props.active || scope !== scopeFingerprint(props.bounds) || bindings.value[key]?.onlineSource?.fingerprint !== layer.onlineSource.fingerprint) { return false }
        prepared[key] = { ...layer, raster: { ...layer.raster, image: raster.image }, onlineSource: { ...layer.onlineSource, fingerprint: raster.fingerprint, rendering: { ...layer.onlineSource.rendering!, proofUrl: raster.url, proofUrls: raster.urls, sourceWidth: raster.width, sourceHeight: raster.height, sourceDpi: raster.dpi } } }
      }
    }
    if (ticket !== revision || disposed || controller.signal.aborted || !props.active) { return false }
    if (Object.keys(originals).length !== Object.keys(bindings.value).length || Object.entries(originals).some(([key, layer]) => bindings.value[key]?.onlineSource?.fingerprint !== layer.onlineSource?.fingerprint)) { return false }
    bindings.value = prepared; publish(); status.value = "出图图像已就绪，地图与图件使用相同数据和渲染参数。"; return true
  } catch (err) { if (ticket === revision && !disposed) { error.value = err instanceof Error ? err.message : "出图准备失败，地图图层已保留" }; return false } finally { if (ticket === revision) { busy.value = false } }
}
function saveTask() {
  try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, topic: props.topic, scope: props.bounds, selected: selected.value, manualItems: Object.fromEntries(Object.entries(manualItems.value).map(([key, item]) => [key, { collection: item.collection, id: item.id }])), assetKeys: assetKeys.value, options: options.value, sourceDpi: sourceDpi.value, vectorFields: vectorFields.value, backgroundDisplays: backgroundDisplays.value, provenance: loaded.value.map(l => l.onlineSource), savedAt: new Date().toISOString() })); savedTask.value = true; status.value = "图层方案已保存；恢复时从后端重新读取数据。" } catch { error.value = "图层方案保存失败，请检查浏览器存储空间" }
}
async function restoreTask() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null")
    if (saved?.version !== 1 || saved.topic !== props.topic || scopeFingerprint(saved.scope) !== scopeFingerprint(props.bounds)) { throw new Error("已保存任务的专题或范围不同，请先选择对应专题并确认原范围") }
    const topic = props.topic; const scope = scopeFingerprint(props.bounds)
    await queryAll()
    if (disposed || !props.active || topic !== props.topic || scope !== scopeFingerprint(props.bounds)) { return }
    if (error.value || Object.values(states.value).some(value => value === "failed")) { throw new Error("后端目录读取失败，图层方案尚未恢复，请重试") }
    for (const [key, identity] of Object.entries(saved.manualItems || {})) {
      if (key !== referenceRequirement.key && !requirements.value.some(entry => entry.key === key)) { continue }
      const item = await refreshRemoteItem(identity as RemoteItem)
      if (disposed || !props.active || topic !== props.topic || scope !== scopeFingerprint(props.bounds)) { return }
      manualItems.value = { ...manualItems.value, [key]: item }; candidates.value = { ...candidates.value, [key]: [item] }
    }
    for (const entry of requirements.value) {
      if (!candidates.value[entry.key]?.some(i => candidateKey(entry.key, i) === saved.selected?.[entry.key])) { continue }
      changeItem(entry.key, saved.selected[entry.key])
      if (assetsFor(entry.key).some(a => a.key === saved.assetKeys?.[entry.key])) { changeAsset(entry.key, saved.assetKeys[entry.key]) }
      const config = saved.options?.[entry.key]
      if (config && [config.band, config.minimum, config.maximum].every(Number.isFinite)) { options.value[entry.key] = config }
      if ([150, 300, 450, 600].includes(saved.sourceDpi?.[entry.key])) { sourceDpi.value[entry.key] = saved.sourceDpi[entry.key] }
      if (backendResultFields(currentItem(entry.key)!).some(field => field.key === saved.vectorFields?.[entry.key])) { vectorFields.value[entry.key] = saved.vectorFields[entry.key] }
      if (["grid", "fill"].includes(saved.backgroundDisplays?.[entry.key])) { backgroundDisplays.value[entry.key] = saved.backgroundDisplays[entry.key] }
    }
    status.value = "已恢复配置，请确认当前条目版本并重新渲染。"
  } catch (err) { error.value = err instanceof Error ? err.message : "恢复任务失败" }
}
try { savedTask.value = !!localStorage.getItem(storageKey) } catch {}
onBeforeUnmount(() => { disposed = true; reset() })
defineExpose({ reset, busy: computed(() => busy.value || toolsBusy.value), items, prepareComposition, refresh: queryAll, focusRequirement, openDataPreparation, setExpression, invalidateExpression, clearAnalysisPreview })
</script>

<style scoped>
.workflow-data { color: var(--thematic-ink); margin-bottom: 16px; border-bottom: 1px solid var(--thematic-line); padding-bottom: 14px; min-width: 0; }
.operator-layers { list-style: none; margin: 10px 0; padding: 0; }
.operator-layers li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--thematic-line); }
.operator-layers label { margin: 0; }
.operator-layers .opacity-control { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; font-size: 12px; }
.operator-layers .background-display,.operator-layers .background-note { grid-column: 1 / -1; }
.operator-layers .background-note { font-size: 12px; }
.operator-layers input[type=range] { flex: 1; min-width: 60px; }
@media (max-width: 480px) { .operator-layers li { grid-template-columns: 1fr; } }
.content-matches { padding-bottom: 10px; border-bottom: 1px solid var(--thematic-line); }
.content-matches ul { list-style: none; margin: 10px 0; padding: 0; display: grid; gap: 8px; }
.content-matches li { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; font-size: 13px; overflow-wrap: anywhere; }
.content-matches li span { color: var(--thematic-muted); }
.content-topics { display: flex; flex-wrap: wrap; gap: 8px 20px; }.content-topics label { display: flex; align-items: center; gap: 8px; }
.content-topics input[type=radio] { width: 16px; height: 16px; min-height: 16px; padding: 0; accent-color: var(--thematic-accent); }
.matched-settings { margin-top: 12px; }.matched-settings summary { cursor: pointer; padding: 8px 0; }
.check { display: flex; align-items: center; gap: 8px; }.check input[type=checkbox] { width: 16px; min-height: 16px; height: 16px; padding: 0; accent-color: var(--thematic-accent); }
header,.requirement-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }header { margin-bottom: 10px; }header span,.muted,.scope { color: var(--thematic-muted); font-size: 12px; }.scope { margin-bottom: 10px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }button { min-height: 36px; padding: 6px 10px; display: inline-flex; gap: 6px; align-items: center; justify-content: center; border: 1px solid var(--thematic-primary); background: var(--thematic-primary); color: #fff; cursor: pointer; }button:disabled { background: var(--thematic-disabled-bg); color: var(--thematic-disabled-ink); border-color: var(--thematic-line); cursor: not-allowed; }
.requirement { padding: 12px 0; border-bottom: 1px solid var(--thematic-line); min-width: 0; }.requirement-heading span { font-size: 12px; color: var(--thematic-success); }.requirement-heading .warning,.notice { color: var(--thematic-warning); }.error { color: var(--thematic-danger); }
p { margin: 6px 0; line-height: 1.6; overflow-wrap: anywhere; }label { display: grid; gap: 5px; margin-top: 8px; font-size: 13px; }select,input:not([type=range]) { width: 100%; min-width: 0; min-height: 36px; padding: 7px 10px; border: 1px solid var(--thematic-line); background: var(--thematic-control); color: var(--thematic-ink); color-scheme: var(--thematic-scheme); }.pair { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
input[type=range] { box-sizing: border-box; width: 100%; min-width: 0; min-height: 36px; margin: 0; padding: 0; border: 0; background: transparent; color-scheme: var(--thematic-scheme); }
button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible { outline: 2px solid var(--thematic-accent); outline-offset: 2px; }.statistics { display: grid; grid-template-columns: minmax(95px,auto) minmax(0,1fr); gap: 5px 12px; margin: 8px 0; font-size: 12px; }.statistics dd { margin: 0; overflow-wrap: anywhere; }.legend { list-style: none; padding: 0; font-size: 12px; display: grid; gap: 5px; }.legend li { display: flex; align-items: center; gap: 8px; overflow-wrap: anywhere; }.legend i { width: 18px; height: 12px; flex-shrink: 0; }.quality { margin-top: 12px; }.quality summary { cursor: pointer; color: var(--thematic-ink); }.quality ul { padding-left: 20px; line-height: 1.7; font-size: 12px; }
</style>
