import { describe, expect, it, afterEach, vi } from "vitest"
import { auditBackendDelivery, deliveryAuditReport, deliveryRows, deliveryCollections, type DeliveryAudit } from "./backend-delivery-audit"
import { productionItem } from "./cartography-workflow"
import type { RemoteItem } from "./remote-cartography-source"
const item: RemoteItem = { type: "Feature", collection: "spatial-thematic", id: "SP-china-pop2020", bbox: [100, 20, 105, 30], properties: {}, assets: { data: { href: "http://192.168.10.15:9002/rs-products/pop.tif" } } }
afterEach(() => vi.unstubAllGlobals())
describe("backend delivery evidence without formal qualification by assumption", () => {
  it("does not mistake zero approved packages for zero connected raw data", () => {
    const audit: DeliveryAudit = { checkedAt: "2026-10-30T00:00:00Z", items: [item], collections: [{ id: "spatial-thematic", count: 1, complete: true }] }
    const report = deliveryAuditReport(audit)
    expect(report.declaredApprovedPackages).toBe(0)
    expect(report.rows.find(row => row.role === "population")?.ids).toHaveLength(1)
    expect(report.rows.find(row => row.role === "population")?.status).toContain("质量待核验")
    expect(report.rows.find(row => row.role === "event")?.status).toContain("未读全")
  })
  it("preserves backend records regardless of filenames without declaring formal approval", () => {
    const demo = { ...item, id: "SP-yunnan_disaster_by_city", assets: { ...item.assets, source: { href: "http://192.168.10.15:9002/rs-inbox/demo/yunnan.csv" } } }
    expect(productionItem(demo)).toBe(true)
    expect(deliveryAuditReport({ checkedAt: "now", items: [demo], collections: [] }).excluded).toEqual([])
    expect(productionItem({ ...item, assets: { source: { href: "http://192.168.10.15:9002/rs-products/latest/pop.tif" } } })).toBe(true)
  })
  it("marks a failed directory unknown instead of declaring a missing business dataset", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })))
    const result = await auditBackendDelivery()
    expect(result.collections).toHaveLength(deliveryCollections.length); expect(result.collections.every(c => !c.complete && c.error)).toBe(true)
    expect(deliveryRows(result).every(row => row.status.includes("不能判断"))).toBe(true)
  })
})
