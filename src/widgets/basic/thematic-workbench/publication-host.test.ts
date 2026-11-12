import { describe, expect, it, vi } from "vitest"
import { publishToHost, type PublicationPackage } from "./publication-host"

const prepared = { file: new File(["zip"], "map.zip"), sha256: "a".repeat(64), manifest: { version: "mars3d.thematic-publication.v1", id: "THEMATIC-id", title: "当前图件", topic: "choropleth", usage: "internal-reviewed", createdAt: "2026-11-03T00:00:00Z", sourceSha256: "b".repeat(64), files: [] } } as PublicationPackage
describe("embedding platform publication contract", () => {
  it("delegates to the host with a stable idempotency key, not a workflow endpoint", async () => {
    const publish = vi.fn(async () => ({ status: "published" as const, publicationId: "portal-1", packageSha256: prepared.sha256, url: "https://portal.example/maps/1" }))
    const result = await publishToHost({ name: "业务平台", publish }, prepared, new AbortController().signal)
    expect(result.status).toBe("published")
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ archive: prepared.file, packageSha256: prepared.sha256, idempotencyKey: prepared.manifest.id }))
  })
  it("preserves submitted status without claiming publication", async () => {
    expect((await publishToHost({ name: "业务平台", publish: async () => ({ status: "submitted", publicationId: "pending-1", packageSha256: prepared.sha256 }) }, prepared, new AbortController().signal)).status).toBe("submitted")
  })
  it("rejects mismatched package acknowledgments and unsafe or missing URLs", async () => {
    for (const receipt of [{ status: "published", publicationId: "id", packageSha256: "wrong", url: "https://example.com" }, { status: "published", publicationId: "id", packageSha256: prepared.sha256 }, { status: "published", publicationId: "id", packageSha256: prepared.sha256, url: "javascript:alert(1)" }]) {
      await expect(publishToHost({ name: "业务平台", publish: async () => receipt as any }, prepared, new AbortController().signal)).rejects.toThrow()
    }
  })
  it("cancels an unresponsive host and never accepts its late receipt", async () => {
    const controller = new AbortController()
    const pending = publishToHost({ name: "业务平台", publish: () => new Promise(() => undefined) }, prepared, controller.signal)
    controller.abort()
    await expect(pending).rejects.toThrow("取消或超时")
  })
})
