import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(process.cwd(), "src/shell/UserMenu.vue"), "utf8")

describe("account button visual contract", () => {
  it("uses a filled 32px surface with a contrasting 16px outline icon", () => {
    expect(source).toMatch(/width:\s*32px/)
    expect(source).toMatch(/height:\s*32px/)
    expect(source).toMatch(/background:\s*#4E5969/i)
    expect(source).toMatch(/color:\s*#fff/i)
    expect(source).toMatch(/:icon-size=\"16\"/)
    expect(source).toMatch(/margin:\s*11px\s+0/)
  })
})
