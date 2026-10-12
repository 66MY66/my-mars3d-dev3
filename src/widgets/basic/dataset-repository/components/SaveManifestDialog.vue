<template>
  <mars-dialog
    v-model:visible="visible"
    :title="modalTitle"
    custom-class="ksh002-drawer ksh002-save-manifest-drawer"
    :draggable="false"
    :nopadding="true"
    :closeable="true"
    width="32%"
    :minWidth="520"
    top="0"
    bottom="0"
    right="0"
    @closed="handleClosed"
  >
    <template #footer>
      <div class="save-manifest-footer">
        <a-button v-if="saveStep === 'preview'" :disabled="saving" @click="backToEdit">返回修改</a-button>
        <a-button v-else :disabled="saving" @click="handleCancel">取消</a-button>
        <a-button
          v-if="saveStep === 'preview'"
          :disabled="saving"
          @click="confirmPreview('save')"
        >
          确认保存成果
        </a-button>
        <a-button v-if="saveStep === 'preview'" type="primary" :loading="saving" @click="confirmPreview('publish')">
          确认保存并提交
        </a-button>

        <a-button v-if="saveStep !== 'preview'" :disabled="saving" @click="handleSaveOnly">保存成果</a-button>
        <a-button v-if="saveStep !== 'preview'" type="primary" :loading="saving" @click="handleSubmitPublish">保存并提交</a-button>
      </div>
    </template>

    <div class="save-manifest-scroll">
      <div v-if="draftTipVisible" class="save-draft-banner">
        <span class="save-draft-banner__text">{{ draftTipMessage }}</span>
        <div class="save-draft-banner__actions">
          <button type="button" class="save-draft-btn" @click="restoreDraft">恢复草稿</button>
          <button type="button" class="save-draft-btn save-draft-btn--danger" @click="clearDraft">删除</button>
        </div>
      </div>

      <a-form v-if="saveStep === 'edit'" ref="formRef" :model="formState" :rules="formRules" layout="vertical" class="save-manifest-form">
      <div class="save-form-section">
      <div class="save-section-head" @click="toggleSection('basic')">
        <span class="save-section-title">基本信息</span>
        <svg class="save-section-toggle" :class="{ 'is-collapsed': collapsedSections['basic'] }" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="save-section-body" v-show="!collapsedSections['basic']">
      <a-form-item label="名称" name="name">
        <a-input v-model:value="formState.name" placeholder="请输入成果名称" @blur="handleNameBlur" />
      </a-form-item>

      <a-form-item label="描述" name="description">
        <a-textarea
          v-model:value="formState.description"
          placeholder="请输入成果描述（可选）"
          :rows="3"
        />
      </a-form-item>

      <a-form-item label="可见性" name="visibility">
        <a-radio-group v-model:value="formState.visibility">
          <a-radio value="private">私有</a-radio>
          <a-radio value="shared">共享</a-radio>
        </a-radio-group>
        <div v-if="formState.visibility === 'shared'" class="hint">
          共享需要提交审核，点击“提交发布”进入审核流程。
        </div>
      </a-form-item>

      <a-form-item label="标签" name="tags">
        <a-select
          v-model:value="formState.tags"
          mode="tags"
          placeholder="输入标签后按回车添加"
          :options="tagOptions"
        />
      </a-form-item>
      </div>
      </div>

      <div class="save-form-section">
      <div class="save-section-head" @click="toggleSection('cover')">
        <span class="save-section-title">封面</span>
        <svg class="save-section-toggle" :class="{ 'is-collapsed': collapsedSections['cover'] }" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="save-section-body" v-show="!collapsedSections['cover']">
      <a-form-item label="封面设置">
        <a-radio-group v-model:value="formState.coverMode">
          <a-radio value="auto">自动使用当前视图</a-radio>
          <a-radio value="upload">上传图片</a-radio>
          <a-radio value="thematic" :disabled="!thematicSelectable">从专题图任务选择</a-radio>
        </a-radio-group>
        <div v-if="formState.coverMode === 'auto'" class="cover-preview">
          <div class="cover-preview-actions">
            <a-button size="small" :loading="autoCoverLoading" @click="refreshAutoCoverPreview">刷新预览</a-button>
          </div>
          <div class="cover-preview-img">
            <img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="cover" />
            <div v-else class="cover-preview-empty">暂无预览</div>
          </div>
        </div>
        <div v-if="formState.coverMode === 'upload'" class="cover-upload">
          <a-upload
            :file-list="coverFileList"
            :max-count="1"
            :before-upload="beforeCoverUpload"
            @remove="removeCover"
            accept="image/*"
          >
            <a-button size="small">选择图片</a-button>
          </a-upload>
          <div class="hint">未选择图片时将自动截取当前地图视图生成封面（≥800×600）</div>
          <div v-if="coverPreviewUrl" class="cover-preview">
            <div class="cover-preview-img">
              <img :src="coverPreviewUrl" alt="cover" />
            </div>
          </div>
        </div>
        <div v-if="formState.coverMode === 'thematic'" class="thematic-cover">
          <div class="thematic-cover-actions">
            <a-button size="small" :loading="thematicLoading" :disabled="!thematicDatasetId" @click="loadThematicThumbs">
              加载缩略图
            </a-button>
            <div v-if="!thematicApiAvailable" class="hint">专题图服务未启用</div>
            <div v-else-if="!thematicDatasetId" class="hint">仅支持对已存在的数据集从专题图任务选择封面</div>
          </div>
          <div v-if="thematicThumbs.length" class="thematic-grid">
            <div
              v-for="t in thematicThumbs"
              :key="t.artifactId"
              class="thematic-thumb"
              :class="{ 'thematic-thumb-active': t.artifactId === selectedThematic?.artifactId }"
              @click="selectThematicThumb(t)"
            >
              <img :src="t.url" :alt="t.name" />
              <div class="thematic-thumb-name">{{ t.name }}</div>
            </div>
          </div>
          <a-empty v-else-if="thematicLoaded && thematicApiAvailable && thematicDatasetId" description="暂无可用缩略图" />
        </div>
      </a-form-item>
      </div>
      </div>

      <div class="save-form-section">
      <div class="save-section-head" @click="toggleSection('include')">
        <span class="save-section-title">包含内容</span>
        <svg class="save-section-toggle" :class="{ 'is-collapsed': collapsedSections['include'] }" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="save-section-body" v-show="!collapsedSections['include']">
      <a-form-item label="包含项">
        <a-checkbox-group v-model:value="formState.includeItems">
          <a-checkbox value="viewState">包含当前视角</a-checkbox>
          <a-checkbox value="layers">包含图层状态</a-checkbox>
          <a-checkbox value="drawFeatures">包含绘制要素</a-checkbox>
        </a-checkbox-group>
      </a-form-item>
      <a-form-item v-if="formState.includeItems.includes('layers')" label="图层选择">
        <div class="layer-select-actions">
          <a-button size="small" @click="selectAllLayers">全选</a-button>
          <a-button size="small" @click="clearAllLayers">清空</a-button>
          <a-button size="small" @click="openCreateDir">新建目录</a-button>
          <span class="layer-select-meta">已选 {{ selectedLayerIds.length }}/{{ availableLayers.length }}</span>
        </div>
        <div class="layer-dir-actions">
          <a-select
            v-model:value="moveTargetPid"
            placeholder="移动所选图层到…"
            :options="dirSelectOptions"
            style="flex: 1"
            allow-clear
          />
          <a-button size="small" :disabled="!selectedLayerIds.length" @click="moveSelectedLayersToDir">移动</a-button>
          <a-select
            v-model:value="renameDirId"
            placeholder="选择目录重命名…"
            :options="dirOnlySelectOptions"
            style="flex: 1"
            allow-clear
          />
          <a-button size="small" :disabled="!renameDirId" @click="openRenameDir">重命名</a-button>
        </div>
        <a-checkbox-group v-model:value="selectedLayerIds" class="layer-select-list">
          <a-checkbox v-for="l in availableLayers" :key="l.id" :value="l.id">
            {{ l.name || l.id }}
          </a-checkbox>
        </a-checkbox-group>
      </a-form-item>
      </div>
      </div>

      <div class="save-form-section">
      <div class="save-section-head" @click="toggleSection('scope')">
        <span class="save-section-title">保存范围</span>
        <svg class="save-section-toggle" :class="{ 'is-collapsed': collapsedSections['scope'] }" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="save-section-body" v-show="!collapsedSections['scope']">
      <a-form-item label="范围选择">
        <a-radio-group v-model:value="formState.scopeMode">
          <a-radio value="currentView">当前视域</a-radio>
          <a-radio value="all">全部内容</a-radio>
          <a-radio value="selection">框选范围</a-radio>
        </a-radio-group>
        <div v-if="formState.scopeMode === 'selection'" class="scope-selection">
          <div class="scope-actions">
            <a-button size="small" @click="startScopeDraw('rectangle')">矩形框选</a-button>
            <a-button size="small" @click="startScopeDraw('polygon')">多边形框选</a-button>
            <a-button size="small" :disabled="!scopeGraphic" @click="clearScopeSelection">清除</a-button>
          </div>
          <div class="hint" v-if="scopeAreaText">{{ scopeAreaText }}</div>
        </div>
      </a-form-item>
      </div>
      </div>

      <div class="save-form-section">
      <div class="save-section-head" @click="toggleSection('attachment')">
        <span class="save-section-title">附件</span>
        <svg class="save-section-toggle" :class="{ 'is-collapsed': collapsedSections['attachment'] }" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="save-section-body" v-show="!collapsedSections['attachment']">
      <a-form-item label="上传附件">
        <a-upload
          :file-list="attachmentFileList"
          :multiple="true"
          :before-upload="beforeAttachmentUpload"
          @remove="removeAttachment"
          :accept="attachmentAccept"
        >
          <a-button size="small">选择文件</a-button>
        </a-upload>
        <div class="hint">可上传报告/数据等附件；大文件自动走分片上传</div>
      </a-form-item>
      </div>
      </div>

      <!-- 预览信息 -->
      <div class="save-form-section save-form-section--preview">
        <div class="save-section-head" @click="toggleSection('preview')">
          <span class="save-section-title">预览</span>
          <svg class="save-section-toggle" :class="{ 'is-collapsed': collapsedSections['preview'] }" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="save-section-body preview-content" v-show="!collapsedSections['preview']">
          <div class="preview-item">
            <span class="label">图层数量</span>
            <span class="value">{{ layerCount }}</span>
          </div>
          <div class="preview-item">
            <span class="label">绘制要素</span>
            <span class="value">{{ drawFeatureCount }}</span>
          </div>
          <div class="preview-item" v-if="currentViewCenter">
            <span class="label">视角中心</span>
            <span class="value">{{ currentViewCenter }}</span>
          </div>
        </div>
      </div>
    </a-form>
      <div v-else class="confirm-preview save-form-section">
      <div class="save-section-head">
        <span class="save-section-title">保存前预览</span>
      </div>
      <div class="save-section-body">
      <div class="confirm-item">
        <span class="label">名称</span>
        <span class="value">{{ formState.name }}</span>
      </div>
      <div class="confirm-item">
        <span class="label">待保存图层</span>
        <span class="value">{{ previewLayerLines.length }}</span>
      </div>
      <div class="confirm-layer-list" v-if="previewLayerLines.length">
        <div v-for="l in previewLayerLines" :key="l.id" class="confirm-layer-row" :style="{ paddingLeft: `${l.depth * 14}px` }">
          <span class="layer-dot" :class="{ group: l.isGroup }" />
          <span class="layer-name">{{ l.name }}</span>
        </div>
      </div>
      <a-empty v-else description="未包含图层" />

      <div class="confirm-item">
        <span class="label">标注/绘制要素</span>
        <span class="value">{{ previewDrawCount }}</span>
      </div>
      <div class="confirm-item">
        <span class="label">视角</span>
        <span class="value">{{ previewViewText || "未包含" }}</span>
      </div>
      <div class="confirm-item">
        <span class="label">附件</span>
        <span class="value">{{ attachmentFileList.length }}</span>
      </div>
      </div>
    </div>
      <div v-if="attachmentUploadVisible" class="attachment-upload-status">
        <div class="attachment-upload-meta">
          <span>{{ attachmentUploadTitle }}</span>
          <span v-if="attachmentUploadState.total > 0">{{ attachmentUploadState.currentIndex }}/{{ attachmentUploadState.total }}</span>
        </div>
        <div v-if="attachmentUploadState.currentFileName" class="attachment-upload-file">
          当前文件：{{ attachmentUploadState.currentFileName }}
        </div>
        <a-progress
          v-if="attachmentUploadState.phase === 'uploading' || attachmentUploadState.phase === 'success'"
          size="small"
          :percent="attachmentUploadState.percent"
          :status="attachmentUploadState.phase === 'success' ? 'success' : 'active'"
        />
        <a-alert
          v-if="attachmentUploadState.phase === 'failed'"
          type="error"
          show-icon
          :message="attachmentUploadFailureTitle"
          :description="attachmentUploadRetryHint"
        >
          <template #action>
            <a-button size="small" @click="clearAttachmentUploadFeedback">知道了</a-button>
          </template>
        </a-alert>
      </div>
    </div>
    <mars-task-modal
      v-model:open="nameConflictOpen"
      title="名称已存在"
      :maskClosable="false"
      :closable="false"
      @cancel="resolveNameConflict('cancel')"
    >
      <div>已存在同名数据集：{{ nameConflictName }}</div>
      <div style="margin-top: 8px">覆盖将创建新版本；重命名将以新名称创建新数据集。</div>
      <template #footer>
        <a-button @click="resolveNameConflict('cancel')">取消</a-button>
        <a-button @click="resolveNameConflict('rename')">重命名</a-button>
        <a-button type="primary" @click="resolveNameConflict('cover')">覆盖</a-button>
      </template>
    </mars-task-modal>

    <mars-task-modal v-model:open="createDirOpen" title="新建目录" :maskClosable="false" @cancel="closeCreateDir">
      <a-form layout="vertical">
        <a-form-item label="目录名称">
          <a-input v-model:value="createDirName" placeholder="请输入目录名称" />
        </a-form-item>
        <a-form-item label="父级目录（可选）">
          <a-select v-model:value="createDirPid" :options="dirSelectOptions" placeholder="根目录" allow-clear />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="closeCreateDir">取消</a-button>
        <a-button type="primary" @click="confirmCreateDir">创建</a-button>
      </template>
    </mars-task-modal>

    <mars-task-modal v-model:open="renameDirOpen" title="重命名目录" :maskClosable="false" @cancel="closeRenameDir">
      <a-form layout="vertical">
        <a-form-item label="目录名称">
          <a-input v-model:value="renameDirName" placeholder="请输入新名称" />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="closeRenameDir">取消</a-button>
        <a-button type="primary" @click="confirmRenameDir">确定</a-button>
      </template>
    </mars-task-modal>

    <a-modal
      v-model:open="submitSuccessOpen"
      centered
      :footer="null"
      :maskClosable="true"
      :closable="false"
      wrap-class-name="save-submit-success-modal"
      @cancel="closeSubmitSuccess"
    >
      <div class="save-submit-success">
        <div class="save-submit-success__title">提交成功</div>
        <div class="save-submit-success__desc">成果已保存并提交审核，点击空白区域即可关闭。</div>
      </div>
    </a-modal>
  </mars-dialog>
