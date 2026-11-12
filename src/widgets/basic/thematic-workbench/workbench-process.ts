export type AuxiliaryMode = "raster" | "temporal" | "signal" | "statistics" | "spatial" | "background" | "numeric" | "earthquake"

// Screenshot kernels remain reusable, but are not a cartography workflow or user setting.
export const SCREENSHOT_TOOLS_IN_WORKBENCH = false

export function auxiliaryResultBasis(mode: AuxiliaryMode, operation = "") {
  if (mode === "earthquake") { return { title: "观测点辅助计算", source: "观测数据", constraint: "使用有来源和单位的观测点；计算结果不等于审核后的烈度或灾损成果。" } }
  if (mode === "numeric" && operation === "projection") { return { title: "范围坐标换算", source: "范围坐标", constraint: "仅换算选区坐标，不对原始栅格进行重投影。" } }
  return { title: "截图像素处理", source: "地图截图 · RGB 像素", constraint: "像素距离不是地面距离，亮度不是业务指标；不用于人口、经济、烈度或损失统计。" }
}

// Invalidate pending work even when the user reopens the same tool and scope.
export function createAuxiliaryRunGate() {
  let revision = 0
  let active = false
  return {
    update(enabled: boolean) { active = enabled; revision++ },
    capture() { return revision },
    accepts(ticket: number) { return active && ticket === revision }
  }
}
