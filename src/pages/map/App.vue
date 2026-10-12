<template>
  <ShellLayout>
    <template #nav>
      <TopModulesDropdown />
    </template>

    <main-view :url="sceneUrl" />

    <template #right-floating>
      <MapFloatBall />
    </template>
  </ShellLayout>
</template>

<script setup lang="ts">
import { computed } from "vue"
import MainView from "@mars/components/mars-work/main-view.vue"
import { getQueryString } from "@mars/utils/mars-util"
import ShellLayout from "@/shell/ShellLayout.vue"
import MapFloatBall from "@/shell/components/MapFloatBall.vue"
import TopModulesDropdown from "@/shell/components/TopModulesDropdown.vue"

const sceneUrl = computed(() => getQueryString("url"))
</script>

<style scoped>
</style>
