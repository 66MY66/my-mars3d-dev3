import type { Manifest } from "../types/eoapi-types"

type SerializeOptions = {
  datasetId?: string
  revisionId?: string
  layoutState?: any
  uiState?: any
  artifacts?: any[]
  includeView?: boolean
  includeLayers?: boolean
  includeDraw?: boolean
}

function safeArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function toNum(v: any): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined
}

function extractViewState(map: any, now: number): Manifest["viewState"] | undefined {
  const extent = map?.getExtent?.()
  const bbox =
    extent && typeof extent === "object"
      ? ([extent.xmin, extent.ymin, extent.xmax, extent.ymax] as [number, number, number, number])
      : undefined

  const camera = typeof map?.getCameraView === "function" ? map.getCameraView() : null
  const center =
    camera && typeof camera === "object" && typeof camera.lng === "number" && typeof camera.lat === "number"
      ? { longitude: camera.lng, latitude: camera.lat }
      : (() => {
          const c = map?.getCenter?.()
          return c && typeof c === "object" && typeof c.lng === "number" && typeof c.lat === "number"
            ? { longitude: c.lng, latitude: c.lat }
            : undefined
        })()

  const heading =
    toNum(camera?.heading) ??
    (() => {
      const v = map?.camera?.heading
      return toNum(v)
    })()

  const pitch =
    toNum(camera?.pitch) ??
    (() => {
      const v = map?.camera?.pitch
      return toNum(v)
    })()

  const alt = toNum(camera?.alt) ?? toNum(camera?.height)

  if (!bbox && !center) {
    return undefined
  }

  return {
    bbox,
    center,
    heading,
    pitch,
    alt,
    timestamp: now
  }
}

function extractLayers(map: any): Manifest["layers"] {
  const layers = safeArray<any>(typeof map?.getLayers === "function" ? map.getLayers() : [])
  const graphicLayer = map?.graphicLayer
  const out: NonNullable<Manifest["layers"]> = []

  layers.forEach((layer, idx) => {
    if (!layer || layer === graphicLayer) {
      return
    }
    if (layer?.options?.basemap || layer?.options?.isBasemap || layer?.options?.isBaseMap) {
      return
    }
    if (typeof layer.toJSON !== "function") {
      return
    }
    try {
      const json = layer.toJSON()
      const id = String(layer.id ?? json?.id ?? `layer_${idx}`)
      const name = layer.name ?? json?.name
      const sourceType = String(json?.type ?? layer?.options?.type ?? layer?.type ?? "unknown")
      const sourceRef = json?.url ?? layer?.options?.url ?? json?.sourceRef
      let visible: boolean | undefined
      if (typeof layer.show === "boolean") {
        visible = layer.show
      } else if (typeof layer?.options?.show === "boolean") {
        visible = layer.options.show
      }
      let opacity: number | undefined
      if (typeof layer.opacity === "number") {
        opacity = layer.opacity
      } else if (typeof layer?.options?.opacity === "number") {
        opacity = layer.options.opacity
      }

      out.push({
        id,
        name: typeof name === "string" ? name : undefined,
        sourceType,
        sourceRef: sourceRef ? String(sourceRef) : undefined,
        visible,
        opacity,
        pid: layer?.options?.pid ?? json?.pid,
        order: idx + 1,
        data: { mars3d: json }
      })
    } catch {
    }
  })

  return out
}

function extractDraw(map: any): any[] {
  try {
    const gl = map?.graphicLayer
    if (!gl || typeof gl.toJSON !== "function") {
      return []
    }
    const json = gl.toJSON()
    const arr = safeArray<any>(json)
    if (arr.length > 0) {
      return arr
    }
    if (json) {
      return [json]
    }
    return []
  } catch {
    return []
  }
}

export function serializeWorkspace(map: any, options?: SerializeOptions): Manifest {
  const now = Date.now()
  const opt = options || {}
  const includeView = opt.includeView !== false
  const includeLayers = opt.includeLayers !== false
  const includeDraw = opt.includeDraw !== false

  const manifest: Manifest = {
    manifestVersion: "1.0",
    createdAt: now
  }

  if (opt.datasetId) {
    manifest.dataset = { datasetId: String(opt.datasetId), revisionId: opt.revisionId ? String(opt.revisionId) : undefined }
  }

  if (includeView) {
    manifest.viewState = extractViewState(map, now)
  }
  if (includeLayers) {
    manifest.layers = extractLayers(map)
  }
  if (includeDraw) {
    manifest.drawFeatures = extractDraw(map)
  }

  manifest.layoutState = opt.layoutState ?? { mode: "pc" }
  manifest.uiState = opt.uiState ?? {}
  manifest.artifacts = safeArray<any>(opt.artifacts)

  return manifest
}
