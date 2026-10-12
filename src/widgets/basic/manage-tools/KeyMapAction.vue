<template>
  <a-tooltip :title="disabledReason" :mouseEnterDelay="0.4" :autoAdjustOverflow="true">
    <mars-button type="primary" :disabled="disabled" :loading="loading" @click="onClick">一键制图</mars-button>
  </a-tooltip>

  <mars-dialog v-model:visible="visible" title="一键制图结果" width="720" :position="{ top: 80, right: 40 }">
    <div class="keymap-wrap">
      <div v-if="resultUrl" class="toolbar">
        <a class="link" :href="resultUrl" target="_blank" rel="noopener noreferrer">新窗口打开</a>
      </div>

      <iframe
        v-if="resultUrl"
        class="frame"
        :src="resultUrl"
        sandbox="allow-scripts allow-same-origin allow-downloads"
      />
      <iframe
        v-else-if="resultHtml"
        class="frame"
        :srcdoc="resultHtml"
        sandbox="allow-scripts"
      />
      <div v-else class="empty">暂无结果</div>
    </div>
  </mars-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { $alert, $message } from "@mars/components/mars-ui/index"
import { hasPermission } from "@/shell/permission"
import type { AlgorithmModel } from "./config"
import { createKeyMap } from "@/api/keymap"

const props = defineProps<{
  selectedTool: AlgorithmModel | null
  params: Record<string, any>
}>()

const permissionCode = "tools:keymap"

const loading = ref(false)
const visible = ref(false)
const resultUrl = ref("")
const resultHtml = ref("")

const hasPerm = computed(() => hasPermission(permissionCode))
const disabled = computed(() => !props.selectedTool || !hasPerm.value || loading.value)
const disabledReason = computed(() => {
  if (!hasPerm.value) {
    return "无权限"
  }
  if (!props.selectedTool) {
    return "请先选择算子"
  }
  return null
})

async function onClick() {
  if (disabled.value || !props.selectedTool) {
    return
  }
  loading.value = true
  resultUrl.value = ""
  resultHtml.value = ""
  try {
    const tool = props.selectedTool
    const keys = (tool.inputParams || []).map((p) => p.key).filter(Boolean)
    const res = await createKeyMap({
      algorithmId: tool.id,
      algorithmName: tool.name,
      widget: tool.widget,
      keys,
      params: props.params || {}
    })
    if (res?.url) {
      resultUrl.value = res.url
    } else if (res?.html) {
      resultHtml.value = res.html
    } else {
      throw new Error("empty_result")
    }
    visible.value = true
    $message("一键制图生成成功", "success")
  } catch (e: any) {
    $alert("一键制图生成失败，请稍后重试", "一键制图")
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.keymap-wrap {
  height: 480px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}

.link {
  color: var(--mars-primary-color);
  font-size: 12px;
  text-decoration: none;
}

.frame {
  width: 100%;
  flex: 1;
  border: 1px solid var(--overlay-border);
  background: transparent;
}

.empty {
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--mars-extra-text-color);
}
</style>
