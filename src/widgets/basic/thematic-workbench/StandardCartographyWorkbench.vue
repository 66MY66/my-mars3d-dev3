<template>
  <section class="standard-workbench" aria-label="地震应急响应制图">
    <nav role="tablist" aria-label="标准制图流程">
      <button type="button" role="tab" :aria-selected="view === 'library'" @click="view = 'library'">模板库</button>
      <button type="button" role="tab" :aria-selected="view === 'editor'" :disabled="!selected" @click="view = 'editor'">编辑与出图</button>
    </nav>
    <div ref="body" class="standard-workbench-body">
      <DbtTemplateLibrary v-show="view === 'library'" @use="select" />
      <DbtStandardEditor v-if="selected" v-show="view === 'editor'" :template-id="selected" :active="active && view === 'editor'" :map-preview="mapPreview" :map-busy="mapBusy" :map-error="mapError" @capture-map="emit('captureMap')" @select-range="emit('selectRange')" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue"
import DbtTemplateLibrary from "./DbtTemplateLibrary.vue"
import DbtStandardEditor from "./DbtStandardEditor.vue"
import type { DbtTemplateId } from "./dbt116-standard"
import type { DbtMapPreview } from "./dbt-draft-preview"

defineProps<{ active: boolean; mapPreview?: DbtMapPreview | null; mapBusy?: boolean; mapError?: string }>()
const emit = defineEmits<{ captureMap: []; selectRange: [] }>()
const view = ref<"library" | "editor">("library")
const selected = ref<DbtTemplateId | null>(null)
const body = ref<HTMLElement>()
async function select(id: DbtTemplateId) {
  selected.value = id
  view.value = "editor"
  await nextTick()
  body.value?.scrollTo({ top: 0 })
}
</script>

<style scoped>
.standard-workbench { display: flex; flex-direction: column; height: 100%; min-height: 0; color: #e8f0f5; background: #20313e; }
nav { display: flex; flex: none; border-bottom: 1px solid #45606e; }
nav button { border: 0; border-bottom: 2px solid transparent; background: transparent; color: inherit; min-height: 44px; padding: 8px 16px; font: inherit; cursor: pointer; }
nav button[aria-selected=true] { border-color: #48bad8; color: #7bd9ef; }
nav button:disabled { opacity: .5; cursor: default; }
.standard-workbench-body { flex: 1; min-height: 0; overflow: auto; padding: 16px; }
</style>
