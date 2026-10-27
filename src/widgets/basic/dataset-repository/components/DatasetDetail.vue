<template>
  <div :class="['dataset-detail', { 'dataset-detail--inactive': layerVersionDrawerOpen }]">
    <!-- 固定工具栏 -->
    <div class="detail-toolbar">
      <a-button
        type="text"
        size="small"
        class="back-icon-btn"
        title="返回列表"
        aria-label="返回列表"
        @click="handleBack"
      >
        <mars-icon icon="left" :width="16" />
      </a-button>
      <div class="toolbar-actions">
        <!-- 主操作：导入使用 -->
        <a-dropdown v-if="collection" :disabled="items.length === 0">
          <a-button type="primary" size="small" :disabled="items.length === 0">
            导入使用 ▼
          </a-button>
          <template #overlay>
            <a-menu @click="handleImportMenuClick">
              <a-menu-item key="current">导入当前版本</a-menu-item>
              <a-menu-item key="select">选择版本导入...</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <a-button v-else type="primary" size="small" disabled>
          导入使用
        </a-button>
        <!-- 次要操作 -->
        <a-button size="small" @click="handleLocate">
          定位
        </a-button>
        <a-button size="small" @click="toggleFavorite">
          {{ isFavorite ? "取消收藏" : "收藏" }}
        </a-button>
        <!-- 更多操作 -->
        <a-dropdown v-if="collection" overlay-class-name="dataset-detail-more-dropdown">
          <a-button size="small">更多 ▼</a-button>
          <template #overlay>
            <a-menu class="dataset-detail-more-menu" @click="handleMoreMenuClick">
              <a-menu-item v-if="isStacCollection" key="stacLoad" :disabled="loadingStacImage">
                🌍 快速加载
              </a-menu-item>
              <a-menu-item key="downloadZip" :disabled="items.length === 0">
                <span class="more-menu-item">
                  <mars-icon icon="download" :width="14" />
                  <span>下载ZIP</span>
                </span>
              </a-menu-item>
              <a-menu-item key="layerVersion">
                <span class="more-menu-item">
                  <mars-icon icon="bring-to-front" :width="14" />
                  <span>图层/版本</span>
                </span>
              </a-menu-item>
              <a-menu-item key="layerManager">
                <span class="more-menu-item">
                  <mars-icon icon="layers" :width="14" />
                  <span>打开图层管理</span>
                </span>
              </a-menu-item>
              <a-menu-item key="thematicWorkbench">
                <span class="more-menu-item">
                  <mars-icon icon="workbench" :width="14" />
                  <span>专题制图</span>
                </span>
              </a-menu-item>
              <a-menu-item v-if="hasImportedGroup" key="clearImport" danger>
                <span class="more-menu-item">
                  <mars-icon icon="delete" :width="14" />
                  <span>清除导入</span>
                </span>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <a-spin tip="加载中..." />
    </div>

    <!-- 数据集详情 -->
    <div v-else-if="collection" class="detail-content">
      <ImportSuccessToast
        v-model:visible="showImportToast"
        :datasetName="restoredItemName"
        :groupId="lastResultGroupId"
        :bbox="importedBbox"
        :snapshotManifest="importSnapshotManifest"
        :layerCount="importedLayerCount"
        :groupCount="importedGroupCount"
        :autoClose="false"
        @undo="handleUndoImport"
        @close="handleImportToastClose"
      />
      <!-- 基本信息 -->
      <div class="info-section">
        <div v-if="syncHintVisible" class="sync-hint-banner">
          <span class="sync-hint-banner__text">{{ syncHintMessage }}</span>
          <div class="sync-hint-banner__actions">
            <button type="button" class="sync-hint-btn" @click="handleSyncRefresh">刷新</button>
            <button type="button" class="sync-hint-btn" @click="syncHintVisible = false">关闭</button>
          </div>
        </div>
        <!-- 标题行 -->
        <div class="info-title-row">
          <h3 class="info-title" :title="getCollectionTitleText()">{{ getCollectionTitleText() }}</h3>
          <div class="visibility-tag" v-if="visibilityLabel">
            <a-tag :color="visibilityColor">{{ visibilityLabel }}</a-tag>
          </div>
        </div>

        <div class="detail-cover" v-if="coverUrl" @click="openCoverPreview">
          <img class="cover-img" :src="coverUrl" alt="cover" @error="handleCoverImgError" />
          <div class="cover-tip">点击预览</div>
        </div>

        <div class="info-body">
          <div class="info-row">
            <span class="info-label">ID：</span>
            <span class="info-value">{{ collection.id }}</span>
          </div>
          <div class="info-row" v-if="creatorLabel">
            <span class="info-label">创建者：</span>
            <span class="info-value">{{ creatorLabel }}</span>
          </div>
          <div class="info-row" v-if="createdAtText">
            <span class="info-label">创建时间：</span>
            <span class="info-value">{{ createdAtText }}</span>
          </div>
          <div class="info-row" v-if="updatedAtText">
            <span class="info-label">更新时间：</span>
            <span class="info-value">{{ updatedAtText }}</span>
          </div>
          <div class="info-row" v-if="parentDatasetId">
            <span class="info-label">父数据集：</span>
            <span class="info-value">{{ parentDatasetId }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">描述：</span>
            <span class="info-value">{{ getCollectionDescText() || "暂无描述" }}</span>
          </div>
          <div class="info-row" v-if="collection.license">
            <span class="info-label">许可：</span>
            <a-tag color="blue">{{ collection.license }}</a-tag>
          </div>
          <div class="info-row" v-if="collection.extent?.spatial?.bbox?.[0]">
            <span class="info-label">空间范围：</span>
            <span class="info-value">{{ formatBbox(collection.extent.spatial.bbox[0]) }}</span>
          </div>
          <div class="info-row" v-if="collection.extent?.temporal?.interval?.[0]">
            <span class="info-label">时间范围：</span>
            <span class="info-value">{{ formatTemporalExtent(collection.extent.temporal.interval[0]) }}</span>
          </div>
          <div v-if="getCollectionKeywords().length" class="info-row">
            <span class="info-label">关键词：</span>
            <div class="info-tags">
              <a-tag v-for="keyword in getCollectionKeywords()" :key="keyword" size="small">{{ keyword }}</a-tag>
            </div>
          </div>
          <div v-if="collection.summaries" class="info-row">
            <span class="info-label">摘要：</span>
            <div class="info-summaries">
              <span v-for="(value, key) in collection.summaries" :key="key" class="summary-item">
                <strong>{{ formatSummaryKeyLabel(String(key)) }}:</strong> {{ formatSummaryValueLabel(value) }}
              </span>
            </div>
          </div>
          <div v-if="renderInfos.length" class="info-row">
            <span class="info-label">渲染图：</span>
            <div class="info-summaries">
              <span v-for="r in renderInfos" :key="r.key" class="summary-item">
                <strong>{{ r.label }}:</strong>
                <span v-if="r.title">标题 {{ r.title }}；</span>
                <span v-if="r.assetsText">Assets {{ r.assetsText }}；</span>
                <span v-if="r.assetBidx">asset Bidx {{ r.assetBidx }}；</span>
                <span v-if="r.minZoom !== null || r.maxZoom !== null">Zoom {{ r.minZoom ?? "-" }} ~ {{ r.maxZoom ?? "-" }}</span>
              </span>
            </div>
          </div>
          <div v-if="itemAssetKeys.length" class="info-row">
            <span class="info-label">ItemAssets：</span>
            <div class="info-tags">
              <a-tag v-for="k in itemAssetKeys" :key="k" size="small">{{ k }}</a-tag>
            </div>
          </div>
          <div class="info-row">
            <span class="info-label">统计：</span>
            <span class="info-value">浏览 {{ metric.browseCount }} / 导入 {{ metric.importCount }} / 收藏 {{ favoriteDisplayCount }}</span>
          </div>
        </div>
      </div>

      <!-- 血缘关系面板 -->
      <div class="section-card section-card--lineage">
        <LineagePanel
          v-if="collection"
          :dataset-id="collection.id"
          :dataset-name="collection.title"
          :parent-dataset-id="parentDatasetId"
          :source-dataset-id="sourceDatasetId"
          @navigate="handleNavigateDataset"
        />
      </div>

      <div class="section-card layers-section">
        <div class="section-header">
          <h4 class="section-title">包含图层 ({{ previewLayerLeafCount }})</h4>
          <span v-if="previewLayerRevisionLabel" class="section-meta">当前版本：{{ previewLayerRevisionLabel }}</span>
        </div>
        <div v-if="previewLayerLoading" class="loading-container small">
          <a-spin size="small" />
        </div>
        <div v-else-if="visiblePreviewLayerLines.length > 0" class="assets-list">
          <div
            v-for="layer in visiblePreviewLayerLines"
            :key="layer.id"
            class="asset-item layer-item"
            :class="{ 'layer-item--group': layer.isGroup, 'layer-item--collapsed': layer.isGroup && isLayerGroupCollapsed(layer.id) }"
            :style="{ paddingLeft: `${10 + layer.depth * 14}px` }"
            @click="layer.isGroup ? toggleLayerGroup(layer.id) : undefined"
          >
            <div class="asset-info">
              <span class="asset-name">{{ layer.isGroup ? "📁" : "📄" }} {{ layer.name }}</span>
              <span class="asset-type">{{ formatLayerTypeLabel(layer.sourceType) }}</span>
            </div>
            <div v-if="layer.temporalLabel" class="asset-desc">{{ layer.temporalLabel }}</div>
          </div>
        </div>
        <div v-else class="empty-state">
          <a-empty :description="previewLayerEmptyText" :image-style="{ height: '60px' }" />
        </div>
      </div>

      <!-- Items 列表 -->
      <div class="section-card items-section">
        <div class="section-header">
          <h4 class="section-title">数据条目 ({{ items.length }})</h4>
          <div class="restore-strategy-select">
            <span class="strategy-label">回放策略:</span>
            <a-select v-model:value="restoreStrategy" size="small" style="width: 100px">
              <a-select-option value="overlay">叠加</a-select-option>
              <a-select-option value="replace">替换</a-select-option>
            </a-select>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loadingItems" class="loading-container small">
          <a-spin size="small" />
        </div>

        <!-- Items 列表 -->
        <div v-else-if="items.length > 0" class="item-list">
          <div
            v-for="item in items"
            :key="item.id"
            class="item-card"
            :class="{ active: selectedItem?.id === item.id }"
            @click="handleSelectItem(item)"
          >
            <div class="item-header">
              <span class="item-title">{{ getItemTitleText(item) }}</span>
              <span class="item-time">{{ formatDate(item.properties.datetime) }}</span>
            </div>
            <div class="item-desc">{{ getItemDescText(item) || "暂无描述" }}</div>
            <div class="item-assets" v-if="item.assets">
              <span class="assets-count">📦 {{ Object.keys(item.assets).length }} 个资源</span>
            </div>
            <div class="item-actions">
              <!-- 所有数据集都提供"导入"按钮 -->
              <a-button type="primary" size="small" @click.stop="openImportDialog(item)">
                导入
              </a-button>
              <!-- STAC 影像额外提供快速加载按钮 -->
              <a-button
                v-if="isStacCollection && item.assets?.visual"
                size="small"
                @click.stop="handleLoadStacItem(item)"
              >
                🌍 快速加载
              </a-button>
              <a-button size="small" @click.stop="handleSelectItem(item)">
                查看详情
              </a-button>
              <a-button size="small" @click.stop="handleLocateItem(item)">
                定位
              </a-button>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-state">
          <a-empty description="暂无数据条目" :image-style="{ height: '60px' }" />
        </div>
      </div>

      <!-- 选中 Item 的资源预览 -->
      <div v-if="selectedItem" class="section-card assets-section">
        <div class="section-header">
          <h4 class="section-title">资源列表</h4>
        </div>
        <div class="assets-list">
          <div v-for="(asset, key) in selectedItem.assets" :key="key" class="asset-item">
            <div class="asset-info">
              <span class="asset-name">{{ getAssetTitleText(selectedItem.id, String(key), asset) }}</span>
              <span class="asset-type">{{ asset.type || "未知类型" }}</span>
            </div>
            <div class="asset-desc" v-if="getAssetDescText(selectedItem.id, String(key), asset)">{{ getAssetDescText(selectedItem.id, String(key), asset) }}</div>
            <a-button type="link" size="small" @click="handleOpenAsset(asset)">
              打开资源
            </a-button>
          </div>
        </div>
      </div>

      <!-- 附件列表 -->
      <div class="section-card assets-section">
        <div class="section-header">
          <h4 class="section-title">附件 ({{ artifacts.length }})</h4>
          <a-button size="small" type="default" :loading="localResultLoading" @click="openLocalResultPicker">加载本地成果</a-button>
          <input ref="localResultInputRef" type="file" class="hidden-file-input" @change="handleLocalResultChange" />
        </div>
        <div v-if="localResultProgressText" class="section-tip">{{ localResultProgressText }}</div>
        <div v-if="artifactsLoading" class="loading-container small">
          <a-spin size="small" />
        </div>
        <div v-else-if="artifacts.length > 0" class="assets-list">
          <div v-for="a in artifacts" :key="a.artifactId" class="asset-item">
            <div class="asset-info">
              <span class="asset-name">{{ a.name || a.artifactId }}</span>
              <span class="asset-type">{{ formatArtifactDesc(a) }}</span>
            </div>
            <div class="asset-desc" v-if="a.mime">{{ a.mime }}</div>
            <a-button type="link" size="small" @click="handleOpenArtifact(a)">
              {{ canPreviewArtifact(a) ? "预览" : "下载" }}
            </a-button>
            <a-button v-if="isImageArtifact(a)" type="link" size="small" @click="handleAddArtifactToMap(a)">上图</a-button>
          </div>
        </div>
        <div v-else class="empty-state">
          <a-empty description="暂无附件" :image-style="{ height: '60px' }" />
        </div>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else class="error-state">
      <a-result status="error" title="加载数据集失败">
        <template #extra>
          <a-button type="primary" @click="loadCollectionDetail">重试</a-button>
        </template>
      </a-result>
    </div>

    <ImportDatasetDialog
      v-model:open="showImportDialog"
      :datasetId="collection?.id || collectionId"
      :revisions="items"
      :importing="isImporting"
      :progressText="importProgressText"
      :progressPercent="importProgressPercent"
      :uploadPausable="importUploadPausable"
      :uploadPaused="importUploadPaused"
      :defaultRevisionId="selectedItem?.id"
      :errorText="importErrorText"
      @pause-upload="pauseImportUpload"
      @resume-upload="resumeImportUpload"
      @submit="handleImportSubmit"
    />

    <mars-task-modal v-model:open="coverPreviewOpen" title="封面预览" :footer="false" width="720" @cancel="closeCoverPreview">
      <template #headerRight>
        <button
          v-if="coverUrl"
          type="button"
          class="mars-popup-header-btn cover-preview-download-btn"
          title="下载封面"
          aria-label="下载封面"
          @click.stop="downloadPreviewCover"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 2.5v6.5m0 0 2.5-2.5M8 9l-2.5-2.5M3 11.5v1h10v-1" />
          </svg>
        </button>
      </template>
      <div class="cover-preview">
        <img v-if="coverUrl" :src="coverUrl" alt="preview" />
        <a-empty v-else description="暂无封面" />
      </div>
    </mars-task-modal>

    <mars-task-modal v-model:open="artifactPreviewOpen" :title="artifactPreviewTitle" :footer="false" width="860" @cancel="closeArtifactPreview">
      <div class="cover-preview">
        <ArtifactPreview :url="artifactPreviewUrl" :mime="artifactPreviewMime" />
      </div>
    </mars-task-modal>

    <LayerVersionManagerDrawer
      v-model:open="layerVersionDrawerOpen"
      :collection="collection || { id: collectionId, type: 'Collection', extent: { spatial: { bbox: [[0, 0, 0, 0]] }, temporal: { interval: [[null, null]] } }, links: [] } as any"
      :revisions="items"
      @saved="handleLayerVersionSaved"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from "vue"
import shp from "shpjs"
import { $message } from "@mars/components/mars-ui/index"
import {
  getCollection,
  getItemsAll,
  getLatestDatasetManifest,
  getRevisionManifest,
  createImportSession,
  assertSuccessfulImportSessionResponse,
  undoImportSession,
  clearImportSession,
  buildFallbackManifestFromStacItems,
  buildFallbackManifestFromStacItem
} from "../services/eoapi-datasets"
import { StacCollection, StacItem, StacAsset, DatasetVisibility, Manifest, Artifact } from "../types/eoapi-types"
import { restoreWorkspace, clearRestoredContent } from "../workspace/restore"
import { precheckRestore, RestoreStrategy, ConflictResolution } from "../workspace/strategies"
import * as mapWork from "../map"
import LineagePanel from "./LineagePanel.vue"
import { downloadDatasetZip } from "../utils/zip-export"
import { clearCurrentDataset, setCurrentDataset } from "@/shell/currentDataset"
import {
  getDatasetMetric,
  isDatasetFavorite,
  onDatasetMetricsChange,
  recordDatasetEvent,
  recordDatasetBrowse,
  recordDatasetImport,
  toggleDatasetFavorite
} from "../services/dataset-metrics"
import { serializeWorkspace } from "../workspace/serialize"
import ImportDatasetDialog from "./ImportDatasetDialog.vue"
import ImportSuccessToast from "./ImportSuccessToast.vue"
import { useWidget } from "@mars/common/store/widget"
import { getArtifactDownloadUrl, getArtifacts, getArtifactTypeName, formatArtifactSize, smartUploadArtifact } from "../services/eoapi-artifacts"
import { getOrCreateBboxCover, getPersistedDatasetCover } from "../services/cover-cache"
import { resolveEoapiHref } from "../services/eoapi-client"
import { ensureEoapiI18nConfig, pickAssetText, pickCollectionText, pickItemText, translateSummaryKey, translateSummaryValue } from "../services/eoapi-i18n"
import { buildScopedGroupId, buildScopedLayerId, buildScopedLayerPrefix, ensureUniqueMapLayerId, normalizeLayerIdToken } from "../services/layer-id"
import { connectDatasetSync, disconnectDatasetSync, onDatasetSync, type DatasetSyncDetail } from "../services/dataset-sync"
import { watchFile } from "../services/file-watch"
import { refreshMetadata, registerMetadataRefresher } from "../services/metadata-refresh"
import { classifyLayer, DEFAULT_GROUP } from "../services/layer-classifier"
import { loadResultFile } from "../services/result-loader"
import { validateResultFile } from "../services/result-loader-utils"
import { MAX_LAYERS, assertLayerCapacity, countManifestLayers } from "../services/layer-constraints"
import { attachSourceRegistryToManifest, buildSourceRegistryKey, prepareSingleSourceLoad, tagLayerSourceRegistry, type SourceRegistryEntry, type SourceRegistryMeta } from "../services/source-registry"
import LayerVersionManagerDrawer from "./LayerVersionManagerDrawer.vue"
import ArtifactPreview from "./ArtifactPreview.vue"

const props = defineProps<{
  collectionId: string
}>()

const emit = defineEmits<{
  back: []
  openInMap: [collection: StacCollection, item?: StacItem]
  navigate: [datasetId: string]
  layerVersionOpenChange: [open: boolean]
}>()

// #region debug-point dataset-cover-stac-load
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
  "dataset-cover-stac-load"

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
// #endregion debug-point dataset-cover-stac-load

function buildDatasetImportGroupId(datasetId: string, openedAt: number): string {
  return buildScopedGroupId("eoapi", datasetId, openedAt)
}

function buildDatasetImportLayerPrefix(datasetId: string, openedAt: number): string {
  return buildScopedLayerPrefix("eoapi", datasetId, openedAt)
}

function buildStacImportGroupId(datasetId: string, openedAt: number): string {
  return buildScopedGroupId("stac", datasetId, openedAt)
}

function buildStacImportLayerPrefix(datasetId: string, openedAt: number): string {
  return buildScopedLayerPrefix("stac", datasetId, openedAt)
}

function buildStacImportLayerId(datasetId: string, openedAt: number, itemId: string): string {
  return buildScopedLayerId("stac", datasetId, openedAt, itemId)
}

function buildLocalResultSourceKey(datasetId: string, file: File): string {
  return buildSourceRegistryKey("local", datasetId, file.name, file.size, file.lastModified)
}

function buildArtifactSourceKey(datasetId: string, artifactId: string): string {
  return buildSourceRegistryKey("artifact", datasetId, artifactId)
}

function buildRemoteImportSourceKey(mode: "api" | "thirdparty", url: string, extra?: string): string {
  return buildSourceRegistryKey(mode, url, extra || "")
}

function buildRevisionImportSourceKey(datasetId: string, revisionId: string, timeMode: string, layerIds: string[] = []): string {
  const normalizedLayerIds = [...layerIds].map((id) => String(id || "").trim()).filter(Boolean).sort().join(",")
  return buildSourceRegistryKey("revision", datasetId, revisionId, timeMode, normalizedLayerIds)
}

function buildStacSourceKey(datasetId: string, mode: string, itemIds: string[] = []): string {
  const normalizedItemIds = [...itemIds].map((id) => String(id || "").trim()).filter(Boolean).sort().join(",")
  return buildSourceRegistryKey("stac", datasetId, mode, normalizedItemIds)
}

// 状态变量
const loading = ref(true)
const loadingItems = ref(false)
const collection = ref<StacCollection | null>(null)
const items = ref<StacItem[]>([])
const selectedItem = ref<StacItem | null>(null)
const downloadingZip = ref(false)
const showImportDialog = ref(false)
const isImporting = ref(false)
const importSnapshotManifest = ref<Manifest | null>(null)
const importErrorText = ref("")
const importProgressText = ref("")
const importProgressPercent = ref(0)
const importUploadPausable = ref(false)
const importUploadPaused = ref(false)
let importResumePromise: Promise<void> | null = null
let importResumeResolver: (() => void) | null = null
const metricRefreshKey = ref(0)
const { activate } = useWidget()
let disposeMetricWatch: null | (() => void) = null
const lastResultGroupId = ref("")
const lastResultPrefix = ref("")
const lastImportedArtifactIds = ref<string[]>([])
const lastImportSourceType = ref<"revision" | "local" | "api" | "thirdparty">("revision")

// 回放状态
const isRestoring = ref(false)
const restoredManifest = ref<Manifest | null>(null)
const restoredItemName = ref("")
const restoreStrategy = ref<RestoreStrategy>("overlay")

// 导入成功提示条状态
const showImportToast = ref(false)
const importedBbox = ref<[number, number, number, number] | null>(null)
const importedLayerCount = ref(0)
const importedGroupCount = ref(0)

const coverPreviewOpen = ref(false)
const artifactPreviewOpen = ref(false)
const artifactPreviewUrl = ref("")
const artifactPreviewMime = ref("")
const artifactPreviewTitle = ref("附件预览")
const localResultInputRef = ref<HTMLInputElement | null>(null)
const localResultLoading = ref(false)
const localResultProgressText = ref("")
const artifactsLoading = ref(false)
const artifacts = ref<Artifact[]>([])
const i18nConfig = ref<any>(null)
const layerVersionDrawerOpen = ref(false)
const previewLayerLoading = ref(false)
const previewLayerRevisionLabel = ref("")
const previewLayerLines = ref<Array<{ id: string; pid: string | null; name: string; depth: number; isGroup: boolean; sourceType: string; temporalLabel: string }>>([])
const collapsedLayerGroupIds = ref<string[]>([])

// STAC 影像加载状态
const loadingStacImage = ref(false)
const loadedStacLayerId = ref<string | null>(null)

const syncHintVisible = ref(false)
const syncHintMessage = ref("")
let disposeDatasetSync: null | (() => void) = null
let disposeMetadataRefresh: null | (() => void) = null
let artifactWatchDisposers: Array<() => void> = []

async function handleSyncRefresh() {
  try {
    await refreshMetadata({
      datasetId: props.collectionId,
      reason: "manual"
    })
    syncHintVisible.value = false
  } catch (error: any) {
    syncHintMessage.value = error?.message || "元数据刷新失败，请重试"
    syncHintVisible.value = true
  }
}

function resetArtifactWatchers(list: Artifact[] = []) {
  artifactWatchDisposers.forEach((dispose) => {
    try {
      dispose()
    } catch {
    }
  })
  artifactWatchDisposers = []

  list
    .filter((item) => !!String(item?.url || "").trim())
    .slice(0, 20)
    .forEach((item) => {
      const dispose = watchFile({
        id: String(item.artifactId || item.name || item.url || ""),
        name: String(item.name || item.artifactId || "附件"),
        url: String(item.url || "")
      }, {
        intervalMs: 30000,
        initialType: "updated",
        onChange: () => {
          syncHintMessage.value = "检测到文件变更，可点击刷新重新加载"
          syncHintVisible.value = true
        }
      })
      artifactWatchDisposers.push(dispose)
    })
}

function focusSourceEntry(entry?: SourceRegistryEntry | null) {
  if (!entry) {
    return
  }
  const targetId = String(entry.layerIds?.[0] || entry.groupId || "").trim()
  if (targetId) {
    mapWork.flyToLayer(targetId)
  }
}

function removeSourceEntry(entry?: SourceRegistryEntry | null) {
  if (!entry) {
    return
  }
  if (entry.groupId) {
    mapWork.removeLayersByPid(entry.groupId)
    mapWork.removeLayer(entry.groupId)
  } else {
    entry.layerIds.forEach((id) => {
      mapWork.removeLayer(id)
    })
  }
  window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
}

function ensureSourceLoad(meta: SourceRegistryMeta, strategy: "block" | "replace" = "block") {
  const map = mapWork.getMap()
  if (!map) {
    throw new Error("地图未初始化")
  }
  const prepared = prepareSingleSourceLoad(map, meta, strategy)
  if (!prepared.ok) {
    focusSourceEntry(prepared.existing)
    throw new Error(`${meta.label || "该数据源"}已在地图中加载，已定位到现有图层`)
  }
  if (prepared.shouldReplace && prepared.existing) {
    removeSourceEntry(prepared.existing)
  }
}

function ensureLayerLimit(incomingCount: number, strategy: RestoreStrategy, actionLabel: string) {
  const map = mapWork.getMap()
  if (!map) {
    throw new Error("地图未初始化")
  }
  assertLayerCapacity(map, {
    incomingCount,
    strategy,
    maxLayers: MAX_LAYERS,
    actionLabel
  })
}

// 判断是否为 STAC Collection（遥感影像数据集）
// STAC Collections 特征：有 renders 配置或 item_assets，或 ID 以 MAXAR/earthquake 等开头
// eoAPI Datasets 特征：由用户创建（ID 以 ds_ 开头），或本地数据集（ID 以 local_ 开头）
const isStacCollection = computed(() => {
  const c = collection.value
  if (!c) {
    return false
  }
  // 本地数据集和 eoAPI 用户数据集不是 STAC Collection
  if (c.id.startsWith("local_") || c.id.startsWith("ds_")) {
    return false
  }
  // 检查是否有 eoAPI 成果管理的 visibility 属性（用户创建的数据集）
  const hasVisibility = (c.summaries as any)?.visibility
  if (hasVisibility) {
    return false
  }
  // 检查是否有 STAC 影像特征
  const hasRenders = (c as any)?.renders && Object.keys((c as any).renders).length > 0
  const hasItemAssets = (c as any)?.item_assets && Object.keys((c as any).item_assets).length > 0
  // 常见的遥感影像数据集命名模式
  const stacPattern = /^(MAXAR|earthquake|sentinel|landsat|copernicus|esa|nasa)/i
  const matchesStacPattern = stacPattern.test(c.id)
  // 如果有 renders 或 item_assets，则认为是 STAC 影像数据集
  return hasRenders || hasItemAssets || matchesStacPattern
})

function toFiniteNumber(value: any): number | null {
  let n = NaN
  if (typeof value === "string") {
    n = Number(value)
  } else if (typeof value === "number") {
    n = value
  }
  return Number.isFinite(n) ? n : null
}

function pickZoomValue(meta: any, key: "min" | "max"): number | null {
  if (!meta) {
    return null
  }
  const raw =
    key === "min"
      ? meta.minzoom ?? meta.minZoom ?? meta.min_zoom ?? meta.min_level ?? meta.minLevel
      : meta.maxzoom ?? meta.maxZoom ?? meta.max_zoom ?? meta.max_level ?? meta.maxLevel
  return toFiniteNumber(raw)
}

const renderInfos = computed(() => {
  const c: any = collection.value
  const renders = c?.renders
  if (!renders || typeof renders !== "object") {
    return [] as Array<{
      key: string
      label: string
      title: string
      assetsText: string
      assetBidx: string
      minZoom: number | null
      maxZoom: number | null
    }>
  }
  return Object.keys(renders).map((key) => {
    const meta: any = renders[key] || {}
    let title = ""
    if (typeof meta.title === "string") {
      title = meta.title
    } else if (typeof meta.name === "string") {
      title = meta.name
    }

    let assetsText = ""
    if (Array.isArray(meta.assets)) {
      assetsText = meta.assets.map((x: any) => String(x)).filter(Boolean).join(",")
    } else if (typeof meta.assets === "string") {
      assetsText = meta.assets
    }

    let assetBidx = ""
    if (typeof meta.asset_bidx === "string") {
      assetBidx = meta.asset_bidx
    } else if (typeof meta.assetBidx === "string") {
      assetBidx = meta.assetBidx
    }
    const minZoom = pickZoomValue(meta, "min")
    const maxZoom = pickZoomValue(meta, "max")
    const label = key === "visual" ? "视览" : key
    return { key, label, title, assetsText, assetBidx, minZoom, maxZoom }
  })
})

const itemAssetKeys = computed(() => {
  const c: any = collection.value
  const itemAssets = c?.item_assets
  if (!itemAssets || typeof itemAssets !== "object") {
    return [] as string[]
  }
  return Object.keys(itemAssets).slice(0, 30)
})

function openLayerVersionDrawer() {
  // 导入成功提示条会覆盖右侧抽屉顶部交互区，进入版本管理时先收起，避免遮挡 tab/操作按钮。
  showImportToast.value = false
  layerVersionDrawerOpen.value = true
}

watch(
  () => layerVersionDrawerOpen.value,
  (open) => {
    emit("layerVersionOpenChange", open)
  },
  { immediate: true }
)

function handleLayerVersionSaved() {
  loadItems().catch(() => {})
  loadCollectionDetail().catch(() => {})
}

function getCollectionTitleText(): string {
  const c = collection.value
  if (!c) {
    return props.collectionId
  }
  const t = pickCollectionText(c.id, c.title, c.description, i18nConfig.value)
  return t.title || c.title || c.id
}

function getCollectionDescText(): string {
  const c = collection.value
  if (!c) {
    return ""
  }
  const t = pickCollectionText(c.id, c.title, c.description, i18nConfig.value)
  return t.description || c.description || ""
}

function getItemTitleText(item: StacItem): string {
  const cid = collection.value?.id || props.collectionId
  const t = pickItemText(cid, item.id, item.properties?.title, item.properties?.description, i18nConfig.value)
  return t.title || item.properties?.title || item.id
}

function getItemDescText(item: StacItem): string {
  const cid = collection.value?.id || props.collectionId
  const t = pickItemText(cid, item.id, item.properties?.title, item.properties?.description, i18nConfig.value)
  return t.description || item.properties?.description || ""
}

function getAssetTitleText(itemId: string, assetKey: string, asset: StacAsset): string {
  const cid = collection.value?.id || props.collectionId
  const t = pickAssetText(cid, itemId, assetKey, asset?.title, asset?.description, i18nConfig.value)
  return t.title || asset?.title || assetKey
}

function getAssetDescText(itemId: string, assetKey: string, asset: StacAsset): string {
  const cid = collection.value?.id || props.collectionId
  const t = pickAssetText(cid, itemId, assetKey, asset?.title, asset?.description, i18nConfig.value)
  return t.description || asset?.description || ""
}

function formatSummaryKeyLabel(key: string): string {
  return translateSummaryKey(key, i18nConfig.value)
}

function formatSummaryValueLabel(value: any): any {
  if (Array.isArray(value)) {
    return value.map((v) => translateSummaryValue(v, i18nConfig.value)).join(", ")
  }
  return translateSummaryValue(value, i18nConfig.value)
}

function getCollectionKeywords(): string[] {
  const c = collection.value
  if (!c) {
    return []
  }
  const mapped = (i18nConfig.value?.collections || {})[c.id]?.keywords
  if (Array.isArray(mapped) && mapped.length > 0) {
    return mapped.map((x: any) => String(x)).filter(Boolean)
  }
  return Array.isArray(c.keywords) ? c.keywords : []
}

// 可见性计算属性
const visibilityLabel = computed(() => {
  const visibility = (collection.value?.summaries as any)?.visibility as DatasetVisibility
  const labels: Record<DatasetVisibility, string> = {
    private: "🔒 私有",
    shared: "👥 协作",
    public: "🌍 公开"
  }
  return labels[visibility] || ""
})

const visibilityColor = computed(() => {
  const visibility = (collection.value?.summaries as any)?.visibility as DatasetVisibility
  const colors: Record<DatasetVisibility, string> = {
    private: "default",
    shared: "blue",
    public: "green"
  }
  return colors[visibility] || "default"
})

const parentDatasetId = computed(() => {
  const summaries = (collection.value?.summaries as any) || {}
  return typeof summaries.parentDatasetId === "string" ? summaries.parentDatasetId : ""
})

const sourceDatasetId = computed(() => {
  const summaries = (collection.value?.summaries as any) || {}
  return typeof summaries.sourceDatasetId === "string" ? summaries.sourceDatasetId : ""
})

const creatorLabel = computed(() => {
  const c: any = collection.value
  const summaries = (c?.summaries as any) || {}
  const raw = summaries.createdBy || summaries.creator || summaries.owner || c?.createdBy || c?.creator || c?.owner
  return typeof raw === "string" ? raw : ""
})

function formatDateTime(value: any): string {
  if (value === null || value === undefined || value === "") {
    return ""
  }
  try {
    const date = typeof value === "number" ? new Date(value) : new Date(String(value))
    if (Number.isNaN(date.getTime())) {
      return String(value)
    }
    return date.toLocaleString("zh-CN")
  } catch {
    return String(value)
  }
}

const createdAtText = computed(() => {
  const c: any = collection.value
  const summaries = (c?.summaries as any) || {}
  return formatDateTime(summaries.createdAt || c?.createdAt)
})

const updatedAtText = computed(() => {
  const c: any = collection.value
  const summaries = (c?.summaries as any) || {}
  return formatDateTime(summaries.updatedAt || c?.updatedAt)
})

const previewLayerLeafCount = computed(() => previewLayerLines.value.filter((item) => !item.isGroup).length)
const visiblePreviewLayerLines = computed(() => {
  if (!collapsedLayerGroupIds.value.length) {
    return previewLayerLines.value
  }
  const collapsed = new Set(collapsedLayerGroupIds.value)
  const byId = new Map(previewLayerLines.value.map((item) => [item.id, item]))
  return previewLayerLines.value.filter((item) => {
    let parentId = item.pid
    while (parentId) {
      if (collapsed.has(parentId)) {
        return false
      }
      parentId = byId.get(parentId)?.pid ?? null
    }
    return true
  })
})
const previewLayerEmptyText = computed(() => {
  if (previewLayerLoading.value) {
    return "加载图层中..."
  }
  if (!items.value.length) {
    return "暂无版本可展示图层"
  }
  return "该版本暂无可展示图层"
})

const coverUrl = ref("")

function resolveCoverUrlFromCollection(c: StacCollection | null): string {
  if (!c) {
    return ""
  }
  const links = c.links || []
  const byRel = links.find((l: any) => l.rel === "preview" || l.rel === "thumbnail" || l.rel === "self-preview")
  if (byRel?.href) {
    return resolveEoapiHref(byRel.href)
  }
  const assets = (c as any).assets || {}
  const asset = assets.thumbnail || assets.preview || assets.cover
  if (asset?.href) {
    return resolveEoapiHref(asset.href)
  }
  const summaries = (c.summaries as any) || {}
  if (typeof summaries.coverUrl === "string" && summaries.coverUrl) {
    return resolveEoapiHref(summaries.coverUrl)
  }
  return ""
}

async function refreshCoverUrl(ignoreDirect = false) {
  const c = collection.value
  const id = String(c?.id || props.collectionId || "").trim()
  if (!ignoreDirect) {
    const direct = resolveCoverUrlFromCollection(c)
    if (direct) {
      coverUrl.value = direct
      return
    }
  }
  if (id) {
    const persisted = await getPersistedDatasetCover(id)
    if (persisted) {
      coverUrl.value = persisted
      return
    }
  }
  const bbox = c?.extent?.spatial?.bbox?.[0]
  if (!bbox || bbox.length < 4) {
    coverUrl.value = ""
    return
  }
  const dataUrl = await getOrCreateBboxCover({
    datasetId: c!.id,
    title: c!.title || c!.id,
    bbox: [bbox[0], bbox[1], bbox[2], bbox[3]],
    width: 640,
    height: 360
  })
  coverUrl.value = dataUrl || ""
}

watch(
  () => collection.value,
  () => {
    coverUrl.value = resolveCoverUrlFromCollection(collection.value)
    refreshCoverUrl().catch(() => {})
  },
  { immediate: true }
)

function handleCoverImgError(): void {
  coverUrl.value = ""
  refreshCoverUrl(true).catch(() => {})
}

const metric = computed(() => {
  const _ = metricRefreshKey.value
  const id = collection.value?.id || props.collectionId
  return getDatasetMetric(id)
})

const isFavorite = computed(() => {
  const _ = metricRefreshKey.value
  const id = collection.value?.id || props.collectionId
  return isDatasetFavorite(id)
})

const favoriteDisplayCount = computed(() => Math.max(metric.value.favoriteCount || 0, metric.value.favorite ? 1 : 0))

// 检查当前数据集是否有导入分组在地图上
const hasImportedGroup = computed(() => {
  const map = mapWork.getMap()
  if (!map || !collection.value) { return false }
  const datasetId = collection.value.id
  const layers: any[] = map.getLayers({ basemaps: false }) || []
  return layers.some((l: any) => {
    const id = String(l?.id || "")
    return id.startsWith(`eoapi_group_${datasetId}_`) || id.startsWith(`myrepo_group_${datasetId}_`)
  })
})

// 加载数据集详情
async function loadCollectionDetail() {
  loading.value = true
  try {
    const result = await getCollection(props.collectionId)

    if (result.success && result.data) {
      collection.value = result.data
      // 加载 Items 列表
      await loadItems()
    } else {
      collection.value = null
      items.value = []
      $message(result.message || "加载数据集失败")
    }
  } catch (error: any) {
    console.error("[eoAPI] 加载数据集详情失败:", error)
    collection.value = null
    items.value = []
    $message("加载数据集失败")
  } finally {
    loading.value = false
  }

  recordDatasetBrowse(props.collectionId)
  loadArtifacts().catch(() => {})
}

async function loadArtifacts() {
  const datasetId = collection.value?.id || props.collectionId
  if (!datasetId) {
    artifacts.value = []
    resetArtifactWatchers([])
    return
  }
  artifactsLoading.value = true
  try {
    const res = await getArtifacts({ datasetId, limit: 50 })
    artifacts.value = res.success && Array.isArray(res.data) ? res.data : []
    resetArtifactWatchers(artifacts.value)
    const direct = resolveCoverUrlFromCollection(collection.value)
    if (!direct) {
      const coverArtifact =
        artifacts.value.find((a) => String((a as any)?.type || "") === "thumbnail") || artifacts.value.find((a) => isImageArtifact(a))
      const href = coverArtifact ? String((coverArtifact as any)?.url || "") : ""
      if (href) {
        coverUrl.value = resolveEoapiHref(href)
      }
    }
  } catch {
    artifacts.value = []
    resetArtifactWatchers([])
  } finally {
    artifactsLoading.value = false
  }
}

function formatArtifactDesc(a: Artifact) {
  const parts: string[] = []
  parts.push(getArtifactTypeName(a.type))
  if (a.size) {
    parts.push(formatArtifactSize(a.size))
  }
  if (a.createdAt) {
    parts.push(new Date(a.createdAt).toLocaleString())
  }
  return parts.join(" · ")
}

function canPreviewArtifact(a: Artifact): boolean {
  const mime = String((a as any)?.mime || "")
  if (mime.startsWith("image/")) {
    return true
  }
  if (mime === "application/pdf" || mime === "text/html") {
    return true
  }
  const url = String((a as any)?.url || "")
  if (/\.(pdf|html?)(\?.*)?$/i.test(url)) {
    return true
  }
  return /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url)
}

