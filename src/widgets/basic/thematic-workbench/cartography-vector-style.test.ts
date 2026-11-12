import { describe, it, expect } from "vitest"
import { basegeoFeatureSymbol, basegeoFallback, nativeVectorPaint, vectorPaint, paintDash } from "./cartography-vector-style"
describe("shared semantic map, proof and legend styles", () => {
  it("uses documented basegeo feature codes without mistaking geographic names for classification", () => {
    expect(basegeoFeatureSymbol("H48_build_BOUL", { GB: 630201 })).toBe("dbt-province-boundary")
    expect(basegeoFeatureSymbol("H48_build_BOUL", { GB: 650200 })).toBe("dbt-county-boundary")
    expect(basegeoFeatureSymbol("H48_build_LRDL", { GB: 420101, RTEG: "二级" })).toBe("dbt-national-road")
    expect(basegeoFeatureSymbol("H48_build_LRDL", { GB: 420101, RTEG: "高速" })).toBe("dbt-expressway")
    expect(basegeoFeatureSymbol("H48_build_LRDL", { GB: 420102, RTEG: "高速" })).toBeUndefined()
    expect(basegeoFeatureSymbol("H48_build_BOUL", { GB: 999999, NAME: "省界" })).toBeUndefined()
    expect(basegeoFeatureSymbol("H48_build_AGNP", { GNID: "510129106000", NAME: "镇" })).toBeUndefined()
  })
  it("maps actual water categories and does not give a reservoir symbol to every water polygon", () => {
    expect(basegeoFeatureSymbol("H48_build_HYDA", { GB: 240101 })).toBe("dbt-reservoir")
    expect(basegeoFeatureSymbol("H48_build_HYDA", { GB: 230101 })).toBe("dbt-lake")
    expect(basegeoFeatureSymbol("H48_build_HYDA", { GB: 260200 })).toBeUndefined()
    const island = vectorPaint(undefined, basegeoFallback("H48_build_HYDA", { GB: 260200 }))
    expect(island.fill).not.toBe(vectorPaint("dbt-reservoir").fill)
    expect(nativeVectorPaint(vectorPaint(undefined, basegeoFallback("H48_build_LRDL", { GB: 420102 })), true).materialType).toBe("PolylineDash")
  })
  it("shares boundary patterns and hierarchy without implicit line outlines", () => {
    const province = vectorPaint("dbt-province-boundary"); const county = vectorPaint("dbt-county-boundary")
    expect(province.width).toBeGreaterThan(county.width)
    expect(paintDash(province).reduce((a, b) => a + b, 0)).toBe(province.period)
    expect(nativeVectorPaint(province, true)).toMatchObject({ fill: true, outline: false, closure: false, materialType: "PolylineDash", materialOptions: { color: province.color, dashPattern: province.pattern } })
    const road = vectorPaint("dbt-national-road")
    expect(nativeVectorPaint(road, true)).toMatchObject({ materialType: "PolylineOutline", outline: false, materialOptions: { color: road.casing, outlineColor: road.color } })
  })
})
