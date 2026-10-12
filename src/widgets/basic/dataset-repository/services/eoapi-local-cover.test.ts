import { beforeEach, describe, expect, it, vi } from "vitest"

const setPersistedDatasetCover = vi.fn(() => Promise.resolve())

vi.mock("./cover-cache", () => ({
  setPersistedDatasetCover
}))

const { updateLocalDataset } = await import("./eoapi-datasets")

describe("local dataset cover persistence", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it("stores large data-url covers out of eoapi_manifests", () => {
    const dsId = "local_cover_1"
    localStorage.setItem(
      "eoapi_manifests",
      JSON.stringify({
        [dsId]: {
          name: "cover-dataset",
          manifest: { manifestVersion: "1.0", layers: [] },
          revisions: [],
          createdAt: 1
        }
      })
    )

    const coverUrl = `data:image/png;base64,${"a".repeat(5000)}`
    const ok = updateLocalDataset(dsId, { coverUrl, createNewVersion: false })

    expect(ok).toBe(true)
    const stored = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")[dsId]
    expect(stored.coverUrl).toBe("__idb_cover__")
    expect(setPersistedDatasetCover).toHaveBeenCalledWith(dsId, coverUrl)
  })
})