function isImageArtifact(a: Artifact): boolean {
  const mime = String((a as any)?.mime || "")
  if (mime.startsWith("image/")) {
    return true
  }
  const url = String((a as any)?.url || "")
  return /\.(png|jpg|jpeg|gif|webp|tif|tiff)(\?.*)?$/i.test(url)
}

function resolveBoundsFromMetadata(meta: any): [number, number, number, number] | null {
  const candidates = [meta?.bounds, meta?.bbox, meta?.extent?.bbox, meta?.coverage?.bbox, meta?.coverage?.bounds]
  for (const c of candidates) {
    const arr = Array.isArray(c) ? c : null
    if (!arr || arr.length !== 4) {
      continue
    }
    const west = Number(arr[0])
    const south = Number(arr[1])
    const east = Number(arr[2])
    const north = Number(arr[3])
    if ([west, south, east, north].every((n) => Number.isFinite(n))) {
      return [west, south, east, north]
    }
  }
  return null
}

function shrinkBounds(bounds: [number, number, number, number], ratio = 0.18): [number, number, number, number] {
  const [west, south, east, north] = bounds
  const cx = (west + east) / 2
  const cy = (south + north) / 2
  const dx = Math.max(0.00001, Math.abs(east - west) * ratio)
  const dy = Math.max(0.00001, Math.abs(north - south) * ratio)
  return [cx - dx, cy - dy, cx + dx, cy + dy]
}

