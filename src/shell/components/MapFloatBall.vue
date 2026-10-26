<template>
  <teleport to="body">
    <button
      ref="ballRef"
      type="button"
      class="map-float-ball"
      :class="{ 'is-dragging': dragging, 'is-open': drawerOpen, 'has-running-tasks': runningCount > 0 }"
      :style="ballStyle"
      :aria-expanded="drawerOpen"
      aria-controls="task-center-drawer"
      aria-label="任务中心气泡"
      title="任务中心"
      @pointerdown="onPointerDown"
    >
      <span class="ball-core" aria-hidden="true">
        <span class="ball-core__ring"></span>
        <span class="ball-core__bars"></span>
      </span>
      <span v-if="runningCount" class="map-float-ball__badge" aria-hidden="true">{{ runningCount }}</span>
      <span class="sr-only">{{ runningCount ? `${runningCount} 个任务进行中` : "当前无运行任务" }}</span>
    </button>

    <aside
      v-if="drawerOpen"
      id="task-center-drawer"
      class="task-center-drawer"
      :style="drawerStyle"
      aria-label="任务中心"
    >
      <header class="task-center-drawer__header">
        <div class="task-center-drawer__heading">
          <p class="task-center-drawer__eyebrow">Task Center</p>
          <h3>任务中心</h3>
        </div>
        <button type="button" class="task-center-drawer__close" aria-label="关闭任务中心" @click="drawerOpen = false">×</button>
      </header>
      <div class="task-center-summary">
        <div class="task-center-summary__signal" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div>
          <strong>{{ runningCount }} 个任务进行中</strong>
          <p>{{ queuedTasks.length }} 个排队 · {{ failedCount }} 个需要关注</p>
        </div>
        <span class="task-center-summary__updated">刚刚更新</span>
      </div>

      <div class="task-center-drawer__body">
        <section class="task-section" aria-labelledby="running-task-title">
          <div class="task-section__title-row">
            <h4 id="running-task-title"><span class="status-dot is-running"></span>正在运行</h4>
            <span>{{ runningCount }}</span>
          </div>

          <article v-for="task in runningTasks" :key="task.id" class="task-running-card">
            <div class="task-running-card__top">
              <span class="task-kind" :class="`is-${task.kind}`">{{ task.kindLabel }}</span>
              <span class="task-running-card__time">{{ task.startedAt }}</span>
            </div>
            <h5>{{ task.name }}</h5>
            <div class="task-running-card__stage">
              <span>{{ task.stage }}</span>
              <strong>{{ task.progress }}%</strong>
            </div>
            <div
              class="task-progress-track"
              role="progressbar"
              :aria-label="`${task.name}进度`"
              :aria-valuenow="task.progress"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <span :style="{ width: `${task.progress}%` }"></span>
            </div>
            <div class="task-running-card__footer">
              <span class="live-indicator"><i></i>状态更新中</span>
              <span>预计剩余 {{ task.remaining }}</span>
            </div>
          </article>
        </section>

        <section class="task-section task-queued" aria-labelledby="queued-task-title">
          <div class="task-section__title-row">
            <h4 id="queued-task-title"><span class="status-dot is-queued"></span>{{ queuedTasks.length }} 个任务排队中</h4>
          </div>
          <div v-for="task in queuedTasks" :key="task.id" class="queued-task-row">
            <span class="task-kind" :class="`is-${task.kind}`">{{ task.kindLabel }}</span>
            <span class="queued-task-row__name">{{ task.name }}</span>
            <span class="queued-task-row__status">等待资源</span>
          </div>
        </section>

        <section class="task-section" aria-labelledby="recent-task-title">
          <div class="task-section__title-row">
            <h4 id="recent-task-title">最近任务</h4>
            <span>最近 24 小时</span>
          </div>
          <div class="recent-task-list">
            <div v-for="task in recentTasks" :key="task.id" class="recent-task-row">
              <span class="recent-task-row__icon" :class="`is-${task.status}`" aria-hidden="true">
                {{ task.status === "success" ? "✓" : "!" }}
              </span>
              <div class="recent-task-row__content">
                <strong>{{ task.name }}</strong>
                <span>{{ task.kindLabel }} · {{ task.stage }}</span>
              </div>
              <time>{{ task.finishedAt }}</time>
            </div>
          </div>
        </section>
      </div>
      <footer class="task-center-drawer__footer">
        <span class="placeholder-dot"></span>
        演示数据 · 任务服务暂未接入
      </footer>
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

