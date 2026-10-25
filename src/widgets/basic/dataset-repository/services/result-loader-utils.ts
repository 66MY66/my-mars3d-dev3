const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"]
const GEO_TIFF_EXTENSIONS = [".tif", ".tiff"]
const DOC_EXTENSIONS = [".pdf", ".htm", ".html"]
const VECTOR_EXTENSIONS = [".geojson", ".json"]
const MODEL_EXTENSIONS = [".gltf", ".glb"]

export function resultFileExt(file: File) {
  const name = String(file?.name || "").toLowerCase()
  const index = name.lastIndexOf(".")
  return index >= 0 ? name.slice(index) : ""
}

export function resultFileMime(file: File) {
  return String(file?.type || "").toLowerCase()
}

export function inferResultFileKind(file: File) {
  const ext = resultFileExt(file)
  const mime = resultFileMime(file)
  if (mime.includes("tiff") || GEO_TIFF_EXTENSIONS.includes(ext)) {
    return "geotiff"
  }
  if (mime.startsWith("image/") || IMAGE_EXTENSIONS.includes(ext)) {
    return "image"
  }
  if (mime === "application/pdf" || DOC_EXTENSIONS.includes(ext)) {
    return "document"
  }
  // GLTF JSON uses a JSON-like MIME (`model/gltf+json`), so model detection
  // must happen before the generic JSON/vector branch.
  if (MODEL_EXTENSIONS.includes(ext) || mime.includes("model/gltf")) {
    return "model"
  }
  if (mime.includes("json") || VECTOR_EXTENSIONS.includes(ext)) {
    return "geojson"
  }
  return "unsupported"
}

export function validateResultFile(file: File) {
  const kind = inferResultFileKind(file)
  if (kind === "unsupported") {
    return {
      ok: false,
      message: "仅支持图片、PDF/HTML、GeoJSON/JSON、GeoTIFF/TIFF、GLTF/GLB 成果文件"
    }
  }
  return { ok: true, kind }
}
