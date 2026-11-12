import { layoutDbtLegend, type DbtLegendEntry } from "./dbt-legend-layout"
import type { CartographyTextLayout } from "./cartography-text"

type Measure = (value: string, width: number, height: number, size: number, bold?: boolean) => CartographyTextLayout

export function layoutDbtInformation<T extends DbtLegendEntry>(description: string, statistics: string[], entries: T[], measure: Measure) {
  // At the fixed A3 scale, 16 px is approximately 11 pt, not miniature text.
  for (const [size, statisticSize, legendSize] of [[22, 19, 20], [20, 18, 18], [18, 17, 17], [16, 16, 16]]) {
    const descriptionText = measure(description, 388, Infinity, size)
    let y = 239 + descriptionText.height + 16
    const rows = statistics.map(value => {
      const layout = measure(value, 388, Infinity, statisticSize)
      const row = { value, y, layout }; y += layout.height + 3
      return row
    })
    const legendY = Math.max(380, y + 24)
    const legend = layoutDbtLegend(entries, legendY + 45, (value, width, fontSize, bold) => measure(value, width, Infinity, fontSize, bold).height, 1028, legendSize)
    if (legendY + 45 <= 1028 && !legend.omitted && legendY + 45 + legend.height <= 1028) {
      return { description: { y: 239, layout: descriptionText }, rows, legendY, legend }
    }
  }
  throw new Error("内容说明、统计或图例超出当前图幅容量，请精简说明、减少图层或分幅；未生成文字不完整的校样")
}
