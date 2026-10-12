import * as mars3d from "mars3d"

let map: mars3d.Map | null = null

export function onMounted(mapInstance: mars3d.Map): void {
  map = mapInstance
}

export function onUnmounted(): void {
  map = null
}

export function getMap(): mars3d.Map | null {
  return map
}

