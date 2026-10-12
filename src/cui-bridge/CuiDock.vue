<template>
  <teleport to="body">
    <button
      ref="fabRef"
      class="cui-fab"
      type="button"
      :style="fabStyle"
      @pointerdown="onFabPointerDown"
      @click="onFabClick"
    >
      <span class="fab-text">{{ collapsed ? "CUI" : "收起" }}</span>
    </button>

    <div v-if="!collapsed" class="cui-dock" :style="dockStyle">
      <div class="dock-header" @pointerdown="onDragStart">
        <div class="dock-title">CUI</div>
        <div class="dock-sub">拖拽移动 · 左侧拖拽调宽</div>
      </div>
      <div class="resize-handle" @pointerdown="onResizeStart"></div>
      <iframe ref="frameRef" class="cui-frame" :src="src" @load="onFrameLoad"></iframe>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import { initShellBridge } from "@/cui-bridge/shellBridge"
import { getCurrentTheme } from "@/shell/theme"
import type { AppContextMessage } from "@/cui-bridge/protocol"
import { protocolVersion } from "@/cui-bridge/protocol"

function getCuiSrc() {
  const mode = (process.env.ROUTER_MODE as any) || "hash"
  const base = (process.env.BASE_URL as any) || "/"
  if (mode === "history") {
    return base.replace(/\/+$/, "") + "/cui-chat"
  }
  const b = base.replace(/\/+$/, "") || ""
  return `${b}#/cui-chat`
}
const src = getCuiSrc()

const widthStorageKey = "cui_dock_width"
const posStorageKey = "cui_dock_pos"
const collapsedStorageKey = "cui_dock_collapsed"
const fabPosStorageKey = "cui_fab_pos"

const frameRef = ref<HTMLIFrameElement | null>(null)
const fabRef = ref<HTMLButtonElement | null>(null)
const width = ref<number>(getStoredWidth())
const collapsed = ref<boolean>(localStorage.getItem(collapsedStorageKey) !== "0")
const viewport = ref({ w: window.innerWidth, h: window.innerHeight })
const dockHeight = computed(() => Math.min(680, Math.max(360, viewport.value.h - 120)))
const pos = ref(getStoredPos())
const fabSize = ref({ w: 72, h: 44 })
const fabPos = ref(getStoredFabPos())

const dockStyle = computed(() => {
  const clamped = clampPos(pos.value.x, pos.value.y, width.value, dockHeight.value)
  return {
    width: `${width.value}px`,
    height: `${dockHeight.value}px`,
    left: `${clamped.x}px`,
    top: `${clamped.y}px`
  }
})

const fabStyle = computed(() => {
  const clamped = clampFabPos(fabPos.value.x, fabPos.value.y)
  return {
    left: `${clamped.x}px`,
    top: `${clamped.y}px`
  }
})

function getStoredWidth(): number {
  const raw = localStorage.getItem(widthStorageKey)
  const num = raw ? Number(raw) : 380
  if (!Number.isFinite(num)) {
    return 380
  }
  return Math.min(600, Math.max(280, num))
}

function setStoredWidth(next: number) {
  localStorage.setItem(widthStorageKey, String(next))
}

function getDefaultPos(w: number, h: number, dockW: number, dockH: number) {
  const margin = 14
  return {
    x: Math.max(margin, w - dockW - margin),
    y: Math.max(margin, h - dockH - 70)
  }
}

function getDefaultFabPos(w: number, h: number) {
  const margin = 14
  const fw = fabSize.value.w
  const fh = fabSize.value.h
  return {
    x: Math.max(margin, w - fw - margin),
    y: Math.max(margin, h - fh - margin)
  }
}

function getStoredPos(): { x: number; y: number } {
  const raw = localStorage.getItem(posStorageKey)
  if (!raw) {
    return getDefaultPos(viewport.value.w, viewport.value.h, width.value, dockHeight.value)
  }
  try {
    const parsed = JSON.parse(raw)
    const x = Number(parsed?.x)
    const y = Number(parsed?.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return getDefaultPos(viewport.value.w, viewport.value.h, width.value, dockHeight.value)
    }
    return { x, y }
  } catch {
    return getDefaultPos(viewport.value.w, viewport.value.h, width.value, dockHeight.value)
  }
}

