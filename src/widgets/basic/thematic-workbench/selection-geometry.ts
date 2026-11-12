import type { RectInfo } from "./map"

export function selectionBoundary(bounds: RectInfo, segments = 32): Array<[number, number]> {
  const corners = [[bounds.west, bounds.north], [bounds.east, bounds.north], [bounds.east, bounds.south], [bounds.west, bounds.south]]
  return corners.flatMap((start, edge) => {
    const end = corners[(edge + 1) % corners.length]
    return Array.from({ length: segments }, (_, i): [number, number] => [start[0] + (end[0] - start[0]) * i / segments, start[1] + (end[1] - start[1]) * i / segments])
  })
}
