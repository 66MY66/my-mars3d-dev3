export interface AlgorithmVersion {
  versionId: string
  createTime: number
  params: Record<string, any>
  status: "draft" | "verified" | "published"
  verificationResult?: {
    accuracy: number
    deviation: number
    reportUrl?: string
  }
}

export interface AlgorithmInputParam {
  key: string
  label: string
  type: "number" | "slider" | "select" | "date-range" | "text"
  unit?: string
  value: any // 默认值
  constraints?: {
    min?: number
    max?: number
    step?: number
    options?: { label: string; value: any }[]
  }
}

export interface AlgorithmModel {
  id: string
  name: string
  icon?: string
  widget: string
  description?: string
  algorithmType: "correlation" | "clustering" | "prediction" | "basic"
  inputParams: AlgorithmInputParam[]
  versions: AlgorithmVersion[]
}

export const defaultAlgorithms: AlgorithmModel[] = [
  {
    id: "algo_001",
    name: "地震热异常相关性分析",
    icon: "analysis",
    widget: "analysis-tool",
    description: "基于热异常与地震活动的相关性分析模型",
    algorithmType: "correlation",
    inputParams: [
      {
        key: "radiationThreshold",
        label: "辐射亮度阈值",
        type: "number",
        value: 300,
        unit: "K",
        constraints: { min: 0, max: 1000, step: 1 }
      },
      {
        key: "intensityThreshold",
        label: "热异常强度",
        type: "slider",
        value: 5,
        constraints: { min: 1, max: 10, step: 1 }
      },
      {
        key: "overlapArea",
        label: "重叠面积阈值",
        type: "number",
        value: 50,
        unit: "%",
        constraints: { min: 0, max: 100, step: 1 }
      },
      {
        key: "duration",
        label: "持续时间",
        type: "number",
        value: 24,
        unit: "小时",
        constraints: { min: 1, max: 720, step: 1 }
      },
      {
        key: "lagTime",
        label: "滞后时间",
        type: "number",
        value: 3,
        unit: "天",
        constraints: { min: 0, max: 30, step: 1 }
      }
    ],
    versions: []
  },
  {
    id: "algo_002",
    name: "缓冲区分析",
    icon: "halo",
    widget: "analysis-tool",
    description: "空间缓冲区分析工具",
    algorithmType: "basic",
    inputParams: [
      {
        key: "radius",
        label: "缓冲半径",
        type: "number",
        value: 500,
        unit: "米",
        constraints: { min: 0, step: 10 }
      },
      {
        key: "smooth",
        label: "平滑度",
        type: "slider",
        value: 10,
        constraints: { min: 1, max: 100 }
      }
    ],
    versions: []
  }
]

