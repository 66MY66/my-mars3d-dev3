<template>
  <div class="contract-preview" :aria-label="`${name}版式结构`" role="img">
    <img v-if="image || layoutImage" :src="image || layoutImage" :alt="`${name}${image ? '实际渲染结果' : '默认版式预览'}`" />
    <span v-else class="preview-status" role="status">{{ failed ? '版式预览暂不可用' : '正在生成版式预览' }}</span>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from "vue"
import { renderTemplateLayoutPreview } from "./template-layout-preview"

const props = defineProps<{ name: string; image?: string }>()
const layoutImage = ref("")
const failed = ref(false)
watch(() => props.name, async (name, _, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  layoutImage.value = ""; failed.value = false
  try {
    const image = await renderTemplateLayoutPreview(name)
    if (active) { layoutImage.value = image }
  } catch {
    if (active) { failed.value = true }
  }
}, { immediate: true })
</script>
<style scoped>
.contract-preview { position: relative; width: 100%; aspect-ratio: 420 / 297; flex-shrink: 0; overflow: hidden; background: #fff; color: #26343b; }
.contract-preview img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: contain; }
.preview-status { position: absolute; inset: 0; display: grid; align-content: center; padding: 8px; box-sizing: border-box; text-align: center; overflow-wrap: anywhere; font-size: 12px; }
</style>
