/**
 * STAC API 类型定义
 * @description 符合 STAC (SpatioTemporal Asset Catalog) 规范的类型
 */

// ============ 通用类型 ============

/** API 响应结构 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  code?: number
}

/** 分页参数 */
export interface PaginationParams {
  limit?: number
  offset?: number
  bbox?: [number, number, number, number]
  datetime?: string
}

/** STAC Link 结构 */
export interface StacLink {
  rel: string
  type?: string
  title?: string
  href: string
  method?: string
}

/** STAC 资产 (Asset) */
export interface StacAsset {
  href: string
  type?: string
  title?: string
  description?: string
  roles?: string[]
  [key: string]: any
}

/** STAC 范围 */
export interface StacExtent {
  spatial: {
    bbox: number[][]
  }
  temporal: {
    interval: (string | null)[][]
  }
}

// ============ Collection (数据集) 类型 ============

/** STAC Collection */
export interface StacCollection {
  id: string
  type: "Collection"
  title?: string
  description?: string
  keywords?: string[]
  license?: string
  extent: StacExtent
  summaries?: Record<string, any>
  links: StacLink[]
  providers?: Array<{
    name: string
    roles?: string[]
    url?: string
  }>
  [key: string]: any
}

/** Collections 响应 */
export interface StacCollectionsResponse {
  collections: StacCollection[]
  links: StacLink[]
}

// ============ Item (条目/产品) 类型 ============

/** STAC Item */
export interface StacItem {
  id: string
  type: "Feature"
  collection: string
  geometry: {
    type: string
    coordinates: any
  } | null
  bbox?: number[]
  properties: {
    datetime: string
    title?: string
    description?: string
    [key: string]: any
  }
  assets: Record<string, StacAsset>
  links: StacLink[]
  stac_version?: string
  stac_extensions?: string[]
}

/** Items 响应 (FeatureCollection) */
export interface StacItemsResponse {
  type: "FeatureCollection"
  features: StacItem[]
  links: StacLink[]
  numberMatched?: number
  numberReturned?: number
  context?: {
    limit?: number
    matched?: number
    returned?: number
  }
}

// ============ Catalog 类型 ============

/** STAC Catalog */
export interface StacCatalog {
  type: "Catalog"
  id: string
  title?: string
  description?: string
  stac_version: string
  conformsTo?: string[]
  links: StacLink[]
  stac_extensions?: string[]
}

// ============ 服务状态类型 ============

/** eoAPI 服务状态 */
export interface EoApiServiceStatus {
  available: boolean
  latency: number
  lastCheck: number
  message?: string
}

// ============ 兼容旧代码的类型别名 ============

/** 数据集 (映射到 STAC Collection) */
export type Dataset = StacCollection

/** 版本/条目 (映射到 STAC Item) */
export type Revision = StacItem

/** 数据集列表响应 */
export type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** Manifest 类型（保留用于成果回放） */
/** 图层类型 */
export type LayerType =
  | "group"
  | "xyz"
  | "wms"
  | "wmts"
  | "tms"
  | "tile"
  | "arcgis"
  | "3dtiles"
  | "geojson"
  | "wfs"
  | "vector"
  | "image"
  | "unknown"

export interface Manifest {
  manifestVersion: string
  viewState?: {
    center?: { longitude: number; latitude: number }
    zoom?: number
    heading?: number
    pitch?: number
    bbox?: [number, number, number, number]
    timestamp?: number
  }
  layers?: Array<{
    id: string
    name?: string
    sourceType: LayerType
    sourceRef: string
    pid?: string | number
    data?: any
    options?: any
    temporal?: {
      mode: "static" | "dynamic"
      savedAt?: number
      datetimeParam?: {
        kind: "query" | "path" | "header"
        key: string
      }
    }
    timeExtent?: {
      start?: string
      end?: string
    }
    visible?: boolean
    opacity?: number
    order?: number
    zIndex?: number
  }>
  drawFeatures?: Array<{
    id: string
    type: string
    coordinates: any
    style?: Record<string, any>
    raw?: any
    createdAt?: number
    layerId?: string
    layerName?: string
  }>
  artifacts?: Array<{
    id: string
    name: string
    url: string
    mime: string
    size?: number
  }>
  createdAt?: number
}

/** 数据集可见性 */
export type DatasetVisibility = "private" | "shared" | "public"

/** 数据集状态（审核流转） */
export type DatasetStatus = "private" | "reviewing" | "published"

// ============ 面板状态类型 ============