function isTiffArtifact(a: Artifact): boolean {
  const mime = String((a as any)?.mime || "").toLowerCase()
  if (mime.includes("tiff")) {
    return true
  }
  const url = String((a as any)?.url || "")
  return /\.(tif|tiff)(\?.*)?$/i.test(url)
}

async function handleAddArtifactToMap(a: Artifact) {
  const datasetId = String(collection.value?.id || props.collectionId || "")
  if (!datasetId) {
    $message("缺少数据集 ID")
    return
  }
  const map = mapWork.getMap()
  if (!map) {
    $message("地图尚未初始化")
    return
  }
  let url = String(a?.url || "")
  try {
    const res = await getArtifactDownloadUrl(a.artifactId)
    url = String((res.success && (res.data as any)?.downloadUrl) || url)
  } catch {
  }
  if (!url) {
    $message("缺少附件地址")
    return
  }

  const datasetToken = normalizeLayerIdToken(datasetId, "dataset")
  const groupId = `myrepo_group_${datasetToken}_artifacts`
  const datasetName = String(collection.value?.title || datasetId)
  const sourceMeta: SourceRegistryMeta = {
    key: buildArtifactSourceKey(datasetId, String(a.artifactId || a.name || a.url || "")),
    label: `附件/${a.name || a.artifactId || "未命名附件"}`,
    kind: "artifact",
    groupId
  }
  ensureSourceLoad(sourceMeta, "block")
  ensureLayerLimit(1, "overlay", "加载附件")
  mapWork.ensureGroupLayer(groupId, `数据集成果/${datasetName}`)
  tagLayerSourceRegistry(mapWork.getLayerById(groupId), sourceMeta)

  const desiredLayerId = `myrepo_${datasetToken}_artifact_${normalizeLayerIdToken(a.artifactId, "artifact")}`
  const layerId = ensureUniqueMapLayerId(map as any, desiredLayerId, { fallbackBase: `myrepo_${datasetToken}_artifact` })

  const isXyz = /\{x\}|\{y\}|\{z\}/.test(url)
  let sourceType: any = "image"
  if (isXyz) {
    sourceType = "xyz"
  } else if (isTiffArtifact(a)) {
    sourceType = "geotiff"
  }
  const metaBounds = resolveBoundsFromMetadata((a as any)?.metadata)
  const defaultBounds = mapWork.getCurrentBounds ? mapWork.getCurrentBounds() : null
  const bounds = metaBounds || (defaultBounds ? shrinkBounds(defaultBounds) : null)
  const options = sourceType === "image" && bounds ? { bounds } : undefined

  try {
    const manifest = attachSourceRegistryToManifest({
      manifestVersion: "1.0",
      layers: [
        {
          id: layerId,
          name: String(a?.name || "附件图层"),
          sourceType: sourceType as any,
          sourceRef: url,
          pid: groupId,
          visible: true,
          opacity: 1,
          options
        } as any
      ],
      createdAt: Date.now()
    }, sourceMeta)
    await restoreWorkspace(map as any, manifest as any, {
      strategy: "overlay",
      conflictResolution: "skip",
      restoreView: false,
      restoreDrawFeatures: false
    })
    window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
    mapWork.flyToLayer(layerId)
    $message("已上图", "success")
  } catch (e: any) {
    $message(e?.message || "上图失败")
  }
}

async function handleOpenArtifact(a: Artifact) {
  if (!a?.artifactId) {
    return
  }
  if (!canPreviewArtifact(a)) {
    await handleDownloadArtifact(a)
    return
  }
  artifactPreviewTitle.value = a.name || "附件预览"
  artifactPreviewMime.value = String((a as any)?.mime || "")
  try {
    const res = await getArtifactDownloadUrl(a.artifactId)
    const url = res.success && (res.data as any)?.downloadUrl ? (res.data as any).downloadUrl : a.url
    artifactPreviewUrl.value = url || a.url
  } catch {
    artifactPreviewUrl.value = a.url
  }
  artifactPreviewOpen.value = true
}

function openLocalResultPicker() {
  localResultInputRef.value?.click()
}

async function handleLocalResultChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) {
    return
  }
  const map = mapWork.getMap()
  if (!map) {
    $message("地图尚未初始化")
    input.value = ""
    return
  }
  localResultLoading.value = true
  localResultProgressText.value = "正在准备本地成果文件"
  try {
    const datasetId = String(collection.value?.id || props.collectionId || "local")
    const validation = validateResultFile(file)
    if (!validation.ok) {
      throw new Error(validation.message)
    }
    const sourceMeta: SourceRegistryMeta = {
      key: buildLocalResultSourceKey(datasetId, file),
      label: `本地成果/${file.name}`,
      kind: "local"
    }
    if (["image", "geotiff", "geojson"].includes(validation.kind)) {
      ensureSourceLoad(sourceMeta, "block")
      ensureLayerLimit(1, "overlay", "加载本地成果")
    }
    const outcome = await loadResultFile(file, {
      map,
      datasetId,
      datasetName: String(collection.value?.title || "本地成果"),
      bounds: mapWork.getCurrentBounds ? mapWork.getCurrentBounds() : null,
      sourceMeta,
      onProgress: (detail) => {
        localResultProgressText.value = `${detail.text}（${detail.percent}%）`
      }
    })
    if (outcome.target === "preview" && outcome.url) {
      artifactPreviewTitle.value = outcome.name || "本地成果预览"
      artifactPreviewMime.value = outcome.mime || ""
      artifactPreviewUrl.value = outcome.url
      artifactPreviewOpen.value = true
      $message(outcome.message || "本地成果已准备预览", "success")
    } else {
      if (outcome.layerId) {
        mapWork.flyToLayer(outcome.layerId)
      }
      $message(outcome.message || "本地成果已加载", "success")
    }
  } catch (error: any) {
    $message(error?.message || "本地成果加载失败")
  } finally {
    localResultLoading.value = false
    window.setTimeout(() => {
      localResultProgressText.value = ""
    }, 1200)
    if (input) {
      input.value = ""
    }
  }
}

