import type { SelectedDensityCell } from "./grid-density-statistics"
import { pointInRing } from "./region-hit"

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

function longitudeIntervalsAtLatitude(ring: Array<[number, number]>, latitude: number) {
  const intersections: number[] = []
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    if (y1 === y2) {
      if (latitude === y1) { intersections.push(x1, x2) }
      continue
    }
    const minLat = Math.min(y1, y2)
    const maxLat = Math.max(y1, y2)
    if (latitude < minLat || latitude > maxLat) { continue }
    intersections.push(x1 + ((latitude - y1) * (x2 - x1)) / (y2 - y1))
  }
  intersections.sort((a, b) => a - b)
  const intervals: Array<[number, number]> = []
  for (let i = 0; i + 1 < intersections.length; i += 2) {
    if (intersections[i + 1] > intersections[i]) { intervals.push([intersections[i], intersections[i + 1]]) }
  }
  return intervals
}

export function buildPopulationLatitudeProfile(cells: SelectedDensityCell[], requestedLatitude: number, ring?: Array<[number, number]>): PopulationLatitudeProfile {
  if (!cells.length) {
    return { latitude: null, points: [] }
  }

  const rows = new Map<number, SelectedDensityCell[]>()
  cells.filter((cell) => {
    if (!ring) { return true }
    return pointInRing({ lng: (cell.west + cell.east) / 2, lat: (cell.south + cell.north) / 2 }, ring)
  }).forEach((cell) => {
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
  const intervals = ring && selectedLatitude !== null ? longitudeIntervalsAtLatitude(ring, selectedLatitude) : []
  const profileCells = intervals.length
    ? ordered.filter((cell) => intervals.some(([min, max]) => (cell.west + cell.east) / 2 >= min && (cell.west + cell.east) / 2 <= max))
    : ordered
  const points: Array<PopulationProfilePoint | null> = []
  profileCells.forEach((cell, index) => {
    if (index > 0 && cell.column - profileCells[index - 1].column > 1) {
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