const runningTasks = [
  {
    id: "demo-generate-1",
    kind: "generate",
    kindLabel: "生成任务",
    name: "震后灾损专题图",
    stage: "正在渲染图层",
    progress: 72,
    remaining: "1 分钟",
    startedAt: "14:28 开始"
  },
  {
    id: "demo-publish-1",
    kind: "publish",
    kindLabel: "发布任务",
    name: "全国影像瓦片服务",
    stage: "正在生成瓦片",
    progress: 41,
    remaining: "4 分钟",
    startedAt: "14:26 开始"
  }
] as const

const queuedTasks = [
  { id: "demo-export-queued", kind: "export", kindLabel: "导出任务", name: "区域变化分析报告" }
] as const

const recentTasks = [
  { id: "demo-recent-1", status: "success", kindLabel: "导出任务", name: "遥感分析报告", stage: "导出完成", finishedAt: "2 分钟前" },
  { id: "demo-recent-2", status: "success", kindLabel: "生成任务", name: "土地覆盖专题图", stage: "生成完成", finishedAt: "8 分钟前" },
  { id: "demo-recent-3", status: "failed", kindLabel: "发布任务", name: "WMS 影像服务", stage: "发布失败", finishedAt: "12 分钟前" }
] as const

const runningCount = runningTasks.length
const failedCount = recentTasks.filter((task) => task.status === "failed").length

const ballStyle = computed(() => {
  const clamped = clampPos(pos.value.x, pos.value.y)
  return {
    left: `${clamped.x}px`,
    top: `${clamped.y}px`
  }
})