async function handleDownloadArtifact(a: Artifact) {
  try {
    const res = await getArtifactDownloadUrl(a.artifactId)
    const url = res.success && (res.data as any)?.downloadUrl ? (res.data as any).downloadUrl : a.url
    window.open(url, "_blank")
  } catch {
    window.open(a.url, "_blank")
  }
}

function closeArtifactPreview() {
  artifactPreviewOpen.value = false
  artifactPreviewUrl.value = ""
  artifactPreviewMime.value = ""
  artifactPreviewTitle.value = "附件预览"
}

function openCoverPreview() {
  if (!coverUrl.value) {
    return
  }
  coverPreviewOpen.value = true
}

function closeCoverPreview() {
  coverPreviewOpen.value = false
}

async function downloadPreviewCover() {
  const url = String(coverUrl.value || "").trim()
  if (!url) {
    return
  }
  const safeName = String(getCollectionTitleText() || collection.value?.id || "dataset-cover")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim()
  const filename = `${safeName || "dataset-cover"}.png`
  try {
    if (url.startsWith("data:")) {
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      return
    }
    const response = await fetch(url)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    $message("封面下载失败")
  }
}

// 加载 Items 列表
async function loadItems() {
  if (!props.collectionId) { return }

  loadingItems.value = true
  try {
    const result = await getItemsAll(props.collectionId)

    if (result.success && result.data && Array.isArray(result.data)) {
      const toMs = (s: any) => {
        const dt = s?.properties?.datetime
        const n = Date.parse(String(dt || ""))
        return Number.isFinite(n) ? n : 0
      }
      items.value = [...result.data].sort((a, b) => toMs(b) - toMs(a))
      if (items.value.length === 0) {
        selectedItem.value = null
      } else if (selectedItem.value) {
        selectedItem.value = items.value.find((item) => item.id === selectedItem.value?.id) || items.value[0]
      } else {
        selectedItem.value = items.value[0]
      }
    } else {
      items.value = []
      selectedItem.value = null
      $message(result.message || "加载条目失败")
    }
  } catch (error: any) {
    console.error("[eoAPI] 加载 Items 失败:", error)
    items.value = []
    selectedItem.value = null
    $message("加载条目失败")
  } finally {
    loadingItems.value = false
  }
}

