import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

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
