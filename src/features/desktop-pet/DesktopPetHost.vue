<template>
  <div
    ref="hostRef"
    class="desktop-pet-host"
    data-desktop-pet-host
    :class="{ 'is-dragging': dragging }"
    :style="hostStyle"
    @click="onClick"
    @pointerdown.stop="onPointerDown"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
  >
    <BoyaPet :look-x="lookX" :look-y="lookY" :mode="mode" speech="" @click="onClick" />
  </div>
  <HermesWebUiDialog :open="dialogOpen" :src="hermesWebUiUrl" @close="dialogOpen = false" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import BoyaPet from "./components/BoyaPet.vue"
import HermesWebUiDialog from "./components/HermesWebUiDialog.vue"
import { clampPetPosition, getDefaultPetPosition, type Position } from "./pet-position"

type PetMode = "idle" | "curious" | "greet" | "dragging"

const PET_SIZE = { width: 190, height: 250 }
const STORAGE_KEY = "syc.desktop-pet.position"

const hostRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
const mode = ref<PetMode>("idle")
const lookX = ref(0)
const lookY = ref(0)
const position = ref<Position>(getInitialPosition())
const dialogOpen = ref(false)
const hermesWebUiUrl = import.meta.env.VITE_HERMES_WEB_UI_URL || "http://192.168.10.15:6060/"

let dragOffset = { x: 0, y: 0 }
let dragDistance = 0
let reactionTimer: number | undefined

const hostStyle = computed(() => ({
  transform: `translate3d(${position.value.x}px, ${position.value.y}px, 0)`
}))

function viewportSize() {
  return { width: window.innerWidth, height: window.innerHeight }
}

function getInitialPosition(): Position {
  const fallback = getDefaultPetPosition(viewportSize(), PET_SIZE)
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")
    if (Number.isFinite(stored?.x) && Number.isFinite(stored?.y)) {
      return clampPetPosition(stored, viewportSize(), PET_SIZE)
    }
  } catch {
    // Ignore stale or malformed local state and use the safe default.
  }
  return fallback
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) { return }
  event.preventDefault()
  dragging.value = true
  mode.value = "dragging"
  dragDistance = 0
  dragOffset = {
    x: event.clientX - position.value.x,
    y: event.clientY - position.value.y
  }
  hostRef.value?.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (dragging.value) {
    const next = clampPetPosition(
      { x: event.clientX - dragOffset.x, y: event.clientY - dragOffset.y },
      viewportSize(),
      PET_SIZE
    )
    dragDistance += Math.abs(next.x - position.value.x) + Math.abs(next.y - position.value.y)
    position.value = next
    return
  }

  const rect = hostRef.value?.getBoundingClientRect()
  if (!rect) { return }
  lookX.value = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / 280))
  lookY.value = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / 220))
}

function onPointerUp(event: PointerEvent) {
  if (!dragging.value) { return }
  dragging.value = false
  mode.value = "idle"
  hostRef.value?.releasePointerCapture?.(event.pointerId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(position.value))
}

function onPointerEnter() {
  if (!dragging.value) { mode.value = "curious" }
}

function onPointerLeave() {
  if (!dragging.value) { mode.value = "idle" }
}

function onClick() {
  if (dragDistance > 4) { return }
  dialogOpen.value = true
  mode.value = "greet"
  if (reactionTimer) { window.clearTimeout(reactionTimer) }
  reactionTimer = window.setTimeout(() => {
    mode.value = "idle"
  }, 1300)
}

function keepInsideViewport() {
  position.value = clampPetPosition(position.value, viewportSize(), PET_SIZE)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(position.value))
}

onMounted(() => {
  window.addEventListener("pointermove", onPointerMove)
  window.addEventListener("pointerup", onPointerUp)
  window.addEventListener("pointercancel", onPointerUp)
  window.addEventListener("resize", keepInsideViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", onPointerMove)
  window.removeEventListener("pointerup", onPointerUp)
  window.removeEventListener("pointercancel", onPointerUp)
  window.removeEventListener("resize", keepInsideViewport)
  if (reactionTimer) { window.clearTimeout(reactionTimer) }
})
</script>

<style scoped>
.desktop-pet-host {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1300;
  width: 190px;
  height: 250px;
  user-select: none;
  touch-action: none;
  cursor: grab;
  contain: layout style;
  will-change: transform;
}

.desktop-pet-host.is-dragging {
  cursor: grabbing;
}

.desktop-pet-host :deep(.boya-bubble) {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .desktop-pet-host :deep(*) {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
