<template>
  <component v-if="workbench" :is="workbench" v-bind="$attrs" :visible="visible" @update:visible="emit('update:visible', $event)" />
  <mars-dialog
    v-else-if="visible"
    :visible="true"
    title="专题制图工作台"
    icon="workbench"
    custom-class="thematic-entry-status"
    :position="{ top: 12, right: 12 }"
    :width="500"
    :draggable="false"
    :persist-layout="false"
    @closed="emit('update:visible', false)"
  >
    <section class="entry-status" :role="failed ? 'alert' : 'status'" :aria-busy="loading">
      <strong>{{ failed ? '专题制图加载失败' : '正在打开专题制图' }}</strong>
      <p>{{ failed ? '工作台模块未能加载或加载超时。请刷新网页后重新打开专题制图。' : '正在加载制图工作台，请稍候。' }}</p>
      <div v-if="failed" class="entry-actions">
        <button type="button" class="retry-button" @click="refreshPage">刷新网页</button>
      </div>
    </section>
  </mars-dialog>
</template>

<script setup lang="ts">
import { markRaw, onBeforeUnmount, ref, shallowRef, watch, type Component } from "vue"

defineOptions({ inheritAttrs: false })
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ "update:visible": [visible: boolean] }>()
const workbench = shallowRef<Component>()
const loading = ref(false)
const failed = ref(false)
let requestVersion = 0
let timer: ReturnType<typeof setTimeout> | undefined

async function loadWorkbench() {
  if (loading.value) { return }
  const version = ++requestVersion
  loading.value = true
  failed.value = false
  try {
    const loaded = await Promise.race([
      import("@mars/widgets/basic/thematic-workbench/index.vue"),
      new Promise<never>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Thematic workbench load timeout")), 30000)
      })
    ])
    if (version === requestVersion) { workbench.value = markRaw(loaded.default) }
  } catch {
    if (version === requestVersion) { failed.value = true }
  } finally {
    if (version === requestVersion) {
      clearTimeout(timer)
      loading.value = false
    }
  }
}

function refreshPage() { window.location.reload() }
watch(() => props.visible, visible => {
  if (visible && !workbench.value && !loading.value) { loadWorkbench() }
}, { immediate: true })
onBeforeUnmount(() => { requestVersion++; clearTimeout(timer) })
</script>

<style scoped>
.entry-status { color: var(--mars-text-color, #172b45); padding: 8px 0; }
.entry-status strong { font-size: 16px; }
.entry-status p { margin: 12px 0 0; line-height: 1.6; }
.entry-actions { display: flex; gap: 12px; margin-top: 20px; }
.entry-actions button { background: var(--mars-control-bg, #fff); color: var(--mars-text-color, #172b45); border: 1px solid var(--mars-control-border, #73839a); border-radius: 4px; min-height: 36px; padding: 6px 14px; cursor: pointer; }
.entry-actions .retry-button { background: #0864bd; color: #fff; border-color: #0864bd; }
@media (max-width: 540px) {
  :global(.thematic-entry-status) { left: 12px !important; right: 12px !important; width: auto !important; min-width: 0 !important; }
}
</style>
