import { area, booleanValid, featureCollection, polygon, union } from "@turf/turf"

// A multipart region denotes a set union, not double-counted overlapping parts.
// Repair only overlaps between individually valid parts; never guess self-intersections.
export function normalizeContentGeometry(raw: any) {
  if (raw?.type !== "FeatureCollection" || !Array.isArray(raw.features)) { return raw }
  const records: Record<string, any>[] = []
  const features = raw.features.map((feature: any, index: number) => {
    if (feature?.geometry?.type !== "MultiPolygon") { return feature }
    try {
      if (booleanValid(feature)) { return feature }
      const parts = feature.geometry.coordinates.map((coordinates: any) => polygon(coordinates))
      if (parts.length < 2 || !parts.every(booleanValid)) { return feature }
      const merged = union(featureCollection(parts))
      if (!merged || !booleanValid(merged)) { return feature }
      records.push({ sourceFeatureId: String(feature.properties?.sourceFeatureId ?? feature.id ?? index), operation: "union-overlapping-valid-parts", originalParts: parts.length, resultParts: merged.geometry.type === "Polygon" ? 1 : merged.geometry.coordinates.length, sourceAreaM2: area(feature), unionAreaM2: area(merged) })
      return { ...feature, geometry: merged.geometry }
    } catch { return feature }
  })
  return records.length ? { ...raw, features, metadata: { ...raw.metadata, geometryNormalizations: [...raw.metadata?.geometryNormalizations || [], ...records] } } : raw
}
