import { beforeEach, describe, expect, it, vi } from "vitest"
import { createApp, defineComponent, nextTick, ref } from "vue"
import KeyMapAction from "./KeyMapAction.vue"
import type { AlgorithmModel } from "./config"

vi.mock("@/api/keymap", () => ({
  createKeyMap: vi.fn()
}))

vi.mock("@/shell/permission", () => ({
  hasPermission: vi.fn()
}))

vi.mock("@mars/components/mars-ui/index", () => ({
  $message: vi.fn(),
  $alert: vi.fn()
}))

const { createKeyMap } = await import("@/api/keymap")
const { hasPermission } = await import("@/shell/permission")
const { $message, $alert } = await import("@mars/components/mars-ui/index")

function mountComp(props: any) {
  const host = document.createElement("div")
  document.body.appendChild(host)

  const App = defineComponent({
    setup() {
      const p = ref(props)
      return { p }
    },
    template: `<KeyMapAction v-bind="p" />`,
    components: { KeyMapAction }
  })

  const app = createApp(App)
  app.component("mars-button", defineComponent({ props: ["disabled", "loading"], emits: ["click"], template: `<button :disabled="disabled" @click="$emit('click')"><slot /></button>` }))
  app.component("mars-dialog", defineComponent({ props: ["visible", "title"], emits: ["update:visible"], template: `<div v-if="visible"><slot /></div>` }))
  app.component("a-tooltip", defineComponent({ template: `<span><slot /></span>` }))

  app.mount(host)
  return { host, unmount: () => app.unmount() }
}

const tool: AlgorithmModel = {
  id: "algo_001",
  name: "地震热异常相关性分析",
  widget: "analysis-tool",
  algorithmType: "correlation",
  inputParams: [
    { key: "radiationThreshold", label: "辐射亮度阈值", type: "number", value: 1 },
    { key: "duration", label: "持续时间", type: "number", value: 24 }
  ],
  versions: []
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("KeyMapAction", () => {
  it("renders disabled when no selected tool", async () => {
    ;(hasPermission as any).mockReturnValue(true)
    const { host, unmount } = mountComp({ selectedTool: null, params: {} })
    await nextTick()
    const btn = host.querySelector("button") as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    unmount()
  })

  it("blocks by permission", async () => {
    ;(hasPermission as any).mockReturnValue(false)
    const { host, unmount } = mountComp({ selectedTool: tool, params: {} })
    await nextTick()
    const btn = host.querySelector("button") as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    unmount()
  })

  it("calls api and shows success", async () => {
    ;(hasPermission as any).mockReturnValue(true)
    ;(createKeyMap as any).mockResolvedValue({ html: "<html></html>" })
    const { host, unmount } = mountComp({ selectedTool: tool, params: { a: 1 } })
    await nextTick()
    const btn = host.querySelector("button") as HTMLButtonElement
    btn.click()
    await nextTick()
    await nextTick()
    expect(createKeyMap).toHaveBeenCalled()
    const payload = (createKeyMap as any).mock.calls[0][0]
    expect(payload.algorithmId).toBe("algo_001")
    expect(payload.keys).toEqual(["radiationThreshold", "duration"])
    expect($message).toHaveBeenCalled()
    unmount()
  })

  it("shows error on api failure", async () => {
    ;(hasPermission as any).mockReturnValue(true)
    ;(createKeyMap as any).mockRejectedValue(new Error("fail"))
    const { host, unmount } = mountComp({ selectedTool: tool, params: {} })
    await nextTick()
    const btn = host.querySelector("button") as HTMLButtonElement
    btn.click()
    await nextTick()
    await nextTick()
    expect($alert).toHaveBeenCalled()
    unmount()
  })
})
