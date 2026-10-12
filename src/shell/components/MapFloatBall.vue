<template>
  <teleport to="body">
    <button
      ref="ballRef"
      type="button"
      class="map-float-ball"
      :class="{ 'is-dragging': dragging, 'is-open': drawerOpen }"
      :style="ballStyle"
      :aria-expanded="drawerOpen"
      aria-controls="task-center-drawer"
      aria-label="任务中心气泡"
      title="任务中心"
      @pointerdown="onPointerDown"
    >
      <span class="ball-core" aria-hidden="true"></span>
    </button>

    <aside
      v-if="drawerOpen"
      id="task-center-drawer"
      class="task-center-drawer"
      :style="drawerStyle"
      aria-label="任务中心"
    >
      <header class="task-center-drawer__header">
        <div>
          <p class="task-center-drawer__eyebrow">Task Center</p>
          <h3>任务中心</h3>
        </div>
        <button type="button" class="task-center-drawer__close" aria-label="关闭任务中心" @click="drawerOpen = false">×</button>
      </header>
      <div class="task-center-drawer__body">
        <section v-for="item in taskGroups" :key="item.key" class="task-progress-card">
          <span class="task-progress-card__dot"></span>
          <div>
            <h4>{{ item.title }}</h4>
            <p>{{ item.desc }}</p>
          </div>
          <span class="task-progress-card__status">待接入</span>
        </section>
      </div>
    </aside>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"

const SIZE = 52
const MARGIN = 16
const STORAGE_KEY = "map_float_ball_pos_v1"

const ballRef = ref<HTMLButtonElement | null>(null)
const viewport = ref({ w: window.innerWidth, h: window.innerHeight })
const pos = ref(getStoredPos())
const dragging = ref(false)
const drawerOpen = ref(false)

const taskGroups = [
  { key: "generate", title: "生成任务", desc: "实时追踪生成任务进度" },
  { key: "publish", title: "发布任务", desc: "实时追踪发布任务进度" },
  { key: "export", title: "导出任务", desc: "实时追踪导出任务进度" }
] as const

const ballStyle = computed(() => {
  const clamped = clampPos(pos.value.x, pos.value.y)
  return {
    left: `${clamped.x}px`,
    top: `${clamped.y}px`
  }
})

const drawerStyle = computed(() => {
  const clamped = clampPos(pos.value.x, pos.value.y)
  const drawerWidth = 320
  const drawerHeight = 320
  const gap = 12
  const rightSideLeft = clamped.x + SIZE + gap
  const leftSideLeft = clamped.x - drawerWidth - gap
  const left = rightSideLeft + drawerWidth + MARGIN <= viewport.value.w ? rightSideLeft : Math.max(MARGIN, leftSideLeft)
  const top = Math.min(Math.max(MARGIN, clamped.y - 12), Math.max(MARGIN, viewport.value.h - drawerHeight - MARGIN))
  return {
    left: `${left}px`,
    top: `${top}px`
  }
})

function getDefaultPos(w: number, h: number) {
  return {
    x: Math.max(MARGIN, w - SIZE - MARGIN - 80),
    y: Math.max(MARGIN, h - SIZE - MARGIN - 120)
  }
}

function getStoredPos(): { x: number; y: number } {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return getDefaultPos(viewport.value.w, viewport.value.h)
  }
  try {
    const parsed = JSON.parse(raw)
    const x = Number(parsed?.x)
    const y = Number(parsed?.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return getDefaultPos(viewport.value.w, viewport.value.h)
    }
    return { x, y }
  } catch {
    return getDefaultPos(viewport.value.w, viewport.value.h)
  }
}