function buildPreviewLayerLines(layers?: Manifest["layers"]) {
  const list = Array.isArray(layers) ? layers : []
  if (!list.length) {
    return []
  }

  // 过滤掉非地图图层（成果文档：PDF/HTML等）
  const NON_MAP_SOURCE_TYPES = ["pdf", "html", "htm", "document", "result"]
  const mapLayers = list.filter((l: any) => {
    const sourceType = String(l?.sourceType || "").toLowerCase()
    const type = String(l?.type || "").toLowerCase()
    return !NON_MAP_SOURCE_TYPES.includes(sourceType) && !NON_MAP_SOURCE_TYPES.includes(type)
  })

  const pidById = new Map<string, string | null>()
  const isGroupById = new Map<string, boolean>()
  const nameById = new Map<string, string>()
  const sourceTypeById = new Map<string, string>()
  const temporalById = new Map<string, string>()
  mapLayers.forEach((l: any) => {
    const id = String(l?.id || "")
    if (!id) {
      return
    }
    const pidRaw = l?.pid
    const pid = pidRaw === null || pidRaw === undefined || String(pidRaw) === "" ? null : String(pidRaw)
    pidById.set(id, pid)
    isGroupById.set(id, String(l?.sourceType || "") === "group")
    nameById.set(id, String(l?.name || id))
    sourceTypeById.set(id, String(l?.sourceType || ""))
    const mode = String(l?.temporal?.mode || l?.data?.temporalMode || "").trim()
    temporalById.set(id, mode)
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
  return mapLayers
    .map((l: any) => {
      const id = String(l?.id || "")
      const mode = temporalById.get(id) || ""
      let temporalLabel = ""
      if (mode === "saved") {
        temporalLabel = "保存时数据"
      } else if (mode === "latest") {
        temporalLabel = "最新数据"
      }
      return {
        id,
        pid: pidById.get(id) ?? null,
        name: nameById.get(id) || id,
        depth: depthOf(id),
        isGroup: !!isGroupById.get(id),
        sourceType: sourceTypeById.get(id) || "",
        temporalLabel
      }
    })
    .filter((x) => !!x.id)
}

function formatLayerTypeLabel(sourceType: string): string {
  const type = String(sourceType || "").toLowerCase()
  const labels: Record<string, string> = {
    group: "分组",
    xyz: "栅格",
    image: "栅格",
    tile: "栅格",
    tms: "栅格",
    wmts: "栅格",
    wms: "栅格",
    arcgis: "栅格",
    geojson: "矢量",
    vector: "矢量",
    wfs: "矢量",
    "3dtiles": "三维"
  }
  return labels[type] || (type ? type.toUpperCase() : "图层")
}

async function loadPreviewLayers() {
  const datasetId = collection.value?.id || props.collectionId
  const revision = selectedItem.value || items.value[0]
  previewLayerRevisionLabel.value = revision ? getItemTitleText(revision) : ""
  if (!datasetId || !revision?.id) {
    previewLayerLines.value = []
    collapsedLayerGroupIds.value = []
    return
  }
  previewLayerLoading.value = true
  try {
    const manifestRes = await getRevisionManifest(datasetId, revision.id)
    if (manifestRes.success && manifestRes.data) {
      previewLayerLines.value = buildPreviewLayerLines(manifestRes.data.layers)
      collapsedLayerGroupIds.value = []
      return
    }
    if (isStacCollection.value) {
      const fallback = buildFallbackManifestFromStacItem(datasetId, revision)
      previewLayerLines.value = buildPreviewLayerLines(fallback.layers)
      collapsedLayerGroupIds.value = []
      return
    }
    previewLayerLines.value = []
    collapsedLayerGroupIds.value = []
  } catch {
    if (isStacCollection.value && revision) {
      const fallback = buildFallbackManifestFromStacItem(datasetId, revision)
      previewLayerLines.value = buildPreviewLayerLines(fallback.layers)
      collapsedLayerGroupIds.value = []
    } else {
      previewLayerLines.value = []
      collapsedLayerGroupIds.value = []
    }
  } finally {
    previewLayerLoading.value = false
  }
}

function isLayerGroupCollapsed(layerId: string): boolean {
  return collapsedLayerGroupIds.value.includes(layerId)
}

function toggleLayerGroup(layerId: string): void {
  if (!layerId) {
    return
  }
  collapsedLayerGroupIds.value = collapsedLayerGroupIds.value.includes(layerId)
    ? collapsedLayerGroupIds.value.filter((id) => id !== layerId)
    : [...collapsedLayerGroupIds.value, layerId]
}

// 模拟数据
function getMockCollection(): StacCollection {
  return {
    id: props.collectionId,
    type: "Collection",
    title: "地震科学实验场示范数据集",
    description: "包含遥感影像、矢量数据、分析报告的综合示范数据集",
    keywords: ["地震", "InSAR", "人口", "分析报告"],
    license: "CC-BY-4.0",
    extent: {
      spatial: { bbox: [[103.0, 35.0, 105.0, 37.0]] },
      temporal: { interval: [["2024-01-01T00:00:00Z", "2024-03-31T23:59:59Z"]] }
    },
    links: [],
    summaries: {
      region: ["demo_region"],
      data_type: ["raster", "vector", "document"]
    }
  }
}

function getMockItems(): StacItem[] {
  return [
    {
      id: "insar_deformation_2024q1",
      type: "Feature",
      collection: props.collectionId,
      geometry: { type: "Polygon", coordinates: [] },
      properties: {
        datetime: "2024-03-15T00:00:00Z",
        title: "InSAR地表形变监测图",
        description: "基于Sentinel-1数据的地表形变监测结果"
      },
      assets: {
        data: { href: "https://example.com/data.tif", title: "形变数据", type: "image/tiff" },
        visual: { href: "https://example.com/visual.tif", title: "可视化图", type: "image/tiff" }
      },
      links: []
    },
    {
      id: "analysis_report_2024q1",
      type: "Feature",
      collection: props.collectionId,
      geometry: { type: "Point", coordinates: [104, 36] },
      properties: {
        datetime: "2024-03-31T00:00:00Z",
        title: "第一季度分析报告",
        description: "地震活动性分析报告"
      },
      assets: {
        pdf: { href: "https://example.com/report.pdf", title: "PDF报告", type: "application/pdf" }
      },
      links: []
    }
  ]
}

// 事件处理
function handleBack() {
  emit("back")
}

function handleOpenInMap() {
  if (collection.value) {
    emit("openInMap", collection.value, selectedItem.value || undefined)
  }
}

/**
 * 加载 STAC Collection 的影像到地图
 * 使用 titiler-pgstac 的 mosaic tiles API 加载整个 Collection 或选中 Item
 * 如果数据有公开 URL（如 MAXAR），优先使用 titiler-cog
 */
async function handleLoadStacMosaic() {
  if (!collection.value) {
    $message("数据集信息不完整")
    return
  }

  loadingStacImage.value = true

  try {
    const collectionId = collection.value.id
    const openedAt = Date.now()
    const groupId = buildStacImportGroupId(collectionId, openedAt)
    const layerIdPrefix = buildStacImportLayerPrefix(collectionId, openedAt)
    const selectedItemId = String(selectedItem.value?.id || "")
    const collectionRenders = (collection.value as any)?.renders
    const defaultAssets = collectionRenders?.visual?.assets || ["visual"]
    const assetBidx = collectionRenders?.visual?.asset_bidx || "visual|1,2,3"
    dbg("info", "stac.load", "handleLoadStacMosaic(start)", {
      collectionId,
      selectedItemId,
      itemsCount: items.value.length,
      defaultAssets,
      assetBidx
    })

    // 创建分组图层
    mapWork.ensureGroupLayer(groupId, `遥感影像/${collection.value.title || collectionId}`)
    loadedStacLayerId.value = groupId

    // 检查 Items 是否有公开 URL（如 MAXAR alternate.public.href）
    const hasPublicUrl = items.value.some((item: any) =>
      item?.assets?.visual?.alternate?.public?.href
    )
    dbg("info", "stac.load", "handleLoadStacMosaic(hasPublicUrl)", { collectionId, hasPublicUrl })

    // 如果有选中的 Item，加载单个 Item 的影像
    if (selectedItem.value) {
      const itemId = selectedItem.value.id
      const layerId = buildStacImportLayerId(collectionId, openedAt, itemId)
      const sourceMeta: SourceRegistryMeta = {
        key: buildStacSourceKey(collectionId, "quick-item", [itemId]),
        label: `遥感影像/${selectedItem.value.properties?.title || itemId}`,
        kind: "stac",
        groupId
      }
      ensureSourceLoad(sourceMeta, "block")
      ensureLayerLimit(1, "overlay", "加载遥感影像")

      // 使用新的 addStacItemLayer 函数，自动选择正确的 titiler 服务
      dbg("info", "stac.load", "handleLoadStacMosaic(addStacItemLayer)", {
        collectionId,
        itemId,
        layerId,
        groupId,
        assets: defaultAssets,
        assetBidx
      })
      const layer = mapWork.addStacItemLayer(layerId, collectionId, selectedItem.value, {
        name: selectedItem.value.properties?.title || itemId,
        pid: groupId,
        assets: defaultAssets,
        assetBidx
      })

      if (layer) {
        tagLayerSourceRegistry(mapWork.getLayerById(groupId), sourceMeta)
        tagLayerSourceRegistry(layer, sourceMeta)
        $message(`已加载影像: ${selectedItem.value.properties?.title || itemId}`)
        // 飞到 Item 的范围
        const bbox = selectedItem.value.bbox
        if (bbox && bbox.length >= 4) {
          mapWork.flyToBbox(bbox as [number, number, number, number])
        }
        recordDatasetImport(collectionId)
        setCurrentDataset({
          datasetId: collectionId,
          name: collection.value.title || collectionId,
          source: "repository"
        })
      } else {
        $message("影像加载失败")
      }
    } else if (hasPublicUrl) {
      // 数据有公开 URL 但未选择 Item，引导用户选择
      $message("请先选择一个影像产品，然后点击快速加载")
    } else if (items.value.length > 0) {
      const sourceMeta: SourceRegistryMeta = {
        key: buildStacSourceKey(collectionId, "quick-mosaic", selectedItemId ? [selectedItemId] : items.value.map((item) => item.id)),
        label: `遥感影像/${collection.value.title || collectionId}`,
        kind: "stac",
        groupId
      }
      ensureSourceLoad(sourceMeta, "block")
      ensureLayerLimit(1, "overlay", "加载遥感影像")
      // 没有公开 URL，尝试 titiler-pgstac mosaic（需要 AWS credentials）
      const mosaicLayerId = `${layerIdPrefix}mosaic`
      const titilerUrl = "/api/titiler"

      // 尝试使用 visual asset，如果不存在则使用其他可用 asset
      // 构建 mosaic tiles URL
      const xyzUrl = `${titilerUrl}/collections/${encodeURIComponent(collectionId)}/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=${defaultAssets.join(",")}&asset_bidx=${encodeURIComponent(assetBidx)}`
      dbg("info", "stac.load", "handleLoadStacMosaic(addXyzLayer.mosaic)", { collectionId, mosaicLayerId, xyzUrl })

      const layer = mapWork.addXyzLayer(mosaicLayerId, xyzUrl, {
        name: `${collection.value.title || collectionId} (Mosaic)`,
        opacity: 1,
        pid: groupId
      })

      if (layer) {
        tagLayerSourceRegistry(mapWork.getLayerById(groupId), sourceMeta)
        tagLayerSourceRegistry(layer, sourceMeta)
        // 飞到数据集范围
        const bbox = collection.value.extent?.spatial?.bbox?.[0]
        if (bbox && bbox.length >= 4) {
          mapWork.flyToBbox(bbox as [number, number, number, number])
        }

        $message(`已加载 ${items.value.length} 个影像产品`)
        recordDatasetImport(collectionId)
        setCurrentDataset({
          datasetId: collectionId,
          name: collection.value.title || collectionId,
          source: "repository"
        })
      } else {
        $message("影像加载失败")
      }
    } else {
      $message("暂无可加载的影像")
    }
  } catch (error: any) {
    console.error("[eoAPI] 加载 STAC 影像失败:", error)
    dbg("error", "stac.load", "handleLoadStacMosaic(error)", {
      collectionId: collection.value?.id,
      message: String(error?.message || ""),
      name: String(error?.name || ""),
      stack: typeof error?.stack === "string" ? error.stack.slice(0, 1200) : ""
    })
    $message(`加载失败: ${error.message}`)
  } finally {
    loadingStacImage.value = false
  }
}

/**
 * 加载单个 STAC Item 的影像
 */
async function handleLoadStacItem(item: StacItem) {
  if (!collection.value) {
    $message("数据集信息不完整")
    return
  }

  const collectionId = collection.value.id
  const itemId = item.id
  const openedAt = Date.now()
  const groupId = buildStacImportGroupId(collectionId, openedAt)
  const layerId = buildStacImportLayerId(collectionId, openedAt, itemId)
  dbg("info", "stac.load", "handleLoadStacItem(start)", {
    collectionId,
    itemId,
    openedAt,
    bbox: Array.isArray((item as any)?.bbox) ? (item as any).bbox : null,
    hasPublic: !!(item as any)?.assets?.visual?.alternate?.public?.href
  })
  const sourceMeta: SourceRegistryMeta = {
    key: buildStacSourceKey(collectionId, "quick-item", [itemId]),
    label: `遥感影像/${item.properties?.title || itemId}`,
    kind: "stac",
    groupId
  }
  ensureSourceLoad(sourceMeta, "block")
  ensureLayerLimit(1, "overlay", "加载遥感影像")

  // 创建分组图层
  mapWork.ensureGroupLayer(groupId, `遥感影像/${collection.value.title || collectionId}`)
  tagLayerSourceRegistry(mapWork.getLayerById(groupId), sourceMeta)

  // 使用新的 addStacItemLayer 函数，自动选择正确的 titiler 服务
  // 如果 Item 有 alternate.public.href，使用 titiler-cog（不需要 AWS credentials）
  dbg("info", "stac.load", "handleLoadStacItem(addStacItemLayer)", {
    collectionId,
    itemId,
    layerId,
    groupId,
    assets: ((collection.value as any)?.renders?.visual?.assets) || ["visual"],
    assetBidx: ((collection.value as any)?.renders?.visual?.asset_bidx) || "visual|1,2,3"
  })
  const layer = mapWork.addStacItemLayer(layerId, collectionId, item, {
    name: item.properties?.title || itemId,
    pid: groupId,
    assets: ((collection.value as any)?.renders?.visual?.assets) || ["visual"],
    assetBidx: ((collection.value as any)?.renders?.visual?.asset_bidx) || "visual|1,2,3"
  })

  if (layer) {
    tagLayerSourceRegistry(layer, sourceMeta)
    loadedStacLayerId.value = groupId

    // 飞到 Item 的范围
    const bbox = item.bbox
    if (bbox && bbox.length >= 4) {
      mapWork.flyToBbox(bbox as [number, number, number, number])
    }

    $message(`已加载影像: ${item.properties?.title || itemId}`)
    recordDatasetImport(collectionId)
    setCurrentDataset({
      datasetId: collectionId,
      name: collection.value.title || collectionId,
      source: "repository"
    })
  } else {
    $message("影像加载失败")
  }
}

/**
 * 用于"导入使用"的 STAC Item 加载（设置导入状态）
 */
async function handleLoadStacItemForImport(item: StacItem, strategy: RestoreStrategy) {
  await handleLoadStacItemsForImport([item.id], strategy)
}

/**
 * 用于"导入使用"的 STAC Collection 加载（加载指定的 Items）
 */
async function handleLoadStacItemsForImport(selectedItemIds: string[], strategy: RestoreStrategy) {
  if (!collection.value) {
    return
  }

  const collectionId = collection.value.id
  const openedAt = Date.now()
  const groupId = buildDatasetImportGroupId(collectionId, openedAt)
  const layerIdPrefix = buildDatasetImportLayerPrefix(collectionId, openedAt)
  const groupName = `导入: ${collection.value.title || collectionId}`

  lastResultGroupId.value = groupId
  lastResultPrefix.value = layerIdPrefix

  // 过滤出用户选择的且有 visual asset 的 items
  const validItems = items.value.filter((item) =>
    selectedItemIds.includes(item.id) && item.assets?.visual
  )
  if (validItems.length === 0) {
    importErrorText.value = "没有可加载的影像"
    $message("没有可加载的影像")
    return
  }
  const sourceMeta: SourceRegistryMeta = {
    key: buildStacSourceKey(collectionId, "import", validItems.map((item) => item.id)),
    label: `导入影像/${collection.value.title || collectionId}`,
    kind: "stac",
    groupId
  }
  ensureSourceLoad(sourceMeta, strategy === "replace" ? "replace" : "block")
  ensureLayerLimit(validItems.length, strategy, "导入遥感影像")

  const collectionBbox = collection.value.extent?.spatial?.bbox?.[0]

  // 使用批量 fallback 函数构建完整 manifest
  const baseManifest = buildFallbackManifestFromStacItems(collectionId, validItems, collectionBbox)

  // 统一加上前缀和分组
  const finalManifest = attachSourceRegistryToManifest({
    ...baseManifest,
    layers: baseManifest.layers.map((l, idx) => ({
      ...l,
      id: `${layerIdPrefix}${l.id}`,
      pid: groupId,
      order: idx
    })),
    viewState: {
      ...baseManifest.viewState,
      timestamp: openedAt
    }
  }, sourceMeta)

  // 先确保分组图层存在
  mapWork.ensureGroupLayer(groupId, groupName)
  tagLayerSourceRegistry(mapWork.getLayerById(groupId), sourceMeta)

  // 使用标准 restoreWorkspace 流程加载
  const map = mapWork.getMap()
  if (map) {
    try {
      isImporting.value = true
      await restoreWorkspace(map, finalManifest, {
        strategy,
        layerIdPrefix,
        layerParentId: groupId,
        restoreView: true,
        flyDuration: 1.5
      })

      restoredManifest.value = finalManifest
      restoredItemName.value = collection.value.title || collectionId
      importedLayerCount.value = finalManifest.layers.length
      importedGroupCount.value = 1
      importedBbox.value = finalManifest.viewState?.bbox || null

      showImportToast.value = true
      $message(`导入完成，已加载 ${finalManifest.layers.length} 个影像`)
      recordDatasetImport(collectionId)
      setCurrentDataset({
        datasetId: collectionId,
        name: collection.value.title || collectionId,
        source: "repository"
      })
    } catch (error: any) {
      console.error("[eoAPI] 导入失败:", error)
      importErrorText.value = error.message || "导入失败"
      $message("导入失败")
    } finally {
      isImporting.value = false
    }
  }
}

/**
 * 用于"导入使用"的 STAC Collection 加载（加载所有 Items）
 */
async function handleLoadStacMosaicForImport(strategy: RestoreStrategy) {
  await handleLoadStacItemsForImport(items.value.map((item) => item.id), strategy)
}

function handleLocate() {
  const bbox = collection.value?.extent?.spatial?.bbox?.[0]
  if (bbox && bbox.length >= 4) {
    mapWork.flyToBbox(bbox as [number, number, number, number])
  }
}

function toggleFavorite() {
  const id = collection.value?.id || props.collectionId
  toggleDatasetFavorite(id)
  metricRefreshKey.value += 1
  $message(isDatasetFavorite(id) ? "已收藏" : "已取消收藏")
}

function handleOpenLayerManager() {
  const focusPid = lastResultGroupId.value
  const returnCollectionId = String(collection.value?.id || props.collectionId || "").trim()
  activate({
    name: "manage-layers",
    data: {
      ...(focusPid ? { focusPid } : {}),
      returnTo: "dataset-repository",
      returnCollectionId
    }
  })
}

function handleOpenThematicWorkbench() {
  activate({
    name: "thematic-workbench",
    data: {
      props: {
        datasetId: String(collection.value?.id || props.collectionId || ""),
        datasetName: String(collection.value?.title || collection.value?.id || props.collectionId || ""),
        source: "dataset-detail",
        targetName: String(collection.value?.title || collection.value?.id || "当前数据集"),
        initialTab: "template"
      }
    }
  })
}

async function handleClearImport() {
  if (!collection.value) { return }
  const map = mapWork.getMap()
  if (!map) { return }
  if (!window.confirm("确认清除当前导入内容及其关联资源吗？此操作不可撤销。")) {
    return
  }
  const datasetId = collection.value.id
  const layers: any[] = map.getLayers({ basemaps: false }) || []
  const groupIds: string[] = []
  for (const l of layers) {
    const id = String(l?.id || "")
    if (id.startsWith(`eoapi_group_${datasetId}_`) || id.startsWith(`myrepo_group_${datasetId}_`)) {
      groupIds.push(id)
    }
  }
  if (groupIds.length === 0) {
    $message("没有可清除的导入内容")
    return
  }
  let deletedArtifacts = 0
  for (const gid of groupIds) {
    const res = await clearImportSession(gid, { datasetId, clearArtifacts: true }).catch(() => null)
    if (res?.success && res.data) {
      deletedArtifacts += Number(res.data.deletedArtifactCount || 0)
    }
  }
  for (const gid of groupIds) {
    mapWork.removeLayersByPid(gid)
    mapWork.removeLayer(gid)
  }
  // 清除相关状态
  importSnapshotManifest.value = null
  restoredManifest.value = null
  restoredItemName.value = ""
  lastResultGroupId.value = ""
  lastResultPrefix.value = ""
  importedBbox.value = null
  importedLayerCount.value = 0
  importedGroupCount.value = 0
  showImportToast.value = false
  lastImportedArtifactIds.value = []
  clearCurrentDataset(datasetId)
  recordDatasetEvent({
    datasetId,
    eventType: "clear_import",
    context: { groupCount: groupIds.length, deletedArtifactCount: deletedArtifacts }
  })
  $message(`已清除 ${groupIds.length} 个导入分组${deletedArtifacts ? `，删除 ${deletedArtifacts} 个附件` : ""}`)
  window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
}

// 工具栏下拉菜单事件处理
function handleImportMenuClick(e: { key: string }) {
  if (e.key === "current") {
    openImportDialog()
  } else if (e.key === "select") {
    // 打开导入对话框，让用户选择版本
    openImportDialog()
  }
}

function handleMoreMenuClick(e: { key: string }) {
  switch (e.key) {
    case "stacLoad":
      handleLoadStacMosaic()
      break
    case "downloadZip":
      handleDownloadZip()
      break
    case "layerVersion":
      openLayerVersionDrawer()
      break
    case "layerManager":
      handleOpenLayerManager()
      break
    case "thematicWorkbench":
      handleOpenThematicWorkbench()
      break
    case "clearImport":
      handleClearImport()
      break
  }
}

async function openImportDialog(item?: StacItem) {
  // #region debug-point current-task-import-open
  dbg("info", "current-task-import.dialog", "openImportDialog(start)", {
    flow: "current-task-import",
    collectionId: collection.value?.id || props.collectionId,
    passedItemId: item?.id || null,
    selectedItemIdBefore: selectedItem.value?.id || null,
    showImportDialogBefore: showImportDialog.value,
    itemsCount: items.value.length
  })
  // #endregion debug-point current-task-import-open
  if (item) {
    selectedItem.value = item
  }
  importErrorText.value = ""
  showImportDialog.value = true
  // #region debug-point current-task-import-open
  dbg("info", "current-task-import.dialog", "openImportDialog(set-open)", {
    flow: "current-task-import",
    collectionId: collection.value?.id || props.collectionId,
    selectedItemIdAfter: selectedItem.value?.id || null,
    showImportDialogAfter: showImportDialog.value
  })
  // #endregion debug-point current-task-import-open
}

function normalizeManifestForTimeMode(manifest: Manifest, mode: "saved" | "latest"): Manifest {
  if (mode === "saved") {
    return manifest
  }
  const cloned = JSON.parse(JSON.stringify(manifest)) as Manifest
  // latest 模式：使用当前地图视角，而非保存时的视角
  const currentView = mapWork.getViewState()
  if (currentView) {
    cloned.viewState = { ...currentView, timestamp: Date.now() }
  } else {
    cloned.viewState = cloned.viewState || {}
    cloned.viewState.timestamp = Date.now()
  }
  return cloned
}

type DedupRule = "skip" | "overwrite" | "merge"
type ImportFieldMapping = { source: string; target: string; enabled: boolean }
type ImportFineTuneConfig = {
  selectedFields?: string[]
  fieldMappings?: ImportFieldMapping[]
  spatialFilter?: {
    mode: "all" | "currentView" | "custom"
    bbox?: [number, number, number, number]
  }
  dedupRule?: DedupRule
}

type ImportPayload =
  | { mode: "revision"; revisionId: string | null; timeMode: "saved" | "latest"; strategy: RestoreStrategy; layerIds?: string[]; importAll?: boolean; selectedItems?: string[] }
  | { mode: "local"; strategy: RestoreStrategy; file: File; importName?: string; fineTune?: ImportFineTuneConfig }
  | { mode: "api"; strategy: RestoreStrategy; url: string; format: "auto" | "geojson" | "csv" | "shp"; token?: string; fineTune?: ImportFineTuneConfig }
  | { mode: "thirdparty"; strategy: RestoreStrategy; platform: string; url: string; projectId?: string; token?: string; format: "auto" | "geojson" | "csv" | "shp"; fineTune?: ImportFineTuneConfig }

function resetImportProgress() {
  importProgressText.value = ""
  importProgressPercent.value = 0
}

function setImportProgress(text: string, percent: number) {
  importProgressText.value = text
  importProgressPercent.value = Math.max(0, Math.min(100, Math.round(percent)))
}

function resetImportUploadState() {
  importUploadPausable.value = false
  importUploadPaused.value = false
  importResumePromise = null
  importResumeResolver = null
}

function pauseImportUpload() {
  if (!isImporting.value || !importUploadPausable.value || importUploadPaused.value) {
    return
  }
  importUploadPaused.value = true
}

function resumeImportUpload() {
  if (!importUploadPausable.value || !importUploadPaused.value) {
    return
  }
  importUploadPaused.value = false
  const resolver = importResumeResolver
  importResumeResolver = null
  importResumePromise = null
  resolver?.()
}

function waitForImportResume(): Promise<void> {
  if (!importUploadPaused.value) {
    return Promise.resolve()
  }
  if (!importResumePromise) {
    importResumePromise = new Promise<void>((resolve) => {
      importResumeResolver = resolve
    })
  }
  return importResumePromise
}

function normalizeGeojson(fc: any): any {
  if (!fc) {
    return null
  }
  if (fc.type === "FeatureCollection") {
    return fc
  }
  if (fc.type === "Feature") {
    return { type: "FeatureCollection", features: [fc] }
  }
  if (fc.type && fc.coordinates) {
    return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: fc }] }
  }
  return null
}

function parseCsvRowsToGeojson(rows: Array<Record<string, any>>): any {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null
  }
  const headers = Object.keys(rows[0] || {})
  const lonKey = headers.find((h) => ["lon", "lng", "longitude", "x"].includes(h.toLowerCase()))
  const latKey = headers.find((h) => ["lat", "latitude", "y"].includes(h.toLowerCase()))
  if (!lonKey || !latKey) {
    return null
  }
  const features = rows
    .map((row) => {
      const lon = Number(row[lonKey])
      const lat = Number(row[latKey])
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        return null
      }
      const properties = { ...row }
      delete properties[lonKey]
      delete properties[latKey]
      return {
        type: "Feature",
        properties,
        geometry: { type: "Point", coordinates: [lon, lat] }
      }
    })
    .filter(Boolean)
  return features.length ? { type: "FeatureCollection", features } : null
}

function parseCsvToGeojson(text: string): any {
  const lines = String(text || "").split(/\r?\n/g).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) {
    return null
  }
  const headers = lines[0].split(",").map((x) => x.trim())
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",")
    const row: Record<string, any> = {}
    headers.forEach((h, idx) => {
      row[h] = cols[idx]
    })
    return row
  })
  return parseCsvRowsToGeojson(rows)
}

function stableStringify(value: any): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function collectGeometryCoords(input: any, out: number[][]) {
  if (!input) {
    return
  }
  if (Array.isArray(input) && typeof input[0] === "number" && typeof input[1] === "number") {
    out.push([Number(input[0]), Number(input[1])])
    return
  }
  if (Array.isArray(input)) {
    input.forEach((item) => collectGeometryCoords(item, out))
  }
}

