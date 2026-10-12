<template>
  <mars-task-modal
    v-model:open="visible"
    title="导入使用"
    :okLoading="importing"
    ok-text="开始导入"
    cancel-text="取消"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <a-alert v-if="errorText" type="error" :message="errorText" show-icon style="margin-bottom: 10px" />
    <div v-if="importing && progressText" class="import-progress">
      <div class="import-progress__head">
        <span>{{ progressText }}</span>
        <span>{{ progressPercentText }}</span>
      </div>
      <a-progress :percent="progressPercent" size="small" />
      <div v-if="uploadPausable" class="import-progress__actions">
        <a-button size="small" @click="handlePauseResume">
          {{ uploadPaused ? "继续上传" : "暂停上传" }}
        </a-button>
        <span class="layer-pick-hint">
          {{ uploadPaused ? "当前已暂停，继续后将从已上传分片断点续传" : "支持暂停后继续，已上传分片无需重复上传" }}
        </span>
      </div>
    </div>
    <a-form layout="vertical" class="import-use-form">
      <a-form-item label="导入来源">
        <a-radio-group v-model:value="sourceMode">
          <a-radio value="revision">版本导入</a-radio>
          <a-radio value="local">本地文件上传</a-radio>
          <a-radio value="api">API 接口拉取</a-radio>
          <a-radio value="thirdparty">第三方平台同步</a-radio>
        </a-radio-group>
        <div class="layer-pick-hint">四种方式互斥，切换来源会自动清空上一来源的输入内容</div>
      </a-form-item>

      <a-form-item label="导入策略">
        <a-radio-group v-model:value="strategy">
          <a-radio value="overlay">叠加（不覆盖现有）</a-radio>
          <a-radio value="replace">替换（覆盖现有）</a-radio>
        </a-radio-group>
      </a-form-item>

      <template v-if="sourceMode === 'revision'">
      <a-form-item label="数据时态">
        <a-radio-group v-model:value="timeMode">
          <a-radio value="saved">使用保存时数据</a-radio>
          <a-radio value="latest">使用最新数据</a-radio>
        </a-radio-group>
      </a-form-item>

      <a-form-item label="版本选择">
        <a-select
          v-model:value="revisionId"
          placeholder="选择版本"
          :options="revisionOptions"
          :disabled="timeMode === 'latest'"
          :getPopupContainer="getPopupContainer"
          :dropdownStyle="selectDropdownStyle"
        />
        <div class="layer-pick-hint">{{ revisionHelpText }}</div>
      </a-form-item>

      <a-form-item label="图层选择（可选）">
        <div class="layer-pick-actions">
          <a-button size="small" :disabled="layerTreeLoading || !treeData.length" @click="selectAllLayers">全选</a-button>
          <a-button size="small" :disabled="layerTreeLoading || !treeData.length" @click="clearAllLayers">清空</a-button>
          <a-button
            size="small"
            :loading="layerTreeLoading"
            :disabled="!datasetId || !effectiveRevisionId"
            @click="reloadManifestLayers"
          >
            刷新
          </a-button>
          <span class="layer-pick-meta">{{ layerPickMeta }}</span>
        </div>
        <div v-if="!datasetId" class="layer-pick-hint">仅支持在数据集详情页导入时选择图层</div>
        <div v-else-if="layerTreeLoading" class="layer-pick-loading">
          <a-spin size="small" tip="加载图层列表..." />
        </div>
        <a-empty v-else-if="treeData.length === 0" :description="layerTreeEmptyText" :image-style="{ height: '60px' }" />
        <a-tree
          v-else
          checkable
          :tree-data="treeData"
          v-model:checkedKeys="checkedKeys"
          v-model:expandedKeys="expandedKeys"
          :fieldNames="{ title: 'title', key: 'key', children: 'children' }"
        />
        <div class="layer-pick-hint">不选择时默认导入全部图层</div>
      </a-form-item>
      </template>

      <template v-else-if="sourceMode === 'local'">
        <a-form-item label="本地文件">
          <a-upload-dragger
            :file-list="localFileList"
            :max-count="1"
            accept=".csv,.geojson,.json,.zip"
            :before-upload="beforeLocalUpload"
            @remove="removeLocalFile"
          >
            <p class="ant-upload-drag-icon">📦</p>
            <p class="ant-upload-text">点击或拖拽文件到此处上传</p>
            <p class="ant-upload-hint">仅支持 csv / geojson / shp(zip)，单文件上限 10GB</p>
          </a-upload-dragger>
          <div class="layer-pick-hint">取消导入或切换来源时会自动清空临时文件缓存</div>
        </a-form-item>
        <a-form-item label="导入名称（可选）">
          <a-input v-model:value="localName" placeholder="默认使用文件名" />
        </a-form-item>
      </template>

      <template v-else-if="sourceMode === 'api'">
        <a-form-item label="接口地址">
          <a-input v-model:value="apiUrl" placeholder="输入可访问的数据接口 URL" />
          <div class="layer-pick-hint">支持返回 csv / geojson / shp(zip) 的下载接口</div>
        </a-form-item>
        <a-form-item label="数据格式">
          <a-select
            v-model:value="apiFormat"
            :options="remoteFormatOptions"
            :getPopupContainer="getPopupContainer"
            :dropdownStyle="selectDropdownStyle"
          />
        </a-form-item>
        <a-form-item label="访问 Token（可选）">
          <a-input-password v-model:value="apiToken" placeholder="如接口需要 Bearer Token 可在此填写" />
        </a-form-item>
      </template>

      <template v-else>
        <a-form-item label="同步平台">
          <a-select
            v-model:value="thirdPartyPlatform"
            :options="thirdPartyOptions"
            :getPopupContainer="getPopupContainer"
            :dropdownStyle="selectDropdownStyle"
          />
        </a-form-item>
        <a-form-item label="平台地址">
          <a-input v-model:value="thirdPartyUrl" placeholder="输入第三方平台接口地址" />
        </a-form-item>
        <a-form-item label="项目/图层标识">
          <a-input v-model:value="thirdPartyProjectId" placeholder="输入项目 ID、图层名或同步任务标识" />
        </a-form-item>
        <a-form-item label="认证信息（可选）">
          <a-input-password v-model:value="thirdPartyToken" placeholder="如需认证请填写 Access Token / API Key" />
        </a-form-item>
        <a-form-item label="返回格式">
          <a-select
            v-model:value="thirdPartyFormat"
            :options="remoteFormatOptions"
            :getPopupContainer="getPopupContainer"
            :dropdownStyle="selectDropdownStyle"
          />
          <div class="layer-pick-hint">当前版本先按通用接口同步处理，后端平台专属适配可继续扩展</div>
        </a-form-item>
      </template>

      <template v-if="sourceMode !== 'revision'">
        <div class="fine-tune-panel">
          <div class="fine-tune-panel__title">精细化导入配置</div>

          <a-form-item label="字段选择">
            <a-select
              v-model:value="selectedFields"
              mode="tags"
              :options="fieldOptions"
              :getPopupContainer="getPopupContainer"
              :dropdownStyle="selectDropdownStyle"
              placeholder="选择或输入要导入的字段，留空表示全部字段"
            />
            <div class="layer-pick-hint">支持自主选择字段；选择结果会自动缓存，下次导入默认复用</div>
          </a-form-item>

          <a-form-item label="字段映射">
            <div class="mapping-toolbar">
              <a-button size="small" @click="syncMappingsFromDetectedFields" :disabled="!detectedFieldOptions.length">根据文件预填</a-button>
              <a-button size="small" @click="addFieldMappingRow">新增映射</a-button>
            </div>
            <div v-if="fieldMappings.length === 0" class="mapping-empty">未设置映射时默认按原字段导入</div>
            <div v-for="(item, idx) in fieldMappings" :key="`mapping-${idx}`" class="mapping-row">
              <a-input v-model:value="item.source" placeholder="源字段" />
              <span class="mapping-row__arrow">-></span>
              <a-input v-model:value="item.target" placeholder="目标字段" />
              <a-checkbox v-model:checked="item.enabled">启用</a-checkbox>
              <a-button danger size="small" @click="removeFieldMappingRow(idx)">删除</a-button>
            </div>
          </a-form-item>

          <a-form-item label="空间范围筛选">
            <a-radio-group v-model:value="spatialFilterMode">
              <a-radio value="all">全部数据</a-radio>
              <a-radio value="currentView">当前视图范围</a-radio>
              <a-radio value="custom">自定义范围</a-radio>
            </a-radio-group>
            <div v-if="spatialFilterMode === 'custom'" class="bbox-grid">
              <a-input-number v-model:value="bboxWest" :controls="false" placeholder="西经" />
              <a-input-number v-model:value="bboxSouth" :controls="false" placeholder="南纬" />
              <a-input-number v-model:value="bboxEast" :controls="false" placeholder="东经" />
              <a-input-number v-model:value="bboxNorth" :controls="false" placeholder="北纬" />
            </div>
            <div class="layer-pick-hint">可按当前视图或自定义经纬度范围筛选需要导入的要素</div>
          </a-form-item>

          <a-form-item label="重复数据处理">
            <a-select
              v-model:value="dedupRule"
              :options="dedupRuleOptions"
              :getPopupContainer="getPopupContainer"
              :dropdownStyle="selectDropdownStyle"
            />
            <div class="layer-pick-hint">相同坐标或相同属性的重复要素支持跳过、覆盖或合并</div>
          </a-form-item>
        </div>
      </template>
    </a-form>
  </mars-task-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue"
