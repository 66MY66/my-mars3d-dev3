import { describe, expect, it } from "vitest"
import {
  DEFORMATION_IMAGERY_DEFAULT_STYLE,
  OPTICAL_IMAGERY_DEFAULT_STYLE,
  SAR_IMAGERY_DEFAULT_STYLE,
  THERMAL_IMAGERY_DEFAULT_STYLE,
  applyDefaultRasterStyleOptions,
  resolveRasterStyleProfile
} from "./layer-style-defaults"

describe("resolveRasterStyleProfile", () => {
  it("recognizes explicit optical profile and optical hints", () => {
    expect(resolveRasterStyleProfile({ options: { styleProfile: "optical" } }, "xyz")).toBe("optical")
    expect(
      resolveRasterStyleProfile(
        {
          name: "灾后真彩影像",
          data: { assetKey: "visual" }
        },
        "xyz"
      )
    ).toBe("optical")
  })

  it("excludes sar and thermal layers from optical defaults", () => {
    expect(resolveRasterStyleProfile({ name: "Sentinel-1 SAR 影像" }, "geotiff")).toBe("sar")
    expect(resolveRasterStyleProfile({ name: "热异常监测结果" }, "xyz")).toBe("thermal")
  })
})

describe("applyDefaultRasterStyleOptions", () => {
  it("fills optical raster layers with default style values", () => {
    const out: any = applyDefaultRasterStyleOptions(
      {
        id: "l1",
        type: "xyz",
        url: "https://example.com/tiles/{z}/{x}/{y}.png"
      },
      {
        name: "灾后真彩影像",
        data: { assetKey: "visual" }
      },
      "xyz"
    )

    expect(out.styleProfile).toBe("optical")
    expect(out.brightness).toBe(OPTICAL_IMAGERY_DEFAULT_STYLE.brightness)
    expect(out.contrast).toBe(OPTICAL_IMAGERY_DEFAULT_STYLE.contrast)
    expect(out.gamma).toBe(OPTICAL_IMAGERY_DEFAULT_STYLE.gamma)
    expect(out.saturation).toBe(OPTICAL_IMAGERY_DEFAULT_STYLE.saturation)
  })

  it("preserves explicit style values", () => {
    const out: any = applyDefaultRasterStyleOptions(
      {
        id: "l2",
        type: "geotiff",
        brightness: 0.9,
        contrast: 1.2,
        url: "https://example.com/a.tif"
      },
      {
        name: "RGB 影像"
      },
      "geotiff"
    )

    expect(out.brightness).toBe(0.9)
    expect(out.contrast).toBe(1.2)
    expect(out.gamma).toBe(OPTICAL_IMAGERY_DEFAULT_STYLE.gamma)
  })

  it("fills sar raster layers with default style values", () => {
    const out: any = applyDefaultRasterStyleOptions(
      {
        id: "l3",
        type: "geotiff",
        url: "https://example.com/sar.tif"
      },
      {
        name: "Sentinel-1 SAR 影像"
      },
      "geotiff"
    )

    expect(out.styleProfile).toBe("sar")
    expect(out.brightness).toBe(SAR_IMAGERY_DEFAULT_STYLE.brightness)
    expect(out.contrast).toBe(SAR_IMAGERY_DEFAULT_STYLE.contrast)
    expect(out.gamma).toBe(SAR_IMAGERY_DEFAULT_STYLE.gamma)
    expect(out.saturation).toBe(SAR_IMAGERY_DEFAULT_STYLE.saturation)
  })

  it("fills deformation layers with default style values", () => {
    const out: any = applyDefaultRasterStyleOptions(
      {
        id: "l4",
        type: "xyz",
        url: "https://example.com/tiles/{z}/{x}/{y}.png"
      },
      {
        name: "InSAR 形变结果"
      },
      "xyz"
    )

    expect(out.styleProfile).toBe("deformation")
    expect(out.contrast).toBe(DEFORMATION_IMAGERY_DEFAULT_STYLE.contrast)
    expect(out.gamma).toBe(DEFORMATION_IMAGERY_DEFAULT_STYLE.gamma)
  })

  it("fills thermal layers with default style values", () => {
    const out: any = applyDefaultRasterStyleOptions(
      {
        id: "l5",
        type: "xyz",
        url: "https://example.com/tiles/{z}/{x}/{y}.png"
      },
      {
        name: "热异常监测结果"
      },
      "xyz"
    )

    expect(out.styleProfile).toBe("thermal")
    expect(out.contrast).toBe(THERMAL_IMAGERY_DEFAULT_STYLE.contrast)
    expect(out.gamma).toBe(THERMAL_IMAGERY_DEFAULT_STYLE.gamma)
  })
})
