import { mount } from "@vue/test-utils"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { nextTick } from "vue"

const messageSpy = vi.fn()
const getRevisionManifest = vi.fn()

vi.mock("@mars/components/mars-ui/index", () => ({
  $message: messageSpy
}))

vi.mock("../services/eoapi-datasets", () => ({
  getRevisionManifest
}))

const ImportDatasetDialog = (await import("./ImportDatasetDialog.vue")).default

async function flushUi() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

function mountDialog() {
  return mount(ImportDatasetDialog, {
    props: {
      open: true,
      datasetId: "ds_1",
      defaultRevisionId: "rev_saved",
      revisions: [
        {
          id: "rev_latest",
          properties: { title: "最新版本", published: "2026-07-15T10:00:00Z", datetime: "2026-07-15T10:00:00Z" }
        },
        {
          id: "rev_saved",
          properties: { title: "保存版本", published: "2026-07-14T10:00:00Z", datetime: "2026-07-14T10:00:00Z" }
        }
      ] as any
    },
    attachTo: document.body,
    global: {
      stubs: {
        teleport: true,
        transition: false,
        "mars-task-modal": {
          props: ["open", "title", "okLoading", "okText", "cancelText"],
          emits: ["update:open", "ok", "cancel"],
          template: `
            <div v-if="open" class="mars-task-modal">
              <div class="modal-title">{{ title }}</div>
              <button class="ok-btn" @click="$emit('ok')">{{ okText }}</button>
              <button class="cancel-btn" @click="$emit('cancel')">{{ cancelText }}</button>
              <slot />
            </div>
          `
        },
        "a-alert": { template: "<div class='a-alert'><slot /></div>" },
        "a-progress": { template: "<div class='a-progress'></div>" },
        "a-form": { template: "<form class='a-form'><slot /></form>" },
        "a-form-item": {
          props: ["label"],
          template: "<label class='a-form-item'><span>{{ label }}</span><slot /></label>"
        },
        "a-radio-group": { template: "<div class='a-radio-group'><slot /></div>" },
        "a-radio": {
          props: ["value"],
          template: "<span class='a-radio'><slot /></span>"
        },
        "a-select": { template: "<div class='a-select'><slot /></div>" },
        "a-select-option": { template: "<div class='a-select-option'><slot /></div>" },
        "a-button": {
          props: ["disabled", "loading", "size", "danger"],
          emits: ["click"],
          template: "<button :disabled='disabled' @click=\"$emit('click', $event)\"><slot /></button>"
        },
        "a-spin": { template: "<div class='a-spin'><slot /></div>" },
        "a-empty": { template: "<div class='a-empty'></div>" },
        "a-tree": { template: "<div class='a-tree'></div>" },
        "a-upload-dragger": { template: "<div class='a-upload-dragger'><slot /></div>" },
        "a-input": { template: "<input />" },
        "a-input-password": { template: "<input type='password' />" },
        "a-input-number": { template: "<input type='number' />" },
        "a-checkbox": { template: "<label><slot /></label>" }
      }
    }
  })
}

describe("ImportDatasetDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
    getRevisionManifest.mockResolvedValue({
      success: true,
      data: {
        layers: [
          { id: "group_1", type: "group", name: "分组A" },
          { id: "layer_1", pid: "group_1", type: "image", name: "图层A" }
        ]
      }
    })
  })

  it("submits saved revision mode with selected revision id", async () => {
    const wrapper = mountDialog()
    await flushUi()

    ;(wrapper.vm as any).sourceMode = "revision"
    ;(wrapper.vm as any).timeMode = "saved"
    ;(wrapper.vm as any).revisionId = "rev_saved"

    await (wrapper.vm as any).handleOk()
    await flushUi()

    const payload = wrapper.emitted("submit")?.[0]?.[0] as any
    expect(payload).toMatchObject({
      mode: "revision",
      revisionId: "rev_saved",
      timeMode: "saved",
      strategy: "overlay"
    })
  })

  it("switches to latest mode and submits latest revision id", async () => {
    const wrapper = mountDialog()
    await flushUi()

    ;(wrapper.vm as any).sourceMode = "revision"
    ;(wrapper.vm as any).revisionId = "rev_saved"
    ;(wrapper.vm as any).timeMode = "latest"
    await flushUi()

    expect(String((wrapper.vm as any).revisionHelpText)).toContain("当前将导入最新版本")
    expect(getRevisionManifest).toHaveBeenLastCalledWith("ds_1", "rev_latest")

    await (wrapper.vm as any).handleOk()
    await flushUi()

    const payload = wrapper.emitted("submit")?.[0]?.[0] as any
    expect(payload).toMatchObject({
      mode: "revision",
      revisionId: "rev_latest",
      timeMode: "latest",
      strategy: "overlay"
    })
  })
})
