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

  it("supports the service types currently handled by the map adapter", () => {
    for (const type of ["xyz", "wms", "wmts", "mvt"]) {
      expect(canAddServiceRefToMap({ type, url: "https://example.com/service" } as any)).toBe(true)
    }
  })

  it("rejects unsupported services and service refs without usable URLs", () => {
    expect(canAddServiceRefToMap({ type: "unsupported", url: "https://example.com/service" } as any)).toBe(false)
    expect(canAddServiceRefToMap({ type: "xyz" } as any)).toBe(false)
    expect(canAddServiceRefToMap({ type: "wms", url: "" } as any)).toBe(false)
    expect(canAddServiceRefToMap({ type: "3dtiles", url: "https://example.com/3d/tileset.json" } as any)).toBe(false)
  })

  it("allows a 3D service when it provides a usable 2D fallback", () => {
    expect(canAddServiceRefToMap({
      type: "3dtiles",
      url: "https://example.com/3d/tileset.json",
      fallbackUrl: "https://example.com/{z}/{x}/{y}.png"
    } as any)).toBe(true)
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
