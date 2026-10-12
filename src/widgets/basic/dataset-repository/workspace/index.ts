/**
 * 工作区管理模块入口
 * @description 统一导出序列化、恢复和策略模块
 */

import { serializeWorkspace, validateManifest } from "./serialize"
import { restoreWorkspace, clearRestoredContent } from "./restore"
import { precheckRestore } from "./strategies"

export { serializeWorkspace, validateManifest } from "./serialize"
export type { SerializeOptions } from "./serialize"
export { restoreWorkspace, clearRestoredContent } from "./restore"
export type { RestoreOptions } from "./restore"
export { applyRestoreStrategy, detectLayerConflicts, resolveConflicts, precheckRestore } from "./strategies"
export type { RestoreStrategy, ConflictResolution, StrategyResult } from "./strategies"

/**
 * 工作区管理工具类
 */
export const WorkspaceManager = {
  /**
   * 序列化工作区
   */
  serialize: serializeWorkspace,

  /**
   * 验证成果包
   */
  validate: validateManifest,

  /**
   * 恢复工作区
   */
  restore: restoreWorkspace,

  /**
   * 清除恢复的内容
   */
  clear: clearRestoredContent,

  /**
   * 预检查恢复
   */
  precheck: precheckRestore
}

export default WorkspaceManager
