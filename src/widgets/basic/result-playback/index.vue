<template>
  <mars-dialog
    title="成果回放"
    custom-class="result-playback-panel"
    :width="DIALOG_WIDTH"
    :height="DIALOG_HEIGHT"
    :min-width="DIALOG_MIN_WIDTH"
    :min-height="DIALOG_MIN_HEIGHT"
    :position="dialogPosition"
    :draggable="true"
    v-model:visible="dialogVisible"
    @closed="handleClose"
  >
    <div class="playback">
      <div class="playback-main">
        <div class="toolbar">
          <mars-button size="small" type="primary" @click="saveCurrent">保存当前快照</mars-button>
          <mars-button size="small" @click="refresh">刷新</mars-button>
          <mars-button size="small" danger :disabled="records.length === 0" @click="clearAll">清空</mars-button>
        </div>
        <div class="hint">保存时自动记录时间戳，回放时恢复图层与标记；列表顶部为最新快照</div>

        <div class="snapshot-section-title">当前快照</div>

        <a-empty v-if="records.length === 0" description="暂无回放记录" />
        <a-list v-else :data-source="pageRows" size="small" class="list">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta :title="item.displayTitle" :description="formatDesc(item.record)" />
              <template #actions>
                <a :href="getPlaybackUrl(item.record)" @click.prevent="play(item.record)">回放</a>
                <a @click.prevent="copy(item.record)">复制URL</a>
                <a @click.prevent="remove(item.record)">删除</a>
              </template>
            </a-list-item>
          </template>
        </a-list>
      </div>

      <div v-if="records.length > 0" class="playback-footer">
        <a-pagination
          size="small"
          :current="page"
          :page-size="PAGE_SIZE"
          :total="records.length"
          :show-size-changer="false"
          :show-total="showTotal"
          @change="onPageChange"
        />
      </div>
    </div>
  </mars-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { $message } from "@mars/components/mars-ui/index"
import { useWidget } from "@mars/common/store/widget"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import * as mapWork from "./map"
import * as datasetMapWork from "../dataset-repository/map"
import { buildScopedGroupId, buildScopedLayerPrefix } from "../dataset-repository/services/layer-id"
import { assertLayerCapacity, countManifestLayers } from "../dataset-repository/services/layer-constraints"
import { attachSourceRegistryToManifest, buildSourceRegistryKey, prepareSingleSourceLoad, tagLayerSourceRegistry, type SourceRegistryEntry } from "../dataset-repository/services/source-registry"
import { serializeWorkspace } from "../dataset-repository/workspace/serialize"
import { restoreWorkspace } from "../dataset-repository/workspace"
import type { Manifest } from "../dataset-repository/types/eoapi-types"

type PlaybackRecord = {
  id: string
  ts: number
  url: string
  title: string
  snapshot?: Manifest
}

type PlaybackPageRow = {
  id: string
  record: PlaybackRecord
  displayTitle: string
}

const STORAGE_KEY = "mars3d_result_playback_records_v1"
const MAX_RECORDS = 50
const PAGE_SIZE = 15

/** 弹窗初始尺寸 */
const DIALOG_WIDTH = 720
const DIALOG_HEIGHT = 520
/** 最小宽度：完整展示「保存当前快照」「刷新」「清空」三按钮 */
const DIALOG_MIN_WIDTH = 320
/** 最小高度：标题栏 + 工具栏 + 底部分页 */
const DIALOG_MIN_HEIGHT = 148

function getMapWrapperSize() {
  const el = document.getElementById("mars-main-view")
  return {
    width: el?.offsetWidth || window.innerWidth || 1200,
    height: el?.offsetHeight || window.innerHeight || 800
  }
}

function getCenteredPosition() {
  const { width: viewW, height: viewH } = getMapWrapperSize()
  return {
    left: Math.max(12, Math.round((viewW - DIALOG_WIDTH) / 2)),
    top: Math.max(12, Math.round((viewH - DIALOG_HEIGHT) / 2))
  }
}

const dialogPosition = ref(getCenteredPosition())

const { disable } = useWidget()
const dialogVisible = ref(true)

const records = ref<PlaybackRecord[]>([])
const page = ref(1)

