export type RestoreStrategy = "overlay" | "replace"

export type RestoreOptions = {
  strategy: RestoreStrategy
  layerIdPrefix?: string
  layerParentId?: string | number
  restoreView?: boolean
  restoreLayers?: boolean
  restoreDraw?: boolean
  flyTo?: boolean
}