import { $message } from "@mars/components/mars-ui/index"
import type { Manifest, StacItem } from "../types/eoapi-types"
import { getRevisionManifest } from "../services/eoapi-datasets"

type RemoteFormat = "auto" | "csv" | "geojson" | "shp"
type DedupRule = "skip" | "overwrite" | "merge"
type SpatialFilterMode = "all" | "currentView" | "custom"
type ImportFieldMapping = { source: string; target: string; enabled: boolean }
type ImportFineTuneConfig = {
  selectedFields?: string[]
  fieldMappings?: ImportFieldMapping[]
  spatialFilter?: {
    mode: SpatialFilterMode
    bbox?: [number, number, number, number]
  }
  dedupRule?: DedupRule
}
const FINE_TUNE_CACHE_KEY = "eoapi_import_fine_tune_v2"

// #region debug-point current-task-import-dialog
type TraeDebugEvent = {
  t: number
  sessionId: string
  level: "info" | "warn" | "error"
  type: string
  message: string
  data?: Record<string, unknown>
}

const TRAE_DEBUG_ENDPOINT =
  (import.meta.env as any).VITE_DEBUG_SERVER_URL ||
  new URLSearchParams(location.search).get("traeDebug") ||
  localStorage.getItem("TRAE_DEBUG_SERVER_URL") ||
  ""
