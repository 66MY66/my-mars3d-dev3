<template>
  <div class="emergency-template-preview" role="img" :aria-label="alt" :aria-busy="busy">
    <canvas ref="canvas" aria-hidden="true"></canvas>
    <span v-if="busy" class="preview-status">校样生成中</span>
    <div v-else-if="error" class="preview-status" role="status">
      <span>{{ error }}</span>
      <button type="button" aria-label="重新生成专题校样" @click="draw"><mars-icon icon="refresh" :width="14" />重试</button>
    </div>
  </div>
</template>

<script lang="ts">
import { onBeforeUnmount, ref, watch } from "vue"
import { readDbtDocument, type DbtTemplateId } from "./dbt116-standard"
import { renderDbtMap } from "./dbt116-renderer"

const previews = new Map<DbtTemplateId, Promise<HTMLCanvasElement>>()
function loadPreview(id: DbtTemplateId) {
  if (!previews.has(id)) {
    const pending = (async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}data/dbt116-test/${id}.json`, { signal: AbortSignal.timeout(15000) })
      if (!response.ok) { throw new Error("校样数据加载失败") }
      const canvas = document.createElement("canvas")
      await renderDbtMap(canvas, readDbtDocument(await response.json()), id)
      return canvas
    })().catch(error => { previews.delete(id); throw error })
    previews.set(id, pending)
  }
  return previews.get(id)!
}
</script>

<script setup lang="ts">
const props = defineProps<{ templateId: DbtTemplateId; alt: string }>()
const canvas = ref<HTMLCanvasElement>()
const busy = ref(true)
const error = ref("")
let revision = 0
async function draw() {
  if (!canvas.value) { return }
  const token = ++revision
  busy.value = true; error.value = ""
  try {
    const preview = await loadPreview(props.templateId)
    if (token !== revision || !canvas.value) { return }
    canvas.value.width = preview.width; canvas.value.height = preview.height
    canvas.value.getContext("2d")!.drawImage(preview, 0, 0)
  } catch {
    if (token === revision) { error.value = "校样预览暂不可用" }
  } finally {
    if (token === revision) { busy.value = false }
  }
}
watch(() => [canvas.value, props.templateId], draw, { flush: "post" })
onBeforeUnmount(() => { revision++ })
</script>

<style scoped>
.emergency-template-preview { position: relative; width: 100%; aspect-ratio: 420 / 297; overflow: hidden; background: #fff; }
canvas { display: block; width: 100%; height: 100%; object-fit: contain; }
.preview-status { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 8px; background: #fff; color: #293b45; font-size: 12px; }
button { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid #62708a; border-radius: 4px; background: #fff; color: #17233d; cursor: pointer; }
</style>
