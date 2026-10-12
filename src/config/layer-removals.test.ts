import { describe, expect, it } from "vitest"
import config from "../../public/config/config.json"
import { removeRetiredLayers } from "./retired-layers"

const removedLayerNames = [
  "倾斜摄影", "文庙", "文庙-单体化", "合肥天鹅湖", "县城社区", "校园(含单体)", "大雁塔",
  "人工建模", "水利闸门", "整体", "闸门", "石化工厂", "地下管网", "BIM模型", "桥梁",
  "轻轨地铁站", "大学教学楼", "点云", "高压线塔杆", "城市白模", "上海市区", "合肥市区-带贴图",
  "合肥市区", "gltf模型", "警车", "风力发电机", "无底图", "单张图片", "离线影像地图",
  "微软影像", "ArcGIS影像", "黑色底图", "绿色底图", "蓝色底图", "腾讯电子", "腾讯影像",
  "百度电子", "CZML动态轨迹", "车辆轨迹", "卫星轨道演示", "合肥规划图", "开放航拍影像",
  "OpenAerialMap", "Maxar 卫星影像", "Maxar 开放数据", "NOAA 应急影像", "NOAA 紧急响应数据"
]

function collectNames(items: any[], names = new Set<string>()) {
  items.forEach((item) => {
    if (item?.name) {
      names.add(item.name)
    }
    if (Array.isArray(item?.layers)) {
      collectNames(item.layers, names)
    }
  })
  return names
}

describe("layer menu removals", () => {
  it("does not expose the retired layer entries", () => {
    const names = collectNames(removeRetiredLayers([...(config.basemaps || []), ...(config.layers || [])]))
    removedLayerNames.forEach((name) => expect(names.has(name), name).toBe(false))
  })

  it("keeps unrelated shared layer entries", () => {
    const names = collectNames(removeRetiredLayers([...(config.basemaps || []), ...(config.layers || [])]))
    expect(names.has("三维数据")).toBe(true)
    expect(names.has("KML数据")).toBe(true)
    expect(names.has("Facebook 人口密度")).toBe(true)
    expect(names.has("高德影像")).toBe(true)
  })
})
