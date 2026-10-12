<template>
  <div class="lineage-panel">
    <div class="lineage-header">
      <h4 class="lineage-title">血缘关系</h4>
      <a-button type="link" size="small" @click="handleExpand">
        {{ expanded ? "收起" : "展开" }}
      </a-button>
    </div>

    <div class="lineage-content" v-if="expanded">
      <div v-if="loading" class="loading-state">
        <a-spin size="small" />
        <span>加载血缘信息...</span>
      </div>

      <div v-else-if="lineage && hasLineage" class="lineage-graph">
        <a-tree
          class="lineage-tree"
          block-node
          show-line
          default-expand-all
          :tree-data="treeData"
          :field-names="{ title: 'title', key: 'key', children: 'children' }"
          @select="onTreeSelect"
        >
          <template #title="node">
            <div
              class="lineage-tree-node"
              :class="[
                `is-${node.nodeType || 'node'}`,
                { 'is-clickable': node.nodeType !== 'current' }
              ]"
            >
              <span class="node-name">{{ node.title }}</span>
              <span v-if="node.nodeType === 'current'" class="node-badge">当前</span>
              <span v-else-if="node.timeText" class="node-time">{{ node.timeText }}</span>
            </div>
          </template>
        </a-tree>
        <div class="lineage-tree-hint">最多展示 3 级血缘（父级 → 当前 → 派生）</div>
      </div>

      <div v-else-if="lineage && !hasLineage" class="empty-lineage">
        <span class="empty-text">暂无血缘关系</span>
      </div>

      <div v-else-if="error" class="error-state">
        <span class="error-text">{{ error }}</span>
        <a-button type="link" size="small" @click="loadLineage">重试</a-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue"
import { getDatasetLineage } from "../services/eoapi-datasets"

interface LineageNode {
  id: string
  name?: string
  createdAt?: number
  forkedAt?: number
}

interface LineageInfo {
  parent?: LineageNode | null
  sources?: LineageNode[]
  forks?: LineageNode[]
}

type TreeNodeType = "parent" | "source" | "current" | "fork"

interface LineageTreeNode {
  key: string
  title: string
  nodeType: TreeNodeType
  timeText?: string
  selectable?: boolean
  isLeaf?: boolean
  children?: LineageTreeNode[]
}

const props = defineProps<{
  datasetId: string
  datasetName?: string
  parentDatasetId?: string
  sourceDatasetId?: string
}>()

const emit = defineEmits<{
  navigate: [datasetId: string]
}>()

const expanded = ref(true)
const loading = ref(false)
const error = ref("")
const lineage = ref<LineageInfo | null>(null)

const currentName = computed(() => props.datasetName || props.datasetId)

const hasLineage = computed(() => {
  if (!lineage.value) {
    return false
  }
  return !!(lineage.value.parent || lineage.value.sources?.length || lineage.value.forks?.length)
})

const treeData = computed<LineageTreeNode[]>(() => buildLineageTree(lineage.value))

watch(
  () => props.datasetId,
  () => {
    if (expanded.value) {
      loadLineage()
    }
  }
)

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("zh-CN")
}

function collectAncestors(info: LineageInfo): LineageNode[] {
  const ancestors: LineageNode[] = []
  if (info.parent?.id) {
    ancestors.push(info.parent)
  }
  for (const source of info.sources || []) {
    if (!source?.id) {
      continue
    }
    if (ancestors.some((item) => item.id === source.id)) {
      continue
    }
    ancestors.push(source)
  }
  return ancestors
}

function buildForkNodes(forks: LineageNode[]): LineageTreeNode[] {
  return forks.map((fork) => ({
    key: fork.id,
    title: fork.name || fork.id,
    nodeType: "fork" as const,
    timeText: fork.createdAt ? formatDate(fork.createdAt) : undefined,
    isLeaf: true
  }))
}

function buildCurrentNode(forks: LineageNode[]): LineageTreeNode {
  const forkNodes = buildForkNodes(forks)
  return {
    key: `current:${props.datasetId}`,
    title: currentName.value,
    nodeType: "current",
    selectable: false,
    isLeaf: forkNodes.length === 0,
    children: forkNodes.length ? forkNodes : undefined
  }
}

