import { afterEach, describe, expect, it, vi } from "vitest"
import { allowThematicServiceRequest, flowWrites, validThematicFile } from "./thematic-services"
import { backendAssetUrl, checkCogAsset, getThematicFlow, getThematicJob, loginThematicFlow, queryBackendResults, readBackendResult, runThematicFlow } from "./thematic-backend"
import type { RemoteItem } from "./remote-cartography-source"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const jobId = "11111111-2222-3333-4444-555555555555"
const item: RemoteItem = { type: "Feature", id: "RPT-real", collection: "disaster-report", bbox: [103, 35, 104, 36], properties: { title: "报告", "result:source_system": "演示批量导入" }, assets: { json: { href: "http://192.168.10.15:9002/rs-products/report.json" }, html: { href: "http://192.168.10.15:9002/rs-products/report.html" }, data: { href: "http://192.168.10.15:9002/rs-products/pop.tif" } } }
const allowed = (method: string, path: string, prefix: string) => allowThematicServiceRequest(method, new URL(path, "http://localhost"), `/api/thematic/${prefix}`)
afterEach(() => vi.unstubAllGlobals())

describe("controlled thematic service operations", () => {
  it("only forwards explicitly supported flow definitions jobs and login", () => {
    expect(allowed("POST", "/api/thematic/flow/api/auth/login", "flow")).toBe(true)
    expect(allowed("GET", "/api/thematic/flow/api/w/earth-data/flows/get/u/fyt/earth/search_flow", "flow")).toBe(true)
    expect(allowed("POST", "/api/thematic/flow/api/w/earth-data/jobs/run/f/u/fyt/earth/background_flow", "flow")).toBe(true)
    expect(allowed("GET", `/api/thematic/flow/api/w/earth-data/jobs_u/get/${jobId}`, "flow")).toBe(true)
    for (const path of ["/api/users/list", "/api/w/another/jobs/list", "/api/w/earth-data/jobs/run/f/unknown", "/api/w/earth-data/flows/get/u/admin/secret"]) { expect(allowed("GET", `/api/thematic/flow${path}`, "flow")).toBe(false) }
    expect(allowed("DELETE", `/api/thematic/flow/api/w/earth-data/jobs_u/get/${jobId}`, "flow")).toBe(false)
  })
  it("routes every documented file format and COG operation while constraining origins and methods", () => {
    expect(allowed("HEAD", "/api/thematic/catalog-health/", "catalog-health")).toBe(true)
    expect(allowed("GET", "/api/thematic/catalog-health/", "catalog-health")).toBe(true)
    for (const extension of ["html", "csv", "geojson", "json", "tif", "tiff", "zip", "rar", "pdf", "docx", "png", "xml"]) { expect(allowed("GET", `/api/thematic/files/rs-products/a.${extension}`, "files")).toBe(true) }
    expect(allowed("HEAD", "/api/thematic/files/rs-inbox/grids/pop2020.zip", "files")).toBe(true)
    expect(validThematicFile("http://192.168.10.15:9002/new-data-bucket/2026/data.bin")).toBe(true)
    for (const path of ["/minio/admin/v3/users", "/admin/settings", "/rs-products/", "/rs-products/%2e%2e/minio/admin/v3/users", "/rs-products/a%5cb.tif"]) { expect(allowed("GET", `/api/thematic/files${path}`, "files")).toBe(false) }
    expect(allowed("POST", "/api/thematic/files/rs-products/a.json", "files")).toBe(false)
    const prefix = "/api/thematic/cog/cog/WebMercatorQuad/tilejson.json?url="
    expect(allowed("GET", prefix + encodeURIComponent(item.assets.data.href), "cog")).toBe(true)
    for (const path of ["viewer", "preview.png", "info", "point/103,35", "WebMercatorQuad/WMTSCapabilities.xml", "bbox/103,35,104,36.png"]) { expect(allowed("GET", `/api/thematic/cog/cog/${path}?url=${encodeURIComponent(item.assets.data.href)}`, "cog")).toBe(true) }
    for (const href of ["http://localhost/private.tif", "http://192.168.10.15:9002/admin/config", "http://user:pass@192.168.10.15:9002/rs-products/a.tif", "s3://bucket/a.tif"]) { expect(validThematicFile(href)).toBe(false); expect(allowed("GET", prefix + encodeURIComponent(href), "cog")).toBe(false) }
  })
  it("treats background computation as a write even with anomaly submission disabled", async () => {
    expect(flowWrites("background_flow", { submit_anomaly: false })).toBe(true)
    expect(flowWrites("search_flow", { export: "" })).toBe(false)
    expect(flowWrites("search_flow", { export: "csv" })).toBe(true)
    expect(flowWrites("stac_flow", { action: "query" })).toBe(false)
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher)
    await expect(runThematicFlow("token", "background_flow", { submit_anomaly: false }, false)).rejects.toThrow("明确确认")
    await expect(runThematicFlow("token", "grid_layer_flow", { coverage: "event" }, false)).rejects.toThrow("明确确认")
    expect(fetcher).not.toHaveBeenCalled()
    fetcher.mockResolvedValue(new Response(jobId))
    expect(await runThematicFlow("token", "grid_layer_flow", { coverage: "event", epicenter_lon: 103.82 }, true)).toBe(jobId)
    expect(JSON.parse(fetcher.mock.lastCall![1].body)).toEqual({ coverage: "event", epicenter_lon: 103.82 })
  })
})

