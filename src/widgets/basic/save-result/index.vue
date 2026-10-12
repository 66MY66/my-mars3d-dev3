<template>
  <SaveManifestDialog v-model:open="dialogVisible" @saved="handleSaved" />
</template>

<script setup lang="ts">
import { computed } from "vue"
import { $message } from "@mars/components/mars-ui/index"
import SaveManifestDialog from "../dataset-repository/components/SaveManifestDialog.vue"
import { setCurrentDataset } from "@/shell/currentDataset"

const props = defineProps<{
  visible?: boolean
}>()

const emit = defineEmits<{
  "update:visible": [value: boolean]
}>()

const dialogVisible = computed({
  get: () => props.visible ?? false,
  set: (v) => emit("update:visible", v)
})

function handleSaved(data: { datasetId: string; revisionId: string }) {
  setCurrentDataset({ datasetId: data.datasetId, name: data.datasetId, source: "save" })
  $message("已保存，可在“我的仓库”查看")
  dialogVisible.value = false
}
</script>

<style scoped>
</style>