// 兼容旧的简单定义，但在新逻辑中应优先使用 AlgorithmModel
export const toolParamDefs: Record<string, any[]> = {
  measure: [
    { label: "单位", key: "unit", type: "select", value: "auto", options: [{ label: "自动", value: "auto" }, { label: "米", value: "m" }, { label: "公里", value: "km" }] }
  ],
  // 映射到新的数据结构
  "analysis-tool": defaultAlgorithms[0].inputParams,
  buffer: [
    {
      label: "缓冲类型",
      key: "mode",
      type: "select",
      value: "multi",
      options: [
        { label: "多环缓冲", value: "multi" },
        { label: "单环缓冲", value: "single" }
      ]
    },
    {
      label: "距离单位",
      key: "distanceUnit",
      type: "select",
      value: "km",
      options: [
        { label: "公里(km)", value: "km" },
        { label: "米(m)", value: "m" }
      ]
    },
    { label: "核心区半径", key: "coreKm", type: "number", value: 50, step: 5, unitKey: "distanceUnit", min: 0 },
    { label: "过渡区半径", key: "transitionKm", type: "number", value: 100, step: 5, unitKey: "distanceUnit", min: 0 },
    { label: "边缘区半径", key: "edgeKm", type: "number", value: 150, step: 5, unitKey: "distanceUnit", min: 0 },
    { label: "单环半径", key: "radiusKm", type: "number", value: 50, step: 5, unitKey: "distanceUnit", min: 0 },
    {
      label: "透明度",
      key: "opacity",
      type: "slider",
      value: 70,
      constraints: { min: 5, max: 95, step: 1 }
    },
    {
      label: "平滑度",
      key: "smooth",
      type: "slider",
      value: 64,
      constraints: { min: 8, max: 128, step: 1 }
    }
  ],
  overlay: [
    {
      label: "目标图层",
      key: "targetLayer",
      type: "select",
      value: "mock-admin",
      options: [
        { label: "模拟-行政区", value: "mock-admin" },
        { label: "模拟-隐患面", value: "mock-hazard-area" }
      ]
    },
    {
      label: "运算方式",
      key: "operation",
      type: "select",
      value: "intersect",
      options: [
        { label: "交集", value: "intersect" },
        { label: "并集", value: "union" },
        { label: "差集(A-B)", value: "difference" }
      ]
    }
  ],
  neighbor: [
    {
      label: "分析方式",
      key: "analysisMode",
      type: "select",
      value: "hazard",
      options: [
        { label: "隐患点分析", value: "hazard" },
        { label: "区域统计", value: "area" },
        { label: "焦点统计", value: "focal" }
      ]
    },
    {
      label: "数据集",
      key: "dataset",
      type: "select",
      value: "hazard-point",
      modes: ["hazard"],
      options: [{ label: "隐患点", value: "hazard-point" }]
    },
    {
      label: "呈现方式",
      key: "render",
      type: "select",
      value: "heat+point",
      modes: ["hazard"],
      options: [
        { label: "热力图+点", value: "heat+point" },
        { label: "仅点", value: "point" },
        { label: "仅热力图", value: "heat" }
      ]
    },
    {
      label: "距离单位",
      key: "distanceUnit",
      type: "select",
      value: "m",
      modes: ["hazard"],
      options: [
        { label: "米(m)", value: "m" },
        { label: "公里(km)", value: "km" }
      ]
    },
    { label: "分析半径", key: "radius", type: "number", value: 50000, step: 5000, unitKey: "distanceUnit", min: 0, modes: ["hazard"] },
    { label: "返回数量", key: "limit", type: "number", value: 200, step: 10, unit: "条", min: 1, modes: ["hazard"] },
    {
      label: "热力半径",
      key: "heatRadius",
      type: "number",
      value: 28,
      step: 1,
      unit: "px",
      min: 5,
      modes: ["hazard"]
    },
    {
      label: "栅格数据源",
      key: "rasterSource",
      type: "select",
      value: "",
      modes: ["area", "focal"],
      options: []
    },
    { label: "波段", key: "rasterBand", type: "select", value: "1", modes: ["area", "focal"], options: [] },
    {
      label: "NoData处理",
      key: "noDataMode",
      type: "select",
      value: "ignore",
      modes: ["area", "focal"],
      options: [
        { label: "忽略NoData", value: "ignore" },
        { label: "计入NoData", value: "include" }
      ]
    },
    {
      label: "统计方法",
      key: "statistic",
      type: "select",
      value: "mean",
      modes: ["focal"],
      options: [
        { label: "均值", value: "mean" },
        { label: "最大值", value: "maximum" },
        { label: "最小值", value: "minimum" },
        { label: "标准差", value: "stddev" }
      ]
    },
    {
      label: "窗口形状",
      key: "windowShape",
      type: "select",
      value: "square",
      modes: ["focal"],
      options: [
        { label: "方形", value: "square" },
        { label: "圆形", value: "circle" }
      ]
    },
    { label: "窗口大小", key: "windowSize", type: "number", value: 3, step: 2, min: 3, max: 31, unit: "像元", modes: ["focal"] },
    {
      label: "预览精度",
      key: "previewResolution",
      type: "select",
      value: "low",
      modes: ["focal"],
      options: [
        { label: "低分辨率（快速）", value: "low" },
        { label: "中分辨率", value: "medium" }
      ]
    }
  ]
}
