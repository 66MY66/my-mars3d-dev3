import * as mars3d from "mars3d"

const Cesium: any = (mars3d as any).Cesium

let map: mars3d.Map | null = null
let mapCompare: any = null
let compareContainerEl: HTMLElement | null = null
let leftImagery: any | null = null
let rightImagery: any | null = null
let splitPosition = 0.5
let dualViewMode = false
let leftErrorOff: any = null
let rightErrorOff: any = null

/** 双视图时将 locationBar 挂到公共父容器，避免只落在左侧视图内 */
let locationBarOriginalParent: HTMLElement | null = null
let locationBarOriginalNextSibling: ChildNode | null = null
let locationBarPinnedEl: HTMLElement | null = null

export function onMounted(mapInstance: mars3d.Map): void {
  map = mapInstance
  applySplitPosition()
}

export function onUnmounted(): void {
  setDualViewMode(false)
  clearCompareLayers()
  map = null
}

export function setSplitPosition(position01: number): void {
  splitPosition = clamp01(position01)
  applySplitPosition()
}

export function getSplitPosition(): number {
  return splitPosition
}

export function setDualViewMode(enabled: boolean): void {
  if (dualViewMode === enabled) {
    applySplitPosition()
    return
  }
  dualViewMode = enabled
  if (enabled) {
    ensureMapCompare()
  } else {
    clearCompareLayers()
    destroyMapCompare()
  }
  applySplitPosition()
  map?.scene?.requestRender?.()
}

export function isDualViewMode(): boolean {
  return dualViewMode
}

export function resizeMapView(): void {
  if (!map || !(map as any).viewer) {
    return
  }
  try {
    ;(map as any).viewer.resize()
    mapCompare?.mapEx?.viewer?.resize?.()
    applySplitPosition()
  } catch {
  }
}

export function loadLeftLayer(id: string, collectionId: string, itemId: string, tileUrl?: string): boolean {
  return loadSide("left", id, collectionId, itemId, tileUrl)
}

export function loadRightLayer(id: string, collectionId: string, itemId: string, tileUrl?: string): boolean {
  return loadSide("right", id, collectionId, itemId, tileUrl)
}

export function setLayerOpacity(side: "left" | "right", opacity01: number): void {
  const layer = side === "left" ? leftImagery : rightImagery
  if (!layer) {
    return
  }
  try {
    layer.alpha = clamp01(opacity01)
    getViewerForSide(side)?.scene?.requestRender?.()
  } catch {
  }
}

export function clearCompareLayers(): void {
  removeSideLayer("left")
  removeSideLayer("right")
  applySplitPosition()
}

export function clearSideLayer(side: "left" | "right"): void {
  removeSideLayer(side)
  applySplitPosition()
}

function removeSideLayer(side: "left" | "right"): void {
  const viewer = getViewerForSide(side)
  const layer = side === "left" ? leftImagery : rightImagery
  const errorOff = side === "left" ? leftErrorOff : rightErrorOff

  if (viewer && layer) {
    try {
      viewer.imageryLayers.remove(layer, true)
    } catch {
    }
  }

  if (errorOff) {
    try {
      errorOff()
    } catch {
    }
  }

  if (side === "left") {
    leftImagery = null
    leftErrorOff = null
  } else {
    rightImagery = null
    rightErrorOff = null
  }
}

function getMainViewer(): any | null {
  return (map as any)?.viewer || null
}

function getRightViewer(): any | null {
  return mapCompare?.mapEx?.viewer || null
}

function getViewerForSide(side: "left" | "right"): any | null {
  if (dualViewMode && mapCompare) {
    return side === "left" ? getMainViewer() : getRightViewer()
  }
  return getMainViewer()
}

function ensureMapCompare(): void {
  if (!map || mapCompare) {
    return
  }
  try {
    mapCompare = new mars3d.control.MapCompare({
      sync: true
    })
    map.addControl(mapCompare)
    compareContainerEl = resolveCompareContainerEl()
    applySplitLayout()
  } catch {
    mapCompare = null
    compareContainerEl = null
  }
}

function destroyMapCompare(): void {
  if (!map) {
    mapCompare = null
    compareContainerEl = null
    return
  }
  try {
    if (mapCompare) {
      map.removeControl(mapCompare)
    }
  } catch {
  } finally {
    mapCompare = null
    compareContainerEl = null
    resetMapContainerLayout()
  }
}

function resolveCompareContainerEl(): HTMLElement | null {
  if (compareContainerEl?.isConnected) {
    return compareContainerEl
  }
  const parent = (map?.container as HTMLElement | undefined)?.parentElement
  const fromParent = parent?.querySelector?.(".mars3d-mapCompare") as HTMLElement | null
  compareContainerEl = fromParent || (document.querySelector(".mars3d-mapCompare") as HTMLElement | null)
  return compareContainerEl
}

function resetMapContainerLayout(): void {
  const container = map?.container as HTMLElement | undefined
  if (container) {
    container.style.position = ""
    container.style.left = ""
    container.style.top = ""
    container.style.bottom = ""
    container.style.width = ""
    container.style.height = ""
  }
  const compareEl = resolveCompareContainerEl()
  if (compareEl) {
    compareEl.style.display = ""
    compareEl.style.left = ""
    compareEl.style.right = ""
    compareEl.style.width = ""
  }
  restoreLocationBarHost()
}

function getLocationBarEl(): HTMLElement | null {
  return ((map as any)?.control?.locationBar?.container as HTMLElement | undefined) || null
}

