import { onUnmounted } from "vue"
import { eventTarget } from "../map"

export type ViewChangePayload = {
  center: { lng: number; lat: number; alt: number }
  extent: any
}

export function useViewSync(handler: (payload: ViewChangePayload) => void) {
  const fn = (e: any) => handler(e as ViewChangePayload)
  eventTarget.on("viewChange", fn)
  onUnmounted(() => {
    eventTarget.off("viewChange", fn)
  })
}

