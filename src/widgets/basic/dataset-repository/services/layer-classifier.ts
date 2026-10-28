export const DEFAULT_GROUP = "临时图层"

export type LayerMetadata = {
  type?: string
  sourceType?: string
  format?: string
  source?: string
  name?: string
}

function detectCategory(layer: LayerMetadata): "raster" | "vector" | "result" | "basemap" | "unknown" {
  const type = String(layer.type || layer.sourceType || "").toLowerCase()
  const format = String(layer.format || "").toLowerCase()

  if (["xyz", "image", "img", "png", "jpg", "jpeg", "webp", "geotiff", "tif", "tiff", "cog", "wmts", "wms", "raster"].includes(type)) {
    return "raster"
  }
  if (["geojson", "json", "csv", "shp", "shapefile", "mvt", "vector"].includes(type)) {
    return "vector"
  }
  if (["pdf", "html", "htm", "document", "result", "model", "gltf", "glb"].includes(type)) {
    return "result"
  }
  if (["basemap", "base-map", "base_map"].includes(type)) {
    return "basemap"
  }

  if (["image", "img", "png", "jpg", "jpeg", "webp", "cog", "geotiff", "tif", "tiff", "xyz", "wmts", "wms"].includes(format)) {
    return "raster"
  }
  if (["geojson", "csv", "shp", "mvt"].includes(format)) {
    return "vector"
  }
  if (["pdf", "html", "htm", "gltf", "glb"].includes(format)) {
    return "result"
  }

  return "unknown"
}

function normalizeSource(layer: LayerMetadata): string {
  const source = String(layer.source || layer.name || "").trim()
  return source || "未分类"
}

export function classifyLayer(layer: LayerMetadata): string {
  const source = normalizeSource(layer)
  switch (detectCategory(layer)) {
    case "raster":
      return `栅格/${source}`
    case "vector":
      return `矢量/${source}`
    case "result":
      return `成果/${source}`
    case "basemap":
      return `底图/${source}`
    default:
      return DEFAULT_GROUP
  }
}
