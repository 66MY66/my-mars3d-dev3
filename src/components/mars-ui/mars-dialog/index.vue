<template>
  <teleport :to="mergeProps.warpper">
    <div class="mars-dialog-thumb" v-show="isFold && show" ref="thumbnailRef" @click="toogleFold(false)">
      <mars-icon :icon="mergeProps.thumbnail.icon" :width="20" color="#FFFFFF"></mars-icon>
    </div>
    <div
      class="mars-dialog mars-popup-shell"
      :class="[customClass, animationClass]"
      :style="{ ...initialPositionStyle, ...(shouldDisplayDialog && !animationReady ? { opacity: 0 } : {}) }"
      ref="dialogRef"
      v-show="shouldDisplayDialog"
      :role="a11y.role('dialog')"
      :aria-modal="a11y.ariaModal()"
      :tabindex="a11y.tabIndex(-1)"
      @mousedown="bringToFront"
    >
      <div
        v-if="showHeader"
        class="mars-dialog__header"
        :style="{ cursor: mergeProps.draggable ? 'move' : 'auto' }"
        @mousedown="handleHeaderMouseDown"
      >
        <mars-icon v-if="mergeProps.icon" :icon="mergeProps.icon" :width="18" color="#41A8FF" class="icon"></mars-icon>
        <slot v-else-if="slots.icon" name="icon"></slot>
        <slot v-if="slots.title" name="title"></slot>
        <span v-else class="title">{{ mergeProps.title }}</span>
        
        <span v-if="slots.headerRight" class="mars-dialog__header-right" @mousedown.stop @click.stop>
          <slot name="headerRight"></slot>
        </span>

        <button
          v-if="mergeProps.closeable && mergeProps.closeButton"
          ref="closeBtnRef"
          type="button"
          class="close-btn"
          :aria-label="a11y.ariaLabel('关闭')"
          @click="close"
        >
          <mars-icon icon="close" :width="16"></mars-icon>
        </button>
      </div>

      <button
        v-else-if="mergeProps.closeable && mergeProps.closeButton"
        type="button"
        class="close-btn__flot"
        :aria-label="a11y.ariaLabel('关闭')"
        @click="close"
      >
        <mars-icon icon="close-one" :width="18"></mars-icon>
      </button>

      <div class="mars-dialog__content" :style="getContentStyle()">
        <slot></slot>
      </div>

      <div v-if="slots.leftBar" class="mars-dialog_leftbar">
        <slot name="leftBar"></slot>
      </div>

      <div v-if="slots.footer" class="mars-dialog__footer">
        <slot name="footer"></slot>
      </div>

      <div
        v-for="handle in actualHandles"
        :key="handle"
        class="mars-dialog__handle"
        :class="['handle-' + handle]"
        @mousedown="resizeStart(handle, $event)"
      ></div>
    </div>
  </teleport>
</template>

<script lang="ts" setup>
/**
 * dialog弹框
 * @copyright 火星科技 mars3d.cn
 * @author 火星渣渣灰 2022-02-19
 */
import { logWarn } from "@mars/utils/mars-util"
import { computed, onMounted, onUnmounted, ref, useSlots, nextTick, watch } from "vue"
import { useA11yService } from "@/utils/a11y/service"

const globalConfig: Record<string, any> = {}
let globalZIndex = 900

interface Position {
  left?: number | string // 定位 left值
  right?: number | string // 定位right值
  top?: number | string // 定位top值
  bottom?: number | string // 定位bottom值
}

interface Props {
  warpper?: string // 容器id 默认是app，将作为定位的参照元素，一般不需要修改
  title?: string // 弹框标题
  visible?: boolean // 是否启用
  show?: boolean // 弹窗是否默认显示

  draggable?: boolean // 是否可拖拽

  closeable?: boolean // 是否可关闭
  closeButton?: boolean // 是否显示关闭按钮

  animation?: string | boolean // 是否开启开场动画，或开场动画的class名

  width?: number | string // 初始宽度
  height?: number | string // 初始高度

  left?: number | string // 定位 left值
  right?: number | string // 定位right值
  top?: number | string // 定位top值
  bottom?: number | string // 定位bottom值
  nopadding?: boolean // 是否存在 padding 值
  position?: Position // 统一设置位置属性，优先级高于 left right top bottom

  handles?: boolean | string | string[] // 缩放控制器
  minWidth?: number // 最小宽度
  minHeight?: number // 最小高度
  maxWidth?: number // 最大宽度
  maxHeight?: number // 最大高度
  zIndex?: number // 层级

  icon?: string

  customClass?: string // 自定义class

  defaultFold?: boolean // 是否折叠
  thumbnail?: {
    left?: number | string // 定位 left值
    right?: number | string // 定位right值
    top?: number | string // 定位top值
    bottom?: number | string // 定位bottom值
    icon?: string
  } // 折叠状态下的配置

  beforeClose?: () => Promise<any> | boolean | void
  persistLayout?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  show: true,
  nopadding: false,
  closeable: false,
  closeButton: true,
  draggable: true,
  animation: true,
  handles: false,
  defaultFold: false,
  persistLayout: true,
  minWidth: 100,
  minHeight: 100,
  maxWidth: window.innerWidth,
  maxHeight: window.innerHeight,
  zIndex: 900
})

const emits = defineEmits(["update:visible", "resize", "move", "closed", "fold"])

const slots = useSlots()
const a11y = useA11yService()

