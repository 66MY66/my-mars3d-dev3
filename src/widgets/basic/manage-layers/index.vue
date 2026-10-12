<template>
  <mars-dialog
    ref="layerDialogRef"
    v-bind="$attrs"
    :position="dialogPosition"
    title="图层"
    icon="layers"
    custom-class="manage-layer_pannel"
    :draggable="false"
    :handles="LAYER_DIALOG_HANDLES"
    width="300"
    :min-width="LAYER_DIALOG_MIN_WIDTH"
    @closed="handleDialogClosed"
  >
    <template #headerRight>
      <button type="button" class="mars-popup-header-btn layer-header-refresh" aria-label="刷新图层" title="刷新图层" @click="handleRefreshTree">
        <mars-icon icon="refresh" :width="18" />
      </button>
    </template>
    <div class="layer-panel-body">
      <div class="layer-panel-fixed">
        <div class="layer-toolbar">
          <mars-input v-model:value="keyword" placeholder="搜索图层" :allowClear="true" class="search-input" />
          <a-dropdown v-if="importedGroups.length > 0" :trigger="['click']">
            <a-button size="small" danger class="clear-import-btn">
              清除导入内容
            </a-button>
            <template #overlay>
              <a-menu @click="handleClearImport">
                <a-menu-item v-for="g in importedGroups" :key="g.id">
                  {{ g.name }}
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
        <div class="layer-limit-tip">业务图层 {{ currentLayerCount }}/{{ MAX_LAYERS }}</div>
      </div>
      <div class="layer-panel-scroll">
        <mars-tree
          block-node
          class="layer-tree"
          checkable
          :show-line="{ showLeafIcon: false }"
          :tree-data="treeData"
          v-model:expandedKeys="expandedKeys"
          v-model:checkedKeys="checkedKeys"
          v-model:selectedKeys="selectedKeys"
          @check="checkedChange"
        >
          <template #title="node">
            <div
              class="layer-node-cell"
              :class="{ 'has-opacity-slider': node.hasOpacity && node.checked }"
              :data-layer-key="normalizeKey(node.key)"
              @pointerdown="onLayerNodePointerDown($event, node)"
            >
              <div class="layer-node-main">
                <mars-dropdown-menu :trigger="['contextmenu']">
                  <span
                    class="layer-node-title"
                    :class="{ 'is-drag-armed': layerDragSourceKey === normalizeKey(node.key) }"
                    @dblclick="flyTo(node)"
                  >
                    <span>{{ node.title }}</span>
                    <span v-if="isNodeLocked(node)" class="layer-node-lock" :title="getNodeLockReason(node)">已锁定</span>
                  </span>
                  <template #overlay v-if="!node.disabled">
                    <a-menu @click="(menu) => onContextMenuClick(node, menu.key)">
                      <a-menu-item v-if="node.hasZIndex && !isNodeLocked(node)" key="1">图层置为顶层</a-menu-item>
                      <a-menu-item v-if="node.hasZIndex && !isNodeLocked(node)" key="2">图层上移一层</a-menu-item>
                      <a-menu-item v-if="node.hasZIndex && !isNodeLocked(node)" key="3">图层下移一层</a-menu-item>
                      <a-menu-item v-if="node.hasZIndex && !isNodeLocked(node)" key="4">图层置为底层</a-menu-item>
                      <a-menu-divider v-if="node.hasZIndex && !isNodeLocked(node)" />
                      <a-menu-item key="5">查看属性</a-menu-item>
                      <a-menu-divider v-if="showResultActions(node)" />
                      <a-menu-item v-if="canHideGroup(node)" key="hideGroup">隐藏分组</a-menu-item>
                      <a-menu-item v-if="canShowGroup(node)" key="showGroup">显示分组</a-menu-item>
                      <a-menu-item v-if="canRename(node)" key="rename">重命名</a-menu-item>
                      <a-menu-item v-if="canMove(node)" key="move">移动</a-menu-item>
                      <a-menu-item v-if="canDelete(node)" key="delete">删除</a-menu-item>
                    </a-menu>
                  </template>
                </mars-dropdown-menu>
              </div>
              <div v-if="node.hasOpacity && node.checked" class="tree-slider-row" @pointerdown.stop>
                <mars-slider
                  v-model:value="opacityValue[node.key]"
                  :min="0"
                  :step="0.1"
                  :max="1"
                  @change="(value) => opcityChange(node, value)"
                />
              </div>
            </div>
          </template>
        </mars-tree>
      </div>
    </div>
    <template #footer>
      <div class="tips">提示：双击可定位视域至其所在位置；长按图层名称可拖动排序</div>
    </template>
  </mars-dialog>
  <mars-dialog
    v-model:visible="showLayerProps"
    title="图层属性详情"
    width="300"
    :position="{ top: 100, right: 350 }"
  >
    <div v-if="inspectedLayerId" class="layer-style-editor">
      <div class="prop-divider">样式调节</div>

      <div v-if="rasterStyleAvailable" class="style-section">
        <div class="style-row">
          <span class="style-label">亮度</span>
          <mars-slider v-model:value="rasterStyleEditor.brightness" :min="0" :max="2" :step="0.01" />
        </div>
        <div class="style-row">
          <span class="style-label">对比度</span>
          <mars-slider v-model:value="rasterStyleEditor.contrast" :min="0" :max="3" :step="0.01" />
        </div>
        <div class="style-row">
          <span class="style-label">Gamma</span>
          <mars-slider v-model:value="rasterStyleEditor.gamma" :min="0.1" :max="3" :step="0.01" />
        </div>
        <div class="style-row">
          <span class="style-label">饱和度</span>
          <mars-slider v-model:value="rasterStyleEditor.saturation" :min="0" :max="3" :step="0.01" />
        </div>
        <div class="style-row">
          <span class="style-label">色相</span>
          <mars-slider v-model:value="rasterStyleEditor.hue" :min="-1" :max="1" :step="0.01" />
        </div>
      </div>

      <div v-if="vectorStyleAvailable" class="style-section">
        <div class="style-row">
          <span class="style-label">填充色</span>
          <mars-color-picker v-model:value="vectorStyleEditor.fillColor" />
        </div>
        <div class="style-row">
          <span class="style-label">填充透明度</span>
          <mars-slider v-model:value="vectorStyleEditor.fillOpacity" :min="0" :max="1" :step="0.01" />
        </div>
        <div class="style-row">
          <span class="style-label">描边色</span>
          <mars-color-picker v-model:value="vectorStyleEditor.outlineColor" />
        </div>
        <div class="style-row">
          <span class="style-label">描边宽度</span>
          <mars-slider v-model:value="vectorStyleEditor.outlineWidth" :min="0" :max="10" :step="0.5" />
        </div>
      </div>

      <div class="style-actions">
        <a-button size="small" @click="resetLayerStyle">恢复默认</a-button>
      </div>
    </div>

    <div class="layer-props-table">
      <div v-for="field in metaFields" :key="field.key" class="prop-row">
        <span class="prop-label">{{ field.label }}：</span>
        <span class="prop-value">{{ currentLayerProps[field.key] || '--' }}</span>
      </div>
      <!-- 额外显示未定义的属性 -->
      <div class="prop-divider">其他参数</div>
      <div class="raw-json">
        {{ JSON.stringify(currentLayerProps, null, 2) }}
      </div>
    </div>
  </mars-dialog>
  <mars-task-modal v-model:open="renameDialogOpen" title="重命名" @ok="confirmRename" @cancel="cancelRename">
    <a-input v-model:value="renameName" placeholder="请输入名称" />
  </mars-task-modal>
  <mars-task-modal v-model:open="moveDialogOpen" title="移动" @ok="confirmMove" @cancel="cancelMove">
    <a-form layout="vertical">
      <a-form-item label="目标分组">
        <a-select v-model:value="moveTargetPid" :options="moveTargetOptions" placeholder="请选择目标分组" />
      </a-form-item>
    </a-form>
  </mars-task-modal>
  <mars-task-modal v-model:open="deleteDialogOpen" title="删除" ok-type="danger" @ok="confirmDelete" @cancel="cancelDelete">
    <div>确认删除“{{ deleteTargetTitle }}”？</div>
  </mars-task-modal>
</template>

<script lang="ts" setup>
import { computed, nextTick, onUnmounted, ref, onMounted, watch, useAttrs } from "vue"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import * as mapWork from "./map"
import { useWidget } from "@mars/common/store/widget"
import { logInfo } from "@mars/utils/mars-util"
import { $message } from "@mars/components/mars-ui/index"
import { POPUP_PANEL_RESIZE_HANDLES } from "@mars/common/constants/popup-resize-handles"
import { getCurrentDataset, onCurrentDatasetChange } from "@/shell/currentDataset"
import { isSuperAdmin } from "@/shell/permission"
import { getDirectoryLocks, type DirectoryLockRecord } from "../dataset-repository/services/eoapi-directory-locks"
import { onDatasetSync } from "../dataset-repository/services/dataset-sync"
import { MAX_LAYERS } from "../dataset-repository/services/layer-constraints"
import { applyDefaultRasterStyleOptions, isImageryRasterSourceType } from "../dataset-repository/services/layer-style-defaults"
import { removePersistedSession } from "../current-task/map"

const { activate, disable, updateWidget, currentWidget } = useWidget()
useLifecycle(mapWork)
const attrs = useAttrs()

const LAYER_DIALOG_MIN_WIDTH = 300
const LAYER_DIALOG_HANDLES = [...POPUP_PANEL_RESIZE_HANDLES]
const LAYER_PERSIST_KEY = "mars_dialog_persist_v1_manage-layer_pannel"

const layerDialogRef = ref<{ resetLayoutToDefault?:(skipAnimation?: boolean) => void } | null>(null)

const dialogPosition = computed(() => {
  const p = (attrs as any)?.position
  if (p && typeof p === "object") {
    return p
  }
  return { top: 0, left: 0, bottom: 0 }
})

function handleRefreshTree() {
  layerDialogRef.value?.resetLayoutToDefault?.()
  clearSiblingOrderState()
  restoreBaselineLayerOrder()
  initTree()
  $message("图层顺序已恢复")
}

