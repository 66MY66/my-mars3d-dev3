import { remoteBounds, remoteItemPath, remoteRasterParams, type RemoteItem, type RemoteLayerAsset, type RemoteRenderOptions } from "./remote-cartography-source"
import { thematicServiceTargets, validThematicFile } from "./thematic-services"

export type BackendServiceLink = { id: string; label: string; href: string }
export function backendServiceLinks(item: RemoteItem, assetKey: string, options?: RemoteRenderOptions): BackendServiceLink[] {
  const path = remoteItemPath(item)
  const targets = thematicServiceTargets
  const links = [
    { id: "stac-item", label: "STAC 条目", href: `${targets["/api/thematic/stac"]}${path}` },
    { id: "catalog-item", label: "目录浏览", href: `${targets["/api/thematic/catalog-health"]}${path}` }
  ]
  const source = item.assets[assetKey]
  if (!source || !validThematicFile(source.href)) { return links }
  links.push({ id: "file", label: "原始文件", href: source.href })
  const raster = /image\/tiff/i.test(source.type || "") || /\.tiff?$/i.test(new URL(source.href).pathname)
  if (!raster) { return links }
  const bands = source.bands || source["raster:bands"] || item.properties["raster:bands"] || [{}]
  const minimum = bands[0]?.min ?? bands[0]?.statistics?.minimum ?? 0
  const maximum = bands[0]?.max ?? bands[0]?.statistics?.maximum ?? 255
  const asset: RemoteLayerAsset = { key: assetKey, title: source.title || assetKey, kind: "raster", numeric: !["visual", "surface"].includes(assetKey), bands: bands.map((band: any, i: number) => band.name || `波段 ${i + 1}`), range: [minimum, maximum] }
  const display: RemoteRenderOptions = options || { band: 1, minimum, maximum: maximum > minimum ? maximum : minimum + 1 }
  const params = remoteRasterParams(asset, display)
  const tileBase = `${targets["/api/thematic/tiles"]}${path}`
  const bounds = remoteBounds(item.bbox); const longitude = (bounds.west + bounds.east) / 2; const latitude = (bounds.south + bounds.north) / 2
  const z = 8; const x = Math.floor((longitude + 180) / 360 * 2 ** z)
  const latitudeRadians = Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI / 180
  const y = Math.floor((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * 2 ** z)
  const cog = new URLSearchParams({ url: source.href })
  if (asset.numeric) { cog.set("bidx", String(display.band)); cog.set("rescale", `${display.minimum},${display.maximum}`); cog.set("colormap_name", display.colormapName || "gray") }
  return [...links,
    { id: "tilejson", label: "TileJSON", href: `${tileBase}/WebMercatorQuad/tilejson.json?${params}` },
    { id: "xyz", label: "XYZ 抽样瓦片", href: `${tileBase}/tiles/WebMercatorQuad/${z}/${x}/${y}.png?${params}` },
    { id: "wmts", label: "WMTS 能力文档", href: `${tileBase}/WebMercatorQuad/WMTSCapabilities.xml?${params}` },
    { id: "preview", label: "资产预览", href: `${tileBase}/preview.png?${params}` },
    { id: "point", label: "资产中心点查询", href: `${tileBase}/point/${longitude},${latitude}?${params}` },
    { id: "cog-tilejson", label: "COG 直读 TileJSON", href: `${targets["/api/thematic/cog"]}/cog/WebMercatorQuad/tilejson.json?${cog}` },
    { id: "cog-viewer", label: "COG 浏览页", href: `${targets["/api/thematic/cog"]}/cog/viewer?${cog}` }
  ]
}
