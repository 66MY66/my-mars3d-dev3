import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

const setCurrentDataset = vi.fn()
const messageSpy = vi.fn()

vi.mock("@/shell/currentDataset", () => ({
  setCurrentDataset
}))

vi.mock("@mars/components/mars-ui/index", () => ({
  $message: messageSpy
}))

vi.mock("../dataset-repository/components/SaveManifestDialog.vue", () => ({
  default: {
    props: ["open"],
    emits: ["update:open", "saved"],
    template: `
      <div class="save-manifest-dialog" :data-open="String(open)">
        <button class="close-btn" @click="$emit('update:open', false)">close</button>
        <button class="save-btn" @click="$emit('saved', { datasetId: 'ds-1', revisionId: 'rev-1' })">save</button>
      </div>
    `
  }
}))

const SaveResult = (await import("./index.vue")).default

describe("save-result/index.vue", () => {
  it("defaults closed when widget visible prop is absent", () => {
    const wrapper = mount(SaveResult)
    expect(wrapper.find(".save-manifest-dialog").attributes("data-open")).toBe("false")
  })

  it("forwards visible state to dialog", async () => {
    const wrapper = mount(SaveResult, {
      props: {
        visible: true
      }
    })

    expect(wrapper.find(".save-manifest-dialog").attributes("data-open")).toBe("true")

    await wrapper.setProps({ visible: false })
    expect(wrapper.find(".save-manifest-dialog").attributes("data-open")).toBe("false")
  })

  it("emits update:visible false when dialog closes itself", async () => {
    const wrapper = mount(SaveResult, {
      props: {
        visible: true
      }
    })

    await wrapper.find(".close-btn").trigger("click")
    expect(wrapper.emitted("update:visible")).toEqual([[false]])
  })

  it("closes wrapper and updates current dataset after save", async () => {
    const wrapper = mount(SaveResult, {
      props: {
        visible: true
      }
    })

    await wrapper.find(".save-btn").trigger("click")

    expect(setCurrentDataset).toHaveBeenCalledWith({
      datasetId: "ds-1",
      name: "ds-1",
      source: "save"
    })
    expect(messageSpy).toHaveBeenCalledWith("已保存，可在“我的仓库”查看")
    expect(wrapper.emitted("update:visible")).toEqual([[false]])
  })
})
