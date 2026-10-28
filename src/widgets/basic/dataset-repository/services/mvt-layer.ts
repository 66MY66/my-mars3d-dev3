import * as mars3d from "mars3d"
import { paintVectorTile } from "./thematic-mvt"

export type MvtLayerOptions = {
  id: string | number
  name?: string
  url: string
  pid?: string | number
  show?: boolean
  opacity?: number
  minimumLevel?: number
  maximumLevel?: number
  maxZoom?: number
  bounds?: [number, number, number, number]
  sourceLayer?: string
  fillColor?: string
  lineColor?: string
  [key: string]: any
}

export function createMvtLayer(options: MvtLayerOptions): mars3d.layer.BaseTileLayer {
  const url = String(options?.url || "").trim()
  if (!["{z}", "{x}", "{y}"].every((tag) => url.includes(tag))) {
    throw new Error("MVT 服务需要包含 {z}/{x}/{y} 的瓦片地址")
  }

  const Cesium = mars3d.Cesium
  class MvtLayer extends mars3d.layer.BaseTileLayer {
    async _createImageryProvider() {
      const provider = new Cesium.UrlTemplateImageryProvider({
        url,
        minimumLevel: options.minimumLevel,
        maximumLevel: options.maximumLevel ?? options.maxZoom ?? 18,
        ...(options.bounds ? { rectangle: Cesium.Rectangle.fromDegrees(...options.bounds) } : {})
      })
      provider.requestImage = (x: number, y: number, z: number, request: any) => {
        const tileUrl = url
          .replaceAll("{x}", String(x))
          .replaceAll("{y}", String(y))
          .replaceAll("{z}", String(z))
        const pending = new Cesium.Resource({ url: tileUrl, request }).fetchArrayBuffer()
        if (!pending) {
          return Promise.reject(new Error(`MVT 瓦片请求未启动: ${tileUrl}`))
        }
        return pending.then((buffer) => paintVectorTile(buffer, {
          sourceLayer: options.sourceLayer,
          fillColor: options.fillColor,
          lineColor: options.lineColor
        })) as any
      }
      return provider
    }
  }

  return new MvtLayer(options as any)
}
