export type AlertInfo = {
  taskName: string
  anomalyDate: string
  anomalyIndex: number | null
  baselineSampleCount: number | null
  trend: "rising" | "falling" | "stable" | null
  observedTemperature: number | null
  forecastTemperature: number | null
  temperatureDifference: number | null
  pointCount: number
  confirmedPointCount: number
  alertNo: string
  name: string
  type: string
  time: Date | string
  source: string
  region: string
  location: string
  status: string
  degree: string
  duration: string
  scope: string
  analysisResult: string
  monitoring: {
    maxSurfaceTemperature: number
    averageTemperature: number
    backgroundTemperature: number
    maxTemperatureDifference: number
    abnormalArea: number
    abnormalPixelCount: number
    cloudCoverage: number
    confidence: number
  }
}

export function createMockAlerts(): AlertInfo[] {
  return [
    {
      taskName: "kumamoto_20260728",
      anomalyDate: "2026-07-05",
      anomalyIndex: 1.207,
      baselineSampleCount: 38,
      trend: "stable",
      observedTemperature: 21.963,
      forecastTemperature: 25.244,
      temperatureDifference: -3.284,
      pointCount: 12,
      confirmedPointCount: 0,
      alertNo: "ALT-20261101-001",
      name: "区域持续热异常预告警",
      type: "热异常",
      time: new Date("2026-11-01T08:32:25"),
      source: "高分卫星热红外遥感影像",
      region: "北京市朝阳区东南部",
      location: "116.390, 39.900",
      status: "待确认",
      degree: "严重",
      duration: "4小时",
      scope: "5平方公里",
      analysisResult: "该区域热异常已持续4小时，异常范围较为集中，暂未发现明显扩散趋势。建议结合历史遥感影像和周边监测数据持续核查。",
      monitoring: {
        maxSurfaceTemperature: 68.4,
        averageTemperature: 52.7,
        backgroundTemperature: 31.2,
        maxTemperatureDifference: 37.2,
        abnormalArea: 3.6,
        abnormalPixelCount: 2846,
        cloudCoverage: 8.3,
        confidence: 87
      }
    },
    {
      taskName: "beijing_shunyi_20261101",
      anomalyDate: "2026-11-01",
      anomalyIndex: 1.486,
      baselineSampleCount: 42,
      trend: "rising",
      observedTemperature: 43.6,
      forecastTemperature: 30.5,
      temperatureDifference: 13.1,
      pointCount: 8,
      confirmedPointCount: 0,
      alertNo: "ALT-20261101-002",
      name: "局部热异常增强预告警",
      type: "热异常",
      time: new Date("2026-11-01T09:16:40"),
      source: "卫星热红外与地面监测融合数据",
      region: "北京市顺义区西南部",
      location: "116.465, 39.935",
      status: "待确认",
      degree: "中等",
      duration: "2小时",
      scope: "2.8平方公里",
      analysisResult: "该区域出现连续热异常信号，异常强度较前一时段有所上升，影响范围保持稳定。建议叠加近期遥感影像，核查是否存在持续性热源。",
      monitoring: {
        maxSurfaceTemperature: 54.8,
        averageTemperature: 43.6,
        backgroundTemperature: 30.5,
        maxTemperatureDifference: 24.3,
        abnormalArea: 2.1,
        abnormalPixelCount: 1652,
        cloudCoverage: 12.6,
        confidence: 82
      }
    },
    {
      taskName: "beijing_fengtai_20261101",
      anomalyDate: "2026-11-01",
      anomalyIndex: 0.918,
      baselineSampleCount: 35,
      trend: "falling",
      observedTemperature: 37.8,
      forecastTemperature: 29.7,
      temperatureDifference: 8.1,
      pointCount: 5,
      confirmedPointCount: 0,
      alertNo: "ALT-20261101-003",
      name: "短时局部热异常预告警",
      type: "热异常",
      time: new Date("2026-11-01T10:05:12"),
      source: "高分卫星热红外遥感影像",
      region: "北京市丰台区东南部",
      location: "116.318, 39.872",
      status: "待确认",
      degree: "轻微",
      duration: "45分钟",
      scope: "0.9平方公里",
      analysisResult: "该区域检测到短时、局部热异常，目前影响范围较小，尚未形成连续变化趋势。建议保持关注，并等待下一时相监测数据进行复核。",
      monitoring: {
        maxSurfaceTemperature: 43.9,
        averageTemperature: 37.8,
        backgroundTemperature: 29.7,
        maxTemperatureDifference: 14.2,
        abnormalArea: 0.7,
        abnormalPixelCount: 538,
        cloudCoverage: 17.4,
        confidence: 74
      }
    }
  ]
}
