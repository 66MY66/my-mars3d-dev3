export const RETIRED_LAYER_NAMES = new Set([
  "倾斜摄影", "文庙", "文庙-单体化", "合肥天鹅湖", "县城社区", "校园(含单体)", "大雁塔", "人工建模",
  "水利闸门", "整体", "闸门", "石化工厂", "地下管网", "BIM模型", "桥梁", "轻轨地铁站", "大学教学楼",
  "点云", "高压线塔杆", "城市白模", "上海市区", "合肥市区-带贴图", "合肥市区", "gltf模型", "警车",
  "风力发电机", "无底图", "单张图片", "离线影像地图", "微软影像", "ArcGIS影像", "黑色底图", "绿色底图",
  "蓝色底图", "腾讯电子", "腾讯影像", "百度电子", "CZML动态轨迹", "车辆轨迹", "卫星轨道演示", "合肥规划图",
  "开放航拍影像", "OpenAerialMap", "Maxar 卫星影像", "Maxar 开放数据", "NOAA 应急影像", "NOAA 紧急响应数据"
])

export function removeRetiredLayers<T extends Record<string, any>>(items: T[] = []): T[] {
  return items.filter((item) => !RETIRED_LAYER_NAMES.has(String(item?.name || ""))).map((item) => {
    if (!Array.isArray(item.layers)) {
      return item
    }
    return { ...item, layers: removeRetiredLayers(item.layers) }
  })
}
