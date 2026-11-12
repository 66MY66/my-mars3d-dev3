import type { DbtLayer } from "./dbt116-standard"
export function sortedCartographyLayers(layers: DbtLayer[], topic: string) {
  const ranks: Record<string, number> = topic === "T30102000"
    ? { dem: -5, imagery: -4, population: -3, economy: -3, building: -2, water: 0, boundary: 1, transport: 2, settlement: 3, intensity: 6 }
    : { dem: -5, imagery: -4, water: -3, boundary: -2, transport: -1, settlement: 1, fault: 5, intensity: 6 }
  return [...layers].sort((a, b) => (a.order ?? (ranks[a.role] || 0)) - (b.order ?? (ranks[b.role] || 0)))
}