</template>

<script lang="ts" setup>
import { inject, ref, reactive, computed, watch, onBeforeUnmount, nextTick } from "vue"
import { $message } from "@mars/components/mars-ui/index"
import type { FormInstance, Rule } from "ant-design-vue/es/form"
import { DatasetVisibility } from "../types/eoapi-types"
import { serializeWorkspace, validateManifest } from "../workspace/serialize"
import { createDataset, createRevision, getDatasets, getLatestDatasetManifest, quickSaveManifest, submitDatasetPublishRequest, updateLocalDataset } from "../services/eoapi-datasets"
import * as mapWork from "../map"
import { requestDatasetShare } from "../services/publish-status"
import { smartUploadArtifact, uploadThumbnail } from "../services/eoapi-artifacts"
import { computeCoverCacheKey, getCoverCache, setCoverCache } from "../services/cover-cache"
import { emitDatasetSync } from "../services/dataset-sync"
import type { UploadFile } from "ant-design-vue"
import * as mars3d from "mars3d"
import { getGraphicRing, getPolygonArea } from "@/utils/contextmenu/context-detector"
import { createStore, del as idbDel, get as idbGet, set as idbSet } from "idb-keyval"
import { getJobs, getJobResult, getTemplates } from "../services/eoapi-thematics"
import type { Artifact, ArtifactType, Manifest } from "../types/eoapi-types"

const Cesium = mars3d.Cesium

const props = defineProps<{
  open: boolean
  layerFilter?: string[]
  initialVisibility?: DatasetVisibility
  initialSubmitForReview?: boolean
}>()

const emit = defineEmits<{
  "update:open": [value: boolean]
  "saved": [data: { datasetId: string; revisionId: string }]
}>()

// 表单引用
const formRef = ref<FormInstance>()
const saving = ref(false)
const saveStep = ref<"edit" | "preview">("edit")

const previewManifest = ref<Manifest | null>(null)
const previewLayerLines = ref<Array<{ id: string; name: string; depth: number; isGroup: boolean }>>([])
const previewDrawCount = ref(0)
const previewViewText = ref("")

// 表单状态
const formState = reactive({
  name: "",
  description: "",
  visibility: "private" as DatasetVisibility,
  tags: [] as string[],
  coverMode: "auto" as "auto" | "upload" | "thematic",
  includeItems: ["viewState", "layers", "drawFeatures"],
  scopeMode: "currentView" as "currentView" | "all" | "selection"
})

// 表单验证规则
const formRules: Record<string, Rule[]> = {
  name: [
    { required: true, message: "请输入成果名称" },
    { min: 2, max: 100, message: "名称长度应在 2-100 字符之间" }
  ]
}

// 预设标签选项
const tagOptions = [
  { value: "地震" },
  { value: "灾害评估" },
  { value: "InSAR" },
  { value: "专题图" }
]

// 计算属性
const visible = computed({
  get: () => props.open,
  set: (val) => emit("update:open", val)
})

const canSubmitPublish = computed(() => formState.visibility === "shared")
const modalTitle = computed(() => (canSubmitPublish.value ? "提交发布" : "保存成果"))
const submitSuccessOpen = ref(false)
const localApiMode = computed(() => String(import.meta.env.VITE_LOCAL_API || "") === "1")
const attachmentUploadVisible = computed(() => attachmentUploadState.phase !== "idle")
const attachmentUploadTitle = computed(() => {
  if (attachmentUploadState.phase === "success") {
    return "附件上传完成"
  }
  if (attachmentUploadState.phase === "failed") {
    return "附件上传失败"
  }
  return "附件上传中"
})
const attachmentUploadFailureTitle = computed(() => {
  const fileName = attachmentUploadState.failedFileName || attachmentUploadState.currentFileName || "未知文件"
  const reason = attachmentUploadState.failedMessage || "请稍后重试"
  return `${fileName} 上传失败：${reason}`
})
const attachmentUploadRetryHint = computed(() => {
  return canSubmitPublish.value
    ? "修复网络或接口问题后，可再次点击“提交发布”重试附件上传；已成功上传的分片会优先复用。"
    : "修复网络或接口问题后，可再次点击“保存成果”重试附件上传；已成功上传的分片会优先复用。"
})

// 板块折叠状态
const collapsedSections = ref<Record<string, boolean>>({})

function toggleSection(sectionKey: string) {
  collapsedSections.value[sectionKey] = !collapsedSections.value[sectionKey]
}

