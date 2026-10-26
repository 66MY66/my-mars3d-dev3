import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import MapFloatBall from "./MapFloatBall.vue"

describe("MapFloatBall task center placeholder UI", () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ""
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    })
  })

  afterEach(() => {
    document.body.innerHTML = ""
    delete (HTMLElement.prototype as any).setPointerCapture
    vi.restoreAllMocks()
  })

  it("shows the running count on the bubble and opens a status-first task drawer", async () => {
    const wrapper = mount(MapFloatBall, { attachTo: document.body })
    const ball = document.body.querySelector(".map-float-ball") as HTMLButtonElement

    expect(ball.classList.contains("has-running-tasks")).toBe(true)
    expect(ball.querySelector(".map-float-ball__badge")?.textContent).toBe("2")

    const state = (wrapper.vm as any).$.setupState
    state.onPointerDown({
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      preventDefault: vi.fn(),
      currentTarget: ball
    })
    state.onPointerUp()
    await nextTick()

    const drawer = document.body.querySelector(".task-center-drawer") as HTMLElement
    expect(drawer).toBeTruthy()
    expect(drawer.textContent).toContain("2 个任务进行中")
    expect(drawer.textContent).toContain("刚刚更新")
    expect(drawer.querySelectorAll(".task-running-card")).toHaveLength(2)
    expect(drawer.textContent).toContain("震后灾损专题图")
    expect(drawer.textContent).toContain("72%")
    expect(drawer.textContent).toContain("全国影像瓦片服务")
    expect(drawer.textContent).toContain("41%")
    expect(drawer.textContent).toContain("1 个任务排队中")
    expect(drawer.querySelectorAll(".recent-task-row")).toHaveLength(3)

    const prohibitedActions = Array.from(drawer.querySelectorAll("button")).filter((button) =>
      /取消|重试|下载|打开成果|删除/.test(button.textContent || "")
    )
    expect(prohibitedActions).toHaveLength(0)
  })

  it("closes the placeholder drawer from its close control", async () => {
    const wrapper = mount(MapFloatBall, { attachTo: document.body })
    ;(wrapper.vm as any).$.setupState.drawerOpen = true
    await nextTick()

    const close = document.body.querySelector(".task-center-drawer__close") as HTMLButtonElement
    close.click()
    await nextTick()

    expect(document.body.querySelector(".task-center-drawer")).toBeNull()
  })
})
