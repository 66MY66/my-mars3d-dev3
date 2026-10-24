<template>
  <img v-if="binding?.standardAsset || binding?.asset || binding?.legacy" class="cartography-symbol-icon" :class="{ 'is-standard': binding.standardAsset, 'is-line': binding.geometry === 'line' }" :src="image" :width="size" :height="size" alt="" aria-hidden="true" draggable="false" :data-symbol-source="binding.standardAsset ? 'DB/T 116-2026' : binding.asset ? 'UN OCHA' : 'legacy'" />
  <mars-icon v-else-if="binding" :icon="binding.icon" :color="color || binding.accent" :width="size" />
</template>

<script setup lang="ts">
import { computed } from "vue"
import { compositionSymbolImage } from "./composition-symbols"
import type { CartographySymbolKind, TemplateIconBinding } from "./template-icon-registry"

const props = withDefaults(defineProps<{ binding?: TemplateIconBinding; color?: string; size?: number }>(), { size: 20 })
const image = computed(() => props.binding && (props.binding.standardAsset || props.binding.asset || props.binding.legacy)
  ? compositionSymbolImage(props.binding.kind as CartographySymbolKind, props.color || props.binding.accent)
  : "")
</script>

<style scoped>
.cartography-symbol-icon { display: block; flex: none; object-fit: contain; pointer-events: none; }
.cartography-symbol-icon.is-standard { background: transparent; filter: drop-shadow(0 0 1px #ffffffb0); }
</style>