/** 从数据集仓库详情「打开图层管理」进入时，关闭后回到对应详情页 */
function handleDialogClosed() {
  const returnTo = String(currentWidget?.data?.returnTo || "").trim()
  if (returnTo !== "dataset-repository") {
    return
  }
  const returnCollectionId = String(currentWidget?.data?.returnCollectionId || "").trim()
  nextTick(() => {
    activate({
      name: "dataset-repository",
      data: returnCollectionId
        ? {
            props: {
              restoreCollectionId: returnCollectionId
            }
          }
        : undefined
    })
  })
}

type SiblingOrderState = Record<string, string[]>

const LAYER_DRAG_LONG_PRESS_MS = 420
const LAYER_DRAG_MOVE_THRESHOLD = 6
const VIRTUAL_ROOT_IDS = new Set(["__import_root__", "__result_root__", "__system_root__"])

let baselineLayerZIndex: Record<string, number> | null = null
const layerDragSourceKey = ref<string | null>(null)
const layerDropTargetKey = ref<string | null>(null)
const layerDropBefore = ref(true)

type LayerDragSession = {
  node: any
  pointerId: number
  startY: number
  armed: boolean
  timer: number | null
}

let layerDragSession: LayerDragSession | null = null

function captureBaselineLayerOrder() {
  baselineLayerZIndex = mapWork.snapshotLayerZIndex()
}

function restoreBaselineLayerOrder() {
  if (!baselineLayerZIndex) {
    return
  }
  mapWork.restoreLayerZIndex(baselineLayerZIndex)
}

function readSiblingOrderState(): SiblingOrderState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SIBLING_ORDER)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as SiblingOrderState) : {}
  } catch {
    return {}
  }
}

function writeSiblingOrderState(state: SiblingOrderState) {
  try {
    localStorage.setItem(STORAGE_KEY_SIBLING_ORDER, JSON.stringify(state))
  } catch {
  }
}

function clearSiblingOrderState() {
  try {
    localStorage.removeItem(STORAGE_KEY_SIBLING_ORDER)
  } catch {
  }
}

function reorderSiblingKeys(keys: string[], dragKey: string, dropKey: string, insertBefore: boolean): string[] {
  const next = keys.slice()
  const from = next.indexOf(dragKey)
  if (from === -1) {
    return keys
  }
  next.splice(from, 1)
  const base = next.indexOf(dropKey)
  if (base === -1) {
    return keys
  }
  const insertAt = insertBefore ? base : base + 1
  next.splice(insertAt, 0, dragKey)
  return next
}

function sortChildrenBySiblingOrder(parent: any, orderMap: SiblingOrderState) {
  const children = Array.isArray(parent.children) ? parent.children : []
  if (!children.length) {
    return
  }
  const parentKey = normalizeKey(parent.key ?? parent.id)
  const desired = orderMap[parentKey]
  if (!Array.isArray(desired) || desired.length === 0) {
    return
  }

  const rank = new Map<string, number>()
  desired.forEach((id, index) => rank.set(normalizeKey(id), index))
  children.sort((a: any, b: any) => {
    const ai = rank.has(normalizeKey(a.key)) ? (rank.get(normalizeKey(a.key)) as number) : Number.MAX_SAFE_INTEGER
    const bi = rank.has(normalizeKey(b.key)) ? (rank.get(normalizeKey(b.key)) as number) : Number.MAX_SAFE_INTEGER
    if (ai !== bi) {
      return ai - bi
    }
    return (a._index ?? 0) - (b._index ?? 0)
  })
  children.forEach((child, index) => {
    child._index = index
  })
  parent.children = children
}

function applySiblingOrderStateToTree(nodes: any[], orderMap?: SiblingOrderState) {
  const state = orderMap ?? readSiblingOrderState()
  const walk = (list: any[]) => {
    list.forEach((node) => {
      const children = Array.isArray(node.children) ? node.children : []
      if (children.length) {
        walk(children)
        sortChildrenBySiblingOrder(node, state)
      }
    })
  }
  walk(Array.isArray(nodes) ? nodes : [])
}

function isVirtualRootId(id: string) {
  return VIRTUAL_ROOT_IDS.has(id)
}

function canDragLayerNode(node: any) {
  if (!node || normalizeText(keyword.value)) {
    return false
  }
  const id = normalizeKey(node.key ?? node.id)
  if (!id || isVirtualRootId(id)) {
    return false
  }
  if (node.disabled || node.isBasemap) {
    return false
  }
  if (isNodeLocked(node)) {
    return false
  }
  return true
}

function findTreeNodeByKey(nodes: any[], key: string): any | null {
  const target = normalizeKey(key)
  for (const node of nodes) {
    if (normalizeKey(node.key) === target) {
      return node
    }
    const children = Array.isArray(node.children) ? node.children : []
    const found = findTreeNodeByKey(children, target)
    if (found) {
      return found
    }
  }
  return null
}

function getTreeNodeKeyFromElement(el: Element | null): string | null {
  const host = el?.closest("[data-layer-key]")
  if (host) {
    const key = host.getAttribute("data-layer-key")
    return key ? normalizeKey(key) : null
  }
  return null
}

function findParentNodeInTree(nodes: any[], childKey: string, parent: any = null): any | null {
  const target = normalizeKey(childKey)
  for (const node of nodes) {
    if (normalizeKey(node.key) === target) {
      return parent
    }
    const children = Array.isArray(node.children) ? node.children : []
    const found = findParentNodeInTree(children, target, node)
    if (found) {
      return found
    }
  }
  return null
}

function clearLayerDropIndicators() {
  document.querySelectorAll(".layer-tree .ant-tree-treenode").forEach((el) => {
    el.classList.remove("layer-drop-before", "layer-drop-after", "layer-drag-armed")
  })
}

function cleanupLayerDragSession() {
  if (layerDragSession?.timer) {
    window.clearTimeout(layerDragSession.timer)
  }
  layerDragSession = null
  layerDragSourceKey.value = null
  layerDropTargetKey.value = null
  clearLayerDropIndicators()
}

function getReorderContext(node: any): { parent: any; siblings: any[]; index: number } | null {
  let parent = typeof node?._getParent === "function" ? node._getParent() : null
  if (!parent?.children) {
    parent = findParentNodeInTree(fullTree.value, normalizeKey(node.key))
  }
  if (!parent?.children) {
    return null
  }
  const siblings = [...parent.children].sort((a: any, b: any) => (a._index ?? 0) - (b._index ?? 0))
  const index = siblings.findIndex((item) => normalizeKey(item.key) === normalizeKey(node.key))
  if (index < 0) {
    return null
  }
  return { parent, siblings, index }
}

function exchangeLayerOrder(a: any, b: any) {
  if (!a?.id || !b?.id) {
    return false
  }
  if (a.hasZIndex || b.hasZIndex) {
    return mapWork.exchangeLayer(a.id, b.id)
  }
  const layerA: any = mapWork.getLayerById(a.id)
  const layerB: any = mapWork.getLayerById(b.id)
  if (layerA && layerB && typeof layerA.zIndex === "number" && typeof layerB.zIndex === "number") {
    return mapWork.exchangeLayer(a.id, b.id)
  }
  return true
}

function reorderLayerNodes(dragNode: any, dropNode: any, insertBefore: boolean) {
  const dragCtx = getReorderContext(dragNode)
  const dropCtx = getReorderContext(dropNode)
  if (!dragCtx || !dropCtx) {
    return false
  }
  if (normalizeKey(dragCtx.parent.key) !== normalizeKey(dropCtx.parent.key)) {
    return false
  }

  let targetIndex = dropCtx.index
  if (!insertBefore) {
    targetIndex += 1
  }
  if (targetIndex > dragCtx.index) {
    targetIndex -= 1
  }

  let currentIndex = dragCtx.index
  const siblings = dragCtx.siblings
  while (currentIndex < targetIndex) {
    if (!exchangeLayerOrder(siblings[currentIndex], siblings[currentIndex + 1])) {
      return false
    }
    currentIndex += 1
  }
  while (currentIndex > targetIndex) {
    if (!exchangeLayerOrder(siblings[currentIndex], siblings[currentIndex - 1])) {
      return false
    }
    currentIndex -= 1
  }

  const parentKey = normalizeKey(dragCtx.parent.key ?? dragCtx.parent.id)
  const siblingKeys = siblings.map((item) => normalizeKey(item.key))
  const nextKeys = reorderSiblingKeys(
    siblingKeys,
    normalizeKey(dragNode.key),
    normalizeKey(dropNode.key),
    insertBefore
  )
  const orderState = readSiblingOrderState()
  orderState[parentKey] = nextKeys
  writeSiblingOrderState(orderState)

  const parent = dragCtx.parent
  const children = [...parent.children]
  const rank = new Map<string, number>()
  nextKeys.forEach((id, idx) => rank.set(id, idx))
  children.sort((a: any, b: any) => {
    const ai = rank.get(normalizeKey(a.key)) ?? Number.MAX_SAFE_INTEGER
    const bi = rank.get(normalizeKey(b.key)) ?? Number.MAX_SAFE_INTEGER
    return ai - bi
  })
  children.forEach((child, idx) => {
    child._index = idx
  })
  parent.children = children
  return true
}

function refreshTreeAfterReorder() {
  const openIds = [...expandedKeys.value]
  initTree()
  expandedKeys.value = openIds
}

function updateLayerDropIndicator(clientY: number, dropKey: string | null) {
  clearLayerDropIndicators()
  if (!dropKey || !layerDragSourceKey.value || dropKey === layerDragSourceKey.value) {
    return
  }
  const dropEl = document.querySelector(`.layer-tree [data-layer-key="${dropKey}"]`)?.closest(".ant-tree-treenode")
  if (!dropEl) {
    return
  }
  const rect = dropEl.getBoundingClientRect()
  const before = clientY < rect.top + rect.height / 2
  layerDropBefore.value = before
  dropEl.classList.add(before ? "layer-drop-before" : "layer-drop-after")
}

