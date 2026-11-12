import { dbtFeatureSymbol, type DbtLayer } from "./dbt116-standard"
import { dbtSymbolDefinitions } from "./dbt116-symbols"
import { compositionSymbolImage } from "./composition-symbols"
import { styleSocioeconomicLayer } from "./socioeconomic-style"
import type { TemplateDocument } from "./template-renderer"
import { pointOnFeature } from "@turf/turf"
import { layerGeographicLabels, type LabelEventContext } from "./cartography-labels"
import { nativeVectorPaint, vectorPaint, vectorPaints } from "./cartography-vector-style"

export function approvedNativeLayers(source: DbtLayer, event?: LabelEventContext) {
  const layer = styleSocioeconomicLayer(source)
  const displayFeatures = layer.data.features.flatMap(feature => {
    if (["boundary", "intensity", "pga"].includes(layer.role) && ["Polygon", "MultiPolygon"].includes(feature.geometry.type)) {
      const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
      const coordinates = feature.properties?.cartographyOutline || (geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat())
      return [{ ...feature, geometry: { type: "MultiLineString" as const, coordinates }, properties: { ...feature.properties, __labelAnchor: pointOnFeature(feature).geometry.coordinates } }]
    }
    if (feature.properties?.thematicMode !== "total" || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) { return [feature] }
    const anchor = pointOnFeature(feature)
    return [{ ...feature, properties: { ...feature.properties, __outlineOnly: true } }, { ...anchor, properties: { ...feature.properties } }]
  })
  const groups = [true, false].map(symbols => {
    const features = displayFeatures.filter(feature => {
      const symbol = dbtFeatureSymbol(layer, feature)
      return !!symbol && dbtSymbolDefinitions[symbol].geometry === "point" && ["Point", "MultiPoint"].includes(feature.geometry.type) ? symbols : !symbols
    }).map(feature => ({ ...feature, properties: { ...feature.properties, __cartographySymbol: dbtFeatureSymbol(layer, feature), __lineGeometry: /LineString$/.test(feature.geometry.type), __polygonGeometry: /Polygon$/.test(feature.geometry.type) } }))
    const data = { ...layer.data, features, metadata: { crs: layer.crs, source: layer.source, usage: "operational" } } as TemplateDocument
    const outline = ["fault", "intensity"].includes(layer.role) ? "#df2436" : "#52656b"
    const symbol = {
      ...(symbols ? { type: "billboard" } : {}),
      styleOptions: { color: layer.color || "#dce6e8", outline: true, outlineColor: outline, outlineWidth: 1.5, width: 2, clampToGround: true },
      callback: (attr: Record<string, any>) => {
        const kind = attr.__cartographySymbol
        const label = { text: String(attr.label || attr.name || ""), font_size: 15, color: "#17233d", outline: true, outlineColor: "#ffffff", outlineWidth: 3, pixelOffsetY: -18, distanceDisplayCondition: true, distanceDisplayCondition_far: 800000 }
        if (symbols && Object.hasOwn(dbtSymbolDefinitions, kind)) { return { image: compositionSymbolImage(kind, "#202020"), width: 24, height: 24, label, clampToGround: true } }
        const fill = !attr.__outlineOnly && !["intensity", "boundary", "pga", "rescue-area"].includes(layer.role)
        const rawColor = /^#[\da-f]{6}$/i.test(attr.color || "") ? attr.color : layer.color || "#dce6e8"
        const color = ["fault", "intensity"].includes(layer.role) ? outline : rawColor
        const cartographic = Object.hasOwn(vectorPaints, kind || "") ? nativeVectorPaint(vectorPaint(kind), attr.__lineGeometry) : {}
        return { color, fill, pixelSize: Math.max(3, Math.min(40, Number(attr.thematicRadius) * 2 || 8)), ...cartographic, label: attr.__outlineOnly ? undefined : label, clampToGround: true }
      }
    }
    const labels = layerGeographicLabels({ ...layer, data: { type: "FeatureCollection", features: features.filter(feature => !(feature.properties as Record<string, unknown>).__outlineOnly) } }, event)
    return { suffix: symbols ? "symbols" : "geometry", data, symbol, labels }
  })
  return groups.filter(group => group.data.features.length)
}
