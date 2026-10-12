<template>
  <div class="artifact-preview">
    <a-empty v-if="!url" description="无法预览" />
    <div v-else-if="kind === 'image' || kind === 'pdf' || kind === 'html'" class="preview-stage">
      <div v-if="loading" class="preview-loading">
        <a-spin tip="资源加载中..." />
      </div>
      <div v-else-if="loadError" class="preview-error">
        <a-result status="error" title="资源加载失败" :sub-title="loadErrorText">
          <template #extra>
            <a-button type="primary" size="small" @click="retryLoad">重试</a-button>
          </template>
        </a-result>
      </div>
      <img
        v-if="kind === 'image' && !loadError"
        :key="renderKey"
        :src="url"
        alt="artifact"
        @load="handleLoad"
        @error="handleError"
      />
      <iframe
        v-else-if="!loadError"
        :key="renderKey"
        class="preview-iframe"
        :src="url"
        title="artifact"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        @load="handleLoad"
        @error="handleError"
      ></iframe>
    </div>
    <div v-else class="preview-fallback">
      <div class="fallback-title">该附件暂不支持内嵌预览</div>
      <a :href="url" target="_blank" rel="noopener noreferrer">打开附件</a>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue"

const props = defineProps<{
  url: string
  mime?: string
}>()

const emit = defineEmits<{
  loaded: []
  error: [message: string]
}>()

function detectKind(url: string, mime?: string): "image" | "pdf" | "html" | "other" {
  const m = String(mime || "").toLowerCase()
  if (m.startsWith("image/")) {
    return "image"
  }
  if (m === "application/pdf") {
    return "pdf"
  }
  if (m === "text/html") {
    return "html"
  }
  const u = String(url || "").toLowerCase()
  if (/\.(png|jpg|jpeg|gif|webp)(\?.*)?$/.test(u)) {
    return "image"
  }
  if (/\.pdf(\?.*)?$/.test(u)) {
    return "pdf"
  }
  if (/\.html?(\?.*)?$/.test(u)) {
    return "html"
  }
  return "other"
}

const kind = computed(() => detectKind(props.url, props.mime))
const url = computed(() => String(props.url || "").trim())
const loading = ref(false)
const loadError = ref(false)
const loadErrorText = ref("")
const renderKey = ref(0)

function resetLoadState() {
  loading.value = !!url.value && (kind.value === "image" || kind.value === "pdf" || kind.value === "html")
  loadError.value = false
  loadErrorText.value = ""
}

function handleLoad() {
  loading.value = false
  loadError.value = false
  loadErrorText.value = ""
  emit("loaded")
}

function handleError() {
  loading.value = false
  loadError.value = true
  loadErrorText.value = "请检查资源地址、网络状态或稍后重试"
  emit("error", loadErrorText.value)
}

function retryLoad() {
  renderKey.value += 1
  resetLoadState()
}

watch([url, kind], () => {
  renderKey.value += 1
  resetLoadState()
}, { immediate: true })
</script>

<style scoped lang="less">
.artifact-preview {
  width: 100%;
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mars-control-bg);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  overflow: hidden;
}

.preview-stage {
  position: relative;
  width: 100%;
  min-height: 420px;
  display: flex;
  align-items: stretch;
  justify-content: center;
}

.preview-loading,
.preview-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(11, 15, 20, 0.72);
  z-index: 1;
}

img {
  width: 100%;
  height: auto;
  max-height: 72vh;
  object-fit: contain;
  background: #0b0f14;
}

.preview-iframe {
  width: 100%;
  height: 72vh;
  border: 0;
  background: #0b0f14;
}

.preview-error :deep(.ant-result) {
  padding: 12px;
}

.preview-fallback {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  color: var(--mars-text-color);
}

.fallback-title {
  font-size: 13px;
  color: var(--mars-extra-text-color);
}
</style>
