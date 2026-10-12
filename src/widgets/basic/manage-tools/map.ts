/**
 * 算子库 后端业务处理
 * @copyright 火星科技 mars3d.cn
 * @author 火星科技 2024-02-13
 */

let map: any // mars3d.Map三维地图对象

// 初始化当前业务
export function onMounted(mapInstance: any): void {
  map = mapInstance // 记录map
}

// 释放当前业务
export function onUnmounted(): void {
  map = null
}