function getFeatureBbox(feature: any): [number, number, number, number] | null {
  const coords: number[][] = []
  collectGeometryCoords(feature?.geometry?.coordinates, coords)
  const valid = coords.filter((item) => Number.isFinite(item[0]) && Number.isFinite(item[1]))
  if (!valid.length) {
    return null
  }
  const xs = valid.map((item) => item[0])
  const ys = valid.map((item) => item[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

function intersectsBbox(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
}

function normalizeMappings(input?: ImportFieldMapping[]): ImportFieldMapping[] {
  return Array.isArray(input)
    ? input
        .map((item) => ({
          source: String(item?.source || "").trim(),
          target: String(item?.target || "").trim(),
          enabled: item?.enabled !== false
        }))
        .filter((item) => item.source)
    : []
}

function getSpatialFilterBbox(config?: ImportFineTuneConfig): [number, number, number, number] | null {
  const mode = config?.spatialFilter?.mode || "all"
  if (mode === "all") {
    return null
  }
  if (mode === "currentView") {
    return mapWork.getCurrentBounds()
  }
  const bbox = config?.spatialFilter?.bbox
  if (!Array.isArray(bbox) || bbox.length < 4) {
    return null
  }
  const normalized = bbox.map((item) => Number(item))
  if (normalized.some((item) => !Number.isFinite(item))) {
    return null
  }
  return normalized as [number, number, number, number]
}

function dedupFeatures(features: any[], rule: DedupRule): any[] {
  if (!Array.isArray(features) || features.length <= 1) {
    return Array.isArray(features) ? features : []
  }
  const result: any[] = []
  const indexByGeometry = new Map<string, number>()
  const indexByProps = new Map<string, number>()
  for (const feature of features) {
    const geometryKey = stableStringify(feature?.geometry || null)
    const propsKey = stableStringify(feature?.properties || {})
    const byGeometry = geometryKey !== "null" ? indexByGeometry.get(geometryKey) : undefined
    const byProps = propsKey !== "{}" ? indexByProps.get(propsKey) : undefined
    const existingIndex = byGeometry ?? byProps
    if (existingIndex === undefined) {
      result.push(feature)
      const nextIndex = result.length - 1
      if (geometryKey !== "null") {
        indexByGeometry.set(geometryKey, nextIndex)
      }
      if (propsKey !== "{}") {
        indexByProps.set(propsKey, nextIndex)
      }
      continue
    }
    if (rule === "skip") {
      continue
    }
    if (rule === "overwrite") {
      result[existingIndex] = feature
      if (geometryKey !== "null") {
        indexByGeometry.set(geometryKey, existingIndex)
      }
      if (propsKey !== "{}") {
        indexByProps.set(propsKey, existingIndex)
      }
      continue
    }
    result[existingIndex] = {
      ...result[existingIndex],
      properties: {
        ...(result[existingIndex]?.properties || {}),
        ...(feature?.properties || {})
      }
    }
  }
  return result
}

function applyFineTuneToGeojson(geojson: any, config?: ImportFineTuneConfig): any {
  if (!geojson?.features?.length) {
    return geojson
  }
  const selectedFields = new Set(
    Array.isArray(config?.selectedFields)
      ? config!.selectedFields!.map((item) => String(item || "").trim()).filter(Boolean)
      : []
  )
  const mappings = normalizeMappings(config?.fieldMappings)
  const mappingBySource = new Map<string, ImportFieldMapping>()
  mappings.forEach((item) => mappingBySource.set(item.source, item))
  let features = (geojson.features || []).map((feature: any) => {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {}
    const nextProps: Record<string, any> = {}
    Object.keys(props).forEach((key) => {
      if (selectedFields.size > 0 && !selectedFields.has(key)) {
        return
      }
      const mapping = mappingBySource.get(key)
      if (mapping && mapping.enabled === false) {
        return
      }
      const targetKey = mapping?.target || key
      nextProps[targetKey] = props[key]
    })
    return {
      ...feature,
      properties: nextProps
    }
  })
  const bbox = getSpatialFilterBbox(config)
  if (bbox) {
    features = features.filter((feature: any) => {
      const featureBbox = getFeatureBbox(feature)
      return featureBbox ? intersectsBbox(featureBbox, bbox) : false
    })
  }
  const dedupRule = config?.dedupRule || "skip"
  features = dedupFeatures(features, dedupRule)
  return {
    ...geojson,
    features
  }
}

function inferFormatFromName(name: string, explicit?: string): "geojson" | "csv" | "shp" {
  const given = String(explicit || "").toLowerCase()
  if (["geojson", "csv", "shp"].includes(given)) {
    return given as any
  }
  const lower = String(name || "").toLowerCase()
  if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
    return "geojson"
  }
  if (lower.endsWith(".zip")) {
    return "shp"
  }
  return "csv"
}

async function parseArrayBufferToGeojson(buffer: ArrayBuffer, format: "geojson" | "csv" | "shp"): Promise<any> {
  if (format === "geojson") {
    return normalizeGeojson(JSON.parse(new TextDecoder().decode(buffer)))
  }
  if (format === "csv") {
    return parseCsvToGeojson(new TextDecoder().decode(buffer))
  }
  const parsed = await (shp as any)(buffer)
  return normalizeGeojson(parsed)
}

function buildGeojsonImportManifest(input: {
  groupId: string
  layerId: string
  groupName: string
  layerName: string
  geojson: any
}): Manifest {
  return {
    manifestVersion: "1.0.0",
    createdAt: Date.now(),
    viewState: mapWork.getViewState() || undefined,
    layers: [
      { id: input.groupId, name: input.groupName, sourceType: "group", sourceRef: "", visible: true, opacity: 1, order: 0 } as any,
      { id: input.layerId, name: input.layerName, sourceType: "geojson", sourceRef: "", data: input.geojson, pid: input.groupId, visible: true, opacity: 1, order: 1 } as any
    ]
  } as Manifest
}

async function finalizeImportSession(input: {
  groupId: string
  sourceType: "revision" | "local" | "api" | "thirdparty"
  artifactIds?: string[]
  revisionId?: string
  metadata?: Record<string, any>
}) {
  const datasetId = collection.value?.id || props.collectionId
  await createImportSession({
    datasetId,
    groupId: input.groupId,
    sourceType: input.sourceType,
    artifactIds: input.artifactIds || [],
    revisionId: input.revisionId,
    metadata: input.metadata || {}
  }).catch(() => {})
  lastImportSourceType.value = input.sourceType
  lastImportedArtifactIds.value = Array.isArray(input.artifactIds) ? input.artifactIds : []
}

async function handleExternalGeojsonImport(input: {
  sourceType: "local" | "api" | "thirdparty"
  name: string
  geojson: any
  strategy: RestoreStrategy
  artifactId?: string
  metricContext?: Record<string, any>
  sourceMeta: SourceRegistryMeta
}) {
  if (!collection.value) {
    return
  }
  const map = mapWork.getMap()
  if (!map) {
    throw new Error("地图未初始化")
  }
  const openedAt = Date.now()
  const datasetId = collection.value.id
  const datasetName = collection.value.title || collection.value.id
  const groupId = buildDatasetImportGroupId(datasetId, openedAt)
  const prefix = buildDatasetImportLayerPrefix(datasetId, openedAt)
  const layerId = `${prefix}layer_1`
  const inferredFormat = inferFormatFromName(input.name)
  let importSourceLabel: string
  switch (input.sourceType) {
    case "local":
      importSourceLabel = "本地上传"
      break
    case "api":
      importSourceLabel = "API拉取"
      break
    default:
      importSourceLabel = "第三方同步"
      break
  }
  const classifiedGroupName = classifyLayer({
    type: "vector",
    format: inferredFormat,
    source: importSourceLabel
  })
  const groupName = classifiedGroupName === DEFAULT_GROUP ? `导入: ${datasetName || datasetId}` : classifiedGroupName

  ensureSourceLoad({
    ...input.sourceMeta,
    groupId
  }, input.strategy === "replace" ? "replace" : "block")
  ensureLayerLimit(1, input.strategy, "导入数据")
  mapWork.ensureGroupLayer(groupId, groupName)
  tagLayerSourceRegistry(mapWork.getLayerById(groupId), {
    ...input.sourceMeta,
    groupId
  })
  if (input.strategy === "replace") {
    const previousGroups: string[] = []
    const layers: any[] = map.getLayers({ basemaps: false }) || []
    layers.forEach((l: any) => {
      const id = String(l?.id || "")
      if (id.startsWith(`eoapi_group_${datasetId}_`) || id.startsWith(`myrepo_group_${datasetId}_`)) {
        previousGroups.push(id)
      }
    })
    previousGroups.forEach((gid) => {
      mapWork.removeLayersByPid(gid)
      mapWork.removeLayer(gid)
    })
  }

  const added = mapWork.addGeoJsonLayer(layerId, input.geojson, { name: input.name, pid: groupId })
  if (!added) {
    throw new Error("创建导入图层失败")
  }
  tagLayerSourceRegistry(added, {
    ...input.sourceMeta,
    groupId
  })
  const manifest = attachSourceRegistryToManifest(buildGeojsonImportManifest({
    groupId,
    layerId,
    groupName,
    layerName: input.name,
    geojson: input.geojson
  }), {
    ...input.sourceMeta,
    groupId
  })
  lastResultGroupId.value = groupId
  lastResultPrefix.value = prefix
  restoredManifest.value = manifest
  restoredItemName.value = input.name
  importedLayerCount.value = 1
  importedGroupCount.value = 1
  importedBbox.value = (mapWork.getViewState()?.bbox || null) as any
  showImportToast.value = true
  showImportDialog.value = false
  recordDatasetImport(datasetId)
  recordDatasetEvent({
    datasetId,
    eventType: `import_${input.sourceType}`,
    context: input.metricContext || {}
  })
  await finalizeImportSession({
    groupId,
    sourceType: input.sourceType,
    artifactIds: input.artifactId ? [input.artifactId] : [],
    metadata: input.metricContext
  })
  window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
  $message("导入完成")
  try {
    mapWork.flyToLayer(layerId)
    await mapWork.flashLayer(layerId, { times: 6, intervalMs: 500 })
  } catch {
  }
}

async function resolveImportManifest(
  datasetId: string,
  payload: ImportPayload
): Promise<{ manifest: Manifest; revisionId: string } | { error: string }> {
  if (payload.mode !== "revision") {
    return { error: "仅版本导入支持成果包解析" }
  }
  if (payload.timeMode === "latest") {
    const latestRes = await getLatestDatasetManifest(datasetId)
    if (latestRes.success && latestRes.data?.manifest) {
      return {
        manifest: latestRes.data.manifest,
        revisionId: String(latestRes.data.revisionId || items.value[0]?.id || payload.revisionId || "")
      }
    }

    const latestRevisionId = String(items.value[0]?.id || payload.revisionId || "").trim()
    if (!latestRevisionId) {
      return { error: latestRes.message || "未找到最新版本" }
    }

    const fallbackLatest = await getRevisionManifest(datasetId, latestRevisionId)
    if (fallbackLatest.success && fallbackLatest.data) {
      return { manifest: fallbackLatest.data, revisionId: latestRevisionId }
    }

    return { error: fallbackLatest.message || latestRes.message || "获取最新版本成果包失败" }
  }

  const revisionId = String(payload.revisionId || "").trim()
  if (!revisionId) {
    return { error: "请选择版本" }
  }

  const manifestRes = await getRevisionManifest(datasetId, revisionId)
  if (manifestRes.success && manifestRes.data) {
    return { manifest: manifestRes.data, revisionId }
  }

  return { error: manifestRes.message || "无法获取成果包(manifest)" }
}

function pickLayersById(layers: any[], keepIds: string[]): any[] {
  const list = Array.isArray(layers) ? layers : []
  const keep = new Set<string>((keepIds || []).map(String))
  if (keep.size === 0) {
    return list
  }
  // 构建 id -> pid 映射
  const idToPid = new Map<string, string>()
  const idToLayer = new Map<string, any>()
  for (const l of list) {
    const id = String((l as any)?.id || "")
    if (!id) { continue }
    idToLayer.set(id, l)
    const pid = String((l as any)?.pid || "")
    if (pid) { idToPid.set(id, pid) }
  }
  // 从每个选中的叶子向上追溯，收集所有祖先 group
  const result = new Set<string>()
  for (const id of keep) {
    let cur = id
    for (let i = 0; i < 20 && cur; i++) {
      result.add(cur)
      cur = idToPid.get(cur) || ""
    }
  }
  return list.filter((l) => result.has(String((l as any)?.id || "")))
}

function categorizeLayersForImport(layers: any[], prefixHint?: string): any[] {
  const list = Array.isArray(layers) ? layers : []
  if (list.length === 0) {
    return []
  }

  // 检查是否已有完整的层级结构（包含 group 图层和有效的 pid 关系）
  const ids = new Set<string>(list.map((l) => String((l as any)?.id || "")).filter(Boolean))
  const hasExistingGroups = list.some((l) => String((l as any)?.sourceType || "") === "group")
  const hasValidPids = list.some((l) => {
    const pid = (l as any)?.pid
    return pid !== null && pid !== undefined && String(pid) !== "" && String(pid) !== String((l as any)?.id) && ids.has(String(pid))
  })

  // 如果已有层级结构，保持原有结构不变，只添加 ID 前缀
  if (hasExistingGroups && hasValidPids) {
    return list.map((l, idx) => ({
      ...l,
      order: Number.isFinite((l as any)?.order) ? (l as any)?.order : idx
    }))
  }

  // 否则，使用原有的分类逻辑（按类型分组）
  const leaf = list.filter((l) => String((l as any)?.sourceType || "") !== "group")
  if (leaf.length === 0) {
    return list // 如果全是 group，返回原列表
  }

  const categories: Array<{ id: string; name: string; match: (t: string) => boolean }> = [
    { id: "__type_raster", name: "栅格", match: (t) => ["xyz", "wms", "wmts", "tms", "tile", "arcgis", "image", "img"].includes(t) },
    { id: "__type_vector", name: "矢量", match: (t) => ["geojson", "vector", "wfs"].includes(t) },
    { id: "__type_3d", name: "三维", match: (t) => ["3dtiles"].includes(t) },
    { id: "__type_other", name: "其他", match: () => true }
  ]

  const usedCat = new Set<string>()
  const catOfLayer = (l: any) => {
    const t = String(l?.sourceType || "")
    const c = categories.find((x) => x.match(t)) || categories[categories.length - 1]
    const cid = prefixHint ? `${c.id}_${prefixHint}` : c.id
    usedCat.add(cid)
    return cid
  }

  const ordered = [...leaf].sort((a, b) => (Number((a as any)?.order) || 0) - (Number((b as any)?.order) || 0))
  const remapped = ordered.map((l, idx) => {
    const cid = catOfLayer(l)
    return {
      ...l,
      pid: cid,
      order: Number.isFinite((l as any)?.order) ? (l as any)?.order : idx
    }
  })

  const finalGroups = categories
    .map((c) => {
      const id = prefixHint ? `${c.id}_${prefixHint}` : c.id
      if (!usedCat.has(id)) {
        return null
      }
      return {
        id,
        name: c.name,
        sourceType: "group",
        sourceRef: "",
        visible: true,
        opacity: 1
      }
    })
    .filter(Boolean)
    .map((g: any, idx: number) => ({ ...g, order: idx }))

  return [...finalGroups, ...remapped]
}

async function handleImportSubmit(payload: ImportPayload) {
  // #region debug-point current-task-import-submit
  dbg("info", "current-task-import.dialog", "handleImportSubmit(start)", {
    flow: "current-task-import",
    collectionId: collection.value?.id || props.collectionId,
    mode: payload.mode,
    strategy: payload.strategy,
    revisionId: "revisionId" in payload ? payload.revisionId || null : null,
    selectedItemsCount: "selectedItems" in payload && Array.isArray(payload.selectedItems) ? payload.selectedItems.length : 0,
    showImportDialog: showImportDialog.value,
    isImporting: isImporting.value
  })
  // #endregion debug-point current-task-import-submit
  if (isImporting.value) {
    return
  }
  if (!collection.value) {
    return
  }
  importErrorText.value = ""
  const map = mapWork.getMap()
  if (!map) {
    $message("地图未初始化")
    return
  }

  isImporting.value = true
  resetImportUploadState()
  try {
    importSnapshotManifest.value = serializeWorkspace(map, {
      includeViewState: true,
      includeLayers: true,
      includeDrawFeatures: true
    })

    if (payload.mode === "local") {
      const file = payload.file
      const format = inferFormatFromName(file.name)
      const sourceMeta: SourceRegistryMeta = {
        key: buildLocalResultSourceKey(collection.value.id, file),
        label: `导入本地数据/${payload.importName || file.name}`,
        kind: "local"
      }
      const isLargeFileUpload = file.size >= 4 * 1024 * 1024 * 1024
      importUploadPausable.value = isLargeFileUpload
      setImportProgress("解析本地文件...", 5)
      const geojsonRaw = await parseArrayBufferToGeojson(await file.arrayBuffer(), format)
      const geojson = applyFineTuneToGeojson(geojsonRaw, payload.fineTune)
      if (!geojson?.features?.length) {
        throw new Error("本地文件解析失败，未识别到符合配置的有效要素")
      }
      setImportProgress(isLargeFileUpload ? "计算 MD5 并准备分片上传..." : "上传文件中...", 12)
      const uploadRes = await smartUploadArtifact({
        file,
        name: payload.importName || file.name,
        type: "data",
        datasetId: collection.value.id
      }, {
        chunkSize: 50 * 1024 * 1024,
        concurrency: 3,
        onProgress: (percent) => {
          const progressText = isLargeFileUpload && percent < 8 ? "计算 MD5 并准备分片上传..." : "上传文件中..."
          setImportProgress(progressText, 12 + percent * 0.76)
        },
        control: isLargeFileUpload
          ? {
              isPauseRequested: () => importUploadPaused.value,
              waitForResume: () => waitForImportResume(),
              onStateChange: (state) => {
                if (state === "paused") {
                  setImportProgress("上传已暂停，等待继续...", importProgressPercent.value)
                  return
                }
                if (state === "hashing") {
                  setImportProgress("计算 MD5 并准备分片上传...", Math.max(importProgressPercent.value, 12))
                  return
                }
                if (state === "uploading") {
                  setImportProgress("上传文件中...", Math.max(importProgressPercent.value, 12))
                }
              }
            }
          : undefined
      })
      if (!uploadRes.success) {
        throw new Error(uploadRes.message || "文件上传失败")
      }
      setImportProgress(isLargeFileUpload ? "MD5 校验完成，写入地图图层..." : "写入地图图层...", 92)
      await handleExternalGeojsonImport({
        sourceType: "local",
        name: payload.importName || file.name,
        geojson,
        strategy: payload.strategy,
        artifactId: uploadRes.data?.artifactId,
        sourceMeta,
        metricContext: {
          fileName: file.name,
          format,
          fileSize: file.size,
          featureCount: geojson.features.length,
          dedupRule: payload.fineTune?.dedupRule || "skip",
          selectedFieldCount: Array.isArray(payload.fineTune?.selectedFields) ? payload.fineTune?.selectedFields?.length : 0
        }
      })
      setImportProgress("导入完成", 100)
      return
    }

    if (payload.mode === "api" || payload.mode === "thirdparty") {
      const requestUrl = payload.url
      const format = inferFormatFromName(requestUrl, payload.format)
      const sourceMeta: SourceRegistryMeta = {
        key: buildRemoteImportSourceKey(payload.mode, requestUrl, payload.mode === "thirdparty" ? payload.projectId : format),
        label: payload.mode === "thirdparty"
          ? `第三方数据/${payload.platform}${payload.projectId ? `-${payload.projectId}` : ""}`
          : `API数据/${requestUrl.split("/").pop() || "远程数据"}`,
        kind: payload.mode
      }
      setImportProgress(payload.mode === "api" ? "拉取远程数据..." : "同步第三方数据...", 10)
      const headers: Record<string, string> = {}
      const token = payload.token
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      if (payload.mode === "thirdparty" && payload.projectId) {
        headers["X-Project-Id"] = payload.projectId
      }
      const resp = await fetch(requestUrl, { headers })
      if (!resp.ok) {
        throw new Error(`远程数据拉取失败: HTTP ${resp.status}`)
      }
      const buffer = await resp.arrayBuffer()
      setImportProgress("解析数据内容...", 55)
      const geojsonRaw = await parseArrayBufferToGeojson(buffer, format)
      const geojson = applyFineTuneToGeojson(geojsonRaw, payload.fineTune)
      if (!geojson?.features?.length) {
        throw new Error("远程数据解析失败，未识别到符合配置的有效要素")
      }
      setImportProgress("写入地图图层...", 92)
      await handleExternalGeojsonImport({
        sourceType: payload.mode,
        name: payload.mode === "thirdparty"
          ? `${payload.platform}${payload.projectId ? `-${payload.projectId}` : ""}`
          : requestUrl.split("/").pop() || "API数据",
        geojson,
        strategy: payload.strategy,
        sourceMeta,
        metricContext: payload.mode === "thirdparty"
          ? {
              url: requestUrl,
              format,
              platform: payload.platform,
              projectId: payload.projectId || "",
              featureCount: geojson.features.length,
              dedupRule: payload.fineTune?.dedupRule || "skip"
            }
          : {
              url: requestUrl,
              format,
              featureCount: geojson.features.length,
              dedupRule: payload.fineTune?.dedupRule || "skip"
            }
      })
      setImportProgress("导入完成", 100)
      return
    }

    // 如果是 STAC Collection 且选择了"全部"，直接加载整个 Collection
    if (isStacCollection.value && payload.importAll) {
      await handleLoadStacMosaicForImport(payload.strategy)
      showImportDialog.value = false
      return
    }

    // 如果是 STAC Collection 且选择了指定的切片
    if (isStacCollection.value && payload.selectedItems && payload.selectedItems.length > 0) {
      await handleLoadStacItemsForImport(payload.selectedItems, payload.strategy)
      showImportDialog.value = false
      return
    }

    // 非 STAC manifest 导入：saved 使用所选版本，latest 强制解析最新版本
    const resolved = await resolveImportManifest(collection.value.id, payload)

    // 如果 manifest 不存在，对于 STAC Collection 使用快速加载逻辑
    if (!("manifest" in resolved)) {
      if (isStacCollection.value && payload.revisionId) {
        // STAC Collection 单个切片导入
        const targetItem = items.value.find((x) => x.id === payload.revisionId)
        if (targetItem) {
          await handleLoadStacItemForImport(targetItem, payload.strategy)
          showImportDialog.value = false
          return
        }
      }
      // 非 STAC Collection，显示错误
      const msg = resolved.error || "无法获取成果包(manifest)"
      importErrorText.value = msg
      $message(msg)
      return
    }

    const openedAt = Date.now()
    const datasetId = collection.value.id
    const datasetName = collection.value.title || collection.value.id
    const groupId = buildDatasetImportGroupId(datasetId, openedAt)
    const prefix = buildDatasetImportLayerPrefix(datasetId, openedAt)

    const manifestRaw = normalizeManifestForTimeMode(resolved.manifest, payload.timeMode)
    const pickedLayers = pickLayersById((manifestRaw as any)?.layers || [], payload.layerIds || [])
    const categorizedLayers = categorizeLayersForImport(pickedLayers, `${datasetId}_${openedAt}`)
    const sourceMeta: SourceRegistryMeta = {
      key: buildRevisionImportSourceKey(datasetId, resolved.revisionId, payload.timeMode, payload.layerIds || []),
      label: `成果版本/${resolved.revisionId}`,
      kind: "revision",
      groupId
    }
    ensureSourceLoad(sourceMeta, payload.strategy === "replace" ? "replace" : "block")
    const manifest = attachSourceRegistryToManifest({
      ...(manifestRaw as any),
      layers: categorizedLayers
    } as any, sourceMeta)
    ensureLayerLimit(countManifestLayers(manifest), payload.strategy, "导入成果版本")
    mapWork.ensureGroupLayer(groupId, `导入: ${datasetName || datasetId}`)
    tagLayerSourceRegistry(mapWork.getLayerById(groupId), sourceMeta)
    lastResultGroupId.value = groupId
    lastResultPrefix.value = prefix
    const conflictResolution: ConflictResolution = payload.strategy === "overlay" ? "rename" : "replace"

    await restoreWorkspace(map, manifest, {
      strategy: payload.strategy,
      conflictResolution,
      layerIdPrefix: prefix,
      layerNamePrefix: "",
      layerParentId: groupId,
      drawIdPrefix: prefix,
      restoreView: true,
      restoreLayers: true,
      restoreDrawFeatures: true,
      flyDuration: 1.2,
      onComplete: () => {
        setImportProgress("恢复成果图层...", 96)
        restoredManifest.value = manifest
        const imported = items.value.find((x) => x.id === resolved.revisionId)
        restoredItemName.value = imported?.properties?.title || resolved.revisionId
        recordDatasetImport(collection.value!.id)
        setCurrentDataset({
          datasetId: collection.value!.id,
          name: collection.value!.title || collection.value!.id,
          source: "repository"
        })
        // 设置导入后的bbox用于定位
        const bbox = manifest.viewState?.bbox
        if (bbox && bbox.length === 4) {
          importedBbox.value = bbox as [number, number, number, number]
        }
        // 计算导入的图层和分组数量
        const importedLayers = manifest.layers || []
        const groups = importedLayers.filter((l: any) => String(l?.sourceType || "") === "group")
        const leafs = importedLayers.filter((l: any) => String(l?.sourceType || "") !== "group")
        importedGroupCount.value = groups.length
        importedLayerCount.value = leafs.length
        // 显示导入成功提示条
        showImportToast.value = true
        $message("导入完成")
        showImportDialog.value = false
        lastImportedArtifactIds.value = []
        lastImportSourceType.value = "revision"
        finalizeImportSession({
          groupId,
          sourceType: "revision",
          revisionId: resolved.revisionId,
          metadata: { strategy: payload.strategy, timeMode: payload.timeMode, layerCount: leafs.length }
        }).catch(() => {})
        recordDatasetEvent({
          datasetId,
          revisionId: resolved.revisionId,
          eventType: "import_revision",
          context: { strategy: payload.strategy, timeMode: payload.timeMode, layerCount: leafs.length }
        })
        window.dispatchEvent(new CustomEvent("mars3d:session-persist", { detail: { datasetId, groupId, openedAt, source: "repository", groupName: `导入: ${datasetName || datasetId}`, layerIdPrefix: prefix, manifest } }))
        // 通知图层目录刷新
        window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
        setImportProgress("导入完成", 100)
      },
      onError: (error) => {
        const msg = `导入失败: ${error.message}`
        importErrorText.value = msg
        $message(msg)
      }
    })
  } catch (error: any) {
    const msg = `导入失败: ${error.message}`
    importErrorText.value = msg
    $message(msg)
  } finally {
    isImporting.value = false
    resumeImportUpload()
    resetImportUploadState()
    window.setTimeout(() => {
      resetImportProgress()
    }, 300)
  }
}

async function handleUndoImport() {
  const snapshot = importSnapshotManifest.value
  if (!snapshot) {
    return
  }
  const map = mapWork.getMap()
  if (!map) {
    return
  }
  if (!window.confirm("确认撤销本次导入并回滚到导入前状态吗？")) {
    return
  }
  // 关闭导入成功提示条
  showImportToast.value = false
  let undoMode: "remote" | "local-only" = "remote"
  try {
    const datasetId = collection.value?.id || props.collectionId
    if (lastResultGroupId.value) {
      const undoResult = await undoImportSession(lastResultGroupId.value, { datasetId, clearArtifacts: true })
      undoMode = assertSuccessfulImportSessionResponse(undoResult).mode
    }
    await restoreWorkspace(map, snapshot, {
      strategy: "replace",
      conflictResolution: "replace",
      restoreView: true,
      restoreLayers: true,
      restoreDrawFeatures: true,
      flyDuration: 0.8,
      onComplete: () => {
        $message(undoMode === "local-only" ? "已在本地撤销导入（服务器未启用导入会话接口）" : "已撤销导入，恢复到导入前状态")
        recordDatasetEvent({
          datasetId,
          eventType: "undo_import",
          context: { groupId: lastResultGroupId.value, sourceType: lastImportSourceType.value, artifactCount: lastImportedArtifactIds.value.length }
        })
        importSnapshotManifest.value = null
        restoredManifest.value = null
        restoredItemName.value = ""
        lastResultGroupId.value = ""
        lastResultPrefix.value = ""
        lastImportedArtifactIds.value = []
        importedBbox.value = null
        importedLayerCount.value = 0
        importedGroupCount.value = 0
        // 通知图层目录刷新
        window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
      },
      onError: (error) => {
        $message(`撤销失败: ${error.message}`)
      }
    })
  } catch (e: any) {
    $message(`撤销失败: ${e.message}`)
  }
}

function handleImportToastClose() {
  showImportToast.value = false
}

function handleSelectItem(item: StacItem) {
  selectedItem.value = item
}

function handleLocateItem(item: StacItem) {
  // 先尝试飞到 item 的 bbox
  if (item.bbox && item.bbox.length >= 4) {
    mapWork.flyToBbox(item.bbox as [number, number, number, number])
    return
  }
  // 如果有已导入的图层，闪烁定位
  const datasetId = collection.value?.id || props.collectionId
  const map = mapWork.getMap()
  if (map) {
    const layers: any[] = map.getLayers({ basemaps: false }) || []
    const matchLayer = layers.find((l: any) => {
      const id = String(l?.id || "")
      return id.includes(datasetId) && id.includes(item.id)
    })
    if (matchLayer) {
      mapWork.flyToLayer(matchLayer.id)
      mapWork.flashLayer(matchLayer.id, { times: 3, intervalMs: 220 })
      return
    }
  }
  // 回退到数据集整体范围
  handleLocate()
}

function handleOpenAsset(asset: StacAsset) {
  if (asset.href) {
    window.open(resolveEoapiHref(asset.href), "_blank")
  }
}

async function handleDownloadZip() {
  if (!collection.value) {
    return
  }

  const revision = selectedItem.value || items.value[0]
  if (!revision) {
    $message("暂无可下载的版本")
    return
  }

  downloadingZip.value = true
  try {
    await downloadDatasetZip({
      dataset: collection.value,
      revision,
      filenamePrefix: collection.value.title || collection.value.id
    })
    $message("已开始下载")
  } catch (e: any) {
    $message(`下载失败: ${e?.message || "未知错误"}`)
  } finally {
    downloadingZip.value = false
  }
}

// ============ 成果回放功能 ============

/**
 * 回放选中的成果版本
 */
async function handleRestoreRevision(item: StacItem) {
  const map = mapWork.getMap()
  if (!map) {
    $message("地图未初始化")
    return
  }

  isRestoring.value = true

  try {
    // 尝试获取 manifest
    // 方式1：从 eoAPI 数据集版本 API 获取
    let manifest: Manifest | null = null

    // 检查 Item 是否有 manifest 资产
    const manifestAsset = item.assets?.manifest
    if (manifestAsset?.href) {
      try {
        const response = await fetch(manifestAsset.href)
        manifest = await response.json()
      } catch (e) {
        console.warn("[eoAPI] 无法获取 manifest:", e)
      }
    }

    // 方式2：尝试从 eoAPI API 获取
    if (!manifest) {
      const result = await getRevisionManifest(props.collectionId, item.id)
      if (result.success && result.data) {
        manifest = result.data
      }
    }

    if (!manifest) {
      $message("该版本没有可回放的成果数据")
      return
    }

    const openedAt = Date.now()
    const datasetId = props.collectionId
    const datasetName = collection.value?.title || collection.value?.id || props.collectionId
    const groupId = buildDatasetImportGroupId(datasetId, openedAt)
    const prefix = buildDatasetImportLayerPrefix(datasetId, openedAt)
    const sourceMeta: SourceRegistryMeta = {
      key: buildRevisionImportSourceKey(datasetId, item.id, "saved"),
      label: `历史回放/${item.properties.title || item.id}`,
      kind: "playback",
      groupId
    }
    ensureSourceLoad(sourceMeta, "block")
    const manifestWithRegistry = attachSourceRegistryToManifest(manifest, sourceMeta)
    ensureLayerLimit(countManifestLayers(manifestWithRegistry), "overlay", "历史回放")
    mapWork.ensureGroupLayer(groupId, `导入: ${datasetName}`)
    tagLayerSourceRegistry(mapWork.getLayerById(groupId), sourceMeta)
    lastResultGroupId.value = groupId
    lastResultPrefix.value = prefix

    // 预检查
    const precheck = precheckRestore(map, manifestWithRegistry)
    if (precheck.warnings.length > 0) {
      console.log("[eoAPI] 预检查警告:", precheck.warnings)
    }

    // 使用建议的策略或用户选择的策略
    const strategy = restoreStrategy.value || precheck.suggestedStrategy

    // 执行回放
    await restoreWorkspace(map, manifestWithRegistry, {
      strategy,
      conflictResolution: "rename",
      layerIdPrefix: prefix,
      layerNamePrefix: "",
      layerParentId: groupId,
      drawIdPrefix: prefix,
      restoreView: true,
      restoreLayers: true,
      restoreDrawFeatures: true,
      flyDuration: 1.5,
      onComplete: () => {
        // 记录回放状态
        restoredManifest.value = manifestWithRegistry
        restoredItemName.value = item.properties.title || item.id
        setCurrentDataset({
          datasetId: props.collectionId,
          name: collection.value?.title || collection.value?.id || props.collectionId,
          source: "repository"
        })
        $message(`已回放成果: ${restoredItemName.value}`)
      },
      onError: (error) => {
        $message(`回放失败: ${error.message}`)
      }
    })
  } catch (error: any) {
    $message(`回放失败: ${error.message}`)
  } finally {
    isRestoring.value = false
  }
}

/**
 * 清除已回放的内容
 */
function handleClearRestored() {
  const map = mapWork.getMap()
  if (map && restoredManifest.value) {
    const prefix = lastResultPrefix.value
    const groupId = lastResultGroupId.value
    if (prefix || groupId) {
      mapWork.removeLayersByIdPrefix(prefix, groupId ? [groupId] : undefined)
      if (groupId) {
        mapWork.removeLayersByPid(groupId)
        mapWork.removeLayer(groupId)
      }
      mapWork.removeGraphicsByIdPrefix(prefix)
    } else {
      clearRestoredContent(map, restoredManifest.value)
    }
    $message("已删除当前成果")
    restoredManifest.value = null
    restoredItemName.value = ""
    importSnapshotManifest.value = null
    lastResultGroupId.value = ""
    lastResultPrefix.value = ""
    importedBbox.value = null
    importedLayerCount.value = 0
    importedGroupCount.value = 0
    clearCurrentDataset(props.collectionId)
  }
}

/**
 * 切换回放策略
 */
function handleStrategyChange(strategy: RestoreStrategy) {
  restoreStrategy.value = strategy
}

/**
 * 导航到其他数据集（从血缘关系）
 */
function handleNavigateDataset(datasetId: string) {
  const targetId = String(datasetId || "").trim()
  if (!targetId || targetId === props.collectionId) {
    return
  }
  emit("navigate", targetId)
}

// 格式化函数
function formatDate(dateStr: string): string {
  if (!dateStr) { return "-" }
  try {
    return new Date(dateStr).toLocaleDateString("zh-CN")
  } catch {
    return dateStr
  }
}

function formatBbox(bbox: number[]): string {
  if (!bbox || bbox.length < 4) { return "-" }
  return `${bbox[0].toFixed(2)}°, ${bbox[1].toFixed(2)}° - ${bbox[2].toFixed(2)}°, ${bbox[3].toFixed(2)}°`
}

function formatTemporalExtent(interval: (string | null)[]): string {
  const start = interval[0] ? formatDate(interval[0]) : "未知"
  const end = interval[1] ? formatDate(interval[1]) : "现在"
  return `${start} 至 ${end}`
}

// 监听 props 变化
watch(() => props.collectionId, () => {
  loadCollectionDetail()
})

watch(
  () => [collection.value?.id || "", selectedItem.value?.id || "", items.value[0]?.id || ""],
  () => {
    loadPreviewLayers().catch(() => {})
  }
)

watch(
  () => showImportDialog.value,
  async (open) => {
    // #region debug-point current-task-import-visibility
    await nextTick()
    const modalNodes = [...document.querySelectorAll(".ant-modal, .mars-task-modal, .mars-dialog")]
      .map((node) => {
        const el = node as HTMLElement
        const text = (el.innerText || "").replace(/\s+/g, " ").trim()
        return {
          className: el.className,
          dataVisible: el.getAttribute("data-open"),
          ariaHidden: el.getAttribute("aria-hidden"),
          display: window.getComputedStyle(el).display,
          visibility: window.getComputedStyle(el).visibility,
          opacity: window.getComputedStyle(el).opacity,
          text: text.slice(0, 120)
        }
      })
      .slice(0, 8)
    dbg("info", "current-task-import.dialog", "showImportDialog(changed)", {
      flow: "current-task-import",
      open,
      collectionId: collection.value?.id || props.collectionId,
      selectedItemId: selectedItem.value?.id || null,
      modalNodes
    })
    // #endregion debug-point current-task-import-visibility
  }
)

// 初始化
onMounted(() => {
  ensureEoapiI18nConfig().then((cfg) => {
    i18nConfig.value = cfg
  }).catch(() => {})
  disposeMetadataRefresh = registerMetadataRefresher(props.collectionId, {
    loadCollectionDetail,
    loadArtifacts,
    loadItems
  })
  loadCollectionDetail()
  connectDatasetSync(props.collectionId)
  disposeDatasetSync = onDatasetSync((detail: DatasetSyncDetail) => {
    const dsId = String(props.collectionId || "")
    if (!dsId) {
      return
    }
    if (detail.datasetId && detail.datasetId !== dsId) {
      return
    }
    if (detail.reason === "artifact") {
      refreshMetadata({ datasetId: dsId, reason: "artifact" }).then(() => {
        syncHintMessage.value = "检测到附件更新，已自动刷新"
        syncHintVisible.value = true
      }).catch(() => {
        syncHintMessage.value = "附件刷新失败，可手动重试"
        syncHintVisible.value = true
      })
      return
    }
    if (["saved", "revision", "import", "refresh", "delete", "fork", "share"].includes(detail.reason)) {
      refreshMetadata({ datasetId: dsId, reason: detail.reason as any }).then(() => {
        syncHintMessage.value = "检测到数据集更新，已自动刷新"
        syncHintVisible.value = true
      }).catch(() => {
        syncHintMessage.value = "元数据刷新失败，可手动重试"
        syncHintVisible.value = true
      })
    }
  })
  disposeMetricWatch = onDatasetMetricsChange(() => {
    metricRefreshKey.value += 1
  })
})

onUnmounted(() => {
  disconnectDatasetSync(props.collectionId)
  disposeDatasetSync?.()
  disposeDatasetSync = null
  disposeMetadataRefresh?.()
  disposeMetadataRefresh = null
  resetArtifactWatchers([])
  disposeMetricWatch?.()
  disposeMetricWatch = null
})
</script>

<style scoped lang="less">
.dataset-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  line-height: 1.5;
}

.dataset-detail--inactive {
  pointer-events: none;
}

.dataset-detail--inactive :deep(.ksh002-layer-version-drawer) {
  pointer-events: auto;
}

// 固定工具栏
.detail-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--popup-surface, #fff);
  border-bottom: 1px solid var(--popup-border, #f0f0f0);
  margin: -12px -12px 12px -12px;
  backdrop-filter: blur(var(--popup-blur));
  -webkit-backdrop-filter: blur(var(--popup-blur));
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.detail-header {
  margin-bottom: 12px;
}

.restore-status-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: rgba(82, 196, 26, 0.15);
  border-radius: 6px;
  border: 1px solid rgba(82, 196, 26, 0.3);

  .restore-status-info {
    display: flex;
    align-items: center;
    gap: 8px;

    .restore-icon {
      font-size: 14px;
    }

    .restore-text {
      font-size: 13px;
      color: #52c41a;
    }
  }

  .restore-status-actions {
    display: flex;
    align-items: center;
  }
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;

  &.small {
    height: 100px;
  }
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 2px;
}

.back-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--mars-text-color);

  &:hover {
    color: var(--mars-primary-color, #2d8cf0);
  }
}