function onLayerNodePointerDown(e: PointerEvent, node: any) {
  if (e.button !== 0) {
    return
  }
  const target = e.target as HTMLElement
  if (target.closest(".tree-slider-row, .ant-tree-checkbox, .ant-tree-switcher, .ant-slider")) {
    return
  }
  if (!canDragLayerNode(node)) {
    return
  }

  cleanupLayerDragSession()
  const nodeKey = normalizeKey(node.key)
  layerDragSession = {
    node,
    pointerId: e.pointerId,
    startY: e.clientY,
    armed: false,
    timer: window.setTimeout(() => {
      if (!layerDragSession || normalizeKey(layerDragSession.node.key) !== nodeKey) {
        return
      }
      layerDragSession.armed = true
      layerDragSourceKey.value = nodeKey
      const treenode = (target.closest("[data-layer-key]") || target).closest(".ant-tree-treenode")
      treenode?.classList.add("layer-drag-armed")
    }, LAYER_DRAG_LONG_PRESS_MS)
  }

  const onPointerMove = (ev: PointerEvent) => {
    if (!layerDragSession || ev.pointerId !== layerDragSession.pointerId) {
      return
    }
    if (!layerDragSession.armed) {
      if (Math.abs(ev.clientY - layerDragSession.startY) > LAYER_DRAG_MOVE_THRESHOLD) {
        cleanupLayerDragSession()
      }
      return
    }
    ev.preventDefault()
    const dropKey = getTreeNodeKeyFromElement(document.elementFromPoint(ev.clientX, ev.clientY))
    layerDropTargetKey.value = dropKey && dropKey !== nodeKey ? dropKey : null
    updateLayerDropIndicator(ev.clientY, layerDropTargetKey.value)
  }

  const onPointerUp = (ev: PointerEvent) => {
    if (!layerDragSession || ev.pointerId !== layerDragSession.pointerId) {
      return
    }
    window.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("pointerup", onPointerUp)
    window.removeEventListener("pointercancel", onPointerUp)

    if (layerDragSession.armed && layerDropTargetKey.value) {
      const dropNode = findTreeNodeByKey(fullTree.value, layerDropTargetKey.value)
      if (dropNode && canDragLayerNode(dropNode)) {
        const ok = reorderLayerNodes(layerDragSession.node, dropNode, layerDropBefore.value)
        if (ok) {
          refreshTreeAfterReorder()
        }
      }
    }
    cleanupLayerDragSession()
  }

  window.addEventListener("pointermove", onPointerMove)
  window.addEventListener("pointerup", onPointerUp)
  window.addEventListener("pointercancel", onPointerUp)
}

// 性能优化：防抖函数，减少 localStorage 频繁写入
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timer: number | null = null
  return ((...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = window.setTimeout(() => {
      timer = null
      fn(...args)
    }, delay)
  }) as T
}

// localStorage 持久化键名
const STORAGE_KEY_CHECKED = "mars3d_layer_checked_keys"
const STORAGE_KEY_EXPANDED = "mars3d_layer_expanded_keys"
const STORAGE_KEY_OPACITY = "mars3d_layer_opacity_values"
const STORAGE_KEY_RASTER_STYLE = "mars3d_layer_raster_style_values_v1"
const STORAGE_KEY_VECTOR_STYLE = "mars3d_layer_vector_style_values_v1"
const STORAGE_KEY_SIBLING_ORDER = "mars3d_layer_sibling_order_v1"

// 树控件状态变量
const keyword = ref("")
const treeData = ref<any[]>([])
const fullTree = ref<any[]>([])
const expandedKeys = ref<string[]>([])
const checkedKeys = ref<string[]>([])
const selectedKeys = ref<string[]>([])
const defaultExpandedKeys = ref<string[]>([])
const prevExpandedKeys = ref<string[] | null>(null)
const opacityValue = ref<Record<string, number>>({})
const rasterStyleValue = ref<Record<string, { brightness?: number; contrast?: number; gamma?: number; saturation?: number; hue?: number }>>({})
const vectorStyleValue = ref<Record<string, { fillColor?: string; fillOpacity?: number; outlineColor?: string; outlineWidth?: number }>>({})
const currentLayerCount = ref(0)
let basemapNodeIdSet = new Set<string>()
const currentDatasetId = ref(String(getCurrentDataset()?.datasetId || ""))
const directoryLockMap = ref<Record<string, DirectoryLockRecord>>({})
const superAdminUser = computed(() => isSuperAdmin())
let disposeDatasetChange: null | (() => void) = null
let disposeDatasetSync: null | (() => void) = null

// 导入分组列表（用于清除导入内容）
const importedGroups = computed(() => {
  const result: Array<{ id: string; name: string }> = []
  const walk = (nodes: any[]) => {
    nodes.forEach((node: any) => {
      if (isImportedTopNode(node)) {
        const title = String(node?.title || "")
        result.push({ id: normalizeKey(node?.id), name: title.startsWith("导入:") ? title.slice(3).trim() : title })
      }
      const children = Array.isArray(node?.children) ? node.children : []
      if (children.length) {
        walk(children)
      }
    })
  }
  walk(fullTree.value)
  return result
})

// 清除导入内容处理函数
function handleClearImport({ key }: any) {
  const groupId = String(key)
  const groupNode = findNodeById(fullTree.value, groupId)
  if (!groupNode) {
    $message("未找到导入分组")
    return
  }
  if (!ensureNodeUnlocked(groupNode, "清除导入内容")) {
    return
  }
  // 递归收集所有子图层ID
  const idsToRemove: string[] = []
  function collectIds(node: any) {
    idsToRemove.push(String(node?.id))
    const children = Array.isArray(node?.children) ? node.children : []
    children.forEach(collectIds)
  }
  collectIds(groupNode)

  // 删除所有图层
  let removedCount = 0
  idsToRemove.forEach((id) => {
    const layer = mapWork.getLayerById(id)
    if (layer) {
      try {
        mapWork.removeLayerById(id)
        removedCount++
      } catch {
        // ignore
      }
    }
  })
  cleanupDeletedNodeState(idsToRemove)
  removePersistedSession(groupId)
  window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))

  // 更新树
  initTree()
  $message(`已清除 ${removedCount} 个导入图层`)

  // 清除当前任务状态（如果清除的是当前导入的数据集）
  if (groupId.includes("_")) {
    const parts = groupId.split("_")
    if (parts.length >= 3 && parts[0] === "eoapi" && parts[1] === "group") {
      const datasetId = parts[2]
      // 触发清除当前数据集状态
      window.dispatchEvent(new CustomEvent("ksh002:clear-import", { detail: { datasetId } }))
    }
  }
}

// 元数据弹窗控制
const showLayerProps = ref(false)
const currentLayerProps = ref<any>({})
const inspectedLayerId = ref<string>("")
const rasterStyleEditor = ref<{ brightness: number; contrast: number; gamma: number; saturation: number; hue: number }>({
  brightness: 1,
  contrast: 1,
  gamma: 1,
  saturation: 1,
  hue: 0
})
const vectorStyleEditor = ref<{ fillColor: string; fillOpacity: number; outlineColor: string; outlineWidth: number }>({
  fillColor: "#5cadff",
  fillOpacity: 0.25,
  outlineColor: "#5cadff",
  outlineWidth: 2
})

const rasterStyleAvailable = computed(() => {
  const layer = inspectedLayerId.value ? mapWork.getLayerById(inspectedLayerId.value) : null
  if (!layer) {
    return false
  }
  const type = String(layer?.type || layer?.options?.type || "")
  return isImageryRasterSourceType(type)
})

const vectorStyleAvailable = computed(() => {
  const layer = inspectedLayerId.value ? mapWork.getLayerById(inspectedLayerId.value) : null
  if (!layer) {
    return false
  }
  const type = String(layer?.type || layer?.options?.type || "")
  return type === "geojson" || type === "vector" || (layer?.options?.symbol && typeof layer?.options?.symbol === "object")
})

watch(
  () => showLayerProps.value,
  (open) => {
    if (!open) {
      inspectedLayerId.value = ""
    }
  }
)

watch(
  rasterStyleEditor,
  debounce(() => {
    if (syncingStyleEditor) {
      return
    }
    const id = String(inspectedLayerId.value || "")
    if (!id) {
      return
    }
    const layer = mapWork.getLayerById(id)
    if (!layer) {
      return
    }
    const type = String(layer?.type || layer?.options?.type || "")
    if (!isImageryRasterSourceType(type)) {
      return
    }
    rasterStyleValue.value[id] = {
      brightness: rasterStyleEditor.value.brightness,
      contrast: rasterStyleEditor.value.contrast,
      gamma: rasterStyleEditor.value.gamma,
      saturation: rasterStyleEditor.value.saturation,
      hue: rasterStyleEditor.value.hue
    }
    applyRasterStyleToLayers()
  }, 120),
  { deep: true }
)

watch(
  vectorStyleEditor,
  debounce(() => {
    if (syncingStyleEditor) {
      return
    }
    const id = String(inspectedLayerId.value || "")
    if (!id) {
      return
    }
    const layer = mapWork.getLayerById(id)
    if (!layer) {
      return
    }
    if (!(layer?.options?.symbol && typeof layer.options.symbol === "object")) {
      return
    }
    vectorStyleValue.value[id] = {
      fillColor: vectorStyleEditor.value.fillColor,
      fillOpacity: vectorStyleEditor.value.fillOpacity,
      outlineColor: vectorStyleEditor.value.outlineColor,
      outlineWidth: vectorStyleEditor.value.outlineWidth
    }
    applyVectorStyleToLayers()
  }, 120),
  { deep: true }
)

const renameDialogOpen = ref(false)
const renameTarget = ref<any>(null)
const renameName = ref("")

const moveDialogOpen = ref(false)
const moveTarget = ref<any>(null)
const moveRootPid = ref<string>("")
const moveTargetPid = ref<string>("")
const moveTargetOptions = ref<Array<{ value: string; label: string }>>([])

const deleteDialogOpen = ref(false)
const deleteTarget = ref<any>(null)
const deleteTargetTitle = ref("")

