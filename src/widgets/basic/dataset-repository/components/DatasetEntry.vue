<template>
  <div class="dataset-entry">
    <div class="filter-panel">
      <div class="quick-row">
        <span class="quick-label">快捷入口:</span>
        <a-button
          size="small"
          :type="quickTab === 'recent' ? 'primary' : 'default'"
          @click="toggleQuickTab('recent')"
        >
          最近使用
        </a-button>
        <a-button
          size="small"
          :type="quickTab === 'favorites' ? 'primary' : 'default'"
          @click="toggleQuickTab('favorites')"
        >
          我的收藏
        </a-button>
        <a-button size="small" type="link" :disabled="quickTab === 'all'" @click="resetQuickTab">
          全部
        </a-button>
      </div>

      <div class="filter-row search-row">
        <a-input
          v-model:value="searchKeyword"
          class="dataset-search-input"
          placeholder="搜索名称/描述"
          allow-clear
          @pressEnter="handleSearch"
        />
        <button
          type="button"
          class="filter-icon-btn search-icon-btn"
          title="搜索"
          aria-label="搜索"
          @click="handleSearch"
        >
          <mars-icon icon="search" :width="16" />
        </button>
      </div>

      <div class="filter-row split">
        <a-select
          v-model:value="selectedTags"
          mode="multiple"
          placeholder="标签筛选"
          :options="tagOptions"
          :max-tag-count="1"
          allow-clear
          class="tag-select"
        />
        <a-select v-model:value="sortKey" class="sort-select">
          <a-select-option value="heat">按热度</a-select-option>
          <a-select-option value="updatedAt">按更新时间</a-select-option>
          <a-select-option value="createdAt">按创建时间</a-select-option>
        </a-select>
        <button
          type="button"
          class="filter-icon-btn sort-order-btn"
          :title="sortOrder === 'desc' ? '当前倒序，点击切换为正序' : '当前正序，点击切换为倒序'"
          :aria-label="sortOrder === 'desc' ? '切换为正序' : '切换为倒序'"
          @click="toggleSortOrder"
        >
          <mars-icon :icon="sortOrder === 'desc' ? 'sort-amount-down' : 'sort-amount-up'" :width="16" />
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <a-spin tip="加载中..." />
    </div>

    <div v-else-if="pagedCollections.length === 0" class="empty-state">
      <a-empty :description="emptyText" />
    </div>

    <div v-else class="dataset-grid-wrap">
      <div class="dataset-grid">
        <div
          v-for="collection in pagedCollections"
          :key="collection.id"
          class="dataset-card"
          :class="{ 'is-compact': hideCoverLayout }"
          @click="handleSelectCollection(collection)"
        >
          <div
            v-if="!hideCoverLayout"
            class="card-cover"
            :class="{ local: isLocalDataset(collection) }"
            @click.stop="openCoverPreview(collection)"
          >
            <img
              v-if="getCoverUrl(collection)"
              class="cover-img"
              :src="getCoverUrl(collection)!"
              alt="cover"
              @load="handleCoverImgLoad(collection, $event)"
              @error="handleCoverImgError(collection)"
            />
            <div v-else class="cover-placeholder">
              <span class="placeholder-title">{{ getCollectionTitle(collection).slice(0, 10) }}</span>
            </div>

            <button
              class="fav-btn"
              :class="{ 'is-active': isFavorite(collection.id), 'is-bouncing': favoriteBounceId === collection.id }"
              type="button"
              @click.stop="toggleFavorite(collection)"
            >
              <span class="fav-icon">{{ isFavorite(collection.id) ? "★" : "☆" }}</span>
            </button>
          </div>

          <div class="card-body">
            <div class="card-title-row">
              <div class="card-title" :title="getCollectionTitle(collection)">
                <span v-html="highlightText(getCollectionTitle(collection), searchKeyword)"></span>
              </div>
              <button
                v-if="hideCoverLayout"
                class="fav-btn-inline"
                :class="{ 'is-active': isFavorite(collection.id), 'is-bouncing': favoriteBounceId === collection.id }"
                type="button"
                @click.stop="toggleFavorite(collection)"
                :title="isFavorite(collection.id) ? '取消收藏' : '收藏'"
              >
                <span class="fav-icon-inline">{{ isFavorite(collection.id) ? "★" : "☆" }}</span>
              </button>
            </div>

            <div class="card-info-row" :class="{ 'card-info-row--compact': hideCoverLayout }">
              <div class="card-info-main">
                <div class="card-desc">
                  <span v-html="highlightText(getCollectionDesc(collection), searchKeyword)"></span>
                </div>

                <div class="card-tags">
                  <a-tag v-if="isLocalDataset(collection)" color="orange" size="small">本地</a-tag>
                  <a-tag v-if="(collection.summaries as any)?.visibility" :color="getVisibilityColor((collection.summaries as any).visibility)" size="small">
                    {{ getVisibilityLabel((collection.summaries as any).visibility) }}
                  </a-tag>
                  <a-tag v-if="hasParent(collection)" color="gold" size="small">父⭐</a-tag>
                  <a-tag v-if="hasSource(collection)" color="yellow" size="small">来源</a-tag>
                  <a-tag v-for="tag in getCardTags(collection)" :key="`${collection.id}-${tag}`" size="small">
                    {{ tag }}
                  </a-tag>
                </div>
              </div>

              <div class="card-info-side">
                <div class="card-meta">
                  <span class="meta-item">{{ formatDate(getCreatedAt(collection)) }}</span>
                  <span class="meta-split">·</span>
                  <span class="meta-item">{{ getSourceText(collection) }}</span>
                </div>

                <div class="card-stats">
                  <span class="stat">浏览 {{ getMetric(collection.id).browseCount }}</span>
                  <span class="stat">导入 {{ getMetric(collection.id).importCount }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && pagedCollections.length > 0" class="pagination">
      <a-pagination
        v-model:current="page"
        :pageSize="pageSize"
        :total="filteredCollections.length"
        size="small"
        show-less-items
        :show-total="showTotal"
      />
    </div>

    <mars-task-modal
      v-model:open="coverPreviewVisible"
      title="封面预览"
      :footer="false"
      width="720"
      class="dataset-cover-preview-modal"
      @cancel="closeCoverPreview"
    >
      <template #headerRight>
        <button
          v-if="coverPreviewUrl"
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
        <img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="preview" />
        <a-empty v-else description="暂无封面" />
      </div>
    </mars-task-modal>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { $message } from "@mars/components/mars-ui/index"
import { getCollectionsAll, getLocalDataset, getLocalManifests, updateLocalDataset } from "../services/eoapi-datasets"
import { StacCollection, DatasetVisibility } from "../types/eoapi-types"
import { resolveEoapiHref } from "../services/eoapi-client"
import { ensureEoapiI18nConfig, pickCollectionText } from "../services/eoapi-i18n"
import {
  getDatasetMetric,
  getFavoriteDatasetIds,
  getRecentDatasetIds,
  onDatasetMetricsChange,
  recordDatasetBrowse,
  syncMetricsFromServer,
  toggleDatasetFavorite
} from "../services/dataset-metrics"
import { getOrCreateBboxCover, getPersistedDatasetCover, setPersistedDatasetCover } from "../services/cover-cache"
import { eoApiConfig } from "../services/eoapi-config"
import { onDatasetSync } from "../services/dataset-sync"
import { highlightText } from "../utils/highlight"
import { normalizeDatasetText } from "../utils/dataset-text"

const emit = defineEmits<{
  select: [collection: StacCollection]
  create: []
  "layout-change": [compact: boolean]
}>()

// 状态变量
const loading = ref(false)
const collections = ref<StacCollection[]>([])
const searchKeyword = ref("")
const selectedTags = ref<string[]>([])
const sortKey = ref<"heat" | "updatedAt" | "createdAt">("heat")
const sortOrder = ref<"desc" | "asc">("desc")
const quickTab = ref<"all" | "recent" | "favorites">("all")
const page = ref(1)
const pageSize = 20
const hideCoverLayout = ref(false)

const metricsRefreshKey = ref(0)
let disposeMetrics: null | (() => void) = null
let disposeDatasetSync: null | (() => void) = null
let isBackfillingCover = false
let autoSyncTimer: number | null = null
let reloadTimer: number | null = null
let hasLoadedCollectionsOnce = false
const COVER_BROKEN_TTL_MS = 5 * 60_000
const brokenCoverById = ref<Record<string, { at: number; url: string }>>({})
const fallbackCoverById = ref<Record<string, string>>({})
const i18nConfig = ref<any>(null)
const favoriteBounceId = ref("")
let favoriteBounceTimer: number | null = null

// #region debug-point heat-sort-report
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
  "heat-sort"

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

function fireAndForget(p: Promise<unknown>): void {
  p.catch(() => {})
}
// #endregion debug-point heat-sort-report

// #region debug-point dataset-cover-stac-load
const coverDebugOnceAtById = new Map<string, number>()

function reportCoverDebugOnce(datasetId: string, type: string, message: string, data?: Record<string, unknown>) {
  const id = String(datasetId || "").trim()
  if (!id) {
    return
  }
  const now = Date.now()
  const lastAt = coverDebugOnceAtById.get(id) || 0
  if (now - lastAt < 60_000) {
    return
  }
  coverDebugOnceAtById.set(id, now)
  fireAndForget(
    reportTraeDebugEvent({
      t: now,
      sessionId: TRAE_DEBUG_SESSION_ID,
      level: "info",
      type,
      message,
      data: { datasetId: id, ...(data || {}) }
    })
  )
}
// #endregion debug-point dataset-cover-stac-load

function scheduleReload(includeMetrics = false) {
  if (reloadTimer !== null) {
    window.clearTimeout(reloadTimer)
  }
  reloadTimer = window.setTimeout(async () => {
    reloadTimer = null
    if (includeMetrics) {
      await syncMetricsFromServer().catch(() => {})
      metricsRefreshKey.value += 1
    }
    await loadCollections()
  }, 180)
}

function getLocalDatasetBbox(datasetId: string): [number, number, number, number] | null {
  const local = getLocalDataset(datasetId) as any
  const bbox = local?.manifest?.viewState?.bbox
  if (Array.isArray(bbox) && bbox.length === 4 && bbox.every((n: any) => Number.isFinite(Number(n)))) {
    return [Number(bbox[0]), Number(bbox[1]), Number(bbox[2]), Number(bbox[3])]
  }
  return null
}

function buildLocalCollections(): StacCollection[] {
  const localDatasets = getLocalManifests()
  return localDatasets.map(d => ({
    id: d.datasetId,
    type: "Collection",
    title: normalizeDatasetText(d.name, d.datasetId),
    description: normalizeDatasetText(d.description, "本地保存的数据集"),
    keywords: ["本地"],
    license: "local",
    extent: {
      spatial: { bbox: [getLocalDatasetBbox(d.datasetId) || [0, 0, 0, 0]] },
      temporal: { interval: [[null, null]] }
    },
    links: [],
    summaries: {
      visibility: d.visibility || "private",
      source: "localStorage",
      createdAt: d.createdAt,
      coverUrl: d.coverUrl
    }
  }))
}

async function hydratePersistedCovers(limit = 60): Promise<void> {
  const n = Math.min(collections.value.length, Math.max(0, limit))
  for (let i = 0; i < n; i++) {
    const c = collections.value[i]
    if (!c || getCoverUrl(c)) {
      continue
    }
    const persisted = await getPersistedDatasetCover(c.id)
    if (!persisted) {
      continue
    }
    const summaries = { ...((c.summaries as any) || {}), coverUrl: persisted }
    const updated = { ...c, summaries }
    collections.value.splice(i, 1, updated)
    if (isLocalDataset(updated)) {
      persistLocalCover(updated.id, persisted)
    }
  }
}

// 加载数据集列表
async function loadCollections() {
  const cachedLocalCollections = buildLocalCollections()
  if (cachedLocalCollections.length > 0) {
    collections.value = cachedLocalCollections
    hasLoadedCollectionsOnce = true
    hydratePersistedCovers().catch(() => {})
    backfillMissingCovers().catch(() => {})
  }
  loading.value = !hasLoadedCollectionsOnce && collections.value.length === 0
  try {
    const result = await getCollectionsAll()

    // 获取本地数据集
    const localDatasets = getLocalManifests()
    const localCollections: StacCollection[] = localDatasets.map(d => ({
      id: d.datasetId,
      type: "Collection",
      title: normalizeDatasetText(d.name, d.datasetId),
      description: normalizeDatasetText(d.description, "本地保存的数据集"),
      keywords: ["本地"],
      license: "local",
      extent: {
        spatial: { bbox: [getLocalDatasetBbox(d.datasetId) || [0, 0, 0, 0]] },
        temporal: { interval: [[null, null]] }
      },
      links: [],
      summaries: {
        visibility: d.visibility || "private",
        source: "localStorage",
        createdAt: d.createdAt,
        coverUrl: d.coverUrl
      }
    }))

    if (result.success && result.data) {
      const all = [...result.data, ...localCollections]
      collections.value = all
      hydratePersistedCovers().catch(() => {})
      backfillMissingCovers().catch(() => {})
    } else {
      collections.value = localCollections
      hydratePersistedCovers().catch(() => {})
      backfillMissingCovers().catch(() => {})
      $message(result.message || "无法连接到 eoAPI 服务")
    }
  } catch (error: any) {
    console.error("[eoAPI] 加载数据集失败:", error)
    const localDatasets = getLocalManifests()
    const localCollections: StacCollection[] = localDatasets.map(d => ({
      id: d.datasetId,
      type: "Collection",
      title: normalizeDatasetText(d.name, d.datasetId),
      description: normalizeDatasetText(d.description, "本地保存的数据集"),
      keywords: ["本地"],
      license: "local",
      extent: {
        spatial: { bbox: [getLocalDatasetBbox(d.datasetId) || [0, 0, 0, 0]] },
        temporal: { interval: [[null, null]] }
      },
      links: [],
      summaries: {
        visibility: d.visibility || "private",
        source: "localStorage",
        createdAt: d.createdAt,
        coverUrl: d.coverUrl
      }
    }))
    collections.value = localCollections
    hydratePersistedCovers().catch(() => {})
    backfillMissingCovers().catch(() => {})
    $message("无法连接到 eoAPI 服务")
  } finally {
    loading.value = false
  }
}

function getCollectionTitle(collection: StacCollection): string {
  const t = pickCollectionText(collection.id, collection.title, collection.description, i18nConfig.value)
  return normalizeDatasetText(t.title, normalizeDatasetText(collection.title, collection.id)) || collection.id
}

function getCollectionDesc(collection: StacCollection): string {
  const t = pickCollectionText(collection.id, collection.title, collection.description, i18nConfig.value)
  return normalizeDatasetText(t.description, normalizeDatasetText(collection.description, "暂无描述")) || "暂无描述"
}

function getCollectionKeywords(collection: StacCollection): string[] {
  const mapped = (i18nConfig.value?.collections || {})[collection.id]?.keywords
  if (Array.isArray(mapped) && mapped.length > 0) {
    return mapped.map((x: any) => normalizeDatasetText(x)).filter(Boolean)
  }
  return Array.isArray(collection.keywords)
    ? collection.keywords.map((x: any) => normalizeDatasetText(x)).filter(Boolean)
    : []
}

function getCardTags(collection: StacCollection): string[] {
  const reserved = new Set(["本地", "private", "shared", "public"])
  return getCollectionKeywords(collection)
    .map((tag) => String(tag || "").trim())
    .filter((tag) => tag && !reserved.has(tag))
    .slice(0, 3)
}

async function backfillMissingCovers() {
  if (isBackfillingCover) {
    return
  }
  isBackfillingCover = true
  try {
    const limit = Math.min(collections.value.length, 30)
    for (let i = 0; i < limit; i++) {
      const c = collections.value[i]
      if (!c || getCoverUrl(c)) {
        continue
      }
      // A large uploaded cover is stored in IndexedDB while localStorage only
      // contains a marker. Re-check the persistent store before generating a
      // fallback so the fallback never overwrites a just-uploaded cover.
      const persisted = await getPersistedDatasetCover(c.id)
      if (persisted) {
        const summaries = { ...((c.summaries as any) || {}), coverUrl: persisted }
        collections.value.splice(i, 1, { ...c, summaries })
        continue
      }
      const bbox = c.extent?.spatial?.bbox?.[0]
      if (!bbox || bbox.length < 4) {
        continue
      }
      const dataUrl = await getOrCreateBboxCover({
        datasetId: c.id,
        title: c.title || c.id,
        bbox: [bbox[0], bbox[1], bbox[2], bbox[3]]
      })
      if (!dataUrl) {
        continue
      }
      const summaries = { ...((c.summaries as any) || {}), coverUrl: dataUrl }
      const updated = { ...c, summaries }
      collections.value.splice(i, 1, updated)
      setPersistedDatasetCover(c.id, dataUrl).catch(() => {})
      if (isLocalDataset(c)) {
        persistLocalCover(c.id, dataUrl)
      }
    }
  } finally {
    isBackfillingCover = false
  }
}

function persistLocalCover(datasetId: string, coverUrl: string) {
  setPersistedDatasetCover(datasetId, coverUrl).catch(() => {})
  updateLocalDataset(datasetId, { coverUrl, createNewVersion: false })
}

// 获取可见性标签颜色
function getVisibilityColor(visibility: DatasetVisibility): string {
  const colors: Record<DatasetVisibility, string> = {
    private: "default",
    shared: "blue",
    public: "green"
  }
  return colors[visibility] || "default"
}

// 获取可见性标签文本
function getVisibilityLabel(visibility: DatasetVisibility): string {
  const labels: Record<DatasetVisibility, string> = {
    private: "私有",
    shared: "共享",
    public: "公开"
  }
  return labels[visibility] || ""
}

// 检查是否为本地数据集
function isLocalDataset(collection: StacCollection): boolean {
  return collection.id.startsWith("local_")
}

function computePrimaryCoverUrl(collection: StacCollection): string | null {
  const links = collection.links || []
  const byRel = links.find((l: any) => l.rel === "preview" || l.rel === "thumbnail" || l.rel === "self-preview")
  if (byRel?.href) {
    return resolveEoapiHref(byRel.href)
  }
  const assets = (collection as any).assets || {}
  const asset = assets.thumbnail || assets.preview || assets.cover
  if (asset?.href) {
    return resolveEoapiHref(asset.href)
  }
  const summaries = (collection.summaries as any) || {}
  if (typeof summaries.coverUrl === "string" && summaries.coverUrl) {
    return resolveEoapiHref(summaries.coverUrl)
  }
  return null
}

function getCoverUrl(collection: StacCollection): string | null {
  const datasetId = collection.id
  const primary = computePrimaryCoverUrl(collection)
  const broken = brokenCoverById.value[datasetId]
  const fallback = fallbackCoverById.value[datasetId]
  const now = Date.now()

  if (broken && primary && broken.url === primary && now - broken.at < COVER_BROKEN_TTL_MS && fallback) {
    reportCoverDebugOnce(datasetId, "cover", "cover.pick(broken->fallback)", { primary, fallback })
    return fallback
  }
  if (primary) {
    reportCoverDebugOnce(datasetId, "cover", "cover.pick(primary)", { primary })
    return primary
  }
  if (fallback) {
    reportCoverDebugOnce(datasetId, "cover", "cover.pick(fallback)", { fallback })
    return fallback
  }
  reportCoverDebugOnce(datasetId, "cover", "cover.pick(null)")
  return null
}

async function handleCoverImgError(collection: StacCollection): Promise<void> {
  const primary = computePrimaryCoverUrl(collection) || ""
  const now = Date.now()
  brokenCoverById.value = { ...brokenCoverById.value, [collection.id]: { at: now, url: primary } }
  reportCoverDebugOnce(collection.id, "cover", "cover.img(error)", { primary })

  const bbox = collection.extent?.spatial?.bbox?.[0]
  if (!bbox || bbox.length < 4) {
    return
  }
  const dataUrl = await getOrCreateBboxCover({
    datasetId: collection.id,
    title: collection.title || collection.id,
    bbox: [bbox[0], bbox[1], bbox[2], bbox[3]]
  })
  if (!dataUrl) {
    return
  }
  fallbackCoverById.value = { ...fallbackCoverById.value, [collection.id]: dataUrl }
  setPersistedDatasetCover(collection.id, dataUrl).catch(() => {})
  if (isLocalDataset(collection)) {
    persistLocalCover(collection.id, dataUrl)
  }
}

async function handleCoverImgLoad(collection: StacCollection, e: Event): Promise<void> {
  const img = e.target as HTMLImageElement | null
  if (!img) {
    return
  }
  const w = Number(img.naturalWidth)
  const h = Number(img.naturalHeight)
  reportCoverDebugOnce(collection.id, "cover", "cover.img(load)", { naturalWidth: w, naturalHeight: h })
  if (w <= 4 || h <= 4) {
    await handleCoverImgError(collection)
    return
  }
  if (brokenCoverById.value[collection.id]) {
    const nextBroken = { ...brokenCoverById.value }
    delete nextBroken[collection.id]
    brokenCoverById.value = nextBroken
  }
  if (fallbackCoverById.value[collection.id]) {
    const nextFallback = { ...fallbackCoverById.value }
    delete nextFallback[collection.id]
    fallbackCoverById.value = nextFallback
  }
}

function getCreatedAt(collection: StacCollection): string | null {
  const summaries = (collection.summaries as any) || {}
  if (typeof summaries.createdAt === "number") {
    return new Date(summaries.createdAt).toISOString()
  }
  if (typeof summaries.createdAt === "string") {
    return summaries.createdAt
  }
  const interval = collection.extent?.temporal?.interval?.[0] || []
  const start = interval[0]
  if (start) {
    return start
  }
  return null
}

function getUpdatedAt(collection: StacCollection): number {
  const summaries = (collection.summaries as any) || {}
  if (typeof summaries.updatedAt === "number") {
    return summaries.updatedAt
  }
  if (typeof summaries.createdAt === "number") {
    return summaries.createdAt
  }
  return 0
}

function getSourceText(collection: StacCollection): string {
  const providers = collection.providers || []
  if (providers.length > 0 && providers[0]?.name) {
    return normalizeDatasetText(providers[0].name, "eoAPI") || "eoAPI"
  }
  const summaries = (collection.summaries as any) || {}
  const source = summaries.source
  if (typeof source === "string" && source) {
    return normalizeDatasetText(source, "eoAPI") || "eoAPI"
  }
  return isLocalDataset(collection) ? "local" : "eoAPI"
}

function hasParent(collection: StacCollection): boolean {
  const summaries = (collection.summaries as any) || {}
  if (typeof summaries.parentDatasetId === "string" && summaries.parentDatasetId) {
    return true
  }
  const local = getLocalDataset(collection.id)
  return !!local?.sourceDatasetId
}

function hasSource(collection: StacCollection): boolean {
  const summaries = (collection.summaries as any) || {}
  if (typeof summaries.sourceDatasetId === "string" && summaries.sourceDatasetId) {
    return true
  }
  const local = getLocalDataset(collection.id)
  return !!local?.sourceDatasetId
}

function isFavorite(datasetId: string) {
  const _ = metricsRefreshKey.value
  return getDatasetMetric(datasetId).favorite
}

function getMetric(datasetId: string) {
  const _ = metricsRefreshKey.value
  return getDatasetMetric(datasetId)
}

function toggleFavorite(collection: StacCollection) {
  const next = toggleDatasetFavorite(collection.id)
  if (favoriteBounceTimer) {
    window.clearTimeout(favoriteBounceTimer)
    favoriteBounceTimer = null
  }
  favoriteBounceId.value = next ? collection.id : ""
  if (next) {
    favoriteBounceTimer = window.setTimeout(() => {
      favoriteBounceId.value = ""
      favoriteBounceTimer = null
    }, 220)
  }
  $message(next ? "已收藏" : "已取消收藏")
}

function toggleQuickTab(tab: "recent" | "favorites") {
  quickTab.value = quickTab.value === tab ? "all" : tab
}

function resetQuickTab() {
  quickTab.value = "all"
}

const tagOptions = computed(() => {
  const set = new Set<string>()
  for (const c of collections.value) {
    const tags = getCollectionKeywords(c)
    for (const t of tags) {
      if (t) {
        set.add(t)
      }
    }
  }
  return Array.from(set)
    .slice(0, 50)
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
    .map((t) => ({ value: t, label: t }))
})

const filteredCollections = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const tagNeed = selectedTags.value
  const favorites = new Set(getFavoriteDatasetIds())
  const recent = new Set(getRecentDatasetIds(5))

  const list = collections.value.filter((c) => {
    if (quickTab.value === "favorites" && !favorites.has(c.id)) {
      return false
    }
    if (quickTab.value === "recent" && !recent.has(c.id)) {
      return false
    }
    if (keyword) {
      const t = getCollectionTitle(c).toLowerCase()
      const d = getCollectionDesc(c).toLowerCase()
      const ks = getCollectionKeywords(c).map((k) => k.toLowerCase())
      const hit = t.includes(keyword) || d.includes(keyword) || ks.some((k) => k.includes(keyword))
      if (!hit) {
        return false
      }
    }
    if (tagNeed.length > 0) {
      const ks = new Set(getCollectionKeywords(c))
      for (const need of tagNeed) {
        if (!ks.has(need)) {
          return false
        }
      }
    }
    return true
  })

  const withScore = list.map((c) => {
    const m = getDatasetMetric(c.id)
    const heat = m.browseCount + m.importCount + (m.favorite ? 20 : 0)
    const createdAt = Date.parse(getCreatedAt(c) || "") || 0
    const updatedAt = Math.max(getUpdatedAt(c), createdAt, m.lastUsedAt || 0)
    return { c, heat, createdAt, updatedAt }
  })

  const dir = sortOrder.value === "asc" ? 1 : -1
  withScore.sort((a, b) => {
    if (sortKey.value === "createdAt") {
      return (a.createdAt - b.createdAt) * dir
    }
    if (sortKey.value === "updatedAt") {
      return (a.updatedAt - b.updatedAt) * dir
    }
    return (a.heat - b.heat) * dir
  })

  return withScore.map((x) => x.c)
})