function setStoredPos(next: { x: number; y: number }) {
  localStorage.setItem(posStorageKey, JSON.stringify(next))
}

function getStoredFabPos(): { x: number; y: number } {
  const raw = localStorage.getItem(fabPosStorageKey)
  if (!raw) {
    return getDefaultFabPos(viewport.value.w, viewport.value.h)
  }
  try {
    const parsed = JSON.parse(raw)
    const x = Number(parsed?.x)
    const y = Number(parsed?.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return getDefaultFabPos(viewport.value.w, viewport.value.h)
    }
    return { x, y }
  } catch {
    return getDefaultFabPos(viewport.value.w, viewport.value.h)
  }
}

function setStoredFabPos(next: { x: number; y: number }) {
  localStorage.setItem(fabPosStorageKey, JSON.stringify(next))
}

function clampPos(x: number, y: number, dockW: number, dockH: number) {
  const margin = 14
  const maxX = Math.max(margin, viewport.value.w - dockW - margin)
  const maxY = Math.max(margin, viewport.value.h - dockH - margin)
  return {
    x: Math.min(maxX, Math.max(margin, x)),
    y: Math.min(maxY, Math.max(margin, y))
  }
}

function clampFabPos(x: number, y: number) {
  const margin = 14
  const fw = fabSize.value.w
  const fh = fabSize.value.h
  const maxX = Math.max(margin, viewport.value.w - fw - margin)
  const maxY = Math.max(margin, viewport.value.h - fh - margin)
  return {
    x: Math.min(maxX, Math.max(margin, x)),
    y: Math.min(maxY, Math.max(margin, y))
  }
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  localStorage.setItem(collapsedStorageKey, collapsed.value ? "1" : "0")
  if (!collapsed.value) {
    if (!localStorage.getItem(posStorageKey)) {
      pos.value = getDefaultPos(viewport.value.w, viewport.value.h, width.value, dockHeight.value)
      setStoredPos(pos.value)
    }
    sendContext()
  }
}

function getCuiWindow() {
  return frameRef.value?.contentWindow ?? null
}

function sendContext() {
  const target = getCuiWindow()
  if (!target) {
    return
  }
  const message: AppContextMessage = {
    version: protocolVersion,
    type: "app.context",
    data: {
      pageId: "map",
      userId: localStorage.getItem("userId") || "anonymous",
      theme: getCurrentTheme()
    }
  }
  target.postMessage(message, "*")
}

function onFrameLoad() {
  sendContext()
}

let disposeBridge: null | (() => void) = null

onMounted(() => {
  disposeBridge = initShellBridge(getCuiWindow)
  window.addEventListener("themeChange", sendContext)
  window.addEventListener("resize", onViewportResize)
  const rect = fabRef.value?.getBoundingClientRect()
  if (rect?.width && rect?.height) {
    fabSize.value = { w: rect.width, h: rect.height }
    fabPos.value = clampFabPos(fabPos.value.x, fabPos.value.y)
    setStoredFabPos(fabPos.value)
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const r = fabRef.value?.getBoundingClientRect()
      if (!r) {
        return
      }
      const out =
        r.right < 0 ||
        r.left > viewport.value.w ||
        r.bottom < 0 ||
        r.top > viewport.value.h ||
        r.width === 0 ||
        r.height === 0
      if (out) {
        fabPos.value = getDefaultFabPos(viewport.value.w, viewport.value.h)
        setStoredFabPos(fabPos.value)
      }
    })
  })
})

onUnmounted(() => {
  disposeBridge?.()
  disposeBridge = null
  window.removeEventListener("themeChange", sendContext)
  window.removeEventListener("resize", onViewportResize)
})

let viewportRaf = 0
function onViewportResize() {
  if (viewportRaf) {
    cancelAnimationFrame(viewportRaf)
  }
  viewportRaf = requestAnimationFrame(() => {
    viewport.value = { w: window.innerWidth, h: window.innerHeight }
    pos.value = clampPos(pos.value.x, pos.value.y, width.value, dockHeight.value)
    setStoredPos(pos.value)
    fabPos.value = clampFabPos(fabPos.value.x, fabPos.value.y)
    setStoredFabPos(fabPos.value)
  })
}

let resizing = false
let startX = 0
let startWidth = 0

