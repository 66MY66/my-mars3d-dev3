import { describe, expect, it, vi } from "vitest"

import { buildThematicResultGroup } from "./thematic-group"

vi.mock("./layer-id", () => ({
  normalizeLayerIdToken: (id: string) => id.replace(/[^a-zA-Z0-9]+/g, "_")
}))

describe("thematic-group", () => {
  it("builds dedicated result root and thematic subgroup ids", () => {
    expect(buildThematicResultGroup("ds-1")).toEqual({
      rootGroupId: "myrepo_group_ds_1_results",
      rootGroupName: "数据集成果/ds-1",
      thematicGroupId: "myrepo_group_ds_1_results__thematics",
      thematicGroupName: "专题图"
    })
  })
})
