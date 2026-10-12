export type DatasetVisibility = "private" | "shared" | "public"

export type ApiResponse<T> = {
  success: boolean
  data?: T
  message?: string
  code?: number
}

export type EoapiDataset = {
  datasetId: string
  name: string
  description?: string
  visibility?: DatasetVisibility
  createdAt?: number | string
  updatedAt?: number | string
  tags?: string[]
}

export type EoapiRevision = {
  revisionId: string
  message?: string
  createdAt?: number | string
}

export type ServiceRef = {
  type: "xyz" | "wmts" | "wms" | "arcgis"
  url?: string
  urlTemplate?: string
  name?: string
  bounds?: [number, number, number, number]
  minZoom?: number
  maxZoom?: number
  format?: string
}

export type ManifestArtifact = {
  id: string
  name?: string
  url?: string
  href?: string
  mime?: string
  type?: string
}

export type Manifest = {
  manifestVersion: string
  dataset?: { datasetId: string; revisionId?: string }
  createdAt?: number
  viewState?: {
    bbox?: [number, number, number, number]
    center?: { longitude: number; latitude: number }
    zoom?: number
    heading?: number
    pitch?: number
    alt?: number
    timestamp?: number
  }
  layers?: Array<{
    id: string
    name?: string
    sourceType: string
    sourceRef?: string
    visible?: boolean
    opacity?: number
    pid?: string | number
    order?: number
    data?: any
  }>
  layoutState?: any
  uiState?: any
  artifacts?: ManifestArtifact[]
  drawFeatures?: any[]
}