// #region debug-point heat-sort-snapshot
watch([filteredCollections, sortKey, quickTab, page, metricsRefreshKey], () => {
  if (sortKey.value !== "heat") {
    return
  }
  const top = filteredCollections.value.slice(0, 8).map((c, index) => {
    const m = getDatasetMetric(c.id)
    return {
      rank: index + 1,
      id: c.id,
      title: getCollectionTitle(c),
      browseCount: m.browseCount,
      importCount: m.importCount,
      favorite: m.favorite,
      favoriteCount: m.favoriteCount,
      lastUsedAt: m.lastUsedAt || null,
      heat: m.browseCount + m.importCount + (m.favorite ? 20 : 0)
    }
  })
  fireAndForget(
    reportTraeDebugEvent({
      t: Date.now(),
      sessionId: TRAE_DEBUG_SESSION_ID,
      level: "info",
      type: "dataset-entry.heat-sort.snapshot",
      message: "dataset repository heat sort snapshot",
      data: {
        sortKey: sortKey.value,
        quickTab: quickTab.value,
        page: page.value,
        total: filteredCollections.value.length,
        top
      }
    })
  )
}, { immediate: true })
// #endregion debug-point heat-sort-snapshot

const pagedCollections = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredCollections.value.slice(start, start + pageSize)
})