const mergeProps = computed(() => {
  const newProps: Record<string, any> = {}

  for (const k in props) {
    if (props[k] === undefined) {
      newProps[k] = globalConfig[k]
    } else {
      newProps[k] = props[k]
    }
  }

  if (!props.warpper) {
    newProps.warpper = globalConfig.warpper || "#mars-main-view"
  }

  if (newProps.position) {
    newProps.left = newProps.position.left
    newProps.right = newProps.position.right
    newProps.top = newProps.position.top
    newProps.bottom = newProps.position.bottom
  }

  // 缩略图
  newProps.thumbnail = newProps.thumbnail ?? {}
  newProps.thumbnail.left = newProps.thumbnail.left ?? newProps.left ?? 10
  newProps.thumbnail.right = newProps.thumbnail.right ?? newProps.right
  newProps.thumbnail.top = newProps.thumbnail.top ?? newProps.top ?? 10
  newProps.thumbnail.bottom = newProps.thumbnail.bottom ?? newProps.bottom
  newProps.thumbnail.icon = newProps.thumbnail.icon ?? newProps.icon ?? "left-expand"

  if (!isAllowValue(newProps.left) && !isAllowValue(newProps.right)) {
    // left right 都不存在时默认出现在左侧
    newProps.right = 10
  }
  if (!isAllowValue(newProps.top) && !isAllowValue(newProps.bottom)) {
    // top bottom 都不存在时默认出现在顶部
    newProps.top = 10
  }

  if (isAllowValue(newProps.closeable) && (slots.title || isAllowValue(newProps.title) || isAllowValue(newProps.icon))) {
    newProps.closeable = true
  }

  if (newProps.draggable && props.handles === false) {
    newProps.handles = true
  }

  return newProps
})

const showHeader = computed(() => slots.title || isAllowValue(mergeProps.value.icon) || isAllowValue(mergeProps.value.title))

function appendHorizontalAnchorStyle(style: Record<string, string>, p: Record<string, any>) {
  if (isAllowValue(p.left)) {
    style.left = autoUnit(p.left)
    style.right = "auto"
  } else if (isAllowValue(p.right)) {
    style.right = autoUnit(p.right)
    style.left = "auto"
  }
}

function appendVerticalAnchorStyle(style: Record<string, string>, p: Record<string, any>) {
  if (isAllowValue(p.top)) {
    style.top = autoUnit(p.top)
    style.bottom = "auto"
  } else if (isAllowValue(p.bottom)) {
    style.bottom = autoUnit(p.bottom)
    style.top = "auto"
  }
}

function appendUserLayoutStyle(style: Record<string, string>) {
  const layout = userLayout.value
  if (!layout) {
    return
  }
  if (layout.width !== undefined) {
    style.width = autoUnit(layout.width)
  }
  if (layout.height !== undefined) {
    style.height = autoUnit(layout.height)
  }
  if (layout.left !== undefined) {
    style.left = autoUnit(layout.left)
    style.right = "auto"
  }
  if (layout.top !== undefined) {
    style.top = autoUnit(layout.top)
    style.bottom = "auto"
  }
}

// 计算初始位置样式，直接绑定到模板避免跳动
const initialPositionStyle = computed(() => {
  const style: Record<string, string> = {}
  const p = mergeProps.value
  const isDocked = !mergeProps.value.draggable

  if (!hasUserSet.value) {
    appendHorizontalAnchorStyle(style, p)
    appendVerticalAnchorStyle(style, p)

    if (isAllowValue(p.width)) {
      style.width = autoUnit(p.width)
    }
    if (isAllowValue(p.height)) {
      style.height = autoUnit(p.height)
    }
  } else {
    appendUserLayoutStyle(style)
    if (isDocked) {
      appendHorizontalAnchorStyle(style, p)
      appendVerticalAnchorStyle(style, p)
    }
  }

  return style
})

const getContentStyle = () => {
  const style: any = {}
  const headerHeight = "var(--popup-header-height, 44px)"
  style.height = "100%"

  if (showHeader.value && slots.footer) {
    style.height = `calc(100% - calc(${headerHeight} * 2))`
    style.borderTopLeftRadius = "0 !important"
    style.borderTopRightRadius = "0 !important"
    style.borderBottomLeftRadius = "0 !important"
    style.borderBottomRightRadius = "0 !important"
    style.paddingBottom = 0
  } else if (showHeader.value) {
    style.height = `calc(100% - ${headerHeight})`
    style.borderTopLeftRadius = "0 !important"
    style.borderTopRightRadius = "0 !important"
  } else if (slots.footer) {
    style.height = `calc(100% - ${headerHeight})`
    style.borderBottomLeftRadius = "0 !important"
    style.borderBottomRightRadius = "0 !important"
  }

  if (mergeProps.value.nopadding) {
    style.padding = "0 !important"
  }
  return style
}

const dialogRef = ref()
const thumbnailRef = ref()
let warpperEle = null

const closeBtnRef = ref<HTMLButtonElement | null>(null)
const lastActiveElement = ref<HTMLElement | null>(null)
const dialogVisible = ref(Boolean(props.visible))
const activeAnimationClass = ref("")
let animationTimer: number | null = null
let getDialogAnimationState = () => ({
  isFold: false,
  animationReady: false,
  animationClass: ""
})

// #region debug-point popup-transition-flash
function reportDialogDebug(event: string, extra: Record<string, unknown> = {}) {
  if (typeof window === "undefined") {
    return
  }
  const state = getDialogAnimationState()
  window.dispatchEvent(
    new CustomEvent("mars3d:dialog-animation-debug", {
      detail: {
        event,
        ts: Date.now(),
        title: mergeProps.value.title ?? "",
        visible: props.visible,
        show: props.show,
        isFold: state.isFold,
        animation: mergeProps.value.animation,
        animationReady: state.animationReady,
        animationClass: state.animationClass,
        ...extra
      }
    })
  )
}
// #endregion debug-point popup-transition-flash

