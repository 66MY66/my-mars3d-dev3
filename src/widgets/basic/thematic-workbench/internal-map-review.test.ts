import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cartographyFingerprint } from "./cartography-fingerprint"
import { confirmInternalReview, internalMapBlockers, internalReviewChecks, internalReviewProblems, internalReviewSubject, type InternalReviewSource } from "./internal-map-review"

const source = (): InternalReviewSource => ({ title: "后台图层内部地图", topic: "T30101000", bounds: { west: 103, south: 32, east: 105, north: 34 }, layers: [{ id: "online:boundary", role: "boundary", name: "行政区", authority: "", publishedAt: "", source: "http://192.168.10.15:9002/rs-products/admin.geojson", security: "internal", crs: "EPSG:4326", scale: 0, data: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [104, 33] } }] }, onlineSource: { collection: "spatial-thematic", itemId: "backend-boundary", asset: "data", revision: "v1", fingerprint: "a".repeat(64), sourceItemSha256: "b".repeat(64), scope: { west: 103, south: 32, east: 105, north: 34 } } }] })
const checks = internalReviewChecks.map(check => check.id)
beforeEach(() => vi.stubGlobal("crypto", webcrypto))
afterEach(() => vi.unstubAllGlobals())
describe("human-reviewed internal map policy", () => {
  it("does not turn source metadata gaps, WGS84 or internal visibility into per-layer blockers", async () => {
    expect(internalMapBlockers(source())).toEqual([])
    const review = await confirmInternalReview(source(), "实际审核人", "保留原坐标和资料限制，供单位内部使用", checks)
    expect(internalReviewProblems(review, await cartographyFingerprint(internalReviewSubject(source())))).toEqual([])
    expect(review.scope).toBe("internal")
  })
  it("requires an actual reviewer, opinion and all five explicit confirmations", async () => {
    await expect(confirmInternalReview(source(), "", "限制", checks)).rejects.toThrow("审核人")
    await expect(confirmInternalReview(source(), "人", "", checks)).rejects.toThrow("审核意见")
    await expect(confirmInternalReview(source(), "人", "限制", checks.slice(1))).rejects.toThrow("五项")
    expect(internalReviewProblems(null, "")).toContain("请完成下方人工审核并确认本次版本")
  })
  it("invalidates approval for title, extent, source revision, layer style, order and document edits", async () => {
    const original = source()
    const review = await confirmInternalReview(original, "审核人", "限制", checks)
    for (const mutate of [s => { s.title += "修改" }, s => { s.bounds!.east += 1 }, s => { s.layers[0].onlineSource!.fingerprint = "c".repeat(64) }, s => { s.layers[0].opacity = 0.6 }, s => { s.layers[0].order = 60 }, s => { s.documentRevision = 2 }]) {
      const changed = source(); mutate(changed)
      expect(internalReviewProblems(review, await cartographyFingerprint(internalReviewSubject(changed))).join("")).toContain("重新审核")
    }
  })
  it("keeps missing core data, invalid provenance, mixed CRSs and explicit restrictions as blockers", () => {
    const empty = source(); empty.layers = []
    expect(internalMapBlockers(empty).join("")).toContain("真实后台")
    const topic = source(); topic.topic = "T30103000"
    expect(internalMapBlockers(topic).join("")).toContain("核心业务")
    const missing = source(); missing.layers[0].onlineSource!.sourceItemSha256 = ""
    expect(internalMapBlockers(missing).join("")).toContain("来源或内容无效")
    const mixed = source(); mixed.layers.push({ ...mixed.layers[0], id: "other", crs: "EPSG:4490" })
    expect(internalMapBlockers(mixed).join("")).toContain("坐标基准不一致")
    const secret = source(); secret.layers[0].security = "secret"
    expect(internalMapBlockers(secret).join("")).toContain("不能由人工勾选解除")
  })
  it("does not export hidden layers or make their metadata a publication blocker", () => {
    const input = source(); input.layers.push({ ...input.layers[0], id: "hidden", security: "secret", enabled: false })
    expect(internalMapBlockers(input)).toEqual([])
    expect(internalReviewSubject(input).layers).toHaveLength(1)
  })
})