const pageRows = computed<PlaybackPageRow[]>(() => {
  const total = records.value.length
  const start = (page.value - 1) * PAGE_SIZE
  return records.value.slice(start, start + PAGE_SIZE).map((record, index) => {
    const globalIndexFromNewest = start + index
    return {
      id: record.id,
      record,
      displayTitle: formatSnapshotTitle(record, globalIndexFromNewest, total)
    }
  })
})

watch(
  () => records.value.length,
  (total) => {
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1)
    if (page.value > maxPage) {
      page.value = maxPage
    }
  }
)

useLifecycle(mapWork)

function stripSnapshotNumberPrefix(title: string) {
  return String(title || "").replace(/^\s*\d+\.\s*/, "").trim()
}

function formatSnapshotTitle(item: PlaybackRecord, indexFromNewest: number, total: number) {
  const num = Math.max(1, total - indexFromNewest)
  const base = stripSnapshotNumberPrefix(item.title) || "未命名"
  return `${num}.${base}`
}

function onPageChange(nextPage: number) {
  page.value = Math.max(1, Number(nextPage) || 1)
}

function showTotal(total: number) {
  return `共 ${total} 条`
}

function readRecords(): PlaybackRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || ""
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .map((x: any) => ({
        id: String(x?.id || ""),
        ts: Number(x?.ts || 0),
        url: String(x?.url || ""),
        title: String(x?.title || ""),
        snapshot: x?.snapshot
      }))
      .filter((x: PlaybackRecord) => x.id && x.ts && x.url)
  } catch {
    return []
  }
}

function writeRecords(next: PlaybackRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
  }
}

function refresh() {
  records.value = readRecords().sort((a, b) => b.ts - a.ts).slice(0, MAX_RECORDS)
}

refresh()

function focusSourceEntry(entry?: SourceRegistryEntry | null) {
  const targetId = String(entry?.layerIds?.[0] || entry?.groupId || "").trim()
  if (targetId) {
    datasetMapWork.flyToLayer(targetId)
  }
}

function saveCurrent() {
  const map = mapWork.getMap()
  if (!map) {
    $message("地图未初始化")
    return
  }
  let snapshot: Manifest | undefined
  try {
    snapshot = serializeWorkspace(map, {
      includeViewState: true,
      includeLayers: true,
      includeDrawFeatures: true
    })
  } catch {
    snapshot = undefined
  }
  const next: PlaybackRecord = {
    id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    ts: Date.now(),
    url: window.location.href,
    title: stripSnapshotNumberPrefix(document.title || "") || "未命名",
    snapshot
  }
  const list = [next, ...readRecords()].slice(0, MAX_RECORDS)
  writeRecords(list)
  page.value = 1
  refresh()
  $message(snapshot ? "已保存回放记录（含标记）" : "已保存回放记录", "success")
}

async function play(item: PlaybackRecord) {
  const snapshot = item?.snapshot
  if (snapshot) {
    const map = mapWork.getMap()
    if (!map) {
      $message("地图未初始化")
      return
    }
    const openedAt = Date.now()
    const groupId = buildScopedGroupId("playback", "history", openedAt)
    const prefix = buildScopedLayerPrefix("playback", "history", openedAt)
    const sourceKey = buildSourceRegistryKey("playback", item.id)
    const prepared = prepareSingleSourceLoad(map, {
      key: sourceKey,
      label: `历史回放/${item.title || formatTime(item.ts)}`,
      kind: "playback",
      groupId
    }, "block")
    if (!prepared.ok) {
      focusSourceEntry(prepared.existing)
      $message("该历史回放已存在，已定位到当前图层")
      return
    }
    const snapshotWithRegistry = attachSourceRegistryToManifest(snapshot, {
      key: sourceKey,
      label: `历史回放/${item.title || formatTime(item.ts)}`,
      kind: "playback",
      groupId
    })
    const layerCount = countManifestLayers(snapshotWithRegistry)
    try {
      assertLayerCapacity(map, {
        incomingCount: layerCount,
        strategy: "overlay",
        actionLabel: "历史回放"
      })
      if (layerCount > 0) {
        datasetMapWork.ensureGroupLayer(groupId, `历史回放/${new Date(item.ts).toLocaleString()}`)
        tagLayerSourceRegistry(datasetMapWork.getLayerById(groupId), {
          key: sourceKey,
          label: `历史回放/${item.title || formatTime(item.ts)}`,
          kind: "playback",
          groupId
        })
      }
      await restoreWorkspace(map, snapshotWithRegistry, {
        strategy: "overlay",
        conflictResolution: "rename",
        layerIdPrefix: prefix,
        layerParentId: layerCount > 0 ? groupId : undefined,
        drawIdPrefix: prefix,
        restoreView: true,
        restoreLayers: layerCount > 0,
        restoreDrawFeatures: true,
        flyDuration: 1.2
      })
      if (layerCount > 0) {
        $message("已回放（含标记）", "success")
      } else {
        $message("该记录未包含图层，仅回放标记")
      }
      return
    } catch (e: any) {
      $message(`回放失败: ${e?.message || "未知错误"}`)
      return
    }
  }
  const url = getPlaybackUrl(item)
  if (!url) {
    return
  }
  const current = window.location.href
  if (normalizeUrl(current) === normalizeUrl(url)) {
    window.location.reload()
    return
  }
  window.location.assign(url)
}

