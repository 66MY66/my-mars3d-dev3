import type { SelectedDensityCell } from "./grid-density-statistics"

export type PopulationProfilePoint = {
  longitude: number
  latitude: number
  density: number
  population: number
}

export type PopulationLatitudeProfile = {
  latitude: number | null
  points: Array<PopulationProfilePoint | null>
}

function cellCenterLatitude(cell: SelectedDensityCell) {
  return Number(((cell.south + cell.north) / 2).toFixed(6))
}

export function buildPopulationLatitudeProfile(cells: SelectedDensityCell[], requestedLatitude: number): PopulationLatitudeProfile {
  if (!cells.length) {
    return { latitude: null, points: [] }
  }

  const rows = new Map<number, SelectedDensityCell[]>()
  cells.forEach((cell) => {
    const row = rows.get(cell.row) || []
    row.push(cell)
    rows.set(cell.row, row)
  })

  let selectedRow: SelectedDensityCell[] | null = null
  let selectedLatitude: number | null = null
  let nearestDistance = Infinity
  rows.forEach((row) => {
    const latitude = cellCenterLatitude(row[0])
    const distance = Math.abs(latitude - requestedLatitude)
    if (distance < nearestDistance) {
      nearestDistance = distance
      selectedLatitude = latitude
      selectedRow = row
    }
  })

  const ordered = [...(selectedRow || [])].sort((a, b) => a.column - b.column)
  const points: Array<PopulationProfilePoint | null> = []
  ordered.forEach((cell, index) => {
    if (index > 0 && cell.column - ordered[index - 1].column > 1) {
      points.push(null)
    }
    points.push({
      longitude: Number(((cell.west + cell.east) / 2).toFixed(6)),
      latitude: selectedLatitude as number,
      density: Number(cell.value),
      population: Number(cell.total)
    })
  })

  return { latitude: selectedLatitude, points }
}
