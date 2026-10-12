/**
 * eoAPI 底图服务
 * @description 提供本地 eoAPI 底图加载能力 + 在线底图配置
 */

/** 天地图 Token（从环境变量获取） */
const TIANDITU_TOKEN = import.meta.env.VITE_TIANDITU_TOKEN || "120a6aeb42bd1b1e181cbe4116e6185a"

/** eoAPI 服务地址（从环境变量获取） */
const EOAPI_TIANDITU_PROXY = import.meta.env.VITE_EOAPI_TIANDITU_PROXY || "http://192.168.0.15:5954"
const EOAPI_TITILER_URL = import.meta.env.VITE_EOAPI_TITILER_URL || "http://192.168.0.15:5955"

/** Mars3D CDN 数据地址 */
const MARS3D_DATA_URL = import.meta.env.VITE_MARS3D_DATA_URL || "https://data.mars3d.cn"

/** 底图配置接口 */
export interface EoapiBasemapConfig {
  id: string
  name: string
  urlTemplate: string
  projection?: string
  minZoom?: number
  maxZoom?: number
  attributions?: string
}

/**
 * 构建天地图瓦片URL
 * @param layerType 图层类型（img_w/vec_w/ter_w/cia_w/cva_w/cta_w）
 */
export function buildTiandituUrl(layerType: string): string {
  return `${EOAPI_TIANDITU_PROXY}/tianditu/DataServer?T=${layerType}&x={x}&y={y}&l={z}&tk=${TIANDITU_TOKEN}`
}

/**
 * 天地图底图预设配置
 * 使用 Web Mercator 投影 (EPSG:3857)
 */
export const tiandituBasemaps = {
  // 影像底图
  imagery: {
    base: buildTiandituUrl("img_w"),
    label: buildTiandituUrl("cia_w"),
    name: "天地图影像"
  },
  // 矢量底图
  vector: {
    base: buildTiandituUrl("vec_w"),
    label: buildTiandituUrl("cva_w"),
    name: "天地图矢量"
  },
  // 地形底图
  terrain: {
    base: buildTiandituUrl("ter_w"),
    label: buildTiandituUrl("cta_w"),
    name: "天地图地形"
  }
}

/**
 * GeoQ 底图预设
 * @deprecated 外网不可达，已禁用
 */
export const geoqBasemaps = {
  gray: {
    url: "https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineCommunity/MapServer/tile/{z}/{y}/{x}",
    name: "GeoQ灰色底图(外网不可达)",
    disabled: true
  },
  color: {
    url: "https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineCommunityColor/MapServer/tile/{z}/{y}/{x}",
    name: "GeoQ彩色底图(外网不可达)",
    disabled: true
  }
}

/**
 * OpenStreetMap 底图预设
 * @deprecated 外网不可达，已禁用
 */
export const osmBasemaps = {
  standard: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    name: "OpenStreetMap(外网不可达)",
    disabled: true
  },
  topo: {
    url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
    name: "OpenTopoMap地形渲染(外网不可达)",
    minZoom: 1,
    maxZoom: 17,
    disabled: true
  }
}

/**
 * ArcGIS 影像底图预设
 * @deprecated 外网不可达，已禁用
 */
export const arcgisBasemaps = {
  worldImagery: {
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    name: "ArcGIS影像(外网不可达)",
    enablePickFeatures: false,
    disabled: true
  }
}

/**
 * Bing 影像底图预设
 * 注意：Bing 底图需要使用 Mars3D 内置的 bing 类型，不使用 xyz URL
 */
export const bingBasemaps = {
  aerial: {
    name: "微软影像"
    // Bing 使用 Mars3D 内置类型，这里只存储名称信息
  }
}

/**
 * 高德滤镜底图预设
 * 使用 gaode 类型 + 滤镜参数实现深色主题
 */
export const gaodeFilterBasemaps = {
  blue: {
    name: "蓝色底图",
    invertColor: true,
    filterColor: "#4e70a6",
    brightness: 0.6,
    contrast: 1.8,
    gamma: 0.3,
    hue: 1,
    saturation: 0
  },
  green: {
    name: "绿色底图",
    invertColor: true,
    filterColor: "rgba(12, 238, 230)",
    brightness: 1,
    contrast: 1.0,
    gamma: 0.2,
    hue: 1,
    saturation: 0
  },
  dark: {
    name: "黑色底图",
    invertColor: true,
    filterColor: "#909090",
    brightness: 0.6,
    contrast: 1.8,
    gamma: 0.3,
    hue: 1,
    saturation: 0
  }
}

/**
 * 离线/特殊底图预设
 */
export const specialBasemaps = {
  offlineImagery: {
    url: `${MARS3D_DATA_URL}/tile/img/{z}/{x}/{y}.jpg`,
    name: "离线影像地图",
    chinaCRS: "GCJ02",
    maximumLevel: 13
  },
  singleImage: {
    url: `${MARS3D_DATA_URL}/img/map/world/world.jpg`,
    name: "单张图片底图"
  },
  gridEmpty: {
    name: "无底图",
    color: "#ffffff",
    alpha: 0.03,
    cells: 2
  }
}

/**
 * 获取所有可用的底图配置列表（完整版）
 * @returns 底图配置数组
 */
export function getAvailableBasemaps(): EoapiBasemapConfig[] {
  return [
    // eoAPI 本地代理底图（天地图系列）
    {
      id: "tianditu_imagery",
      name: tiandituBasemaps.imagery.name,
      urlTemplate: tiandituBasemaps.imagery.base
    },
    {
      id: "tianditu_vector",
      name: tiandituBasemaps.vector.name,
      urlTemplate: tiandituBasemaps.vector.base
    },
    {
      id: "tianditu_terrain",
      name: tiandituBasemaps.terrain.name,
      urlTemplate: tiandituBasemaps.terrain.base
    },
    // GeoQ 底图
    {
      id: "geoq_gray",
      name: geoqBasemaps.gray.name,
      urlTemplate: geoqBasemaps.gray.url
    },
    {
      id: "geoq_color",
      name: geoqBasemaps.color.name,
      urlTemplate: geoqBasemaps.color.url
    },
    // OpenStreetMap 系列
    {
      id: "osm_standard",
      name: osmBasemaps.standard.name,
      urlTemplate: osmBasemaps.standard.url
    },
    {
      id: "osm_topo",
      name: osmBasemaps.topo.name,
      urlTemplate: osmBasemaps.topo.url,
      minZoom: osmBasemaps.topo.minZoom,
      maxZoom: osmBasemaps.topo.maxZoom
    },
    // 国际影像底图
    {
      id: "arcgis_imagery",
      name: arcgisBasemaps.worldImagery.name,
      urlTemplate: arcgisBasemaps.worldImagery.url
    },
    // 离线/特殊底图
    {
      id: "offline_imagery",
      name: specialBasemaps.offlineImagery.name,
      urlTemplate: specialBasemaps.offlineImagery.url,
      maxZoom: specialBasemaps.offlineImagery.maximumLevel
    },
    {
      id: "single_image",
      name: specialBasemaps.singleImage.name,
      urlTemplate: specialBasemaps.singleImage.url
    }
  ]
}

export default {
  buildTiandituUrl,
  tiandituBasemaps,
  geoqBasemaps,
  osmBasemaps,
  arcgisBasemaps,
  bingBasemaps,
  gaodeFilterBasemaps,
  specialBasemaps,
  getAvailableBasemaps
}
