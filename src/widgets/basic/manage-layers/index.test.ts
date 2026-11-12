import { mount } from "@vue/test-utils"
import { nextTick } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const activate = vi.fn()
const disable = vi.fn()
const updateWidget = vi.fn()
const currentWidgetOnUpdate = vi.fn()
let widgetUpdateHandler: null | (() => void) = null
const messageSpy = vi.fn()

const layerFixture: any = {
  id: "layer-1",
  name: "灾后真彩影像",
  type: "xyz",
  hasOpacity: true,
  hasZIndex: true,
  opacity: 1,
  brightness: 1.05,
  contrast: 1.08,
  gamma: 0.95,
  saturation: 1.03,
  hue: 0,
  show: true,
  options: {
    type: "xyz",
    url: "https://example.com/tiles/{z}/{x}/{y}.png",
    metadata: {
      source: "eoapi"
    }
  },
  reload: vi.fn(),
  refresh: vi.fn()
}

const landsatLayerFixture: any = {
  id: 402001,
  name: "Landsat地表温度（丽江—大理，2026-02—04）",
  type: "xyz",
  options: {
    type: "xyz",
    metadata: {
      source: "eoAPI STAC",
      detailSections: [
        { title: "基本信息", fields: [{ label: "STAC Item ID", value: "SP-landsat-lst-20260216" }] },
        { title: "数据信息", fields: [{ label: "数据时段", value: "2026-02-16 至 2026-04-15" }] },
        { title: "数值信息", fields: [{ label: "像元值范围", value: "约 10.97～32.53" }] },
        { title: "数据说明", fields: [{ label: "单位状态", value: "未标注" }] }
      ]
    }
  }
}

const profiledLayerFixture: any = {
  id: "profiled-layer",
  name: "中国活动断层线",
  type: "geojson",
  options: {
    type: "geojson",
    metadata: {
      detailProfile: "china-active-faults",
      source: "eoAPI STAC / GMT 中国地理数据集 v0.4.0",
      itemId: "SP-china-active-faults",
      featureCount: 10534,
      crs: "EPSG:4326"
    }
  }
}

const vectorLayerFixture: any = {
  id: "vector-1",
  name: "热异常点位",
  type: "geojson",
  hasOpacity: true,
  hasZIndex: true,
  opacity: 1,
  show: true,
  options: {
    type: "geojson",
    symbol: {
      type: "polylineP",
      styleOptions: {
        color: "#ff5a36",
        opacity: 1,
        width: 2,
        clampToGround: true
      }
    }
  },
  eachGraphic: vi.fn((callback: (graphic: any) => void) => callback(vectorGraphicFixture)),
  reload: vi.fn(),
  refresh: vi.fn()
}

const vectorGraphicFixture: any = {
  type: "polylineP",
  style: {
    color: "rgba(255,90,54,1)",
    width: 2,
    clampToGround: true
  },
  setStyle: vi.fn()
}

const getLayrsTree = vi.fn((params?: any) => {
  const item = {
    id: "layer-1",
    key: "layer-1",
    name: "灾后真彩影像",
    show: true,
    open: true,
    group: false,
    children: []
  }
  params?.forEach?.(item, layerFixture)
  return { tree: [item] }
})

const getLayerById = vi.fn((id: string) => {
  if (String(id) === "profiled-layer") {
    return profiledLayerFixture
  }
  if (String(id) === "402001") {
    return landsatLayerFixture
  }
  if (String(id) === "layer-1") {
    return layerFixture
  }
  if (String(id) === "vector-1") {
    return vectorLayerFixture
  }
  return null
})
const getAllLayers = vi.fn(() => [layerFixture, vectorLayerFixture])
const updateLayerShowOnly = vi.fn((layer: any, show: boolean) => {
  layer.show = show
})
const removeLayerById = vi.fn(() => true)
const syncLayerZIndexByIds = vi.fn(() => true)

vi.mock("@mars/common/uses/use-lifecycle", () => ({
  default: vi.fn()
}))

vi.mock("@mars/common/store/widget", () => ({
  useWidget: () => ({
    activate,
    disable,
    updateWidget,
    currentWidget: {
      onUpdate: (handler: () => void) => {
        widgetUpdateHandler = handler
        currentWidgetOnUpdate(handler)
      }
    }
  })
}))

