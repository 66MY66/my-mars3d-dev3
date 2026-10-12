import { computed, reactive, readonly } from "vue"

const STORAGE_KEY = "mars3d_a11y_service_v1"
const CHANGE_EVENT = "mars3d:a11y-change"

type A11yState = {
  enabled: boolean
  degraded: boolean
  reason: string
  initialized: boolean
}

const state = reactive<A11yState>({
  enabled: true,
  degraded: false,
  reason: "",
  initialized: false
})

function emitChange() {
  if (typeof window === "undefined") {
    return
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
    detail: {
      enabled: state.enabled,
      degraded: state.degraded,
      reason: state.reason
    }
  }))
}

function loadStoredEnabled() {
  if (typeof window === "undefined") {
    return true
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return true
    }
    return raw !== "false"
  } catch {
    return true
  }
}

function persistEnabled() {
  if (typeof window === "undefined") {
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, String(state.enabled))
  } catch {
    // Ignore storage errors and keep the runtime state available.
  }
}

export function probeAccessibilitySupport() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { degraded: false, reason: "" }
  }

  const userAgent = String(window.navigator?.userAgent || "")
  if (/jsdom/i.test(userAgent)) {
    return { degraded: false, reason: "" }
  }

  const missing: string[] = []
  if (typeof window.matchMedia !== "function") {
    missing.push("matchMedia")
  }
  if (typeof window.requestAnimationFrame !== "function") {
    missing.push("requestAnimationFrame")
  }
  if (typeof window.CustomEvent !== "function") {
    missing.push("CustomEvent")
  }
  if (typeof window.KeyboardEvent !== "function") {
    missing.push("KeyboardEvent")
  }
  if (typeof document.addEventListener !== "function") {
    missing.push("DOMEvent")
  }

  if (!missing.length) {
    return { degraded: false, reason: "" }
  }

  return {
    degraded: true,
    reason: `检测到当前环境缺少 ${missing.join(", ")} 能力，已自动切换为轻量无障碍模式`
  }
}

export function refreshA11ySupport() {
  const probe = probeAccessibilitySupport()
  state.degraded = probe.degraded
  state.reason = probe.reason
  emitChange()
}

function handleStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) {
    return
  }
  state.enabled = loadStoredEnabled()
  emitChange()
}

function ensureInitialized() {
  if (state.initialized) {
    return
  }
  state.enabled = loadStoredEnabled()
  refreshA11ySupport()
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage)
  }
  state.initialized = true
}

export function setA11yEnabled(next: boolean) {
  ensureInitialized()
  state.enabled = !!next
  persistEnabled()
  emitChange()
}

export function toggleA11yEnabled() {
  setA11yEnabled(!state.enabled)
}

export function useA11yService() {
  ensureInitialized()

  const enabled = computed(() => state.enabled)
  const degraded = computed(() => state.degraded)
  const reason = computed(() => state.reason)
  const shouldApplyAria = computed(() => state.enabled && !state.degraded)

  return {
    state: readonly(state),
    enabled,
    degraded,
    reason,
    shouldApplyAria,
    setA11yEnabled,
    toggleA11yEnabled,
    refreshA11ySupport,
    ariaLabel(value?: string) {
      return shouldApplyAria.value ? value : undefined
    },
    ariaHidden(value = true) {
      return shouldApplyAria.value ? value : undefined
    },
    ariaPressed(value: boolean) {
      return shouldApplyAria.value ? value : undefined
    },
    ariaModal(value = true) {
      return shouldApplyAria.value ? value : undefined
    },
    role(value: string) {
      return shouldApplyAria.value ? value : undefined
    },
    tabIndex(value: number) {
      return shouldApplyAria.value ? value : undefined
    }
  }
}

export function __resetA11yStateForTest() {
  state.enabled = true
  state.degraded = false
  state.reason = ""
  state.initialized = false
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // noop
    }
    window.removeEventListener("storage", handleStorage)
  }
}
