<template>
  <section class="dbt-library" aria-label="地震应急响应标准模板库">
    <header><h3>地震应急响应专题图</h3><span>DB/T 101-2024 · 制作要求报批稿</span></header>
    <div class="dbt-template-grid">
      <article v-for="item in dbtTemplates" :key="item.id">
        <img v-if="previews[item.id]" :src="previews[item.id]" :alt="`${item.name}合成测试校样`" loading="lazy" />
        <div v-else class="dbt-loading">{{ failed ? '校样预览暂不可用' : '校样生成中' }}</div>
        <strong>{{ item.name }}</strong><small>{{ item.id }} · {{ item.id.startsWith('T301') ? '震区基本信息' : '快速评估地震灾害影响' }}</small>
        <button type="button" :aria-label="`使用${item.name}标准模板`" @click="emit('use', item.id)"><mars-icon icon="play" :width="14" />使用模板</button>
      </article>
    </div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue"
import { dbtTemplates, readDbtDocument, type DbtTemplateId } from "./dbt116-standard"
import { renderDbtMap } from "./dbt116-renderer"
const emit = defineEmits<{ use: [id: DbtTemplateId] }>()
const previews = ref<Record<string, string>>({}); const failed = ref(false)
const controller = new AbortController()
onMounted(async () => {
  for (const item of dbtTemplates) {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/dbt116-test/${item.id}.json`, { signal: controller.signal })
      if (!response.ok) { throw new Error("Template data unavailable") }
      const canvas = document.createElement("canvas")
      await renderDbtMap(canvas, readDbtDocument(await response.json()), item.id)
      if (controller.signal.aborted) { return }
      const thumbnail = document.createElement("canvas"); thumbnail.width = 480; thumbnail.height = 340
      thumbnail.getContext("2d")!.drawImage(canvas, 0, 0, 480, 340)
      previews.value[item.id] = thumbnail.toDataURL("image/jpeg", 0.88)
    } catch { if (!controller.signal.aborted) { failed.value = true } }
  }
})
onBeforeUnmount(() => controller.abort())
</script>
<style scoped>
.dbt-library { margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid #45606e; }.dbt-library header { display: grid; gap: 5px; margin-bottom: 12px; }.dbt-library h3 { font-size: 16px; color: #eef6fa; margin: 0; }.dbt-library header span { font-size: 12px; color: #a6c3d1; }.dbt-template-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }.dbt-template-grid article { border: 1px solid #476577; border-radius: 4px; padding: 9px; min-width: 0; display: flex; flex-direction: column; gap: 7px; color: #e8f2f6; }.dbt-template-grid img, .dbt-loading { width: 100%; aspect-ratio: 420/297; object-fit: contain; background: #fff; color: #293b45; }.dbt-loading { display: grid; place-items: center; font-size: 12px; }.dbt-template-grid strong { font-size: 14px; line-height: 1.5; min-height: 42px; }.dbt-template-grid small { font-size: 11px; color: #a6c3d1; }.dbt-template-grid button { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: auto; background: #215b75; color: #f0f8fc; border: 1px solid #3c86a1; min-height: 32px; cursor: pointer; border-radius: 3px; }
</style>
