<template>
  <a-tooltip :title="title" :mouseEnterDelay="0.4" :autoAdjustOverflow="true">
    <button
      class="header-icon-btn"
      :class="{ active }"
      type="button"
      :aria-label="title"
      @click="$emit('click', $event)"
    >
      <span class="icon" v-html="svg"></span>
      <span v-if="badge != null && badge !== false && badge !== 0" class="badge">{{ badge }}</span>
    </button>
  </a-tooltip>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { IconName } from "@/shell/icons"
import { icons } from "@/shell/icons"

const props = withDefaults(
  defineProps<{
    title: string
    icon: IconName
    iconSize?: number
    badge?: string | number | boolean
    active?: boolean
  }>(),
  {
    iconSize: 16,
    active: false
  }
)

defineEmits<{
  click: [event: MouseEvent]
}>()

const svg = computed(() => {
  const Icon = icons[props.icon]
  if (!Icon) {
    return ""
  }
  return Icon({ theme: "outline", size: props.iconSize }) as unknown as string
})
</script>

<style scoped>
.header-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  display: inline-grid;
  place-items: center;
  padding: 0;
  position: relative;
  color: var(--text-primary);
  overflow: hidden;
  box-sizing: border-box;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), transform var(--transition-fast);
}

:global(:root[data-theme="light"]) .header-icon-btn {
  color: #4E5969;
}

:global(:root[data-theme="light"]) .header-icon-btn.active {
  background: #E8F3FF;
  color: #165DFF;
}

.header-icon-btn:hover {
  background: color-mix(in srgb, #E8F3FF 72%, transparent);
  border-color: transparent;
  transform: translateY(-1px);
}

:global(:root[data-theme="light"]) .header-icon-btn.active:hover {
  background: #E8F3FF;
}

.icon :deep(svg) {
  display: block;
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  height: 18px;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgb(237 64 20);
  color: rgb(255 255 255);
  font-size: 11px;
  display: grid;
  place-items: center;
  line-height: 1;
  box-shadow: var(--shadow-1);
  pointer-events: none;
}
</style>
