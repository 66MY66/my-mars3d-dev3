import * as mars3d from "mars3d"

let map: mars3d.Map | null = null
let heatLayer: mars3d.layer.HeatLayer | null = null
const frames: any[] = [] // 存储每一帧的热力数据
let lastFrameIndex = -1

/**
 * 初始化地图业务，生命周期钩子函数（必须）
 * 框架在地图初始化完成后自动调用该函数
 * @param {mars3d.Map} mapInstance 地图对象
 * @returns {void} 无
 */
export function onMounted(mapInstance: mars3d.Map): void {
  map = mapInstance

  // 创建热力图层
  heatLayer = new mars3d.layer.HeatLayer({
    name: "热异常演化演示",
    min: 0,
    max: 10,
    heatStyle: {
      radius: 60,
      blur: 0.85,
      gradient: {
        0.25: "rgb(0,0,255)",
        0.55: "rgb(0,255,0)",
        0.85: "yellow",
        1.0: "rgb(255,0,0)"
      }
    },
    // 默认显示
    show: true,
    flyTo: true
  })

  map.addLayer(heatLayer)

  // 初始化显示第一帧
  updateThermalLayer(0)
  
  // 飞向图层数据位置
  heatLayer.flyTo()
  
  console.log("Thermal evolution layer mounted")
}

/**
 * 释放当前地图业务的生命周期钩子函数（必须）
 * 框架在地图被销毁或组件卸载时自动调用该函数
 * @returns {void} 无
 */
export function onUnmounted(): void {
  if (map && heatLayer) {
    map.removeLayer(heatLayer, true)
    heatLayer = null
  }
  map = null
}

/**
 * 更新热力图数据
 * @param {number} frameIndex 帧索引
 */
export function updateThermalLayer(frameIndex: number): void {
  if (!heatLayer || frames.length === 0) {
    return
  }

  // 确保索引在范围内
  const maxIndex = frames.length - 1
  const safeIndex = Math.max(0, Math.min(Math.floor(frameIndex), maxIndex))
  
  if (safeIndex === lastFrameIndex) {
    return
  }
  lastFrameIndex = safeIndex
  
  const data = frames[safeIndex]
  
  heatLayer.setPositions(data)
}

// 生成模拟数据
export function generateMockData(count: number = 30) {
  frames.length = 0 // 清空旧数据
  lastFrameIndex = -1 // 重置索引
  const center = { lng: 117.23, lat: 31.82 } // 合肥附近

  for (let i = 0; i <= count; i++) {
    const frameData: any[] = []
    
    // 模拟几个热源随时间变化
    
    // 热源1: 扩散 (半径增大，强度增加)
    // 初始半径 0.02 -> 0.08
    const radius1 = 0.02 + (i / count) * 0.06
    const intensity1 = 5 + (i / count) * 5
    generateCirclePoints(frameData, center, radius1, 50, intensity1)

    // 热源2: 移动 (从左上向右下移动)
    // 起点 (lng-0.1, lat+0.1) -> 终点 (lng+0.1, lat-0.1)
    const start2 = { lng: center.lng - 0.1, lat: center.lat + 0.1 }
    const end2 = { lng: center.lng + 0.1, lat: center.lat - 0.1 }
    const current2 = {
      lng: start2.lng + (end2.lng - start2.lng) * (i / count),
      lat: start2.lat + (end2.lat - start2.lat) * (i / count)
    }
    generateCirclePoints(frameData, current2, 0.03, 30, 8)
    
    // 热源3: 随机闪烁 (位置固定，强度随机)
    const center3 = { lng: center.lng + 0.08, lat: center.lat + 0.08 }
    const intensity3 = Math.random() * 10
    generateCirclePoints(frameData, center3, 0.02, 20, intensity3)

    frames.push(frameData)
  }
}

function generateCirclePoints(arr: any[], center: {lng: number, lat: number}, radius: number, count: number, maxVal: number) {
  for (let j = 0; j < count; j++) {
    // 随机分布在圆内
    const r = radius * Math.sqrt(Math.random())
    const theta = Math.random() * 2 * Math.PI
    const pt = {
      lng: center.lng + r * Math.cos(theta),
      lat: center.lat + r * Math.sin(theta),
      value: Math.random() * maxVal
    }
    arr.push(pt)
  }
}