function setStoredPos(next: { x: number; y: number }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

function clampPos(x: number, y: number) {
  const maxX = Math.max(MARGIN, viewport.value.w - SIZE - MARGIN)
  const maxY = Math.max(MARGIN, viewport.value.h - SIZE - MARGIN)
  return {
    x: Math.min(maxX, Math.max(MARGIN, x)),
    y: Math.min(maxY, Math.max(MARGIN, y))
  }
}

let dragStart = { x: 0, y: 0 }
let dragStartPos = { x: 0, y: 0 }
let moved = false

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) {
    return
  }
  e.preventDefault()
  dragging.value = true
  moved = false
  dragStart = { x: e.clientX, y: e.clientY }
  dragStartPos = { ...clampPos(pos.value.x, pos.value.y) }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  window.addEventListener("pointermove", onPointerMove)
  window.addEventListener("pointerup", onPointerUp, { once: true })
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) {
    return
  }
  const dx = e.clientX - dragStart.x
  const dy = e.clientY - dragStart.y
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    moved = true
  }
  pos.value = clampPos(dragStartPos.x + dx, dragStartPos.y + dy)
}

function onPointerUp() {
  dragging.value = false
  window.removeEventListener("pointermove", onPointerMove)
  if (moved) {
    const next = clampPos(pos.value.x, pos.value.y)
    pos.value = next
    setStoredPos(next)
    return
  }
  drawerOpen.value = !drawerOpen.value
}

let resizeRaf = 0
function onViewportResize() {
  if (resizeRaf) {
    cancelAnimationFrame(resizeRaf)
  }
  resizeRaf = requestAnimationFrame(() => {
    viewport.value = { w: window.innerWidth, h: window.innerHeight }
    pos.value = clampPos(pos.value.x, pos.value.y)
    setStoredPos(pos.value)
  })
}

onMounted(() => {
  window.addEventListener("resize", onViewportResize)
  pos.value = clampPos(pos.value.x, pos.value.y)
})

onUnmounted(() => {
  window.removeEventListener("resize", onViewportResize)
  window.removeEventListener("pointermove", onPointerMove)
  if (resizeRaf) {
    cancelAnimationFrame(resizeRaf)
  }
})
</script>

<style scoped>
.map-float-ball {
  position: fixed;
  z-index: 1200;
  width: 52px;
  height: 52px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 999px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  background: var(--color-primary, #2d8cf0);
  box-shadow: 0 6px 16px rgba(45, 140, 240, 0.4);
  transition: box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease;
}

.map-float-ball:hover {
  transform: scale(1.04);
  background: var(--color-primary, #2d8cf0);
  box-shadow: 0 8px 20px rgba(45, 140, 240, 0.5);
}

.ball-core {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow:
    -9px -9px 0 rgba(255, 255, 255, 0.74),
    9px -9px 0 rgba(255, 255, 255, 0.62),
    -9px 9px 0 rgba(255, 255, 255, 0.62),
    9px 9px 0 rgba(255, 255, 255, 0.74);
}

.map-float-ball:focus-visible {
  outline: 2px solid rgba(147, 197, 253, 0.95);
  outline-offset: 3px;
}

.map-float-ball.is-dragging {
  cursor: grabbing;
  transform: scale(1.06);
  transition: none;
}

.map-float-ball.is-open {
  box-shadow: 0 10px 24px rgba(45, 140, 240, 0.52);
}

.task-center-drawer {
  position: fixed;
  z-index: 1199;
  width: 320px;
  min-height: 280px;
  max-height: min(420px, calc(100vh - 32px));
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 18px;
  background: rgba(23, 35, 61, 0.82);
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.2);
  backdrop-filter: blur(14px);
}

.task-center-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.task-center-drawer__eyebrow {
  margin: 0 0 2px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 12px;
}

.task-center-drawer__header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
}

.task-center-drawer__close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  cursor: pointer;
}

.task-center-drawer__body {
  display: grid;
  gap: 10px;
  padding: 14px;
}

.task-progress-card {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.07);
}

.task-progress-card__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--color-primary, #2d8cf0);
}

.task-progress-card h4 {
  margin: 0 0 4px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
}

.task-progress-card p {
  margin: 0;
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  line-height: 18px;
}

.task-progress-card__status {
  color: rgba(255, 255, 255, 0.58);
  font-size: 12px;
}
</style>
