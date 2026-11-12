import { describe, expect, it } from "vitest"
import { point, polygon, featureCollection } from "@turf/turf"
import { selectContentRole } from "./content-role-selection"

const shape = (properties: any) => polygon([[[100, 20], [101, 20], [101, 21], [100, 21], [100, 20]]], properties)
const document = (features: any[]) => ({ ...featureCollection(features), metadata: {} }) as any

describe("select semantic roles from actual features, not whole filenames", () => {
  it("does not call every water body a reservoir", () => {
    const source = document([shape({ GB: 240101, HYDC: "R1", NAME: "水库" }), shape({ GB: 230101, HYDC: "L1", NAME: "湖泊" }), shape({ GB: 260200, HYDC: "I1", NAME: "岛屿" })])
    const result = selectContentRole(source, "target-2")
    expect(result.features).toHaveLength(1)
    expect(result.features[0].properties.GB).toBe(240101)
    expect(result.metadata.contentSelection).toEqual({ role: "target-2", sourceFeatureCount: 3, selectedFeatureCount: 1 })
    expect(source.features).toHaveLength(3)
  })
  it("does not draw epicenter points as intensity polygons", () => {
    const source = document([shape({ intensity: 7 }), point([100.5, 20.5], { magnitude: 7 })])
    expect(selectContentRole(source, "assessment-intensity").features).toHaveLength(1)
  })
  it("retains raw files and requires actual confirmation before calling hazards confirmed", () => {
    const source = document([shape({ hazard_type: "滑坡", status: "待核查", severity: 2 }), shape({ hazard_type: "滑坡", status: "已确认", severity: 1 })])
    expect(selectContentRole(source, "hazard").features).toHaveLength(1)
    expect(selectContentRole(source, "hazard-reference").features).toHaveLength(2)
    expect(() => selectContentRole(source, "target-0")).toThrow("没有符合当前专题用途")
  })
})
