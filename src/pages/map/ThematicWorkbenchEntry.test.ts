import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { defineComponent } from "vue"

let wrapper: VueWrapper | undefined
let resolveModule: (value: { default: ReturnType<typeof defineComponent> }) => void
let rejectModule: (error: Error) => void
const stubWorkbench = defineComponent({
  props: ["visible", "datasetId"],
  emits: ["update:visible"],
  template: '<div v-show="visible" data-testid="loaded-workbench">{{ datasetId }}<button @click="$emit(\'update:visible\', false)">Close workbench</button></div>'
})

async function setup(visible = true) {
  const module = new Promise<{ default: typeof stubWorkbench }>((resolve, reject) => {
    resolveModule = resolve
    rejectModule = reject
  })
  vi.doMock("@mars/widgets/basic/thematic-workbench/index.vue", () => module)
  const { default: Entry } = await import("./ThematicWorkbenchEntry.vue")
  wrapper = mount(Entry, {
    attachTo: document.body,
    props: { visible },
    attrs: { datasetId: "entry-test" },
    global: {
      stubs: {
        "mars-dialog": { props: ["visible"], emits: ["closed"], template: '<div v-if="visible"><button @click="$emit(\'closed\')">Close loading</button><slot /></div>' }
      }
    }
  })
  return wrapper
}

describe("thematic workbench entry", () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.useRealTimers() })

  it("shows loading immediately and forwards context and visibility to the loaded workbench", async () => {
    const entry = await setup()
    expect(entry.get('[role="status"]').attributes("aria-busy")).toBe("true")
    resolveModule({ default: stubWorkbench })
    await flushPromises()
    expect(entry.find('[role="status"]').exists()).toBe(false)
    expect(entry.get('[data-testid="loaded-workbench"]').text()).toContain("entry-test")
    await entry.get('[data-testid="loaded-workbench"] button').trigger("click")
    expect(entry.emitted("update:visible")).toEqual([[false]])
    await entry.setProps({ visible: false })
    await flushPromises()
    expect(entry.get('[data-testid="loaded-workbench"]').isVisible()).toBe(false)
    await entry.setProps({ visible: true })
    await flushPromises()
    expect(entry.get('[data-testid="loaded-workbench"]').isVisible(), entry.html()).toBe(true)
  })

  it("offers a visible recovery action instead of leaving a failed import blank", async () => {
    const entry = await setup()
    await flushPromises()
    rejectModule(new Error("Failed to fetch dynamically imported module"))
    await flushPromises()
    expect(entry.get('[role="alert"]').text()).toContain("专题制图加载失败")
    expect(entry.get('[role="alert"] button').text()).toBe("刷新网页")
    expect(entry.find('[role="status"]').exists()).toBe(false)
  })

  it("replaces an indefinitely pending load with recovery feedback after 30 seconds", async () => {
    vi.useFakeTimers()
    const entry = await setup()
    await vi.advanceTimersByTimeAsync(30000)
    expect(entry.get('[role="alert"]').text()).toContain("加载超时")
  })

  it("allows closing during loading without reopening the dialog when the import finishes", async () => {
    const entry = await setup()
    await entry.get("button").trigger("click")
    expect(entry.emitted("update:visible")).toEqual([[false]])
    await entry.setProps({ visible: false })
    resolveModule({ default: stubWorkbench })
    await flushPromises()
    expect(entry.find('[role="status"]').exists()).toBe(false)
    expect(entry.get('[data-testid="loaded-workbench"]').isVisible()).toBe(false)
  })
})
