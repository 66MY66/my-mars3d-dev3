import { describe, expect, it } from "vitest"
import { MARS3D_BRANDING_SELECTOR, isMarsBrandingElement } from "./branding"

describe("Mars3D branding cleanup", () => {
  it("matches Cesium credit containers and Mars3D links", () => {
    const root = document.createElement("div")
    root.innerHTML = `
      <div class="cesium-widget-credits"></div>
      <a href="https://mars3d.cn">Mars3D</a>
      <img src="https://data.mars3d.cn/img/logo.png" />
    `

    expect(root.querySelectorAll(MARS3D_BRANDING_SELECTOR)).toHaveLength(3)
  })

  it("identifies branding without matching unrelated map UI", () => {
    const branding = document.createElement("span")
    branding.textContent = "火星科技"
    const control = document.createElement("button")
    control.textContent = "地图工具"

    expect(isMarsBrandingElement(branding)).toBe(true)
    expect(isMarsBrandingElement(control)).toBe(false)
  })
})