watch(
  () => props.visible,
  async (v, prev) => {
    try {
      reportDialogDebug("visible-change", { prev, next: v })
      if (v) {
        clearAnimationTimer()
        dialogVisible.value = true
        activeAnimationClass.value = ""
        animationReady.value = false
        lastActiveElement.value = document.activeElement as HTMLElement | null
        // 弹窗打开时，重新初始化位置（如果之前是隐藏的）
        if (dialogRef.value && !isFold.value) {
          // 等待 v-show 生效
          await nextTick()

          // 检查是否需要重新初始化位置
          // prev 为 undefined 表示首次 immediate 执行，不需要重复初始化
          // prev 为 false 表示从隐藏变为显示，需要重新初始化
          if (prev === false) {
            if (mergeProps.value.persistLayout === false) {
              resetInlineLayout()
            }
            initDialog(true)
          }

          // 使用 requestAnimationFrame 确保定位稳定后再应用动画
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              animationReady.value = true
              activeAnimationClass.value = enterAnimationClass.value
              reportDialogDebug("enter-scheduled", { animationClass: activeAnimationClass.value })
            })
          })
        }
        await nextTick()
        requestAnimationFrame(() => {
          closeBtnRef.value?.focus?.()
        })
        return
      }
      if (!dialogVisible.value) {
        restoreFocus()
        return
      }
      if (!isFold.value && leaveAnimationClass.value) {
        activeAnimationClass.value = leaveAnimationClass.value
        reportDialogDebug("leave-scheduled", { animationClass: activeAnimationClass.value })
        clearAnimationTimer()
        animationTimer = window.setTimeout(() => {
          finishLeaveAnimation()
        }, 260)
      } else {
        finishLeaveAnimation()
      }
    } catch {
      // 忽略组件卸载过程中的错误
    }
  },
  { flush: "post", immediate: true }
)

function restoreFocus() {
  const target = lastActiveElement.value
  lastActiveElement.value = null
  if (!target) {
    return
  }
  window.setTimeout(() => {
    try {
      target.focus?.()
    } catch {
      // 元素可能已从 DOM 移除，忽略错误
    }
  }, 0)
}

function clearAnimationTimer() {
  if (animationTimer) {
    window.clearTimeout(animationTimer)
    animationTimer = null
  }
}

function finishLeaveAnimation() {
  clearAnimationTimer()
  dialogVisible.value = false
  activeAnimationClass.value = ""
  animationReady.value = false
  reportDialogDebug("leave-finished")
  restoreFocus()
}

let observeDialog = false
const hasUserSet = ref(false)
const heightAnchored = ref(false)
/** 用户拖拽/缩放后的布局，避免 :style 解绑时被 Vue 清掉 */
const userLayout = ref<{ width?: number; height?: number; left?: number; top?: number } | null>(null)
const shouldDisplayDialog = computed(() => dialogVisible.value && !isFold.value && props.show)

const PERSIST_TTL_MS = 7 * 24 * 60 * 60 * 1000
let persistTimer: number | null = null

function canPersist(): boolean {
  return mergeProps.value.persistLayout !== false && !!(mergeProps.value.draggable || mergeProps.value.handles)
}

function resetInlineLayout(): void {
  if (!dialogRef.value) {
    return
  }
  heightAnchored.value = false
  userLayout.value = null
  const p = mergeProps.value
  const pb = dialogRef.value as HTMLElement
  pb.style.left = ""
  pb.style.top = ""
  pb.style.right = ""
  pb.style.bottom = ""
  pb.style.width = ""
  pb.style.height = ""
  if (isAllowValue(p.left)) {
    pb.style.left = autoUnit(p.left)
    pb.style.right = "auto"
  } else if (isAllowValue(p.right)) {
    pb.style.right = autoUnit(p.right)
    pb.style.left = "auto"
  }
  if (isAllowValue(p.top)) {
    pb.style.top = autoUnit(p.top)
    pb.style.bottom = "auto"
  } else if (isAllowValue(p.bottom)) {
    pb.style.bottom = autoUnit(p.bottom)
    pb.style.top = "auto"
  }
  if (isAllowValue(p.width)) {
    pb.style.width = autoUnit(p.width)
  }
  if (isAllowValue(p.top) && isAllowValue(p.bottom)) {
    heightAnchored.value = true
  }
  hasUserSet.value = false
}

function clearPersistedLayout(): void {
  const key = getPersistKey()
  if (!key) {
    return
  }
  try {
    localStorage.removeItem(key)
  } catch {
  }
}

function resetLayoutToDefault(skipAnimation = true): void {
  clearPersistedLayout()
  resetInlineLayout()
  if (dialogRef.value && !isFold.value) {
    initDialog(skipAnimation)
  }
}

function getPersistKey(): string | null {
  if (!canPersist()) {
    return null
  }
  const raw = String(mergeProps.value.customClass || mergeProps.value.title || "").trim()
  if (!raw) {
    return null
  }
  const safe = raw.replace(/[^a-zA-Z0-9_\-]+/g, "_").slice(0, 80)
  return `mars_dialog_persist_v1_${safe}`
}

function readPersisted(): { left: number; top: number; width: number; height: number; expiresAt: number } | null {
  const key = getPersistKey()
  if (!key) {
    return null
  }
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as any
    const left = Number(parsed?.left)
    const top = Number(parsed?.top)
    const width = Number(parsed?.width)
    const height = Number(parsed?.height)
    const expiresAt = Number(parsed?.expiresAt)
    if (![left, top, width, height, expiresAt].every((n) => Number.isFinite(n))) {
      return null
    }
    if (expiresAt <= Date.now()) {
      localStorage.removeItem(key)
      return null
    }
    return { left, top, width, height, expiresAt }
  } catch {
    return null
  }
}

