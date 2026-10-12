<template>
  <div class="eoapi-toolbar">
    <a-space :size="8">
      <slot name="left" />
    </a-space>
    <a-space :size="8">
      <slot name="right" />
    </a-space>
  </div>
</template>

<script setup lang="ts"></script>

<style lang="less" scoped>
.eoapi-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
</style>

