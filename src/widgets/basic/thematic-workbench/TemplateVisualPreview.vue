<template>
  <div class="template-visual" :class="{ 'is-compact': compact, 'has-actual-result': !!renderedImage }" role="img" :aria-label="alt">
    <canvas ref="canvas" aria-hidden="true"></canvas>
    <span v-if="error" class="template-preview-error">{{ error }}</span>
  </div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue"
import { drawCatalogPreview } from "./catalog-template-preview"

export type TemplateVisualKind = "choropleth" | "unique-value" | "graduated-symbol" | "point-heat" | "raster-ramp" | "raster-threshold" | "contour" | "trajectory" | "flow-direction" | "risk-overlay" | "time-compare" | "chart-linkage" | "anomaly-composite" | "thermal-infrared" | "post-quake-risk" | "swarm-trajectory" | "insar-deformation" | "intensity-distribution" | "secondary-hazard" | "building-resilience" | "population-exposure" | "emergency-command"
const props = withDefaults(defineProps<{ kind: TemplateVisualKind; alt: string; palette?: string; compact?: boolean; renderedImage?: string; title?: string; description?: string; legend?: Array<{ label: string; color: string }> }>(), { palette: "", renderedImage: "", title: "", description: "" })
const canvas = ref<HTMLCanvasElement>(); const error = ref("")
let revision = 0
watch(() => [canvas.value, props.kind, props.palette, props.renderedImage, props.title, props.description, props.legend], async () => {
  if (!canvas.value) { return }
  const token = ++revision; error.value = ""
  try {
    const next = document.createElement("canvas")
    await drawCatalogPreview(next, props.kind, props.palette, props.renderedImage, props.title, props.description, props.legend)
    if (token !== revision || !canvas.value) { return }
    canvas.value.width = next.width; canvas.value.height = next.height; canvas.value.getContext("2d")!.drawImage(next, 0, 0)
  } catch (err) { if (token === revision) { error.value = err instanceof Error ? err.message : "预览生成失败" } }
}, { flush: "post" })
onBeforeUnmount(() => { revision++ })
</script>
<style scoped>
.template-visual { position: relative; width: 100%; aspect-ratio: 420 / 297; background: #fff; overflow: hidden; }
.template-visual canvas { display: block; width: 100%; height: 100%; object-fit: contain; }
.template-preview-error { position: absolute; inset: 0; display: grid; place-items: center; padding: 10px; background: #fff; color: #a52929; font-size: 12px; }
</style>
