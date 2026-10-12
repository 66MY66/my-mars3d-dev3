import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  __resetManagementApiStateForTest,
  getDatasetMetric,
  getFavoriteDatasetIds,
  getRecentDatasetIds,
  recordDatasetBrowse,
  setDatasetFavorite,
  syncMetricsFromServer
} from "./dataset-metrics"
import { eoapiGet, eoapiPost } from "./eoapi-client"

vi.mock("./eoapi-client", () => ({
  eoapiPost: vi.fn(() => Promise.resolve({ success: true })),
  eoapiGet: vi.fn(() => Promise.resolve({ success: true, data: [] })),
  eoapiDelete: vi.fn(() => Promise.resolve({ success: true }))
}))

const storageKey = "ksh002_dataset_metrics_v1"

describe("dataset-metrics", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    vi.clearAllMocks()
    __resetManagementApiStateForTest()
  })

  it("normalizes stored numeric fields when values are strings", () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        ds1: { datasetId: "ds1", favorite: "true", browseCount: "2", importCount: "10", favoriteCount: "3", lastUsedAt: "123" }
      })
    )

    const m = getDatasetMetric("ds1")
    expect(m.datasetId).toBe("ds1")
    expect(m.favorite).toBe(true)
    expect(m.browseCount).toBe(2)
    expect(m.importCount).toBe(10)
    expect(m.favoriteCount).toBe(3)
    expect(m.lastUsedAt).toBe(123)
  })

  it("increments browseCount correctly even if stored value is a string (regression)", () => {
    localStorage.setItem(storageKey, JSON.stringify({ ds1: { datasetId: "ds1", browseCount: "2", importCount: 0, favorite: false, favoriteCount: 0 } }))
    recordDatasetBrowse("ds1")
    const m = getDatasetMetric("ds1")
    expect(m.browseCount).toBe(3)
    expect(typeof m.browseCount).toBe("number")
  })

  it("treats string lastUsedAt as recent and sorts recents by lastUsedAt desc (regression)", () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        a: { datasetId: "a", lastUsedAt: "100", favorite: false, browseCount: 0, importCount: 0, favoriteCount: 0 },
        b: { datasetId: "b", lastUsedAt: "200", favorite: false, browseCount: 0, importCount: 0, favoriteCount: 0 }
      })
    )

    expect(getRecentDatasetIds(5)).toEqual(["b", "a"])
  })

  it("treats string favorite as favorite and keeps favorite ordering by lastUsedAt desc", () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        a: { datasetId: "a", favorite: "true", lastUsedAt: "100", browseCount: 0, importCount: 0, favoriteCount: 0 },
        b: { datasetId: "b", favorite: "true", lastUsedAt: "200", browseCount: 0, importCount: 0, favoriteCount: 0 }
      })
    )

    expect(getFavoriteDatasetIds()).toEqual(["b", "a"])
  })

  it("backs off management api calls after a 500 and deduplicates concurrent syncs", async () => {
    vi.mocked(eoapiGet).mockResolvedValueOnce({ success: false, code: 500, message: "boom" } as any)

    await Promise.all([syncMetricsFromServer(), syncMetricsFromServer()])
    expect(vi.mocked(eoapiGet)).toHaveBeenCalledTimes(1)

    await syncMetricsFromServer()
    expect(vi.mocked(eoapiGet)).toHaveBeenCalledTimes(1)

    setDatasetFavorite("ds1", true)
    await Promise.resolve()
    expect(vi.mocked(eoapiPost)).toHaveBeenCalledTimes(0)

    vi.advanceTimersByTime(60_001)
    vi.mocked(eoapiGet).mockResolvedValueOnce({ success: true, data: [] } as any)
    await syncMetricsFromServer()
    expect(vi.mocked(eoapiGet)).toHaveBeenCalledTimes(3)
  })

  it("merges favorites and metrics from server when management api is healthy", async () => {
    localStorage.setItem(storageKey, JSON.stringify({
      ds1: { datasetId: "ds1", favorite: false, browseCount: 1, importCount: 2, favoriteCount: 0 }
    }))
    vi.mocked(eoapiGet)
      .mockResolvedValueOnce({
        success: true,
        data: [{ datasetId: "ds1", createdAt: 123, name: "Demo" }]
      } as any)
      .mockResolvedValueOnce({
        success: true,
        data: [{ datasetId: "ds1", browseCount: 9, importCount: 8, downloadCount: 0, favoriteCount: 7, isFavorite: true }]
      } as any)

    await syncMetricsFromServer()

    const metric = getDatasetMetric("ds1")
    expect(metric.favorite).toBe(true)
    expect(metric.browseCount).toBe(9)
    expect(metric.importCount).toBe(8)
    expect(metric.favoriteCount).toBe(7)
    expect(metric.lastUsedAt).toBe(123)
  })
})