.info-section {
  background: var(--popup-surface);
  border: 1px solid var(--popup-border);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-1, 0 6px 18px rgb(0 0 0 / 18%));
  backdrop-filter: blur(var(--popup-blur));
  -webkit-backdrop-filter: blur(var(--popup-blur));

  /* 参照保存成果草稿提示条：深色可读，文字与按钮间无分割线 */
  .sync-hint-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 10%, var(--popup-surface, rgba(17 22 28 / 0.55)));
    border: 1px solid color-mix(in srgb, var(--color-primary, #41a8ff) 28%, transparent);
    border-radius: var(--popup-item-radius, 8px);
    box-sizing: border-box;
  }

  .sync-hint-banner__text {
    flex: 1;
    min-width: 0;
    color: var(--mars-text-color, var(--text-primary, #fff));
    font-size: 14px;
    line-height: 22px;
  }

  .sync-hint-banner__actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .sync-hint-btn {
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
  }

  .sync-hint-btn:hover {
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 22%, transparent);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 58%, transparent);
  }
}

.section-card {
  background: var(--popup-surface);
  border: 1px solid var(--popup-border);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-1, 0 6px 18px rgb(0 0 0 / 18%));
  backdrop-filter: blur(var(--popup-blur));
  -webkit-backdrop-filter: blur(var(--popup-blur));
}

