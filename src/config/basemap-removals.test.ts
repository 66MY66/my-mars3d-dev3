import { describe, expect, it } from "vitest"

import config from "../../public/config/config.json"

const removedBasemapNames = [
  "天地图影像",
  "天地图矢量",
  "天地图地形",
  "eoAPI地形底图",
  "eoAPI灰度底图",
  "eoAPI暗色底图",
  "eoAPI热力底图",
  "GeoQ灰色底图(外网不可达)",
  "GeoQ彩色底图(外网不可达)",
  "高德矢量(本地)",
  "离线影像地图",
  "单张图片",
  "微软影像"
]

describe("底图弹窗配置", () => {
  it("不再暴露已确认不可用的底图入口", () => {
    const names = new Set(config.basemaps.map((item) => item.name))

    for (const name of removedBasemapNames) {
      expect(names.has(name), `仍然存在底图入口：${name}`).toBe(false)
    }
  })

  it("保留默认底图与未要求删除的底图", () => {
    expect(config.basemaps.some((item) => item.name === "高德影像(本地)" && item.show === true)).toBe(true)
    expect(config.basemaps.some((item) => item.name === "OpenStreetMap(外网不可达)")).toBe(true)
    expect(config.basemaps.some((item) => item.name === "ArcGIS影像")).toBe(true)
  })
})