const layerCount = ref(0)
const drawFeatureCount = ref(0)
const currentViewCenter = ref("")
const coverFileList = ref<UploadFile[]>([])
const attachmentFileList = ref<UploadFile[]>([])
const attachmentUploadState = reactive({
  phase: "idle" as "idle" | "uploading" | "failed" | "success",
  currentFileName: "",
  currentIndex: 0,
  total: 0,
  percent: 0,
  failedFileName: "",
  failedMessage: ""
})
const getMapInstance = inject<(() => any) | null>("getMapInstance", null)

let scopeDrawLayer: any | null = null
const scopeGraphic = ref<any | null>(null)
const scopeAreaText = ref("")

const attachmentAccept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.csv,.txt,.json,.geojson,.xml,.tif,.tiff,.png,.jpg,.jpeg"
const maxAttachmentSize = 5 * 1024 * 1024 * 1024

function getExtLower(name: string): string {
  const s = String(name || "")
  const idx = s.lastIndexOf(".")
  if (idx < 0) {
    return ""
  }
  return s.slice(idx + 1).toLowerCase()
}

function pickArtifactType(file: File): ArtifactType {
  const ext = getExtLower(file?.name || "")
  if (ext === "pdf" || ext === "doc" || ext === "docx") {
    return "report"
  }
  if (ext === "log") {
    return "log"
  }
  if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "tif" || ext === "tiff") {
    return "export"
  }
  if (ext === "geojson" || ext === "json" || ext === "xml" || ext === "csv" || ext === "xls" || ext === "xlsx") {
    return "data"
  }
  if (ext === "zip" || ext === "rar" || ext === "7z") {
    return "data"
  }
  return "other"
}

const nameConflictOpen = ref(false)
const nameConflictName = ref("")
let resolveNameConflictPromise: ((v: "cover" | "rename" | "cancel") => void) | null = null

function resolveNameConflict(v: "cover" | "rename" | "cancel") {
  nameConflictOpen.value = false
  const fn = resolveNameConflictPromise
  resolveNameConflictPromise = null
  fn?.(v)
}

function promptNameConflict(name: string): Promise<"cover" | "rename" | "cancel"> {
  nameConflictName.value = name
  nameConflictOpen.value = true
  return new Promise((resolve) => {
    resolveNameConflictPromise = resolve
  })
}

const draftStore = createStore("mars3d-save-manifest-db", "save-manifest-drafts")
const DRAFT_KEY = "save_manifest_draft_v1"
const DRAFT_LS_KEY = "save_manifest_draft_ls_v1"
const draftInfo = ref<{ updatedAt: number; action: "save" | "publish" } | null>(null)
const draftLoaded = ref(false)
const draftRestored = ref(false)
let cachedDraft: any | null = null
let draftSaveTimer: number | null = null

const availableLayers = ref<Array<{ id: string; name: string; visible: boolean }>>([])
const selectedLayerIds = ref<string[]>([])

const dirRefreshSeq = ref(0)
const moveTargetPid = ref<string | undefined>(undefined)
const renameDirId = ref<string | undefined>(undefined)
const createDirOpen = ref(false)
const createDirName = ref("")
const createDirPid = ref<string | undefined>(undefined)
const renameDirOpen = ref(false)
const renameDirName = ref("")

const coverPreviewUrl = ref("")
const autoCoverLoading = ref(false)
let autoCoverTimer: number | null = null
let autoCoverSeq = 0

const thematicApiAvailable = ref(true)
const thematicLoading = ref(false)
const thematicLoaded = ref(false)
const thematicDatasetId = ref<string>("")
const thematicThumbs = ref<Array<{ artifactId: string; url: string; name: string; jobId: string }>>([])
const selectedThematic = ref<{ artifactId: string; url: string; name: string; jobId: string } | null>(null)
let thematicCoverBlob: Blob | null = null
let coverObjectUrl: string | null = null
let cameraChangedHandler: (() => void) | null = null
let autoCoverInitTimer: number | null = null
let autoCoverIdleId: number | null = null

const thematicSelectable = computed(() => thematicApiAvailable.value)

const draftTipVisible = computed(() => visible.value && !!draftInfo.value && !draftRestored.value && isDraftPromptSafe())
const draftTipMessage = computed(() => {
  const info = draftInfo.value
  if (!info) {
    return ""
  }
  return `检测到未提交草稿（${formatTime(info.updatedAt)}），可恢复继续提交`
})

function isAutoGeneratedName(name: string): boolean {
  const n = String(name || "").trim()
  if (!n) {
    return false
  }
  return /^(保存成果|提交发布)-\d{8}-\d{6}$/.test(n)
}

function isDraftPromptSafe(): boolean {
  const nameEdited = !!formState.name && !isAutoGeneratedName(formState.name)
  if (nameEdited || formState.description) {
    return false
  }
  if (Array.isArray(formState.tags) && formState.tags.length) {
    return false
  }
  if (coverFileList.value.length || attachmentFileList.value.length) {
    return false
  }
  if (scopeGraphic.value) {
    return false
  }
  return true
}

// 监听打开状态，更新预览信息
watch(() => props.open, (newVal) => {
  if (newVal) {
    try {
      window.dispatchEvent(new CustomEvent("mars3d:modal-open", { detail: { name: "save-manifest" } }))
    } catch {
    }
    saveStep.value = "edit"
    previewManifest.value = null
    previewLayerLines.value = []
    previewDrawCount.value = 0
    previewViewText.value = ""
    if (props.initialVisibility) {
      formState.visibility = props.initialVisibility
    }
    if (props.initialSubmitForReview) {
      formState.visibility = "shared"
    }
    // 自动生成名称
    if (!formState.name) {
      formState.name = buildDefaultName(canSubmitPublish.value ? "publish" : "save")
    }
    dirRefreshSeq.value = dirRefreshSeq.value + 1
    nextTick(() => {
      window.setTimeout(() => {
        if (!visible.value) {
          return
        }
        updatePreview()
        refreshAvailableLayers()
        initLayerSelection()
        initCoverPreview()
      }, 0)
    })
    draftRestored.value = false
    draftLoaded.value = false
    draftInfo.value = null
    cachedDraft = null
    let preset = false
    try {
      const raw = localStorage.getItem(DRAFT_LS_KEY)
      if (raw) {
        const entry = JSON.parse(raw)
        if (entry && typeof entry.updatedAt === "number") {
          cachedDraft = entry
          draftInfo.value = { updatedAt: entry.updatedAt, action: entry.action === "publish" ? "publish" : "save" }
          draftLoaded.value = true
          preset = true
        }
      }
    } catch {
      preset = false
    }
    if (!preset) {
      loadDraft().catch(() => {})
    }
  } else {
    unbindCameraPreview()
    saveStep.value = "edit"
    previewManifest.value = null
    resetForm()
  }
}, { immediate: true })

watch(canSubmitPublish, (v) => {
  if (!visible.value) {
    return
  }
  if (!formState.name) {
    formState.name = buildDefaultName(v ? "publish" : "save")
  }
})

watch(() => formState.scopeMode, (val) => {
  if (val !== "selection") {
    clearScopeSelection()
  }
  updatePreview()
})

watch(() => formState.coverMode, () => {
  initCoverPreview()
})

watch(
  () => selectedLayerIds.value,
  () => {
    updatePreview()
  },
  { deep: true }
)

watch(
  () => [visible.value, formState, coverFileList.value, attachmentFileList.value] as any,
  () => {
    if (!visible.value) {
      return
    }
    scheduleDraftSave("save")
  },
  { deep: true }
)

function refreshAvailableLayers(): void {
  const map = getMapSafe()
  if (!map) {
    availableLayers.value = []
    return
  }
  const layers = map.getLayers?.({ basemaps: false }) || []
  availableLayers.value = layers
    .filter((l: any) => {
      const t = String(l?.type || l?.options?.type || "")
      return t !== "group" && String(l?.constructor?.name || "") !== "GroupLayer"
    })
    .map((l: any, idx: number) => {
    const id = String(l?.id ?? `layer_${idx}`)
    const name = String(l?.name ?? "")
    const visible = !!l?.show
    return { id, name, visible }
    })
}

function initLayerSelection(): void {
  if (selectedLayerIds.value.length) {
    return
  }
  const preset = Array.isArray(props.layerFilter) && props.layerFilter.length ? props.layerFilter.map(String) : []
  if (preset.length) {
    selectedLayerIds.value = preset
    return
  }
  selectedLayerIds.value = availableLayers.value.map((l) => l.id)
}

function selectAllLayers(): void {
  selectedLayerIds.value = availableLayers.value.map((l) => l.id)
}

function clearAllLayers(): void {
  selectedLayerIds.value = []
}

function effectiveLayerFilter(): string[] | undefined {
  if (!formState.includeItems.includes("layers")) {
    return undefined
  }
  const allIds = availableLayers.value.map((l) => l.id)
  if (!selectedLayerIds.value.length) {
    return []
  }
  if (selectedLayerIds.value.length === allIds.length) {
    return undefined
  }
  return selectedLayerIds.value.slice()
}

type SelectOption = { label: string; value: string }

function getGroupLayersForDir(): Array<{ id: string; name: string; pid: string | null; order: number }> {
  const map = getMapSafe()
  if (!map) {
    return []
  }
  const layers = map.getLayers?.({ basemaps: false }) || []
  const groups: Array<{ id: string; name: string; pid: string | null; order: number }> = []
  layers.forEach((l: any, index: number) => {
    const t = String(l?.type || l?.options?.type || "")
    if (t !== "group" && String(l?.constructor?.name || "") !== "GroupLayer") {
      return
    }
    const id = String(l?.id || "")
    if (!id) {
      return
    }
    const pidRaw = l?.pid ?? l?.options?.pid
    const pid = pidRaw === null || pidRaw === undefined || String(pidRaw) === "" ? null : String(pidRaw)
    groups.push({ id, name: String(l?.name || id), pid, order: index })
  })
  return groups
}

