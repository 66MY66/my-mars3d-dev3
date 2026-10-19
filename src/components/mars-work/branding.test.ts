import { describe, expect, it } from "vitest"
import {
  MARS3D_BRANDING_SELECTOR,
  concealMarsLogoPrimitive,
  installMarsLogoPrimitiveGuard,
  isMarsBrandingElement,
  isMarsLogoPrimitive,
  sweepMarsLogoPrimitives
} from "./branding"

describe("Mars3D branding cleanup", () => {
  it("matches Cesium credit containers and Mars3D links", () => {
    const root = document.createElement("div")
    root.innerHTML = `
      <div class="cesium-widget-credits"></div>
      <div class="cesium-credit-logoContainer"><img src="/mars3d-logo.png" /></div>
      <a href="https://mars3d.cn">Mars3D</a>
      <img src="https://data.mars3d.cn/img/logo.png" />
    `

    expect(root.querySelectorAll(MARS3D_BRANDING_SELECTOR)).toHaveLength(4)
    expect(root.querySelector(".cesium-widget-credits")).not.toBeNull()
  })

  it("identifies branding without matching unrelated map UI", () => {
    const branding = document.createElement("span")
    branding.textContent = "火星科技"
    const control = document.createElement("button")
    control.textContent = "地图工具"

    expect(isMarsBrandingElement(branding)).toBe(true)
    expect(isMarsBrandingElement(control)).toBe(false)
  })

  it("hides only the canvas logo primitive and still adds other primitives", () => {
    const added: any[] = []
    const primitives = {
      length: 0,
      items: [] as any[],
      get(index: number) {
        return this.items[index]
      },
      add(primitive: any) {
        this.items.push(primitive)
        this.length = this.items.length
        added.push(primitive)
        return primitive
      }
    }
    const logo = { _mhan: true, show: true, rectangle: { width: 130, height: 39 } }
    const layer = { show: true, rectangle: { width: 10, height: 10 } }

    expect(isMarsLogoPrimitive(logo)).toBe(true)
    expect(isMarsLogoPrimitive(layer)).toBe(false)

    const stop = installMarsLogoPrimitiveGuard(primitives as any)
    primitives.add(layer)
    primitives.add(logo)
    logo.show = true
    logo.rectangle.width = 130
    sweepMarsLogoPrimitives(primitives)

    expect(added).toEqual([layer, logo])
    expect(layer.show).toBe(true)
    expect(layer.rectangle.width).toBe(10)
    expect(logo.show).toBe(false)
    expect(logo.rectangle.width).toBe(0)
    expect(logo.rectangle.height).toBe(0)
    expect(concealMarsLogoPrimitive(layer)).toBe(false)

    stop()
    const restored = { show: true, rectangle: { width: 4, height: 4 } }
    primitives.add(restored)
    expect(restored.show).toBe(true)
  })
})