// 元数据字段配置 (Key对应config.json中的字段)
const metaFields = [
  { label: "图层名称", key: "name" },
  { label: "图层类型", key: "type" },
  { label: "图层ID", key: "id" },
  { label: "数据来源", key: "source" },
  { label: "分辨率", key: "resolution" },
  { label: "采集时间", key: "time" },
  { label: "坐标系", key: "crs" },
  { label: "备注说明", key: "remark" }
]

let lastWidget: any

// 从 localStorage 读取持久化状态
function loadPersistedState() {
  try {
    const checked = localStorage.getItem(STORAGE_KEY_CHECKED)
    const expanded = localStorage.getItem(STORAGE_KEY_EXPANDED)
    const opacity = localStorage.getItem(STORAGE_KEY_OPACITY)
    const rasterStyle = localStorage.getItem(STORAGE_KEY_RASTER_STYLE)
    const vectorStyle = localStorage.getItem(STORAGE_KEY_VECTOR_STYLE)

    return {
      checkedKeys: checked ? JSON.parse(checked) : null,
      expandedKeys: expanded ? JSON.parse(expanded) : null,
      opacityValues: opacity ? JSON.parse(opacity) : null,
      rasterStyleValues: rasterStyle ? JSON.parse(rasterStyle) : null,
      vectorStyleValues: vectorStyle ? JSON.parse(vectorStyle) : null
    }
  } catch (e) {
    logInfo("读取图层持久化状态失败", e)
    return { checkedKeys: null, expandedKeys: null, opacityValues: null, rasterStyleValues: null, vectorStyleValues: null }
  }
}

// 保存状态到 localStorage
function savePersistedState() {
  try {
    localStorage.setItem(STORAGE_KEY_CHECKED, JSON.stringify(checkedKeys.value))
    localStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify(expandedKeys.value))
    localStorage.setItem(STORAGE_KEY_OPACITY, JSON.stringify(opacityValue.value))
    localStorage.setItem(STORAGE_KEY_RASTER_STYLE, JSON.stringify(rasterStyleValue.value))
    localStorage.setItem(STORAGE_KEY_VECTOR_STYLE, JSON.stringify(vectorStyleValue.value))
  } catch (e) {
    logInfo("保存图层持久化状态失败", e)
  }
}

function cleanupDeletedNodeState(ids: Array<string | number>) {
  const normalized = new Set(ids.map((id) => normalizeKey(id)))
  checkedKeys.value = checkedKeys.value.filter((id) => !normalized.has(normalizeKey(id)))
  expandedKeys.value = expandedKeys.value.filter((id) => !normalized.has(normalizeKey(id)))
  selectedKeys.value = selectedKeys.value.filter((id) => !normalized.has(normalizeKey(id)))
  const nextOpacity: Record<string, number> = {}
  Object.entries(opacityValue.value).forEach(([id, value]) => {
    if (!normalized.has(normalizeKey(id))) {
      nextOpacity[id] = value
    }
  })
  opacityValue.value = nextOpacity

  const nextRaster: Record<string, any> = {}
  Object.entries(rasterStyleValue.value).forEach(([id, value]) => {
    if (!normalized.has(normalizeKey(id))) {
      nextRaster[id] = value
    }
  })
  rasterStyleValue.value = nextRaster

  const nextVector: Record<string, any> = {}
  Object.entries(vectorStyleValue.value).forEach(([id, value]) => {
    if (!normalized.has(normalizeKey(id))) {
      nextVector[id] = value
    }
  })
  vectorStyleValue.value = nextVector

  savePersistedState()
}

function refreshLayerCount() {
  const allLayers = mapWork.getAllLayers() || []
  currentLayerCount.value = allLayers.filter((layer: any) => {
    const id = String(layer?.id || "")
    const type = String(layer?.type || layer?.options?.type || "").toLowerCase()
    if (!id || isBasemapLayer(layer)) {
      return false
    }
    if (type === "group" || type === "graphic") {
      return false
    }
    if (id === "restored_features" || id === "mars3d_draw_layer") {
      return false
    }
    return true
  }).length
}

// 应用透明度到图层
function applyOpacityToLayers() {
  Object.entries(opacityValue.value).forEach(([id, opacity]) => {
    const layer = mapWork.getLayerById(id)
    if (layer && layer.hasOpacity) {
      layer.opacity = opacity
    }
  })
}

function setLayerOption(layer: any, key: string, value: any) {
  if (!layer) {
    return
  }
  try {
    if (value === undefined || value === null) {
      if (layer.options && Object.prototype.hasOwnProperty.call(layer.options, key)) {
        delete layer.options[key]
      }
    } else {
      layer.options = layer.options || {}
      layer.options[key] = value
    }
  } catch {
  }
  try {
    if (value === undefined || value === null) {
      if (Object.prototype.hasOwnProperty.call(layer, key)) {
        delete layer[key]
      }
    } else {
      layer[key] = value
    }
  } catch {
  }
}

function applyRasterStyleToLayers() {
  Object.entries(rasterStyleValue.value).forEach(([id, style]) => {
    const layer = mapWork.getLayerById(id)
    if (!layer) {
      return
    }
    const type = String(layer?.type || layer?.options?.type || "")
    if (!isImageryRasterSourceType(type)) {
      return
    }
    setLayerOption(layer, "brightness", style?.brightness)
    setLayerOption(layer, "contrast", style?.contrast)
    setLayerOption(layer, "gamma", style?.gamma)
    setLayerOption(layer, "saturation", style?.saturation)
    setLayerOption(layer, "hue", style?.hue)
    try {
      layer?.reload?.()
    } catch {
    }
    try {
      layer?.refresh?.()
    } catch {
    }
  })
}

function toRgba(hex: string, alpha: number): string {
  const h = String(hex || "").trim()
  const a = Math.max(0, Math.min(1, Number(alpha)))
  const m = /^#?([0-9a-f]{6})$/i.exec(h)
  if (!m) {
    return `rgba(92,173,255,${a})`
  }
  const raw = m[1]
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

function applyVectorStyleToLayers() {
  Object.entries(vectorStyleValue.value).forEach(([id, style]) => {
    const layer = mapWork.getLayerById(id)
    if (!layer) {
      return
    }
    const symbol = layer?.options?.symbol && typeof layer.options.symbol === "object" ? layer.options.symbol : null
    if (!symbol) {
      return
    }
    const fillOpacity = style?.fillOpacity
    const fillColor = style?.fillColor
    const outlineColor = style?.outlineColor
    const outlineWidth = style?.outlineWidth
    const nextSymbol = {
      ...symbol,
      styleOptions: {
        ...(symbol as any)?.styleOptions,
        color: fillColor ? toRgba(fillColor, typeof fillOpacity === "number" ? fillOpacity : 0.25) : (symbol as any)?.styleOptions?.color,
        outlineColor: outlineColor || (symbol as any)?.styleOptions?.outlineColor,
        outlineWidth: typeof outlineWidth === "number" ? outlineWidth : (symbol as any)?.styleOptions?.outlineWidth
      }
    }
    try {
      layer.options.symbol = nextSymbol
    } catch {
    }
    try {
      layer?.reload?.()
    } catch {
    }
    try {
      layer?.refresh?.()
    } catch {
    }
  })
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.floor(n))).toString(16).padStart(2, "0")
  return `#${to(r)}${to(g)}${to(b)}`
}

function parseColorToHexAndAlpha(input: any): { hex: string; alpha: number } | null {
  const raw = String(input || "").trim()
  if (!raw) {
    return null
  }
  const hexMatch = /^#?([0-9a-f]{6})$/i.exec(raw)
  if (hexMatch) {
    return { hex: `#${hexMatch[1]}`.toLowerCase(), alpha: 1 }
  }
  const rgbaMatch = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i.exec(raw)
  if (!rgbaMatch) {
    return null
  }
  const r = Number(rgbaMatch[1])
  const g = Number(rgbaMatch[2])
  const b = Number(rgbaMatch[3])
  const a = rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4])
  if (![r, g, b, a].every((n) => Number.isFinite(n))) {
    return null
  }
  return { hex: rgbToHex(r, g, b), alpha: Math.max(0, Math.min(1, a)) }
}

let syncingStyleEditor = false

function syncEditorsFromLayer(layer: any) {
  if (!layer) {
    return
  }
  syncingStyleEditor = true
  try {
    const id = String(layer.id || "")
    const savedRaster = rasterStyleValue.value[id]
    const brightness = savedRaster?.brightness ?? Number(layer?.brightness ?? layer?.options?.brightness ?? 1)
    const contrast = savedRaster?.contrast ?? Number(layer?.contrast ?? layer?.options?.contrast ?? 1)
    const gamma = savedRaster?.gamma ?? Number(layer?.gamma ?? layer?.options?.gamma ?? 1)
    const saturation = savedRaster?.saturation ?? Number(layer?.saturation ?? layer?.options?.saturation ?? 1)
    const hue = savedRaster?.hue ?? Number(layer?.hue ?? layer?.options?.hue ?? 0)
    rasterStyleEditor.value = {
      brightness: Number.isFinite(brightness) ? brightness : 1,
      contrast: Number.isFinite(contrast) ? contrast : 1,
      gamma: Number.isFinite(gamma) ? gamma : 1,
      saturation: Number.isFinite(saturation) ? saturation : 1,
      hue: Number.isFinite(hue) ? hue : 0
    }

    const savedVector = vectorStyleValue.value[id]
    const symbol = layer?.options?.symbol && typeof layer.options.symbol === "object" ? layer.options.symbol : null
    const styleOptions = symbol ? (symbol as any)?.styleOptions || {} : {}
    const fill = parseColorToHexAndAlpha(savedVector?.fillColor || styleOptions.color) || { hex: "#5cadff", alpha: 0.25 }
    const outline = parseColorToHexAndAlpha(savedVector?.outlineColor || styleOptions.outlineColor) || { hex: "#5cadff", alpha: 1 }
    const outlineWidth = savedVector?.outlineWidth ?? Number(styleOptions.outlineWidth ?? 2)
    const fillOpacity = savedVector?.fillOpacity ?? fill.alpha
    vectorStyleEditor.value = {
      fillColor: fill.hex,
      fillOpacity: Number.isFinite(fillOpacity) ? Math.max(0, Math.min(1, Number(fillOpacity))) : 0.25,
      outlineColor: outline.hex,
      outlineWidth: Number.isFinite(outlineWidth) ? outlineWidth : 2
    }
  } finally {
    syncingStyleEditor = false
  }
}

