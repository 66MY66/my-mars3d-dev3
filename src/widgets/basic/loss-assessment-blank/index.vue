<template>
  <mars-dialog
    custom-class="loss-assessment-blank-pannel"
    :close-button="false"
    :draggable="false"
    width="420"
    height="360"
    top="72"
    left="16"
    v-model:visible="dialogVisible"
  >
    <template #title>
      <button type="button" class="blank-close" aria-label="关闭" @click="dialogVisible = false">
        <mars-icon icon="close" :width="16" />
      </button>
    </template>
    <div class="blank-body"></div>
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
.blank-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--mars-text-color, #fff);
  cursor: pointer;
}

.blank-close:hover {
  background: rgba(255, 255, 255, 0.08);
}

.blank-body {
  min-height: 280px;
}
</style>
