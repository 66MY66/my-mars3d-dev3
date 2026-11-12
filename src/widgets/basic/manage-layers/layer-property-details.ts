export interface LayerPropertyField {
  label: string
  value: unknown
}

export interface LayerPropertySection {
  title: string
  fields: LayerPropertyField[]
}

const BASEGEO_FIELDS: Record<string, string> = {
  BOUA: "名称、行政区代码",
  BOUL: "分类代码",
  LRDL: "名称、路线编号、道路类型",
  LRRL: "名称、路线编号、铁路类型",
  HYDA: "名称、水系代码、周期（数据提供时）",
  HYDL: "名称、水系代码、周期",
  RESA: "分类代码",
  RESP: "分类代码、角度（数据提供时）",
  AGNP: "名称、行政区名称、分类"
}

function cleanSections(sections: LayerPropertySection[]): LayerPropertySection[] {
  return sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) => field.value !== undefined && field.value !== null && field.value !== "")
    }))
    .filter((section) => section.fields.length > 0)
}

function basicFields(layer: any): LayerPropertyField[] {
  return [
    { label: "图层名称", value: layer.name },
    { label: "图层类型", value: layer.type },
    { label: "图层 ID", value: layer.id },
    { label: "数据来源", value: layer.source },
    { label: "STAC Item ID", value: layer.itemId },
    { label: "所属集合", value: layer.collection || (layer.itemId ? "spatial-thematic" : undefined) }
  ]
}

function baseGeoGeometry(layer: any): string {
  const symbolType = String(layer.symbol?.type || "").toLowerCase()
  if (symbolType.includes("polygon")) {
    return "Polygon（面）"
  }
  if (symbolType.includes("polyline")) {
    return "LineString（线）"
  }
  if (symbolType.includes("point")) {
    return "Point（点）"
  }
  if (symbolType.includes("label")) {
    return "Point（注记点）"
  }
  return ""
}

