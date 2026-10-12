import { Alert, Button, Empty, Space, Spin } from "ant-design-vue"
import { defineComponent, h } from "vue"

type ErrorPayload = {
  title?: string
  message?: string
}

const MarsState = defineComponent({
  name: "mars-state",
  props: {
    loading: { type: Boolean, default: false },
    loadingText: { type: String, default: "" },
    error: { type: Boolean, default: false },
    errorTitle: { type: String, default: "" },
    errorMessage: { type: String, default: "" },
    errorPayload: { type: Object as any, default: null },
    empty: { type: Boolean, default: false },
    emptyText: { type: String, default: "" },
    padding: { type: Number, default: 12 },
    showRetry: { type: Boolean, default: true }
  },
  emits: ["retry"],
  setup(props, { slots, emit }) {
    const resolveError = (): ErrorPayload => {
      const payload = props.errorPayload && typeof props.errorPayload === "object" ? (props.errorPayload as any) : null
      return {
        title: String(payload?.title || props.errorTitle || "").trim(),
        message: String(payload?.message || props.errorMessage || "").trim()
      }
    }

    return () => {
      const style = { padding: `${Math.max(0, Math.floor(props.padding))}px` }

      if (props.loading) {
        return h("div", { class: "mars-state", style }, [
          h(Spin, { tip: props.loadingText || "加载中..." } as any)
        ])
      }

      if (props.error) {
        const err = resolveError()
        const message = err.title || "加载失败"
        const description = err.message || "请检查网络或稍后重试"
        const actions: any[] = []
        if (props.showRetry) {
          actions.push(
            h(
              Button,
              { size: "small", onClick: () => emit("retry") },
              { default: () => "重试" }
            )
          )
        }
        const extra = slots.errorExtra ? slots.errorExtra() : null
        if (extra) {
          actions.push(extra)
        }

        return h("div", { class: "mars-state mars-state--error", style }, [
          h(
            Alert,
            {
              type: "error",
              showIcon: true,
              message,
              description
            } as any,
            actions.length
              ? {
                action: () => h(Space, { size: 8 }, { default: () => actions })
              }
              : undefined
          )
        ])
      }

      if (props.empty) {
        return h("div", { class: "mars-state mars-state--empty", style }, [
          slots.empty
            ? slots.empty()
            : h(Empty, { description: props.emptyText || "暂无数据" } as any)
        ])
      }

      return slots.default ? slots.default() : null
    }
  }
})

export default MarsState