function resetLayerStyle() {
  const id = String(inspectedLayerId.value || "")
  if (!id) {
    return
  }
  const layer = mapWork.getLayerById(id)
  if (!layer) {
    return
  }
  delete rasterStyleValue.value[id]
  delete vectorStyleValue.value[id]

  const type = String(layer?.type || layer?.options?.type || "")
  if (isImageryRasterSourceType(type)) {
    const baseOptions = { ...(layer?.options || {}) }
    delete (baseOptions as any).brightness
    delete (baseOptions as any).contrast
    delete (baseOptions as any).gamma
    delete (baseOptions as any).saturation
    delete (baseOptions as any).hue
    const applied = applyDefaultRasterStyleOptions(baseOptions as any, { name: layer?.name, sourceRef: (baseOptions as any)?.url || "" }, type) as any
    setLayerOption(layer, "brightness", applied.brightness)
    setLayerOption(layer, "contrast", applied.contrast)
    setLayerOption(layer, "gamma", applied.gamma)
    setLayerOption(layer, "saturation", applied.saturation)
    setLayerOption(layer, "hue", applied.hue)
  }

  if (layer?.options?.symbol && typeof layer.options.symbol === "object") {
    const symbol = layer.options.symbol
    const nextSymbol = {
      ...symbol,
      styleOptions: {
        ...(symbol as any)?.styleOptions,
        color: "rgba(92,173,255,0.25)",
        outline: true,
        outlineColor: "rgba(92,173,255,1)",
        outlineWidth: 2
      }
    }
    try {
      layer.options.symbol = nextSymbol
    } catch {
    }
  }

  syncEditorsFromLayer(layer)
  savePersistedState()
  applyRasterStyleToLayers()
  applyVectorStyleToLayers()
  $message("已恢复默认样式", "success")
}

async function loadDirectoryLocks() {
  const datasetId = String(currentDatasetId.value || "")
  if (!datasetId) {
    directoryLockMap.value = {}
    return
  }
  try {
    const res = await getDirectoryLocks(datasetId)
    const next: Record<string, DirectoryLockRecord> = {}
    ;(res.success && Array.isArray(res.data) ? res.data : []).forEach((item) => {
      next[String(item.directoryId || "")] = item
    })
    directoryLockMap.value = next
  } catch {
    directoryLockMap.value = {}
  }
}

function getNodeDirectoryLock(node: any): DirectoryLockRecord | null {
  const rootId = getResultRootGroupId(node)
  if (!rootId) {
    return null
  }
  return directoryLockMap.value[rootId] || null
}

function isNodeLocked(node: any): boolean {
  return !!(getNodeDirectoryLock(node)?.locked && !superAdminUser.value)
}

function getNodeLockReason(node: any): string {
  return String(getNodeDirectoryLock(node)?.reason || "目录已锁定，仅超级管理员可编辑")
}

function ensureNodeUnlocked(node: any, operation: string): boolean {
  if (!isNodeLocked(node)) {
    return true
  }
  $message(`${getNodeLockReason(node)}，无法${operation}`)
  return false
}

// 应用显隐状态到图层（不触发飞到）
function applyCheckedToLayers(checkedIds: string[]) {
  checkedIds.forEach((id) => {
    const layer = mapWork.getLayerById(id)
    if (layer && !isBasemapLayer(layer)) {
      mapWork.updateLayerShowOnly(layer, true)
    }
  })
  // 关闭未勾选的图层（排除底图图层，底图由 manage-basemap 单独管理）
  const allLayers = mapWork.getAllLayers()
  allLayers.forEach((layer) => {
    if (layer.id && layer.hasOpacity !== undefined && !checkedIds.includes(String(layer.id)) && !isBasemapLayer(layer)) {
      mapWork.updateLayerShowOnly(layer, false)
    }
  })
}

onMounted(() => {
  try {
    const raw = localStorage.getItem(LAYER_PERSIST_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const left = Number(parsed?.left)
      if (Number.isFinite(left) && left > 8) {
        localStorage.removeItem(LAYER_PERSIST_KEY)
      }
    }
  } catch {
  }
  disposeDatasetChange = onCurrentDatasetChange((dataset) => {
    currentDatasetId.value = String(dataset?.datasetId || "")
    loadDirectoryLocks().catch(() => {})
  })
  disposeDatasetSync = onDatasetSync((detail) => {
    const datasetId = String(currentDatasetId.value || "")
    if (!datasetId) {
      return
    }
    if (detail.datasetId && detail.datasetId !== datasetId) {
      return
    }
    if (detail.reason === "lock" || detail.reason === "refresh") {
      loadDirectoryLocks().catch(() => {})
    }
  })
  loadDirectoryLocks().catch(() => {})
  initTree()
  nextTick(() => {
    applyFocusFromWidgetData()
  })
})

// 监听状态变化，自动保存到 localStorage（性能优化：300ms 防抖）
watch(
  [checkedKeys, expandedKeys, opacityValue, rasterStyleValue, vectorStyleValue],
  debounce(() => {
    savePersistedState()
  }, 300),
  { deep: true }
)

onUnmounted(() => {
  cleanupLayerDragSession()
  disposeDatasetChange?.()
  disposeDatasetChange = null
  disposeDatasetSync?.()
  disposeDatasetSync = null
  disable("layer-scenetree")
  updateWidget("toolbar", "manage-layer")
})

currentWidget.onUpdate(() => {
  keyword.value = ""
  fullTree.value = []
  treeData.value = []
  expandedKeys.value = []
  checkedKeys.value = []
  selectedKeys.value = []
  defaultExpandedKeys.value = []
  prevExpandedKeys.value = null
  opacityValue.value = {}
  rasterStyleValue.value = {}
  vectorStyleValue.value = {}

  initTree()
  nextTick(() => {
    applyFocusFromWidgetData()
  })
})

function normalizeText(v: any) {
  return String(v || "").trim().toLowerCase()
}

function filterTree(nodes: any[], query: string) {
  const q = normalizeText(query)
  if (!q) {
    return { tree: nodes, expandKeys: [] as string[] }
  }
  const expandKeys: string[] = []
  const walk = (list: any[]): any[] => {
    const out: any[] = []
    list.forEach((n) => {
      const title = normalizeText(n.title)
      const children = Array.isArray(n.children) ? n.children : []
      const nextChildren = walk(children)
      const hit = title.includes(q)
      if (hit || nextChildren.length > 0) {
        const copy = { ...n }
        if (nextChildren.length > 0) {
          copy.children = nextChildren
          expandKeys.push(copy.key)
        } else {
          copy.children = children
        }
        out.push(copy)
      }
    })
    return out
  }
  return { tree: walk(nodes), expandKeys }
}

const filtered = computed(() => {
  return filterTree(fullTree.value, keyword.value)
})

watch(
  () => filtered.value,
  (v) => {
    treeData.value = v.tree
    if (!normalizeText(keyword.value)) {
      if (prevExpandedKeys.value) {
        expandedKeys.value = [...prevExpandedKeys.value]
        prevExpandedKeys.value = null
      } else {
        expandedKeys.value = [...defaultExpandedKeys.value]
      }
      return
    }
    if (!prevExpandedKeys.value) {
      prevExpandedKeys.value = [...expandedKeys.value]
    }
    expandedKeys.value = Array.from(new Set(v.expandKeys))
  },
  { immediate: true }
)

// 初始化树构件
function initTree() {
  const showIds = [] // 是显示状态的图层id集合
  const openIds = [] // 展开的树节点id集合（如果不想展开，对应图层配置open:false）
  const opacityMap: Record<string, number> = {} // 性能优化：批量收集透明度数据
  const basemapTreeIdSet = new Set<any>()
  const nextBasemapNodeIdSet = new Set<string>()

  const result = mapWork.getLayrsTree({
    basemaps: true, // 是否取config.json中的basempas
    filter: function (layer) {
      if (!layer.name) {
        logInfo("未命名图层不加入图层管理", layer)
        return false // 未命名图层不在管理器展示
      }
      return true
    },
    forEach: function (item, layer) {
      item.key = String(item.id) // 树控件api需要的唯一标识
      item.title = item.name || `未命名(${layer.type})` // 树控件api需要的显示文本字段

      item.hasZIndex = layer.hasZIndex // 当前vue绑定使用的属性
      item.hasOpacity = layer.hasOpacity

      const rawId = item.id
      const rawPid = item.pid
      const layerPid = layer?.pid ?? layer?.options?.pid
      const isBasemap = rawId === 10 || rawId === 11 || layerPid === 10 || layerPid === 11 || basemapTreeIdSet.has(rawPid) || layer?._isBasemap === true

      // 底图图层设置为禁用勾选，并在树中显示但不可操作
      if (isBasemap) {
        item.disabled = true // 禁用勾选
        item.isBasemap = true // 标记为底图
        basemapTreeIdSet.add(rawId)
        nextBasemapNodeIdSet.add(String(rawId))
      }

      // 性能优化：先收集到临时对象，避免多次触发 Vue 响应式更新
      opacityMap[String(item.id)] = layer.opacity ?? 1

      // 只有非底图图层才加入 showIds（底图不参与勾选状态管理）
      if (item.show && !isBasemap) {
        showIds.push(String(item.id))
      }
      if (item.group && item.open !== false) {
        openIds.push(String(item.id))
      }
    }
  })
  logInfo("获取到的map图层树", result)
  basemapNodeIdSet = nextBasemapNodeIdSet
  refreshLayerCount()

  // 性能优化：一次性赋值透明度数据，只触发一次响应式更新
  opacityValue.value = opacityMap

  // 赋予树控件
  const wrappedTree = wrapTreeByOutcome(result.tree)
  applySiblingOrderStateToTree(wrappedTree)
  fullTree.value = wrappedTree
  treeData.value = wrappedTree

  // 尝试恢复持久化状态
  const persisted = loadPersistedState()
  if (persisted.checkedKeys && persisted.checkedKeys.length > 0) {
    // 有持久化数据，恢复状态
    checkedKeys.value = persisted.checkedKeys
    // 应用显隐状态到图层
    applyCheckedToLayers(persisted.checkedKeys)
  } else {
    // 无持久化数据，使用默认状态
    checkedKeys.value = showIds
  }

  if (persisted.expandedKeys) {
    expandedKeys.value = persisted.expandedKeys
  } else {
    expandedKeys.value = openIds
  }
  defaultExpandedKeys.value = openIds

  const rootExpandKeys = wrappedTree
    .filter((n: any) =>
      ["__import_root__", "__result_root__", "__system_root__"].includes(normalizeKey(n.id))
    )
    .map((n: any) => normalizeKey(n.key))
  if (rootExpandKeys.length) {
    expandedKeys.value = Array.from(new Set([...(expandedKeys.value || []), ...rootExpandKeys]))
    defaultExpandedKeys.value = Array.from(new Set([...(defaultExpandedKeys.value || []), ...rootExpandKeys]))
  }

  // 应用透明度状态
  if (persisted.opacityValues) {
    opacityValue.value = persisted.opacityValues
    applyOpacityToLayers()
  }

  if (persisted.rasterStyleValues && typeof persisted.rasterStyleValues === "object") {
    rasterStyleValue.value = persisted.rasterStyleValues
    applyRasterStyleToLayers()
  }

  if (persisted.vectorStyleValues && typeof persisted.vectorStyleValues === "object") {
    vectorStyleValue.value = persisted.vectorStyleValues
    applyVectorStyleToLayers()
  }

  if (!baselineLayerZIndex || Object.keys(baselineLayerZIndex).length === 0) {
    captureBaselineLayerOrder()
  }
}