export function buildProfiledLayerPropertySections(layer: any): LayerPropertySection[] {
  const profile = layer?.detailProfile

  if (profile === "china-admin-boundary") {
    return cleanSections([
      { title: "基本信息", fields: basicFields(layer) },
      {
        title: "数据信息",
        fields: [
          { label: "数据内容", value: "中国国界、省级行政区划界线、十段线及南海诸岛" },
          { label: "数据格式", value: "GeoJSON（源数据为 GMT）" },
          { label: "源数据坐标系", value: "EPSG:4326（WGS 84）" },
          { label: "几何类型", value: "LineString、Polygon" },
          { label: "空间范围", value: "东经 73.501142°～135.088511°；北纬 3.408477°～53.560901°" },
          { label: "数据日期", value: "2024-12-25" }
        ]
      },
      { title: "要素信息", fields: [{ label: "要素数量", value: "1083" }] },
      {
        title: "数据说明",
        fields: [
          { label: "内容说明", value: "不是乡镇界或村界，数据不含行政区划代码" },
          { label: "更新时间", value: layer.updatedAt }
        ]
      }
    ])
  }

  if (profile === "china-active-faults") {
    return cleanSections([
      { title: "基本信息", fields: basicFields(layer) },
      {
        title: "数据信息",
        fields: [
          { label: "数据内容", value: "中国活动断层线全国汇编" },
          { label: "数据版本", value: "GMT 中国地理数据集 v0.4.0" },
          { label: "数据日期", value: "2024-12-25" },
          { label: "数据格式", value: "GeoJSON（源数据为 GMT）" },
          { label: "源数据坐标系", value: layer.crs },
          { label: "几何类型", value: layer.geometryType },
          { label: "空间范围", value: "东经 72.0°～134.4805°；北纬 1.317067°～55.000158°" }
        ]
      },
      {
        title: "要素信息",
        fields: [
          { label: "要素数量", value: layer.featureCount },
          { label: "可查询属性", value: "中英文断层名称、断层性质、活动时代、时代描述、数据出处" }
        ]
      },
      {
        title: "数据说明",
        fields: [
          { label: "适用范围", value: "全国汇编数据，不是九寨沟专项调查，不能替代断裂带范围面" },
          { label: "更新时间", value: layer.updatedAt }
        ]
      }
    ])
  }

  if (profile === "jiuzhaigou-intensity") {
    return cleanSections([
      { title: "基本信息", fields: basicFields(layer) },
      {
        title: "数据信息",
        fields: [
          { label: "地震事件", value: "2017年8月8日四川九寨沟7.0级地震" },
          { label: "事件时间", value: layer.eventTime },
          { label: "震级", value: "7.0级（随包参数表）" },
          { label: "震源深度", value: "20千米（随包参数表）" },
          { label: "震中位置", value: "九寨沟县漳扎镇附近（103.82°E、33.2°N）" },
          { label: "数据格式", value: "GeoJSON（源数据为 SHP / MapGIS）" },
          { label: "源数据坐标系", value: "EPSG:4326（已由 CGCS2000 三度带转换）" },
          { label: "空间范围", value: "东经 103.063897°～104.589473°；北纬 32.505733°～34.032076°" }
        ]
      },
      {
        title: "要素信息",
        fields: [
          { label: "烈度范围", value: "6～9度" },
          { label: "要素数量", value: "4个面" },
          { label: "几何类型", value: "Polygon（面）" },
          { label: "可查询属性", value: "地震烈度、来源文件、属性说明" }
        ]
      },
      {
        title: "数据说明",
        fields: [
          { label: "成果性质", value: layer.description },
          { label: "来源限制", value: "事件参数来自随包图片，不是地震目录接口；文件未提供评估方法、来源单位和版本号" },
          { label: "更新时间", value: layer.updatedAt }
        ]
      }
    ])
  }

  if (profile === "basegeo-250k") {
    const isH48 = layer.sheet === "H48"
    return cleanSections([
      { title: "基本信息", fields: [...basicFields(layer), { label: "图幅编号", value: layer.sheet }] },
      {
        title: "数据信息",
        fields: [
          { label: "数据集", value: "西南地区 1:25 万基础地理" },
          { label: "比例尺", value: "1:25万" },
          { label: "展示格式", value: "GeoJSON" },
          { label: "原始格式", value: "File Geodatabase" },
          { label: "源数据坐标系", value: "EPSG:4326（WGS 84）" },
          { label: "图幅范围", value: isH48 ? "102°～108°E、28°～32°N" : "102°～108°E、32°～36°N" }
        ]
      },
      {
        title: "要素信息",
        fields: [
          { label: "要素类别", value: layer.name },
          { label: "分类代码", value: layer.featureCode },
          { label: "几何类型", value: baseGeoGeometry(layer) },
          { label: "可查询属性", value: BASEGEO_FIELDS[layer.featureCode] }
        ]
      },
      {
        title: "数据说明",
        fields: [
          { label: "成图年份", value: "源文件未标注" },
          { label: "高程数据", value: "不包含 DEM" },
          { label: "更新时间", value: "2026-10-31" }
        ]
      }
    ])
  }

  if (profile === "building-damage-heatmap") {
    return cleanSections([
      {
        title: "基本信息",
        fields: [
          ...basicFields(layer),
          { label: "运行标签", value: layer.runTag },
          { label: "运行 ID", value: layer.runId }
        ]
      },
      {
        title: "数据信息",
        fields: [
          { label: "数据内容", value: "房屋损毁评估热力栅格" },
          { label: "展示方式", value: "XYZ 瓦片 / TiTiler（YlOrRd）" },
          { label: "数据格式", value: "Cloud Optimized GeoTIFF（COG）" },
          { label: "评估时间", value: layer.assessmentTime },
          { label: "源数据坐标系", value: "EPSG:4326（WGS 84）" },
          { label: "栅格尺寸", value: "300 × 300 像元" },
          { label: "空间范围", value: "东经 101.5805°～101.5835°；北纬 26.5875°～26.5905°" },
          { label: "基础数据", value: "震前/震后遥感影像 + CMAB-01 建筑矢量" }
        ]
      },
      {
        title: "数值信息",
        fields: [
          { label: "波段", value: "Band 1" },
          { label: "数据类型", value: "Float32" },
          { label: "数值范围", value: "0～2.983392" },
          { label: "房屋数量", value: "84 栋" },
          { label: "评估区域", value: "1 个" },
          { label: "重复删除", value: "0 条" },
          { label: "分类定义", value: "0 无明显损毁；1 轻微；2 中等；3 严重；4 倒塌；9 无法判定" }
        ]
      },
      {
        title: "数据说明",
        fields: [
          { label: "数据标识", value: "fake_damage10（测试数据）" },
          { label: "渲染说明", value: "YlOrRd 色带；0 值透明，数值越大颜色越红" },
          { label: "模型版本", value: "GLM-5.3-Flash" },
          { label: "质量状态", value: "影像正常、分类有效，未启用无影像模式" },
          { label: "数值说明", value: "当前展示的是连续热力值，不应直接等同于离散损毁等级代码" },
          { label: "内容说明", value: "由房屋损毁评估生成；原始文件来自私有 MinIO 桶，已生成可调用 COG 副本" },
          { label: "更新时间", value: layer.updatedAt }
        ]
      }
    ])
  }

  if (profile === "china-socioeconomic-grid") {
    return cleanSections([
      { title: "基本信息", fields: basicFields(layer) },
      {
        title: "数据信息",
        fields: [
          { label: "数据内容", value: `2020年全国${layer.metricName}格网` },
          { label: "数据年份", value: "2020" },
          { label: "数据格式", value: "Cloud Optimized GeoTIFF（COG）" },
          { label: "展示方式", value: "XYZ瓦片 / TiTiler（visual预着色资产）" },
          { label: "源数据坐标系", value: "EPSG:4326（WGS 84）" },
          { label: "原始格网", value: "1公里" },
          { label: "发布像元", value: "0.005°（约0.5公里）" },
          { label: "栅格尺寸", value: "14080 × 8192 像元" },
          { label: "STAC覆盖范围", value: "东经 67.5°～136.8°；北纬 15.0°～55.0°" },
          { label: "COG文件边界", value: "东经 67.5°～137.9°；北纬 14.04°～55.0°" }
        ]
      },
      {
        title: "数值信息",
        fields: [
          { label: "波段", value: "Band 1" },
          { label: "波段含义", value: layer.bandDescription },
          { label: "数据类型", value: "Float32" },
          { label: "数值单位", value: layer.unit },
          { label: "数值范围", value: layer.valueRange },
          { label: "全国总量", value: layer.total },
          { label: "无数据值", value: "-9999" }
        ]
      },
      {
        title: "数据说明",
        fields: [
          { label: "数值含义", value: `每个发布像元保存其所在1公里格网的${layer.metricName}原值` },
          { label: "资产说明", value: "当前地图加载visual预着色资产；data资产保存原始数值" },
          { label: "透明区域", value: "海上及无数据区域透明" },
          { label: "三维资产", value: "STAC同时提供height、surface及三维浏览页资产" },
          { label: "数据限制", value: "属性中的全国总量来自STAC条目说明；地图像元值应以data资产为准" },
          { label: "更新时间", value: layer.updatedAt }
        ]
      }
    ])
  }

  if (profile === "thermal-evolution-demo") {
    return cleanSections([
      { title: "基本信息", fields: [{ label: "图层名称", value: layer.name }, { label: "图层类型", value: layer.type }, { label: "图层 ID", value: layer.id }] },
      { title: "数据信息", fields: [{ label: "数据内容", value: "热异常演化轨迹示例" }, { label: "数据性质", value: "配置内置演示数据" }] },
      { title: "要素信息", fields: [{ label: "几何类型", value: "Polyline（折线）" }, { label: "节点数量", value: "5" }, { label: "坐标范围", value: "东经 100.5°～102.5°；北纬 25.0°～27.0°" }] },
      { title: "数据说明", fields: [{ label: "用途说明", value: "用于演示热异常演化播放，不代表真实监测结果" }, { label: "关联功能", value: "热异常演化播放组件" }] }
    ])
  }

  return []
}
