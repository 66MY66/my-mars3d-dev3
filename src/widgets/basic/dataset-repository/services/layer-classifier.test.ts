import { describe, expect, it } from "vitest"
import { classifyLayer, DEFAULT_GROUP } from "./layer-classifier"

describe("layer-classifier", () => {
  it("classifies raster layers", () => {
    expect(classifyLayer({ type: "raster", format: "COG", source: "Sentinel-1" })).toBe("栅格/Sentinel-1")
    expect(classifyLayer({ sourceType: "wmts", source: "天地图影像" })).toBe("栅格/天地图影像")
  })

  it("classifies vector layers", () => {
    expect(classifyLayer({ type: "vector", format: "GeoJSON", source: "OSM" })).toBe("矢量/OSM")
    expect(classifyLayer({ sourceType: "shp", source: "本地上传" })).toBe("矢量/本地上传")
  })

  it("classifies result and basemap layers", () => {
    expect(classifyLayer({ type: "result", format: "PDF", source: "专题图" })).toBe("成果/专题图")
    expect(classifyLayer({ type: "basemap", source: "影像底图" })).toBe("底图/影像底图")
  })

  it("returns the default group for unknown layers", () => {
    expect(classifyLayer({ type: "unknown" })).toBe(DEFAULT_GROUP)
  })
})
