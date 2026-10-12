/// <reference types="vite/client" />

/**
 * 统一定义ts模块类型
 * @copyright 火星科技 mars3d.cn
 * @author 木遥 2022-01-01
 */

declare module "*.vue" {
  import { DefineComponent } from "vue"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module "nprogress" {
  const nprogress: any
  export default nprogress
}

declare module "uuid" {
  export const v4: any
}

declare module "mapv" {
  export const geojson: any
  export const DataSet: any
  export const utilCityCenter: any
  export const utilCurve: any
}

declare module "kml-geojson" {
  export const toKml: (geojson: any, options: any) => any
  export const toGeoJSON: (doc: any) => any
}

declare module "vite-plugin-eslint" {
  const plugin: any
  export default plugin
}

declare module "vite-plugin-eslint" {
  import type { Plugin } from "vite"
  export default function eslintPlugin(options?: any): Plugin
}
