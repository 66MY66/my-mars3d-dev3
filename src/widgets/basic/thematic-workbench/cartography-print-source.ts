import { fitDbtBounds } from "./dbt-cartography-rules"
import { intersectBounds } from "./cartography-workflow"
import type { RectInfo } from "./map"

export type PrintTile = { x: number; y: number; width: number; height: number; bounds: RectInfo }
export function printRasterPlan(scope: RectInfo, coverage: RectInfo, dpi = 300) {
  if (![150, 300, 450, 600].includes(dpi)) { throw new Error("请选择支持的源图 DPI") }
  const bounds = intersectBounds(scope, coverage)
  if (!bounds) { throw new Error("数据不覆盖查询范围") }
  const sheet = fitDbtBounds(scope)
  // The existing A3 renderer uses 1076 x 802 design pixels, four pixels per mm.
  const width = Math.max(1, Math.ceil(269 * (bounds.east - bounds.west) / (sheet.east - sheet.west) / 25.4 * dpi))
  const height = Math.max(1, Math.ceil(200.5 * (bounds.north - bounds.south) / (sheet.north - sheet.south) / 25.4 * dpi))
  if (width * height > 40_000_000) { throw new Error("源图超过交互输出上限，请拆分图幅") }
  const tiles: PrintTile[] = []
  for (let y = 0; y < height; y += 1280) {
    for (let x = 0; x < width; x += 1280) {
      const w = Math.min(1280, width - x); const h = Math.min(1280, height - y)
      const longitude = (px: number) => bounds.west + (bounds.east - bounds.west) * px / width
      const latitude = (py: number) => bounds.north - (bounds.north - bounds.south) * py / height
      tiles.push({ x, y, width: w, height: h, bounds: { west: longitude(x), east: longitude(x + w), south: latitude(y + h), north: latitude(y) } })
    }
  }
  return { width, height, bounds, dpi, tiles }
}
