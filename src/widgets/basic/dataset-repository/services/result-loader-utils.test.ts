import { describe, expect, it } from "vitest"
import { inferResultFileKind, validateResultFile } from "./result-loader-utils"

describe("result-loader-utils", () => {
  it("infers supported result file kinds", () => {
    expect(inferResultFileKind(new File(["x"], "demo.png", { type: "image/png" }))).toBe("image")
    expect(inferResultFileKind(new File(["x"], "report.pdf", { type: "application/pdf" }))).toBe("document")
    expect(inferResultFileKind(new File(["{}"], "feature.geojson", { type: "application/geo+json" }))).toBe("geojson")
    expect(inferResultFileKind(new File(["x"], "elevation.tif", { type: "image/tiff" }))).toBe("geotiff")
  })

  it("rejects unsupported result files", () => {
    const result = validateResultFile(new File(["x"], "archive.zip", { type: "application/zip" }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain("仅支持")
  })
})
