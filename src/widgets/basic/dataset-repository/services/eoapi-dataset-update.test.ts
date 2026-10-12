import { beforeEach, describe, expect, it, vi } from "vitest"

const eoapiGet = vi.fn()
const eoapiPost = vi.fn()
const eoapiDelete = vi.fn()
const setPersistedDatasetCover = vi.fn(() => Promise.resolve())
const emitDatasetSync = vi.fn()

vi.mock("./eoapi-client", () => ({
  eoapiGet,
  eoapiPost,
  eoapiDelete
}))

vi.mock("./cover-cache", () => ({
  setPersistedDatasetCover
}))

vi.mock("./dataset-sync", () => ({
  emitDatasetSync
}))

const { __resetDatasetDraftStateForTest, getCollection, getRemoteDatasetDraft, updateDatasetContent } = await import("./eoapi-datasets")

describe("updateDatasetContent", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    __resetDatasetDraftStateForTest()
  })

  it("updates local datasets in-place and keeps local revision behavior", async () => {
    const dsId = "local_update_1"
    localStorage.setItem(
      "eoapi_manifests",
      JSON.stringify({
        [dsId]: {
          name: "D1",
          manifest: { manifestVersion: "1.0", layers: [{ id: "a", sourceType: "xyz", sourceRef: "u1" }] },
          revisions: [],
          createdAt: 1
        }
      })
    )

    const nextManifest: any = { manifestVersion: "1.0", layers: [{ id: "b", sourceType: "xyz", sourceRef: "u2" }] }
    const res = await updateDatasetContent(dsId, {
      manifest: nextManifest,
      description: "updated desc",
      tags: ["tag-a", ""],
      createNewVersion: true,
      message: "local update"
    })

    expect(res.success).toBe(true)
    expect(res.data?.mode).toBe("local")
    expect(res.data?.createdNewVersion).toBe(true)

    const stored = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")[dsId]
    expect(stored.description).toBe("updated desc")
    expect(stored.tags).toEqual(["tag-a"])
    expect(stored.manifest.layers[0].id).toBe("b")
    expect(stored.revisions).toHaveLength(1)
    expect(eoapiPost).not.toHaveBeenCalled()
    expect(emitDatasetSync).toHaveBeenCalledWith({
      datasetId: dsId,
      reason: "refresh",
      source: "updateDatasetContent:local",
      payload: {
        metadataChanged: true,
        coverChanged: false
      }
    })
  })

  it("routes remote dataset updates through revision api and persists local overlays", async () => {
    eoapiGet.mockResolvedValueOnce({ success: true, data: [] })
    eoapiPost.mockResolvedValueOnce({
      success: true,
      data: {
        datasetId: "ds_remote_1",
        revisionId: "rev_remote_1",
        createdAt: 1700000000000
      }
    })

    const manifest: any = { manifestVersion: "1.0", layers: [{ id: "c", sourceType: "xyz", sourceRef: "u3" }] }
    const coverUrl = "data:image/png;base64,abc"
    const res = await updateDatasetContent("ds_remote_1", {
      manifest,
      description: "remote desc",
      tags: ["tag-1", "", "tag-2"],
      coverUrl,
      createNewVersion: false,
      message: "remote update"
    })

    expect(res.success).toBe(true)
    expect(res.data).toMatchObject({
      mode: "remote",
      createdNewVersion: true,
      metadataScope: "local",
      coverScope: "local",
      revisionId: "rev_remote_1"
    })
    expect(eoapiGet).toHaveBeenCalledWith("/datasets")
    expect(eoapiPost).toHaveBeenCalledWith("/datasets/ds_remote_1/revisions", {
      message: "remote update",
      manifest,
      artifactRefs: undefined
    })
    expect(setPersistedDatasetCover).toHaveBeenCalledWith("ds_remote_1", coverUrl)
    expect(getRemoteDatasetDraft("ds_remote_1")).toMatchObject({
      description: "remote desc",
      tags: ["tag-1", "tag-2"]
    })
    expect(emitDatasetSync).toHaveBeenCalledWith({
      datasetId: "ds_remote_1",
      reason: "revision",
      source: "createRevision"
    })
    expect(emitDatasetSync).toHaveBeenCalledWith({
      datasetId: "ds_remote_1",
      reason: "refresh",
      source: "updateDatasetContent:remote",
      payload: {
        metadataScope: "local",
        coverScope: "local"
      }
    })
  })

  it("overlays remote dataset draft metadata on collection detail reads", async () => {
    eoapiGet.mockImplementation(async (url: string) => {
      if (url === "/collections/ds_remote_2") {
        return {
          success: true,
          data: {
            id: "ds_remote_2",
            type: "Collection",
            description: "server desc",
            keywords: ["server-tag"],
            summaries: {
              updatedAt: 100
            }
          }
        }
      }
      if (url === "/datasets") {
        return { success: true, data: [] }
      }
      return { success: false, message: "unexpected url" }
    })
    eoapiPost.mockResolvedValueOnce({
      success: true,
      data: {
        datasetId: "ds_remote_2",
        revisionId: "rev_remote_2",
        createdAt: 1700000001000
      }
    })

    await updateDatasetContent("ds_remote_2", {
      manifest: { manifestVersion: "1.0", layers: [] } as any,
      description: "draft desc",
      tags: ["draft-tag"],
      createNewVersion: false,
      message: "draft update"
    })

    const detail = await getCollection("ds_remote_2")
    expect(detail.success).toBe(true)
    expect(detail.data).toMatchObject({
      description: "draft desc",
      keywords: ["draft-tag"]
    })
    expect(Number((detail.data as any)?.summaries?.updatedAt)).toBeGreaterThan(100)
  })
})
