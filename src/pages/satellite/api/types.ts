export interface JeecgResponse<T> {
  success: boolean
  message?: string
  result: T | null
  code?: number
  timestamp?: number
}

export interface JeecgPage<T> {
  records: T[]
  total: number
  current: number
  size: number
}

export type SatelliteRecord = Record<string, unknown>

export interface CatalogNode extends SatelliteRecord {
  key: string
  id: string
  parentId: string
  children?: CatalogNode[]
}

export interface MetadataQuery {
  satellite?: string[]
  sensor?: string[]
  dataTypes?: string[]
  cloudCover?: [number, number] | number[]
  resolutionMin?: number | null
  resolutionMax?: number | null
  dateRange?: unknown[]
}
