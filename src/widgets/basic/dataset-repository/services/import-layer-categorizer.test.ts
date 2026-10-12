import { describe, expect, it } from "vitest"
import { categorizeLayersForImport } from "./import-layer-categorizer"

describe("import-layer-categorizer", () => {
  it("groups imported layers by top-level category and falls back to 临时图层", () => {
    const result = categorizeLayersForImport([
      { id: "r-1", name: "影像图层", sourceType: "wmts", order: 2 },
      { id: "v-1", name: "矢量图层", sourceType: "geojson", order: 1 },
      { id: "m-1", name: "模型图层", sourceType: "3dtiles", order: 3 },
      { id: "u-1", name: "未知图层", sourceType: "mystery", order: 4 }
    ], "demo")

    const groups = result.filter((item) => item.sourceType === "group")
    expect(groups.map((item) => item.name)).toEqual(["栅格", "矢量", "三维", "临时图层"])
    expect(result.find((item) => item.id === "r-1")?.pid).toBe("__type_raster_demo")
    expect(result.find((item) => item.id === "v-1")?.pid).toBe("__type_vector_demo")
    expect(result.find((item) => item.id === "m-1")?.pid).toBe("__type_3d_demo")
    expect(result.find((item) => item.id === "u-1")?.pid).toBe("__type_temp_demo")
  })

  it("preserves existing group hierarchy when valid pid relations already exist", () => {
    const layers = categorizeLayersForImport([
      { id: "group-a", name: "已有分组", sourceType: "group" },
      { id: "layer-a", name: "已有图层", sourceType: "geojson", pid: "group-a" }
    ], "demo")

    expect(layers).toEqual([
      { id: "group-a", name: "已有分组", sourceType: "group", order: 0 },
      { id: "layer-a", name: "已有图层", sourceType: "geojson", pid: "group-a", order: 1 }
    ])
  })

  it("returns an empty array for empty input", () => {
    expect(categorizeLayersForImport([], "demo")).toEqual([])
  })
})
