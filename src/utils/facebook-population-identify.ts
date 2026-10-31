export const FACEBOOK_POPULATION_LAYER_ID = 412002
const GDP_DENSITY_LAYER_ID = 412001

const FACEBOOK_POINT_API = "/api/titiler/collections/spatial-thematic/items/SP-china-pop2020/point"
const FACEBOOK_BOUNDS = { xmin: 67.5, ymin: 15, xmax: 136.8, ymax: 55 }

interface LngLatPoint {
  lng: number
  lat: number
}

interface PopulationIdentifyMap {
  getLayerById: (id: number) => any
  on: (type: any, handler: (event: any) => void | Promise<void>) => void
  off: (type: any, handler: (event: any) => void | Promise<void>) => void
  openPopup: (position: number[], content: string) => any
}

interface InstallFacebookPopulationIdentifyOptions {
  map: PopulationIdentifyMap
  clickEvent: any
  showEvent?: any
  hideEvent?: any
  onVisibilityChange?: (visible: boolean) => void
  toLngLat: (cartesian: any) => LngLatPoint
  fetcher?: typeof fetch
}

function isInsideBounds(point: LngLatPoint): boolean {
  return point.lng >= FACEBOOK_BOUNDS.xmin && point.lng <= FACEBOOK_BOUNDS.xmax &&
    point.lat >= FACEBOOK_BOUNDS.ymin && point.lat <= FACEBOOK_BOUNDS.ymax
}

function formatCoordinate(value: number): string {
  return Number(value.toFixed(5)).toString()
}

function formatPopup(point: LngLatPoint, value: unknown): string {
  const numericValue = Number(value)
  const valueText = Number.isFinite(numericValue) && numericValue > -9000
    ? `${numericValue.toLocaleString("zh-CN", { maximumFractionDigits: 6 })} 人/平方公里`
    : "无数据"
  return `${point.lng.toFixed(5)}，${point.lat.toFixed(5)}<br>${valueText}`
}

export function installFacebookPopulationIdentify(options: InstallFacebookPopulationIdentifyOptions): () => void {
  const { map, clickEvent, showEvent, hideEvent, onVisibilityChange, toLngLat, fetcher = fetch } = options
  let activeController: AbortController | null = null
  let requestSequence = 0
  const layer = map.getLayerById(FACEBOOK_POPULATION_LAYER_ID)

  const cancelRequest = () => {
    requestSequence += 1
    activeController?.abort()
    activeController = null
  }
  const handleLayerShow = () => {
    onVisibilityChange?.(true)
  }
  const handleLayerHide = () => {
    cancelRequest()
    onVisibilityChange?.(false)
  }

  onVisibilityChange?.(Boolean(layer?.show))
  if (layer?.on && showEvent != null && hideEvent != null) {
    layer.on(showEvent, handleLayerShow)
    layer.on(hideEvent, handleLayerHide)
  }

  const handleClick = async (event: any) => {
    const activeLayer = map.getLayerById(FACEBOOK_POPULATION_LAYER_ID)
    if (!activeLayer?.show || !event?.cartesian) {
      return
    }
    const gdpLayer = map.getLayerById(GDP_DENSITY_LAYER_ID)
    if (gdpLayer?.show && Number(gdpLayer.zIndex) > Number(activeLayer.zIndex)) {
      return
    }

    let point: LngLatPoint
    try {
      point = toLngLat(event.cartesian)
    } catch {
      return
    }
    if (!Number.isFinite(point?.lng) || !Number.isFinite(point?.lat) || !isInsideBounds(point)) {
      return
    }

    activeController?.abort()
    activeController = new AbortController()
    const sequence = ++requestSequence
    const lng = formatCoordinate(point.lng)
    const lat = formatCoordinate(point.lat)

    try {
      const response = await fetcher(`${FACEBOOK_POINT_API}/${lng},${lat}?assets=data`, { signal: activeController.signal })
      if (!response.ok) {
        throw new Error(`Facebook population point query failed: ${response.status}`)
      }
      const payload = await response.json()
      if (sequence !== requestSequence) {
        return
      }
      map.openPopup([point.lng, point.lat], formatPopup(point, payload?.values?.[0]))
    } catch (error: any) {
      if (error?.name !== "AbortError" && sequence === requestSequence) {
        map.openPopup([point.lng, point.lat], `${point.lng.toFixed(5)}，${point.lat.toFixed(5)}<br>数值查询失败`)
      }
    }
  }

  map.on(clickEvent, handleClick)
  return () => {
    cancelRequest()
    map.off(clickEvent, handleClick)
    if (layer?.off && showEvent != null && hideEvent != null) {
      layer.off(showEvent, handleLayerShow)
      layer.off(hideEvent, handleLayerHide)
    }
    onVisibilityChange?.(false)
  }
}