function pinLocationBarFullSpan(): void {
  const bar = getLocationBarEl()
  const host = (map?.container as HTMLElement | undefined)?.parentElement
  if (!bar || !host) {
    return
  }

  if (!locationBarOriginalParent) {
    locationBarOriginalParent = bar.parentElement
    locationBarOriginalNextSibling = bar.nextSibling
  }

  if (bar.parentElement !== host) {
    host.appendChild(bar)
  }

  bar.classList.add("split-compare-locationbar")
  locationBarPinnedEl = bar

  // 右侧对比地图若自带状态条则隐藏，避免双份提示
  const compareEl = resolveCompareContainerEl()
  compareEl?.querySelectorAll?.(".mars3d-locationbar")?.forEach((el) => {
    if (el !== bar) {
      ;(el as HTMLElement).style.display = "none"
    }
  })
}

function restoreLocationBarHost(): void {
  const bar = locationBarPinnedEl || getLocationBarEl()
  if (bar) {
    bar.classList.remove("split-compare-locationbar")
  }

  if (bar && locationBarOriginalParent && bar.parentElement !== locationBarOriginalParent) {
    try {
      if (locationBarOriginalNextSibling && locationBarOriginalNextSibling.parentNode === locationBarOriginalParent) {
        locationBarOriginalParent.insertBefore(bar, locationBarOriginalNextSibling)
      } else {
        locationBarOriginalParent.appendChild(bar)
      }
    } catch {
      locationBarOriginalParent.appendChild(bar)
    }
  }

  const compareEl = resolveCompareContainerEl()
  compareEl?.querySelectorAll?.(".mars3d-locationbar")?.forEach((el) => {
    ;(el as HTMLElement).style.display = ""
  })

  locationBarOriginalParent = null
  locationBarOriginalNextSibling = null
  locationBarPinnedEl = null
}

function applySplitLayout(): void {
  if (!map || !dualViewMode) {
    resetMapContainerLayout()
    resetSceneSplit(getMainViewer())
    resetSceneSplit(getRightViewer())
    return
  }

  if (!mapCompare) {
    ensureMapCompare()
  }

  const container = map.container as HTMLElement
  const compareEl = resolveCompareContainerEl()
  const leftPercent = splitPosition * 100
  const rightPercent = 100 - leftPercent

  if (container) {
    container.style.position = "absolute"
    container.style.left = "0"
    container.style.top = "0"
    container.style.bottom = "0"
    container.style.width = `${leftPercent}%`
    container.style.height = "100%"
  }

  if (compareEl) {
    compareEl.style.display = "block"
    compareEl.style.left = `${leftPercent}%`
    compareEl.style.right = "0"
    compareEl.style.width = `${rightPercent}%`
  }

  resetSceneSplit(getMainViewer())
  resetSceneSplit(getRightViewer())
  pinLocationBarFullSpan()

  try {
    getMainViewer()?.resize?.()
    getRightViewer()?.resize?.()
  } catch {
  }
}

function resetSceneSplit(viewer: any | null): void {
  if (!viewer?.scene) {
    return
  }
  try {
    viewer.scene.splitPosition = 1
  } catch {
  }
}

function loadSide(side: "left" | "right", id: string, collectionId: string, itemId: string, tileUrl?: string): boolean {
  if (!map || !Cesium) {
    return false
  }

  if (dualViewMode) {
    ensureMapCompare()
  }

  const viewer = getViewerForSide(side)
  if (!viewer) {
    return false
  }

  try {
    const url = tileUrl || `/api/titiler/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}/tiles/WebMercatorQuad/{z}/{x}/{y}`
    const levelMatch = /Level(\d+)/.exec(url)
    const provider = new Cesium.UrlTemplateImageryProvider({
      url,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: levelMatch ? Number(levelMatch[1]) : 18
    })
    const off = provider?.errorEvent?.addEventListener?.((err: any) => {
      try {
        const msg = String(err?.message || err?.error?.message || err?.error || "影像加载失败")
        window.dispatchEvent(new CustomEvent("ksh003:split-compare-error", { detail: { side, message: msg, collectionId, itemId } }))
      } catch {
      }
    })
    const imageryLayer = viewer.imageryLayers.addImageryProvider(provider)
    if (!dualViewMode) {
      imageryLayer.splitDirection =
        side === "left" ? Cesium.ImagerySplitDirection.LEFT : Cesium.ImagerySplitDirection.RIGHT
    }
    imageryLayer.alpha = 1
    imageryLayer._kshId = String(id || "")

    removeSideLayer(side)

    if (side === "left") {
      leftImagery = imageryLayer
      leftErrorOff = off || null
    } else {
      rightImagery = imageryLayer
      rightErrorOff = off || null
    }

    applySplitPosition()
    return true
  } catch {
    return false
  }
}

function applySplitPosition(): void {
  if (!map) {
    return
  }

  if (dualViewMode) {
    applySplitLayout()
  } else {
    applySingleViewerSplit()
  }

  try {
    getMainViewer()?.scene?.requestRender?.()
    getRightViewer()?.scene?.requestRender?.()
  } catch {
  }
}

function applySingleViewerSplit(): void {
  const viewer = getMainViewer()
  if (!viewer?.scene) {
    return
  }
  try {
    viewer.scene.splitPosition = splitPosition
    viewer.resize?.()
  } catch {
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) {
    return 0
  }
  return Math.max(0, Math.min(1, v))
}
