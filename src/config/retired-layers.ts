export const RETIRED_LAYER_NAMES = new Set([
  "倾斜摄影", "文庙", "文庙-单体化", "合肥天鹅湖", "县城社区", "校园(含单体)", "大雁塔", "人工建模",
  "水利闸门", "整体", "闸门", "石化工厂", "地下管网", "BIM模型", "桥梁", "轻轨地铁站", "大学教学楼",
  "点云", "高压线塔杆", "城市白模", "上海市区", "合肥市区-带贴图", "合肥市区", "gltf模型", "警车",
  "风力发电机", "无底图", "单张图片", "离线影像地图", "微软影像", "ArcGIS影像", "黑色底图", "绿色底图",
  "蓝色底图", "腾讯电子", "腾讯影像", "百度电子", "CZML动态轨迹", "车辆轨迹", "卫星轨道演示", "合肥规划图",
  "开放航拍影像", "OpenAerialMap", "Maxar 卫星影像", "Maxar 开放数据", "NOAA 应急影像", "NOAA 紧急响应数据"
])

export const RETIRED_LAYER_TREE_IDS = new Set([20, 52, 53, 54, 55, 99, 100, 110, 4110, 5030])

export function isRetiredLayerMenuEntry(item: Record<string, any>, getById?: (id: string | number) => Record<string, any> | null | undefined): boolean {
  let current: Record<string, any> | null | undefined = item
  const visited = new Set<string>()
  while (current) {
    const id = String(current.id ?? "")
    if (RETIRED_LAYER_TREE_IDS.has(Number(id)) || RETIRED_LAYER_NAMES.has(String(current.name || ""))) {
      return true
    }
    const pid = String(current.pid ?? current.options?.pid ?? "")
    if (!pid || visited.has(pid)) {
      return false
    }
    visited.add(pid)
    current = getById?.(pid)
  }
  return false
}

export function removeRetiredLayers<T extends Record<string, any>>(items: T[] = []): T[] {
  const retiredIds = new Set(Array.from(RETIRED_LAYER_TREE_IDS, String))
  let changed = true
  while (changed) {
    changed = false
    items.forEach((item) => {
      const id = String(item?.id ?? "")
      const pid = String(item?.pid ?? "")
      if (id && !retiredIds.has(id) && (retiredIds.has(pid) || RETIRED_LAYER_NAMES.has(String(item?.name || "")))) {
        retiredIds.add(id)
        changed = true
      }
    })
  }

  return items.filter((item) => {
    const id = String(item?.id ?? "")
    const pid = String(item?.pid ?? "")
    return !RETIRED_LAYER_NAMES.has(String(item?.name || "")) && !retiredIds.has(id) && !retiredIds.has(pid)
  }).map((item) => {
    const next: Record<string, any> = { ...item }
    if (Array.isArray(item.layers)) {
      next.layers = removeRetiredLayers(item.layers)
    }
    if (Array.isArray(item.children)) {
      next.children = removeRetiredLayers(item.children)
    }
    return next as T
  })
}
