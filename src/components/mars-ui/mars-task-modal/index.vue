<template>
  <Teleport to="body">
    <transition name="task-popover">
      <div
        v-if="open"
        class="task-popover-layer"
        :style="{ zIndex: String(effectiveZIndex) }"
        @keydown.esc="handleEsc"
      >
        <div class="task-popover-backdrop" :style="backdropStyle" @click="onBackdropClick" @wheel.stop @touchmove.stop></div>
        <div
          class="task-popover mars-task-modal mars-popup-shell"
          :style="popoverStyle"
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          :aria-label="title || '弹窗'"
          tabindex="-1"
          @wheel.stop
        >
          <div class="task-popover-header">
            <div class="task-popover-title">{{ title }}</div>
            <div class="task-popover-actions">
              <slot name="headerRight"></slot>
            </div>
            <button v-if="closable" class="task-popover-close" type="button" @click="emitCancel" aria-label="关闭">
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div class="task-popover-body">
            <slot></slot>
          </div>
          <div v-if="footer !== false" class="task-popover-footer">
            <slot name="footer">
              <a-space>
                <a-button v-if="showCancelButton" @click="emitCancel">{{ cancelText }}</a-button>
                <a-button
                  v-if="showOkButton"
                  type="primary"
                  :danger="okType === 'danger'"
                  :loading="okLoading"
                  @click="emitOk"
                >
                  {{ okText }}
                </a-button>
              </a-space>
            </slot>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    width?: number | string
    top?: number
    closable?: boolean
    maskClosable?: boolean
    keyboard?: boolean
    zIndex?: number
    footer?: boolean
    okText?: string
    cancelText?: string
    showOkButton?: boolean
    showCancelButton?: boolean
    okLoading?: boolean
    okType?: "primary" | "danger"
  }>(),
  {
    title: "",
    width: 600,
    top: 80,
    closable: true,
    maskClosable: true,
    keyboard: true,
    footer: true,
    okText: "确定",
    cancelText: "取消",
    showOkButton: true,
    showCancelButton: true,
    okLoading: false,
    okType: "primary"
  }
)

const emit = defineEmits<{
  "update:open": [value: boolean]
  ok: []
  cancel: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const sidebarRect = ref<DOMRect | null>(null)
let sidebarObserver: ResizeObserver | null = null
let effectiveZIndex = 1200

function updateSidebarRect() {
  const el = document.querySelector(".sidebar") as HTMLElement | null
  sidebarRect.value = el?.getBoundingClientRect?.() || null
}

function installSidebarObserver() {
  if (sidebarObserver) {
    return
  }
  const el = document.querySelector(".sidebar") as HTMLElement | null
  if (el && typeof ResizeObserver !== "undefined") {
    sidebarObserver = new ResizeObserver(() => {
      updateSidebarRect()
    })
    sidebarObserver.observe(el)
  }
  window.addEventListener("resize", updateSidebarRect)
}

function uninstallSidebarObserver() {
  window.removeEventListener("resize", updateSidebarRect)
  sidebarObserver?.disconnect?.()
  sidebarObserver = null
}

const backdropStyle = computed(() => {
  const r = sidebarRect.value
  const left = r ? Math.round(r.right) : 0
  return { left: `${left}px` } as any
})

const popoverStyle = computed(() => {
  const r = sidebarRect.value
  const left = r ? Math.round(r.right) + 8 : 80
  const width = typeof props.width === "number" ? `${props.width}px` : props.width
  return {
    width,
    top: `${props.top}px`,
    left: `${left}px`,
    maxHeight: "80vh"
  } as any
})

function isAnyDropdownOpen(): boolean {
  const list = Array.from(document.querySelectorAll(".ant-dropdown")) as HTMLElement[]
  for (const el of list) {
    const style = window.getComputedStyle(el)
    if (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") {
      return true
    }
  }
  return false
}

function emitCancel() {
  emit("cancel")
  emit("update:open", false)
}

function emitOk() {
  emit("ok")
}

function onBackdropClick() {
  if (!props.maskClosable) {
    return
  }
  if (isAnyDropdownOpen()) {
    return
  }
  emitCancel()
}

function handleEsc() {
  if (!props.keyboard) {
    return
  }
  if (isAnyDropdownOpen()) {
    return
  }
  emitCancel()
}

function nextZIndex(): number {
  const w = window as any
  const base = Number(w.__mars_task_modal_z || 1200)
  const next = Math.max(1200, base + 1)
  w.__mars_task_modal_z = next
  return next
}

watch(
  () => props.open,
  (v) => {
    if (typeof window === "undefined") {
      return
    }
    if (v) {
      effectiveZIndex = Number.isFinite(Number(props.zIndex)) ? Number(props.zIndex) : nextZIndex()
      nextTick(() => {
        panelRef.value?.focus?.()
      })
    }
  },
  { immediate: true }
)

onMounted(() => {
  updateSidebarRect()
  installSidebarObserver()
})

onUnmounted(() => {
  uninstallSidebarObserver()
})
</script>

<script lang="ts">
export default {
  name: "mars-task-modal"
}
</script>

<style scoped>
.task-popover-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.task-popover-backdrop {
  position: absolute;
  inset: 0;
  background: transparent;
  pointer-events: auto;
}

.task-popover {
  position: absolute;
  display: flex;
  flex-direction: column;
  background: var(--task-popover-bg, var(--popup-surface));
  border: 1px solid var(--popup-border);
  border-radius: var(--popup-radius);
  box-shadow: var(--popup-shadow);
  overflow: hidden;
  pointer-events: auto;
  color: var(--text-primary);
  backdrop-filter: blur(var(--popup-blur));
  font-family: var(--mars-font-family, inherit);
}

.task-popover:focus {
  outline: none;
}

.task-popover-header {
  min-height: var(--popup-header-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: var(--popup-header-padding);
  border-bottom: 1px solid var(--popup-border);
  user-select: none;
  gap: 8px;
}

.task-popover-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--popup-title-font-size);
  font-weight: var(--popup-title-font-weight);
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-popover-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-popover-close {
  margin-left: 0;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  font-size: 18px;
  line-height: 1;
}

.task-popover-body {
  padding: var(--popup-body-padding);
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.task-popover-footer {
  flex-shrink: 0;
  min-height: var(--popup-footer-height);
  padding: var(--popup-footer-padding);
  border-top: 1px solid var(--popup-border);
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.task-popover-enter-active {
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}

.task-popover-leave-active {
  transition: opacity 250ms ease-in, transform 250ms ease-in;
}

.task-popover-enter-from,
.task-popover-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>