const emptyText = computed(() => {
  if (loading.value) {
    return ""
  }
  if (quickTab.value === "favorites") {
    return "暂无收藏数据集"
  }
  if (quickTab.value === "recent") {
    return "暂无最近使用记录"
  }
  return "暂无数据集"
})

watch([searchKeyword, selectedTags, sortKey, sortOrder, quickTab], () => {
  page.value = 1
})

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === "desc" ? "asc" : "desc"
}

function showTotal(total: number) {
  return `共 ${total} 条`
}

const coverPreviewVisible = ref(false)
const coverPreviewUrl = ref<string>("")

function openCoverPreview(collection: StacCollection) {
  coverPreviewUrl.value = getCoverUrl(collection) || ""
  coverPreviewVisible.value = true
}

function closeCoverPreview() {
  coverPreviewVisible.value = false
  coverPreviewUrl.value = ""
}

async function downloadPreviewCover() {
  const url = String(coverPreviewUrl.value || "").trim()
  if (!url) {
    return
  }
  const filename = `dataset-cover-${Date.now()}.png`
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

// 模拟数据（开发测试用）
function getMockCollections(): StacCollection[] {
  return [
    {
      id: "earthquake_lab_demo",
      type: "Collection",
      title: "地震科学实验场示范数据集",
      description: "包含遥感影像、矢量数据、分析报告的综合示范数据集",
      keywords: ["地震", "InSAR", "人口", "分析报告", "示范数据"],
      license: "CC-BY-4.0",
      extent: {
        spatial: { bbox: [[103.0, 35.0, 105.0, 37.0]] },
        temporal: { interval: [["2024-01-01T00:00:00Z", "2024-03-31T23:59:59Z"]] }
      },
      links: [],
      summaries: {
        region: ["demo_region"],
        platform: ["sentinel-1", "manual"],
        data_type: ["raster", "vector", "document"]
      }
    },
    {
      id: "MAXAR_afghanistan_earthquake22",
      type: "Collection",
      title: "Afghanistan Earthquake",
      description: "阿富汗地震高分卫星影像数据",
      keywords: ["地震", "高分卫星", "阿富汗"],
      license: "proprietary",
      extent: {
        spatial: { bbox: [[69.18, 25.87, 89.49, 33.33]] },
        temporal: { interval: [["2022-06-22T00:00:00Z", null]] }
      },
      links: []
    }
  ]
}

// 事件处理
function handleSearch() {
  page.value = 1
}

function handleSelectCollection(collection: StacCollection) {
  recordDatasetBrowse(collection.id)
  emit("select", collection)
}

function handleCreateDataset() {
  $message("新建数据集功能将在阶段三实现")
}

// 格式化日期
function formatDate(dateStr: string | null): string {
  if (!dateStr) { return "未知" }
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("zh-CN")
  } catch {
    return dateStr
  }
}

