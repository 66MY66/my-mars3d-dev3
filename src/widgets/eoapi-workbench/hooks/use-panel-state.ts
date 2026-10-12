import { computed, ref, watch } from "vue"

export type PanelState = {
  width: number
  height: number
  top: number
  right: number
}

const storageKey = "mars3d_eoapi_workbench_panel_state"

function readState(): PanelState | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    if (!parsed) {
      return null
    }
    const width = Number(parsed.width)
    const height = Number(parsed.height)
    const top = Number(parsed.top)
    const right = Number(parsed.right)
    if (![width, height, top, right].every((n) => Number.isFinite(n))) {
      return null
    }
    return { width, height, top, right }
  } catch {
    return null
  }
}

export function usePanelState(defaults: PanelState) {
  const init = readState() || defaults
  const width = ref<number>(init.width)
  const height = ref<number>(init.height)
  const top = ref<number>(init.top)
  const right = ref<number>(init.right)

  const state = computed<PanelState>(() => ({
    width: width.value,
    height: height.value,
    top: top.value,
    right: right.value
  }))

  watch(
    state,
    (s) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(s))
      } catch {
      }
    },
    { deep: true }
  )

  return { width, height, top, right, state }
}