function buildDirOptions(_seq: number): SelectOption[] {
  if (_seq < 0) {
    return []
  }
  const groups = getGroupLayersForDir()
  if (!groups.length) {
    return []
  }
  const byId = new Map<string, { id: string; name: string; pid: string | null; order: number }>()
  groups.forEach((g) => byId.set(g.id, g))
  const childrenByPid = new Map<string, string[]>()
  groups.forEach((g) => {
    const key = g.pid ? g.pid : ""
    const arr = childrenByPid.get(key) || []
    arr.push(g.id)
    childrenByPid.set(key, arr)
  })
  for (const [k, arr] of childrenByPid.entries()) {
    arr.sort((a, b) => (byId.get(a)?.order ?? 0) - (byId.get(b)?.order ?? 0))
    childrenByPid.set(k, arr)
  }
  const roots: string[] = []
  groups.forEach((g) => {
    if (!g.pid) {
      roots.push(g.id)
      return
    }
    if (!byId.has(g.pid)) {
      roots.push(g.id)
    }
  })
  roots.sort((a, b) => (byId.get(a)?.order ?? 0) - (byId.get(b)?.order ?? 0))

  const out: SelectOption[] = []
  const seen = new Set<string>()
  const dfs = (id: string, depth: number) => {
    if (seen.has(id)) {
      return
    }
    seen.add(id)
    const g = byId.get(id)
    if (!g) {
      return
    }
    out.push({ value: id, label: `${"\u00A0".repeat(depth * 2)}${g.name}` })
    const children = childrenByPid.get(id) || []
    children.forEach((cid) => dfs(cid, depth + 1))
  }
  roots.forEach((id) => dfs(id, 0))
  return out
}

const dirSelectOptions = computed<SelectOption[]>(() => buildDirOptions(dirRefreshSeq.value))
const dirOnlySelectOptions = computed<SelectOption[]>(() => buildDirOptions(dirRefreshSeq.value))

function openCreateDir(): void {
  createDirName.value = ""
  createDirPid.value = undefined
  createDirOpen.value = true
}

function closeCreateDir(): void {
  createDirOpen.value = false
}

