<template>
  <div class="top-menus" ref="host">
    <div
      v-for="m in visible"
      :key="m.id"
      class="menu-wrap"
      @mouseenter="onEnter(m.id)"
      @mouseleave="onLeave(m.id)"
    >
      <button class="trigger" :class="{ open: openId === m.id, active: isActivate(m.widget) }" type="button" @click="onTriggerClick(m)">
        <span class="trigger-text">{{ m.label }}</span>
        <span v-if="m.items?.length" class="caret" aria-hidden="true">▾</span>
      </button>

      <ul v-if="openId === m.id && m.items?.length" class="menu" role="menu">
        <li v-for="it in m.items" :key="it.id" role="menuitem">
          <button class="menu-item" type="button" @click="onItemClick(m, it)">{{ it.label }}</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import { useWidget } from "@mars/common/store/widget"
import { hasPermission } from "@/shell/permission"

type MenuItem = {
  id: string
  label: string
  widget?: string
  data?: Record<string, any>
}

type TopMenu = {
  id: string
  label: string
  permission?: string
  widget: string
  items?: MenuItem[]
}

const menus: TopMenu[] = []

const visible = computed(() => menus.filter((m) => hasPermission(m.permission)))

const { activate, disable, isActivate } = useWidget()

const host = ref<HTMLElement | null>(null)
const openId = ref<string | null>(null)
const timers = new Map<string, number>()

function open(menuId: string) {
  openId.value = menuId
}

function close(menuId: string) {
  if (openId.value === menuId) {
    openId.value = null
  }
}

function onEnter(menuId: string) {
  const t = timers.get(menuId)
  if (t) {
    window.clearTimeout(t)
  }
  timers.set(
    menuId,
    window.setTimeout(() => {
      const m = visible.value.find((x) => x.id === menuId)
      if (m?.items?.length) {
        open(menuId)
      }
    }, 120)
  )
}

function onLeave(menuId: string) {
  const t = timers.get(menuId)
  if (t) {
    window.clearTimeout(t)
  }
  timers.set(
    menuId,
    window.setTimeout(() => {
      close(menuId)
    }, 140)
  )
}

function onTriggerClick(m: TopMenu) {
  if (isActivate(m.widget)) {
    disable(m.widget)
  } else {
    activate(m.widget)
  }
  if (m.items?.length) {
    openId.value = openId.value === m.id ? null : m.id
  } else {
    openId.value = null
  }
}

function onItemClick(parent: TopMenu, it: MenuItem) {
  openId.value = null
  const widget = it.widget || parent.widget
  activate({
    name: widget,
    data: it.data
  })
}

function onClickOutside(e: MouseEvent) {
  if (!openId.value) {
    return
  }
  const el = host.value
  if (el && !el.contains(e.target as any)) {
    openId.value = null
  }
}

onMounted(() => {
  document.addEventListener("click", onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener("click", onClickOutside)
  timers.forEach((t) => window.clearTimeout(t))
  timers.clear()
})
</script>

<style scoped>
.top-menus {
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-wrap {
  position: relative;
}

.trigger {
  height: 28px;
  padding: 0 10px;
  border-radius: 0;
  border: none;
  background: transparent;
  /* SYC 规范：次级文字色 */
  color: var(--syc-menu-text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.trigger:hover {
  /* SYC 规范：主文字色 */
  color: var(--syc-menu-text);
  background: rgba(255 255 255 / 0.08);
}

.trigger.open,
.trigger.active {
  /* SYC 规范：选中高亮色 */
  color: var(--syc-submenu-active);
  background: rgba(92 173 255 / 0.12);
}

.caret {
  opacity: 0.7;
  transition: transform var(--transition-fast);
}

.trigger.open .caret {
  transform: rotate(180deg);
}

.menu {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  min-width: 360px;
  padding: 4px;
  margin: 0;
  list-style: none;
  border: 1px solid rgba(255 255 255 / 8%);
  /* SYC 规范：二级菜单背景 */
  background: var(--syc-submenu-bg);
  border-radius: 0;
  box-shadow: var(--popup-shadow);
  z-index: 1000;
  backdrop-filter: blur(var(--popup-blur));
}

.menu-item {
  width: 100%;
  height: 32px;
  padding: 0 12px;
  border-radius: 0;
  border: 1px solid transparent;
  background: transparent;
  /* SYC 规范：主文字色 */
  color: var(--syc-menu-text);
  text-align: left;
  cursor: pointer;
  font-size: 12px;
}

.menu-item:hover {
  background: rgba(92 173 255 / 0.15);
  border-color: rgba(92 173 255 / 0.3);
}
</style>
