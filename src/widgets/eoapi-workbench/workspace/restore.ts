import * as mars3d from "mars3d"
import type { Manifest } from "../types/eoapi-types"
import type { RestoreOptions } from "./strategies"

function safeArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

export async function restoreWorkspace(map: any, manifest: Manifest, options: RestoreOptions): Promise<void> {
  if (!map || !manifest) {
    return
  }

  const opt: Required<Pick<RestoreOptions, "restoreView" | "restoreLayers" | "restoreDraw" | "flyTo">> &
    Omit<RestoreOptions, "restoreView" | "restoreLayers" | "restoreDraw" | "flyTo"> = {
    restoreView: options.restoreView !== false,
    restoreLayers: options.restoreLayers !== false,
    restoreDraw: options.restoreDraw !== false,
    flyTo: options.flyTo !== false,
    ...options
  }

  if (opt.restoreView && manifest.viewState?.center) {
    try {
      const c = manifest.viewState.center
      const alt = typeof manifest.viewState.alt === "number" ? manifest.viewState.alt : undefined
      const pitch = typeof manifest.viewState.pitch === "number" ? manifest.viewState.pitch : undefined
      const heading = typeof manifest.viewState.heading === "number" ? manifest.viewState.heading : undefined

      const duration = opt.flyTo ? 1 : 0
      map.setCameraView(
        {
          lng: c.longitude,
          lat: c.latitude,
          alt: alt ?? 5000,
          pitch,
          heading
        },
        { duration }
      )
    } catch {
    }
  }

  if (opt.strategy === "replace" && opt.restoreLayers) {
    try {
      const layers = typeof map.getLayers === "function" ? map.getLayers() : []
      const prefix = opt.layerIdPrefix
      const idSet = new Set<string>(safeArray<any>(manifest.layers).map((l) => String(l?.id ?? "")).filter(Boolean))
      safeArray<any>(layers).forEach((layer) => {
        if (!layer) {
          return
        }
        if (layer?.options?.basemap || layer?.options?.isBasemap || layer?.options?.isBaseMap) {
          return
        }
        const id = String(layer?.id ?? "")
        const shouldRemove = (prefix && id.startsWith(prefix)) || (!prefix && idSet.has(id))
        if (!shouldRemove) {
          return
        }
        try {
          map.removeLayer(layer, true)
        } catch {
        }
      })
    } catch {
    }
  }

  if (opt.restoreLayers) {
    const layers = safeArray<any>(manifest.layers)
      .filter((it) => it && it.visible !== false)
      .sort((a, b) => (Number(a?.order ?? 0) || 0) - (Number(b?.order ?? 0) || 0))

    for (const item of layers) {
      const id = String(item.id)
      const name = item.name || id
      const pid = opt.layerParentId ?? item.pid
      const opacity = typeof item.opacity === "number" ? item.opacity : undefined

      const raw = item?.data?.mars3d
      if (raw && typeof raw === "object") {
        try {
          const layerOpt = { ...raw, id, name }
          if (pid !== undefined && pid !== null && layerOpt.pid === undefined) {
            layerOpt.pid = pid
          }
          if (opacity !== undefined && typeof layerOpt.opacity !== "number") {
            layerOpt.opacity = opacity
          }
          if (layerOpt.show === undefined && typeof item.visible === "boolean") {
            layerOpt.show = item.visible
          }

          const layer = mars3d.LayerUtil.create(layerOpt)
          if (layer) {
            map.addLayer(layer)
            continue
          }
        } catch {
        }
      }

      if (item.sourceType === "xyz") {
        const url = item.data?.url || item.data?.tiles || item.data?.tileUrl || item.sourceRef
        if (!url) {
          continue
        }
        try {
          const layer = new mars3d.layer.XyzLayer({
            id,
            name,
            url: String(url),
            pid,
            opacity: opacity ?? 1,
            show: true
          })
          map.addLayer(layer)
        } catch {
        }
      }
    }
  }

  if (opt.restoreDraw) {
    try {
      const gl = map?.graphicLayer
      if (gl) {
        gl.clear?.()
      }
      const payload: any = manifest.drawFeatures
      if (gl && payload) {
        if (typeof gl.loadJSON === "function") {
          gl.loadJSON(payload)
        } else if (typeof gl.fromJSON === "function") {
          gl.fromJSON(payload)
        }
      }
    } catch {
    }
  }
}
