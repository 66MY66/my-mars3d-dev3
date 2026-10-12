/**
 * 右键菜单类型定义
 */

/** 菜单项配置（兼容 mars3d 格式） */
export interface MenuItem {
  /** 菜单文本 */
  text?: string | ((...args: any[]) => string)
  /** 图标 */
  icon?: string
  /** 是否显示 */
  show?: boolean | ((...args: any[]) => boolean)
  /** 是否禁用 */
  disabled?: boolean | ((...args: any[]) => boolean)
  /** 禁用原因（用于 tooltip / 点击提示） */
  disabledReason?: string | ((...args: any[]) => string)
  /** 点击回调 */
  callback?: (...args: any[]) => void
  /** 子菜单 */
  children?: MenuItem[]
  /** 分隔线 */
  type?: "line"
}

/** 右键上下文类型 */
export type ContextType =
  | "blank" // 空白处
  | "marker" // 标记对象（点/线/面）
  | "layer" // 图层对象
  | "alert" // 告警对象
  | "measure" // 测量结果

/** 右键菜单配置选项 */
export interface ContextMenuOptions {
  /** Toast 提示 */
  onToast: (msg: string, type?: "success" | "error" | "info") => void
  /** Alert 弹窗 */
  onAlert: (msg: string, title?: string) => void
  /** 确认弹窗 */
  onConfirm: (title: string, content: string) => Promise<boolean>
  /** 权限检查 */
  hasPermission?: (code: string) => boolean
  /** 选择缓冲区半径弹窗 */
  onSelectBufferRadius?: (defaultRadius?: number) => Promise<number | null>
  /** 激活 Widget */
  activateWidget?: (name: string, data?: any) => void
  /** 启动快速识别 */
  startQuickIdentify?: (ring: Array<[number, number]>) => void
  /** 获取所有多边形环 */
  getPolygonRings?: () => Array<{ ring: Array<[number, number]>; id: string }>
  /** 打开灾害统计面板 */
  openDisasterStats?: (ring: Array<[number, number]>) => void
  /** 更新告警状态 */
  updateAlertStatus?: (alertId: string, status: string) => Promise<boolean>
}

/** 标记类型 */
export type MarkerType = "point" | "polyline" | "polygon" | "rectangle" | "circle" | "label"
