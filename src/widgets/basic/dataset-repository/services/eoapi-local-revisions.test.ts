import { describe, expect, it } from "vitest"
import { getRevisionManifest, updateLocalDataset } from "./eoapi-datasets"

describe("local dataset revisions", () => {
  it("returns revision-specific manifest when revisionManifests exists", async () => {
    const dsId = "local_1"
    const manifest1: any = { manifestVersion: "1.0", layers: [{ id: "a", sourceType: "xyz", sourceRef: "u1" }] }
    const manifest2: any = { manifestVersion: "1.0", layers: [{ id: "b", sourceType: "xyz", sourceRef: "u2" }] }

    localStorage.setItem(
      "eoapi_manifests",
      JSON.stringify({
        [dsId]: {
          name: "D",
          manifest: manifest2,
          revisionManifests: {
            rev_1: manifest1,
            rev_2: manifest2
          },
          revisions: [
            { revisionId: "rev_2", createdAt: 2, message: "m2" },
            { revisionId: "rev_1", createdAt: 1, message: "m1" }
          ],
          createdAt: 1
        }
      })
    )

    const r1 = await getRevisionManifest(dsId, "rev_1")
    expect(r1.success).toBe(true)
    expect((r1.data as any)?.layers?.[0]?.id).toBe("a")

    const r2 = await getRevisionManifest(dsId, "rev_2")
    expect(r2.success).toBe(true)
    expect((r2.data as any)?.layers?.[0]?.id).toBe("b")
  })

  it("stores manifest snapshot when creating a new local version", async () => {
    const dsId = "local_2"
    const baseManifest: any = { manifestVersion: "1.0", layers: [{ id: "a", sourceType: "xyz", sourceRef: "u1" }] }
    localStorage.setItem(
      "eoapi_manifests",
      JSON.stringify({
        [dsId]: {
          name: "D2",
          manifest: baseManifest,
          revisions: [],
          createdAt: 1
        }
      })
    )

    const nextManifest: any = { manifestVersion: "1.0", layers: [{ id: "c", sourceType: "xyz", sourceRef: "u3" }] }
    const ok = updateLocalDataset(dsId, { manifest: nextManifest, createNewVersion: true, message: "m3" })
    expect(ok).toBe(true)

    const stored = JSON.parse(localStorage.getItem("eoapi_manifests") || "{}")[dsId]
    const revId = String(stored?.revisions?.[0]?.revisionId || "")
    expect(revId.startsWith("rev_")).toBe(true)
    expect(stored?.revisionManifests?.[revId]?.layers?.[0]?.id).toBe("c")

    const res = await getRevisionManifest(dsId, revId)
    expect(res.success).toBe(true)
    expect((res.data as any)?.layers?.[0]?.id).toBe("c")
  })
})

