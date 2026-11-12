import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(process.cwd(), "src/shell/components/HeaderIconButton.vue"), "utf8")

describe("top navigation icon button visual contract", () => {
  it("uses a 32px hit area, 16px icon, and the light-theme icon color", () => {
    expect(source).toMatch(/width:\s*32px/)
    expect(source).toMatch(/height:\s*32px/)
    expect(source).toMatch(/iconSize\?:\s*number[\s\S]*?iconSize:\s*16/)
    expect(source).toMatch(/color:\s*#4E5969/i)
  })
})