function persistNow(): void {
  const key = getPersistKey()
  if (!key || !dialogRef.value) {
    return
  }
  try {
    const pb = dialogRef.value as HTMLElement
    const payload = {
      v: 1,
      updatedAt: Date.now(),
      expiresAt: Date.now() + PERSIST_TTL_MS,
      left: pb.offsetLeft,
      top: pb.offsetTop,
      width: pb.offsetWidth,
      height: pb.offsetHeight
    }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch {
  }
}

function schedulePersist(): void {
  if (!getPersistKey()) {
    return
  }
  if (persistTimer) {
    window.clearTimeout(persistTimer)
  }
  persistTimer = window.setTimeout(() => {
    persistTimer = null
    persistNow()
  }, 260)
}

function restorePersisted(): boolean {
  const v = readPersisted()
  if (!v || !dialogRef.value) {
    return false
  }
  try {
    dialogRef.value.style.right = ""
    dialogRef.value.style.bottom = ""
  } catch {
  }
  userLayout.value = { width: v.width, height: v.height }
  setSize("width", v.width)
  setSize("height", v.height)
  setPosition("left", v.left)
  setPosition("top", v.top)
  hasUserSet.value = true
  return true
}

function isTopMostDialog(): boolean {
  try {
    if (!dialogRef.value) {
      return false
    }
    try {
      if ((window as any).__mars_dialog_top === dialogRef.value) {
        return true
      }
    } catch {
    }
    const selfZRaw = (dialogRef.value as HTMLElement).style.zIndex || "0"
    const selfZ = Number.isFinite(Number.parseInt(selfZRaw, 10)) ? Number.parseInt(selfZRaw, 10) : 0

    const dialogs = Array.from(document.querySelectorAll(".mars-dialog")) as HTMLElement[]
    let maxZ = 0
    for (const el of dialogs) {
      const raw = el.style.zIndex || "0"
      const z = Number.isFinite(Number.parseInt(raw, 10)) ? Number.parseInt(raw, 10) : 0
      maxZ = Math.max(maxZ, z)
    }
    return selfZ >= maxZ
  } catch {
    return false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key !== "Escape") {
    return
  }
  if (!mergeProps.value.visible) {
    return
  }
  if (!(mergeProps.value.closeable || canPersist())) {
    return
  }
  if (isFold.value) {
    return
  }
  if (!isTopMostDialog()) {
    return
  }
  close()
}

// 处理折叠
const isFold = ref(mergeProps.value.defaultFold)

defineExpose({
  expend() {
    toogleFold(false)
  },
  fold() {
    toogleFold(true)
  },
  toggle() {
    toogleFold(!isFold.value)
  },
  resetLayoutToDefault,
  resetSizeToDefault,
  clearPersistedLayout,
  persistNow
})

function toogleFold(status) {
  isFold.value = status
  emits("fold", isFold.value)
  nextTick(() => {
    if (status) {
      initThumbnail()
    } else if (!hasUserSet.value) {
      // 用户没有操作过
      initDialog()
    }
  })
}

function initThumbnail() {
  const thOp = mergeProps.value.thumbnail
  thumbnailRef.value.style.right = autoUnit(thOp.right)
  thumbnailRef.value.style.left = autoUnit(thOp.right) ? null : autoUnit(thOp.left) // 为了解决在折叠状态下的位置问题
  thumbnailRef.value.style.bottom = autoUnit(thOp.bottom)
  thumbnailRef.value.style.top = autoUnit(thOp.top)
  thumbnailRef.value.style.width = autoUnit(thOp.width) ?? autoUnit(30) // 为了解决在折叠状态下的弹出框长度问题
  thumbnailRef.value.style.height = autoUnit(thOp.height) ?? autoUnit(30) // 为了解决在折叠状态下的弹出框高度问题

  observeDialog = false
}

// 初始化展示
function initDialog(skipAnimation = false) {
  // 修复：先设置尺寸，再处理位置
  initSize()

  // 修复位置跳动：优先尝试恢复持久化位置
  // 如果没有持久化数据，才使用初始位置设置
  const hasPersisted = mergeProps.value.persistLayout !== false && restorePersisted()
  if (!hasPersisted) {
    resetInlineLayout()
    initPosition()
    initSize()
  } else {
    // 有持久化数据时，仍需设置 z-index
    const pannelStyle = dialogRef.value.style
    pannelStyle.zIndex = `${++globalZIndex}`
    try {
      ;(window as any).__mars_dialog_top = dialogRef.value
      ;(window as any).__mars_dialog_top_z = globalZIndex
    } catch {
    }
  }

  // 处理给定top之后的超出的情况
  observeDialog = true
  autoNiceHeight()

  // 延迟应用动画，确保定位稳定后再播放
  if (!skipAnimation) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        animationReady.value = true
      })
    })
  }
}
onMounted(() => {
  warpperEle = document.querySelector(mergeProps.value.warpper)
  dialogRef.value?.addEventListener?.("animationstart", handleAnimationStart as EventListener)
  dialogRef.value?.addEventListener?.("animationend", handleAnimationEnd as EventListener)
  if (isFold.value) {
    initThumbnail()
  } else {
    initDialog()
  }
  if (props.visible) {
    nextTick(() => {
      closeBtnRef.value?.focus?.()
    })
  }
})

// 初始化位置
function initPosition() {
  const pannelStyle = dialogRef.value.style
  // 层级位置
  pannelStyle.zIndex = `${++globalZIndex}`
  try {
    ;(window as any).__mars_dialog_top = dialogRef.value
    ;(window as any).__mars_dialog_top_z = globalZIndex
  } catch {
  }
  // 位置样式现在通过 initialPositionStyle 在模板中绑定
}

