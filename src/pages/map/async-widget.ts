import { defineAsyncComponent, type Component } from "vue"

type WidgetModule = Component | { default: Component }

export function createAsyncWidgetComponent(loader: () => Promise<WidgetModule>) {
  return defineAsyncComponent({
    loader,
    onError(_error, retry, fail, attempts) {
      if (attempts === 1) {
        window.setTimeout(retry, 200)
        return
      }
      fail()
    }
  })
}
