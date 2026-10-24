<template>
  <section class="media-export" aria-label="三维导出">
    <h3>快照与动效</h3>
    <label>清晰度<select v-model="quality" :disabled="busy" aria-label="三维导出清晰度"><option v-for="(item, key) in EXPORT_QUALITY" :key="key" :value="key">{{ item.label }}</option></select></label>
    <button type="button" :disabled="busy" @click="snapshot"><mars-icon icon="camera" color="currentColor" :width="16" />导出 PNG 快照</button>
    <div class="media-options"><label>动效格式<select v-model="format" :disabled="busy" aria-label="动效格式"><option value="mp4">MP4</option><option value="gif">GIF</option></select></label><label>时长（秒）<input v-model.number="seconds" :disabled="busy" type="number" min="1" max="15" aria-label="录制时长" /></label></div>
    <button v-if="!recording" type="button" :disabled="busy" @click="record"><mars-icon icon="video" color="currentColor" :width="16" />开始录制</button>
    <button v-else type="button" @click="controller?.abort()">取消录制 · {{ progress }}%</button>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
<script setup lang="ts">
import { onUnmounted, ref } from "vue"
import { captureDisplayFrame } from "./map"
import { canvasBlob, downloadBlob, EXPORT_QUALITY, recordMap, type ExportQuality } from "./export-media"
const quality = ref<ExportQuality>("standard")
const format = ref<"mp4" | "gif">("mp4")
const seconds = ref(5)
const progress = ref(0)
const busy = ref(false)
const recording = ref(false)
const error = ref("")
let controller: AbortController | null = null
async function snapshot() {
  busy.value = true; error.value = ""
  try { downloadBlob(await canvasBlob(await captureDisplayFrame(EXPORT_QUALITY[quality.value].width)), `专题3D快照_${Date.now()}.png`) } catch (err) { error.value = String(err) } finally { busy.value = false }
}
async function record() {
  busy.value = true; recording.value = true; error.value = ""; progress.value = 0; controller = new AbortController()
  const requested = format.value
  try {
    const blob = await recordMap(requested, () => captureDisplayFrame(Math.min(1920, EXPORT_QUALITY[quality.value].width)), seconds.value, controller.signal, value => { progress.value = value })
    downloadBlob(blob, `专题3D动效_${Date.now()}.${requested}`)
  } catch (err) { error.value = err instanceof Error ? err.message : "录制失败" } finally { busy.value = false; recording.value = false; controller = null }
}
onUnmounted(() => controller?.abort())
</script>
<style scoped>
.media-export { border-top: 1px solid #7c949550; margin-top: 20px; padding-top: 16px; color: inherit; }
h3 { color: inherit; font-size: 14px; margin: 0 0 12px; }
label { display: grid; gap: 6px; min-width: 0; }
.media-options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
select, input { box-sizing: border-box; width: 100%; min-width: 0; height: 36px; padding: 4px 8px; color: var(--mars-text-color, #20343d); background: var(--bg-primary, #fff); border: 1px solid #7c949565; border-radius: 4px; font: inherit; color-scheme: light; }
option { color: var(--mars-text-color, #20343d); background: var(--bg-primary, #fff); }
select:focus-visible, input:focus-visible, button:focus-visible { outline: 2px solid var(--mars-primary-color, #237fbe); outline-offset: 2px; }
:global(:root[data-theme=dark] .media-export select), :global(:root[data-theme=dark] .media-export input) { color-scheme: dark; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 34px; margin-top: 10px; color: inherit; background: transparent; border: 1px solid #7c949565; border-radius: 4px; cursor: pointer; }
button:disabled { opacity: .5; cursor: wait; }
p { color: var(--mars-dangerous-color, #d9534f); overflow-wrap: anywhere; }
</style>
