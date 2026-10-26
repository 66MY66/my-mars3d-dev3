<template>
  <Suspense timeout="0">
    <component :is="widget.component" v-bind="getWidgetAttr(widget)" :visible="visible" @update:visible="onVisibleChange" />
    <template #fallback>
      <div v-if="visible" class="mars-widget-loading" role="status" aria-live="polite">
        <span class="mars-widget-loading__spinner" aria-hidden="true"></span>
        <span>正在加载面板…</span>
      </div>
    </template>
  </Suspense>
</template>
<script lang="ts">
import { useAttrs, defineComponent, provide, onErrorCaptured } from "vue"
import type { Widget } from "@mars/common/store/widget"

export default defineComponent({
  name: "mars-widget",
  props: ["widget", "visible"],
  emits: ["update:visible", "load-error"],
  setup(props, { emit }) {
    const attrs = useAttrs()

    onErrorCaptured((error, _instance, info) => {
      if (!String(info).includes("async component loader")) {
        return
      }
      console.error(`[widget] ${props.widget.name} 加载失败`, error)
      emit("update:visible", false)
      emit("load-error", error)
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("mars3d:widget-load-error", {
            detail: { name: props.widget.name, message: error instanceof Error ? error.message : String(error) }
          })
        )
      }
      return false
    })

    provide("getCurrentWidget", () => {
      return props.widget.name
    })

    const getWidgetAttr = (widget: Widget) => {
      let attr = {}
      if (widget.meta && widget.meta.props) {
        attr = {
          ...attr,
          ...widget.meta.props
        }
      }
      if (widget.data && widget.data.props) {
        attr = {
          ...attr,
          ...widget.data.props
        }
      }
      return attr
    }

    return {
      attrs,
      getWidgetAttr,
      onVisibleChange: (v: boolean) => emit("update:visible", v)
    }
  }
})
</script>

<style scoped>
.mars-widget-loading {
  position: fixed;
  top: 72px;
  right: 20px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid var(--layout-border, #d9d9d9);
  border-radius: 4px;
  background: var(--mars-base-bg, #fff);
  color: var(--mars-text-color, #1f2329);
  box-shadow: 0 4px 16px rgb(0 0 0 / 14%);
}

.mars-widget-loading__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: mars-widget-spin 0.8s linear infinite;
}

@keyframes mars-widget-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
