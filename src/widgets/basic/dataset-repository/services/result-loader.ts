import * as mars3d from "mars3d"
import { restoreWorkspace } from "../workspace/restore"
import type { Manifest } from "../types/eoapi-types"
import { ensureUniqueMapLayerId, normalizeLayerIdToken } from "./layer-id"
import { generateLayerId } from "./layer-id-generator"
import { classifyLayer, DEFAULT_GROUP } from "./layer-classifier"
import { resultFileMime, validateResultFile } from "./result-loader-utils"
import { attachSourceRegistryToManifest, tagLayerSourceRegistry, type SourceRegistryMeta } from "./source-registry"

export type ResultLoadTarget = "preview" | "map"

export type ResultLoadOutcome = {
  target: ResultLoadTarget
  name: string
  mime: string
  url?: string
  message?: string
  layerId?: string
}

export type ResultLoadProgress = {
  stage: "validating" | "reading" | "restoring" | "done"
  percent: number
  text: string
}

export type ResultLoaderOptions = {
  map?: mars3d.Map | null
  datasetId?: string
  datasetName?: string
  groupId?: string
  bounds?: [number, number, number, number] | null
  sourceMeta?: SourceRegistryMeta
  onProgress?: (detail: ResultLoadProgress) => void
}

function emitProgress(options: ResultLoaderOptions, detail: ResultLoadProgress) {
  options.onProgress?.(detail)
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("文件读取失败"))
    reader.readAsText(file, "utf-8")
  })
}

function buildLayerId() {
  // Layer IDs are shared across the dataset repository and workspace restore.
  // Keep the canonical generator format; dataset identity belongs to the
  // source registry/group metadata, not the map-layer ID itself.
  return generateLayerId()
}

function resolveGroupName(kind: string, datasetName: string): string {
  let layerKind: "vector" | "raster" | "result"
  if (kind === "geojson") {
    layerKind = "vector"
  } else if (kind === "image" || kind === "geotiff") {
    layerKind = "raster"
  } else {
    layerKind = "result"
  }
  const groupName = classifyLayer({
    type: layerKind,
    format: kind,
    source: datasetName
  })
  return groupName === DEFAULT_GROUP ? `本地成果/${datasetName}` : groupName
}

async function restoreManifest(map: mars3d.Map, manifest: Manifest, sourceMeta?: SourceRegistryMeta) {
  await restoreWorkspace(map, attachSourceRegistryToManifest(manifest, sourceMeta || { key: "" }), {
    strategy: "overlay",
    conflictResolution: "rename",
    restoreView: false,
    restoreDrawFeatures: false
  })
}

async function loadModelGraphic(map: mars3d.Map, objectUrl: string) {
  const anyMars = mars3d as any
  const ModelEntity = anyMars?.graphic?.ModelEntity
  if (typeof ModelEntity !== "function") {
    throw new Error("当前环境暂不支持本地三维模型独立加载")
  }
  const center = map.getCenter?.() || { lng: 116.391, lat: 39.907 }
  const graphic = new ModelEntity({
    id: `local_model_${Date.now()}`,
    position: [Number(center.lng || center.longitude || 116.391), Number(center.lat || center.latitude || 39.907), 0],
    style: {
      url: objectUrl,
      scale: 1
    },
    attr: {
      source: "local-result"
    }
  })
  map.graphicLayer?.addGraphic?.(graphic)
}

export async function loadResultFile(file: File, options: ResultLoaderOptions = {}): Promise<ResultLoadOutcome> {
  emitProgress(options, { stage: "validating", percent: 10, text: "正在校验文件格式" })
  const validation = validateResultFile(file)
  if (!validation.ok) {
    throw new Error(validation.message)
  }

  const kind = validation.kind
  const mime = resultFileMime(file) || "application/octet-stream"
  const objectUrl = URL.createObjectURL(file)

  if (kind === "document") {
    emitProgress(options, { stage: "done", percent: 100, text: "文档已准备预览" })
    return { target: "preview", name: file.name, mime, url: objectUrl, message: "文档类文件仅支持预览" }
  }

  const map = options.map
  if (!map) {
    if (kind === "image") {
      emitProgress(options, { stage: "done", percent: 100, text: "图片已准备预览" })
      return { target: "preview", name: file.name, mime, url: objectUrl, message: "图片可预览，也可在地图初始化后上图" }
    }
    throw new Error("地图尚未初始化，无法加载该成果文件")
  }

  emitProgress(options, { stage: "reading", percent: 40, text: "正在解析成果文件" })
  const desiredLayerId = buildLayerId()
  const layerId = ensureUniqueMapLayerId(map as any, desiredLayerId, { fallbackBase: "local_result" })
  const datasetName = String(options.datasetName || options.datasetId || "本地成果")
  const groupId = options.groupId || `local_result_group_${normalizeLayerIdToken(options.datasetId || "local", "dataset")}`
  const groupName = resolveGroupName(kind, datasetName)

  if (kind === "image" || kind === "geotiff" || kind === "geojson") {
    let manifest: Manifest
    if (kind === "geojson") {
      const text = await readText(file)
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error("GeoJSON/JSON 文件解析失败")
      }
      manifest = {
        manifestVersion: "1.0",
        createdAt: Date.now(),
        layers: [{
          id: layerId,
          name: file.name,
          sourceType: "geojson" as any,
          pid: groupId,
          visible: true,
          data
        } as any]
      }
    } else {
      const bounds = options.bounds || null
      manifest = {
        manifestVersion: "1.0",
        createdAt: Date.now(),
        layers: [{
          id: layerId,
          name: file.name,
          sourceType: kind === "geotiff" ? ("geotiff" as any) : ("image" as any),
          sourceRef: objectUrl,
          pid: groupId,
          visible: true,
          opacity: 1,
          options: kind === "image" && bounds ? { bounds } : undefined
        } as any]
      }
    }
    emitProgress(options, { stage: "restoring", percent: 80, text: "正在恢复到地图工作区" })
    const anyMars = mars3d as any
    const GroupLayer = anyMars?.layer?.GroupLayer
    if (typeof GroupLayer === "function" && !map.getLayerById?.(groupId)) {
      try {
        map.addLayer(new GroupLayer({
          id: groupId,
          name: groupName,
          type: "group",
          show: true,
          open: true
        }))
      } catch {
        // noop
      }
    }
    tagLayerSourceRegistry(map.getLayerById?.(groupId), {
      ...(options.sourceMeta || { key: "" }),
      groupId
    })
    await restoreManifest(map, manifest, {
      ...(options.sourceMeta || { key: "" }),
      groupId
    })
    emitProgress(options, { stage: "done", percent: 100, text: "成果文件已加载" })
    return { target: "map", name: file.name, mime, url: objectUrl, layerId, message: "成果文件已加载到地图" }
  }

  if (kind === "model") {
    emitProgress(options, { stage: "restoring", percent: 80, text: "正在加载三维模型" })
    await loadModelGraphic(map, objectUrl)
    emitProgress(options, { stage: "done", percent: 100, text: "三维模型已加载" })
    return { target: "map", name: file.name, mime, url: objectUrl, message: "三维模型已加载到地图" }
  }

  throw new Error("未识别的成果文件类型")
}