function buildLineageTree(info: LineageInfo | null): LineageTreeNode[] {
  if (!info) {
    return []
  }

  // depth: 1 ancestor → 2 current → 3 forks
  const currentNode = buildCurrentNode(info.forks || [])
  const ancestors = collectAncestors(info)

  if (ancestors.length === 0) {
    return [currentNode]
  }

  const [primary, ...rest] = ancestors
  const primaryType: TreeNodeType = info.parent?.id === primary.id ? "parent" : "source"
  const root: LineageTreeNode = {
    key: primary.id,
    title: primary.name || primary.id,
    nodeType: primaryType,
    timeText: primary.forkedAt ? formatDate(primary.forkedAt) : undefined,
    children: [currentNode]
  }

  // 其余上游作为同级叶子展示，避免重复挂载「当前」节点；树深最多 3 层
  const extraAncestors: LineageTreeNode[] = rest.map((item) => ({
    key: item.id,
    title: item.name || item.id,
    nodeType: "source" as const,
    timeText: item.forkedAt ? formatDate(item.forkedAt) : undefined,
    isLeaf: true
  }))

  return [root, ...extraAncestors]
}

async function loadLineage() {
  if (!props.datasetId) {
    return
  }

  loading.value = true
  error.value = ""

  try {
    const remoteRes = await getDatasetLineage(props.datasetId)
    if (remoteRes.success && remoteRes.data) {
      lineage.value = {
        parent: remoteRes.data.parent || null,
        sources: Array.isArray(remoteRes.data.sources) ? remoteRes.data.sources : [],
        forks: Array.isArray(remoteRes.data.forks) ? remoteRes.data.forks : []
      }
      return
    }

    const savedManifests = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")
    const currentDataset = savedManifests[props.datasetId]

    if (currentDataset) {
      let parent: LineageNode | null = null
      const sources: LineageNode[] = []
      const forks: LineageNode[] = []

      if (currentDataset.parentDatasetId) {
        const parentDataset = savedManifests[currentDataset.parentDatasetId]
        parent = {
          id: String(currentDataset.parentDatasetId),
          name: parentDataset?.name
        }
      }

      if (currentDataset.sourceDatasetId) {
        const sourceDataset = savedManifests[currentDataset.sourceDatasetId]
        if (sourceDataset) {
          sources.push({
            id: currentDataset.sourceDatasetId,
            name: sourceDataset.name,
            forkedAt: currentDataset.createdAt
          })
        } else {
          sources.push({
            id: String(currentDataset.sourceDatasetId),
            name: String(currentDataset.sourceDatasetId),
            forkedAt: currentDataset.createdAt
          })
        }
      }

      if (currentDataset.forks && Array.isArray(currentDataset.forks)) {
        for (const fork of currentDataset.forks) {
          forks.push({
            id: fork.datasetId,
            name: fork.name,
            createdAt: fork.createdAt
          })
        }
      }

      lineage.value = { parent, sources, forks }
    } else {
      const parentId = String(props.parentDatasetId || "").trim()
      const sourceId = String(props.sourceDatasetId || "").trim()
      lineage.value = {
        parent: parentId ? { id: parentId, name: parentId } : null,
        sources: sourceId ? [{ id: sourceId, name: sourceId }] : [],
        forks: []
      }
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

function onTreeSelect(selectedKeys: (string | number)[]) {
  const key = String(selectedKeys?.[0] || "")
  if (!key || key.startsWith("current:")) {
    return
  }
  handleNavigate(key)
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
}

.lineage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .lineage-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
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
  gap: 8px;
}

.lineage-tree {
  background: transparent;
  color: var(--mars-text-color);

  :deep(.ant-tree-treenode) {
    padding: 2px 0;
  }

  :deep(.ant-tree-node-content-wrapper) {
    min-height: 28px;
    line-height: 28px;
    border-radius: 6px;
    transition: background 150ms ease;
  }

  :deep(.ant-tree-node-content-wrapper:hover) {
    background: color-mix(in srgb, var(--mars-hover-color, #2d8cf0) 10%, transparent);
  }

  :deep(.ant-tree-node-selected) {
    background: color-mix(in srgb, var(--mars-primary-color, #2d8cf0) 14%, transparent) !important;
  }
}

.lineage-tree-node {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-width: 0;

  &.is-current {
    cursor: default;
  }

  &.is-clickable {
    cursor: pointer;
  }
}

.node-name {
  font-size: 14px;
  line-height: 22px;
  color: var(--mars-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-current .node-name {
  font-weight: 600;
}

.node-badge {
  flex-shrink: 0;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 20px;
  color: var(--mars-primary-color, #2d8cf0);
  background: color-mix(in srgb, var(--mars-primary-color, #2d8cf0) 14%, transparent);
}

.node-time {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--mars-extra-text-color);
}

.lineage-tree-hint {
  font-size: 12px;
  line-height: 18px;
  color: var(--mars-extra-text-color);
}

.empty-lineage {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  color: var(--mars-text-color-secondary, #62708a);

  .empty-text {
    font-size: 12px;
  }
}
</style>
