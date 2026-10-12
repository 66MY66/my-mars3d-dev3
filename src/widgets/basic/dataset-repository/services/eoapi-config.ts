/**
 * eoAPI 配置
 * @description 从环境变量读取 eoAPI 相关配置
 */

export interface EoApiConfig {
  /** API 前缀路径 */
  apiPrefix: string
  /** 语言（用于 STAC Language 扩展/后端多语言内容协商），例如 zh-CN */
  language: string
  /** 请求超时时间（毫秒） */
  timeout: number
  /** 是否自动同步视图 */
  autoSync: boolean
  /** 面板初始宽度 */
  panelWidth: number
  /** 面板最小宽度 */
  minPanelWidth: number
  /** 面板最大宽度 */
  maxPanelWidth: number
  /** 面板初始高度 */
  panelHeight: number
  /** 面板最小高度 */
  minPanelHeight: number
  /** 面板最大高度 */
  maxPanelHeight: number
}

/** 默认配置 */
const defaultConfig: EoApiConfig = {
  apiPrefix: "/api/eoapi",
  language: "zh-CN",
  timeout: 15000,
  autoSync: true,
  panelWidth: 400,
  minPanelWidth: 300,
  maxPanelWidth: 800,
  panelHeight: 600,
  minPanelHeight: 400,
  maxPanelHeight: 900
}

/** eoAPI 配置实例 */
export const eoApiConfig: EoApiConfig = {
  apiPrefix: import.meta.env.VITE_EOAPI_API_PREFIX || defaultConfig.apiPrefix,
  language: String(import.meta.env.VITE_EOAPI_LANGUAGE || defaultConfig.language || "").trim(),
  timeout: Number(import.meta.env.VITE_EOAPI_TIMEOUT) || defaultConfig.timeout,
  autoSync: import.meta.env.VITE_EOAPI_AUTO_SYNC === "true" || defaultConfig.autoSync,
  panelWidth: Number(import.meta.env.VITE_EOAPI_PANEL_WIDTH) || defaultConfig.panelWidth,
  minPanelWidth: Number(import.meta.env.VITE_EOAPI_MIN_PANEL_WIDTH) || defaultConfig.minPanelWidth,
  maxPanelWidth: Number(import.meta.env.VITE_EOAPI_MAX_PANEL_WIDTH) || defaultConfig.maxPanelWidth,
  panelHeight: Number(import.meta.env.VITE_EOAPI_PANEL_HEIGHT) || defaultConfig.panelHeight,
  minPanelHeight: Number(import.meta.env.VITE_EOAPI_MIN_PANEL_HEIGHT) || defaultConfig.minPanelHeight,
  maxPanelHeight: Number(import.meta.env.VITE_EOAPI_MAX_PANEL_HEIGHT) || defaultConfig.maxPanelHeight
}

export default eoApiConfig