// 检查是否是底图图层（底图由 manage-basemap 单独管理，不应被图层管理器控制）
function isBasemapLayer(layer: any): boolean {
  if (!layer) {
    return false
  }
  if (basemapNodeIdSet.has(String(layer.id))) {
    return true
  }
  let cur: any = layer
  for (let i = 0; i < 10 && cur; i++) {
    const pid = cur.pid ?? cur.options?.pid
    if (pid === 10 || pid === 11) {
      return true
    }
    if (cur._isBasemap === true) {
      return true
    }
    cur = cur._parent || cur.parent || cur._parentLayer || cur.options?.parent || cur.options?._parent
  }
  return basemapNodeIdSet.has(String(layer.id))
}

// 防止递归勾选处理中的重复渲染
let isProcessingCheckChange = false

// 树控件 勾选事件
function checkedChange(keys: string[], e: any) {
  // 防止递归处理时的重复渲染
  if (isProcessingCheckChange) {
    return
  }

  try {
    isProcessingCheckChange = true
    processCheckedChange(keys, e)
  } finally {
    isProcessingCheckChange = false
  }
}

// 实际的勾选处理逻辑
function processCheckedChange(keys: string[], e: any) {
  const layer = mapWork.getLayerById(e.node?.key)

  if (layer) {
    // 跳过底图图层（已禁用）或禁用节点
    if (e.node?.disabled || isBasemapLayer(layer)) {
      return
    }

    const show = keys.indexOf(e.node.key) !== -1
    // 使用不触发飞到的显隐控制
    mapWork.updateLayerShowOnly(layer, show)

    // 特殊处理同目录下的单选的互斥的节点，可在config对应图层节点中配置"radio":true即可
    if (layer.options?.radio && e.checked) {
      // 循环所有的图层
      const layersM = mapWork.getLayerByAttr(layer.pid, "pid") // 与当前操作的图层的pid相同的图层
      for (let index = 0; index < layersM.length; index++) {
        const layerTemp = layersM[index]
        checkedKeys.value.forEach((key, idx) => {
          if (layerTemp.id === Number(key) && layerTemp !== layer) {
            checkedKeys.value.splice(idx, 1)
            layerTemp.show = false
          }
        })
      }
    }

    // 处理图层的关联事件
    if (layer.options?.onWidget) {
      if (e.checked) {
        if (lastWidget) {
          disable(lastWidget)
        }
        activate({
          name: layer.options.onWidget
        })
        lastWidget = layer.options.onWidget
      } else {
        disable(layer.options.onWidget)
      }
    }

    // 处理图层构件树控件
    if (layer.options?.scenetree) {
      initSceneTree(layer)
    }
  }

  // 处理子节点（跳过禁用和底图的子图层）
  if (e.node.children && e.node.children.length) {
    e.node.children.forEach((child) => {
      // 跳过禁用节点（底图及其子图层）
      if (!child.disabled && !child.isBasemap) {
        processCheckedChange(keys, { node: child, checked: e.checked })
      }
    })
  }
}

const opcityChange = (node: any, value: string | number) => {
  const layer = mapWork.getLayerById(node.id)
  if (layer) {
    layer.opacity = value
  }
}

const onContextMenuClick = (node: any, type: string) => {
  if (type === "rename") {
    if (!canRename(node)) {
      return
    }
    openRename(node)
    return
  }
  if (type === "move") {
    if (!canMove(node)) {
      return
    }
    openMove(node)
    return
  }
  if (type === "delete") {
    if (!canDelete(node)) {
      return
    }
    openDelete(node)
    return
  }
  if (type === "hideGroup") {
    if (!canHideGroup(node)) {
      return
    }
    hideGroupLayers(node)
    return
  }
  if (type === "showGroup") {
    if (!canShowGroup(node)) {
      return
    }
    showGroupLayers(node)
    return
  }

  const parent = node._getParent()
  const children = parent?.children
  const index = node._index

  if (!children || typeof index !== "number") {
    return
  }

  switch (type) {
    // <a-menu-item key="1">图层置为顶层</a-menu-item>
    case "1": {
      let layerIndex = index
      children[0]._index = index
      children[index]._index = 0
      while (layerIndex > 0) {
        mapWork.exchangeLayer(children[index].id, children[layerIndex - 1].id)
        layerIndex--
      }
      break
    }
    // <a-menu-item key="2">图层上移一层</a-menu-item>
    case "2": {
      children[index - 1]._index = index
      children[index]._index = index - 1
      mapWork.exchangeLayer(children[index].id, children[index - 1].id)

      break
    }
    // <a-menu-item key="3">图层下移一层</a-menu-item>
    case "3": {
      children[index + 1]._index = index
      children[index]._index = index + 1
      mapWork.exchangeLayer(children[index].id, children[index + 1].id)

      break
    }
    // <a-menu-item key="4">图层置为底层</a-menu-item>
    case "4": {
      let layerIndex = index
      children[children.length - 1]._index = index
      children[index]._index = children.length - 1
      while (layerIndex < children.length - 1) {
        mapWork.exchangeLayer(children[index].id, children[layerIndex + 1].id)
        layerIndex++
      }
      break
    }
    // <a-menu-item key="5">查看属性</a-menu-item>
    case "5": {
      const layer = mapWork.getLayerById(node.id)
      if (layer) {
        inspectedLayerId.value = String(layer.id || "")
        syncEditorsFromLayer(layer)
        // 合并 options 中的 metadata 和基础属性
        const metadata = layer.options.metadata || {}
        currentLayerProps.value = {
          name: layer.name,
          type: layer.type,
          id: layer.id,
          ...layer.options, // 兜底：显示所有配置项
          ...metadata // 优先显示 metadata 中的规范字段
        }
        showLayerProps.value = true
      }
      break
    }
  }

  parent.children = children.sort((a: any, b: any) => a._index - b._index)
}

function normalizeKey(v: any): string {
  return String(v ?? "")
}

function isImportedTopNode(node: any): boolean {
  const id = normalizeKey(node?.id)
  const title = String(node?.title || "")
  return id.startsWith("eoapi_group_") || title.startsWith("导入:") || title.startsWith("导入 /")
}

function isResultRootGroupId(id: string): boolean {
  return id.startsWith("myrepo_group_") || id.startsWith("eoapi_group_")
}

function isResultPrefixedId(id: string): boolean {
  return id.startsWith("myrepo_") || id.startsWith("eoapi_")
}

function getResultRootGroupId(node: any): string | null {
  const startId = normalizeKey(node?.id)
  if (isResultRootGroupId(startId)) {
    return startId
  }

  const startLayer = mapWork.getLayerById(startId)
  let layer: any = startLayer
  for (let i = 0; i < 30 && layer; i++) {
    const pid = layer?.pid ?? layer?.options?.pid
    if (!pid) {
      break
    }
    const pidId = normalizeKey(pid)
    if (isResultRootGroupId(pidId)) {
      return pidId
    }
    layer = mapWork.getLayerById(pidId)
  }

  let cur: any = node
  for (let i = 0; i < 30 && cur; i++) {
    const id = normalizeKey(cur.id)
    if (isResultRootGroupId(id)) {
      return id
    }
    cur = typeof cur._getParent === "function" ? cur._getParent() : null
  }
  return null
}

function isResultNode(node: any): boolean {
  if (!node) {
    return false
  }
  const id = normalizeKey(node.id)
  if (isResultRootGroupId(id) || isResultPrefixedId(id)) {
    return true
  }
  return !!getResultRootGroupId(node)
}

function canRename(node: any): boolean {
  return isResultNode(node) && !isNodeLocked(node)
}

function canDelete(node: any): boolean {
  return isResultNode(node) && !isNodeLocked(node)
}

function canHideGroup(node: any): boolean {
  if (isNodeLocked(node)) {
    return false
  }
  if (!node) {
    return false
  }
  const children = Array.isArray(node.children) ? node.children : []
  if (children.length === 0) {
    return false
  }
  // 只有分组节点才能隐藏
  const isGroup = node.group === true || String(node.sourceType || "") === "group"
  if (!isGroup) {
    return false
  }
  // 至少有一个可见的子节点才可隐藏
  return children.some((c: any) => c.checked || c.show !== false)
}

function canShowGroup(node: any): boolean {
  if (isNodeLocked(node)) {
    return false
  }
  if (!node) {
    return false
  }
  const children = Array.isArray(node.children) ? node.children : []
  if (children.length === 0) {
    return false
  }
  const isGroup = node.group === true || String(node.sourceType || "") === "group"
  if (!isGroup) {
    return false
  }
  // 至少有一个不可见的子节点才可显示
  return children.some((c: any) => !c.checked || c.show === false)
}

