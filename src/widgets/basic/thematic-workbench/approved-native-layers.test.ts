import { describe, expect, it } from "vitest"
import { approvedNativeLayers } from "./approved-native-layers"
import { sortedCartographyLayers } from "./cartography-layer-order"
import type { DbtLayer } from "./dbt116-standard"
function layer(role: string): DbtLayer {
  return { id: role, name: role, role, authority: "业务机构", source: "backend", publishedAt: "2026-10-30", security: "public", crs: "EPSG:4490", scale: 100000, data: { type: "FeatureCollection", features: [] } }
}
describe("approved backend facts to native Mars3D styles", () => {
  it("uses source target codes for billboard symbols without manually placing a target", () => {
    const source = layer("target")
    source.data.features.push({ type: "Feature", geometry: { type: "Point", coordinates: [103, 27] }, properties: { symbol: "dbt-medical", label: "医院记录" } })
    const groups = approvedNativeLayers(source)
    expect(groups).toHaveLength(1); expect(groups[0].symbol.type).toBe("billboard")
    expect(groups[0].data.features[0].geometry).toEqual(source.data.features[0].geometry)
    const style = groups[0].symbol.callback(groups[0].data.features[0].properties)
    expect(style.image).toBeTruthy(); expect(style.label.text).toBe("医院记录")
    expect(source.data.features[0].properties).not.toHaveProperty("__cartographySymbol")
  })
  it("uses proportional point symbols for totals and retains the original statistical boundary", () => {
    const source = layer("population"); source.thematic = { inputMetric: "total", mode: "total", field: "population" }
    source.data.features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [[[102, 26], [103, 26], [103, 27], [102, 27], [102, 26]]] }, properties: { population: 100, name: "统计区" } })
    const original = JSON.stringify(source)
    const group = approvedNativeLayers(source)[0]
    expect(group.data.features.map(feature => feature.geometry.type)).toEqual(["Polygon", "Point"])
    expect(group.symbol.callback(group.data.features[0].properties).fill).toBe(false)
    expect(group.symbol.callback(group.data.features[1].properties).pixelSize).toBe(40)
    expect(JSON.stringify(source)).toBe(original)
  })
  it("maps declared hospital and school categories to the same symbols as the proof, without guessing from names", () => {
    const source = layer("target")
    source.data.features = ["医院", "school", "unknown"].map((category, i) => ({ type: "Feature", geometry: { type: "Point", coordinates: [103 + i / 10, 27] }, properties: { category, name: "医院附近的记录" } }))
    const groups = approvedNativeLayers(source)
    expect(groups.find(group => group.suffix === "symbols")!.data.features.map(feature => feature.properties.__cartographySymbol)).toEqual(["dbt-medical", "dbt-school"])
    expect(groups.find(group => group.suffix === "geometry")!.data.features).toHaveLength(1)
    expect(source.data.features[0].properties).not.toHaveProperty("symbol")
  })
  it("does not obscure thematic layers with filled intensity and administrative polygons", () => {
    for (const role of ["intensity", "boundary"]) {
      const source = layer(role)
      source.data.features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [[[102, 26], [103, 26], [103, 27], [102, 26]]] }, properties: { label: "边线", intensity: 7 } })
      const group = approvedNativeLayers(source)[0]
      expect(group.data.features[0].geometry.type).toBe("MultiLineString")
      expect(source.data.features[0].geometry.type).toBe("Polygon")
    }
  })
  it("keeps the map and proof layer ordering shared without mutating backend records", () => {
    const layers = [layer("intensity"), layer("population"), layer("dem"), layer("settlement")]
    expect(sortedCartographyLayers(layers, "T30102000").map(item => item.role)).toEqual(["dem", "population", "settlement", "intensity"])
    expect(layers[0].role).toBe("intensity")
  })
  it("uses the shared dashed boundary material for backend polygon boundaries without changing the semantic source", () => {
    const source = layer("boundary")
    const coordinates = [[[102, 26], [103, 26], [103, 27], [102, 26]]]
    source.data.features.push({ type: "Feature", geometry: { type: "Polygon", coordinates }, properties: { symbol: "dbt-county-boundary", label: "源行政区" } })
    const group = approvedNativeLayers(source)[0]
    expect(group.data.features[0].geometry).toEqual({ type: "MultiLineString", coordinates })
    expect(group.symbol.callback(group.data.features[0].properties)).toMatchObject({ fill: true, materialType: "PolylineDash", outline: false, closure: false })
    expect(source.data.features[0].geometry.type).toBe("Polygon")
    expect(source.data.features[0].properties).not.toHaveProperty("__labelAnchor")
  })
})
