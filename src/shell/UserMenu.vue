<template>
  <HeaderIconButton title="账号" icon="User" @click="openLogin" />
</template>

<script setup lang="ts">
import HeaderIconButton from "@/shell/components/HeaderIconButton.vue"

function openLogin() {
  window.dispatchEvent(new CustomEvent("openLogin"))
}
</script>