function collectGroupLayerKeys(node: any): string[] {
  const out: string[] = []
  const visit = (current: any) => {
    const children = Array.isArray(current?.children) ? current.children : []
    children.forEach((child: any) => {
      const id = normalizeKey(child?.id)
      const layer = id ? mapWork.getLayerById(id) : null
      if (layer) {
        out.push(id)
      }
      if (Array.isArray(child?.children) && child.children.length) {
        visit(child)
      }
    })
  }
  visit(node)
  return Array.from(new Set(out))
}

function hideGroupLayers(node: any) {
  if (!ensureNodeUnlocked(node, "隐藏分组")) {
    return
  }
  const childKeys = collectGroupLayerKeys(node)
  childKeys.forEach((id) => {
    const layer = mapWork.getLayerById(id)
    if (layer) {
      layer.show = false
    }
  })
  const nextChecked = checkedKeys.value.filter((k) => !childKeys.includes(k))
  checkedKeys.value = nextChecked
  initTree()
  $message("已隐藏分组")
}

function showGroupLayers(node: any) {
  if (!ensureNodeUnlocked(node, "显示分组")) {
    return
  }
  const childKeys = collectGroupLayerKeys(node)
  childKeys.forEach((id) => {
    const layer = mapWork.getLayerById(id)
    if (layer) {
      layer.show = true
    }
  })
  const nextChecked = new Set(checkedKeys.value)
  childKeys.forEach((k) => nextChecked.add(k))
  checkedKeys.value = Array.from(nextChecked)
  initTree()
  $message("已显示分组")
}

function canMove(node: any): boolean {
  const id = normalizeKey(node?.id)
  if (!isResultNode(node)) {
    return false
  }
  if (isNodeLocked(node)) {
    return false
  }
  if (isResultRootGroupId(id)) {
    return false
  }
  return true
}

function showResultActions(node: any): boolean {
  return canRename(node) || canMove(node) || canDelete(node)
}

function isResultTopNode(node: any): boolean {
  const id = normalizeKey(node?.id)
  const title = String(node?.title || "")
  return isResultRootGroupId(id) || title.startsWith("我的仓库/") || title.startsWith("数据集成果/")
}

function wrapTreeByOutcome(nodes: any[]): any[] {
  const importNodes: any[] = []
  const resultNodes: any[] = []
  const systemNodes: any[] = []
  nodes.forEach((n) => {
    if (isImportedTopNode(n)) {
      importNodes.push(n)
    } else if (isResultTopNode(n)) {
      resultNodes.push(n)
    } else {
      systemNodes.push(n)
    }
  })

  const out: any[] = []
  if (importNodes.length) {
    out.push({
      id: "__import_root__",
      key: "__import_root__",
      title: "导入图层",
      name: "导入图层",
      group: true,
      open: true,
      disabled: true,
      disableCheckbox: true,
      children: importNodes
    })
  }
  if (resultNodes.length) {
    out.push({
      id: "__result_root__",
      key: "__result_root__",
      title: "成果图层",
      name: "成果图层",
      group: true,
      open: true,
      disabled: true,
      disableCheckbox: true,
      children: resultNodes
    })
  }
  if (systemNodes.length) {
    out.push({
      id: "__system_root__",
      key: "__system_root__",
      title: "系统图层",
      name: "系统图层",
      group: true,
      open: true,
      disabled: true,
      disableCheckbox: true,
      children: systemNodes
    })
  }

  return out.length ? out : nodes
}

function findPathById(nodes: any[], targetId: string): any[] | null {
  for (const n of nodes) {
    if (normalizeKey(n.id) === targetId) {
      return [n]
    }
    const children = Array.isArray(n.children) ? n.children : []
    const childPath = findPathById(children, targetId)
    if (childPath) {
      return [n, ...childPath]
    }
  }
  return null
}

function findNodeById(nodes: any[], targetId: string): any | null {
  const path = findPathById(nodes, targetId)
  if (!path || path.length === 0) {
    return null
  }
  return path[path.length - 1]
}

function findPathByName(nodes: any[], targetName: string): any[] | null {
  const name = String(targetName || "").trim()
  if (!name) {
    return null
  }
  for (const n of nodes) {
    const title = String(n?.title || n?.name || "").trim()
    if (title === name) {
      return [n]
    }
    const children = Array.isArray(n.children) ? n.children : []
    const childPath = findPathByName(children, name)
    if (childPath) {
      return [n, ...childPath]
    }
  }
  return null
}

function applyFocusFromWidgetData() {
  const data = currentWidget?.data || {}
  const focusPidRaw = data.focusPid
  const focusName = String(data.focusName || "").trim()
  let path: any[] | null = null
  if (focusPidRaw) {
    path = findPathById(fullTree.value, normalizeKey(focusPidRaw))
  } else if (focusName) {
    path = findPathByName(fullTree.value, focusName)
  }
  if (!path || path.length === 0) {
    return
  }
  const expand = path.slice(0, -1).map((n) => normalizeKey(n.key))
  const nextExpanded = new Set<string>(expandedKeys.value)
  expand.forEach((k) => nextExpanded.add(k))
  expandedKeys.value = Array.from(nextExpanded)
  const target = path[path.length - 1]
  selectedKeys.value = [normalizeKey(target.key)]
  if (data.ensureVisible) {
    path.forEach((n) => {
      const id = n?.id
      if (id == null || String(id).startsWith("__")) {
        return
      }
      const layer = mapWork.getLayerById(id)
      if (!layer || n.disabled || n.isBasemap) {
        return
      }
      mapWork.updateLayerShowOnly(layer, true)
    })
    const targetKey = normalizeKey(target.key)
    if (!checkedKeys.value.map((k) => normalizeKey(k)).includes(targetKey)) {
      checkedKeys.value = [...checkedKeys.value, targetKey]
    }
    const targetLayer = mapWork.getLayerById(target.id)
    if (targetLayer?.options?.onWidget) {
      activate({
        name: targetLayer.options.onWidget
      })
    }
  }
  nextTick(() => {
    const el = document.querySelector(".layer-tree .ant-tree-treenode-selected")
    if (el && (el as any).scrollIntoView) {
      ;(el as any).scrollIntoView({ block: "center" })
    }
  })
}

function openRename(node: any) {
  if (!ensureNodeUnlocked(node, "重命名")) {
    return
  }
  renameTarget.value = node
  renameName.value = String(node?.title || "")
  renameDialogOpen.value = true
}

function cancelRename() {
  renameDialogOpen.value = false
  renameTarget.value = null
  renameName.value = ""
}

function confirmRename() {
  const node = renameTarget.value
  const nextName = String(renameName.value || "").trim()
  if (!node) {
    cancelRename()
    return
  }
  if (!nextName) {
    $message("名称不能为空")
    return
  }
  const ok = mapWork.setLayerName(node.id, nextName)
  if (!ok) {
    $message("重命名失败")
    return
  }
  renameDialogOpen.value = false
  renameTarget.value = null
  initTree()
  nextTick(() => {
    selectedKeys.value = [normalizeKey(node.key)]
  })
}

function buildGroupOptions(nodes: any[], excludeIds: Set<string>, out: Array<{ value: string; label: string }>, skipId?: string) {
  nodes.forEach((n) => {
    const id = normalizeKey(n.id)
    if (n.group && !excludeIds.has(id) && !n.disabled && id !== skipId) {
      out.push({ value: id, label: String(n.title || id) })
    }
    if (Array.isArray(n.children) && n.children.length) {
      buildGroupOptions(n.children, excludeIds, out, skipId)
    }
  })
}

function collectDescendantIds(node: any, out: Set<string>) {
  if (!node) {
    return
  }
  out.add(normalizeKey(node.id))
  const children = Array.isArray(node.children) ? node.children : []
  children.forEach((c) => collectDescendantIds(c, out))
}

function openMove(node: any) {
  if (!ensureNodeUnlocked(node, "移动")) {
    return
  }
  moveTarget.value = node
  const rootGroupId = getResultRootGroupId(node)
  if (!rootGroupId) {
    cancelMove()
    return
  }
  moveRootPid.value = rootGroupId
  const exclude = new Set<string>()
  collectDescendantIds(node, exclude)
  const options: Array<{ value: string; label: string }> = [{ value: rootGroupId, label: "成果根目录" }]
  const rootNode = findNodeById(fullTree.value, rootGroupId)
  if (rootNode) {
    buildGroupOptions([rootNode], exclude, options, rootGroupId)
  }
  moveTargetOptions.value = options
  moveTargetPid.value = rootGroupId
  moveDialogOpen.value = true
}

function cancelMove() {
  moveDialogOpen.value = false
  moveTarget.value = null
  moveRootPid.value = ""
  moveTargetPid.value = ""
  moveTargetOptions.value = []
}

function confirmMove() {
  const node = moveTarget.value
  if (!node) {
    cancelMove()
    return
  }
  const pid = moveTargetPid.value || moveRootPid.value
  if (!pid) {
    $message("请选择目标分组")
    return
  }
  const ok = mapWork.setLayerPid(node.id, pid)
  if (!ok) {
    $message("移动失败")
    return
  }
  moveDialogOpen.value = false
  moveTarget.value = null
  moveRootPid.value = ""
  initTree()
  nextTick(() => {
    selectedKeys.value = [normalizeKey(node.key)]
  })
}

function openDelete(node: any) {
  if (!ensureNodeUnlocked(node, "删除")) {
    return
  }
  deleteTarget.value = node
  deleteTargetTitle.value = String(node?.title || "")
  deleteDialogOpen.value = true
}

function cancelDelete() {
  deleteDialogOpen.value = false
  deleteTarget.value = null
  deleteTargetTitle.value = ""
}

function collectIdsForDelete(node: any, out: Array<string | number>) {
  const children = Array.isArray(node.children) ? node.children : []
  children.forEach((c) => collectIdsForDelete(c, out))
  out.push(node.id)
}