// 格式化边界框
function formatBbox(bbox: number[]): string {
  if (!bbox || bbox.length < 4) { return "" }
  return `${bbox[0].toFixed(1)}°,${bbox[1].toFixed(1)}° - ${bbox[2].toFixed(1)}°,${bbox[3].toFixed(1)}°`
}

// 初始化加载
function toggleLayout() {
  hideCoverLayout.value = !hideCoverLayout.value
  emit("layout-change", hideCoverLayout.value)
}

defineExpose({
  reload: () => loadCollections(),
  toggleLayout
})

onMounted(async () => {
  try {
    i18nConfig.value = await ensureEoapiI18nConfig()
  } catch {
    i18nConfig.value = null
  }
  loadCollections()
  disposeMetrics = onDatasetMetricsChange(() => {
    metricsRefreshKey.value += 1
  })
  disposeDatasetSync = onDatasetSync(() => {
    scheduleReload()
  })
  if (eoApiConfig.autoSync) {
    autoSyncTimer = window.setInterval(() => {
      syncMetricsFromServer()
        .then(() => {
          metricsRefreshKey.value += 1
        })
        .catch(() => {})
      scheduleReload()
    }, 15000)
  }
})

onUnmounted(() => {
  if (favoriteBounceTimer) {
    window.clearTimeout(favoriteBounceTimer)
    favoriteBounceTimer = null
  }
  disposeMetrics?.()
  disposeMetrics = null
  disposeDatasetSync?.()
  disposeDatasetSync = null
  if (autoSyncTimer !== null) {
    window.clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
  if (reloadTimer !== null) {
    window.clearTimeout(reloadTimer)
    reloadTimer = null
  }
})
</script>

<style scoped lang="less">
.dataset-entry {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px;
}

.filter-panel {
  margin-bottom: 10px;
}

.quick-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.quick-label {
  font-size: 12px;
  color: var(--mars-extra-text-color);
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 118px 32px;
  column-gap: 8px;
  align-items: center;
  width: 100%;
  margin-bottom: 8px;
}

/* 搜索框横跨标签+排序两列，右侧与「按更新时间」对齐；搜索图标与正序/倒序同列左对齐 */
.search-row .dataset-search-input {
  grid-column: 1 / 3;
  min-width: 0;
}

.search-row .search-icon-btn {
  grid-column: 3;
}

.tag-select {
  grid-column: 1;
  min-width: 0;
  width: 100%;
}

.sort-select {
  grid-column: 2;
  width: 118px;
}

.sort-order-btn {
  grid-column: 3;
}

.tag-select,
.sort-select {
  :deep(.ant-select-selector) {
    min-height: 32px;
    align-items: center;
    border-radius: var(--popup-radius, 8px) !important;
  }
}

/* 标签筛选：清除按钮 = 白底圆 + 亮蓝 X，去掉方框，尺寸贴近字号 */
.tag-select :deep(.ant-select-clear) {
  inset-inline-end: 11px;
  width: 14px;
  height: 14px;
  margin-top: -7px;
  border-radius: 50%;
  background: #ffffff !important;
  color: #5cadff !important;
  opacity: 1;
  box-shadow: none;
}

.tag-select :deep(.ant-select-clear .anticon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 10px;
  color: #5cadff !important;
}

.tag-select :deep(.ant-select-clear .anticon svg) {
  width: 10px;
  height: 10px;
  fill: currentColor;
}

.tag-select :deep(.ant-select-clear:hover) {
  background: #ffffff !important;
  color: #2d8cf0 !important;
}

.filter-icon-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--mars-control-text, var(--mars-text-color));
  cursor: pointer;
  transition:
    color var(--transition-fast, 150ms ease),
    transform var(--transition-fast, 150ms ease);
}

