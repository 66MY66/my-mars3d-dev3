<template>
  <span class="account-btn">
    <HeaderIconButton title="账号" icon="User" :icon-size="16" @click="openLogin" />
  </span>
</template>

<script setup lang="ts">
import HeaderIconButton from "@/shell/components/HeaderIconButton.vue"

function openLogin() {
  window.dispatchEvent(new CustomEvent("openLogin"))
}
</script>

<style scoped>
/* 顶栏高 54px：32px 圆形按钮上下各留 11px；右侧沿用顶栏 20px 内边距 */
.account-btn {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  height: 32px;
  margin: 11px 0;
  margin-left: 20px;
}

.account-btn :deep(.header-icon-btn) {
  width: 32px;
  height: 32px;
  border-radius: 50% !important;
  border: 0;
  background: #4E5969;
  color: #fff;
}

.account-btn :deep(.header-icon-btn:hover) {
  background: #3f4a5c;
  border-color: transparent;
  transform: translateY(-1px);
}

.account-btn :deep(.icon svg) {
  width: 16px;
  height: 16px;
  color: #fff;
}
</style>
