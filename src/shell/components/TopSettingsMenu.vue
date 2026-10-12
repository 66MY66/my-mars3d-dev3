<template>
  <HeaderIconButton title="设置" icon="SettingTwo" @click="togglePanel" />

  <teleport to="body">
    <div v-if="visible" class="settings-anchor">
      <div class="settings-panel" role="dialog" aria-modal="true" aria-label="设置">
        <button class="theme-item" :class="{ active: theme === 'light' }" type="button" @click="applyTheme('light')">
          <span class="menu-icon" v-html="sunSvg"></span>
          <span class="theme-label">浅色主题</span>
          <span v-if="theme === 'light'" class="theme-dot" aria-hidden="true"></span>
        </button>
        <button class="theme-item" :class="{ active: theme === 'dark' }" type="button" @click="applyTheme('dark')">
          <span class="menu-icon" v-html="moonSvg"></span>
          <span class="theme-label">深色主题</span>
          <span v-if="theme === 'dark'" class="theme-dot" aria-hidden="true"></span>
        </button>
        <div class="divider"></div>
        <button class="logout-item" type="button" @click="handleLogout">退出登录（清理缓存并重置）</button>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import HeaderIconButton from "@/shell/components/HeaderIconButton.vue"
import { icons } from "@/shell/icons"
import { getCurrentTheme, setTheme, ThemeMode } from "@/shell/theme"
import { clearCurrentDataset, clearCurrentTaskLock } from "@/shell/currentDataset"
import { $message } from "@mars/components/mars-ui/index"

const theme = ref<ThemeMode>(getCurrentTheme())
const visible = ref(false)

function togglePanel() {
  visible.value = !visible.value
}

function closePanel() {
  visible.value = false
}

function applyTheme(mode: ThemeMode) {
  setTheme(mode)
  theme.value = mode
}

function handleLogout() {
  try {
    window.dispatchEvent(new CustomEvent("mars3d:workspace-clear", { detail: { clearStorage: true } }))
  } catch {
  }
  try {
    clearCurrentDataset()
  } catch {
  }
  try {
    clearCurrentTaskLock()
  } catch {
  }
  $message("已退出登录，并清理缓存重置", "success")
  closePanel()
}

function syncTheme() {
  theme.value = getCurrentTheme()
}

function onDocumentClick(e: MouseEvent) {
  if (!visible.value) {
    return
  }
  const target = e.target as HTMLElement | null
  if (!target) {
    return
  }
  if (target.closest(".settings-panel") || target.closest('[aria-label="设置"]')) {
    return
  }
  closePanel()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && visible.value) {
    closePanel()
  }
}

onMounted(() => {
  window.addEventListener("themeChange", syncTheme)
  document.addEventListener("click", onDocumentClick, true)
  window.addEventListener("keydown", onKeydown)
})

onUnmounted(() => {
  window.removeEventListener("themeChange", syncTheme)
  document.removeEventListener("click", onDocumentClick, true)
  window.removeEventListener("keydown", onKeydown)
})

const sunSvg = computed(() => icons.SunOne({ theme: "outline", size: 18 }) as unknown as string)
const moonSvg = computed(() => icons.Moon({ theme: "outline", size: 18 }) as unknown as string)
</script>

<style scoped>
.settings-anchor {
  position: fixed;
  top: var(--layout-header-height, 64px);
  right: 16px;
  z-index: 10050;
  pointer-events: none;
}

.settings-panel {
  pointer-events: auto;
  min-width: 220px;
  padding: 8px;
  border: 1px solid var(--popup-border, var(--layout-border));
  background: var(--popup-surface, var(--bg-overlay));
  box-shadow: var(--popup-shadow, var(--shadow-2));
  border-radius: var(--popup-radius, 8px);
  overflow: hidden;
  backdrop-filter: blur(var(--popup-blur, var(--overlay-blur)));
}

.theme-item {
  width: 100%;
  border: none;
  background: transparent;
  padding: 10px 12px;
  border-radius: calc(var(--popup-radius, 8px) - 2px);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  color: var(--text-primary);
  text-align: left;
  transition: background var(--transition-fast);
}

.theme-item:hover {
  background: rgba(45 140 240 / 0.08);
}

.theme-item.active {
  background: rgba(45 140 240 / 0.1);
}

.menu-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.menu-icon :deep(svg) {
  display: block;
}

.theme-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 1.4;
}

.theme-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2d8cf0;
  box-shadow: 0 0 0 2px rgba(45, 140, 240, 0.18);
}

.divider {
  height: 1px;
  margin: 4px 8px;
  background: var(--layout-border);
}

.logout-item {
  width: 100%;
  border: none;
  background: transparent;
  padding: 10px 12px;
  border-radius: calc(var(--popup-radius, 8px) - 2px);
  font-size: 14px;
  line-height: 1.4;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-fast);
}

.logout-item:hover {
  background: rgba(45 140 240 / 0.08);
}
</style>
