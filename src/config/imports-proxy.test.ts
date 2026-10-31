// @vitest-environment node
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import createViteConfig from "../../vite.config"

const root = process.cwd()

describe("imports API proxy routing", () => {
  it("routes imports to the management service before the generic STAC proxy in Vite", () => {
    const config = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8")
    const importsRule = config.indexOf('"/api/eoapi/imports"')
    const genericRule = config.indexOf('"/api/eoapi":')

    expect(importsRule).toBeGreaterThan(-1)
    expect(config.slice(importsRule, genericRule)).toContain('target: "http://192.168.10.15:5960"')
    expect(importsRule).toBeLessThan(genericRule)
  })

  it("routes imports to the management service before the generic STAC location in Nginx", () => {
    const config = fs.readFileSync(path.join(root, "nginx.conf"), "utf8")
    const importsRule = config.indexOf("location /api/eoapi/imports/")
    const genericRule = config.indexOf("location /api/eoapi/ {")

    expect(importsRule).toBeGreaterThan(-1)
    expect(config.slice(importsRule, genericRule)).toContain("proxy_pass http://192.168.10.15:5960/imports/")
    expect(importsRule).toBeLessThan(genericRule)
  })
})

describe("TiTiler proxy routing", () => {
  it("routes COG tile requests to port 5955 without the proxy prefix", () => {
    process.env.VITE_BASE_URL = "test"
    const config = createViteConfig({ mode: "test" } as any) as any
    delete process.env.VITE_BASE_URL
    const proxies = config.server.proxy as Record<string, { target: string; rewrite?: (path: string) => string }>
    const requestPath = "/api/titiler-cog/cog/tiles/WebMercatorQuad/4/12/6@1x?url=example"
    const matched = Object.entries(proxies).find(([context]) =>
      context.startsWith("^") ? new RegExp(context).test(requestPath) : requestPath.startsWith(context)
    )

    expect(matched).toBeTruthy()
    expect(matched?.[1].target).toBe("http://192.168.10.15:5955")
    expect(matched?.[1].rewrite?.(requestPath)).toBe("/cog/tiles/WebMercatorQuad/4/12/6@1x?url=example")
  })

  it("routes raw COG range requests to the rs-products service", () => {
    process.env.VITE_BASE_URL = "test"
    const config = createViteConfig({ mode: "test" } as any) as any
    delete process.env.VITE_BASE_URL
    const proxy = config.server.proxy["/api/rs-products"]
    expect(proxy.target).toBe("http://192.168.10.15:9002")
    expect(proxy.rewrite("/api/rs-products/rs-products/spatial/china-2020/pop2020_people_cog.tif"))
      .toBe("/rs-products/spatial/china-2020/pop2020_people_cog.tif")
  })
})
