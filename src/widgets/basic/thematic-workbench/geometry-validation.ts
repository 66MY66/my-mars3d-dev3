import { booleanValid } from "@turf/turf"
import type { Feature } from "geojson"

export function validVectorGeometry(feature: Feature): boolean {
  if (feature.geometry?.type === "MultiLineString") {
    // GeoJSON allows one path; Turf incorrectly requires two in its multi-line check.
    return feature.geometry.coordinates.length > 0 && feature.geometry.coordinates.every(coordinates =>
      booleanValid({ ...feature, geometry: { type: "LineString", coordinates } })
    )
  }
  return booleanValid(feature)
}
