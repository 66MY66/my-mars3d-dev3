/**
 * 我的仓库 - 地图业务层
 */
import * as mars3d from "mars3d"
import type { Manifest } from "../dataset-repository/types/eoapi-types"
import { restoreWorkspace } from "../dataset-repository/workspace"
import { serializeWorkspace } from "../dataset-repository/workspace/serialize"

let map: mars3d.Map
let activeSession:
  | {
      datasetId: string
      snapshot: Manifest
      openedAt: number
      layerIdPrefix: string
      layerParentId?: string | number
    }
  | null = null

export const MY_REPOSITORY_SESSION_EVENT = "myRepositorySessionChange"

function emitSessionChange(): void {
  try {
    window.dispatchEvent(
      new CustomEvent(MY_REPOSITORY_SESSION_EVENT, {
        detail: { datasetId: activeSession?.datasetId || null }
      })
    )
  } catch {
  }
}

export function onMounted(mapInstance: mars3d.Map): void {
  map = mapInstance
}

export function onUnmounted(): void {
  map = null
  activeSession = null
  emitSessionChange()
}

export function getMap(): mars3d.Map | null {
  return map || null
}

export function getActiveSessionDatasetId(): string | null {
  return activeSession?.datasetId || null
}

export function getActiveSessionLayerParentId(): string | number | null {
  return activeSession?.layerParentId ?? null
}

export function getActiveSessionLayerIdPrefix(): string | null {
  return activeSession?.layerIdPrefix || null
}

export async function openLocalDataset(payload: {
  datasetId: string
  datasetName: string
  manifest: Manifest
  timeMode: "saved" | "latest"
}): Promise<void> {
  if (!map) {
    throw new Error("地图未初始化")
  }

  const openedAt = Date.now()
  const snapshot = serializeWorkspace(map, {
    includeViewState: true,
    includeLayers: true,
    includeDrawFeatures: true
  })

  const prefix = `myrepo_${payload.datasetId}_${openedAt}_`
  const parentId = `myrepo_group_${payload.datasetId}_${openedAt}`

  const manifest = normalizeManifestForTimeMode(payload.manifest, payload.timeMode)

  ensureGroupLayer(parentId, `我的仓库/${payload.datasetName}`)

  const session = {
    datasetId: payload.datasetId,
    snapshot,
    openedAt,
    layerIdPrefix: prefix,
    layerParentId: parentId
  }
  activeSession = session

  try {
    await restoreWorkspace(map, manifest, {
      strategy: "overlay",
      conflictResolution: "rename",
      restoreView: true,
      restoreLayers: true,
      restoreDrawFeatures: true,
      flyDuration: 1.0,
      layerIdPrefix: prefix,
      layerNamePrefix: "",
      layerParentId: parentId,
      drawIdPrefix: prefix,
      clearExistingDrawFeatures: false
    })
    emitSessionChange()
  } catch (e) {
    activeSession = null
    emitSessionChange()
    throw e
  }
}

export async function undoOpen(): Promise<boolean> {
  if (!map || !activeSession) {
    return false
  }

  const snapshot = activeSession.snapshot
  activeSession = null

  try {
    await restoreWorkspace(map, snapshot, {
      strategy: "replace",
      conflictResolution: "replace",
      restoreView: true,
      restoreLayers: true,
      restoreDrawFeatures: true,
      flyDuration: 0.6,
      clearExistingDrawFeatures: true
    })
    emitSessionChange()
  } catch (e) {
    emitSessionChange()
    throw e
  }

  return true
}

function normalizeManifestForTimeMode(manifest: Manifest, mode: "saved" | "latest"): Manifest {
  if (mode === "saved") {
    return manifest
  }
  const cloned = JSON.parse(JSON.stringify(manifest)) as Manifest
  cloned.viewState = cloned.viewState || {}
  cloned.viewState.timestamp = Date.now()
  if (Array.isArray(cloned.layers)) {
    cloned.layers = cloned.layers.map((l: any) => {
      if (!l?.sourceRef || typeof l.sourceRef !== "string") {
        return l
      }
      return { ...l, sourceRef: stripDatetimeParams(l.sourceRef) }
    })
  }
  return cloned
}

function stripDatetimeParams(url: string): string {
  try {
    const u = new URL(url, window.location.origin)
    u.searchParams.delete("datetime")
    u.searchParams.delete("time")
    u.searchParams.delete("timestamp")
    return u.toString()
  } catch {
    return url
  }
}

function ensureGroupLayer(groupId: string, groupName: string) {
  if (!map) {
    return
  }
  const existed = map.getLayerById(groupId)
  if (existed) {
    try {
      existed.name = groupName
    } catch {
    }
    return
  }
  const anyMars: any = mars3d as any
  const GroupLayer = anyMars?.layer?.GroupLayer
  if (typeof GroupLayer === "function") {
    try {
      const groupLayer = new GroupLayer({
        id: groupId,
        name: groupName,
        type: "group",
        show: true,
        open: true
      })
      map.addLayer(groupLayer)
    } catch {
    }
  }
}
