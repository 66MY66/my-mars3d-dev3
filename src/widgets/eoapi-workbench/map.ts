import * as mars3d from "mars3d"

let map: mars3d.Map | null = null
export const eventTarget = new mars3d.BaseClass()

export function onMounted(mapInstance: mars3d.Map): void {
  map = mapInstance
  map.on(mars3d.EventType.cameraMoveEnd, onCameraMoveEnd)
}

export function onUnmounted(): void {
  if (map) {
    map.off(mars3d.EventType.cameraMoveEnd, onCameraMoveEnd)
  }
  eventTarget.off()
  map = null
}

function onCameraMoveEnd(): void {
  if (!map) {
    return
  }
  const center = map.getCenter()
  const extent = map.getExtent()
  eventTarget.fire("viewChange", {
    center: { lng: center.lng, lat: center.lat, alt: center.alt },
    extent
  })
}

export function getMap(): mars3d.Map | null {
  return map
}

export function syncViewOnce(): void {
  if (!map) {
    return
  }
  const center = map.getCenter()
  const extent = map.getExtent()
  eventTarget.fire("syncView", {
    center: { lng: center.lng, lat: center.lat, alt: center.alt },
    extent
  })
}

export function pickCoordinateOnce(): void {
  if (!map) {
    return
  }
  try {
    map.setCursor("crosshair")
  } catch {
  }
  map.once(mars3d.EventType.click, function (event: any) {
    try {
      map?.setCursor("")
    } catch {
    }
    if (!event?.cartesian) {
      return
    }
    const point = mars3d.LngLatPoint.fromCartesian(event.cartesian)
    point.format?.()
    eventTarget.fire("pickedCoord", { point })
  })
}

export function openDataset(datasetId: string, revisionId?: string): void {
  const did = String(datasetId || "").trim()
  if (!did) {
    return
  }
  eventTarget.fire("openDataset", { datasetId: did, revisionId: revisionId ? String(revisionId) : undefined })
}