const drawerStyle = computed(() => {
  const clamped = clampPos(pos.value.x, pos.value.y)
  const drawerWidth = Math.min(376, Math.max(0, viewport.value.w - MARGIN * 2))
  const drawerHeight = 560
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
  background: linear-gradient(145deg, #42a5ff 0%, var(--color-primary, #2d8cf0) 52%, #176dcc 100%);
  box-shadow: 0 8px 24px rgba(45, 140, 240, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.26);
  transition: box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease;
}

.map-float-ball:hover {
  transform: scale(1.04);
  background: var(--color-primary, #2d8cf0);
  box-shadow: 0 8px 20px rgba(45, 140, 240, 0.5);
}

.ball-core {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.ball-core__ring {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.94);
  border-right-color: rgba(255, 255, 255, 0.34);
  border-radius: 50%;
  transform: rotate(-36deg);
}

.ball-core__bars {
  position: relative;
  width: 14px;
  height: 13px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.9);
}

.ball-core__bars::before,
.ball-core__bars::after {
  content: "";
  position: absolute;
  bottom: 2px;
  width: 3px;
  border-radius: 3px 3px 1px 1px;
  background: #ffffff;
}

.ball-core__bars::before {
  left: 2px;
  height: 6px;
  box-shadow: 5px -4px 0 #ffffff, 10px -8px 0 #ffffff;
}

.map-float-ball__badge {
  position: absolute;
  top: -5px;
  right: -4px;
  display: grid;
  place-items: center;
  min-width: 21px;
  height: 21px;
  padding: 0 5px;
  border: 2px solid #17243a;
  border-radius: 999px;
  background: #ff5964;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 4px 10px rgba(255, 89, 100, 0.4);
}

.map-float-ball.has-running-tasks:not(.is-open):not(.is-dragging)::before {
  content: "";
  position: absolute;
  inset: -6px;
  border: 1px solid rgba(74, 169, 255, 0.5);
  border-radius: inherit;
  animation: task-bubble-pulse 2.2s ease-out infinite;
}

@keyframes task-bubble-pulse {
  0% { opacity: 0.72; transform: scale(0.9); }
  72%, 100% { opacity: 0; transform: scale(1.24); }
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
  width: min(376px, calc(100vw - 32px));
  max-height: min(620px, calc(100vh - 32px));
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 18px;
  background: linear-gradient(160deg, rgba(28, 44, 70, 0.96), rgba(17, 29, 49, 0.96));
  box-shadow: 0 24px 64px rgba(4, 12, 27, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(18px);
  display: flex;
  flex-direction: column;
}

.task-center-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.task-center-drawer__eyebrow {
  margin: 0 0 2px;
  color: #75bfff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
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

.task-center-drawer__close:hover {
  background: rgba(255, 255, 255, 0.16);
}

.task-center-summary {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  gap: 11px;
  align-items: center;
  margin: 14px 14px 0;
  padding: 13px 14px;
  border: 1px solid rgba(92, 173, 255, 0.24);
  border-radius: 15px;
  background: linear-gradient(135deg, rgba(45, 140, 240, 0.2), rgba(45, 140, 240, 0.08));
}

.task-center-summary__signal {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  padding-bottom: 10px;
  background: rgba(45, 140, 240, 0.28);
}

.task-center-summary__signal span {
  display: block;
  width: 3px;
  border-radius: 3px;
  background: #75bfff;
  animation: task-signal 1.1s ease-in-out infinite alternate;
}

.task-center-summary__signal span:nth-child(1) { height: 7px; }
.task-center-summary__signal span:nth-child(2) { height: 13px; animation-delay: 0.18s; }
.task-center-summary__signal span:nth-child(3) { height: 10px; animation-delay: 0.36s; }

@keyframes task-signal {
  from { opacity: 0.45; transform: scaleY(0.7); }
  to { opacity: 1; transform: scaleY(1); }
}

.task-center-summary strong {
  display: block;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
}

.task-center-summary p {
  margin: 3px 0 0;
  color: rgba(255, 255, 255, 0.68);
  font-size: 11px;
}

.task-center-summary__updated {
  color: rgba(255, 255, 255, 0.58);
  font-size: 11px;
  white-space: nowrap;
}

.task-center-drawer__body {
  display: grid;
  gap: 18px;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 14px 14px;
  scrollbar-width: thin;
  scrollbar-color: rgba(117, 191, 255, 0.35) transparent;
}

.task-section {
  display: grid;
  gap: 9px;
}

.task-section__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 20px;
}

.task-section__title-row h4 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  font-weight: 600;
}

.task-section__title-row > span {
  color: rgba(255, 255, 255, 0.42);
  font-size: 11px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-dot.is-running {
  background: #4aa9ff;
  box-shadow: 0 0 0 4px rgba(74, 169, 255, 0.12);
}

.status-dot.is-queued {
  background: #aab7c8;
}

.task-running-card {
  padding: 13px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.055);
}

.task-running-card__top,
.task-running-card__stage,
.task-running-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.task-kind {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
}

.task-kind.is-generate { color: #8fcbff; background: rgba(45, 140, 240, 0.16); }
.task-kind.is-publish { color: #b6a5ff; background: rgba(130, 105, 255, 0.16); }
.task-kind.is-export { color: #78dfc5; background: rgba(49, 190, 155, 0.14); }

.task-running-card__time {
  color: rgba(255, 255, 255, 0.42);
  font-size: 10px;
}

.task-running-card h5 {
  margin: 9px 0 11px;
  overflow: hidden;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-running-card__stage {
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
}

.task-running-card__stage strong {
  color: #8fcbff;
  font-size: 12px;
}

.task-progress-track {
  position: relative;
  height: 6px;
  margin: 7px 0 9px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.09);
}

.task-progress-track > span {
  position: relative;
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2d8cf0, #70c5ff);
  box-shadow: 0 0 10px rgba(74, 169, 255, 0.4);
}

.task-progress-track > span::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.42), transparent);
  transform: translateX(-100%);
  animation: task-progress-shimmer 2.1s ease-in-out infinite;
}

@keyframes task-progress-shimmer {
  to { transform: translateX(100%); }
}

.task-running-card__footer {
  color: rgba(255, 255, 255, 0.46);
  font-size: 10px;
}

.live-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.live-indicator i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #4aa9ff;
  box-shadow: 0 0 0 3px rgba(74, 169, 255, 0.12);
}

.task-queued {
  padding-top: 2px;
}

.queued-task-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  padding: 9px 10px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.025);
}

.queued-task-row__name {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.76);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queued-task-row__status {
  color: rgba(255, 255, 255, 0.38);
  font-size: 10px;
}

.recent-task-list {
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.035);
}

.recent-task-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  padding: 10px 11px;
}

.recent-task-row + .recent-task-row {
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.recent-task-row__icon {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
}

.recent-task-row__icon.is-success { color: #72dfb7; background: rgba(52, 199, 143, 0.13); }
.recent-task-row__icon.is-failed { color: #ff8992; background: rgba(255, 89, 100, 0.13); }

.recent-task-row__content {
  min-width: 0;
}

.recent-task-row__content strong,
.recent-task-row__content span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-task-row__content strong {
  color: rgba(255, 255, 255, 0.88);
  font-size: 11px;
  font-weight: 500;
}

.recent-task-row__content span,
.recent-task-row time {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 9px;
}

.recent-task-row time {
  margin-top: 0;
  white-space: nowrap;
}

.task-center-drawer__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.34);
  font-size: 12px;
}

.placeholder-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.32);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .map-float-ball.has-running-tasks::before,
  .task-center-summary__signal span,
  .task-progress-track > span::after {
    animation: none;
  }
}
</style>
