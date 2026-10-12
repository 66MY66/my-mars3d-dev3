<template>
  <div class="dataset-entry">
    <a-space direction="vertical" :size="8" style="width: 100%">
      <a-radio-group v-model:value="scope" size="small" @change="load">
        <a-radio-button value="mine">我的</a-radio-button>
        <a-radio-button value="shared">共享给我</a-radio-button>
        <a-radio-button value="recent">最近</a-radio-button>
      </a-radio-group>
      <a-input-search v-model:value="keyword" placeholder="搜索数据集" @search="load" />
      <a-alert v-if="error" type="error" :message="error" show-icon />
      <a-button size="small" @click="load">刷新</a-button>
      <a-list :data-source="list" :loading="loading" bordered size="small" style="width: 100%">
        <template #renderItem="{ item }">
          <a-list-item class="dataset-row" @click="select(item.datasetId)">
            <a-list-item-meta :title="item.name" :description="item.description || item.datasetId" />
            <template #actions>
              <a-button size="small" type="link">查看</a-button>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-space>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue"
import { getDatasets } from "../services/eoapi-datasets"
import type { EoapiDataset } from "../types/eoapi-types"

const emit = defineEmits<{(e: "select", datasetId: string): void}>()

const keyword = ref("")
const scope = ref<"mine" | "shared" | "recent">("mine")
const loading = ref(false)
const error = ref("")
const list = ref<EoapiDataset[]>([])

async function load() {
  loading.value = true
  error.value = ""
  const res = await getDatasets({ scope: scope.value, q: keyword.value.trim(), limit: 100 })
  if (!res.success) {
    error.value = res.message || "加载失败"
    list.value = []
  } else {
    list.value = (res.data || []).filter((d) => d.datasetId)
  }
  loading.value = false
}

function select(datasetId: string) {
  emit("select", datasetId)
}

onMounted(load)
</script>

<style lang="less" scoped>
.dataset-row {
  cursor: pointer;
}
</style>
