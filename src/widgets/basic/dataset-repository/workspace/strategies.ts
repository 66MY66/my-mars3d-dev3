/**
 * 恢复策略模块
 * @description 定义工作区恢复策略和冲突处理
 */

import * as mars3d from "mars3d"
import { Manifest } from "../types/eoapi-types"

/**
 * 恢复策略类型
 * - replace: 替换模式 - 清空当前工作区相关图层/标注，恢复为成果包状态
 * - overlay: 叠加模式 - 保留当前工作区，将成果包作为新的分组叠加
 */
export type RestoreStrategy = "replace" | "overlay"

/**
 * 冲突处理方式
 * - skip: 跳过已存在的图层
 * - replace: 替换已存在的图层（删除旧的，添加新的）
 * - rename: 重命名新图层（添加后缀）
 */
export type ConflictResolution = "skip" | "replace" | "rename"

/**
 * 策略执行结果
 */
export interface StrategyResult {
  /** 策略执行成功 */
  success: boolean
  /** 被移除的图层 ID 列表 */
  removedLayers: string[]
  /** 被保留的图层 ID 列表 */
  preservedLayers: string[]
  /** 执行过程中的错误 */
  errors: string[]
  /** 执行时间戳 */
  timestamp: number
}

/**
 * 应用恢复策略
 * @param map Mars3D 地图实例
 * @param strategy 恢复策略
 * @param manifest 成果包（用于判断哪些图层需要处理）
 */
export async function applyRestoreStrategy(
  map: mars3d.Map,
  strategy: RestoreStrategy,
  manifest: Manifest
): Promise<StrategyResult> {
  const result: StrategyResult = {
    success: true,
    removedLayers: [],
    preservedLayers: [],
    errors: [],
    timestamp: Date.now()
  }

  try {
    switch (strategy) {
      case "replace":
        await executeReplaceStrategy(map, manifest, result)
        break

      case "overlay":
        await executeOverlayStrategy(map, manifest, result)
        break

      default:
        result.errors.push(`未知的恢复策略: ${strategy}`)
        result.success = false
    }
  } catch (error) {
    result.errors.push(`策略执行失败: ${(error as Error).message}`)
    result.success = false
  }

  return result
}

/**
 * 执行替换策略
 * 清空当前工作区相关图层/标注，恢复为成果包状态
 */
async function executeReplaceStrategy(
  map: mars3d.Map,
  manifest: Manifest,
  result: StrategyResult
): Promise<void> {
  // 获取所有业务图层（排除底图）
  const allLayers = map.getLayers({ basemaps: false })

  allLayers.forEach((layer: any) => {
    const layerId = layer?.id || "unknown"
    if (layer === (map as any).graphicLayer) {
      result.preservedLayers.push(layerId)
      return
    }
    try {
      map.removeLayer(layer, true)
      result.removedLayers.push(layerId)
    } catch {
      result.errors.push(`移除图层 ${layerId} 失败`)
    }
  })

  try {
    map.graphicLayer?.clear?.()
  } catch {
  }
}

/**
 * 执行叠加策略
 * 保留当前工作区，将成果包作为新的分组叠加
 */
async function executeOverlayStrategy(
  map: mars3d.Map,
  manifest: Manifest,
  result: StrategyResult
): Promise<void> {
  // 获取所有业务图层
  const allLayers = map.getLayers({ basemaps: false })

  // 保留所有现有图层
  allLayers.forEach((layer: any) => {
    if (layer.id) {
      result.preservedLayers.push(layer.id)
    }
  })

  // 创建一个分组用于叠加的成果图层
  // 这将在 restore.ts 中实际创建图层时处理
  // 这里只做准备工作，记录需要叠加的图层
}

/**
 * 检测图层冲突
 * @param map Mars3D 地图实例
 * @param manifest 成果包
 */
