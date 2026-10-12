import { mount } from "@vue/test-utils"
import { nextTick } from "vue"
import { describe, expect, it, vi } from "vitest"

const updateWidget = vi.fn()
const changeBaseMapsMock = vi.fn()
const changeTerrainMock = vi.fn()
const getBasemapFailureStateMock = vi.fn()
const resetSizeToDefaultMock = vi.fn()
const refreshBasemapMock = vi.fn()

vi.mock("@mars/common/uses/use-lifecycle", () => ({
  default: vi.fn()
}))

vi.mock("@mars/common/store/widget", () => ({
  useWidget: () => ({
    updateWidget
  })
}))

vi.mock("./map", () => ({
  onMounted: vi.fn(),
  onUnmounted: vi.fn(),
  getLayers: vi.fn(() => ({
    baseMaps: [
      {
        id: "vec",
        name: "天地图矢量",
        isAdded: true,
        show: true,
        options: {}
      },
      {
        id: "img",
        name: "天地图影像",
        isAdded: false,
        show: false,
        options: {}
      }
    ],
    hasTerrain: false
  })),
  changeBaseMaps: changeBaseMapsMock,
  changeTerrain: changeTerrainMock,
  refreshBasemap: refreshBasemapMock,
  getBasemapFailureState: getBasemapFailureStateMock
}))

const ManageBasemap = (await import("./index.vue")).default

describe("manage-basemap/index.vue", () => {
  it("marks failed basemap card in red after switch failure", async () => {
    changeBaseMapsMock.mockResolvedValue(false)
    getBasemapFailureStateMock.mockReturnValue({
      id: "img",
      message: "该底图瓦片服务不可达（可能需要外网/代理）",
      retries: 3
    })

    const wrapper = mount(ManageBasemap, {
      global: {
        stubs: {
          "mars-dialog": {
            template: "<div class='mars-dialog'><slot /><slot name='headerRight' /></div>"
          },
          "mars-switch": {
            template: "<input class='mars-switch' type='checkbox' />"
          }
        }
      }
    })
    await nextTick()

    const cards = wrapper.findAll(".basemap-card")
    expect(cards.length).toBe(2)

    await cards[1].trigger("click")

    expect(cards[1].classes()).toContain("failed-card")
    expect(cards[1].text()).toContain("该底图瓦片服务不可达")
    expect(cards[0].classes()).toContain("active-card")
  })

  it("refreshes the basemap without resetting the dialog layout", async () => {
    const wrapper = mount(ManageBasemap, {
      global: {
        stubs: {
          "mars-dialog": {
            template: "<div class='mars-dialog'><slot name='headerRight' /><slot /></div>",
            setup(_, { expose }) {
              expose({ resetSizeToDefault: resetSizeToDefaultMock })
              return {}
            }
          },
          "mars-switch": {
            template: "<input class='mars-switch' type='checkbox' />"
          }
        }
      }
    })
    await nextTick()

    await wrapper.get('[aria-label="刷新"]').trigger("click")

    expect(refreshBasemapMock).toHaveBeenCalledTimes(1)
    expect(resetSizeToDefaultMock).toHaveBeenCalledTimes(1)
  })
})
