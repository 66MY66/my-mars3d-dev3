export type TimelineStatusOptions = {
  selected: boolean
  itemCount: number
  skippedFrame: boolean
}

export function getTimelineStatusText(options: TimelineStatusOptions): string {
  if (options.skippedFrame) {
    return "该帧不可用，已跳过"
  }
  if (!options.selected) {
    return "请选择数据集"
  }
  if (options.itemCount === 0) {
    return "该范围内无影像"
  }
  return ""
}

export function findNextAvailableFrameIndex(
  frameCount: number,
  failedIndex: number,
  isAvailable: (index: number) => boolean
): number | null {
  if (frameCount <= 1) {
    return null
  }
  for (let offset = 1; offset < frameCount; offset += 1) {
    const index = (failedIndex + offset) % frameCount
    if (isAvailable(index)) {
      return index
    }
  }
  return null
}
