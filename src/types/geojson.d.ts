declare module "geojson" {
  export type Position = number[]
  export type Geometry = any
  export type GeometryCollection<G extends Geometry = Geometry> = any
  export type Feature<G extends Geometry = Geometry, P = Record<string, unknown>> = any
  export type FeatureCollection<G extends Geometry = Geometry, P = Record<string, unknown>> = any
  export type Polygon = Geometry & { type: "Polygon"; coordinates: Position[][] }
  export type MultiPolygon = Geometry & { type: "MultiPolygon"; coordinates: Position[][][] }
  export type LineString = Geometry & { type: "LineString"; coordinates: Position[] }
  export type MultiLineString = Geometry & { type: "MultiLineString"; coordinates: Position[][] }
  export type MultiPoint = Geometry & { type: "MultiPoint"; coordinates: Position[] }
}