function confirmCreateDir(): void {
  const name = String(createDirName.value || "").trim()
  if (!name) {
    $message("请输入目录名称")
    return
  }
  const id = `save_group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  mapWork.ensureGroupLayer(id, name, createDirPid.value || null)
  dirRefreshSeq.value = dirRefreshSeq.value + 1
  createDirOpen.value = false
}

function openRenameDir(): void {
  const id = String(renameDirId.value || "")
  if (!id) {
    return
  }
  const map = getMapSafe()
  const layer = map?.getLayerById?.(id)
  renameDirName.value = String((layer as any)?.name || "")
  renameDirOpen.value = true
}

function closeRenameDir(): void {
  renameDirOpen.value = false
}

function confirmRenameDir(): void {
  const id = String(renameDirId.value || "")
  const name = String(renameDirName.value || "").trim()
  if (!id || !name) {
    return
  }
  const ok = mapWork.setLayerName(id, name)
  if (!ok) {
    $message("重命名失败")
    return
  }
  dirRefreshSeq.value = dirRefreshSeq.value + 1
  renameDirOpen.value = false
}

function moveSelectedLayersToDir(): void {
  if (!selectedLayerIds.value.length) {
    return
  }
  const pid = moveTargetPid.value ? String(moveTargetPid.value) : null
  selectedLayerIds.value.forEach((id) => {
    mapWork.setLayerPid(id, pid)
  })
  dirRefreshSeq.value = dirRefreshSeq.value + 1
  updatePreview()
}

function setCoverPreview(url: string): void {
  if (coverObjectUrl && coverObjectUrl !== url) {
    try {
      URL.revokeObjectURL(coverObjectUrl)
    } catch {
    }
    coverObjectUrl = null
  }
  coverPreviewUrl.value = url
}

function initCoverPreview(): void {
  if (!visible.value) {
    return
  }

  if (formState.coverMode === "upload") {
    const f = coverFileList.value[0]?.originFileObj as File | undefined
    if (f) {
      const next = URL.createObjectURL(f)
      coverObjectUrl = next
      setCoverPreview(next)
    } else {
      setCoverPreview("")
    }
    return
  }

  if (formState.coverMode === "thematic") {
    setCoverPreview(selectedThematic.value?.url || "")
    return
  }

  const viewState = getViewStateSafe()
  const coverKey = computeCoverCacheKey(viewState || {})
  const cached = getCoverCache(coverKey)
  if (cached) {
    setCoverPreview(cached)
    return
  }
  setCoverPreview("")
  scheduleAutoCoverPreview()
}

function scheduleAutoCoverPreview(): void {
  if (!visible.value || formState.coverMode !== "auto") {
    return
  }
  if (autoCoverInitTimer != null) {
    window.clearTimeout(autoCoverInitTimer)
    autoCoverInitTimer = null
  }
  if (autoCoverIdleId != null) {
    try {
      ;(window as any).cancelIdleCallback?.(autoCoverIdleId)
    } catch {
    }
    autoCoverIdleId = null
  }

  const run = () => {
    autoCoverInitTimer = null
    autoCoverIdleId = null
    if (!visible.value || formState.coverMode !== "auto") {
      return
    }
    refreshAutoCoverPreview()
  }

  const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout?: number }) => number)
  if (typeof ric === "function") {
    autoCoverIdleId = ric(run, { timeout: 1200 })
    return
  }
  autoCoverInitTimer = window.setTimeout(run, 220)
}

function bindCameraPreview(): void {
  const map = getMapSafe()
  const camera = map?.camera
  if (!camera || cameraChangedHandler) {
    return
  }

  cameraChangedHandler = () => {
    if (!visible.value || formState.coverMode !== "auto") {
      return
    }
    if (autoCoverTimer != null) {
      window.clearTimeout(autoCoverTimer)
      autoCoverTimer = null
    }
    autoCoverTimer = window.setTimeout(() => {
      autoCoverTimer = null
      refreshAutoCoverPreview()
    }, 800)
  }
  camera.changed.addEventListener(cameraChangedHandler)
}

function unbindCameraPreview(): void {
  const map = getMapSafe()
  const camera = map?.camera
  if (camera && cameraChangedHandler) {
    try {
      camera.changed.removeEventListener(cameraChangedHandler)
    } catch {
    }
  }
  cameraChangedHandler = null
  if (autoCoverInitTimer != null) {
    window.clearTimeout(autoCoverInitTimer)
    autoCoverInitTimer = null
  }
  if (autoCoverIdleId != null) {
    try {
      ;(window as any).cancelIdleCallback?.(autoCoverIdleId)
    } catch {
    }
    autoCoverIdleId = null
  }
  if (autoCoverTimer != null) {
    window.clearTimeout(autoCoverTimer)
    autoCoverTimer = null
  }
}

async function refreshAutoCoverPreview(): Promise<void> {
  const map = getMapSafe()
  if (!map) {
    return
  }
  autoCoverLoading.value = true
  const seq = ++autoCoverSeq
  try {
    const viewState = getViewStateSafe()
    const coverKey = computeCoverCacheKey(viewState || {})
    const blob = await mapWork.captureCoverImage(
      { minWidth: 800, minHeight: 600, targetWidth: 1024, targetHeight: 768, mime: "image/jpeg", quality: 0.88, title: formState.name },
      map
    )
    if (seq !== autoCoverSeq) {
      return
    }
    const dataUrl = await blobToDataUrl(blob)
    if (seq !== autoCoverSeq) {
      return
    }
    setCoverCache(coverKey, dataUrl)
    setCoverPreview(dataUrl)
  } catch {
  } finally {
    if (seq === autoCoverSeq) {
      autoCoverLoading.value = false
    }
  }
}

async function checkThematicApiAvailable(): Promise<void> {
  const res = await getTemplates()
  if (!res.success && res.code === 404) {
    thematicApiAvailable.value = false
  }
}

async function handleNameBlur(): Promise<void> {
  if (!visible.value) {
    return
  }
  await checkThematicApiAvailable()
  if (!thematicApiAvailable.value) {
    thematicDatasetId.value = ""
    return
  }

  const name = String(formState.name || "").trim()
  if (!name) {
    thematicDatasetId.value = ""
    return
  }
  const localExisting = findLocalDatasetIdByName(name)
  if (localExisting) {
    thematicDatasetId.value = localExisting
    return
  }

  try {
    const list = await getDatasets({ limit: 200 })
    const found = list.success && list.data
      ? list.data.find((c: any) => String(c?.title || "") === name || String(c?.id || "") === name)
      : null
    thematicDatasetId.value = found?.id ? String(found.id) : ""
  } catch {
    thematicDatasetId.value = ""
  }
}

async function loadThematicThumbs(): Promise<void> {
  const datasetId = thematicDatasetId.value
  if (!datasetId || !thematicApiAvailable.value) {
    return
  }
  thematicLoading.value = true
  thematicLoaded.value = false
  thematicThumbs.value = []
  try {
    const jobsRes = await getJobs({ datasetId, status: "succeeded", limit: 20, offset: 0 })
    if (!jobsRes.success) {
      if (jobsRes.code === 404) {
        thematicApiAvailable.value = false
      }
      return
    }

    const jobs = Array.isArray(jobsRes.data) ? jobsRes.data : []
    const thumbs: Array<{ artifactId: string; url: string; name: string; jobId: string }> = []
    const seen = new Set<string>()
    for (const job of jobs) {
      if (thumbs.length >= 12) {
        break
      }
      const r = await getJobResult(job.jobId)
      if (!r.success || !r.data) {
        continue
      }
      const artifacts = Array.isArray(r.data.artifacts) ? r.data.artifacts : []
      for (const a of artifacts) {
        if (thumbs.length >= 12) {
          break
        }
        const art = a as Artifact
        const url = String(art?.url || "")
        const mime = String(art?.mime || "")
        if (!url) {
          continue
        }
        const isImg = mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url)
        if (!isImg && art?.type !== "thumbnail") {
          continue
        }
        if (seen.has(art.artifactId)) {
          continue
        }
        seen.add(art.artifactId)
        thumbs.push({ artifactId: art.artifactId, url, name: art.name || "缩略图", jobId: job.jobId })
      }
    }
    thematicThumbs.value = thumbs
    thematicLoaded.value = true
  } finally {
    thematicLoading.value = false
  }
}

async function selectThematicThumb(t: { artifactId: string; url: string; name: string; jobId: string }): Promise<void> {
  selectedThematic.value = t
  thematicCoverBlob = null
  setCoverPreview(t.url)
  try {
    const res = await fetch(t.url)
    thematicCoverBlob = await res.blob()
  } catch {
    thematicCoverBlob = null
  }
}

// 更新预览信息
function updatePreview() {
  const map = getMapSafe()
  if (!map) {
    return
  }

  // 获取图层数量
  if (formState.includeItems.includes("layers")) {
    const layers = map.getLayers?.({ basemaps: false }) || []
    const filter = effectiveLayerFilter()
    const filterIds = Array.isArray(filter) ? new Set(filter.map(String)) : null
    layerCount.value = filterIds ? layers.filter((l: any) => filterIds.has(String(l?.id))).length : layers.length
  } else {
    layerCount.value = 0
  }

  // 获取绘制要素数量
  if (formState.includeItems.includes("drawFeatures")) {
    const filter = buildDrawFeatureFilter()
    const onlyDraw = serializeWorkspace(map, {
      includeViewState: false,
      includeLayers: false,
      includeDrawFeatures: true,
      drawFeatureFilter: filter
    })
    drawFeatureCount.value = onlyDraw.drawFeatures?.length || 0
  } else {
    drawFeatureCount.value = 0
  }

  // 获取当前视角
  const viewState = getViewStateSafe()
  if (viewState?.center) {
    currentViewCenter.value = `${viewState.center.longitude.toFixed(4)}, ${viewState.center.latitude.toFixed(4)}`
  }
}

function getMapSafe(): any | null {
  const injected = getMapInstance?.()
  if (injected) {
    return injected
  }
  return mapWork.getMap()
}

function getViewStateSafe(): any {
  const fromModule = mapWork.getViewState()
  if (fromModule) {
    return fromModule
  }
  const map = getMapSafe()
  if (!map) {
    return null
  }
  const camera = map.camera
  if (!camera) {
    return null
  }
  const center = camera.positionCartographic
  const rectangle = camera.computeViewRectangle?.()
  const bbox: [number, number, number, number] = rectangle
    ? [
        Cesium.Math.toDegrees(rectangle.west),
        Cesium.Math.toDegrees(rectangle.south),
        Cesium.Math.toDegrees(rectangle.east),
        Cesium.Math.toDegrees(rectangle.north)
      ]
    : [0, 0, 0, 0]

  return {
    center: {
      longitude: Cesium.Math.toDegrees(center.longitude),
      latitude: Cesium.Math.toDegrees(center.latitude)
    },
    zoom: 0,
    heading: Cesium.Math.toDegrees(camera.heading),
    pitch: Cesium.Math.toDegrees(camera.pitch),
    bbox,
    timestamp: Date.now()
  }
}

function ensureScopeDrawLayer() {
  const map = getMapSafe()
  if (!map) {
    return null
  }
  if (scopeDrawLayer) {
    return scopeDrawLayer
  }
  try {
    scopeDrawLayer = new (mars3d as any).layer.GraphicLayer({
      id: `__save_manifest_scope_${Date.now()}`,
      name: "保存范围框选",
      show: true
    })
    map.addLayer(scopeDrawLayer)
    return scopeDrawLayer
  } catch {
    return null
  }
}

function startScopeDraw(type: "rectangle" | "polygon") {
  const map = getMapSafe()
  if (!map) {
    $message("地图未初始化")
    return
  }
  const layer = ensureScopeDrawLayer()
  if (!layer) {
    $message("框选能力不可用")
    return
  }
  try {
    layer.clear?.()
  } catch {
  }
  scopeGraphic.value = null
  scopeAreaText.value = ""
  try {
    layer.startDraw({
      type,
      style: {
        fill: true,
        color: "rgba(255,255,0,0.2)",
        outline: true,
        outlineWidth: 2,
        outlineColor: "rgba(255,255,0,1)"
      },
      success: function (graphic: any) {
        scopeGraphic.value = graphic
        updateScopeArea()
        updatePreview()
      }
    })
  } catch {
    $message("框选失败")
  }
}

function updateScopeArea() {
  const g = scopeGraphic.value
  if (!g) {
    scopeAreaText.value = ""
    return
  }
  const area = getPolygonArea(g)
  if (typeof area !== "number" || !Number.isFinite(area) || area <= 0) {
    scopeAreaText.value = ""
    return
  }
  scopeAreaText.value = `框选面积：${formatArea(area)}`
}

function formatArea(area: number): string {
  if (area >= 1_000_000) {
    return `${(area / 1_000_000).toFixed(2)} km²`
  }
  return `${area.toFixed(0)} ㎡`
}

function clearScopeSelection() {
  const layer = scopeDrawLayer
  const g = scopeGraphic.value
  if (layer && g) {
    try {
      layer.removeGraphic?.(g)
    } catch {
    }
    try {
      layer.remove?.(g)
    } catch {
    }
  }
  scopeGraphic.value = null
  scopeAreaText.value = ""
}

function buildDrawFeatureFilter(): { bbox?: [number, number, number, number]; polygon?: Array<[number, number]> } | undefined {
  if (formState.scopeMode === "all") {
    return undefined
  }
  if (formState.scopeMode === "currentView") {
    const vs = getViewStateSafe()
    if (vs?.bbox && Array.isArray(vs.bbox) && vs.bbox.length === 4) {
      return { bbox: vs.bbox }
    }
    return undefined
  }
  const g = scopeGraphic.value
  if (!g) {
    return undefined
  }
  const ring = getGraphicRing(g)
  if (!ring || ring.length < 3) {
    return undefined
  }
  if (String(g.type || "") === "polygon") {
    return { polygon: ring }
  }
  const bbox = ringToBbox(ring)
  return bbox ? { bbox } : undefined
}

function ringToBbox(ring: Array<[number, number]>): [number, number, number, number] | null {
  let west = Number.POSITIVE_INFINITY
  let south = Number.POSITIVE_INFINITY
  let east = Number.NEGATIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY
  for (const [lng, lat] of ring) {
    if (lng < west) { west = lng }
    if (lng > east) { east = lng }
    if (lat < south) { south = lat }
    if (lat > north) { north = lat }
  }
  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
    return null
  }
  return [west, south, east, north]
}

function beforeCoverUpload(file: any) {
  const type = String(file?.type || "")
  if (!type.startsWith("image/")) {
    $message("请选择图片文件")
    return false
  }
  coverFileList.value = [
    {
      uid: String(Date.now()),
      name: String(file?.name || "cover"),
      status: "done",
      originFileObj: file
    } as UploadFile
  ]
  selectedThematic.value = null
  thematicCoverBlob = null
  const next = URL.createObjectURL(file as File)
  coverObjectUrl = next
  setCoverPreview(next)
  return false
}

function removeCover() {
  coverFileList.value = []
  selectedThematic.value = null
  thematicCoverBlob = null
  coverPreviewUrl.value = ""
  return true
}

function beforeAttachmentUpload(file: any) {
  const f = file as File
  if (!isAllowedAttachmentFile(f)) {
    $message("附件类型不支持：仅支持常见文档/压缩包/图片/栅格等格式")
    return false
  }
  if (typeof f?.size === "number" && f.size > maxAttachmentSize) {
    $message("附件超过 5GB，当前版本暂不支持")
    return false
  }
  attachmentFileList.value = [
    ...attachmentFileList.value,
    {
      uid: String(Date.now() + Math.random()),
      name: String(f?.name || "file"),
      status: "done",
      originFileObj: f
    } as UploadFile
  ]
  return false
}

function removeAttachment(file: UploadFile) {
  attachmentFileList.value = attachmentFileList.value.filter((x) => x.uid !== file.uid)
  return true
}

function resetAttachmentUploadFeedback() {
  attachmentUploadState.phase = "idle"
  attachmentUploadState.currentFileName = ""
  attachmentUploadState.currentIndex = 0
  attachmentUploadState.total = 0
  attachmentUploadState.percent = 0
  attachmentUploadState.failedFileName = ""
  attachmentUploadState.failedMessage = ""
}

function clearAttachmentUploadFeedback() {
  if (attachmentUploadState.phase === "failed") {
    resetAttachmentUploadFeedback()
  }
}

function startAttachmentUploadFeedback(total: number) {
  attachmentUploadState.phase = "uploading"
  attachmentUploadState.currentFileName = ""
  attachmentUploadState.currentIndex = 0
  attachmentUploadState.total = total
  attachmentUploadState.percent = 0
  attachmentUploadState.failedFileName = ""
  attachmentUploadState.failedMessage = ""
}

function updateAttachmentUploadFeedback(fileName: string, currentIndex: number, total: number, percent: number) {
  attachmentUploadState.phase = "uploading"
  attachmentUploadState.currentFileName = fileName
  attachmentUploadState.currentIndex = currentIndex
  attachmentUploadState.total = total
  attachmentUploadState.percent = Math.max(0, Math.min(100, Number(percent.toFixed(1))))
}

function markAttachmentUploadFailed(fileName: string, message: string, currentIndex: number, total: number, percent: number) {
  attachmentUploadState.phase = "failed"
  attachmentUploadState.currentFileName = fileName
  attachmentUploadState.currentIndex = currentIndex
  attachmentUploadState.total = total
  attachmentUploadState.percent = Math.max(0, Math.min(100, Number(percent.toFixed(1))))
  attachmentUploadState.failedFileName = fileName
  attachmentUploadState.failedMessage = message
}

function markAttachmentUploadSuccess(lastFileName: string, total: number) {
  attachmentUploadState.phase = "success"
  attachmentUploadState.currentFileName = lastFileName
  attachmentUploadState.currentIndex = total
  attachmentUploadState.total = total
  attachmentUploadState.percent = 100
  attachmentUploadState.failedFileName = ""
  attachmentUploadState.failedMessage = ""
}

function isAllowedAttachmentFile(file: File): boolean {
  const name = String(file?.name || "")
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() || "" : ""
  const allowedExt = new Set([
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "zip", "rar", "7z",
    "csv", "txt", "json", "geojson", "xml",
    "tif", "tiff",
    "png", "jpg", "jpeg"
  ])
  if (ext && allowedExt.has(ext)) {
    return true
  }
  const mime = String((file as any)?.type || "").toLowerCase()
  if (mime.startsWith("image/")) {
    return true
  }
  if (mime === "application/pdf") {
    return true
  }
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z")) {
    return true
  }
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("word") || mime.includes("powerpoint")) {
    return true
  }
  if (mime.includes("json") || mime.includes("xml") || mime.includes("csv") || mime.includes("text")) {
    return true
  }
  return false
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("read error"))
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return await res.blob()
}

function buildDefaultName(kind: "save" | "publish"): string {
  const date = new Date()
  const y = String(date.getFullYear())
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  const ss = String(date.getSeconds()).padStart(2, "0")
  const prefix = kind === "publish" ? "提交发布" : "保存成果"
  return `${prefix}-${y}${m}${d}-${hh}${mm}${ss}`
}

function backToEdit() {
  saveStep.value = "edit"
  previewManifest.value = null
  previewLayerLines.value = []
  previewDrawCount.value = 0
  previewViewText.value = ""
}

function buildPreviewLayerLines(layers?: Manifest["layers"]) {
  const list = Array.isArray(layers) ? layers : []
  if (!list.length) {
    return []
  }
  const pidById = new Map<string, string | null>()
  const isGroupById = new Map<string, boolean>()
  const nameById = new Map<string, string>()
  list.forEach((l: any) => {
    const id = String(l?.id || "")
    if (!id) {
      return
    }
    const pidRaw = (l as any)?.pid
    const pid = pidRaw === null || pidRaw === undefined || String(pidRaw) === "" ? null : String(pidRaw)
    pidById.set(id, pid)
    isGroupById.set(id, String((l as any)?.sourceType || "") === "group")
    nameById.set(id, String((l as any)?.name || id))
  })
  const depthCache = new Map<string, number>()
  const depthOf = (id: string): number => {
    const cached = depthCache.get(id)
    if (cached !== undefined) {
      return cached
    }
    const pid = pidById.get(id)
    if (!pid || !pidById.has(pid)) {
      depthCache.set(id, 0)
      return 0
    }
    const d = Math.min(20, depthOf(pid) + 1)
    depthCache.set(id, d)
    return d
  }
  return list
    .map((l: any) => {
      const id = String(l?.id || "")
      const name = nameById.get(id) || id
      return { id, name, depth: depthOf(id), isGroup: !!isGroupById.get(id) }
    })
    .filter((x) => !!x.id)
}

function formatPreviewViewText(vs: any): string {
  if (!vs?.center) {
    return ""
  }
  const lng = Number(vs.center.longitude)
  const lat = Number(vs.center.latitude)
  const zoom = Number(vs.zoom)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return ""
  }
  const z = Number.isFinite(zoom) ? ` | zoom ${zoom}` : ""
  return `${lng.toFixed(4)}, ${lat.toFixed(4)}${z}`
}

async function startPreview(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  const map = getMapSafe()
  if (!map) {
    $message("地图未初始化")
    return
  }

  if (formState.scopeMode === "selection" && !scopeGraphic.value) {
    $message("请先完成框选范围")
    return
  }

  const manifest = serializeWorkspace(map, {
    includeViewState: formState.includeItems.includes("viewState"),
    includeLayers: formState.includeItems.includes("layers"),
    includeDrawFeatures: formState.includeItems.includes("drawFeatures"),
    layerFilter: effectiveLayerFilter(),
    drawFeatureFilter: formState.includeItems.includes("drawFeatures") ? buildDrawFeatureFilter() : undefined
  })

  const validation = validateManifest(manifest)
  if (!validation.valid) {
    const hasEmpty = validation.errors.some((e) => String(e).includes("成果内容为空"))
    $message(hasEmpty ? "当前无内容可保存" : `验证失败: ${validation.errors.join(", ")}`)
    return
  }

  previewManifest.value = manifest
  previewLayerLines.value = buildPreviewLayerLines(manifest.layers)
  previewDrawCount.value = manifest.drawFeatures?.length || 0
  previewViewText.value = manifest.viewState ? formatPreviewViewText(manifest.viewState) : ""
  saveStep.value = "preview"
}

async function handleSaveOnly() {
  await startPreview()
}

async function handleSubmitPublish() {
  await startPreview()
}

function closeSubmitSuccess() {
  submitSuccessOpen.value = false
  resetForm()
}

async function confirmPreview(action: "save" | "publish") {
  if (!previewManifest.value) {
    await startPreview()
  }
  const manifest = previewManifest.value
  if (!manifest) {
    return
  }
  await doSaveWithManifest({ action }, manifest)
}

async function doSaveWithManifest(params: { action: "save" | "publish" }, manifest: Manifest) {
  saving.value = true

  try {
    resetAttachmentUploadFeedback()
    const map = getMapSafe()
    if (!map) {
      $message("地图未初始化")
      return
    }

    // 保存到 eoAPI
    const visibilityToSave: DatasetVisibility = "private"
    const allowLocalFallback = params.action === "save" || localApiMode.value

    const viewState = getViewStateSafe()
    const coverKey = computeCoverCacheKey(viewState || {})
    let coverDataUrl = getCoverCache(coverKey)
    let coverBlob: Blob | null = null

    const uploadFile = formState.coverMode === "upload" ? coverFileList.value[0]?.originFileObj : undefined
    if (uploadFile) {
      coverBlob = uploadFile as File
    } else if (formState.coverMode === "thematic") {
      if (thematicCoverBlob) {
        coverBlob = thematicCoverBlob
        try {
          coverDataUrl = await blobToDataUrl(coverBlob)
        } catch {
        }
      } else if (selectedThematic.value?.url) {
        try {
          const res = await fetch(selectedThematic.value.url)
          coverBlob = await res.blob()
          thematicCoverBlob = coverBlob
          coverDataUrl = await blobToDataUrl(coverBlob)
        } catch {
          coverBlob = null
        }
      }
    } else {
      try {
        if (coverDataUrl) {
          coverBlob = await dataUrlToBlob(coverDataUrl)
        } else {
          coverBlob = await mapWork.captureCoverImage({ minWidth: 800, minHeight: 600, targetWidth: 1024, targetHeight: 768, mime: "image/jpeg", quality: 0.88, title: formState.name }, map)
          coverDataUrl = await blobToDataUrl(coverBlob)
          setCoverCache(coverKey, coverDataUrl)
        }
      } catch {
        coverBlob = null
      }
    }

    let datasetId = ""
    let createdNewDataset = false
    let forceCover = false
    let existingNames = new Set<string>()
    let localNameExists = false

    const localExistingId = findLocalDatasetIdByName(formState.name)
    if (localExistingId) {
      localNameExists = true
      forceCover = true
    }

    try {
      const list = await getDatasets({ limit: 200 })
      const remoteNames = list.success && list.data ? list.data.map((c: any) => String(c?.title || c?.id || "")).filter(Boolean) : []
      for (const n of remoteNames) {
        existingNames.add(n)
      }
      const found = list.success && list.data
        ? list.data.find((c: any) => String(c?.title || "") === formState.name || String(c?.id || "") === formState.name)
        : null
      if (found?.id) {
        datasetId = String(found.id)
        forceCover = true
      }
    } catch {
    }
    existingNames = collectExistingNames(existingNames)

    if (forceCover && (datasetId || localNameExists)) {
      const choice = await promptNameConflict(formState.name)
      if (choice === "cancel") {
        return
      }
      if (choice === "rename") {
        const next = makeUniqueName(formState.name, existingNames)
        formState.name = next
        datasetId = ""
        forceCover = false
        localNameExists = false
      }
    }

    if (forceCover && datasetId) {
      const latest = await getLatestDatasetManifest(datasetId)
      if (latest.success && latest.data?.manifest && manifestEquals(latest.data.manifest, manifest)) {
        $message("内容未发生变化")
        return
      }
    }

    if (!datasetId) {
      const datasetResult = await createDataset({
        name: formState.name,
        description: formState.description,
        visibility: visibilityToSave,
        tags: formState.tags
      })

      if (datasetResult.success && datasetResult.data?.datasetId) {
        datasetId = datasetResult.data.datasetId
        createdNewDataset = true
      } else if (datasetResult.code === 409) {
        forceCover = true
        try {
          const list = await getDatasets({ limit: 200 })
          const found = list.success && list.data
            ? list.data.find((c: any) => String(c?.title || "") === formState.name || String(c?.id || "") === formState.name)
            : null
          if (found?.id) {
            datasetId = String(found.id)
          }
        } catch {
        }

        const choice = await promptNameConflict(formState.name)
        if (choice === "cancel") {
          return
        }

        if (choice === "rename") {
          const next = makeUniqueName(formState.name, existingNames)
          formState.name = next
          datasetId = ""
          forceCover = false
          localNameExists = false
          const retry = await createDataset({
            name: formState.name,
            description: formState.description,
            visibility: visibilityToSave,
            tags: formState.tags
          })
          if (retry.success && retry.data?.datasetId) {
            datasetId = retry.data.datasetId
            createdNewDataset = true
          } else {
            throw new Error(retry.message || "保存失败")
          }
        }

        if (choice === "cover" && !datasetId) {
          $message("无法获取同名数据集ID，请选择重命名")
          return
        }
      }
    }

    let result: any
    if (datasetId) {
      const rev = await createRevision(datasetId, {
        message: formState.description || (createdNewDataset ? "init" : "覆盖保存"),
        manifest
      })
      if (!rev.success || !rev.data) {
        result = rev
      } else {
        const revisionId = String(rev.data.revisionId || "")
        if (coverBlob) {
          const thumb = await uploadThumbnail(datasetId, coverBlob, revisionId || undefined)
          if (!thumb.success) {
            throw new Error(thumb.message || "封面上传失败")
          }
        }

      const files = attachmentFileList.value
        .map((x) => x.originFileObj as File | undefined)
        .filter((x): x is File => !!x)

      if (files.length) {
        startAttachmentUploadFeedback(files.length)
      }

      for (let index = 0; index < files.length; index++) {
        const f = files[index]
        updateAttachmentUploadFeedback(f.name, index + 1, files.length, (index / files.length) * 100)
        const up = await smartUploadArtifact({
          file: f,
          name: f.name,
          type: pickArtifactType(f),
          datasetId,
          revisionId: revisionId || undefined
        }, {
          onProgress: (percent) => {
            const totalPercent = ((index + (percent / 100)) / files.length) * 100
            updateAttachmentUploadFeedback(f.name, index + 1, files.length, totalPercent)
          }
        })
        if (!up.success) {
          markAttachmentUploadFailed(
            f.name,
            up.message || "上传失败",
            index + 1,
            files.length,
            (index / Math.max(1, files.length)) * 100
          )
          throw new Error(up.message || `附件上传失败: ${f.name}`)
        }
        updateAttachmentUploadFeedback(f.name, index + 1, files.length, ((index + 1) / files.length) * 100)
      }

      if (files.length) {
        markAttachmentUploadSuccess(files[files.length - 1].name, files.length)
      }
        result = { success: true, data: { datasetId, revisionId } }
      }
    } else {
      if (!allowLocalFallback) {
        throw new Error("服务不可用，无法提交发布")
      }
      result = await quickSaveManifest(formState.name, manifest, formState.description, visibilityToSave)
      if (result.success && result.data && coverDataUrl) {
        updateLocalDataset(String(result.data.datasetId || ""), {
          coverUrl: coverDataUrl,
          createNewVersion: false
        })
      }
      if (result.success && attachmentFileList.value.length) {
        $message("已本地保存：附件未上传")
      }
    }

    if (result.success && result.data) {
      if (params.action === "publish") {
        if (String(result.data.datasetId || "").startsWith("local_")) {
          requestDatasetShare(result.data.datasetId, "shared")
        } else {
          const submitRes = await submitDatasetPublishRequest(result.data.datasetId)
          if (!submitRes.success) {
            if (localApiMode.value) {
              requestDatasetShare(result.data.datasetId, "shared")
              $message("后端发布流程不可用，已改为本地提交发布")
            } else {
              throw new Error(submitRes.message || "提交发布失败")
            }
          }
        }
      }
      $message(params.action === "publish" ? "已提交发布" : "保存成功")
      emitDatasetSync({
        datasetId: String(result.data.datasetId || ""),
        reason: "saved",
        source: "SaveManifestDialog"
      })
      emit("saved", result.data)
      await clearDraft()
      backToEdit()
      submitSuccessOpen.value = params.action === "publish"
      visible.value = false
    } else {
      await persistDraft(params.action)
      $message(`${result.message || "保存失败"}（已保存草稿）`)
    }
  } catch (error: any) {
    await persistDraft(params.action)
    $message(`保存失败: ${error.message || "未知错误"}（已保存草稿）`)
  } finally {
    saving.value = false
  }
}

// 取消
function handleCancel() {
  backToEdit()
  visible.value = false
  resetForm()
}

function handleClosed() {
  backToEdit()
  resetForm()
}

function formatTime(ts: number): string {
  try {
    const d = new Date(ts)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const da = String(d.getDate()).padStart(2, "0")
    const hh = String(d.getHours()).padStart(2, "0")
    const mm = String(d.getMinutes()).padStart(2, "0")
    return `${y}-${m}-${da} ${hh}:${mm}`
  } catch {
    return ""
  }
}

function findLocalDatasetIdByName(name: string): string | null {
  try {
    const savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
    for (const [id, data] of Object.entries(savedManifests)) {
      if (!String(id).startsWith("local_")) {
        continue
      }
      if (String((data as any)?.name || "") === name) {
        return String(id)
      }
    }
    return null
  } catch {
    return null
  }
}

function collectExistingNames(set: Set<string>): Set<string> {
  try {
    const savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
    for (const [, data] of Object.entries(savedManifests)) {
      const n = String((data as any)?.name || "")
      if (n) {
        set.add(n)
      }
    }
  } catch {
  }
  return set
}

function makeUniqueName(base: string, existing: Set<string>): string {
  const trimmed = String(base || "").trim() || "保存成果"
  if (!existing.has(trimmed)) {
    return trimmed
  }
  for (let i = 1; i < 1000; i++) {
    const next = `${trimmed}-${i}`
    if (!existing.has(next)) {
      return next.length > 100 ? next.slice(0, 100) : next
    }
  }
  return `${trimmed}-${Date.now()}`.slice(0, 100)
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }
  const keys = Object.keys(value).sort()
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")
  return `{${body}}`
}

function normalizeManifestForCompare(m: any): any {
  if (!m || typeof m !== "object") {
    return m
  }
  const cloned = JSON.parse(JSON.stringify(m))
  if (cloned && typeof cloned === "object") {
    delete cloned.createdAt
    if (cloned.viewState && typeof cloned.viewState === "object") {
      delete cloned.viewState.timestamp
    }
  }
  return cloned
}

function manifestEquals(a: any, b: any): boolean {
  try {
    return stableStringify(normalizeManifestForCompare(a)) === stableStringify(normalizeManifestForCompare(b))
  } catch {
    return false
  }
}

async function loadDraft(): Promise<void> {
  if (draftLoaded.value) {
    return
  }
  let localEntry: any | null = null
  try {
    const raw = localStorage.getItem(DRAFT_LS_KEY)
    if (raw) {
      localEntry = JSON.parse(raw)
    }
  } catch {
    localEntry = null
  }
  cachedDraft = localEntry

  const timeout = (ms: number) =>
    new Promise<{ ok: false }>((resolve) => {
      window.setTimeout(() => resolve({ ok: false }), ms)
    })

  try {
    const raced: any = await Promise.race([idbGet<any>(DRAFT_KEY, draftStore), timeout(250)])
    const idbEntry = raced && typeof raced === "object" && typeof raced.updatedAt === "number" ? raced : null
    const lsTs = localEntry && typeof (localEntry as any).updatedAt === "number" ? (localEntry as any).updatedAt : -1
    const idbTs = idbEntry ? (idbEntry as any).updatedAt : -1
    if (idbTs > lsTs) {
      cachedDraft = idbEntry
    }
  } catch {
  }

  const entry = cachedDraft
  if (entry && typeof entry.updatedAt === "number") {
    draftInfo.value = { updatedAt: entry.updatedAt, action: entry.action === "publish" ? "publish" : "save" }
  } else {
    draftInfo.value = null
  }
  draftLoaded.value = true
}

async function persistDraft(action: "save" | "publish"): Promise<void> {
  try {
    const cover = coverFileList.value[0]?.originFileObj as File | undefined
    const attachments = attachmentFileList.value
      .map((x) => x.originFileObj as File | undefined)
      .filter((x): x is File => !!x)

    const ring = scopeGraphic.value ? getGraphicRing(scopeGraphic.value) : null
    const payload = {
      version: 1,
      updatedAt: Date.now(),
      action,
      data: {
        form: {
          name: formState.name,
          description: formState.description,
          visibility: formState.visibility,
          tags: formState.tags,
          coverMode: formState.coverMode,
          includeItems: formState.includeItems,
          scopeMode: formState.scopeMode,
          selectedLayerIds: selectedLayerIds.value
        },
        cover,
        selectedThematic: selectedThematic.value,
        attachments,
        scope: ring ? { ring } : null,
        layerFilter: Array.isArray(props.layerFilter) ? props.layerFilter.map(String) : null
      }
    }
    try {
      await idbSet(DRAFT_KEY, payload, draftStore)
    } catch {
    }
    try {
      const minimal = {
        version: payload.version,
        updatedAt: payload.updatedAt,
        action: payload.action,
        data: {
          form: payload.data.form,
          selectedThematic: payload.data.selectedThematic,
          scope: payload.data.scope,
          layerFilter: payload.data.layerFilter
        }
      }
      localStorage.setItem(DRAFT_LS_KEY, JSON.stringify(minimal))
    } catch {
    }
    cachedDraft = payload
    draftInfo.value = { updatedAt: payload.updatedAt, action }
    draftLoaded.value = true
  } catch {
  }
}

function scheduleDraftSave(action: "save" | "publish"): void {
  if (draftSaveTimer) {
    window.clearTimeout(draftSaveTimer)
  }
  draftSaveTimer = window.setTimeout(() => {
    draftSaveTimer = null
    persistDraft(action).catch(() => {})
  }, 800)
}

async function restoreDraft(): Promise<void> {
  await loadDraft()
  const entry = cachedDraft
  const data = entry?.data
  if (!data) {
    $message("未找到草稿")
    return
  }
  const form = data.form || {}
  formState.name = String(form.name || "")
  formState.description = String(form.description || "")
  formState.visibility = (form.visibility === "shared" ? "shared" : "private") as DatasetVisibility
  formState.tags = Array.isArray(form.tags) ? form.tags.map(String) : []
  formState.coverMode = form.coverMode === "upload" ? "upload" : "auto"
  if (form.coverMode === "thematic") {
    formState.coverMode = "thematic"
  }
  formState.includeItems = Array.isArray(form.includeItems) && form.includeItems.length ? form.includeItems : ["viewState", "layers", "drawFeatures"]
  formState.scopeMode = form.scopeMode === "all" || form.scopeMode === "selection" ? form.scopeMode : "currentView"
  if (Array.isArray(form.selectedLayerIds)) {
    selectedLayerIds.value = form.selectedLayerIds.map(String)
  }

  coverFileList.value = []
  attachmentFileList.value = []

  selectedThematic.value = data.selectedThematic || null
  thematicCoverBlob = null

  if (data.cover) {
    const f = data.cover as File
    coverFileList.value = [
      {
        uid: String(Date.now()),
        name: String(f?.name || "cover"),
        status: "done",
        originFileObj: f
      } as UploadFile
    ]
    const next = URL.createObjectURL(f)
    coverObjectUrl = next
    setCoverPreview(next)
  }

  if (Array.isArray(data.attachments)) {
    const files = data.attachments as File[]
    attachmentFileList.value = files.map((f) => ({
      uid: String(Date.now() + Math.random()),
      name: String(f?.name || "file"),
      status: "done",
      originFileObj: f
    })) as UploadFile[]
  }

  if (selectedThematic.value?.url) {
    setCoverPreview(selectedThematic.value.url)
  }

  clearScopeSelection()
  if (formState.scopeMode === "selection" && data.scope?.ring && Array.isArray(data.scope.ring) && data.scope.ring.length >= 3) {
    const layer = ensureScopeDrawLayer()
    if (layer) {
      const g = new mars3d.graphic.PolygonEntity({
        positions: data.scope.ring,
        style: {
          fill: true,
          color: "rgba(255,255,0,0.2)",
          outline: true,
          outlineWidth: 2,
          outlineColor: "rgba(255,255,0,1)"
        }
      })
      layer.addGraphic(g)
      scopeGraphic.value = g
      updateScopeArea()
    }
  }

  draftRestored.value = true
  updatePreview()
  $message("草稿已恢复")
}

async function clearDraft(): Promise<void> {
  try {
    await idbDel(DRAFT_KEY, draftStore)
  } catch {
  }
  try {
    localStorage.removeItem(DRAFT_LS_KEY)
  } catch {
  } finally {
    cachedDraft = null
    draftInfo.value = null
    draftLoaded.value = true
    draftRestored.value = false
  }
}

onBeforeUnmount(() => {
  if (draftSaveTimer) {
    window.clearTimeout(draftSaveTimer)
    draftSaveTimer = null
  }
  unbindCameraPreview()
})

// 重置表单
function resetForm() {
  formState.name = ""
  formState.description = ""
  formState.visibility = "private"
  formState.tags = []
  formState.coverMode = "auto"
  formState.includeItems = ["viewState", "layers", "drawFeatures"]
  formState.scopeMode = "currentView"
  coverFileList.value = []
  attachmentFileList.value = []
  selectedLayerIds.value = []
  availableLayers.value = []
  coverPreviewUrl.value = ""
  thematicThumbs.value = []
  selectedThematic.value = null
  thematicCoverBlob = null
  thematicLoaded.value = false
  thematicDatasetId.value = ""
  clearScopeSelection()
  resetAttachmentUploadFeedback()
}
</script>

<style scoped lang="less">
.save-manifest-scroll {
  height: 100%;
  overflow: auto;
  padding: var(--popup-body-padding, 14px);
  box-sizing: border-box;
}

.save-manifest-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.save-draft-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--color-primary, #41a8ff) 10%, var(--popup-surface, rgba(17 22 28 / 0.55)));
  border: 1px solid color-mix(in srgb, var(--color-primary, #41a8ff) 28%, transparent);
  border-radius: var(--popup-item-radius, 8px);
  box-sizing: border-box;
}

.save-draft-banner__text {
  flex: 1;
  min-width: 0;
  color: var(--mars-text-color, var(--text-primary, #fff));
  font-size: 13px;
  line-height: 1.5;
}

.save-draft-banner__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-left: 12px;
  border-left: 1px solid color-mix(in srgb, var(--color-primary, #41a8ff) 22%, transparent);
}

.save-draft-btn {
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  line-height: 26px;
  border-radius: var(--popup-item-radius, 8px);
  border: 1px solid color-mix(in srgb, var(--color-primary, #41a8ff) 42%, transparent);
  background: color-mix(in srgb, var(--color-primary, #41a8ff) 14%, transparent);
  color: var(--color-primary, #41a8ff);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 22%, transparent);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 58%, transparent);
  }
}

.save-draft-btn--danger {
  border-color: color-mix(in srgb, var(--color-error, #ff4d4f) 42%, transparent);
  background: color-mix(in srgb, var(--color-error, #ff4d4f) 12%, transparent);
  color: color-mix(in srgb, var(--color-error, #ff4d4f) 88%, #fff);

  &:hover {
    background: color-mix(in srgb, var(--color-error, #ff4d4f) 20%, transparent);
    border-color: color-mix(in srgb, var(--color-error, #ff4d4f) 58%, transparent);
    color: var(--color-error, #ff7875);
  }
}

.save-form-section {
  padding: 0;
  background: color-mix(in srgb, var(--popup-surface, #11161c) 92%, #fff 8%);
  border: 1px solid var(--popup-border, var(--overlay-border, rgba(255 255 255 / 0.12)));
  border-radius: var(--popup-item-radius, 8px);
  box-sizing: border-box;
  overflow: hidden;
}

.save-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--layout-border, var(--popup-border, rgba(255 255 255 / 0.1)));
  background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;

  &:hover {
    background: color-mix(in srgb, var(--text-primary, #fff) 7%, transparent);
  }
}

.save-section-toggle {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--mars-text-color-secondary, var(--text-secondary, rgba(255 255 255 / 0.55)));
  transition: transform 0.25s ease;

  &.is-collapsed {
    transform: rotate(-90deg);
  }
}

.save-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--mars-text-color, var(--text-primary, #fff));
  letter-spacing: 0.02em;
}

.save-section-body {
  padding: 10px 12px 12px;

  :deep(.ant-form-item:last-child) {
    margin-bottom: 0;
  }

  :deep(.ant-form-item-label > label) {
    color: var(--mars-text-color-secondary, var(--text-secondary, rgba(255 255 255 / 0.65)));
    font-size: 13px;
  }
}

.save-form-section--preview .preview-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.save-manifest-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 10px 12px;
  border-top: none;
  background: transparent;
}

.save-submit-success {
  padding: 12px 4px 4px;
  text-align: center;
}

.save-submit-success__title {
  color: var(--text-primary, #17233d);
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
}

.save-submit-success__desc {
  margin-top: 8px;
  color: var(--text-secondary, #62708a);
  font-size: 14px;
  line-height: 22px;
}

.preview-item,
.confirm-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px dashed color-mix(in srgb, var(--text-primary, #fff) 8%, transparent);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.preview-item .label,
.confirm-item .label {
  flex-shrink: 0;
  min-width: 88px;
  color: var(--mars-text-color-secondary, var(--text-secondary, rgba(255 255 255 / 0.65)));
  font-size: 13px;
}

.preview-item .value,
.confirm-item .value {
  flex: 1;
  text-align: right;
  color: var(--mars-text-color, var(--text-primary, #fff));
  font-size: 13px;
  word-break: break-word;
}

.hint {
  margin-top: 6px;
  color: var(--mars-text-color-secondary, var(--text-secondary, rgba(255 255 255 / 0.55)));
  font-size: 12px;
  line-height: 1.6;
}

.attachment-upload-status {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--overlay-border, rgba(255 255 255 / 0.12));
  border-radius: var(--popup-item-radius, 8px);
  background: color-mix(in srgb, var(--popup-surface, #11161c) 90%, #fff 10%);
}

.attachment-upload-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--mars-text-color, var(--text-primary, #fff));
  font-size: 13px;
  margin-bottom: 6px;
}

.attachment-upload-file {
  margin-bottom: 8px;
  color: var(--mars-text-color-secondary, var(--text-secondary, rgba(255 255 255 / 0.65)));
  font-size: 12px;
  word-break: break-all;
}

.cover-upload {
  margin-top: 8px;
}

.cover-preview {
  margin-top: 8px;
}

.cover-preview-actions {
  margin-bottom: 8px;
}

.cover-preview-img {
  width: 100%;
  max-width: 360px;
  height: 200px;
  border: 1px solid var(--overlay-border, rgba(255 255 255 / 0.12));
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  overflow: hidden;
  background: color-mix(in srgb, var(--text-primary, #fff) 6%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-preview-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-preview-empty {
  color: var(--mars-text-color-secondary, var(--text-secondary, rgba(255 255 255 / 0.55)));
  font-size: 12px;
}

.thematic-cover {
  margin-top: 8px;
}

.thematic-cover-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.thematic-grid {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.thematic-thumb {
  border: 1px solid var(--overlay-border, rgba(255 255 255 / 0.12));
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  overflow: hidden;
  cursor: pointer;
  background: color-mix(in srgb, var(--text-primary, #fff) 6%, transparent);
}

.thematic-thumb-active {
  border-color: var(--mars-primary-color, var(--color-primary, #41a8ff));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary, #41a8ff) 35%, transparent);
}

.thematic-thumb img {
  width: 100%;
  height: 78px;
  object-fit: cover;
  display: block;
}

.thematic-thumb-name {
  padding: 6px;
  font-size: 12px;
  color: var(--mars-text-color, var(--text-primary, #fff));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-select-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.layer-dir-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.layer-select-meta {
  color: var(--mars-text-color-secondary, var(--text-secondary, rgba(255 255 255 / 0.55)));
  font-size: 12px;
}

.layer-select-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow: auto;
  padding: 8px;
  border: 1px solid var(--overlay-border, rgba(255 255 255 / 0.12));
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  background: color-mix(in srgb, var(--text-primary, #fff) 3%, transparent);
}

.scope-selection {
  margin-top: 8px;
}

.scope-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.confirm-preview {
  margin-top: 0;
}

.confirm-layer-list {
  max-height: 240px;
  overflow: auto;
  padding: 8px;
  border: 1px solid var(--overlay-border, rgba(255 255 255 / 0.12));
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  margin: 8px 0 12px;
  background: color-mix(in srgb, var(--text-primary, #fff) 3%, transparent);
}

.confirm-layer-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}

.layer-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--text-primary, #fff) 35%, transparent);
  flex: none;
}

.layer-dot.group {
  background: color-mix(in srgb, var(--text-primary, #fff) 70%, transparent);
}

.layer-name {
  color: var(--mars-text-color, var(--text-primary, #fff));
  font-size: 13px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

</style>
