<template>
  <mars-dialog title="导入向导" icon="upload" :draggable="true" :width="520" :height="380" :position="{ top: 80, right: 20 }">
    <div class="wizard">
      <div class="row">
        <mars-input v-model:value="url" placeholder="输入文件URL或任务ID（占位）" />
        <mars-button type="primary">导入</mars-button>
      </div>
      <div class="hint">导入校验与字段映射在后续迭代填充</div>
    </div>
  </mars-dialog>
  </template>
<script setup lang="ts">
import { ref } from "vue"
const url = ref("")
</script>
<style scoped>
.wizard {
  display: grid;
  gap: 12px;
}
.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}
.hint {
  font-size: 12px;
  color: var(--mars-extra-text-color);
}
</style>
