export const DEFAULT_BASEMAP_NAME = "高德影像"

export function activateDefaultBasemap(map: any): boolean {
  if (!map || typeof map.getBasemaps !== "function") {
    return false
  }

  const basemaps = map.getBasemaps(true) || []
  const defaultBasemap = basemaps.find((item: any) => item?.name === DEFAULT_BASEMAP_NAME)
  if (defaultBasemap?.id == null) {
    return false
  }

  map.basemap = defaultBasemap.id
  for (const basemap of basemaps) {
    if (basemap) {
      basemap.show = String(basemap.id) === String(defaultBasemap.id)
    }
  }
  map.scene?.requestRender?.()
  map.viewer?.clock?.tick?.()
  return true
}