.section-card--lineage {
  padding: 0;
  overflow: hidden;

  :deep(.lineage-panel) {
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 16px;
    box-shadow: none;
  }

  :deep(.lineage-header) {
    margin-bottom: 12px;
  }

  :deep(.lineage-title) {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    color: var(--mars-text-color);
  }
}

// 标题行（不再包含操作按钮）
.info-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 10px;
}

.info-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  color: var(--mars-text-color);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// info-actions 已移到工具栏

.detail-cover {
  position: relative;
  width: 100%;
  height: 180px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 10px;
}

.detail-cover .cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.detail-cover .cover-tip {
  position: absolute;
  right: 10px;
  top: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.88);
  background: rgba(0, 0, 0, 0.35);
}

.visibility-tag {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;

  :deep(.ant-tag) {
    margin-right: 0;
  }
}

.cover-preview {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border-radius: 16px;
  background:
    radial-gradient(circle at top, rgba(45, 140, 240, 0.12), transparent 55%),
    color-mix(in srgb, var(--popup-surface) 90%, transparent);
  border: 1px solid var(--popup-border);
}

.cover-preview img {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 12px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
}

.cover-preview-download-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.info-body {
  .info-row {
    display: flex;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .info-label {
    color: var(--mars-text-color-secondary, #62708a);
    width: 88px;
    flex-shrink: 0;
    font-size: 12px;
    line-height: 18px;
  }

  .info-value {
    color: var(--mars-text-color);
    flex: 1;
    line-height: 1.6;
    word-break: break-word;
  }

  .info-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;

    :deep(.ant-tag) {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.85);
    }
  }

  .info-summaries {
    flex: 1;

    .summary-item {
      display: block;
      font-size: 12px;
      color: var(--mars-text-color-secondary, #62708a);
      margin-bottom: 4px;

      strong {
        color: var(--mars-text-color);
      }
    }
  }
}

.items-section {
  margin-bottom: 16px;
}

.layers-section {
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;

  .restore-strategy-select {
    display: flex;
    align-items: center;
    gap: 6px;

    .strategy-label {
      font-size: 12px;
      color: var(--mars-extra-text-color);
    }
  }
}

.section-meta {
  font-size: 12px;
  color: var(--mars-text-color-secondary, #62708a);
}

.section-tip {
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--mars-text-color-secondary, #62708a);
}

.hidden-file-input {
  display: none;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: var(--mars-text-color);
}

.item-list {
  max-height: 320px;
  overflow-y: auto;
  display: grid;
  gap: 12px;
}

.item-card {
  padding: 12px;
  margin-bottom: 0;
  background: color-mix(in srgb, var(--popup-surface) 76%, transparent);
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid var(--surface-border);
  transition:
    border-color var(--transition-fast, 150ms ease),
    background var(--transition-fast, 150ms ease),
    transform var(--transition-fast, 150ms ease),
    box-shadow var(--transition-fast, 150ms ease);

  &:hover {
    background: color-mix(in srgb, var(--mars-hover-color) 8%, var(--popup-surface));
    border-color: color-mix(in srgb, var(--mars-hover-color) 28%, var(--surface-border));
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgb(15 23 42 / 10%);
  }

  &.active {
    background: color-mix(in srgb, var(--mars-hover-color) 12%, var(--popup-surface));
    border-color: color-mix(in srgb, var(--mars-hover-color) 38%, var(--surface-border));
    box-shadow: 0 0 0 3px rgba(45 140 240 / 0.12);
  }
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.item-title {
  font-size: 13px;
  color: var(--mars-text-color);
}

.item-time {
  font-size: 11px;
  color: var(--mars-text-color-secondary, #62708a);
}

.item-desc {
  font-size: 12px;
  color: var(--mars-text-color-secondary, #62708a);
  margin-bottom: 6px;
}

.item-assets {
  .assets-count {
    font-size: 11px;
    color: #40a9ff;
  }
}

.item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--surface-border);
}

.assets-section {
  margin-bottom: 16px;
}

.assets-list {
  max-height: 240px;
  overflow-y: auto;
}

.asset-item {
  padding: 12px;
  margin-bottom: 6px;
  background: color-mix(in srgb, var(--popup-surface) 76%, transparent);
  border-radius: 10px;
  border: 1px solid var(--surface-border);
}

.layer-item {
  padding-top: 10px;
  padding-bottom: 10px;
  margin-bottom: 0;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--surface-border);
  border-radius: 0;
}

.layers-section .assets-list .layer-item:last-child {
  border-bottom: 0;
}

.layer-item--group {
  cursor: pointer;
  user-select: none;

  .asset-name::before {
    content: "▾";
    display: inline-block;
    width: 14px;
    margin-right: 4px;
    color: var(--mars-text-color-secondary, #62708a);
  }

  &:hover {
    background: color-mix(in srgb, var(--mars-hover-color) 6%, transparent);
  }
}

.layer-item--collapsed {
  .asset-name::before {
    content: "▸";
  }
}

.asset-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.asset-name {
  font-size: 13px;
  color: var(--mars-text-color);
}

.asset-type {
  font-size: 11px;
  color: var(--mars-text-color-secondary, #62708a);
  font-family: monospace;
}

.asset-desc {
  font-size: 11px;
  color: var(--mars-text-color-secondary, #62708a);
  margin-bottom: 6px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 120px;
  border: 1px dashed var(--surface-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--popup-surface) 72%, transparent);
}

.error-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
</style>

<style lang="less">
/* 下拉挂到 body，需非 scoped；线性图标与站点 mars-icon 风格一致 */
.dataset-detail-more-dropdown {
  .dataset-detail-more-menu {
    .more-menu-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      line-height: 1;
    }

    .mars-icon {
      flex-shrink: 0;
      color: inherit;
      opacity: 0.88;
    }

    .ant-dropdown-menu-item-danger .mars-icon,
    .ant-dropdown-menu-item-danger .more-menu-item {
      color: inherit;
    }
  }
}
</style>
