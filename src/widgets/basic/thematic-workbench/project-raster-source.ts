export interface ProjectRaster {
  id: "pop2020" | "gdp2020"; name: string; archive: string; archiveSha256: string; sourceWkt: string
  sourceWidth: number; sourceHeight: number; resolution: number[]; sourceWindow: number[]; width: number; height: number
  minimum: number; maximum: number; missingCells: number; zeroCells: number; notice: string; tiffUrl: string
  datumStatus: "unknown"; unitStatus: "unconfirmed"; values: Array<number | null>
}
const colors = ["#e5f5d9", "#a1d76a", "#4eb53d", "#158061", "#277b9c", "#235279"]
export function readProjectRaster(raw: unknown): ProjectRaster {
  const source = raw as ProjectRaster
  if (!source || !["pop2020", "gdp2020"].includes(source.id) || source.datumStatus !== "unknown" || source.unitStatus !== "unconfirmed" || !Number.isInteger(source.width) || !Number.isInteger(source.height) || source.width < 1 || source.height < 1 || source.width * source.height > 1_000_000 || source.values?.length !== source.width * source.height || source.values.some(value => value !== null && (!Number.isFinite(value) || value < 0))) { throw new Error("原始栅格核验数据无效") }
  return source
}
export function sourceRasterLegend(source: ProjectRaster) {
  const positive = source.values.filter((value): value is number => value !== null && value > 0).sort((a, b) => a - b)
  const breaks = [...new Set(colors.map((_, i) => positive[Math.max(0, Math.ceil((i + 1) / colors.length * positive.length) - 1)]).filter(Number.isFinite))]
  return [
    { label: "0", color: "#ffffff", maximum: 0 },
    ...breaks.map((end, i) => ({ label: `${i ? `>${breaks[i - 1]}` : ">0"}—${end}（原始值）`, color: colors[i], maximum: end })),
    { label: "NoData", color: "#d9dee5", maximum: null }
  ]
}
export function rasterSourceColors(source: ProjectRaster): string[] {
  const legend = sourceRasterLegend(source)
  return source.values.map(value => value === null ? "#d9dee5" : legend.find(entry => entry.maximum !== null && value <= entry.maximum)!.color)
}
