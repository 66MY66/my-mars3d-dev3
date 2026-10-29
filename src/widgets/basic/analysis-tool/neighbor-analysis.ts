export type NeighborMode = "hazard" | "area" | "focal"

export type NeighborParamDef = {
  key: string
  label: string
  type: string
  value: any
  modes?: NeighborMode[]
  options?: Array<{ label: string; value: any }>
  constraints?: Record<string, any>
  [key: string]: any
}

export type NeighborRasterSource = {
  id: string
  label: string
  sourceType: string
  sourceRef: string
  bands: Array<{ label: string; value: string }>
}

const ANALYZABLE_RASTER_TYPES = new Set(["cog", "geotiff", "tif", "tiff", "raster"])

export function getNeighborParamDefs(defs: NeighborParamDef[], mode: NeighborMode): NeighborParamDef[] {
  return defs.filter((item) => !item.modes?.length || item.modes.includes(mode))
}

function normalizeBands(rawBands: any): Array<{ label: string; value: string }> {
  if (!Array.isArray(rawBands) || rawBands.length === 0) {
    return [{ value: "1", label: "Band 1" }]
  }

  return rawBands.map((band, index) => {
    const value = String(band?.value ?? band?.id ?? band?.index ?? index + 1)
    const name = String(band?.label ?? band?.name ?? `Band ${value}`)
    const unit = band?.unit ? `（${band.unit}）` : ""
    return { value, label: `${name}${unit}` }
  })
}

export function collectNeighborRasterSources(layers: any[]): NeighborRasterSource[] {
  return (layers || []).flatMap((layer) => {
    const options = layer?.options || {}
    const sourceType = String(options.sourceType ?? layer?.type ?? options.type ?? "").toLowerCase()
    const sourceRef = String(options.url ?? options.sourceRef ?? layer?.url ?? "")
    if (layer?.show === false || !ANALYZABLE_RASTER_TYPES.has(sourceType) || !sourceRef) {
      return []
    }

    return [{
      id: String(layer?.id ?? sourceRef),
      label: String(layer?.name ?? options.name ?? layer?.id ?? sourceRef),
      sourceType,
      sourceRef,
      bands: normalizeBands(options.bands ?? layer?.bands)
    }]
  })
}

export function formatNeighborRasterSummary(summary: Record<string, any>) {
  const unit = summary.unit ? ` ${summary.unit}` : ""
  const metric = (key: string, label: string) => {
    const value = summary[key]
    return {
      key,
      label,
      value: value == null || !Number.isFinite(Number(value)) ? "—" : `${Number(value).toFixed(3)}${unit}`
    }
  }

  return [
    { key: "count", label: "有效像元", value: String(summary.count ?? 0) },
    metric("mean", "均值"),
    metric("maximum", "最大值"),
    metric("minimum", "最小值"),
    metric("stddev", "标准差")
  ]
}
