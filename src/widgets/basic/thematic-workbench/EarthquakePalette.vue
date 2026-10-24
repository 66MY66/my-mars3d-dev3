<template>
  <section class="earthquake-palette" aria-label="地震业务配色">
    <header><strong>{{ palette.name }}</strong><a v-if="palette.standardUrl" :href="palette.standardUrl" target="_blank" rel="noopener noreferrer">标准依据</a></header>
    <div class="palette-strip" aria-hidden="true"><i v-for="entry in palette.entries" :key="entry.band" :style="{ backgroundColor: entry.color }"></i></div>
    <ul><li v-for="entry in palette.entries" :key="entry.band"><i :style="{ backgroundColor: entry.color }"></i><span>{{ entry.label }}</span><code>{{ entry.color.toUpperCase() }}</code></li></ul>
    <p>{{ palette.note }}</p>
  </section>
</template>
<script setup lang="ts">
import type { EarthquakePalette } from "./earthquake-palette"
defineProps<{ palette: EarthquakePalette }>()
</script>
<style scoped>
.earthquake-palette { min-width: 0; padding: 12px 0; color: var(--mars-text-color, #20343d); border-bottom: 1px solid #7c949550; }
header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 13px; }
a { color: var(--mars-primary-color, #237fbe); font-size: 12px; }
.palette-strip { display: flex; height: 12px; margin: 12px 0; border: 1px solid #7c949570; }
.palette-strip i { flex: 1; }
ul { display: grid; gap: 8px; list-style: none; margin: 0; padding: 0; }
li { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; align-items: center; gap: 8px; font-size: 12px; line-height: 1.5; }
li i { width: 18px; height: 12px; border: 1px solid #7c949580; }
span { overflow-wrap: anywhere; }
code { font-size: 10px; color: var(--mars-text-color-secondary, #617581); }
p { color: var(--mars-text-color-secondary, #617581); font-size: 12px; line-height: 1.6; margin: 10px 0 0; overflow-wrap: anywhere; }
:global(:root[data-theme=dark] .earthquake-palette a) { color: #6cb6fa; }
</style>
