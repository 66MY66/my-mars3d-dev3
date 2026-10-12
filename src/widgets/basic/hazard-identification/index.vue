<template>
  <mars-dialog
    title="灾害识别"
    custom-class="ksh002-drawer"
    :draggable="false"
    width="32%"
    top="0"
    bottom="0"
    right="0"
    v-model:visible="dialogVisible"
  >
    <div class="placeholder">
      <a-empty description="该模块入口已恢复，但业务文件未找回" :image-style="{ height: '60px' }" />
    </div>
  </mars-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  visible?: boolean
}>()

const emit = defineEmits<{
  "update:visible": [value: boolean]
}>()

const dialogVisible = computed({
  get: () => props.visible ?? true,
  set: (v) => emit("update:visible", v)
})
</script>

<style scoped>
.placeholder {
  padding: 12px;
}
</style>

