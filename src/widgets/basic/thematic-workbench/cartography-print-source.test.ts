import { describe, expect, it } from "vitest"
import { printRasterPlan } from "./cartography-print-source"
const scope = { west: 100, east: 104, south: 25, north: 28 }
describe("physical raster output planning", () => {
  it("requests actual 300/600 DPI source pixels instead of resizing a 1280px preview", () => {
    const a = printRasterPlan(scope, scope, 300); const b = printRasterPlan(scope, scope, 600)
    expect(a.width).toBeGreaterThan(3000); expect(a.height).toBeGreaterThan(2300)
    expect(Math.abs(b.width - a.width * 2)).toBeLessThanOrEqual(1)
    expect(a.tiles.every(tile => tile.width <= 1280 && tile.height <= 1280)).toBe(true)
    expect(a.tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0)).toBe(a.width * a.height)
  })
  it("has exact adjacent geographic edges and pixel placement without stretching missing coverage", () => {
    const plan = printRasterPlan(scope, { west: 101, east: 104, south: 25, north: 28 }, 300)
    expect(plan.bounds.west).toBe(101)
    const row = plan.tiles.filter(tile => tile.y === 0)
    row.slice(1).forEach((tile, i) => { expect(tile.x).toBe(row[i].x + row[i].width); expect(tile.bounds.west).toBe(row[i].bounds.east) })
    const column = plan.tiles.filter(tile => tile.x === 0)
    column.slice(1).forEach((tile, i) => { expect(tile.y).toBe(column[i].y + column[i].height); expect(tile.bounds.north).toBe(column[i].bounds.south) })
    expect(plan.tiles.at(-1)!.bounds.south).toBe(scope.south)
    expect(() => printRasterPlan(scope, scope, 72)).toThrow("DPI")
    expect(() => printRasterPlan(scope, { west: 0, east: 1, south: 0, north: 1 })).toThrow("不覆盖")
  })
})
