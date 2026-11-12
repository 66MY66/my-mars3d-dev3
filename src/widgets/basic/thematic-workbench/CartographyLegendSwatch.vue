<template>
  <span class="cartography-legend-swatch" aria-hidden="true">
    <svg v-if="row.radius !== undefined" viewBox="0 0 54 44" class="size-symbol"><circle cx="27" cy="22" :r="Math.min(21, row.radius)" :fill="row.color" stroke="#ffffff" stroke-width="1" /></svg>
    <CartographySymbolIcon v-else-if="definition?.geometry === 'point'" :binding="definition" :size="22" />
    <svg v-else-if="row.shape === 'line' || definition?.geometry === 'line'" viewBox="0 0 64 20">
      <path d="M 2 10 H 62" fill="none" :stroke="paint.color" :stroke-width="paint.width" :stroke-dasharray="dash" />
      <path v-if="paint.casing" d="M 2 10 H 62" fill="none" :stroke="paint.casing" :stroke-width="paint.innerWidth" />
      <path v-if="paint.railway" d="M 10 7 V 13 M 26 7 V 13 M 42 7 V 13 M 58 7 V 13" fill="none" :stroke="paint.color" stroke-width=".8" />
    </svg>
    <span v-else class="area" :style="{ background: row.color, borderColor: definition ? paint.color : undefined }"></span>
  </span>
</template>
<script setup lang="ts">
import { computed } from "vue"
import CartographySymbolIcon from "./CartographySymbolIcon.vue"
import { dbtSymbolDefinitions, type DbtSymbolKind } from "./dbt116-symbols"
import { vectorPaint, paintDash } from "./cartography-vector-style"
const props = defineProps<{ row: { color: string; kind?: string; shape?: string; styleKey?: string; radius?: number } }>()
const definition = computed(() => Object.hasOwn(dbtSymbolDefinitions, props.row.kind || "") ? dbtSymbolDefinitions[props.row.kind as DbtSymbolKind] : undefined)
const paint = computed(() => vectorPaint(props.row.kind, props.row.styleKey))
const dash = computed(() => paintDash(paint.value).join(" "))
</script>
<style scoped>
.cartography-legend-swatch { display: inline-flex; width: 54px; height: 22px; flex: 0 0 54px; align-items: center; justify-content: center; }
svg { display: block; width: 54px; height: 20px; overflow: visible; }
.area { display: block; width: 24px; height: 14px; border: 1px solid #82919a; }
.cartography-legend-swatch:has(.size-symbol) { height: 44px; }
.size-symbol { height: 44px; }
</style>