/** 面板位置 */
export interface PanelPosition {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

/** 面板尺寸 */
export interface PanelSize {
  width: number
  height: number
}

/** 工作台面板状态 */
export interface WorkbenchPanelState {
  visible: boolean
  minimized: boolean
  position: PanelPosition
  size: PanelSize
}

// ============ 视图同步状态类型 ============

/** 视图同步状态 */
export interface ViewSyncState {
  autoSync: boolean
  lastSyncTime?: number
  currentBounds?: [number, number, number, number]
}

// ============ 专题图模板类型 (阶段六) ============

/** 模板参数定义 */
export interface ThematicTemplateParameter {
  name: string
  type: "string" | "number" | "boolean" | "select" | "color" | "range"
  label: string
  description?: string
  required?: boolean
  defaultValue?: any
  options?: Array<{ label: string; value: any }>
  min?: number
  max?: number
}

/** 专题图模板 */
export interface ThematicTemplate {
  templateId: string
  templateVersion: string
  name: string
  description?: string
  category?: string
  previewImage?: string
  parameters: ThematicTemplateParameter[]
  createdAt: number
  updatedAt?: number
}

/** 模板列表响应 */
export interface ThematicTemplatesResponse {
  templates: ThematicTemplate[]
  total: number
}

// ============ 专题图任务类型 (阶段六) ============

/** 任务状态 */
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"

/** 任务进度 */
export interface JobProgress {
  percent: number
  stage?: string
  message?: string
  startTime: number
  endTime?: number
}

/** 发布参数 */
export interface PublishParams {
  type: "xyz" | "mvt" | "wms" | "wmts" | "none"
  name?: string
  description?: string
  metadata?: Record<string, any>
}

/** 专题图生成任务 */
export interface ThematicJob {
  jobId: string
  templateId: string
  templateVersion: string
  datasetId?: string
  revisionId?: string
  dataRefs?: string[]
  status: JobStatus
  progress: JobProgress
  parameters?: Record<string, any>
  outputFormat?: string
  publishParams?: PublishParams
  createdAt: number
  createdBy?: string
}

/** 任务创建参数 */
export interface CreateJobParams {
  templateId: string
  templateVersion?: string
  datasetId?: string
  revisionId?: string
  dataRefs?: string[]
  parameters?: Record<string, any>
  outputFormat?: string
  publish?: PublishParams
}

// ============ 服务引用类型 (阶段六) ============

/** 服务引用（XYZ 瓦片服务） */
export interface ServiceRef {
  type: "xyz" | "mvt" | "wms" | "wmts" | "3dtiles"
  name?: string
  description?: string
  metadata?: Record<string, any>
  serviceId: string
  urlTemplate: string
  minZoom: number
  maxZoom: number
  bounds?: [number, number, number, number]
  format: string
  createdAt: number
}

/** 服务详情 */
export interface ServiceInfo {
  serviceId: string
  type: string
  urlTemplate: string
  minZoom: number
  maxZoom: number
  bounds?: [number, number, number, number]
  format: string
  coordinateSystem?: string
  metadata?: Record<string, any>
  createdAt: number
  status: "active" | "deprecated" | "deleted"
}

// ============ 附件类型 (阶段六) ============

/** 附件类型 */
export type ArtifactType = "thumbnail" | "report" | "export" | "log" | "data" | "other"

/** 附件/成果文件 */
export interface Artifact {
  artifactId: string
  name: string
  type: ArtifactType
  url: string
  mime: string
  size?: number
  metadata?: Record<string, any>
  createdAt: number
}

/** 附件上传参数 */
export interface UploadArtifactParams {
  file?: File
  name: string
  type: ArtifactType
  description?: string
  datasetId?: string
  revisionId?: string
  jobId?: string
}

/** 附件上传响应 */
export interface UploadArtifactResponse {
  artifactId: string
  url: string
  name: string
  type: ArtifactType
  mime: string
  size: number
  createdAt: number
}

/** 预签名上传参数 */
export interface PresignedUploadParams {
  name: string
  type: ArtifactType
  mime: string
  size: number
}

/** 预签名上传响应 */
export interface PresignedUploadResponse {
  uploadUrl: string
  artifactId: string
  expiresAt: number
}

// ============ 分片上传类型 (3-38 工单) ============

/** 分片上传初始化参数 */
export interface InitChunkedUploadParams {
  name: string
  type: ArtifactType
  mime: string
  size: number
  chunkCount: number
  chunkSize: number
}

/** 分片上传初始化响应 */
export interface InitChunkedUploadResponse {
  uploadId: string
  artifactId: string
  chunks: Array<{
    index: number
    uploadUrl: string
    expiresAt: number
  }>
  expiresAt: number
}

/** 分片上传状态 */
export interface ChunkedUploadState {
  uploadId: string
  artifactId: string
  fileName: string
  fileType: ArtifactType
  fileSize: number
  mime: string
  chunkSize: number
  chunkCount: number
  uploadedChunks: number[]
  lastProgress: number
  startedAt: number
  updatedAt: number
  datasetId?: string
  revisionId?: string
  jobId?: string
  status: "uploading" | "paused" | "completed" | "failed"
}

/** 分片上传进度回调参数 */
export interface UploadProgressInfo {
  uploadedBytes: number
  totalBytes: number
  percent: number
  currentChunk: number
  totalChunks: number
  speed: number // KB/s
  elapsed: number // 毫秒
}

/** 分片上传完成响应 */
export interface CompleteChunkedUploadResponse {
  artifactId: string
  url: string
  name: string
  type: ArtifactType
  mime: string
  size: number
  createdAt: number
}

// ============ 归档类型 (阶段六) ============

/** 归档引用 */
export interface ArchiveRef {
  archiveId: string
  archiveSystem: string
  archiveUrl?: string
  archivedAt: number
  status: "pending" | "completed" | "failed"
}

/** 归档推送参数 */
export interface ArchivePushParams {
  datasetId: string
  revisionId?: string
  jobId?: string
  artifacts?: string[]
  metadata?: Record<string, any>
}

/** 归档推送响应 */
export interface ArchivePushResponse {
  archiveId: string
  archiveUrl?: string
  status: "pending" | "completed" | "failed"
  message?: string
}

/** 任务结果 */
export interface ThematicJobResult {
  jobId: string
  status: JobStatus
  artifacts: Artifact[]
  serviceRef?: ServiceRef
  archiveRef?: ArchiveRef
  logsRef?: string
  createdAt: number
  completedAt?: number
}

// ============ 日志类型 (阶段六) ============

/** 日志条目 */
export interface LogEntry {
  timestamp: number
  level: "info" | "warn" | "error" | "debug"
  stage: string
  message: string
  details?: Record<string, any>
}

/** 日志响应 */
export interface LogsResponse {
  logId: string
  jobId?: string
  serviceId?: string
  entries: LogEntry[]
  total: number
}

// ============ eoAPI 底图类型 (阶段七) ============

/** eoAPI 底图类型 - 扩展版 */
export type EoapiBasemapType =
  // 天地图系列（eoAPI 本地代理）
  | "tianditu_imagery"
  | "tianditu_vector"
  | "tianditu_terrain"
  // GeoQ 系列
  | "geoq_gray"
  | "geoq_color"
  // OpenStreetMap 系列
  | "osm"
  | "osm_topo"
  // 国际影像系列
  | "arcgis_imagery"
  | "bing_imagery"
  // 高德滤镜系列（需外网）
  | "gaode_blue_filter"
  | "gaode_green_filter"
  | "gaode_dark_filter"
  // 离线/特殊底图
  | "offline_imagery"
  | "single_image"
  | "grid_empty"

/** eoAPI 底图配置 - 扩展版 */
export interface EoapiBasemapOption {
  id: string
  name: string
  type: EoapiBasemapType
  url?: string
  show?: boolean
  minZoom?: number
  maxZoom?: number
  // 滤镜参数（用于高德滤镜底图）
  filterOptions?: {
    invertColor?: boolean
    filterColor?: string
    brightness?: number
    contrast?: number
    gamma?: number
    hue?: number
    saturation?: number
  }
}

/** 天地图底图子类型 */
export type TiandituBasemapSubtype = "imagery" | "vector" | "terrain"

/** 天地图图层类型 */
export type TiandituLayerType =
  | "img_w" // 影像底图
  | "vec_w" // 矢量底图
  | "ter_w" // 地形底图
  | "cia_w" // 影像注记
  | "cva_w" // 矢量注记
  | "cta_w" // 地形注记

// ============ eoAPI 矢量类型 (阶段七) ============

/** 矢量边界配置 */
export interface VectorBoundaryConfig {
  collectionId: string
  name: string
  strokeColor?: string
  strokeWidth?: number
  fillColor?: string
  fillOpacity?: number
  minZoom?: number
  maxZoom?: number
}

/** tipg 集合信息 */
export interface TipgCollection {
  id: string
  title?: string
  description?: string
  extent?: {
    spatial?: { bbox: number[][] }
    temporal?: { interval: (string | null)[][] }
  }
  links?: StacLink[]
}

/** tipg 集合列表响应 */
export interface TipgCollectionsResponse {
  collections: TipgCollection[]
  links?: StacLink[]
}

// ============ eoAPI 服务状态类型 ============

/** eoAPI 服务检查结果 */
export interface EoapiServiceCheckResult {
  tipg: {
    available: boolean
    latency: number
    message?: string
  }
  titiler: {
    available: boolean
    latency: number
    message?: string
  }
  tiandituProxy?: {
    available: boolean
    latency: number
    message?: string
  }
}