function getPlaybackUrl(item: PlaybackRecord) {
  const raw = String(item?.url || "")
  if (!raw) {
    return ""
  }
  try {
    const u = new URL(raw, window.location.href)
    const base = String(import.meta.env.BASE_URL || "/")
    if (u.pathname.startsWith(base)) {
      return `${window.location.origin}${u.pathname}${u.search}${u.hash}`
    }
    return u.href
  } catch {
    return raw
  }
}

function normalizeUrl(url: string) {
  try {
    const u = new URL(url, window.location.href)
    u.hash = u.hash || ""
    return u.href.replace(/\/+$/, "")
  } catch {
    return String(url || "").replace(/\/+$/, "")
  }
}

async function copy(item: PlaybackRecord) {
  const url = getPlaybackUrl(item)
  if (!url) {
    return
  }
  try {
    await navigator.clipboard.writeText(url)
    $message("已复制", "success")
    return
  } catch {
  }
  try {
    const el = document.createElement("textarea")
    el.value = url
    el.style.position = "fixed"
    el.style.left = "-9999px"
    document.body.appendChild(el)
    el.select()
    document.execCommand("copy")
    document.body.removeChild(el)
    $message("已复制", "success")
  } catch {
    $message("复制失败")
  }
}

function remove(item: PlaybackRecord) {
  const id = String(item?.id || "")
  if (!id) {
    return
  }
  const next = readRecords().filter((x) => x.id !== id)
  writeRecords(next)
  refresh()
}

function clearAll() {
  writeRecords([])
  page.value = 1
  refresh()
  $message("已清空", "success")
}

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleString("zh-CN")
  } catch {
    return ""
  }
}

function formatDesc(item: PlaybackRecord) {
  const parts = [formatTime(item.ts), item.url]
  return parts.filter(Boolean).join(" · ")
}

function handleClose() {
  disable("result-playback")
}
</script>

<style scoped lang="less">
.playback {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.playback-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  flex-wrap: nowrap;
}

.hint {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--mars-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snapshot-section-title {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--mars-text-color, #fff);
  line-height: 20px;
}

.list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.list :deep(.ant-list-item-meta-title) {
  color: #ffffff !important;
}

.list :deep(.ant-list-item-meta-description) {
  color: #B8C2D1 !important;
}

.list :deep(.ant-list-item-action) > li {
  color: #B8C2D1 !important;
}

.playback-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--text-primary, #fff) 12%, transparent);
}

.playback-footer :deep(.ant-pagination) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  row-gap: 4px;
}
</style>

<style lang="less">
.result-playback-panel.mars-dialog {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;

  .mars-dialog__content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .ant-list-item-meta-title {
    color: #ffffff !important;
  }

  .ant-list-item-meta-description {
    color: #B8C2D1 !important;
  }

  .ant-list-item-action > li {
    color: #B8C2D1 !important;
  }
}
</style>