function bringToFront() {
  if (!dialogRef.value) {
    return
  }
  dialogRef.value.style.zIndex = `${++globalZIndex}`
  try {
    ;(window as any).__mars_dialog_top = dialogRef.value
    ;(window as any).__mars_dialog_top_z = globalZIndex
  } catch {
  }
}

function handleHeaderMouseDown(e: MouseEvent) {
  bringToFront()
  dragStart(e)
}

// 初始化大小
function initSize() {
  let w = null
  let h = null

  // 如果同时存在 left right 则自动计算
  if (isAllowValue(mergeProps.value.left) && isAllowValue(mergeProps.value.right)) {
    w = warpperEle.offsetWidth - mergeProps.value.left - mergeProps.value.right
  } else if (mergeProps.value.width) {
    w = mergeProps.value.width
  }
  setSize("width", w)

  // 如果同时存在 left right 则自动计算
  if (isAllowValue(mergeProps.value.top) && isAllowValue(mergeProps.value.bottom)) {
    h = warpperEle.offsetHeight - mergeProps.value.top - mergeProps.value.bottom
    heightAnchored.value = true
  } else if (mergeProps.value.height) {
    h = mergeProps.value.height
    heightAnchored.value = false
  }
  setSize("height", h)
}

function resetSizeToDefault(): void {
  if (!dialogRef.value) {
    return
  }
  clearPersistedLayout()
  const layout = userLayout.value
  userLayout.value = layout ? { left: layout.left, top: layout.top } : null
  dialogRef.value.style.width = ""
  dialogRef.value.style.height = ""
  initSize()
  observeDialog = true
  autoNiceHeight()
}

// 开始移动
function dragStart(event: any) {
  if (!warpperEle || !mergeProps.value.draggable) {
    return
  }

  const pb = dialogRef.value
  const x = event.clientX
  const y = event.clientY
  const bl = pb.offsetLeft
  const bt = pb.offsetTop

  // 清除锚定对侧，避免 left + right 同时生效导致拉伸变形
  pb.style.right = "auto"
  pb.style.bottom = "auto"

  bindMouseDrag(toPointerPosition)

  function toPointerPosition(e: any) {
    const distanceX = e.clientX - x
    const distanceY = e.clientY - y
    const left = bl + distanceX
    const top = bt + distanceY

    setPosition("left", left)
    setPosition("top", top)
    emits("move")
  }
}

// 缩放
const defaultHandles = ["l", "r", "t", "b", "lb", "rb"]
const defaultEnabledHandles = ["t", "r", "b", "lb", "rb"]