const TRAE_DEBUG_SESSION_ID =
  (import.meta.env as any).VITE_DEBUG_SESSION_ID ||
  new URLSearchParams(location.search).get("traeSession") ||
  localStorage.getItem("TRAE_DEBUG_SESSION_ID") ||
  "current-task-import"
const traeBaseFetch = window.fetch.bind(window)

async function reportTraeDebugEvent(event: TraeDebugEvent): Promise<void> {
  if (!TRAE_DEBUG_ENDPOINT) {
    return
  }
  try {
    await traeBaseFetch(TRAE_DEBUG_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify(event),
      keepalive: true
    })
  } catch {
  }
}

function dbg(level: TraeDebugEvent["level"], type: string, message: string, data?: Record<string, unknown>) {
  reportTraeDebugEvent({
    t: Date.now(),
    sessionId: TRAE_DEBUG_SESSION_ID,
    level,
    type,
    message,
    data
  }).catch(() => {})
}
// #endregion debug-point current-task-import-dialog

const props = defineProps<{
  open: boolean
  datasetId?: string
  revisions: StacItem[]
  importing?: boolean
  defaultRevisionId?: string
  errorText?: string
  progressText?: string
  progressPercent?: number
  uploadPausable?: boolean
  uploadPaused?: boolean
}>()

const emit = defineEmits<{
  "update:open": [value: boolean]
  "pause-upload": []
  "resume-upload": []
  submit: [payload:
    | { mode: "revision"; revisionId: string; timeMode: "saved" | "latest"; strategy: "overlay" | "replace"; layerIds?: string[] }
    | { mode: "local"; strategy: "overlay" | "replace"; file: File; importName?: string; fineTune?: ImportFineTuneConfig }
    | { mode: "api"; strategy: "overlay" | "replace"; url: string; format: RemoteFormat; token?: string; fineTune?: ImportFineTuneConfig }
    | { mode: "thirdparty"; strategy: "overlay" | "replace"; platform: string; url: string; projectId?: string; token?: string; format: RemoteFormat; fineTune?: ImportFineTuneConfig }]
}>()

const visible = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v)
})

