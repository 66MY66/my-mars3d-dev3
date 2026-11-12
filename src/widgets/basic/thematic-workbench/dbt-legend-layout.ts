export type DbtLegendEntry = { kind?: string; color?: string; label: string; radius?: number; noData?: boolean; order: number; group?: string; shape?: string; styleKey?: string }
export function layoutDbtLegend<T extends DbtLegendEntry>(entries: T[], top: number, measure: (label: string, width: number, size: number, bold?: boolean) => number, bottom = 1028, fontSize = 20) {
  const rows: Array<{ entry: T; x: number; y: number; width: number; height: number }> = []
  const headings: Array<{ label: string; y: number; height: number; x?: number; width?: number }> = []
  const sorted = [...entries].sort((a, b) => a.order - b.order)
  const headingSize = Math.min(17, fontSize)
  let y = top; let omitted = 0
  for (let start = 0; start < sorted.length;) {
    const group = sorted[start].group
    let end = start + 1
    while (end < sorted.length && sorted[end].group === group) { end++ }
    const block = sorted.slice(start, end)
    if (start) { y += 8 }
    if (group) { const height = Math.max(28, measure(group, 388, headingSize, true)); headings.push({ label: group, y, height }); y += height }
    const heights = (width: number) => block.map(entry => Math.max(entry.radius === undefined ? fontSize + 8 : 2 * entry.radius + 4, measure(entry.label, width, fontSize)))
    const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0) + Math.max(0, values.length - 1) * 3
    let rowHeights = heights(318); let split = block.length; let width = 318
    // Balance actual wrapped heights, preserving reading order and true-size symbols.
    if (block.length > 1 && block.every(entry => entry.radius === undefined || entry.radius <= 30)) {
      const narrow = heights(125)
      let best = total(rowHeights)
      for (let cut = 1; cut < block.length; cut++) {
        const height = Math.max(total(narrow.slice(0, cut)), total(narrow.slice(cut)))
        if (height < best) { best = height; rowHeights = narrow; split = cut; width = 125 }
      }
    }
    const bottoms = [y, y]
    block.forEach((entry, i) => {
      const column = i < split ? 0 : 1
      const height = rowHeights[i]
      const at = bottoms[column]
      if (at + height > bottom) { omitted++ } else { rows.push({ entry, x: 1230 + column * 195, y: at, width, height }) }
      bottoms[column] += height + 3
    })
    y = Math.max(...bottoms) - 3; start = end
  }
  let best = { rows, headings: headings.filter(heading => heading.y + heading.height <= bottom), omitted, height: y - top, fontSize, headingSize }
  // Flow across the whole legend when separate per-group columns waste vertical space.
  if (sorted.length > 1 && sorted.every(entry => entry.radius === undefined || entry.radius <= 30)) {
    const heights = sorted.map(entry => Math.max(entry.radius === undefined ? fontSize + 8 : 2 * entry.radius + 4, measure(entry.label, 123, fontSize)))
    const groupHeights = new Map([...new Set(sorted.map(entry => entry.group).filter(Boolean))].map(group => [group, Math.max(28, measure(group!, 193, headingSize, true))]))
    for (let cut = 1; cut < sorted.length; cut++) {
      const flowRows: typeof rows = []; const flowHeadings: typeof headings = []; let flowOmitted = 0
      const ends = [0, 1].map(column => {
        const start = column ? cut : 0; const end = column ? sorted.length : cut
        let at = top; let previous: string | undefined
        for (let i = start; i < end; i++) {
          const entry = sorted[i]; const x = 1230 + column * 195
          if (i > start && entry.group !== previous) { at += 8 }
          if (entry.group && (i === start || entry.group !== previous)) {
            const height = groupHeights.get(entry.group)!
            if (at + height <= bottom) { flowHeadings.push({ label: entry.group, x, y: at, height, width: 193 }) }
            at += height
          }
          const height = heights[i]
          if (at + height <= bottom) { flowRows.push({ entry, x, y: at, width: 123, height }) } else { flowOmitted++ }
          at += height + 3; previous = entry.group
        }
        return at - 3
      })
      const height = Math.max(...ends) - top
      if (height < best.height) { best = { rows: flowRows, headings: flowHeadings, omitted: flowOmitted, height, fontSize, headingSize } }
    }
  }
  return best
}