describe("real backend authentication and task protocol", () => {
  it("uses the documented email/password contract without browser cookies", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("session-token")); vi.stubGlobal("fetch", fetcher)
    expect(await loginThematicFlow(" user@example.test ", "test-password")).toBe("session-token")
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ email: "user@example.test", password: "test-password" })
    expect(fetcher.mock.calls[0][1].credentials).toBe("omit")
  })
  it("does not expose backend response bodies in authorization errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret credential echo", { status: 401 })))
    await expect(loginThematicFlow("user", "password")).rejects.toThrow("未授权")
  })
  it("verifies exact flow identity and never requests arbitrary workflows", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ path: "u/fyt/earth/search_flow", summary: "检索", schema: { required: [] } })); vi.stubGlobal("fetch", fetcher)
    expect((await getThematicFlow("session", "search_flow")).summary).toBe("检索")
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer session")
    fetcher.mockResolvedValue(json({ path: "another", summary: "错误" }))
    await expect(getThematicFlow("session", "search_flow")).rejects.toThrow("身份")
    await expect(getThematicFlow("session", "unknown" as any)).rejects.toThrow("未配置")
  })
  it("requires an actual backend UUID before reporting submission", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(jobId)).mockResolvedValueOnce(json({ success: true })); vi.stubGlobal("fetch", fetcher)
    expect(await runThematicFlow("session", "search_flow", { limit: 10 }, false)).toBe(jobId)
    await expect(runThematicFlow("session", "search_flow", { limit: 10 }, false)).rejects.toThrow("有效任务号")
  })
  it("distinguishes queued successful and failed jobs without substituting local results", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ id: jobId, type: "QueuedJob" })); vi.stubGlobal("fetch", fetcher)
    expect((await getThematicJob("session", jobId)).state).toBe("running")
    fetcher.mockResolvedValueOnce(json({ id: jobId, type: "CompletedJob", success: false })).mockResolvedValueOnce(json({ completed: true, success: false, result: { error: "backend failed" } }))
    expect(await getThematicJob("session", jobId)).toMatchObject({ state: "failed", result: { error: "backend failed" } })
    fetcher.mockResolvedValueOnce(json({ id: jobId, success: true })).mockResolvedValueOnce(json({ completed: true, success: true, result: { returned: 3 } }))
    expect(await getThematicJob("session", jobId)).toMatchObject({ state: "succeeded", result: { returned: 3 } })
    await expect(getThematicJob("session", "../bad")).rejects.toThrow("无效")
  })
  it("reads actual result metadata and JSON without inventing earthquake layers", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ type: "FeatureCollection", features: [item], links: [{ rel: "next" }] })).mockResolvedValueOnce(json({ event: { name: "后端报告原值" } })); vi.stubGlobal("fetch", fetcher)
    const result = await queryBackendResults("disaster-report")
    expect(result.items[0].properties["result:source_system"]).toBe("演示批量导入"); expect(result.hasMore).toBe(true)
    expect(await readBackendResult(item, "json")).toEqual({ event: { name: "后端报告原值" } })
    await expect(readBackendResult(item, "html")).rejects.toThrow("独立链接")
    expect(() => backendAssetUrl({ ...item, assets: { data: { href: "https://external.test/a.json" } } }, "data")).toThrow("文件服务")
  })
  it("queries backend result collections not present in a frontend business list", async () => {
    const future = { ...item, collection: "future-DEMO-source", id: "test" }
    const fetcher = vi.fn().mockResolvedValue(json({ type: "FeatureCollection", features: [future] })); vi.stubGlobal("fetch", fetcher)
    expect((await queryBackendResults(future.collection)).items).toEqual([future])
    expect(JSON.parse(fetcher.mock.calls[0][1].body).collections).toEqual([future.collection])
  })
  it("tests COG using the actual GeoTIFF asset instead of a STAC directory URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ tiles: ["http://192.168.10.15:5955/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png"], minzoom: 0, maxzoom: 10, bounds: item.bbox })); vi.stubGlobal("fetch", fetcher)
    expect((await checkCogAsset(item, "data")).tileCount).toBe(1)
    expect(new URL(fetcher.mock.calls[0][0], window.location.origin).searchParams.get("url")).toBe(item.assets.data.href)
    await expect(checkCogAsset(item, "html")).rejects.toThrow("实际 GeoTIFF")
  })
})
