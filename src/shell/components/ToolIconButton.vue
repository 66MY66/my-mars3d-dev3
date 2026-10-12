<template>
  <a-tooltip :title="title" :placement="placement" :mouseEnterDelay="0.4" :autoAdjustOverflow="true">
    <button class="tool-icon-btn" type="button" :title="title" :aria-label="title" @mouseenter="onEnter" @click="$emit('click')">
      <span class="icon" v-html="svg"></span>
    </button>
  </a-tooltip>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import type { IconName } from "@/shell/icons"
import { icons } from "@/shell/icons"

const props = defineProps<{
  title: string
  icon: IconName
}>()

defineEmits(["click"])

const placement = ref<"top" | "bottom">("top")

function onEnter(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement | null
  if (!target) {
    placement.value = "top"
    return
  }
  const rect = target.getBoundingClientRect()
  placement.value = rect.top < window.innerHeight * 0.35 ? "bottom" : "top"
}

const svg = computed(() => {
  const Icon = icons[props.icon]
  if (!Icon) {
    return ""
  }
  // SYC 规范：图标尺寸 16px
  return Icon({ theme: "outline", size: 16 }) as unknown as string
})
</script>

<style scoped>
.tool-icon-btn {
  height: 40px;
  width: 40px;
  display: inline-grid;
  place-items: center;
  border-radius: var(--radius-10);
  border: 1px solid var(--border-light);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-1);
  cursor: pointer;
  padding: 0;
  transition: background var(--transition-fast), transform var(--transition-fast);
  color: var(--text-primary);
}

.tool-icon-btn:hover {
  background: color-mix(in srgb, var(--bg-elevated) 80%, var(--primary-hover));
  transform: translateY(-1px);
}

.icon :deep(svg) {
  display: block;
}
</style>
