import { describe, expect, it } from "vitest"
import config from "../../public/config/config.json"
import { isRetiredLayerMenuEntry, removeRetiredLayers } from "./retired-layers"

const removedLayerNames = [
  "倾斜摄影", "文庙", "文庙-单体化", "合肥天鹅湖", "县城社区", "校园(含单体)", "大雁塔",
  "人工建模", "水利闸门", "整体", "闸门", "石化工厂", "地下管网", "BIM模型", "桥梁",
  "轻轨地铁站", "大学教学楼", "点云", "高压线塔杆", "城市白模", "上海市区", "合肥市区-带贴图",
  "合肥市区", "gltf模型", "警车", "风力发电机", "无底图", "单张图片", "离线影像地图",
  "微软影像", "ArcGIS影像", "黑色底图", "绿色底图", "蓝色底图", "腾讯电子", "腾讯影像",
  "百度电子", "CZML动态轨迹", "车辆轨迹", "卫星轨道演示", "合肥规划图", "开放航拍影像",
  "OpenAerialMap", "Maxar 卫星影像", "Maxar 开放数据", "NOAA 应急影像", "NOAA 紧急响应数据",
  "数据图层", "三维数据", "归一化差值植被指数", "NDVI变化率", "Sentinel-2 NDVI",
  "CMIP6 气候数据", "地表温度 (GISS-E2-1-G)", "动态数据", "栅格数据服务",
  "矢量数据", "地形服务"
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
  it("physically removes the requested placeholder and obsolete remote-sensing entries", () => {
    const names = collectNames(config.layers || [])
    const removedNames = [
      "高分辨率光学遥感数据",
      "高分辨率 SAR 遥感数据",
      "高分辨率多光谱遥感数据",
      "长波辐射",
      "OLR长波辐射数据",
      "长波辐射异常指数",
      "MODIS地表温度日产品",
      "地表温度月均值",
      "气候数据",
      "降水分布",
      "气温分布",
      "光学影像异常识别",
      "植被异常区域",
      "地表反射率异常",
      "形变隐患识别",
      "形变隐患点分布",
      "InSAR形变监测",
      "热异常识别",
      "热异常强度分布",
      "地表热异常检测结果",
      "气象遥感底图",
      "GPM降水数据",
      "风云气象卫星影像",
      "红外遥感数据底图",
      "Sentinel-3热红外数据",
      "MODIS热红外影像"
    ]

    removedNames.forEach((name) => expect(names.has(name), name).toBe(false))
  })

  it("does not expose the retired layer entries", () => {
    const names = collectNames(removeRetiredLayers(config.layers || []))
    removedLayerNames.forEach((name) => expect(names.has(name), name).toBe(false))
  })

  it("keeps unrelated shared layer entries", () => {
    const names = collectNames(removeRetiredLayers(config.layers || []))
    expect(names.has("全国人口格网（2020）")).toBe(true)
  })

  it("keeps retired-menu data sources available to non-menu features", () => {
    const raw = JSON.stringify(config)
    expect(raw).toContain("S2_NDVI_Yunnan_2023_COG.tif")
    expect(raw).toContain("S2_NDVI_trend_COG.tif")
    expect(raw).toContain("CMIP6_daily_GISS-E2-1-G_tas")
  })

  it("removes the requested directory trees from the runtime map configuration", () => {
    const removedTreeIds = new Set([110, 51, 30, 52, 53, 5310, 5320, 54, 5410, 5420, 55, 5510, 5520, 50, 60, 80])
    const filtered = removeRetiredLayers(config.layers || [])
    const leftovers = filtered.filter((item: any) => removedTreeIds.has(item?.id) || removedTreeIds.has(item?.pid))
    expect(leftovers).toEqual([])
  })

  it("filters retired entries from a nested layer-menu tree only", () => {
    const tree = [
      { id: 20, name: "三维数据", children: [{ id: 2010, pid: 20, name: "gltf模型" }] },
      { id: 999, name: "保留目录", children: [{ id: 1000, pid: 999, name: "保留图层" }] }
    ]

    const filtered = removeRetiredLayers(tree)
    expect(filtered).toEqual([{ id: 999, name: "保留目录", children: [{ id: 1000, pid: 999, name: "保留图层" }] }])
  })

  it("hides a menu leaf through its retired parent without removing the layer", () => {
    const parent = { id: 5030, name: "归一化差值植被指数" }
    const leaf = { id: "ndvi", pid: 5030, name: "可复用NDVI数据" }

    expect(isRetiredLayerMenuEntry(leaf, (id) => String(id) === "5030" ? parent : null)).toBe(true)
    expect(leaf).toEqual({ id: "ndvi", pid: 5030, name: "可复用NDVI数据" })
  })
})
