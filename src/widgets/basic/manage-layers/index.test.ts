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
      applyVectorStyleByGeometry: true,
      styleOptions: {
        color: "rgba(92,173,255,0.25)",
        outline: true,
        outlineColor: "rgba(92,173,255,1)",
        outlineWidth: 2,
        pixelSize: 10
      }
    }
  },
  reload: vi.fn(),
  refresh: vi.fn()
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
        applyVectorStyleByGeometry: true,
        styleOptions: {
          color: "rgba(92,173,255,0.25)",
          outline: true,
          outlineColor: "rgba(92,173,255,1)",
          outlineWidth: 2,
          pixelSize: 10
        }
      }
    }
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it("applies vector point size and label field changes and persists them", async () => {
    const wrapper = mountManageLayers()
    await flushUi()

    const vm: any = wrapper.vm
    vm.inspectedLayerId = "vector-1"
    vm.showLayerProps = true
    vm.syncEditorsFromLayer(vectorLayerFixture)
    await flushUi()

    const styleRows = wrapper.findAll(".layer-style-editor .style-row")
    expect(styleRows.length).toBeGreaterThanOrEqual(6)

    const pointSlider = styleRows[4].find(".mars-slider-input")
    await pointSlider.setValue("18")

    const labelInput = styleRows[5].find("input")
    await labelInput.setValue("name")

    vi.advanceTimersByTime(150)
    await flushUi()

    expect(vectorLayerFixture.options.symbol.styleOptions.pixelSize).toBe(18)
    expect(vectorLayerFixture.options.symbol.styleOptions.labelField).toBe("name")
    expect(vectorLayerFixture.options.symbol.styleOptions.label).toMatchObject({
      text: "{name}"
    })
    expect(vectorLayerFixture.reload).toHaveBeenCalled()
    expect(vectorLayerFixture.refresh).toHaveBeenCalled()

    vi.advanceTimersByTime(350)
    await flushUi()

    expect(JSON.parse(localStorage.getItem("mars3d_layer_vector_style_values_v1") || "{}")).toMatchObject({
      "vector-1": {
        pointSize: 18,
        labelField: "name"
      }
    })
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
