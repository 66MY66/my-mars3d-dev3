import { describe, expect, it } from "vitest"
import {
  buildPopulationVisualCell,
  parsePopulationWm3d,
  POPULATION_COLUMNS_MAX_DISTANCE,
  populationColumnHeightSourceUnits,
  selectPopulationCells
} from "./population-wm3d"

function createFixture() {
  const width = 2
  const height = 1
  const buffer = new ArrayBuffer(34 + width * height * 2 + width * height * 3)
  const view = new DataView(buffer)
  ;["W", "M", "3", "D"].forEach((value, index) => view.setUint8(index, value.charCodeAt(0)))
  view.setUint16(4, 1, true)
  view.setUint16(6, width, true)
  view.setUint16(8, height, true)
  view.setFloat64(10, 100, true)
  view.setFloat64(18, 40, true)
  view.setFloat64(26, 0.2, true)
  view.setUint16(34, 32768, true)
  view.setUint16(36, 0, true)
  new Uint8Array(buffer, 38).set([10, 20, 30, 40, 50, 60])
  return buffer
}

describe("WM3D population data", () => {
  it("parses the header and preserves each cell's height code and RGB color", () => {
    const data = parsePopulationWm3d(createFixture())

    expect(data).toMatchObject({ version: 1, width: 2, height: 1, west: 100, north: 40, step: 0.2 })
    expect(data.cells).toEqual([
      { row: 0, column: 0, west: 100, east: 100.2, north: 40, south: 39.8, heightCode: 32768, color: [10, 20, 30] }
    ])
  })

  it("rejects files that are not WM3D population grids", () => {
    expect(() => parsePopulationWm3d(new ArrayBuffer(34))).toThrow("WM3D")
  })

  it("selects an original parent cell for any positive intersection with the drawn ring", () => {
    const data = parsePopulationWm3d(createFixture())
    const smallRingInsideCell = [[100.01, 39.99], [100.02, 39.99], [100.02, 39.98], [100.01, 39.98]] as Array<[number, number]>
    const outsideCell = [[100.21, 39.99], [100.22, 39.99], [100.22, 39.98], [100.21, 39.98]] as Array<[number, number]>

    expect(selectPopulationCells(data, smallRingInsideCell)).toHaveLength(1)
    expect(selectPopulationCells(data, outsideCell)).toHaveLength(0)
  })

  it("preserves the source demo's north-west anchored 80% footprint", () => {
    const cell = parsePopulationWm3d(createFixture()).cells[0]

    const visual = buildPopulationVisualCell(cell)
    expect(visual).toMatchObject({
      west: 100,
      east: 100.16,
      north: 40,
      color: [10, 20, 30]
    })
    expect(visual.south).toBeCloseTo(39.84, 8)
    expect(POPULATION_COLUMNS_MAX_DISTANCE).toBe(50000)
  })

  it("preserves the source demo's unmodified height formula", () => {
    expect(populationColumnHeightSourceUnits(1)).toBeCloseTo(0.35, 8)
    expect(populationColumnHeightSourceUnits(65535)).toBeCloseTo(14.35, 8)
    expect(populationColumnHeightSourceUnits(32768)).toBeCloseTo(7.35, 4)
  })
})
