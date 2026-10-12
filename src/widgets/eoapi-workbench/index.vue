<template>
  <mars-dialog
    ref="dialogRef"
    title="eoAPI 工作台"
    icon="workbench"
    :draggable="true"
    :width="width"
    :height="height"
    :position="{ top, right }"
  >
    <template #headerRight>
      <div class="eoapi-header-actions" @mousedown.stop>
        <a-button size="small" @click="minimize">最小化</a-button>
      </div>
    </template>
    <EoApiWorkbenchPanel />
  </mars-dialog>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from "vue"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import { useWidget } from "@mars/common/store/widget"
import * as mapWork from "./map"
import { usePanelState } from "./hooks/use-panel-state"
import EoApiWorkbenchPanel from "./components/EoApiWorkbenchPanel.vue"

useLifecycle(mapWork)
const { updateWidget } = useWidget()

const dialogRef = ref<any>(null)

const { width, height, top, right } = usePanelState({
  width: 760,
  height: 620,
  top: 60,
  right: 10
})

function minimize() {
  dialogRef.value?.fold?.()
}

onUnmounted(() => {
  updateWidget("toolbar", "eoapi-workbench")
})
</script>

<style scoped>
.eoapi-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
