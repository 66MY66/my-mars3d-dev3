const knownMojibake: Record<string, string> = {
  "鏈湴": "本地",
  "鏈湴淇濆瓨鐨勬暟鎹泦": "本地保存的数据集",
  鍏变韩: "共享",
  "鍏紑": "公开",
  绉佹湁: "私有",
  鏆傛棤鎻忚堪: "暂无描述",
  鏆傛棤鏁版嵁闆: "暂无数据集",
  "鏈煡": "未知",
  浠ュ強: "以及",
  鏁版嵁闆: "数据集",
  鎴戠殑鏀惰棌: "我的收藏",
  "鏈€杩戜娇鐢": "最近使用",
  鍔犺浇涓: "加载中",
  鎼滅储: "搜索",
  鎸夌儹搴: "按热度",
  鎸夋洿鏂版椂闂: "按更新时间",
  鎸夊垱寤烘椂闂: "按创建时间"
}

const mojibakeMarkers = [
  "鏈",
  "鍊",
  "鏁",
  "鐨",
  "淇",
  "濆",
  "鎹",
  "绱",
  "浠",
  "娴",
  "閫",
  "瀹",
  "璇",
  "鍏",
  "绉",
  "鏆",
  "鐢",
  "莠"
]

export function isLikelyMojibake(value: unknown): boolean {
  const text = String(value ?? "")
  if (!text) {
    return false
  }
  if (text.includes("\uFFFD")) {
    return true
  }
  const markerCount = mojibakeMarkers.reduce((count, marker) => count + (text.includes(marker) ? 1 : 0), 0)
  return markerCount >= 1
}

function repairKnownMojibake(text: string): string {
  let repaired = text
  for (const [bad, good] of Object.entries(knownMojibake)) {
    repaired = repaired.replaceAll(bad, good)
  }
  return repaired
}

export function normalizeDatasetText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim()
  if (!text) {
    return String(fallback ?? "").trim()
  }
  if (!isLikelyMojibake(text)) {
    return text
  }

  const repaired = repairKnownMojibake(text).trim()
  if (repaired && !isLikelyMojibake(repaired)) {
    return repaired
  }

  const cleanFallback = String(fallback ?? "").trim()
  return cleanFallback && !isLikelyMojibake(cleanFallback) ? cleanFallback : ""
}