vi.mock("@mars/utils/mars-util", () => ({
  logInfo: vi.fn()
}))

vi.mock("@mars/components/mars-ui/index", () => ({
  $message: messageSpy
}))

vi.mock("@/shell/currentDataset", () => ({
  getCurrentDataset: () => ({ datasetId: "ds-style", name: "样式数据集" }),
  onCurrentDatasetChange: () => () => {}
}))

vi.mock("@/shell/permission", () => ({
  isSuperAdmin: () => false
}))

vi.mock("../dataset-repository/services/eoapi-directory-locks", () => ({
  getDirectoryLocks: vi.fn(async () => ({ success: true, data: [] }))
}))

vi.mock("../dataset-repository/services/dataset-sync", () => ({
  onDatasetSync: () => () => {}
}))

vi.mock("../current-task/map", () => ({
  removePersistedSession: vi.fn()
}))

vi.mock("./map", () => ({
  onMounted: vi.fn(),
  onUnmounted: vi.fn(),
  getLayrsTree,
  getLayerById,
  getAllLayers,
  updateLayerShowOnly,
  getLayerByAttr: vi.fn(() => []),
  exchangeLayer: vi.fn(),
  syncLayerZIndexByIds,
  snapshotLayerZIndex: vi.fn(() => ({ "layer-1": 1, "vector-1": 2 })),
  restoreLayerZIndex: vi.fn(),
  removeLayerById,
  setLayerName: vi.fn(() => true),
  setLayerPid: vi.fn(() => true),
  flytoModelNode: vi.fn()
}))

const ManageLayers = (await import("./index.vue")).default

const stubs = {
  "mars-dialog": {
    props: ["visible"],
    emits: ["update:visible"],
    template: "<div class='mars-dialog'><slot /><slot name='footer' /></div>"
  },
  "mars-dropdown-menu": {
    template: "<div class='mars-dropdown-menu'><slot /><slot name='overlay' /></div>"
  },
  "mars-input": {
    props: ["value"],
    emits: ["update:value"],
    template: "<input class='mars-input' :value='value' @input=\"$emit('update:value', $event.target.value)\" />"
  },
  "mars-slider": {
    props: ["value", "min", "max", "step"],
    emits: ["update:value", "change"],
    template: "<input class='mars-slider-input' type='range' :value='value' @input=\"$emit('update:value', Number($event.target.value))\" @change=\"$emit('change', Number($event.target.value))\" />"
  },
  "mars-color-picker": {
    props: ["value"],
    emits: ["update:value"],
    template: "<input class='mars-color-picker' :value='value' @input=\"$emit('update:value', $event.target.value)\" />"
  },
  "mars-tree": {
    props: ["treeData", "checkedKeys", "expandedKeys", "selectedKeys"],
    emits: ["update:checkedKeys", "update:expandedKeys", "update:selectedKeys", "check"],
    template: `
      <div class="mars-tree">
        <div
          v-for="node in treeData"
          :key="node.key || node.id"
          class="mars-tree-node"
        >
          <slot name="title" :id="node.id" :key="node.key" :title="node.title" :name="node.name" :checked="(checkedKeys || []).includes(String(node.key || node.id))" :hasOpacity="node.hasOpacity" :hasZIndex="node.hasZIndex" :disabled="node.disabled" />
        </div>
      </div>
    `
  },
  "mars-task-modal": {
    template: "<div class='mars-task-modal'><slot /></div>"
  },
  "a-dropdown": {
    template: "<div class='a-dropdown'><slot /><slot name='overlay' /></div>"
  },
  "a-button": {
    emits: ["click"],
    template: "<button @click=\"$emit('click', $event)\"><slot /></button>"
  },
  "a-menu": {
    template: "<div class='a-menu'><slot /></div>"
  },
  "a-menu-item": {
    template: "<button class='a-menu-item'><slot /></button>"
  },
  "a-menu-divider": {
    template: "<hr />"
  },
  "a-input": {
    props: ["value"],
    emits: ["update:value"],
    template: "<input :value='value' @input=\"$emit('update:value', $event.target.value)\" />"
  },
  "a-form": {
    template: "<form><slot /></form>"
  },
  "a-form-item": {
    template: "<div><slot /></div>"
  },
  "a-select": {
    template: "<div class='a-select'><slot /></div>"
  }
}

