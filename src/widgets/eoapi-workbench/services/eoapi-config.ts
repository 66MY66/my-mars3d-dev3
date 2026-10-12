export type EoApiConfig = {
  apiPrefix: string
  timeout: number
  autoSync: boolean
  language: string
}

const defaultConfig: EoApiConfig = {
  apiPrefix: "/api/eoapi",
  timeout: 15000,
  autoSync: true,
  language: "zh-CN"
}

export const eoApiConfig: EoApiConfig = {
  apiPrefix: String(import.meta.env.VITE_EOAPI_API_PREFIX || defaultConfig.apiPrefix).trim() || defaultConfig.apiPrefix,
  timeout: Number(import.meta.env.VITE_EOAPI_TIMEOUT || defaultConfig.timeout) || defaultConfig.timeout,
  autoSync: String(import.meta.env.VITE_EOAPI_AUTO_SYNC || String(defaultConfig.autoSync)) === "true",
  language: String(import.meta.env.VITE_EOAPI_LANGUAGE || defaultConfig.language).trim() || defaultConfig.language
}

export default eoApiConfig

