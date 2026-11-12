import type { PopulationBounds } from "./population-grid"

export type SourceReferenceGrid = {
  width: number; height: number; bounds: PopulationBounds; crs: "EPSG:4024"
  values: Array<number | null>; sourceWindow: number[]; unit: string
}
export function validateSourceReferenceGrid(grid: SourceReferenceGrid) {
  const b = grid?.bounds
  if (!grid || !Number.isInteger(grid.width) || !Number.isInteger(grid.height) || grid.width < 1 || grid.height < 1 || grid.width * grid.height > 1_000_000 || grid.values?.length !== grid.width * grid.height || grid.crs !== "EPSG:4024" || !grid.unit || !b || ![b.west, b.south, b.east, b.north].every(Number.isFinite) || b.west >= b.east || b.south >= b.north || b.west < -180 || b.east > 180 || b.south < -90 || b.north > 90) { throw new Error("原值参考栅格的坐标、尺寸或单位声明无效") }
  if (grid.values.some(value => value !== null && (!Number.isFinite(value) || value < 0))) { throw new Error("原值参考栅格包含未声明的无效值") }
  const w = grid.sourceWindow
  if (!Array.isArray(w) || w.length !== 4 || !w.every(Number.isInteger) || w[0] < 0 || w[1] < 0 || w[2] - w[0] !== grid.width || w[3] - w[1] !== grid.height) { throw new Error("原值参考栅格裁切窗口无效") }
}
export function referenceGridStyle(grid: SourceReferenceGrid) {
  const positive = grid.values.filter((v): v is number => v !== null && v > 0).sort((a, b) => a - b)
  const palette = ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"]
  const breaks = [...new Set(palette.map((_, i) => positive[Math.max(0, Math.ceil((i + 1) / palette.length * positive.length) - 1)]).filter(Number.isFinite))]
  const rows = breaks.map((max, i) => ({ max, color: palette[i], label: `${i ? `>${breaks[i - 1]}` : ">0"}–${max}` }))
  return {
    legend: [...rows].reverse().map(row => ({ color: row.color, label: `${row.label} 原始值` })).concat([{ color: "#ffffff", label: "0 原始值" }, { color: "#d9dee5", label: "NoData（缺测）" }]),
    color: (value: number | null) => { if (value === null) { return "#d9dee5" }; if (value === 0) { return "#ffffff" }; return rows.find(row => value <= row.max)!.color }
  }
}
export function referenceGridSummary(grid: SourceReferenceGrid) {
  let minimum = Infinity; let maximum = -Infinity; let sum = 0; let valid = 0; let missing = 0
  for (const value of grid.values) {
    if (value === null) { missing++; continue }
    minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); sum += value; valid++
  }
  return { minimum: valid ? minimum : null, maximum: valid ? maximum : null, mean: valid ? sum / valid : null, valid, missing }
}
