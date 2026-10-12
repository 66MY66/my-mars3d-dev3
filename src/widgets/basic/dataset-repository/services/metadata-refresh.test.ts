import { describe, expect, it } from "vitest"
import { hasInvalidatedMetadata, refreshMetadata, registerMetadataRefresher } from "./metadata-refresh"

describe("metadata-refresh", () => {
  it("registers and refreshes dataset handlers", async () => {
    const calls: string[] = []
    const dispose = registerMetadataRefresher("ds-demo", {
      loadCollectionDetail: () => calls.push("detail"),
      loadArtifacts: () => calls.push("artifacts"),
      loadItems: () => calls.push("items")
    })

    await refreshMetadata({ datasetId: "ds-demo", reason: "manual" })

    expect(calls).toEqual(expect.arrayContaining(["detail", "artifacts", "items"]))
    expect(hasInvalidatedMetadata("ds-demo")).toBe(false)
    dispose()
  })
})
