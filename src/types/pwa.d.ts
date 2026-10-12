/// <reference types="vite/client" />

// PWA 相关类型声明
declare module "virtual:pwa-register" {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOffline?: () => void
    onReady?: (registration: ServiceWorkerRegistration) => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: Error) => void
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}

// 扩展 ImportMetaEnv 类型
interface ImportMetaEnv {
  readonly VITE_BASE_URL: string
  readonly VITE_API_URL: string
  readonly VITE_LOCAL_API: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
