<template>
  <div class="shell" :style="shellStyle">
    <Sidebar :collapsed="isSidebarIconOnly" @toggle="toggleSidebar" />

    <header class="header">
      <div class="brand">
        <img class="brand-logo" :src="logoUrl" alt="logo" />
        <div class="brand-mark" aria-label="SYC">SYC</div>
        <span class="brand-divider" aria-hidden="true"></span>
        <div class="brand-text">
          <div class="brand-title">卫星遥感软件</div>
        </div>
      </div>

      <div class="header-center">
        <slot name="nav" />
      </div>

      <div class="header-right">
        <TopStatusBar />
        <TopHeaderMenus />
        <div class="header-icon-group">
          <TopNotificationsMenu />
          <TopSettingsMenu />
          <UserMenu />
        </div>
      </div>
    </header>

    <main class="main">
      <div class="map-slot">
        <slot />
      </div>
      <slot name="right-floating" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import Sidebar from "@/shell/Sidebar.vue"
import UserMenu from "@/shell/UserMenu.vue"
import TopHeaderMenus from "@/shell/components/TopHeaderMenus.vue"
import TopSettingsMenu from "@/shell/components/TopSettingsMenu.vue"
import TopStatusBar from "@/shell/components/TopStatusBar.vue"
import TopNotificationsMenu from "@/shell/components/TopNotificationsMenu.vue"
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from "@/shell/sidebar"
import { initTheme } from "@/shell/theme"
import { useWidget } from "@mars/common/store/widget"
import logoUrl from "@/assets/logo.png?url"

const sidebarCollapsed = ref(getStoredSidebarCollapsed())
const viewportWidth = ref<number>(window.innerWidth)

const viewportCompact = computed(() => viewportWidth.value < 1366)
const isSidebarIconOnly = computed(() => sidebarCollapsed.value || viewportCompact.value)

const { activate, disable, getWidget } = useWidget()
const visibleWidgetStack = ref<string[]>([])

const collapsedWidth = 64
const expandedWidth = computed(() => {
  const w = viewportWidth.value
  if (w >= 2560) {
    return 208
  }
  if (w >= 1920) {
    return 176
  }
  if (w >= 1366) {
    return 144
  }
  return 112
})

const shellStyle = computed(() => {
  const visible = isSidebarIconOnly.value ? collapsedWidth : expandedWidth.value
  return {
    "--sidebar-collapsed-width": `${collapsedWidth}px`,
    "--sidebar-expanded-width": `${expandedWidth.value}px`,
    "--sidebar-visible-width": `${visible}px`
  } as Record<string, string>
})

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  setStoredSidebarCollapsed(sidebarCollapsed.value)
  window.dispatchEvent(new CustomEvent("sidebarToggle", { detail: { collapsed: sidebarCollapsed.value } }))
}

function onSidebarToggle(e: Event) {
  const detail = (e as CustomEvent).detail as any
  if (typeof detail?.collapsed === "boolean") {
    sidebarCollapsed.value = detail.collapsed
  }
}

let raf = 0
function onResize() {
  if (raf) {
    cancelAnimationFrame(raf)
  }
  raf = requestAnimationFrame(() => {
    viewportWidth.value = window.innerWidth
  })
}

onMounted(() => {
  initTheme()
  window.addEventListener("sidebarToggle", onSidebarToggle as EventListener)
  window.addEventListener("resize", onResize)
  window.addEventListener("mars3d:widget-visible", onWidgetVisibleChange as EventListener)
  window.addEventListener("keydown", onGlobalKeydown, true)
})

onUnmounted(() => {
  window.removeEventListener("sidebarToggle", onSidebarToggle as EventListener)
  window.removeEventListener("resize", onResize)
  window.removeEventListener("mars3d:widget-visible", onWidgetVisibleChange as EventListener)
  window.removeEventListener("keydown", onGlobalKeydown, true)
  if (raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
})

function onWidgetVisibleChange(e: Event) {
  const detail = (e as CustomEvent).detail as any
  const name = String(detail?.name || "")
  const visible = !!detail?.visible
  if (!name) {
    return
  }
  visibleWidgetStack.value = visibleWidgetStack.value.filter((n) => n !== name)
  if (visible) {
    visibleWidgetStack.value.push(name)
  }
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName.toLowerCase()
  if (target.isContentEditable) {
    return true
  }
  if (tag === "input" || tag === "textarea" || tag === "select") {
    return true
  }
  return false
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (isTextInputTarget(e.target)) {
    return
  }
  if (e.altKey && (e.key === "s" || e.key === "S")) {
    e.preventDefault()
    activate({ name: "split-screen-compare" }, false)
    return
  }
  if (e.key === "Escape") {
    let i = visibleWidgetStack.value.length - 1
    while (i >= 0) {
      const name = visibleWidgetStack.value[i]
      const w = getWidget(name)
      if (w?.visible && w.autoDisable !== false) {
        e.preventDefault()
        disable(name)
        return
      }
      visibleWidgetStack.value.splice(i, 1)
      i--
    }
  }
}
</script>

<style scoped>
.shell {
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: var(--bg-primary);
}

.header {
  position: absolute;
  left: 0;
  width: 100%;
  top: 0;
  height: var(--layout-header-height);
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 32px;
  /* SYC 规范：统一深色风格 */
  border-bottom: 1px solid var(--layout-border);
  background: var(--syc-menu-bg);
  z-index: 15;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-shrink: 0;
}

.brand-logo {
  width: 24px;
  height: 24px;
  display: block;
  object-fit: contain;
}

.brand-mark {
  width: 33px;
  height: 24px;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: 0;
  white-space: nowrap;
  color: var(--syc-menu-text);
}

.brand-divider {
  width: 1px;
  height: 16px;
  flex-shrink: 0;
  background: var(--layout-border);
}

.brand-title {
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: 0;
  white-space: nowrap;
  /* SYC 规范：白色文字 */
  color: var(--syc-menu-text);
}

.brand-subtitle {
  font-size: 12px;
  color: #ffffff;
  line-height: 1.1;
  white-space: nowrap;
  display: none;
}

.header-center {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: flex-start;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.main {
  position: absolute;
  left: var(--sidebar-visible-width);
  width: calc(100% - var(--sidebar-visible-width));
  top: var(--layout-header-height);
  bottom: 0;
  transition: left var(--transition-mid), width var(--transition-mid);
}

.map-slot {
  position: absolute;
  inset: 0;
}

@media (max-width: 1280px) {
  .brand {
    min-width: 0;
  }

  .brand-subtitle {
    display: none;
  }

  .header-center {
    justify-content: flex-start;
  }
}

@media (max-width: 900px) {
  .header {
    height: var(--layout-header-height);
    padding: 0 20px;
    flex-wrap: nowrap;
  }

  .main {
    top: var(--layout-header-height);
  }

  .header-center {
    width: auto;
    justify-content: flex-start;
  }
}
</style>
