import { describe, expect, it } from "vitest"
import { dbtTemplates } from "./dbt116-standard"
import { templateLayoutPlate } from "./template-layout-preview"

describe("fixed-format template preview", () => {
  it.each(dbtTemplates)("retains the complete $name title and its own product contract", template => {
    const { id, plate } = templateLayoutPlate(template.name)
    expect(id).toBe(template.id)
    expect(plate.title).toBe(template.name)
    expect(plate.description).toBe(template.summary)
    expect(plate.generic).toBe(false)
  })
  it("does not pass an emergency data contract off as a generic expression method", () => {
    const { plate } = templateLayoutPlate("分级设色")
    expect(plate.title).toBe("分级设色")
    expect(plate.generic).toBe(true)
    expect(plate.description).toContain("不包含示例业务数据")
  })
})