.filter-icon-btn:hover {
  background: transparent;
  color: var(--mars-hover-color, #5cadff);
}

.filter-icon-btn:active {
  color: var(--mars-hover-color, #5cadff);
  transform: scale(0.9);
}

.dataset-card.is-compact .card-body {
  padding-top: 12px;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.dataset-grid-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.dataset-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.dataset-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: rgba(65, 168, 255, 0.45);
    background: rgba(65, 168, 255, 0.06);
  }
}

.card-cover {
  position: relative;
  height: 120px;
  background: linear-gradient(135deg, rgba(65, 168, 255, 0.25), rgba(255, 255, 255, 0.04));

  &.local {
    background: linear-gradient(135deg, rgba(250, 173, 20, 0.25), rgba(255, 255, 255, 0.04));
  }
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.85);

  .placeholder-title {
    font-size: 14px;
    font-weight: 600;
    padding: 0 10px;
    text-align: center;
    line-height: 1.2;
  }
}

.fav-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  height: 64px;
  width: 64px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: #ffffff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-shadow: none;
  transition: color var(--transition-fast, 150ms ease), transform var(--transition-fast, 150ms ease);

  &:hover {
    background: transparent;
    color: #ffffff;
  }

  &.is-active {
    color: var(--mars-hover-color, #5cadff);
  }

  &.is-bouncing .fav-icon {
    animation: favorite-star-bounce 280ms ease-out;
  }
}

