export const SPLIT_COMPARE_LOADING_TEXT = "正在加载影像…"
export const SPLIT_COMPARE_FAILURE_TEXT = "加载失败，请重试"
export const SPLIT_COMPARE_SAME_IMAGE_TEXT = "左右影像相同，可能无对比差异"

export function getLayerStatusText(options: { loading: boolean; leftLoaded: boolean; rightLoaded: boolean }): string {
  if (options.loading) {
    return SPLIT_COMPARE_LOADING_TEXT
  }
  if (!options.leftLoaded && !options.rightLoaded) {
    return "未加载图层"
  }
  const left = options.leftLoaded ? "左侧已加载" : ""
  const right = options.rightLoaded ? "右侧已加载" : ""
  return `${left}${left && right ? " | " : ""}${right}`
}

export function isSameImageSelection(
  leftCollection: string | undefined,
  leftItem: string | undefined,
  rightCollection: string | undefined,
  rightItem: string | undefined
): boolean {
  return !!leftCollection && !!leftItem && leftCollection === rightCollection && leftItem === rightItem
}