function onResizeStart(e: PointerEvent) {
  resizing = true
  startX = e.clientX
  startWidth = width.value
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  window.addEventListener("pointermove", onResizeMove)
  window.addEventListener("pointerup", onResizeEnd, { once: true })
}

function onResizeMove(e: PointerEvent) {
  if (!resizing) {
    return
  }
  const delta = startX - e.clientX
  const next = Math.min(600, Math.max(280, startWidth + delta))
  width.value = next
  pos.value = clampPos(pos.value.x, pos.value.y, width.value, dockHeight.value)
}

function onResizeEnd() {
  resizing = false
  setStoredWidth(width.value)
  setStoredPos(pos.value)
  window.removeEventListener("pointermove", onResizeMove)
}

let fabDragging = false
let fabDragStart = { x: 0, y: 0 }
let fabDragStartPos = { x: 0, y: 0 }
let fabDragMoved = false

function onFabPointerDown(e: PointerEvent) {
  if (e.button !== 0) {
    return
  }
  fabDragging = true
  fabDragMoved = false
  fabDragStart = { x: e.clientX, y: e.clientY }
  fabDragStartPos = { x: fabPos.value.x, y: fabPos.value.y }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  window.addEventListener("pointermove", onFabPointerMove)
  window.addEventListener("pointerup", onFabPointerUp, { once: true })
}

function onFabPointerMove(e: PointerEvent) {
  if (!fabDragging) {
    return
  }
  const dx = e.clientX - fabDragStart.x
  const dy = e.clientY - fabDragStart.y
  if (!fabDragMoved && Math.hypot(dx, dy) > 4) {
    fabDragMoved = true
  }
  const next = clampFabPos(fabDragStartPos.x + dx, fabDragStartPos.y + dy)
  fabPos.value = next
}

function onFabPointerUp() {
  fabDragging = false
  setStoredFabPos(fabPos.value)
  window.removeEventListener("pointermove", onFabPointerMove)
}

function onFabClick(e: MouseEvent) {
  if (fabDragMoved) {
    e.preventDefault()
    e.stopPropagation()
    return
  }
  toggleCollapsed()
}

let dragging = false
let dragStart = { x: 0, y: 0 }
let dragStartPos = { x: 0, y: 0 }

function onDragStart(e: PointerEvent) {
  if (e.button !== 0) {
    return
  }
  dragging = true
  dragStart = { x: e.clientX, y: e.clientY }
  dragStartPos = { x: pos.value.x, y: pos.value.y }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  window.addEventListener("pointermove", onDragMove)
  window.addEventListener("pointerup", onDragEnd, { once: true })
}

function onDragMove(e: PointerEvent) {
  if (!dragging) {
    return
  }
  const next = clampPos(
    dragStartPos.x + (e.clientX - dragStart.x),
    dragStartPos.y + (e.clientY - dragStart.y),
    width.value,
    dockHeight.value
  )
  pos.value = next
}

function onDragEnd() {
  dragging = false
  setStoredPos(pos.value)
  window.removeEventListener("pointermove", onDragMove)
}
</script>

<style scoped>
.cui-fab {
  position: fixed;
  height: 44px;
  min-width: 56px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border-light);
  background: var(--bg-elevated);
  color: var(--text-primary);
  box-shadow: var(--shadow-2);
  backdrop-filter: blur(var(--overlay-blur));
  cursor: pointer;
  z-index: 9999;
  touch-action: none;
}

.fab-text {
  font-size: 13px;
  white-space: nowrap;
}

.cui-dock {
  position: fixed;
  border-radius: 0;
  border: 1px solid var(--border-light);
  background: var(--bg-overlay);
  box-shadow: var(--shadow-2);
  overflow: hidden;
  z-index: 45;
}

.dock-header {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 10px;
  height: 40px;
  border-radius: 0;
  border: 1px solid var(--border-light);
  background: var(--bg-overlay);
  backdrop-filter: blur(var(--overlay-blur));
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  cursor: move;
  user-select: none;
  z-index: 2;
}

.dock-title {
  font-weight: 650;
  font-size: 13px;
}

.dock-sub {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 10px;
  cursor: ew-resize;
  background: transparent;
  z-index: 1;
}

.cui-frame {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 62px;
  width: 100%;
  height: calc(100% - 62px);
  border: 0;
  background: transparent;
}
</style>
