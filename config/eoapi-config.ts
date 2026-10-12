export type EoApiConfig = {
  apiPrefix: string
  timeout: number
  autoSync: boolean
  language: string
}

export const eoApiConfig: EoApiConfig = {
  apiPrefix: "/api/eoapi",
  timeout: 15000,
  autoSync: true,
  language: "zh-CN"
}

export default eoApiConfig
