import { describe, expect, it } from "vitest"
import { buildScopedGroupId, buildScopedLayerId, buildScopedLayerPrefix, ensureUniqueMapLayerId, normalizeLayerIdToken } from "./layer-id"

describe("layer-id helpers", () => {
  it("normalizes tokens into stable layer-safe ids", () => {
    expect(normalizeLayerIdToken("  导入 图层/A  ")).toBe("A")
    expect(normalizeLayerIdToken("layer name 01")).toBe("layer_name_01")
  })

  it("builds scoped group and layer ids", () => {
    expect(buildScopedGroupId("eoapi", "dataset-1", 123)).toBe("eoapi_group_dataset-1_123")
    expect(buildScopedLayerPrefix("eoapi", "dataset-1", 123)).toBe("eoapi_dataset-1_123_")
    expect(buildScopedLayerId("eoapi", "dataset-1", 123, "导入图层#1")).toBe("eoapi_dataset-1_123_1")
  })

  it("generates unique ids when desired id already exists", () => {
    const existed = new Set(["eoapi_a_1_layer", "eoapi_a_1_layer_2"])
    const map = {
      getLayerById(id: string) {
        return existed.has(String(id)) ? { id } : null
      }
    }
    expect(ensureUniqueMapLayerId(map, "eoapi_a_1_layer")).toBe("eoapi_a_1_layer_3")
    expect(ensureUniqueMapLayerId(map, "eoapi_a_1_new")).toBe("eoapi_a_1_new")
  })
})
