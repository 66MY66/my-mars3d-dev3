import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { File, Blob } from "node:buffer"
import { webcrypto } from "node:crypto"
import JSZip from "jszip"
import { createPublicationPackage, fileSha256, validatePublicationSources } from "./publication-package"
import { confirmInternalReview, internalReviewChecks } from "./internal-map-review"
import { cartographyFingerprint } from "./cartography-fingerprint"
import { refreshRemoteItem } from "./remote-cartography-source"
vi.mock("./remote-cartography-source", () => ({ refreshRemoteItem: vi.fn() }))

const item = { type: "Feature", collection: "backend", id: "actual-source", properties: { updated: "r1" }, assets: {} } as any
const source = () => ({ title: "仅测试发布包", topic: "choropleth", presentationKey: "layout-v1", bounds: { west: 103, south: 30, east: 104, north: 31 }, layers: [{ id: "online:business", name: "真实来源测试替身", role: "business", security: "internal", crs: "EPSG:4326", data: { type: "FeatureCollection", features: [{ type: "Feature", properties: { value: 1 }, geometry: { type: "Point", coordinates: [103.5, 30.5] } }] }, onlineSource: { collection: item.collection, itemId: item.id, fingerprint: "a".repeat(64), sourceItemSha256: "" } }] } as any)
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("File", File); vi.stubGlobal("Blob", Blob); vi.stubGlobal("crypto", webcrypto); vi.mocked(refreshRemoteItem).mockResolvedValue(item) })
afterEach(() => vi.unstubAllGlobals())
async function input() {
  const data = source(); data.layers[0].onlineSource.sourceItemSha256 = await cartographyFingerprint(item)
  const review = await confirmInternalReview(data, "回归测试", "仅测试，不发布", internalReviewChecks.map(check => check.id))
  const view = { file: new File([new Uint8Array([137, 80, 78, 71])], "composition.png", { type: "image/png" }), layout: { title: "实际排版测试替身" } }
  return { data, review, view }
}
describe("portable reviewed publication packages", () => {
  it("contains the composition, data, layout, review and real file fingerprints", async () => {
    const { data, review, view } = await input()
    const result = await createPublicationPackage(data, { review, view }, new AbortController().signal)
    const zip = await JSZip.loadAsync(new Uint8Array(await result.file.arrayBuffer()))
    expect(Object.keys(zip.files).sort()).toEqual(["composition.png", "layout.json", "manifest.json", "map.json", "review.json"])
    expect(JSON.parse(await zip.file("map.json")!.async("string")).layers[0].data).toEqual(data.layers[0].data)
    expect(JSON.parse(await zip.file("review.json")!.async("string"))).toEqual(review)
    for (const entry of result.manifest.files) {
      const bytes = await zip.file(entry.path)!.async("uint8array")
      expect(bytes.length).toBe(entry.bytes)
      expect(await fileSha256(new Blob([bytes]))).toBe(entry.sha256)
    }
    expect(await fileSha256(result.file)).toBe(result.sha256)
    expect(JSON.stringify(result.manifest)).not.toMatch(/windmill|result_flow|6080/i)
  })
  it("does not permit missing review, changed layout or missing final image", async () => {
    const { data, review, view } = await input()
    await expect(createPublicationPackage(data, { view }, new AbortController().signal)).rejects.toThrow("人工审核")
    await expect(createPublicationPackage({ ...data, presentationKey: "layout-v2" }, { review, view }, new AbortController().signal)).rejects.toThrow("重新审核")
    await expect(createPublicationPackage(data, { review }, new AbortController().signal)).rejects.toThrow("排版")
  })
  it("checks every layer binding even when layers share one catalog item", async () => {
    const { data } = await input(); data.layers.push({ ...data.layers[0], onlineSource: { ...data.layers[0].onlineSource, sourceItemSha256: "b".repeat(64) } })
    await expect(validatePublicationSources(data, new AbortController().signal)).rejects.toThrow("后台版本已变化")
    expect(refreshRemoteItem).toHaveBeenCalledOnce()
  })
  it("refuses backend version changes and explicit confidentiality", async () => {
    const { data, review, view } = await input()
    vi.mocked(refreshRemoteItem).mockResolvedValueOnce({ ...item, properties: { updated: "r2" } })
    await expect(createPublicationPackage(data, { review, view }, new AbortController().signal)).rejects.toThrow("后台版本已变化")
    data.layers[0].security = "secret"
    await expect(createPublicationPackage(data, { review, view }, new AbortController().signal)).rejects.toThrow("限制共享")
  })
})