const importing = computed(() => !!props.importing)
const errorText = computed(() => (typeof props.errorText === "string" ? props.errorText : ""))
const progressText = computed(() => (typeof props.progressText === "string" ? props.progressText : ""))
const progressPercent = computed(() => {
  const value = Number(props.progressPercent ?? 0)
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(value)))
})
const progressPercentText = computed(() => `${progressPercent.value}%`)
const uploadPausable = computed(() => !!props.uploadPausable)
const uploadPaused = computed(() => !!props.uploadPaused)
const sourceMode = ref<"revision" | "local" | "api" | "thirdparty">("revision")
const timeMode = ref<"saved" | "latest">("saved")
const strategy = ref<"overlay" | "replace">("overlay")
const revisionId = ref<string>("")
const localFile = ref<File | null>(null)
const localFileList = ref<any[]>([])
const localName = ref("")
const detectedFieldOptions = ref<Array<{ label: string; value: string }>>([])
const selectedFields = ref<string[]>([])
const fieldMappings = ref<ImportFieldMapping[]>([])
const spatialFilterMode = ref<SpatialFilterMode>("all")
const bboxWest = ref<number | null>(null)
const bboxSouth = ref<number | null>(null)
const bboxEast = ref<number | null>(null)
const bboxNorth = ref<number | null>(null)
const dedupRule = ref<DedupRule>("skip")
const remoteFormatOptions = [
  { value: "auto", label: "自动识别" },
  { value: "csv", label: "CSV" },
  { value: "geojson", label: "GeoJSON" },
  { value: "shp", label: "SHP(zip)" }
]
const apiUrl = ref("")
const apiFormat = ref<RemoteFormat>("auto")
const apiToken = ref("")
const thirdPartyPlatform = ref("generic")
const thirdPartyUrl = ref("")
const thirdPartyProjectId = ref("")
const thirdPartyToken = ref("")
const thirdPartyFormat = ref<RemoteFormat>("auto")
const thirdPartyOptions = [
  { value: "generic", label: "通用平台" },
  { value: "geoserver", label: "GeoServer" },
  { value: "arcgis", label: "ArcGIS" }
]
const dedupRuleOptions = [
  { value: "skip", label: "跳过重复项" },
  { value: "overwrite", label: "后值覆盖前值" },
  { value: "merge", label: "合并重复属性" }
]
const fieldOptions = computed(() => {
  const set = new Set<string>()
  ;(detectedFieldOptions.value || []).forEach((item) => set.add(String(item.value)))
  ;(selectedFields.value || []).forEach((item) => set.add(String(item)))
  ;(fieldMappings.value || []).forEach((item) => {
    if (item.source) {
      set.add(String(item.source))
    }
  })
  return Array.from(set).map((value) => ({ label: value, value }))
})

const revisionOptions = computed(() => {
  const items = props.revisions || []
  return items.map((it) => ({
    value: it.id,
    label: it.properties?.title || it.id
  }))
})

const selectDropdownStyle = {
  zIndex: 20000
}

function getPopupContainer(triggerNode: any) {
  // Select 下拉在任务弹窗内若挂到局部父节点，容易被 overflow/transform 容器裁剪成“存在但不可见”。
  // 统一提升到 body，保证版本选择与格式选择的下拉层可见且可点击。
  return document.body
}

function createEmptyMapping(): ImportFieldMapping {
  return { source: "", target: "", enabled: true }
}

function normalizeFieldList(input: any): string[] {
  return Array.isArray(input) ? input.map((item) => String(item || "").trim()).filter(Boolean) : []
}

