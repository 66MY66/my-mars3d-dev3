export type StatsChartKey = "population" | "economy" | "housing" | "radiation" | "vegetation"

type StatsRow = Record<string, any>

const divisionLabels: Record<StatsChartKey, string> = {
  population: "人口栅格 · 行政区汇总",
  housing: "建筑结构 · 抗震等级",
  economy: "区域经济贡献",
  radiation: "月份 · 异常等级",
  vegetation: "月份 · 覆盖等级"
}

export function getStatsDivisionLabel(key: StatsChartKey) {
  return divisionLabels[key]
}

function buildPopulationOption(rows: StatsRow[]) {
  const sorted = [...rows].sort((a, b) => Number(b["人口"] || 0) - Number(a["人口"] || 0))
  return {
    animation: false,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (items: any[]) => {
        const index = Number(items?.[0]?.dataIndex || 0)
        const row = sorted[index] || {}
        return `${row["区划"] || "未命名"}<br/>人口：${Number(row["人口"] || 0).toLocaleString()} 人<br/>密度：${Number(row["人口密度"] || 0).toLocaleString()} 人/km²`
      }
    },
    grid: { left: 82, right: 28, top: 14, bottom: 28 },
    xAxis: { type: "value", name: "人口（人）" },
    yAxis: { type: "category", inverse: true, data: sorted.map((row) => row["区划"]) },
    series: [{ name: "人口总数", type: "bar", data: sorted.map((row) => Number(row["人口"] || 0)), barMaxWidth: 22, itemStyle: { color: "#4c8dff" } }]
  }
}

function buildHousingOption(rows: StatsRow[]) {
  const grades = ["高风险", "较高风险", "中风险", "较低风险", "低风险"]
  const colors = ["#f5222d", "#fa8c16", "#fadb14", "#73d13d", "#20c997"]
  return {
    animation: false,
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: number) => `${Number(value).toFixed(1)}%` },
    legend: { top: 0, data: grades },
    grid: { left: 86, right: 24, top: 38, bottom: 24 },
    xAxis: { type: "value", min: 0, max: 100, axisLabel: { formatter: "{value}%" } },
    yAxis: { type: "category", data: rows.map((row) => row["分类"] || row["区划"]) },
    series: grades.map((grade, index) => ({
      name: grade,
      type: "bar",
      stack: "抗震等级",
      data: rows.map((row) => Number(row[grade] || 0)),
      barMaxWidth: 24,
      itemStyle: { color: colors[index] },
      emphasis: { focus: "series" }
    }))
  }
}

function buildEconomyOption(rows: StatsRow[]) {
  return {
    animation: false,
    tooltip: { formatter: (item: any) => `${item?.name || "未命名"}<br/>经济量：${Number(item?.value || 0).toLocaleString()}` },
    series: [{
      name: "区域经济贡献",
      type: "treemap",
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: { show: true, formatter: "{b}\n{c}" },
      upperLabel: { show: false },
      data: rows.map((row) => ({ name: String(row["区划"] || "未命名"), value: Math.max(0, Number(row["经济"] || 0)) }))
    }]
  }
}

function buildRadiationOption(rows: StatsRow[]) {
  const months = rows.map((row) => row["月份"])
  const lower = rows.map((row) => Number(row["正常下限"] || 0))
  const range = rows.map((row, index) => Math.max(0, Number(row["正常上限"] || 0) - lower[index]))
  return {
    animation: false,
    tooltip: { trigger: "axis" },
    legend: { top: 0, data: ["热辐射", "历史基准", "正常范围", "异常点"] },
    grid: { left: 48, right: 22, top: 38, bottom: 30 },
    xAxis: { type: "category", boundaryGap: false, data: months },
    yAxis: { type: "value", name: "辐射值" },
    series: [
      { name: "正常下限", type: "line", stack: "正常范围", data: lower, symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
      { name: "正常范围", type: "line", stack: "正常范围", data: range, symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(82,196,26,0.22)" } },
      { name: "历史基准", type: "line", data: rows.map((row) => Number(row["基准值"] || 0)), symbol: "none", lineStyle: { type: "dashed", color: "#8c8c8c" } },
      { name: "热辐射", type: "line", data: rows.map((row) => Number(row["数值"] || 0)), smooth: true, symbolSize: 6, lineStyle: { width: 2, color: "#fa541c" } },
      { name: "异常点", type: "scatter", data: rows.filter((row) => row["异常"]).map((row) => [row["月份"], Number(row["数值"] || 0)]), symbolSize: 10, itemStyle: { color: "#f5222d" } }
    ]
  }
}

function buildVegetationOption(rows: StatsRow[]) {
  const grades = ["无植被", "低覆盖", "中覆盖", "中高覆盖", "高覆盖"]
  const colors = ["#8c8c8c", "#d3adf7", "#95de64", "#52c41a", "#237804"]
  const coverageSeries = grades.map((grade, index) => ({
    name: grade,
    type: "line",
    stack: "覆盖等级",
    data: rows.map((row) => Number(row[grade] || 0)),
    symbol: "none",
    lineStyle: { width: 0.8, color: colors[index] },
    areaStyle: { color: colors[index], opacity: 0.72 }
  }))
  return {
    animation: false,
    tooltip: { trigger: "axis" },
    legend: { top: 0, data: [...grades, "平均NDVI"] },
    grid: { left: 48, right: 48, top: 58, bottom: 30 },
    xAxis: { type: "category", boundaryGap: false, data: rows.map((row) => row["月份"]) },
    yAxis: [
      { type: "value", min: 0, max: 100, name: "覆盖占比", axisLabel: { formatter: "{value}%" } },
      { type: "value", min: 0, max: 1, name: "NDVI" }
    ],
    series: [...coverageSeries, { name: "平均NDVI", type: "line", yAxisIndex: 1, data: rows.map((row) => Number(row.NDVI || 0)), smooth: true, symbolSize: 5, lineStyle: { width: 2, color: "#fadb14" } }]
  }
}

export function buildStatsChartOption(key: StatsChartKey, rows: StatsRow[]) {
  if (key === "population") {
    return buildPopulationOption(rows)
  }
  if (key === "housing") {
    return buildHousingOption(rows)
  }
  if (key === "economy") {
    return buildEconomyOption(rows)
  }
  if (key === "radiation") {
    return buildRadiationOption(rows)
  }
  return buildVegetationOption(rows)
}