function confirmDelete() {
  const node = deleteTarget.value
  if (!node) {
    cancelDelete()
    return
  }
  const ids: Array<string | number> = []
  collectIdsForDelete(node, ids)
  let removedAny = false
  ids.forEach((id) => {
    const ok = mapWork.removeLayerById(id)
    if (ok) {
      removedAny = true
    }
  })
  if (!removedAny) {
    $message("删除失败")
    return
  }
  cleanupDeletedNodeState(ids)
  const rootId = normalizeKey(node.id)
  if (isImportedTopNode(node) || rootId.startsWith("myrepo_group_")) {
    removePersistedSession(rootId)
  }
  window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
  deleteDialogOpen.value = false
  deleteTarget.value = null
  deleteTargetTitle.value = ""
  initTree()
}

function flyTo(item: any) {
  if (item.checked) {
    const layer = mapWork.getLayerById(item.id)
    layer.flyTo()
  }
}

function initSceneTree(layer: any) {
  disable("layer-scenetree")

  if (lastBindClickLayer) {
    lastBindClickLayer.off("click", onClickBimLayer)
    lastBindClickLayer = null
  }

  // 处理图层构件树控件
  if (layer.options.scenetree) {
    layer.on("click", onClickBimLayer)
    lastBindClickLayer = layer
  }
}

let lastBindClickLayer

function onClickBimLayer(event: any) {
  const layer = event.layer
  const url = layer.options.url
  const id = layer.id
  activate({
    name: "layer-scenetree",
    data: { url, id }
  })
}
</script>

<style lang="less">
.manage-layer_pannel {
  &.mars-dialog {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }

  .mars-dialog__header {
    display: flex;
    align-items: center;
    line-height: normal;
    overflow: visible;

    .icon {
      flex-shrink: 0;
      margin-right: 8px;
    }

    .title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: var(--popup-header-height);
    }

    .mars-dialog__header-right {
      float: none;
      margin-top: 0;
      margin-right: 8px;
      flex-shrink: 0;
    }

    .close-btn {
      float: none;
      margin-top: 0;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      background: transparent;
      border-radius: calc(var(--popup-radius, 8px) - 2px);
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover {
        background: rgba(255, 255, 255, 0.08);
      }
    }
  }

  .layer-header-refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: calc(var(--popup-radius, 8px) - 2px);
    color: var(--mars-text-color);
    cursor: pointer;
    opacity: 0.85;
    transition: background var(--transition-fast), color var(--transition-fast), opacity var(--transition-fast);

    &:hover {
      opacity: 1;
      color: var(--color-primary, #2d8cf0);
      background: rgba(255, 255, 255, 0.08);
    }
  }

  .mars-dialog__content {
    overflow: hidden !important;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: auto !important;
    box-sizing: border-box;
  }

  .mars-dialog__footer {
    position: relative;
    left: 0;
    bottom: auto;
    width: 100%;
    height: auto;
    min-height: var(--popup-footer-height);
    flex-shrink: 0;
    align-items: center;
    padding: 8px 12px;
    box-sizing: border-box;
  }

  .layer-panel-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: 100%;
  }

  .layer-panel-fixed {
    flex-shrink: 0;
    z-index: 1;
    width: 100%;
    box-sizing: border-box;
    background: transparent;
  }

  .layer-panel-scroll {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .layer-tree.ant-tree {
    .ant-tree-treenode {
      position: relative;
      display: flex;
      align-items: flex-start;
      width: 100%;
      padding: 2px 0;
      min-height: 28px;
    }

    .ant-tree-indent {
      align-self: stretch;
      display: inline-flex;
      position: relative;
    }

    .ant-tree-indent-unit {
      position: relative;
      height: 100% !important;
      align-self: stretch;
    }

    /* 全层级引导线：贯穿整行（含透明度滑栏高度） */
    &.ant-tree-show-line {
      .ant-tree-indent-unit::before {
        position: absolute !important;
        top: 0 !important;
        bottom: 0 !important;
        right: 12px;
        height: auto !important;
        border-right: 1px solid rgba(184, 194, 209, 0.32) !important;
        content: "" !important;
      }

      .ant-tree-switcher {
        position: relative;
        background: transparent !important;
      }

      .ant-tree-switcher-noop {
        position: relative;
        background: transparent !important;
      }

      /* 覆盖 mars-tree 全局固定 26px/10px，避免滑栏行引导线中断 */
      .ant-tree-switcher-noop::before {
        content: "" !important;
        display: block !important;
        position: absolute !important;
        top: 0 !important;
        left: 50% !important;
        width: 0 !important;
        border-right: 1px solid rgba(184, 194, 209, 0.32) !important;
        transform: translateX(-0.5px);
        bottom: 0 !important;
        height: auto !important;
      }

      .ant-tree-switcher-noop::after {
        content: "" !important;
        display: block !important;
        position: absolute !important;
        top: 12px !important;
        left: 50% !important;
        width: 10px !important;
        border-bottom: 1px solid rgba(184, 194, 209, 0.32) !important;
        border-right: none !important;
        height: 0 !important;
        bottom: auto !important;
      }

      .ant-tree-treenode-leaf-last > .ant-tree-switcher-noop::before {
        bottom: auto !important;
        height: 12px !important;
      }

      /* 有透明度滑栏的节点：左侧 indent / switcher 拉高，竖线连续 */
      .ant-tree-treenode:has(.has-opacity-slider) {
        .ant-tree-indent,
        .ant-tree-indent-unit,
        .ant-tree-switcher,
        .ant-tree-switcher-noop {
          align-self: stretch;
          height: auto !important;
          min-height: 100%;
        }

        .ant-tree-indent-unit::before {
          top: 0 !important;
          bottom: 0 !important;
          height: auto !important;
        }

        &:not(.ant-tree-treenode-leaf-last) > .ant-tree-switcher-noop::before {
          top: 0 !important;
          bottom: 0 !important;
          height: auto !important;
        }

        &.ant-tree-treenode-leaf-last > .ant-tree-switcher-noop::before {
          top: 0 !important;
          height: 12px !important;
          bottom: auto !important;
        }
      }
    }

    .ant-tree-switcher {
      width: 24px !important;
      height: 24px;
      line-height: 24px;
      flex-shrink: 0;
      align-self: flex-start;
      margin-top: 0;
    }

    .ant-tree-switcher-noop {
      width: 24px !important;
    }

    .ant-tree-checkbox {
      margin-block-start: 0 !important;
      margin-top: 4px !important;
      flex-shrink: 0;
      align-self: flex-start;
    }

    .ant-tree-iconEle {
      width: 24px;
      height: 24px;
      line-height: 24px;
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      align-self: flex-start;
    }

    .ant-tree-node-content-wrapper {
      flex: 1;
      min-width: 0;
      height: 24px;
      display: inline-flex;
      align-items: flex-start;
      overflow: visible;
      padding-inline: 4px !important;
    }

    .ant-tree-treenode:has(.has-opacity-slider) {
      .ant-tree-node-content-wrapper {
        height: auto;
        min-height: 24px;
        align-items: flex-start;
        overflow: visible;
      }

      .ant-tree-title {
        overflow: visible !important;
        height: auto !important;
        min-height: 24px;
        line-height: 24px;
      }

      .ant-tree-checkbox,
      .ant-tree-iconEle {
        align-self: flex-start;
      }
    }

    .ant-tree-title {
      flex: 1;
      min-width: 0;
      width: 100%;
      height: 24px;
      line-height: 24px;
    }

    .ant-tree-treenode.layer-drag-armed {
      opacity: 0.82;
      background: rgba(45, 140, 240, 0.12);
      border-radius: 4px;
    }

    .ant-tree-treenode.layer-drop-before {
      box-shadow: inset 0 2px 0 #2d8cf0;
    }

    .ant-tree-treenode.layer-drop-after {
      box-shadow: inset 0 -2px 0 #2d8cf0;
    }
  }
}

.layer-props-table {
  padding: 10px;
  font-size: 14px;
  .prop-row {
    display: flex;
    margin-bottom: 8px;
    border-bottom: 1px dashed rgba(255,255,255,0.1);
    padding-bottom: 4px;
    .prop-label { color: #aaa; width: 80px; }
    .prop-value { color: #fff; flex: 1; }
  }
  .prop-divider {
    margin: 15px 0 5px;
    color: #40a9ff;
    font-weight: bold;
  }
  .raw-json {
    background: rgba(0,0,0,0.3);
    padding: 5px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    color: #ddd;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow-y: auto;
  }
}
</style>

<style scoped lang="less">
.layer-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 0 10px;

  .search-input {
    flex: 1;
    min-width: 0;
  }

  .clear-import-btn {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    border-radius: 4px;
  }
}

.layer-search {
  padding: 8px 0 10px;
}

.layer-limit-tip {
  margin-bottom: 0;
  padding-bottom: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  background: transparent;
}

.title {
  width: 50%;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-family: var(--mars-font-family);
}

.layer-node-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  min-width: 0;
  min-height: 24px;
  line-height: 24px;
}

.layer-node-main {
  display: flex;
  align-items: center;
  min-height: 24px;
  height: 24px;
  min-width: 0;
}

.tree-slider-row {
  position: relative;
  /* 向左覆盖树图标宽度，使滑栏对齐「图标 + 标题」左缘，不穿越勾选框与侧边引导线 */
  margin: 2px 0 0 -24px;
  width: calc(100% + 24px);
  max-width: none;
  height: 18px;
  padding: 0 2px 0 0;
  box-sizing: border-box;
  z-index: 1;
}

.layer-node-title {
  display: inline-flex;
  align-items: center;
  height: 24px;
  line-height: 24px;
  gap: 8px;
  cursor: grab;
  user-select: none;
  touch-action: none;

  &.is-drag-armed {
    cursor: grabbing;
    color: var(--color-primary, #2d8cf0);
  }
}

.layer-node-lock {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(250, 173, 20, 0.16);
  color: #ffd666;
}

.tips {
  width: 100%;
  text-align: center;
  margin: 0;
  padding: 0;
  font-size: 12px;
  line-height: 18px;
  letter-spacing: 0.01em;
  color: var(--text-secondary, #9e9e9e);
  white-space: normal;
  word-break: break-word;
  position: static;
}
</style>
