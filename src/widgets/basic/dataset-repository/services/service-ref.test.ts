import { describe, expect, it, vi } from "vitest"
import { canAddServiceRefToMap, copyServiceRefUrl, isLikely3DServiceRef, openServiceRefUrl, resolveServiceRefUrl } from "./service-ref"

describe("service-ref", () => {
  it("resolves urlTemplate with url fallback", () => {
    expect(resolveServiceRefUrl({ urlTemplate: "https://example.com/{z}/{x}/{y}.png" } as any)).toBe("https://example.com/{z}/{x}/{y}.png")
    expect(resolveServiceRefUrl({ url: "https://example.com/service" } as any)).toBe("https://example.com/service")
  })

  it("prefers fallback 2D url for 3D service ref", () => {
    const url = resolveServiceRefUrl({
      type: "3dtiles",
      urlTemplate: "https://example.com/3d/tileset.json",
      metadata: {
        url2d: "https://example.com/2d/{z}/{x}/{y}.png"
      }
    } as any)
    expect(url).toBe("https://example.com/2d/{z}/{x}/{y}.png")
    expect(isLikely3DServiceRef({
      type: "3dtiles",
      urlTemplate: "https://example.com/3d/tileset.json"
    } as any)).toBe(true)
  })

  it("supports map add only for xyz service", () => {
    expect(canAddServiceRefToMap({ type: "xyz" } as any)).toBe(true)
    expect(canAddServiceRefToMap({ type: "wms" } as any)).toBe(false)
    expect(canAddServiceRefToMap({ type: "wmts" } as any)).toBe(false)
    expect(canAddServiceRefToMap({ type: "mvt" } as any)).toBe(false)
  })

  it("opens service url in new tab", () => {
    const open = vi.fn()
    vi.stubGlobal("open", open)
    expect(openServiceRefUrl({ urlTemplate: "https://example.com/tiles" } as any)).toBe(true)
    expect(open).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("copies service url via clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    await expect(copyServiceRefUrl({ urlTemplate: "https://example.com/tiles" } as any)).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith("https://example.com/tiles")
  })
})