export function detectLayerConflicts(
  map: mars3d.Map,
  manifest: Manifest
): Array<{
  layerId: string
  conflictType: "id" | "source" | "name"
  existingLayer: any
  newLayerInfo: any
}> {
  const conflicts: Array<{
    layerId: string
    conflictType: "id" | "source" | "name"
    existingLayer: any
    newLayerInfo: any
  }> = []

  if (!manifest.layers) { return conflicts }

  const existingLayers = map.getLayers({ basemaps: false })
  const existingLayerMap = new Map<string, any>()

  existingLayers.forEach((layer: any) => {
    if (layer.id) {
      existingLayerMap.set(layer.id, layer)
    }
  })

  manifest.layers.forEach((newLayerInfo) => {
    const existingLayer = existingLayerMap.get(newLayerInfo.id)

    if (existingLayer) {
      // ID 冲突
      conflicts.push({
        layerId: newLayerInfo.id,
        conflictType: "id",
        existingLayer,
        newLayerInfo
      })
    }

    // 检查来源冲突（相同 URL）
    if (newLayerInfo.sourceRef) {
      existingLayers.forEach((layer: any) => {
        if (
          layer.options?.url === newLayerInfo.sourceRef &&
          layer.id !== newLayerInfo.id
        ) {
          conflicts.push({
            layerId: newLayerInfo.id,
            conflictType: "source",
            existingLayer,
            newLayerInfo
          })
        }
      })
    }
  })

  return conflicts
}

/**
 * 解决图层冲突
 * @param map Mars3D 地图实例
 * @param conflicts 冲突列表
 * @param resolution 解决方式
 */
export function resolveConflicts(
  map: mars3d.Map,
  conflicts: Array<{
    layerId: string
    conflictType: "id" | "source" | "name"
    existingLayer: any
    newLayerInfo: any
  }>,
  resolution: ConflictResolution
): Array<{
  layerId: string
  action: "skipped" | "replaced" | "renamed"
  newId?: string
}> {
  const resolved: Array<{
    layerId: string
    action: "skipped" | "replaced" | "renamed"
    newId?: string
  }> = []

  conflicts.forEach((conflict) => {
    switch (resolution) {
      case "skip":
        resolved.push({
          layerId: conflict.layerId,
          action: "skipped"
        })
        break

      case "replace":
        try {
          map.removeLayer(conflict.existingLayer, true)
          resolved.push({
            layerId: conflict.layerId,
            action: "replaced"
          })
        } catch (e) {
          // 替换失败，改为跳过
          resolved.push({
            layerId: conflict.layerId,
            action: "skipped"
          })
        }
        break

      case "rename": {
        const newId = `${conflict.layerId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        resolved.push({
          layerId: conflict.layerId,
          action: "renamed",
          newId
        })
        break
      }
    }
  })

  return resolved
}

/**
 * 预检查恢复可行性
 * @param map Mars3D 地图实例
 * @param manifest 成果包
 */
export function precheckRestore(
  map: mars3d.Map,
  manifest: Manifest
): {
  canRestore: boolean
  warnings: string[]
  conflicts: number
  suggestedStrategy: RestoreStrategy
} {
  const warnings: string[] = []
  let suggestedStrategy: RestoreStrategy = "overlay"

  // 检查当前工作区状态
  const currentLayers = map.getLayers({ basemaps: false })
  const hasExistingContent = currentLayers.length > 0

  if (hasExistingContent) {
    // 有现有内容，建议叠加策略
    suggestedStrategy = "overlay"
    warnings.push("当前工作区已有图层，建议使用叠加策略")
  } else {
    // 工作区为空，可以使用替换策略
    suggestedStrategy = "replace"
  }

  // 检查冲突
  const conflicts = detectLayerConflicts(map, manifest)

  if (conflicts.length > 0) {
    warnings.push(`检测到 ${conflicts.length} 个图层冲突`)
  }

  // 检查 manifest 内容
  if (!manifest.layers?.length && !manifest.drawFeatures?.length) {
    warnings.push("成果包内容为空")
  }

  // 检查图层 URL 可达性（可选）
  if (manifest.layers) {
    manifest.layers.forEach((layer) => {
      if (!layer.sourceRef) {
        warnings.push(`图层 ${layer.id} 缺少来源引用`)
      }
    })
  }

  return {
    canRestore: warnings.filter((w) => w.includes("缺少") || w.includes("为空")).length === 0,
    warnings,
    conflicts: conflicts.length,
    suggestedStrategy
  }
}

export default {
  applyRestoreStrategy,
  detectLayerConflicts,
  resolveConflicts,
  precheckRestore
}