function parseHandles(handles: boolean | string | string[] | undefined): string[] {
  if (!handles) {
    return []
  }
  if (handles === true) {
    return [...defaultEnabledHandles]
  }
  if (Array.isArray(handles)) {
    return handles
  }
  if (handles.includes(",")) {
    return handles
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return handles.split("")
}

let handleName = ""
const actualHandles = computed<string[]>(() => parseHandles(mergeProps.value.handles))
// 处理自定义缩放
function resizeStart(handle: string, event: any) {
  handleName = handle
  const x = event.clientX
  const y = event.clientY
  const bw = dialogRef.value.offsetWidth
  const bh = dialogRef.value.offsetHeight
  const bl = dialogRef.value.offsetLeft
  const bt = dialogRef.value.offsetTop
  const isDocked = !mergeProps.value.draggable
  const isLeftAnchored = isDocked && isAllowValue(mergeProps.value.left)
  const isTopAnchored = isDocked && isAllowValue(mergeProps.value.top)

  bindMouseDrag(handleMove)

  function handleMove(e: any) {
    if (handleName.indexOf("l") !== -1) {
      const L = x - e.clientX
      if (e.clientX > 0 && e.clientX < warpperEle.offsetWidth) {
        if ((dialogRef.value.offsetWidth <= mergeProps.value.minWidth && L > 0) || dialogRef.value.offsetWidth > mergeProps.value.minWidth) {
          if (!isLeftAnchored) {
            setPosition("left", bl - L)
          }
          setSize("width", bw + L)
        }
      }
    }
    if (handleName.indexOf("r") !== -1) {
      setSize("width", bw + e.clientX - x)
    }
    if (handleName.indexOf("t") !== -1) {
      const L = y - e.clientY
      if (e.clientY > 0 && e.clientY < warpperEle.offsetHeight) {
        if ((dialogRef.value.offsetHeight <= mergeProps.value.minHeight && L > 0) || dialogRef.value.offsetHeight > mergeProps.value.minHeight) {
          if (!isTopAnchored) {
            setPosition("top", bt - y + e.clientY)
          }
          setSize("height", bh + y - e.clientY)
        }
      }
    }
    if (handleName.indexOf("b") !== -1) {
      setSize("height", bh + e.clientY - y)
    }

    applyDockAnchorAfterResize()
    emits("resize")
  }
}

function applyDockAnchorAfterResize() {
  if (mergeProps.value.draggable || !dialogRef.value) {
    return
  }
  const p = mergeProps.value
  const pb = dialogRef.value as HTMLElement
  if (isAllowValue(p.left)) {
    pb.style.left = autoUnit(p.left)
    pb.style.right = "auto"
  } else if (isAllowValue(p.right)) {
    pb.style.right = autoUnit(p.right)
    pb.style.left = "auto"
  }
  if (isAllowValue(p.top)) {
    pb.style.top = autoUnit(p.top)
    pb.style.bottom = "auto"
  } else if (isAllowValue(p.bottom)) {
    pb.style.bottom = autoUnit(p.bottom)
    pb.style.top = "auto"
  }
}

function setSize(attr: "width" | "height", v) {
  if (isAllowValue(v)) {
    let value = v
    switch (attr) {
      case "width": {
        if (!isPercentage(value)) {
          if (isFixedWidth()) {
            value = mergeProps.value.minWidth
          } else {
            value = Math.max(mergeProps.value.minWidth, value)
            value = Math.min(mergeProps.value.maxWidth, value, warpperEle.offsetWidth)
          }
        }
        break
      }
      case "height": {
        if (!isPercentage(value)) {
          value = Math.max(mergeProps.value.minHeight, value)
          value = Math.min(mergeProps.value.maxHeight, value, warpperEle.offsetHeight)
        }
        heightAnchored.value = false
        break
      }
    }
    dialogRef.value.style[attr] = autoUnit(value)
    userLayout.value = {
      ...(userLayout.value || {}),
      [attr]: Number(value)
    }
  }
}

function setPosition(attr: "left" | "top", v) {
  if (isAllowValue(v)) {
    let value = v
    const pb = dialogRef.value

    switch (attr) {
      case "left": {
        const maxLeft = warpperEle.offsetWidth - pb.offsetWidth
        value = Math.min(Math.max(0, value), maxLeft)
        break
      }
      case "top": {
        const maxTop = warpperEle.offsetHeight - pb.offsetHeight
        value = Math.min(Math.max(0, value), maxTop)
        break
      }
    }
    dialogRef.value.style[attr] = autoUnit(value)
    if (attr === "left") {
      dialogRef.value.style.right = "auto"
    }
    if (attr === "top") {
      dialogRef.value.style.bottom = "auto"
    }
    userLayout.value = {
      ...(userLayout.value || {}),
      [attr]: Number(value)
    }
  }
}

/** 首次交互前锁定当前屏幕位置，避免 hasUserSet 切换后 Vue 解绑 left/top */
function ensureUserLayoutPosition() {
  if (!dialogRef.value) {
    return
  }
  const pb = dialogRef.value as HTMLElement
  const layout = { ...(userLayout.value || {}) }
  if (layout.left === undefined) {
    layout.left = pb.offsetLeft
  }
  if (layout.top === undefined) {
    layout.top = pb.offsetTop
  }
  userLayout.value = layout
}

let domObserver: MutationObserver | null = null
let niceRaf: number | null = null
onMounted(() => {
  addEvent(window, "resize", resize)
  addEvent(window, "keydown", handleKeydown)

  // 监听元素变化
  domObserver = new MutationObserver(() => {
    scheduleAutoNiceHeight()
  })

  const target = (dialogRef.value?.querySelector?.(".mars-dialog__content") as HTMLElement | null) || dialogRef.value
  domObserver.observe(target, {
    childList: true,
    subtree: true
  })
})
onUnmounted(() => {
  dialogRef.value?.removeEventListener?.("animationstart", handleAnimationStart as EventListener)
  dialogRef.value?.removeEventListener?.("animationend", handleAnimationEnd as EventListener)
  removeEvent(window, "resize", resize)
  removeEvent(window, "keydown", handleKeydown)
  if (persistTimer) {
    window.clearTimeout(persistTimer)
    persistTimer = null
  }
  if (niceRaf) {
    cancelAnimationFrame(niceRaf)
    niceRaf = null
  }
  domObserver?.disconnect()
  domObserver = null
})

// #region debug-point popup-transition-flash
function handleAnimationStart(event: AnimationEvent) {
  reportDialogDebug("animation-start", { animationName: event.animationName })
}

function handleAnimationEnd(event: AnimationEvent) {
  reportDialogDebug("animation-end", { animationName: event.animationName })
  if (activeAnimationClass.value === leaveAnimationClass.value) {
    finishLeaveAnimation()
    return
  }
  if (activeAnimationClass.value === enterAnimationClass.value) {
    activeAnimationClass.value = ""
  }
}
// #endregion debug-point popup-transition-flash

// 处理高度超出的情况
function autoNiceHeight() {
  if (observeDialog && !hasUserSet.value) {
    const isExceed = warpperEle.offsetHeight < dialogRef.value.offsetHeight + dialogRef.value.offsetTop
    if (isExceed) {
      const niceHeight = warpperEle.offsetHeight - dialogRef.value.offsetTop
      if (Math.abs(dialogRef.value.offsetHeight - niceHeight) > 1) {
        dialogRef.value.style.height = autoUnit(niceHeight)
      }
    }
  }
}

function scheduleAutoNiceHeight() {
  if (niceRaf) {
    return
  }
  niceRaf = requestAnimationFrame(() => {
    niceRaf = null
    autoNiceHeight()
  })
}

// 处理窗口缩放
function resize() {
  const pb = dialogRef.value
  if (!warpperEle) {
    return
  }

  if (pb.offsetTop + pb.offsetHeight > warpperEle.offsetHeight) {
    setSize("height", warpperEle.offsetHeight - pb.offsetTop)
  }
  if (!isFixedWidth() && pb.offsetLeft + pb.offsetWidth > warpperEle.offsetWidth) {
    setSize("width", warpperEle.offsetWidth - pb.offsetLeft)
  }
}

// 处理百分比
function isPercentage(value) {
  if (typeof value === "string") {
    return value.search("%") !== -1
  } else {
    return false
  }
}

async function close() {
  if (props.beforeClose && typeof mergeProps.value.beforeClose === "function") {
    const result = props.beforeClose()

    if (result instanceof Promise) {
      try {
        await result
        emitClose()
      } catch (err) {
       logWarn("取消关闭")
      }
    } else if (result !== false) {
      emitClose()
    }
  } else {
    emitClose()
  }
}

function emitClose() {
  persistNow()
  emits("update:visible", false)
  emits("closed")
  try {
    if ((window as any).__mars_dialog_top === dialogRef.value) {
      ;(window as any).__mars_dialog_top = null
      ;(window as any).__mars_dialog_top_z = null
    }
  } catch {
  }
}

// 动画控制：延迟应用动画以确保定位稳定
const animationReady = ref(false)
function resolveAnimationClass(mode: "enter" | "leave") {
  if (mergeProps.value.animation === false) {
    return ""
  }
  if (typeof mergeProps.value.animation === "string") {
    if (mode === "leave" && /^fadein-/.test(mergeProps.value.animation)) {
      return mergeProps.value.animation.replace(/^fadein-/, "fadeout-")
    }
    return mode === "enter" ? mergeProps.value.animation : ""
  }

  const right = mergeProps.value.right
  const left = mergeProps.value.left
  const top = mergeProps.value.top
  const bottom = mergeProps.value.bottom

  const isValidPosition = (val: unknown): boolean => {
    if (val === null || val === undefined) {
      return false
    }
    if (typeof val === "number") {
      return true
    }
    if (typeof val === "string") {
      return /^[0-9]+(%|px)?$/.test(val.trim())
    }
    return false
  }

  let suffix = "center"
  if (isValidPosition(right)) {
    suffix = "right"
  } else if (isValidPosition(left)) {
    suffix = "left"
  } else if (isValidPosition(bottom)) {
    suffix = "up"
  } else if (isValidPosition(top)) {
    suffix = "down"
  }

  return `${mode === "enter" ? "fadein" : "fadeout"}-${suffix}`
}

const enterAnimationClass = computed(() => resolveAnimationClass("enter"))
const leaveAnimationClass = computed(() => resolveAnimationClass("leave"))
const animationClass = computed(() => activeAnimationClass.value)

getDialogAnimationState = () => ({
  isFold: isFold.value,
  animationReady: animationReady.value,
  animationClass: animationClass.value
})

// 处理传入的单位问题
function autoUnit(value: number | string) {
  if (typeof value === "number" || (typeof value === "string" && /^[0-9]*$/.test(value))) {
    return `${value}px`
  } else {
    return value
  }
}

function isAllowValue(value) {
  return value !== null && value !== undefined
}

function isFixedWidth(): boolean {
  const minW = mergeProps.value.minWidth
  const maxW = mergeProps.value.maxWidth
  return isAllowValue(minW) && isAllowValue(maxW) && Number(minW) === Number(maxW)
}

// 事件绑定处理
function bindMouseDrag(callback) {
  addEvent(document.documentElement, "mousemove", handleMove)
  addEvent(document.documentElement, "mouseup", handleUp)

  function handleMove(e) {
    e.preventDefault()
    e.stopPropagation()
    ensureUserLayoutPosition()
    hasUserSet.value = true
    callback(e)
    schedulePersist()
  }

  function handleUp(e: any) {
    e.preventDefault()
    e.stopPropagation()
    removeEvent(document.documentElement, "mousemove", handleMove)
    removeEvent(document.documentElement, "mouseup", handleUp)
  }
}

function addEvent(el: any, event: any, handler: (e: any) => void) {
  if (!el) {
    return
  }
  if (el.attachEvent) {
    el.attachEvent(`on${event}`, handler)
  } else if (el.addEventListener) {
    el.addEventListener(event, handler)
  } else {
    el[`on${event}`] = handler
  }
}
// 事件解除绑定
function removeEvent(el: any, event: any, handler: (e: any) => void) {
  if (!el) {
    return
  }
  if (el.detachEvent) {
    el.detachEvent(`on${event}`, handler)
  } else if (el.removeEventListener) {
    el.removeEventListener(event, handler)
  } else {
    el[`on${event}`] = null
  }
}
</script>
<script lang="ts">
export default {
  name: "mars-dialog"
}
</script>

<style lang="less" scoped>
.mars-dialog-thumb {
  background-color: var(--popup-surface);
  backdrop-filter: blur(var(--popup-blur));
  position: absolute;
  padding: 5px;
  border-radius: 0;
  cursor: pointer;
}

.mars-dialog {
  position: absolute;
  box-sizing: border-box;
  z-index: 900;
  // 默认位置：右上角（与组件默认值 right: 10, top: 10 一致）
  // 防止在模板绑定生效前出现在 (0,0) 位置
  right: 10px;
  top: 60px;
  // 优化动画性能，防止跳动
  will-change: transform, opacity;
  transform-origin: center center;

  .mars-drop-bg();
  box-shadow: var(--popup-shadow);
  border-radius: 0;
  // border-image 与 border-radius 无法共存
  // padding 作为边框，与 mars-dialog__content 背景
  padding: 1px;
  background: var(--popup-border);
  border-radius: 0;
  backdrop-filter: blur(var(--popup-blur));

  .mars-dialog__header {
    height: var(--popup-header-height);
    width: 100%;
    line-height: normal;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 8px;
    .mars-msg-title();
    box-shadow: var(--panel-header-shadow);
    border-radius: 0;
    padding: var(--popup-header-padding);
    color: var(--mars-text-color);
    position: relative;
    top: 0;
    left: 0;

    .icon {
      flex-shrink: 0;
      margin-right: 3px;
      color: #41a8ff;
    }

    .title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: var(--popup-header-height);
      font-size: var(--popup-title-font-size);
      font-weight: var(--popup-title-font-weight);
    }

    .mars-dialog__header-right {
      flex-shrink: 0;
      margin-top: 0;
      margin-right: 0;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .close-btn {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      margin: 0;
      border: none;
      background: transparent;
      box-shadow: none;
      border-radius: calc(var(--popup-radius, 8px) - 2px);
      cursor: pointer;
      color: var(--mars-text-color);
      transition: background var(--transition-fast, 0.2s ease), color var(--transition-fast, 0.2s ease);

      &:hover {
        background: rgba(255, 255, 255, 0.08);
      }
    }
  }

  .close-btn__flot {
    position: absolute;
    right: -8px;
    top: -8px;
    cursor: pointer;
  }

  .mars-dialog__content {
    height: 100%;
    padding: var(--popup-body-padding);
    overflow: auto;
    border-radius: 0;
    background-color: var(--dropdown-surface);

    :deep(.ant-form) {
      padding: 0;
    }
  }

  .mars-dialog_leftbar {
    position: absolute;
    top: 42px;
  }

  .mars-dialog__footer {
    height: var(--popup-footer-height);
    width: calc(100% - 2px);
    color: var(--mars-text-color);
    background-color: var(--popup-surface);
    position: absolute;
    left: 1px;
    bottom: 1px;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding: var(--popup-footer-padding);
    border-top: 1px solid var(--popup-border);
    // padding-left: 14px;  会导致图上标绘弹出框底部tab栏错位
  }

  .mars-dialog__handle {
    box-sizing: border-box;
    position: absolute;
    z-index: 1;
    width: 10px;
    height: 10px;
    opacity: 0;
  }

  .handle-t {
    width: auto;
    top: 0;
    left: 10px;
    right: 10px;
    cursor: row-resize;
  }

  .handle-b {
    width: auto;
    bottom: 0;
    left: 10px;
    right: 10px;
    cursor: row-resize;
  }

  .handle-l {
    height: auto;
    top: 10px;
    left: 0;
    bottom: 10px;
    cursor: col-resize;
  }

  .handle-r {
    height: auto;
    top: 10px;
    right: 0;
    bottom: 10px;
    cursor: col-resize;
  }

  .handle-rb {
    bottom: 0;
    right: 0;
    cursor: nwse-resize;
  }

  .handle-lb {
    bottom: 0;
    left: 0;
    cursor: nesw-resize;
  }
}

/**下面是 5组进入/离开动画 */
@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translate3d(100%, 0, 0);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes fadeOutRight {
  from {
    opacity: 1;
    transform: none;
  }

  to {
    opacity: 0;
    transform: translate3d(100%, 0, 0);
  }
}

.fadein-right,
.fadeout-right,
.fadein-left,
.fadeout-left,
.fadein-up,
.fadeout-up,
.fadein-down,
.fadeout-down,
.fadein-center,
.fadeout-center {
  -webkit-animation-duration: 0.2s;
  animation-duration: 0.2s;
  -webkit-animation-fill-mode: both;
  animation-fill-mode: both;
  -webkit-animation-timing-function: ease-out;
  animation-timing-function: ease-out;
}

.fadein-right {
  -webkit-animation-name: fadeInRight;
  animation-name: fadeInRight;
}

.fadeout-right {
  -webkit-animation-name: fadeOutRight;
  animation-name: fadeOutRight;
}

@keyframes fadeInLeft {
  from {
    opacity: 0;
    transform: translate3d(-100%, 0, 0);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes fadeOutLeft {
  from {
    opacity: 1;
    transform: none;
  }

  to {
    opacity: 0;
    transform: translate3d(-100%, 0, 0);
  }
}

.fadein-left {
  -webkit-animation-name: fadeInLeft;
  animation-name: fadeInLeft;
}

.fadeout-left {
  -webkit-animation-name: fadeOutLeft;
  animation-name: fadeOutLeft;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    -webkit-transform: translate3d(0, 100%, 0);
    transform: translate3d(0, 100%, 0);
  }

  to {
    opacity: 1;
    -webkit-transform: none;
    transform: none;
  }
}

@keyframes fadeOutUp {
  from {
    opacity: 1;
    -webkit-transform: none;
    transform: none;
  }

  to {
    opacity: 0;
    -webkit-transform: translate3d(0, 100%, 0);
    transform: translate3d(0, 100%, 0);
  }
}

.fadein-up {
  -webkit-animation-name: fadeInUp;
  animation-name: fadeInUp;
}

.fadeout-up {
  -webkit-animation-name: fadeOutUp;
  animation-name: fadeOutUp;
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    -webkit-transform: translate3d(0, -100%, 0);
    transform: translate3d(0, -100%, 0);
  }

  to {
    opacity: 1;
    -webkit-transform: none;
    transform: none;
  }
}

@keyframes fadeOutDown {
  from {
    opacity: 1;
    -webkit-transform: none;
    transform: none;
  }

  to {
    opacity: 0;
    -webkit-transform: translate3d(0, -100%, 0);
    transform: translate3d(0, -100%, 0);
  }
}

.fadein-down {
  -webkit-animation-name: fadeInDown;
  animation-name: fadeInDown;
}

.fadeout-down {
  -webkit-animation-name: fadeOutDown;
  animation-name: fadeOutDown;
}

@keyframes fadeInCenter {
  from {
    opacity: 0;
    transform: scale(0.92);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes fadeOutCenter {
  from {
    opacity: 1;
    transform: none;
  }

  to {
    opacity: 0;
    transform: scale(0.92);
  }
}

.fadein-center {
  -webkit-animation-name: fadeInCenter;
  animation-name: fadeInCenter;
}

.fadeout-center {
  -webkit-animation-name: fadeOutCenter;
  animation-name: fadeOutCenter;
}
</style>
