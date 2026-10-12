import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import ArtifactPreview from "./ArtifactPreview.vue"

describe("ArtifactPreview", () => {
  it("renders img for image mime", () => {
    const wrapper = mount(ArtifactPreview, {
      props: { url: "https://example.com/a.png", mime: "image/png" },
      global: { stubs: { "a-empty": { template: "<div class='a-empty'></div>" } } }
    })
    const img = wrapper.find("img")
    expect(img.exists()).toBe(true)
    expect(img.attributes("src")).toBe("https://example.com/a.png")
    expect(wrapper.find("iframe").exists()).toBe(false)
  })

  it("renders iframe for pdf by extension", () => {
    const wrapper = mount(ArtifactPreview, {
      props: { url: "https://example.com/a.pdf" },
      global: { stubs: { "a-empty": { template: "<div class='a-empty'></div>" } } }
    })
    const iframe = wrapper.find("iframe")
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes("src")).toBe("https://example.com/a.pdf")
  })

  it("renders iframe for html by mime", () => {
    const wrapper = mount(ArtifactPreview, {
      props: { url: "https://example.com/a", mime: "text/html" },
      global: { stubs: { "a-empty": { template: "<div class='a-empty'></div>" } } }
    })
    const iframe = wrapper.find("iframe")
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes("src")).toBe("https://example.com/a")
  })

  it("renders external link for other types", () => {
    const wrapper = mount(ArtifactPreview, {
      props: { url: "https://example.com/a.zip", mime: "application/zip" },
      global: { stubs: { "a-empty": { template: "<div class='a-empty'></div>" } } }
    })
    const link = wrapper.find("a")
    expect(link.exists()).toBe(true)
    expect(link.attributes("href")).toBe("https://example.com/a.zip")
    expect(link.attributes("target")).toBe("_blank")
  })
})
