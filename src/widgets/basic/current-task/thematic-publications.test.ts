import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { webcrypto } from "node:crypto"
import { Blob as NodeBlob, File as NodeFile } from "node:buffer"
import JSZip from "jszip"
import { createCurrentTaskPublicationHost } from "./publication-host"
import { listTaskPublications, readTaskPublication, saveTaskPublication } from "./thematic-publications"
import type { PublicationManifest, ThematicPublicationHost } from "../thematic-workbench/publication-host"

const storage = vi.hoisted(() => new Map<string, unknown>())
const writes = vi.hoisted(() => vi.fn(async (key: string, value: unknown) => { storage.set(key, value) }))
vi.mock("idb-keyval", () => ({
  createStore: vi.fn(),
  get: async (key: string) => storage.get(key),
  set: writes,
  keys: async () => Array.from(storage.keys())
}))
const sha = async (blob: Blob) => Buffer.from(await webcrypto.subtle.digest("SHA-256", await blob.arrayBuffer())).toString("hex")
async function input(): Promise<Parameters<ThematicPublicationHost["publish"]>[0]> {
  const image = new Uint8Array([137, 80, 78, 71])
  const manifest: PublicationManifest = {
    version: "mars3d.thematic-publication.v1",
id: "THEMATIC-unit",
title: "九寨沟基本情况专题图",
topic: "T30101000",
    usage: "internal-reviewed",
createdAt: "2026-11-03T00:00:00Z",
sourceSha256: "b".repeat(64),
    files: [{ path: "composition.png", bytes: image.length, sha256: await sha(new Blob([image])) }]
  }
  const zip = new JSZip().file("composition.png", image).file("manifest.json", JSON.stringify(manifest))
  const archive = new File([await zip.generateAsync({ type: "uint8array" })], "专题图-发布包.zip", { type: "application/zip" })
  return { publication: manifest, archive, packageSha256: await sha(archive), idempotencyKey: manifest.id, signal: new AbortController().signal }
}
beforeEach(() => {
  storage.clear(); writes.mockClear()
  vi.stubGlobal("crypto", webcrypto); vi.stubGlobal("Blob", NodeBlob); vi.stubGlobal("File", NodeFile)
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe("publishing actual reviewed maps into the current task", () => {
  it("persists the complete file and exposes only the matching dataset's publication", async () => {
    const value = await input()
    const host = createCurrentTaskPublicationHost(() => ({ datasetId: "dataset-1", name: "九寨沟任务" }))
    const receipt = await host.publish(value)
    expect(receipt).toMatchObject({ status: "published", packageSha256: value.packageSha256, publicationId: value.publication.id })
    expect(new URL(receipt.url!).hash).toContain("taskSection=thematics")
    expect(new URL(receipt.url!).hash).toContain("datasetId=dataset-1")
    expect(await listTaskPublications("dataset-2")).toEqual([])
    expect(await listTaskPublications("dataset-1")).toHaveLength(1)
    const stored = await readTaskPublication(value.publication.id, "dataset-1")
    expect(await sha(stored.archive)).toBe(value.packageSha256)
    expect(await stored.zip.file("composition.png")!.async("uint8array")).toEqual(new Uint8Array([137, 80, 78, 71]))
    await expect(readTaskPublication(value.publication.id, "dataset-2")).rejects.toThrow("没有")
  })
  it("reuses an identical submission without creating duplicate results and rejects conflicting retries", async () => {
    const value = await input()
    await saveTaskPublication(value, { datasetId: "a" })
    const count = writes.mock.calls.length
    await saveTaskPublication(value, { datasetId: "a" })
    expect(writes).toHaveBeenCalledTimes(count)
    await expect(saveTaskPublication(value, { datasetId: "b" })).rejects.toThrow("另一份图件")
  })
  it("does not list a failed, aborted or corrupt archive as published", async () => {
    const value = await input()
    await expect(saveTaskPublication({ ...value, packageSha256: "a".repeat(64) }, {})).rejects.toThrow("校验失败")
    expect(await listTaskPublications("local_thematic_publications")).toEqual([])
    writes.mockImplementationOnce(async () => { throw new Error("存储空间不足") })
    await expect(saveTaskPublication(value, {})).rejects.toThrow("存储空间不足")
    expect(await listTaskPublications("local_thematic_publications")).toEqual([])
    const controller = new AbortController(); controller.abort()
    await expect(saveTaskPublication({ ...value, signal: controller.signal }, {})).rejects.toThrow()
  })
  it("detects corruption when a saved publication is reopened", async () => {
    const value = await input()
    await saveTaskPublication(value, { datasetId: "a" })
    storage.set("archive:" + value.publication.id, new Blob(["incomplete"]))
    await expect(readTaskPublication(value.publication.id, "a")).rejects.toThrow("校验失败")
  })
})
