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
import { computed, onMounted, onBeforeUnmount, watch } from "vue"
import { useRoute } from "vue-router"
import { useWidget } from "@mars/common/store/widget"
import { setCurrentDataset } from "@/shell/currentDataset"
import { $message } from "@mars/components/mars-ui/index"
import MainView from "@mars/components/mars-work/main-view.vue"
import { getQueryString } from "@mars/utils/mars-util"
import ShellLayout from "@/shell/ShellLayout.vue"
import MapFloatBall from "@/shell/components/MapFloatBall.vue"
import TopModulesDropdown from "@/shell/components/TopModulesDropdown.vue"
import { selectTaskPublication, TASK_PUBLICATION_VIEW_EVENT, type TaskPublicationSelection } from "@/widgets/basic/current-task/publication-host"

const sceneUrl = computed(() => getQueryString("url"))
const route = useRoute()
const { activate } = useWidget()
let publicationNavigation = 0
async function openTaskPublication(selection: TaskPublicationSelection) {
  const version = ++publicationNavigation
  const { section, datasetId, publicationId } = selection
  if (section !== "thematics" || typeof datasetId !== "string" || !datasetId || typeof publicationId !== "string" || !publicationId) { return }
  try {
    const { readTaskPublication } = await import("@/widgets/basic/current-task/thematic-publications")
    const { record } = await readTaskPublication(publicationId, datasetId)
    if (version !== publicationNavigation) { return }
    setCurrentDataset({ datasetId, name: record.datasetName, source: "save" })
    selectTaskPublication({ datasetId, publicationId, section: "thematics" })
    activate("current-task", false)
  } catch (error) { if (version === publicationNavigation) { $message(error instanceof Error ? error.message : "已发布图件打开失败") } }
}
watch(() => route.fullPath, () => {
  const { taskSection, datasetId, publicationId } = route.query
  if (taskSection === "thematics" && typeof datasetId === "string" && typeof publicationId === "string") {
    openTaskPublication({ section: taskSection, datasetId, publicationId })
  } else { publicationNavigation++ }
}, { immediate: true })
function handlePublicationView(event: Event) {
  const detail = (event as CustomEvent<TaskPublicationSelection>).detail
  if (detail) { openTaskPublication(detail) }
}
onMounted(() => window.addEventListener(TASK_PUBLICATION_VIEW_EVENT, handlePublicationView))
onBeforeUnmount(() => { publicationNavigation++; window.removeEventListener(TASK_PUBLICATION_VIEW_EVENT, handlePublicationView) })
</script>

<style scoped>
</style>