.fav-icon {
  font-size: 40px;
  line-height: 1;
  display: inline-block;
  text-shadow: 0 2px 8px rgba(23, 35, 61, 0.28);
}

@keyframes favorite-star-bounce {
  0% {
    transform: scale(1);
  }

  40% {
    transform: scale(1.6);
  }

  70% {
    transform: scale(0.9);
  }

  100% {
    transform: scale(1);
  }
}

.card-body {
  padding: 10px 10px 12px;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--mars-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.fav-btn-inline {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  box-shadow: none;
  line-height: 1;
  transition: color var(--transition-fast, 150ms ease), transform var(--transition-fast, 150ms ease);

  &:hover {
    background: transparent;
    color: #ffffff;
  }

  &.is-active {
    color: var(--mars-hover-color, #5cadff);
  }

  &.is-bouncing .fav-icon-inline {
    animation: favorite-star-bounce-inline 280ms ease-out;
  }
}

.fav-icon-inline {
  font-size: 14px;
  display: inline-block;
  text-shadow: 0 1px 4px rgba(23, 35, 61, 0.2);
}

@keyframes favorite-star-bounce-inline {
  0% {
    transform: scale(1);
  }

  40% {
    transform: scale(1.6);
  }

  70% {
    transform: scale(0.9);
  }

  100% {
    transform: scale(1);
  }
}

.card-desc {
  margin-top: 6px;
  font-size: 12px;
  color: var(--mars-extra-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-info-row:not(.card-info-row--compact) {
  display: flex;
  flex-direction: column;
}

.card-info-row:not(.card-info-row--compact) .card-info-main,
.card-info-row:not(.card-info-row--compact) .card-info-side {
  display: contents;
}

.card-info-row--compact {
  margin-top: 6px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 16px;
  align-items: start;
}

.card-info-row--compact .card-info-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.card-info-row--compact .card-info-side {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
  text-align: right;
  flex-shrink: 0;
}

.card-info-row--compact .card-desc {
  margin-top: 0;
}

.card-tags {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;

  :deep(.ant-tag) {
    margin-right: 0;
  }
}

.card-info-row--compact .card-tags {
  margin-top: 0;
}

.card-meta {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--mars-extra-text-color);
}

.card-info-row--compact .card-meta {
  margin-top: 0;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.card-stats {
  margin-top: 8px;
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--mars-extra-text-color);
}

.card-info-row--compact .card-stats {
  margin-top: 0;
  justify-content: flex-end;
}

.meta-split {
  opacity: 0.6;
}

.pagination {
  flex-shrink: 0;
  padding: 8px 0 4px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: 6px;
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

  img {
    max-width: 100%;
    max-height: 520px;
    border-radius: 12px;
    box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
  }
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

.dataset-search-input {
  width: 100%;

  :deep(.ant-input-affix-wrapper),
  &:deep(.ant-input) {
    height: 32px;
    border-radius: var(--popup-radius, 8px) !important;
  }
}

/* 搜索高亮样式 */
:deep(.search-highlight) {
  background-color: #fff566;
  padding: 2px 4px;
  border-radius: 2px;
  font-weight: 500;
  color: #000;
}

/* 暗色模式适配 */
:global(.dark) :deep(.search-highlight) {
  background-color: #d4a017;
  color: #000;
}

/* 无障碍优化 - 高对比度模式 */
@media (prefers-contrast: high) {
  :deep(.search-highlight) {
    background-color: #ffeb3b;
    border: 1px solid #000;
  }
}
</style>