function readCachedFineTune(): ImportFineTuneConfig {
  try {
    const raw = localStorage.getItem(FINE_TUNE_CACHE_KEY) || ""
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function applyCachedFineTune() {
  const cached = readCachedFineTune()
  selectedFields.value = normalizeFieldList(cached.selectedFields)
  fieldMappings.value = Array.isArray(cached.fieldMappings)
    ? cached.fieldMappings
        .map((item: any) => ({
          source: String(item?.source || "").trim(),
          target: String(item?.target || "").trim(),
          enabled: item?.enabled !== false
        }))
        .filter((item) => item.source || item.target)
    : []
  spatialFilterMode.value = cached.spatialFilter?.mode || "all"
  const bbox = Array.isArray(cached.spatialFilter?.bbox) ? cached.spatialFilter?.bbox : []
  bboxWest.value = Number.isFinite(bbox?.[0]) ? Number(bbox[0]) : null
  bboxSouth.value = Number.isFinite(bbox?.[1]) ? Number(bbox[1]) : null
  bboxEast.value = Number.isFinite(bbox?.[2]) ? Number(bbox[2]) : null
  bboxNorth.value = Number.isFinite(bbox?.[3]) ? Number(bbox[3]) : null
  dedupRule.value = cached.dedupRule || "skip"
}

function persistFineTune() {
  const payload: ImportFineTuneConfig = {
    selectedFields: normalizeFieldList(selectedFields.value),
    fieldMappings: fieldMappings.value
      .map((item) => ({
        source: String(item.source || "").trim(),
        target: String(item.target || "").trim(),
        enabled: item.enabled !== false
      }))
      .filter((item) => item.source || item.target),
    spatialFilter: {
      mode: spatialFilterMode.value
    },
    dedupRule: dedupRule.value
  }
  if (
    spatialFilterMode.value === "custom" &&
    [bboxWest.value, bboxSouth.value, bboxEast.value, bboxNorth.value].every((item) => Number.isFinite(item))
  ) {
    payload.spatialFilter!.bbox = [
      Number(bboxWest.value),
      Number(bboxSouth.value),
      Number(bboxEast.value),
      Number(bboxNorth.value)
    ]
  }
  try {
    localStorage.setItem(FINE_TUNE_CACHE_KEY, JSON.stringify(payload))
  } catch {
  }
}

function resetExternalState() {
  localFile.value = null
  localFileList.value = []
  localName.value = ""
  apiUrl.value = ""
  apiFormat.value = "auto"
  apiToken.value = ""
  thirdPartyPlatform.value = "generic"
  thirdPartyUrl.value = ""
  thirdPartyProjectId.value = ""
  thirdPartyToken.value = ""
  thirdPartyFormat.value = "auto"
  detectedFieldOptions.value = []
}

async function inspectLocalFileFields(file: File) {
  const ext = String(file.name.split(".").pop() || "").toLowerCase()
  let fields: string[] = []
  try {
    if (ext === "csv") {
      const text = await file.slice(0, 256 * 1024).text()
      const firstLine = text
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .find(Boolean)
      if (firstLine) {
        fields = firstLine.split(",").map((item) => item.trim()).filter(Boolean)
      }
    } else if ((ext === "geojson" || ext === "json") && file.size <= 5 * 1024 * 1024) {
      const text = await file.text()
      const json = JSON.parse(text)
      let feature = null
      if (Array.isArray(json?.features)) {
        feature = json.features[0]
      } else if (json?.type === "Feature") {
        feature = json
      }
      const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {}
      fields = Object.keys(props)
    }
  } catch {
    fields = []
  }
  const unique = Array.from(new Set(fields.map((item) => String(item || "").trim()).filter(Boolean)))
  detectedFieldOptions.value = unique.map((item) => ({ label: item, value: item }))
  if (!selectedFields.value.length && unique.length) {
    selectedFields.value = [...unique]
  }
  if (unique.length && fieldMappings.value.length === 0) {
    fieldMappings.value = unique.map((item) => ({ source: item, target: item, enabled: true }))
  }
}

async function beforeLocalUpload(file: File) {
  const ext = String(file.name.split(".").pop() || "").toLowerCase()
  const allow = new Set(["csv", "geojson", "json", "zip"])
  if (!allow.has(ext)) {
    $message("仅支持 csv / geojson / shp(zip) 格式")
    return false
  }
  if (file.size > 10 * 1024 * 1024 * 1024) {
    $message("文件过大，单文件最大支持 10GB")
    return false
  }
  localFile.value = file
  localFileList.value = [{ uid: `${Date.now()}`, name: file.name, status: "done" }]
  await inspectLocalFileFields(file)
  return false
}

function removeLocalFile() {
  localFile.value = null
  localFileList.value = []
  detectedFieldOptions.value = []
  return true
}

function addFieldMappingRow() {
  fieldMappings.value = [...fieldMappings.value, createEmptyMapping()]
}

function removeFieldMappingRow(index: number) {
  fieldMappings.value = fieldMappings.value.filter((_, idx) => idx !== index)
}

function syncMappingsFromDetectedFields() {
  const next = detectedFieldOptions.value.map((item) => ({ source: item.value, target: item.value, enabled: true }))
  fieldMappings.value = next
  if (!selectedFields.value.length) {
    selectedFields.value = detectedFieldOptions.value.map((item) => item.value)
  }
}

function buildFineTuneConfig(): ImportFineTuneConfig {
  const config: ImportFineTuneConfig = {
    selectedFields: normalizeFieldList(selectedFields.value),
    fieldMappings: fieldMappings.value
      .map((item) => ({
        source: String(item.source || "").trim(),
        target: String(item.target || "").trim(),
        enabled: item.enabled !== false
      }))
      .filter((item) => item.source || item.target),
    spatialFilter: {
      mode: spatialFilterMode.value
    },
    dedupRule: dedupRule.value
  }
  if (spatialFilterMode.value === "custom") {
    const bbox = [bboxWest.value, bboxSouth.value, bboxEast.value, bboxNorth.value]
    if (bbox.every((item) => Number.isFinite(item))) {
      config.spatialFilter!.bbox = bbox as [number, number, number, number]
    }
  }
  return config
}

const datasetId = computed(() => (typeof props.datasetId === "string" ? props.datasetId : ""))
const latestRevisionId = computed(() => String(props.revisions?.[0]?.id || props.defaultRevisionId || ""))
const effectiveRevisionId = computed(() => (timeMode.value === "latest" ? latestRevisionId.value : revisionId.value))
const latestRevisionLabel = computed(() => {
  const latestId = latestRevisionId.value
  if (!latestId) {
    return ""
  }
  const matched = revisionOptions.value.find((it) => String(it.value) === latestId)
  return String(matched?.label || latestId)
})
const revisionHelpText = computed(() => {
  if (timeMode.value === "latest") {
    return latestRevisionLabel.value ? `当前将导入最新版本：${latestRevisionLabel.value}` : "当前将导入最新版本"
  }
  return "使用保存时数据时，可选择指定版本回放"
})
const layerTreeEmptyText = computed(() => (effectiveRevisionId.value ? "该版本没有可导入的图层" : "暂无可导入版本"))

type LayerTreeNode = { key: string; title: string; children?: LayerTreeNode[]; _isGroup?: boolean }

const layerTreeLoading = ref(false)
const treeData = ref<LayerTreeNode[]>([])
const checkedKeys = ref<string[]>([])
const expandedKeys = ref<string[]>([])
const leafKeySet = ref<Set<string>>(new Set())

const layerPickMeta = computed(() => {
  const totalLeaves = leafKeySet.value.size
  const pickedLeaves = getSelectedLeafIds().length
  if (!totalLeaves) {
    return ""
  }
  return `已选 ${pickedLeaves}/${totalLeaves}`
})

function walkTree(nodes: LayerTreeNode[], fn: (node: LayerTreeNode) => void) {
  const stack = [...nodes]
  while (stack.length) {
    const n = stack.shift()!
    fn(n)
    const children = Array.isArray(n.children) ? n.children : []
    children.forEach((c) => stack.push(c))
  }
}

function buildTreeFromManifestLayers(layers: any[]): { tree: LayerTreeNode[]; leafKeys: Set<string> } {
  const list = Array.isArray(layers) ? layers : []
  const nodeById = new Map<string, LayerTreeNode>()
  const pidById = new Map<string, string | null>()
  const groupById = new Map<string, boolean>()
  const orderById = new Map<string, number>()

  list.forEach((l, idx) => {
    const id = String(l?.id || "")
    if (!id) {
      return
    }
    const title = String(l?.name || id)
    const pidRaw = (l as any)?.pid
    const pid = pidRaw === null || pidRaw === undefined || String(pidRaw) === "" ? null : String(pidRaw)
    const isGroup = String((l as any)?.sourceType || "") === "group"
    pidById.set(id, pid)
    groupById.set(id, isGroup)
    orderById.set(id, Number.isFinite((l as any)?.order) ? Number((l as any)?.order) : idx)
    nodeById.set(id, { key: id, title, children: [], _isGroup: isGroup })
  })

  const roots: LayerTreeNode[] = []
  const childIdsByPid = new Map<string, string[]>()
  for (const [id, pid] of pidById.entries()) {
    const key = pid || ""
    const arr = childIdsByPid.get(key) || []
    arr.push(id)
    childIdsByPid.set(key, arr)
  }
  for (const [k, arr] of childIdsByPid.entries()) {
    arr.sort((a, b) => (orderById.get(a) ?? 0) - (orderById.get(b) ?? 0))
    childIdsByPid.set(k, arr)
  }

  const attach = (id: string) => {
    const node = nodeById.get(id)
    if (!node) {
      return
    }
    const pid = pidById.get(id)
    if (pid && nodeById.has(pid)) {
      const parent = nodeById.get(pid)!
      parent.children = parent.children || []
      parent.children.push(node)
      return
    }
    roots.push(node)
  }

  Array.from(nodeById.keys())
    .sort((a, b) => (orderById.get(a) ?? 0) - (orderById.get(b) ?? 0))
    .forEach((id) => attach(id))

  const leafKeys = new Set<string>()
  roots.forEach((r) => {
    walkTree([r], (n) => {
      const isGroup = !!n._isGroup
      const hasChildren = Array.isArray(n.children) && n.children.length > 0
      if (!isGroup && !hasChildren) {
        leafKeys.add(String(n.key))
      }
      if (!isGroup && hasChildren) {
        leafKeys.add(String(n.key))
      }
    })
  })

  return { tree: roots, leafKeys }
}

function getSelectedLeafIds(): string[] {
  const checked = new Set<string>((checkedKeys.value || []).map(String))
  if (checked.size === 0) {
    return []
  }
  const out = new Set<string>()
  const isLeaf = (key: string) => leafKeySet.value.has(key)

  const rootNodes = treeData.value || []
  const findNode = (targetKey: string): LayerTreeNode | null => {
    let found: LayerTreeNode | null = null
    walkTree(rootNodes, (n) => {
      if (found) {
        return
      }
      if (String(n.key) === targetKey) {
        found = n
      }
    })
    return found
  }

  for (const key of checked) {
    if (isLeaf(key)) {
      out.add(key)
      continue
    }
    const node = findNode(key)
    if (!node) {
      continue
    }
    walkTree([node], (n) => {
      const k = String(n.key)
      if (isLeaf(k)) {
        out.add(k)
      }
    })
  }
  return Array.from(out)
}

async function reloadManifestLayers() {
  const targetRevisionId = effectiveRevisionId.value
  if (!datasetId.value || !targetRevisionId) {
    treeData.value = []
    checkedKeys.value = []
    expandedKeys.value = []
    leafKeySet.value = new Set()
    return
  }
  layerTreeLoading.value = true
  try {
    const res = await getRevisionManifest(datasetId.value, targetRevisionId)
    const manifest: Manifest | null = res.success && res.data ? (res.data as any) : null
    const layers = (manifest as any)?.layers || []
    const { tree, leafKeys } = buildTreeFromManifestLayers(layers)
    treeData.value = tree
    leafKeySet.value = leafKeys
    expandedKeys.value = tree.map((n) => String(n.key)).slice(0, 6)
    checkedKeys.value = []
  } finally {
    layerTreeLoading.value = false
  }
}

function selectAllLayers() {
  checkedKeys.value = Array.from(leafKeySet.value)
  expandedKeys.value = Array.from(new Set([...(expandedKeys.value || []), ...treeData.value.map((n) => String(n.key))]))
}

function clearAllLayers() {
  checkedKeys.value = []
}

watch(
  () => props.open,
  (open, wasOpen) => {
    // #region debug-point current-task-import-dialog
    dbg("info", "current-task-import.dialog", "props.open(changed)", {
      open,
      wasOpen,
      datasetId: props.datasetId || null,
      revisionsCount: props.revisions?.length || 0,
      defaultRevisionId: props.defaultRevisionId || null,
      importing: !!props.importing
    })
    // #endregion debug-point current-task-import-dialog
    if (open && !wasOpen) {
      sourceMode.value = "revision"
      const fallback = props.defaultRevisionId || props.revisions?.[0]?.id || ""
      revisionId.value = fallback
      timeMode.value = "saved"
      strategy.value = "overlay"
      applyCachedFineTune()
      resetExternalState()
      reloadManifestLayers().catch(() => {})
      return
    }
    if (!open && wasOpen) {
      resetExternalState()
    }
  },
  { immediate: true }
)

watch(
  () => visible.value,
  async (open) => {
    // #region debug-point current-task-import-dialog
    await nextTick()
    const modalNodes = [...document.querySelectorAll(".ant-modal, .mars-task-modal, .mars-dialog")]
      .map((node) => {
        const el = node as HTMLElement
        const text = (el.innerText || "").replace(/\s+/g, " ").trim()
        return {
          className: el.className,
          ariaHidden: el.getAttribute("aria-hidden"),
          display: window.getComputedStyle(el).display,
          visibility: window.getComputedStyle(el).visibility,
          opacity: window.getComputedStyle(el).opacity,
          text: text.slice(0, 120)
        }
      })
      .slice(0, 8)
    dbg("info", "current-task-import.dialog", "visible(changed)", {
      open,
      datasetId: props.datasetId || null,
      sourceMode: sourceMode.value,
      strategy: strategy.value,
      revisionId: revisionId.value || null,
      modalNodes
    })
    // #endregion debug-point current-task-import-dialog
  },
  { immediate: true }
)

watch(
  () => [props.open, revisionId.value, timeMode.value],
  () => {
    if (!props.open || sourceMode.value !== "revision") {
      return
    }
    reloadManifestLayers().catch(() => {})
  }
)

watch(
  () => sourceMode.value,
  (mode, prev) => {
    if (!props.open || !prev || mode === prev) {
      return
    }
    resetExternalState()
    checkedKeys.value = []
  }
)

watch(
  () => [selectedFields.value, fieldMappings.value, spatialFilterMode.value, bboxWest.value, bboxSouth.value, bboxEast.value, bboxNorth.value, dedupRule.value],
  () => {
    persistFineTune()
  },
  { deep: true }
)

function handleOk() {
  // #region debug-point current-task-import-dialog
  dbg("info", "current-task-import.dialog", "handleOk(clicked)", {
    datasetId: props.datasetId || null,
    sourceMode: sourceMode.value,
    strategy: strategy.value,
    revisionId: revisionId.value || null,
    effectiveRevisionId: effectiveRevisionId.value || null,
    importing: importing.value,
    visible: visible.value,
    selectedLeafIdsCount: getSelectedLeafIds().length
  })
  // #endregion debug-point current-task-import-dialog
  if (importing.value) {
    return
  }
  if (sourceMode.value === "local") {
    if (!localFile.value) {
      $message("请先选择本地文件")
      return
    }
    emit("submit", { mode: "local", strategy: strategy.value, file: localFile.value, importName: localName.value || undefined, fineTune: buildFineTuneConfig() })
    return
  }
  if (sourceMode.value === "api") {
    if (!apiUrl.value.trim()) {
      $message("请输入接口地址")
      return
    }
    emit("submit", { mode: "api", strategy: strategy.value, url: apiUrl.value.trim(), format: apiFormat.value, token: apiToken.value.trim() || undefined, fineTune: buildFineTuneConfig() })
    return
  }
  if (sourceMode.value === "thirdparty") {
    if (!thirdPartyUrl.value.trim()) {
      $message("请输入平台地址")
      return
    }
    emit("submit", {
      mode: "thirdparty",
      strategy: strategy.value,
      platform: thirdPartyPlatform.value,
      url: thirdPartyUrl.value.trim(),
      projectId: thirdPartyProjectId.value.trim() || undefined,
      token: thirdPartyToken.value.trim() || undefined,
      format: thirdPartyFormat.value,
      fineTune: buildFineTuneConfig()
    })
    return
  }
  const targetRevisionId = effectiveRevisionId.value
  if (!targetRevisionId) {
    return
  }
  const picked = getSelectedLeafIds()
  emit("submit", { mode: "revision", revisionId: targetRevisionId, timeMode: timeMode.value, strategy: strategy.value, layerIds: picked.length ? picked : undefined })
}

function handlePauseResume() {
  if (!importing.value || !uploadPausable.value) {
    return
  }
  if (uploadPaused.value) {
    emit("resume-upload")
    return
  }
  emit("pause-upload")
}

function handleCancel() {
  // #region debug-point current-task-import-dialog
  dbg("info", "current-task-import.dialog", "handleCancel(clicked)", {
    datasetId: props.datasetId || null,
    importing: importing.value,
    visible: visible.value
  })
  // #endregion debug-point current-task-import-dialog
  if (importing.value) {
    $message("导入进行中，请先暂停上传或等待完成")
    return
  }
  visible.value = false
}
</script>

<style scoped>
/* 同层级标题：在默认约 14px 基础上 +2px → 16px */
.import-use-form :deep(.ant-form-item-label > label) {
  height: auto;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: var(--mars-text-color);
}

/* 分割线在板块之间（整块与整块），左右留白不贴边 */
.import-use-form :deep(.ant-form-item) {
  position: relative;
  margin-bottom: 16px;
  padding-bottom: 16px;
}

.import-use-form :deep(.ant-form-item:not(:last-child))::after {
  content: "";
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 0;
  height: 1px;
  background: var(--popup-border, rgba(23, 35, 61, 0.12));
}

.layer-pick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.layer-pick-meta {
  color: var(--mars-text-color-secondary);
  font-size: 12px;
}

.layer-pick-loading {
  padding: 6px 0;
}

.import-progress {
  margin-bottom: 12px;
}

.import-progress__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--mars-text-color-secondary);
}

.import-progress__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.layer-pick-hint {
  margin-top: 6px;
  color: var(--mars-text-color-secondary);
  font-size: 12px;
}

.fine-tune-panel {
  padding: 12px;
  border: 1px solid var(--mars-border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.fine-tune-panel__title {
  margin: 0 0 12px;
  font-size: 15px; /* 原 13px + 2px */
  font-weight: 600;
  line-height: 24px;
  color: var(--mars-text-color);
}

/* 精细化面板内各表单板块之间同样使用左右留白分割线 */
.fine-tune-panel :deep(.ant-form-item:last-child) {
  margin-bottom: 0;
  padding-bottom: 0;
}

.mapping-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.mapping-empty {
  padding: 8px 0;
  color: var(--mars-text-color-secondary);
  font-size: 12px;
}

.mapping-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.mapping-row__arrow {
  color: var(--mars-text-color-secondary);
  font-size: 12px;
}

.bbox-grid {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
</style>
