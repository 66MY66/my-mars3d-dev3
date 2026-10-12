<template>
  <div class="lineage-panel">
    <div class="lineage-header">
      <h4 class="lineage-title">血缘关系</h4>
      <a-button type="link" size="small" @click="handleExpand">
        {{ expanded ? "收起" : "展开" }}
      </a-button>
    </div>

    <div class="lineage-content" v-if="expanded">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <a-spin size="small" />
        <span>加载血缘信息...</span>
      </div>

      <!-- 血缘图 -->
      <div v-else-if="lineage" class="lineage-graph">
        <!-- 源数据集（上游） -->
        <div class="lineage-section upstream" v-if="lineage.sources?.length">
          <div class="section-label">
            <span class="label-icon">⬆️</span>
            <span>来源</span>
          </div>
          <div class="lineage-nodes">
            <div
              v-for="source in lineage.sources"
              :key="source.id"
              class="lineage-node source"
              @click="handleNavigate(source.id)"
            >
              <span class="node-icon">📦</span>
              <span class="node-name">{{ source.name || source.id }}</span>
              <span class="node-time" v-if="source.forkedAt">
                {{ formatDate(source.forkedAt) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 当前数据集 -->
        <div class="lineage-section current">
          <div class="section-label">
            <span class="label-icon">📍</span>
            <span>当前</span>
          </div>
          <div class="lineage-nodes">
            <div class="lineage-node current">
              <span class="node-icon">🗂️</span>
              <span class="node-name">{{ currentName }}</span>
            </div>
          </div>
        </div>

        <!-- 派生数据集（下游） -->
        <div class="lineage-section downstream" v-if="lineage.forks?.length">
          <div class="section-label">
            <span class="label-icon">⬇️</span>
            <span>派生 ({{ lineage.forks.length }})</span>
          </div>
          <div class="lineage-nodes">
            <div
              v-for="fork in lineage.forks"
              :key="fork.id"
              class="lineage-node fork"
              @click="handleNavigate(fork.id)"
            >
              <span class="node-icon">📋</span>
              <span class="node-name">{{ fork.name || fork.id }}</span>
              <span class="node-time" v-if="fork.createdAt">
                {{ formatDate(fork.createdAt) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="!lineage.sources?.length && !lineage.forks?.length" class="empty-lineage">
          <span class="empty-icon">🔗</span>
          <span class="empty-text">暂无血缘关系</span>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <span class="error-text">{{ error }}</span>
        <a-button type="link" size="small" @click="loadLineage">重试</a-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue"

interface LineageNode {
  id: string
  name?: string
  createdAt?: number
  forkedAt?: number
}

interface LineageInfo {
  sources?: LineageNode[]
  forks?: LineageNode[]
}

const props = defineProps<{
  datasetId: string
  datasetName?: string
}>()

const emit = defineEmits<{
  navigate: [datasetId: string]
}>()

const expanded = ref(true)
const loading = ref(false)
const error = ref("")
const lineage = ref<LineageInfo | null>(null)

const currentName = computed(() => props.datasetName || props.datasetId)

watch(
  () => props.datasetId,
  () => {
    if (expanded.value) {
      loadLineage()
    }
  }
)

async function loadLineage() {
  if (!props.datasetId) {
    return
  }

  loading.value = true
  error.value = ""

  try {
    await new Promise((resolve) => setTimeout(resolve, 500))

    lineage.value = {
      sources: [],
      forks: [
        { id: "fork-001", name: "派生数据集 1", createdAt: Date.now() - 86400000 * 2 },
        { id: "fork-002", name: "派生数据集 2", createdAt: Date.now() - 86400000 }
      ]
    }
  } catch (e: any) {
    error.value = e?.message || "加载失败"
  } finally {
    loading.value = false
  }
}

function handleExpand() {
  expanded.value = !expanded.value
  if (expanded.value && !lineage.value) {
    loadLineage()
  }
}

function handleNavigate(datasetId: string) {
  emit("navigate", datasetId)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("zh-CN")
}

onMounted(() => {
  if (expanded.value) {
    loadLineage()
  }
})
</script>

<style scoped lang="less">
.lineage-panel {
  background: var(--mars-control-bg);
  border-radius: 8px;
  padding: 12px;
  margin-top: 16px;
}

.lineage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .lineage-title {
    margin: 0;
    font-size: 14px;
    color: var(--mars-text-color);
  }
}

.lineage-content {
  margin-top: 12px;
}

.loading-state,
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: var(--mars-extra-text-color);
}

.lineage-graph {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lineage-section {
  .section-label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--mars-extra-text-color);
    font-size: 12px;
    margin-bottom: 8px;

    .label-icon {
      font-size: 14px;
    }
  }

  &.current {
    .lineage-nodes {
      padding: 8px;
      background: rgba(64, 169, 255, 0.15);
      border-radius: 6px;
      border: 1px solid rgba(64, 169, 255, 0.3);
    }
  }
}

.lineage-nodes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.lineage-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  min-width: 80px;
  transition: all 0.2s;

  &:hover {
    background: rgba(64, 169, 255, 0.1);
    transform: translateY(-2px);
  }

  &.current {
    cursor: default;

    &:hover {
      background: rgba(64, 169, 255, 0.15);
      transform: none;
    }
  }

  .node-icon {
    font-size: 20px;
    margin-bottom: 4px;
  }

  .node-name {
    color: var(--mars-text-color);
    font-size: 12px;
    text-align: center;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-time {
    color: var(--mars-extra-text-color);
    font-size: 10px;
    margin-top: 2px;
  }
}

.empty-lineage {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  color: #666;

  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  .empty-text {
    font-size: 12px;
  }
}
</style>