function mountManageLayers() {
  return mount(ManageLayers, {
    global: {
      stubs
    }
  })
}

async function flushUi() {
  await nextTick()
  await nextTick()
}

describe("manage-layers/index.vue", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    widgetUpdateHandler = null
    localStorage.clear()
    layerFixture.opacity = 1
    layerFixture.brightness = 1.05
    layerFixture.contrast = 1.08
    layerFixture.gamma = 0.95
    layerFixture.saturation = 1.03
    layerFixture.hue = 0
    layerFixture.show = true
    layerFixture.isAdded = true
    layerFixture.options = {
      type: "xyz",
      url: "https://example.com/tiles/{z}/{x}/{y}.png",
      metadata: {
        source: "eoapi"
      }
    }
    vectorLayerFixture.options = {
      type: "geojson",
      symbol: {
        type: "polylineP",
        styleOptions: {
          color: "#ff5a36",
          opacity: 1,
          width: 2,
          clampToGround: true
        }
      }
    }
    vectorGraphicFixture.type = "polylineP"
    vectorGraphicFixture.style = {
      color: "rgba(255,90,54,1)",
      width: 2,
      clampToGround: true
    }
    vectorGraphicFixture.setStyle.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("excludes basemaps from the layer dialog tree", async () => {
    mountManageLayers()
    await flushUi()

    expect(getLayrsTree).toHaveBeenCalledWith(expect.objectContaining({ basemaps: false }))
  })

  it("starts with every business layer unchecked when no saved state exists", async () => {
    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    expect(vm.checkedKeys).toEqual([])
    expect(layerFixture.show).toBe(false)
    expect(updateLayerShowOnly).toHaveBeenCalledWith(layerFixture, false)

    wrapper.unmount()
    vi.clearAllTimers()
  })

  it("opens layer properties from a plain tree node without parent helpers", async () => {
    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    const node = {
      id: "layer-1",
      key: "layer-1",
      title: "灾后真彩影像"
    }

    expect(() => vm.onContextMenuClick(node, "5")).not.toThrow()
    await flushUi()

    expect(vm.showLayerProps).toBe(true)
    expect(vm.inspectedLayerId).toBe("layer-1")
    expect(vm.currentLayerProps).toMatchObject({
      id: "layer-1",
      name: "灾后真彩影像",
      type: "xyz",
      source: "eoapi"
    })
  })

  it("renders structured Landsat metadata as readable property sections", async () => {
    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    vm.onContextMenuClick({ id: 402001, key: "402001", title: landsatLayerFixture.name }, "5")
    await flushUi()

    const sections = wrapper.findAll(".metadata-section")
    expect(sections).toHaveLength(4)
    expect(sections.map((section) => section.find(".prop-divider").text())).toEqual([
      "基本信息",
      "数据信息",
      "数值信息",
      "数据说明"
    ])
    expect(wrapper.text()).toContain("SP-landsat-lst-20260216")
    expect(wrapper.text()).toContain("2026-02-16 至 2026-04-15")
    expect(wrapper.text()).toContain("约 10.97～32.53")
    expect(wrapper.text()).toContain("未标注")
  })

  it("renders a metadata profile as the same four readable property sections", async () => {
    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    vm.onContextMenuClick({ id: "profiled-layer", key: "profiled-layer", title: profiledLayerFixture.name }, "5")
    await flushUi()

    const sections = wrapper.findAll(".metadata-section")
    expect(sections.map((section) => section.find(".prop-divider").text())).toEqual([
      "基本信息",
      "数据信息",
      "要素信息",
      "数据说明"
    ])
    expect(wrapper.text()).toContain("SP-china-active-faults")
    expect(wrapper.text()).toContain("10534")
    expect(wrapper.text()).toContain("EPSG:4326")
    expect(wrapper.text()).toContain("全国汇编")
  })

  it("applies opacity and raster style changes immediately and persists them", async () => {
    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    vm.inspectedLayerId = "layer-1"
    vm.showLayerProps = true
    vm.syncEditorsFromLayer(layerFixture)
    await flushUi()

    vm.opcityChange({ id: "layer-1" }, 0.4)
    expect(layerFixture.opacity).toBe(0.4)
    vm.opacityValue = {
      ...vm.opacityValue,
      "layer-1": 0.4
    }

    const styleSliders = wrapper.findAll(".layer-style-editor .mars-slider-input")
    expect(styleSliders.length).toBeGreaterThanOrEqual(5)

    await styleSliders[0].setValue("1.3")
    await styleSliders[1].setValue("1.5")
    await styleSliders[2].setValue("0.8")

    vi.advanceTimersByTime(150)
    await flushUi()

    expect(layerFixture.brightness).toBe(1.3)
    expect(layerFixture.contrast).toBe(1.5)
    expect(layerFixture.gamma).toBe(0.8)
    expect(layerFixture.options.brightness).toBe(1.3)
    expect(layerFixture.options.contrast).toBe(1.5)
    expect(layerFixture.options.gamma).toBe(0.8)
    expect(layerFixture.reload).toHaveBeenCalled()
    expect(layerFixture.refresh).toHaveBeenCalled()

    vi.advanceTimersByTime(350)
    await flushUi()

    expect(JSON.parse(localStorage.getItem("mars3d_layer_opacity_values") || "{}")).toMatchObject({
      "layer-1": 0.4
    })
    expect(JSON.parse(localStorage.getItem("mars3d_layer_raster_style_values_v1") || "{}")).toMatchObject({
      "layer-1": {
        brightness: 1.3,
        contrast: 1.5,
        gamma: 0.8
      }
    })
  })

  it("keeps the real layer opacity when persisted opacity state has no matching value", async () => {
    localStorage.setItem("mars3d_layer_opacity_values", JSON.stringify({}))
    layerFixture.opacity = 1

    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    expect(vm.opacityValue["layer-1"]).toBe(1)
    expect(layerFixture.opacity).toBe(1)

    wrapper.unmount()
    vi.clearAllTimers()
  })

  it("shows line controls and applies color, opacity and width to loaded line graphics", async () => {
    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    vm.inspectedLayerId = "vector-1"
    vm.showLayerProps = true
    vm.syncEditorsFromLayer(vectorLayerFixture)
    await flushUi()

    expect(vm.vectorStyleEditor.fillOpacity).toBe(1)
    expect(vectorLayerFixture.options.symbol.styleOptions).toMatchObject({
      color: "#ff5a36",
      opacity: 1,
      width: 2
    })

    expect(wrapper.text()).toContain("线颜色")
    expect(wrapper.text()).toContain("线透明度")
    expect(wrapper.text()).toContain("线宽")
    expect(wrapper.text()).not.toContain("描边色")
    expect(wrapper.text()).not.toContain("描边宽度")

    const styleRows = wrapper.findAll(".layer-style-editor .style-row")
    expect(styleRows).toHaveLength(3)
    await styleRows[0].find(".mars-color-picker").setValue("#00ff00")
    await styleRows[1].find(".mars-slider-input").setValue("0.4")
    await styleRows[2].find(".mars-slider-input").setValue("5")

    vi.advanceTimersByTime(150)
    await flushUi()

    expect(vectorLayerFixture.options.symbol.styleOptions).toMatchObject({
      color: "rgba(0,255,0,1)",
      width: 5
    })
    expect(vectorLayerFixture.opacity).toBe(0.4)
    expect(vm.opacityValue["vector-1"]).toBe(0.4)
    expect(vectorGraphicFixture.setStyle).toHaveBeenCalledWith(expect.objectContaining({
      color: "rgba(0,255,0,1)",
      width: 5
    }))
    expect(vectorLayerFixture.reload).not.toHaveBeenCalled()
    expect(vectorLayerFixture.refresh).not.toHaveBeenCalled()

    vi.advanceTimersByTime(350)
    await flushUi()

    expect(JSON.parse(localStorage.getItem("mars3d_layer_vector_style_values_v1") || "{}")).toMatchObject({
      "vector-1": {
        fillColor: "#00ff00",
        lineWidth: 5
      }
    })
    expect(JSON.parse(localStorage.getItem("mars3d_layer_opacity_values") || "{}")).toMatchObject({
      "vector-1": 0.4
    })
  })

  it("opens line layer properties without restyling or reloading the layer", async () => {
    const wrapper = mountManageLayers()
    await flushUi()

    vectorGraphicFixture.setStyle.mockClear()
    vectorLayerFixture.reload.mockClear()
    vectorLayerFixture.refresh.mockClear()

    const vm: any = wrapper.vm
    vm.onContextMenuClick({ id: "vector-1", key: "vector-1", title: "中国活动断层线" }, "5")
    await flushUi()
    vi.advanceTimersByTime(500)
    await flushUi()

    expect(vm.showLayerProps).toBe(true)
    expect(vectorGraphicFixture.setStyle).not.toHaveBeenCalled()
    expect(vectorLayerFixture.reload).not.toHaveBeenCalled()
    expect(vectorLayerFixture.refresh).not.toHaveBeenCalled()
  })

  it("keeps the tree opacity and line opacity controls synchronized", async () => {
    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    vm.inspectedLayerId = "vector-1"
    vm.showLayerProps = true
    vm.syncEditorsFromLayer(vectorLayerFixture)
    await flushUi()

    vm.opcityChange({ id: "vector-1" }, 0.65)
    await flushUi()

    expect(vectorLayerFixture.opacity).toBe(0.65)
    expect(vm.opacityValue["vector-1"]).toBe(0.65)
    expect(vm.vectorStyleEditor.fillOpacity).toBe(0.65)
  })

  it("restores a line layer's initial color and width while resetting its shared opacity to one", async () => {
    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    vm.inspectedLayerId = "vector-1"
    vm.showLayerProps = true
    vm.syncEditorsFromLayer(vectorLayerFixture)
    await flushUi()

    const styleRows = wrapper.findAll(".layer-style-editor .style-row")
    await styleRows[0].find(".mars-color-picker").setValue("#00ff00")
    await styleRows[1].find(".mars-slider-input").setValue("0.4")
    await styleRows[2].find(".mars-slider-input").setValue("5")
    vi.advanceTimersByTime(150)
    await flushUi()

    vm.resetLayerStyle()
    await flushUi()

    expect(vm.vectorStyleEditor).toMatchObject({
      fillColor: "#ff5a36",
      fillOpacity: 1,
      lineWidth: 2
    })
    expect(vm.opacityValue["vector-1"]).toBe(1)
    expect(vectorLayerFixture.opacity).toBe(1)
    expect(vectorLayerFixture.options.symbol.styleOptions).toMatchObject({
      color: "rgba(255,90,54,1)",
      opacity: 1,
      width: 2,
      clampToGround: true
    })
    expect(vectorGraphicFixture.setStyle).toHaveBeenCalledWith(expect.objectContaining({
      color: "rgba(255,90,54,1)",
      width: 2
    }))
  })

  it("keeps fill and outline controls for polygon graphics and applies them immediately", async () => {
    vectorLayerFixture.options.symbol = {
      type: "polygonP",
      styleOptions: {
        color: "rgba(92,173,255,0.25)",
        outline: true,
        outlineColor: "rgba(92,173,255,1)",
        outlineWidth: 2,
        clampToGround: true
      }
    }
    vectorGraphicFixture.type = "polygonP"

    const wrapper = mountManageLayers()
    await flushUi()
    const vm: any = wrapper.vm
    vm.inspectedLayerId = "vector-1"
    vm.showLayerProps = true
    vm.syncEditorsFromLayer(vectorLayerFixture)
    await flushUi()

    expect(wrapper.text()).toContain("填充色")
    expect(wrapper.text()).toContain("填充透明度")
    expect(wrapper.text()).toContain("描边色")
    expect(wrapper.text()).toContain("描边宽度")
    expect(wrapper.text()).not.toContain("线宽")

    const styleRows = wrapper.findAll(".layer-style-editor .style-row")
    await styleRows[2].find(".mars-color-picker").setValue("#ff0000")
    await styleRows[3].find(".mars-slider-input").setValue("4")
    vi.advanceTimersByTime(150)
    await flushUi()

    expect(vectorGraphicFixture.setStyle).toHaveBeenCalledWith(expect.objectContaining({
      outline: true,
      outlineColor: "#ff0000",
      outlineWidth: 4
    }))
  })

  it("uses fill and outline controls for point graphics instead of line controls", async () => {
    vectorLayerFixture.options.symbol = {
      type: "pointP",
      styleOptions: {
        color: "rgba(92,173,255,0.8)",
        pixelSize: 10,
        outline: true,
        outlineColor: "#ffffff",
        outlineWidth: 2
      }
    }
    vectorGraphicFixture.type = "pointP"

    const wrapper = mountManageLayers()
    await flushUi()
    const vm: any = wrapper.vm
    vm.inspectedLayerId = "vector-1"
    vm.showLayerProps = true
    vm.syncEditorsFromLayer(vectorLayerFixture)
    await flushUi()

    expect(vm.vectorGeometryKind).toBe("point")
    expect(wrapper.text()).toContain("填充色")
    expect(wrapper.text()).toContain("描边色")
    expect(wrapper.text()).not.toContain("线颜色")
    expect(wrapper.text()).not.toContain("线宽")
  })

  it("hides unchecked layers without removing them from tree state", async () => {
    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    vm.checkedKeys = []
    vm.checkedChange([], {
      node: {
        key: "layer-1",
        id: "layer-1",
        disabled: false,
        children: []
      },
      checked: false
    })

    expect(updateLayerShowOnly).toHaveBeenCalledWith(layerFixture, false)
    expect(layerFixture.show).toBe(false)
    expect(vm.treeData[0].children[0].id).toBe("layer-1")
  })

  it("deletes layers and cleans persisted state", async () => {
    localStorage.setItem("mars3d_layer_checked_keys", JSON.stringify(["layer-1", "vector-1"]))
    localStorage.setItem("mars3d_layer_opacity_values", JSON.stringify({ "layer-1": 0.5 }))
    localStorage.setItem("mars3d_layer_raster_style_values_v1", JSON.stringify({ "layer-1": { brightness: 1.2 } }))
    localStorage.setItem("mars3d_layer_vector_style_values_v1", JSON.stringify({ "vector-1": { pointSize: 16 } }))

    const dispatchSpy = vi.spyOn(window, "dispatchEvent")
    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    vm.checkedKeys = ["layer-1", "vector-1"]
    vm.opacityValue = { "layer-1": 0.5 }
    vm.rasterStyleValue = { "layer-1": { brightness: 1.2 } }
    vm.vectorStyleValue = { "vector-1": { pointSize: 16 } }
    vm.deleteTarget = {
      id: "layer-1",
      title: "灾后真彩影像",
      children: []
    }
    vm.deleteTargetTitle = "灾后真彩影像"
    vm.deleteDialogOpen = true
    getLayrsTree.mockReturnValueOnce({ tree: [] })

    vm.confirmDelete()
    await flushUi()

    expect(removeLayerById).toHaveBeenCalledWith("layer-1")
    expect(vm.checkedKeys).toEqual(["vector-1"])
    expect(vm.opacityValue).toEqual({})
    expect(vm.rasterStyleValue).toEqual({})
    expect(JSON.parse(localStorage.getItem("mars3d_layer_checked_keys") || "[]")).toEqual(["vector-1"])
    expect(JSON.parse(localStorage.getItem("mars3d_layer_opacity_values") || "{}")).toEqual({})
    expect(JSON.parse(localStorage.getItem("mars3d_layer_raster_style_values_v1") || "{}")).toEqual({})
    expect(dispatchSpy).toHaveBeenCalled()
  })

  it("preserves all-hidden layer state across widget page updates", async () => {
    localStorage.setItem("mars3d_layer_checked_keys", JSON.stringify([]))
    localStorage.setItem("mars3d_layer_expanded_keys", JSON.stringify(["layer-1"]))

    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    expect(vm.checkedKeys).toEqual([])
    expect(layerFixture.show).toBe(false)
    expect(updateLayerShowOnly).toHaveBeenCalledWith(layerFixture, false)

    widgetUpdateHandler?.()
    await flushUi()

    expect(vm.checkedKeys).toEqual([])
    expect(layerFixture.show).toBe(false)
    expect(vm.expandedKeys.length).toBeGreaterThan(0)
  })
})
