<template>
  <section class="project-rasters" aria-label="本地人口和GDP数据核验">
    <label>数据源<select v-model="selected" aria-label="本地原始栅格"><option value="pop2020">2020 年人口</option><option value="gdp2020">2020 年 GDP</option></select></label>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="loading" role="status">读取原始栅格区域样本…</p>
    <template v-if="source">
      <p class="notice">{{ source.notice }}</p>
      <dl><dt>来源文件</dt><dd>{{ source.archive }}</dd><dt>原始尺寸</dt><dd>{{ source.sourceWidth }} × {{ source.sourceHeight }} · {{ source.resolution.join(' × ') }} m</dd><dt>当前窗口</dt><dd>{{ source.sourceWindow.join(' / ') }} · {{ source.width }} × {{ source.height }} 像元</dd><dt>原始值范围</dt><dd>{{ source.minimum }}—{{ source.maximum }} · 单位待核验</dd><dt>缺测 / 零值</dt><dd>{{ source.missingCells }} / {{ source.zeroCells }} 格</dd></dl>
      <canvas ref="canvas" :width="source.width" :height="source.height" role="img" :aria-label="`${source.name}原始像元分布，单位待核验`"></canvas>
      <div class="raster-legend"><span v-for="(entry, i) in legend" :key="i"><i :style="{ background: entry.color }"></i>{{ entry.label }}</span></div>
      <p>原始投影平面区域样本 · 非地图框选范围 · 未叠加震情</p>
      <details><summary>投影与文件指纹</summary><pre>{{ source.sourceWkt }}</pre><p>原包 SHA-256：{{ source.archiveSha256 }}</p></details>
      <a :href="`${base}${source.tiffUrl}`" download><mars-icon icon="download" :width="16" />下载原投影区域 GeoTIFF</a>
    </template>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue"
import { rasterSourceColors, readProjectRaster, sourceRasterLegend, type ProjectRaster } from "./project-raster-source"
const base = import.meta.env.BASE_URL
const selected = ref("pop2020"); const source = ref<ProjectRaster | null>(null); const error = ref(""); const loading = ref(false)
const canvas = ref<HTMLCanvasElement>(); const legend = ref<Array<{ label: string; color: string }>>([])
let controller: AbortController | undefined
watch(selected, async id => {
  controller?.abort(); const request = new AbortController(); controller = request
  source.value = null; error.value = ""; loading.value = true
  try {
    const response = await fetch(`${base}data/project-raster/${id}.json`, { signal: request.signal })
    if (!response.ok) { throw new Error("本地数据区域样本读取失败") }
    const data = readProjectRaster(await response.json())
    if (request.signal.aborted) { return }
    source.value = data; legend.value = sourceRasterLegend(data)
    await nextTick()
    if (request.signal.aborted || !canvas.value) { return }
    const ctx = canvas.value.getContext("2d")!
    const image = ctx.createImageData(data.width, data.height)
    const colors = rasterSourceColors(data)
    colors.forEach((color, i) => { const at = i * 4; image.data[at] = parseInt(color.slice(1, 3), 16); image.data[at + 1] = parseInt(color.slice(3, 5), 16); image.data[at + 2] = parseInt(color.slice(5, 7), 16); image.data[at + 3] = 255 })
    ctx.putImageData(image, 0, 0)
  } catch (err) { if (!request.signal.aborted) { error.value = err instanceof Error ? err.message : "数据读取失败" } } finally { if (!request.signal.aborted) { loading.value = false } }
}, { immediate: true })
onBeforeUnmount(() => controller?.abort())
</script>

<style scoped>
.project-rasters { color: var(--thematic-ink); font-size: 13px; line-height: 1.6; min-width: 0; }
label { display: grid; gap: 6px; }select { width: 100%; min-height: 36px; padding: 8px; color: var(--thematic-ink); background: var(--thematic-control); border: 1px solid var(--thematic-line); border-radius: 3px; color-scheme: var(--thematic-scheme); }
.notice, [role=alert] { color: var(--thematic-warning); }dl { display: grid; grid-template-columns: 90px minmax(0,1fr); gap: 6px; }dd { margin: 0; overflow-wrap: anywhere; }canvas { width: 100%; height: auto; image-rendering: pixelated; display: block; border: 1px solid var(--thematic-line); box-sizing: border-box; }
.raster-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; }.raster-legend span { display: inline-flex; align-items: center; gap: 5px; }.raster-legend i { width: 16px; height: 12px; border: 1px solid var(--thematic-line); }pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }p { overflow-wrap: anywhere; }a { display: inline-flex; align-items: center; gap: 6px; color: var(--thematic-accent); }summary { cursor: pointer; }
</style>
