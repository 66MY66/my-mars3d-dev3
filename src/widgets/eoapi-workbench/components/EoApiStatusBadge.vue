<template>
  <a-tag :color="statusColor">{{ statusText }}</a-tag>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { eoapiGet } from "../services/eoapi-client"

const status = ref<"unknown" | "online" | "offline">("unknown")

const statusText = computed(() => {
  if (status.value === "online") { return "eoAPI 在线" }
  if (status.value === "offline") { return "eoAPI 离线" }
  return "eoAPI 检测中"
})

const statusColor = computed(() => {
  if (status.value === "online") { return "green" }
  if (status.value === "offline") { return "red" }
  return "default"
})

onMounted(async () => {
  const res = await eoapiGet<any>("/health")
  status.value = res.success ? "online" : "offline"
})
</script>

