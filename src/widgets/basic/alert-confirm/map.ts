import * as mars3d from "mars3d"
let map: mars3d.Map

export function onMounted(mapInstance: mars3d.Map): void {
  map = mapInstance
}

export function onUnmounted(): void {
  map = null
}

export function locateTo(lng: number, lat: number): void {
  if (!map) {
    return
  }
  map.setCameraView({ lng, lat, alt: 5000, pitch: -45 }, { duration: 1 })
}
